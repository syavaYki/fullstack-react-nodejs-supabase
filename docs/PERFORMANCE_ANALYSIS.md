# Performance and Scalability Analysis

**Project:** Full-stack SaaS Boilerplate (Express.js + React Router v7 SSR + Supabase + Stripe + MUI v6)
**Date:** 2026-03-06
**Branch:** `phase-1-rebuild`

---

## Table of Contents

1. [Critical Findings](#1-critical-findings)
2. [High Severity Findings](#2-high-severity-findings)
3. [Medium Severity Findings](#3-medium-severity-findings)
4. [Low Severity Findings](#4-low-severity-findings)
5. [Summary Matrix](#5-summary-matrix)

---

## 1. Critical Findings

### 1.1 N+1 Query Pattern in `initializeUsage` and `updateLimitsForTier`

**File:** `packages/backend/src/services/usage.service.ts` (lines 16-55, 60-83)
**Severity:** Critical
**Impact:** Each tier change or user initialization triggers N sequential database upserts (one per feature). With 10 features, this means 10 sequential round-trips to Supabase. At 100 concurrent tier changes, this becomes 1,000 sequential DB operations.

**Current code:**

```typescript
async initializeUsage(userId: string, tierId: string): Promise<void> {
  const tierFeatures = await membershipService.getTierFeatures(tierId);
  const features = await membershipService.getAllFeatures();

  for (const tierFeature of tierFeatures) {
    // ... filter logic ...
    const { error } = await supabaseAdmin.from('usage_tracking').upsert(
      { user_id: userId, feature_key: feature.key, /* ... */ },
      { onConflict: 'user_id,feature_key' }
    );
    // One DB round-trip per feature -- N+1 pattern
  }
}
```

**Recommendation:** Batch all upserts into a single database call.

```typescript
async initializeUsage(userId: string, tierId: string): Promise<void> {
  const tierFeatures = await membershipService.getTierFeatures(tierId);
  const features = await membershipService.getAllFeatures();

  const records = tierFeatures
    .map((tierFeature) => {
      const feature = features.find((f) => f.id === tierFeature.feature_id);
      if (!feature || feature.feature_type !== 'limit') return null;

      const periodType = FEATURE_PERIOD_MAP[feature.key] || 'lifetime';
      const limit = this.parseLimit(tierFeature.value);
      let periodEnd: string | null = null;
      if (periodType === 'daily') periodEnd = getEndOfDay().toISOString();
      else if (periodType === 'monthly') periodEnd = getEndOfMonth().toISOString();

      return {
        user_id: userId,
        feature_key: feature.key,
        current_usage: 0,
        usage_limit: limit,
        period_type: periodType,
        period_start: new Date().toISOString(),
        period_end: periodEnd,
      };
    })
    .filter(Boolean);

  if (records.length > 0) {
    const { error } = await supabaseAdmin
      .from('usage_tracking')
      .upsert(records, { onConflict: 'user_id,feature_key' });

    if (error) {
      throw new ApiError(500, `Failed to initialize usage: ${error.message}`);
    }
  }
}
```

The same pattern applies to `updateLimitsForTier` -- batch the updates into a single operation or use a PostgreSQL function that accepts an array.

---

### 1.2 Infinite Recursion Risk in `incrementUsage`

**File:** `packages/backend/src/services/usage.service.ts` (lines 105-135)
**Severity:** Critical
**Impact:** If usage initialization fails repeatedly (e.g., due to a constraint violation, network issue, or data corruption), the recursive call chain has no depth guard. This will cause a stack overflow, crashing the Node.js process and taking down the entire server for all users.

**Current code:**

```typescript
async incrementUsage(userId: string, featureKey: string, amount: number = 1): Promise<UsageResult> {
  const { data, error } = await supabaseAdmin.rpc('check_reset_and_increment_usage', { /* ... */ });

  if (!data || data.length === 0 || !data[0].success) {
    const membership = await membershipService.getUserMembership(userId);
    await this.initializeUsage(userId, membership.tier_id);
    return this.incrementUsage(userId, featureKey, amount); // UNBOUNDED RECURSION
  }
  // ...
}
```

**Recommendation:** Add a retry counter with a hard limit.

```typescript
async incrementUsage(
  userId: string,
  featureKey: string,
  amount: number = 1,
  _retryCount: number = 0
): Promise<UsageResult> {
  if (_retryCount > 1) {
    throw new ApiError(500, `Failed to increment usage for ${featureKey} after retries`);
  }

  const { data, error } = await supabaseAdmin.rpc('check_reset_and_increment_usage', {
    p_user_id: userId,
    p_feature_key: featureKey,
    p_amount: amount,
  });

  if (error) {
    throw new ApiError(500, `Failed to increment usage: ${error.message}`);
  }

  if (!data || data.length === 0 || !data[0].success) {
    const membership = await membershipService.getUserMembership(userId);
    await this.initializeUsage(userId, membership.tier_id);
    return this.incrementUsage(userId, featureKey, amount, _retryCount + 1);
  }
  // ...
}
```

---

### 1.3 Function Signature Mismatch: `check_reset_and_increment_usage`

**File:** `packages/backend/src/services/usage.service.ts` (line 113) vs `supabase/migrations/002_functions_triggers.sql` (line 274)
**Severity:** Critical
**Impact:** The application calls the RPC function with three parameters (`p_user_id`, `p_feature_key`, `p_amount`) but the SQL function only defines two parameters (`p_user_id`, `p_feature_key`). The `p_amount` parameter is silently ignored by PostgREST, meaning usage is always incremented by exactly 1 regardless of the `amount` argument passed from the application layer. Any feature that needs to increment by more than 1 (bulk operations, batch processing) will have incorrect usage tracking.

**Current SQL:**

```sql
CREATE OR REPLACE FUNCTION public.check_reset_and_increment_usage(p_user_id UUID, p_feature_key TEXT)
-- Only 2 parameters, no p_amount
```

**Current TypeScript call:**

```typescript
const { data, error } = await supabaseAdmin.rpc('check_reset_and_increment_usage', {
  p_user_id: userId,
  p_feature_key: featureKey,
  p_amount: amount, // This is silently ignored
});
```

**Recommendation:** Update the SQL function to accept and use the `p_amount` parameter.

```sql
CREATE OR REPLACE FUNCTION public.check_reset_and_increment_usage(
  p_user_id UUID,
  p_feature_key TEXT,
  p_amount INTEGER DEFAULT 1
)
RETURNS TABLE (success BOOLEAN, current_usage INTEGER, usage_limit INTEGER, remaining INTEGER, is_exceeded BOOLEAN)
-- ... update the increment line:
--   SET current_usage = v_record.current_usage + p_amount
```

---

### 1.4 In-Memory Rate Limiter: Memory Leak and Horizontal Scaling Failure

**File:** `packages/backend/src/middleware/rateLimit.middleware.ts` (lines 18-48)
**Severity:** Critical
**Impact:** Two distinct problems:

**(a) Memory leak:** The `setInterval` cleanup timer is created per `createRateLimit()` call and is never cleared. The function is called 4 times at module load (creating 4 intervals), and these intervals can never be garbage collected because they hold references to the `store` Maps. Furthermore, under sustained attack (IP spoofing), the Map can grow unboundedly between cleanup intervals.

**(b) Horizontal scaling failure:** The in-memory Map is per-process. Behind a load balancer with N instances, an attacker gets N times the rate limit, completely defeating the purpose of rate limiting.

**Current code:**

```typescript
export function createRateLimit(options: RateLimitOptions) {
  const store = new Map<string, RateLimitEntry>();
  // This interval is NEVER cleared -- memory leak
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetTime) store.delete(key);
    }
  }, windowMs);
  // ...
}
```

**Recommendation (production):** Replace with Redis-backed rate limiting via `rate-limit-redis` + `express-rate-limit`:

```typescript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';

const redisClient = createClient({ url: env.REDIS_URL });
await redisClient.connect();

export function createRateLimit(options: RateLimitOptions) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: { success: false, error: options.message },
    store: new RedisStore({ sendCommand: (...args) => redisClient.sendCommand(args) }),
    standardHeaders: true,
    legacyHeaders: false,
  });
}
```

**Recommendation (immediate fix without Redis):** At minimum, add a size cap and proper cleanup:

```typescript
export function createRateLimit(options: RateLimitOptions) {
  const { windowMs, max, message = 'Too many requests' } = options;
  const store = new Map<string, RateLimitEntry>();
  const MAX_STORE_SIZE = 10_000;

  const timer = setInterval(
    () => {
      const now = Date.now();
      for (const [key, entry] of store) {
        if (now > entry.resetTime) store.delete(key);
      }
    },
    Math.min(windowMs, 60_000)
  );

  // Allow cleanup on shutdown
  if (timer.unref) timer.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || 'unknown';
    const now = Date.now();

    if (store.size > MAX_STORE_SIZE) {
      // Emergency eviction of oldest entries
      const entries = [...store.entries()].sort((a, b) => a[1].resetTime - b[1].resetTime);
      entries.slice(0, store.size - MAX_STORE_SIZE + 1000).forEach(([k]) => store.delete(k));
    }
    // ... rest of logic
  };
}
```

---

## 2. High Severity Findings

### 2.1 Supabase Client Creation Per Request

**File:** `packages/backend/src/config/supabase.ts` (lines 19-25)
**Severity:** High
**Impact:** `createSupabaseClientWithAuth()` creates a brand-new `SupabaseClient` instance for every request that needs RLS-aware queries. This involves object allocation, configuration parsing, and internal HTTP client setup. At 1,000 requests/second, this generates significant GC pressure. Called from `membershipService.getTiers()`, `membershipService.getUserMembership()`, `membershipService.getTierFeatures()`, and `profileService.updateProfile()`.

**Current code:**

```typescript
export function createSupabaseClientWithAuth(accessToken: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}
```

**Recommendation:** Use the admin client for service-level operations (most calls already do this), and for the few that need RLS, consider an LRU cache keyed by token, or simply use the admin client with explicit user_id filtering:

```typescript
// For most operations, use supabaseAdmin directly with explicit user_id checks.
// If RLS is truly needed, use a small LRU cache:
import { LRUCache } from 'lru-cache';

const clientCache = new LRUCache<string, SupabaseClient>({
  max: 100,
  ttl: 5 * 60 * 1000, // 5 minutes
});

export function createSupabaseClientWithAuth(accessToken: string): SupabaseClient {
  const cached = clientCache.get(accessToken);
  if (cached) return cached;

  const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  clientCache.set(accessToken, client);
  return client;
}
```

---

### 2.2 No Caching for Tier and Feature Data

**File:** `packages/backend/src/services/membership.service.ts` (lines 20-141)
**Severity:** High
**Impact:** `getTiers()`, `getAllFeatures()`, and `getTierFeatures()` are called on nearly every authenticated request path (through middleware, usage checks, and service calls). Tier and feature data is semi-static -- it changes only when an admin modifies the product configuration. Every call makes a full round-trip to Supabase. In the dashboard index loader alone, `fetchWithCookies` triggers 4 parallel API calls, each of which may internally call `getAllFeatures()` and `getTiers()`.

**Estimated overhead per dashboard page load:**

- `getAllFeatures()`: called at least 2 times (via `getUsage` + `getAllUsage`)
- `getTiers()`: called at least once
- `getTierFeatures()`: called N times (once per tier on pricing page)

**Recommendation:** Add an in-memory cache with short TTL for immutable reference data:

```typescript
import { LRUCache } from 'lru-cache';

const cache = new LRUCache<string, unknown>({
  max: 50,
  ttl: 5 * 60 * 1000, // 5-minute TTL
});

export class MembershipService {
  async getAllFeatures(): Promise<Feature[]> {
    const cached = cache.get('all-features');
    if (cached) return cached as Feature[];

    const { data, error } = await supabaseAdmin.from('features').select('*').eq('is_active', true);

    if (error) throw new ApiError(500, error.message);
    cache.set('all-features', data);
    return data as Feature[];
  }

  async getTiers(): Promise<MembershipTier[]> {
    const cached = cache.get('all-tiers');
    if (cached) return cached as MembershipTier[];

    const { data, error } = await supabaseAdmin
      .from('membership_tiers')
      .select('*')
      .order('sort_order');

    if (error) throw new ApiError(500, error.message);
    cache.set('all-tiers', data);
    return data as MembershipTier[];
  }

  // Invalidation method for admin operations
  invalidateCache(): void {
    cache.clear();
  }
}
```

---

### 2.3 Redundant `checkAndResetPeriod` Query in `getUsage`

**File:** `packages/backend/src/services/usage.service.ts` (lines 140-176)
**Severity:** High
**Impact:** `getUsage()` calls `checkAndResetPeriod()` before querying usage data. The `checkAndResetPeriod` method performs its own SELECT + potential UPDATE (2 queries), then `getUsage` performs another SELECT for the actual data, plus calls `getAllFeatures()` (another query). Total: 3-4 DB calls for a single usage lookup. The `check_reset_and_increment_usage` RPC already handles period resets atomically -- the application-layer reset check is redundant.

**Recommendation:** Remove the `checkAndResetPeriod` call from `getUsage()`. The period reset is already handled atomically by the database function when usage is incremented. For read-only checks, the stale data for at most one request cycle is acceptable, or move the reset logic into the SELECT query via a database function:

```typescript
async getUsage(userId: string, featureKey: string): Promise<FeatureUsage | null> {
  // Removed: await this.checkAndResetPeriod(userId, featureKey);
  // Period resets are handled atomically during increment operations

  const { data, error } = await supabaseAdmin
    .from('usage_tracking')
    .select('*')
    .eq('user_id', userId)
    .eq('feature_key', featureKey)
    .single();

  // ... rest of method
}
```

---

### 2.4 Sequential Stripe API Calls in `getLatestActiveSubscription`

**File:** `packages/backend/src/services/stripe.service.ts` (lines 302-324)
**Severity:** High
**Impact:** Two sequential Stripe API calls (trialing, then active) when the most common case is a single active subscription. Stripe API calls have ~200-500ms latency each. This adds 400-1000ms to every `syncFromStripe()` and trial status check.

**Current code:**

```typescript
async getLatestActiveSubscription(customerId: string): Promise<Stripe.Subscription | null> {
  const trialingSubscriptions = await stripe.subscriptions.list({
    customer: customerId, status: 'trialing', limit: 1,
  });
  if (trialingSubscriptions.data.length > 0) return trialingSubscriptions.data[0];

  const activeSubscriptions = await stripe.subscriptions.list({
    customer: customerId, status: 'active', limit: 1,
  });
  if (activeSubscriptions.data.length > 0) return activeSubscriptions.data[0];
  return null;
}
```

**Recommendation:** Make both calls in parallel:

```typescript
async getLatestActiveSubscription(customerId: string): Promise<Stripe.Subscription | null> {
  const [trialingResult, activeResult] = await Promise.all([
    stripe.subscriptions.list({ customer: customerId, status: 'trialing', limit: 1 }),
    stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 1 }),
  ]);

  // Prioritize trialing over active
  return trialingResult.data[0] || activeResult.data[0] || null;
}
```

---

### 2.5 Circular Import Between `stripeService` and `membershipService`

**File:** `packages/backend/src/services/stripe.service.ts` (line 5) and `packages/backend/src/services/membership.service.ts` (line 10)
**Severity:** High
**Impact:** Both modules import each other at the top level: `stripe.service.ts` imports `membershipService`, and `membership.service.ts` imports `stripeService`. Node.js handles circular requires by returning a partially-constructed module, meaning one of the two singleton instances will be `undefined` at import time. This currently works because the services are only used inside async methods (not at module evaluation time), but it is fragile. Any refactoring that accesses the imported service at module level will silently fail with `TypeError: Cannot read properties of undefined`.

**Recommendation:** Break the cycle with lazy imports or a service locator:

```typescript
// Option A: Lazy import in the method that needs it
async syncFromStripe(userId: string, forceSync = false) {
  const { stripeService } = await import('./stripe.service.js');
  // ...
}

// Option B: Dependency injection via a service registry
class ServiceRegistry {
  private services = new Map<string, unknown>();
  register<T>(name: string, service: T): void { this.services.set(name, service); }
  get<T>(name: string): T { return this.services.get(name) as T; }
}
```

---

### 2.6 `resetPeriodicUsage` N+1 Update Pattern

**File:** `packages/backend/src/services/usage.service.ts` (lines 225-262)
**Severity:** High
**Impact:** Fetches all expired records and then updates them one-by-one in a loop. With 1,000 users and 5 trackable features each, end-of-month reset triggers 5,000 sequential UPDATE queries. This would take minutes on a modest database and block the event loop for the duration.

**Recommendation:** Replace with a single bulk SQL operation:

```sql
-- Create a stored procedure for bulk reset
CREATE OR REPLACE FUNCTION public.reset_all_expired_usage()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE
  reset_count INTEGER;
BEGIN
  UPDATE public.usage_tracking
  SET current_usage = 0,
      period_start = NOW(),
      period_end = CASE period_type
        WHEN 'daily' THEN (NOW() AT TIME ZONE 'UTC')::DATE + INTERVAL '1 day' - INTERVAL '1 second'
        WHEN 'monthly' THEN DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month' - INTERVAL '1 second'
        ELSE period_end
      END
  WHERE period_end < NOW()
    AND period_type IN ('daily', 'monthly');

  GET DIAGNOSTICS reset_count = ROW_COUNT;
  RETURN reset_count;
END;
$$;
```

```typescript
async resetPeriodicUsage(): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc('reset_all_expired_usage');
  if (error) throw new ApiError(500, error.message);
  return data as number;
}
```

---

## 3. Medium Severity Findings

### 3.1 No Graceful Server Shutdown (Connection Draining)

**File:** `packages/backend/src/index.ts` (lines 76-84)
**Severity:** Medium
**Impact:** On SIGTERM/SIGINT, `process.exit(0)` is called immediately without closing the HTTP server or draining active connections. Active requests are abruptly terminated, Stripe webhooks may fail mid-processing (losing payment data), and database transactions may be left in an inconsistent state.

**Current code:**

```typescript
process.on('SIGTERM', () => {
  logger.info('SYSTEM', 'SIGTERM received, shutting down gracefully');
  process.exit(0); // NOT GRACEFUL -- kills immediately
});
```

**Recommendation:**

```typescript
const server = app.listen(PORT, () => {
  /* ... */
});

function gracefulShutdown(signal: string) {
  logger.info('SYSTEM', `${signal} received, draining connections...`);
  server.close(() => {
    logger.info('SYSTEM', 'All connections drained, exiting');
    process.exit(0);
  });

  // Force exit after 30 seconds if connections won't drain
  setTimeout(() => {
    logger.warn('SYSTEM', 'Forced exit after timeout');
    process.exit(1);
  }, 30_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

---

### 3.2 `getAllUsage` Makes 3 Sequential DB Calls

**File:** `packages/backend/src/services/usage.service.ts` (lines 181-220)
**Severity:** Medium
**Impact:** Three separate database queries are made sequentially: `getUserTierWithFeatures` (RPC), usage_tracking SELECT, and `getAllFeatures` SELECT. These could be parallelized to reduce overall latency by ~60%.

**Current code:**

```typescript
async getAllUsage(userId: string): Promise<UsageSummary> {
  const tierWithFeatures = await membershipService.getUserTierWithFeatures(userId); // Query 1
  const { data } = await supabaseAdmin.from('usage_tracking').select('*').eq('user_id', userId); // Query 2
  const features = await membershipService.getAllFeatures(); // Query 3
  // ...
}
```

**Recommendation:** Parallelize independent queries:

```typescript
async getAllUsage(userId: string): Promise<UsageSummary> {
  const [tierWithFeatures, usageResult, features] = await Promise.all([
    membershipService.getUserTierWithFeatures(userId),
    supabaseAdmin.from('usage_tracking').select('*').eq('user_id', userId),
    membershipService.getAllFeatures(),
  ]);
  // ...
}
```

---

### 3.3 Frontend: Duplicate Pricing Data Fetch (Landing Page)

**File:** `packages/frontend/app/components/landing/PricingSection.tsx` (lines 57-67)
**Severity:** Medium
**Impact:** The `PricingSection` component makes a client-side `useEffect` fetch for tier data on every mount. Since this is an SSR application, the landing page (`_index.tsx`) could pre-fetch this in a loader and pass it as props, avoiding a visible loading state (skeleton cards) and an extra round-trip.

**Current code:**

```typescript
export default function PricingSection() {
  const [tiers, setTiers] = useState<TierWithFeatures[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPublicTiersWithFeatures().then((res) => {
      /* ... */
    });
  }, []);
  // Shows skeleton cards during loading
}
```

**Recommendation:** Fetch in the landing page loader (server-side) and pass as props:

```typescript
// In _index.tsx
export async function loader() {
  const res = await fetch(`${BACKEND_URL}/api/membership/public/tiers-with-features`);
  const data = await res.json();
  return { tiers: data.success ? data.data : [] };
}

export default function LandingPage() {
  const { tiers } = useLoaderData<typeof loader>();
  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <PricingSection tiers={tiers} />
      {/* ... */}
    </>
  );
}
```

---

### 3.4 Frontend: Hardcoded Usage Data in `dashboard.usage.tsx`

**File:** `packages/frontend/app/routes/dashboard.usage.tsx` (lines 22-52)
**Severity:** Medium
**Impact:** The usage page displays hardcoded mock data instead of fetching real usage from the backend API. This is non-functional for production use. The backend has a fully working `GET /api/membership/usage` endpoint. The dashboard index already fetches real usage data -- this page should do the same.

**Recommendation:** Use a server-side loader like the dashboard index does:

```typescript
export async function loader({ request }: Route.LoaderArgs) {
  const usage = await fetchWithCookies<UsageSummary>('/api/membership/usage', request);
  return { usage };
}
```

---

### 3.5 Missing Database Indexes for Common Query Patterns

**File:** `supabase/migrations/001_schema.sql`
**Severity:** Medium
**Impact:** Several common query patterns lack covering indexes:

1. **`usage_tracking` composite lookup:** The `(user_id, feature_key)` UNIQUE constraint creates an index, but queries also filter by `period_end < NOW()` in `resetPeriodicUsage`. A partial index would accelerate this.

2. **`memberships.status`:** The `get_user_tier_with_features` and `user_has_feature` functions filter on `m.status = 'active'`, but there is no index on `status`.

3. **`stripe_webhook_events` processing queue:** Queries filter by `processed = false AND retry_count < 3` (in `v_dashboard_stats` view), but no index covers this.

4. **`contact_submissions.status`:** Filtered in the dashboard stats view but not indexed.

**Recommendation:** Add targeted indexes:

```sql
-- Periodic usage reset acceleration
CREATE INDEX IF NOT EXISTS idx_usage_tracking_period_reset
  ON public.usage_tracking(period_end)
  WHERE period_type IN ('daily', 'monthly') AND period_end IS NOT NULL;

-- Active membership lookups
CREATE INDEX IF NOT EXISTS idx_memberships_active
  ON public.memberships(user_id, tier_id)
  WHERE status = 'active';

-- Webhook processing queue
CREATE INDEX IF NOT EXISTS idx_webhook_unprocessed
  ON public.stripe_webhook_events(created_at)
  WHERE processed = false AND retry_count < 3;

-- Contact submissions queue
CREATE INDEX IF NOT EXISTS idx_contact_status
  ON public.contact_submissions(status)
  WHERE status = 'new';
```

---

### 3.6 Auth Middleware Performs Dual Auth Checks Per Request

**File:** `packages/backend/src/middleware/auth.middleware.ts` (lines 11-50)
**Severity:** Medium
**Impact:** The auth middleware first attempts cookie-based auth via `supabaseReqRes.auth.getUser()` (which makes a network call to Supabase Auth), and if that succeeds, it then makes a second call with `supabaseReqRes.auth.getSession()`. If cookie auth fails, it falls through to Bearer token auth (another Supabase call). For API clients that always use Bearer tokens, the cookie auth attempt is wasted latency (~50-100ms). For browser clients, two calls are made when one would suffice.

**Recommendation:** For browser clients, `getSession()` returns both user and session in one call. Use it first:

```typescript
export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    // Strategy 1: Cookie-based auth
    const supabaseReqRes = createSupabaseReqResClient(req, res);
    const { data: sessionData } = await supabaseReqRes.auth.getSession();

    if (sessionData?.session?.user) {
      req.user = sessionData.session.user;
      req.accessToken = sessionData.session.access_token;
      return next();
    }

    // Strategy 2: Bearer token
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: tokenData, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && tokenData?.user) {
        req.user = tokenData.user;
        req.accessToken = token;
      }
    }
    next();
  } catch (error) {
    logger.logError('AUTH', 'Auth middleware error', error);
    next();
  }
}
```

---

### 3.7 `v_dashboard_stats` View Executes 9 Sequential Subqueries

**File:** `supabase/migrations/004_views.sql` (lines 60-78)
**Severity:** Medium
**Impact:** The `v_dashboard_stats` view runs 9 independent `COUNT(*)` / aggregate subqueries each time it is selected. On a database with 100K users, this will sequentially scan multiple large tables. While PostgreSQL may optimize some of these, the aggregate-heavy nature means each subquery does a full table scan or index scan.

**Recommendation:** For production use, materialize this view or compute stats asynchronously:

```sql
-- Option A: Materialized view with periodic refresh
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_dashboard_stats AS
SELECT /* ... same query ... */;

CREATE UNIQUE INDEX ON public.mv_dashboard_stats (total_users); -- dummy unique for REFRESH CONCURRENTLY

-- Refresh via cron job every 5 minutes
-- SELECT cron.schedule('refresh-dashboard-stats', '*/5 * * * *',
--   'REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_dashboard_stats');
```

---

### 3.8 SSR Loader Waterfall: Dashboard Index Makes 4 Parallel Backend Calls

**File:** `packages/frontend/app/routes/dashboard._index.tsx` (lines 28-37)
**Severity:** Medium
**Impact:** The dashboard loader makes 4 parallel `fetchWithCookies` calls to the backend. Each backend call then makes its own database queries (e.g., the trial status endpoint alone makes 3 DB queries internally). The 4 frontend calls result in roughly 12-15 database queries on page load. While the frontend calls are parallelized, the backend processing for each is not optimized.

**Recommendation:** Create a dedicated backend endpoint that returns all dashboard data in a single call:

```typescript
// Backend: GET /api/dashboard/overview
router.get(
  '/overview',
  authMiddleware,
  requireUser,
  asyncHandler(async (req, res) => {
    const [profile, membership, usage] = await Promise.all([
      profileService.getProfile(req.user.id),
      membershipService.getUserMembership(req.user.id),
      usageService.getAllUsage(req.user.id),
    ]);

    // Derive trial status from membership data instead of separate Stripe call
    const trialStatus = {
      is_on_trial: membership.stripe_status === 'trialing',
      // ... derive from existing data
    };

    res.json({ success: true, data: { profile, membership, trialStatus, usage } });
  })
);
```

---

### 3.9 Frontend: MUI Icon Imports Not Tree-Shaken

**Files:** `packages/frontend/app/routes/dashboard.tsx`, `dashboard.billing.tsx`, `dashboard.membership.tsx`, and other route files
**Severity:** Medium
**Impact:** MUI icons are imported using named imports from `@mui/icons-material`, e.g., `import DashboardIcon from '@mui/icons-material/Dashboard'`. This is actually the correct path-based import (good). However, the `dashboard.tsx` layout file imports 6 icon components that are rendered on every dashboard page load. Since React Router v7 SSR bundles all layout code, these icons add to the server-side rendering cost and initial JS bundle size.

The MUI component imports in `dashboard.billing.tsx` and other route files import from `@mui/material` barrel exports (e.g., `import { Box, Card, ... } from '@mui/material'`), which prevents effective tree-shaking and includes the entire MUI component library in the chunk.

**Recommendation:** Use path imports for MUI components in all route files:

```typescript
// Instead of:
import { Box, Card, CardContent, Typography, Button } from '@mui/material';

// Use:
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
```

Note: Some files like `PricingSection.tsx` already follow this pattern correctly.

---

## 4. Low Severity Findings

### 4.1 Google Fonts Loaded Synchronously on Every Page

**File:** `packages/frontend/app/root.tsx` (lines 23-37)
**Severity:** Low
**Impact:** The Inter font is loaded via a blocking `<link rel="stylesheet">` from Google Fonts CDN on every page load. This adds a render-blocking external request (~100-300ms). While `preconnect` hints are used, the stylesheet itself is still blocking.

**Recommendation:** Use `font-display: swap` (already in the URL) and consider self-hosting the font:

```typescript
export const links: Route.LinksFunction = () => [
  {
    rel: 'preload',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    as: 'style',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    // Consider: media: 'print', onload: "this.media='all'"
  },
];
```

For best performance, self-host via `@fontsource/inter`:

```bash
npm install @fontsource/inter
```

```typescript
// In root.tsx
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
```

---

### 4.2 Dynamic Import in `resetPassword` Creates New Client Per Call

**File:** `packages/backend/src/services/auth.service.ts` (lines 102-121)
**Severity:** Low
**Impact:** `resetPassword` uses a dynamic `import('@supabase/supabase-js')` on each call, then creates a new Supabase client. The dynamic import incurs module resolution overhead, and the client instantiation is wasteful. This method is called infrequently (only on password resets), so the impact is minor.

**Recommendation:** Use the existing `createSupabaseClientWithAuth` helper:

```typescript
async resetPassword(accessToken: string, newPassword: string): Promise<void> {
  const client = createSupabaseClientWithAuth(accessToken);
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) throw new ApiError(400, error.message);
}
```

---

### 4.3 `formatPrice` Utility Duplicated in Multiple Route Files

**Files:** `dashboard._index.tsx` (line 78), `dashboard.membership.tsx` (line 107)
**Severity:** Low
**Impact:** No performance impact directly, but the duplicated `formatPrice` and `formatDate` functions create `Intl.NumberFormat` / `Intl.DateTimeFormat` objects on each call. For hot paths, pre-constructing these formatters once is more efficient.

**Recommendation:** Use a shared, pre-instantiated formatter (the one in `utils/formatting.ts` already exists):

```typescript
// utils/formatting.ts -- pre-construct formatters
const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
});

export function formatPrice(price: number): string {
  return priceFormatter.format(price);
}
```

---

### 4.4 Logger Performs JSON.stringify on Every Debug Log

**File:** `packages/backend/src/utils/logger.ts` (lines 28-37)
**Severity:** Low
**Impact:** `JSON.stringify(data)` is called inside `formatLog` for every log entry that has data. In production, most debug logs are suppressed by `shouldLog()`, but the function still allocates the format string before the level check. At high throughput, unnecessary string allocations can contribute to GC pauses.

**Current code:**

```typescript
function formatLog(
  level: LogLevel,
  category: LogCategory,
  message: string,
  data?: Record<string, unknown>
): string {
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  return `${timestamp}[${level.toUpperCase()}] [${category}] ${message}${dataStr}`;
}
```

Note: `shouldLog()` is called before `formatLog()` in the public methods, so the cost only applies to logs that will actually be emitted. The impact is limited.

---

### 4.5 No Request Timeout Configuration

**File:** `packages/backend/src/index.ts`
**Severity:** Low
**Impact:** No `server.timeout` or `server.keepAliveTimeout` is configured. The default Node.js HTTP server timeout is 0 (no timeout). Long-running Stripe API calls or database queries that hang will hold the connection indefinitely, potentially exhausting connection limits under load.

**Recommendation:**

```typescript
const server = app.listen(PORT, () => {
  /* ... */
});
server.timeout = 30_000; // 30-second request timeout
server.keepAliveTimeout = 65_000; // Slightly more than load balancer timeout
server.headersTimeout = 66_000;
```

---

### 4.6 `SELECT *` Used in Most Database Queries

**Files:** Multiple service files
**Severity:** Low
**Impact:** Queries like `supabaseAdmin.from('memberships').select('*')` retrieve all columns including potentially large JSONB `metadata` fields and timestamps that are never used. For tables with many columns, this increases network transfer and deserialization overhead.

**Recommendation:** Select only needed columns:

```typescript
// Instead of:
const { data } = await supabaseAdmin.from('user_profiles').select('*').eq('id', userId).single();

// Use:
const { data } = await supabaseAdmin
  .from('user_profiles')
  .select('id, email, first_name, last_name, stripe_customer_id, profile_completeness')
  .eq('id', userId)
  .single();
```

---

### 4.7 Webhook JSONB Payload Storage Without Size Limit

**File:** `packages/backend/src/services/webhook.service.ts` (lines 29-43) and `supabase/migrations/001_schema.sql` (line 143)
**Severity:** Low
**Impact:** The entire Stripe event object (which can be 10-50KB for complex events with expanded objects) is stored as JSONB in `stripe_webhook_events.payload`. Over time, this table will grow significantly. With 1,000 events/day, this adds ~15-50MB/day of uncompressed JSONB data. There is no cleanup mechanism or retention policy.

**Recommendation:** Add a retention policy and consider storing only essential fields:

```sql
-- Add a cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_old_webhook_events()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.stripe_webhook_events
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND processed = true;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
```

---

### 4.8 Frontend: AuthContext Creates Supabase Listener Without Cleanup Race

**File:** `packages/frontend/app/contexts/AuthContext.tsx` (lines 48-83)
**Severity:** Low
**Impact:** The `useEffect` in `AuthProvider` calls `getSession()` and then `onAuthStateChange()`. There is a potential race where the auth state change fires before `getSession()` resolves, causing the state to flip between values. The `checkAdminStatus()` call is fire-and-forget (no await), meaning the admin state may not be set when the component first renders.

---

## 5. Summary Matrix

| #   | Finding                                                  | Severity | Category           | Est. Impact                          |
| --- | -------------------------------------------------------- | -------- | ------------------ | ------------------------------------ |
| 1.1 | N+1 queries in `initializeUsage` / `updateLimitsForTier` | Critical | Database           | 10x latency on tier changes          |
| 1.2 | Infinite recursion in `incrementUsage`                   | Critical | Memory             | Server crash (stack overflow)        |
| 1.3 | `p_amount` parameter ignored by SQL function             | Critical | Correctness        | Silent data corruption               |
| 1.4 | In-memory rate limiter: leak + no horizontal scaling     | Critical | Memory/Scalability | OOM crash; bypassed with N instances |
| 2.1 | Supabase client created per request                      | High     | Memory             | GC pressure at high throughput       |
| 2.2 | No caching for tier/feature reference data               | High     | Database           | 2-4 redundant queries per request    |
| 2.3 | Redundant `checkAndResetPeriod` in `getUsage`            | High     | Database           | 2 extra DB round-trips per call      |
| 2.4 | Sequential Stripe API calls in subscription lookup       | High     | I/O                | 200-500ms added latency              |
| 2.5 | Circular imports between stripe/membership services      | High     | Reliability        | Fragile initialization order         |
| 2.6 | `resetPeriodicUsage` N+1 updates                         | High     | Database           | Minutes-long DB operation at scale   |
| 3.1 | No graceful server shutdown                              | Medium   | Reliability        | Data loss on deploys                 |
| 3.2 | Sequential DB calls in `getAllUsage`                     | Medium   | Database           | ~60% extra latency                   |
| 3.3 | Client-side fetch for landing page pricing               | Medium   | Frontend           | Extra round-trip, skeleton flash     |
| 3.4 | Hardcoded usage data in usage page                       | Medium   | Correctness        | Non-functional page                  |
| 3.5 | Missing database indexes for hot paths                   | Medium   | Database           | Full table scans on filtering        |
| 3.6 | Dual auth check in middleware                            | Medium   | I/O                | ~100ms wasted per API request        |
| 3.7 | `v_dashboard_stats` runs 9 subqueries                    | Medium   | Database           | Slow admin dashboard                 |
| 3.8 | Dashboard loader makes 4 parallel backend calls          | Medium   | I/O                | 12-15 DB queries per page load       |
| 3.9 | MUI barrel imports prevent tree-shaking                  | Medium   | Frontend           | Larger JS bundles                    |
| 4.1 | Synchronous Google Fonts loading                         | Low      | Frontend           | 100-300ms render blocking            |
| 4.2 | Dynamic import in `resetPassword`                        | Low      | I/O                | Minor overhead per call              |
| 4.3 | Duplicated `formatPrice` / `formatDate` utilities        | Low      | Frontend           | Repeated allocations                 |
| 4.4 | Logger JSON.stringify on every log entry                 | Low      | CPU                | Minor GC overhead                    |
| 4.5 | No HTTP request timeout configuration                    | Low      | Reliability        | Connection exhaustion risk           |
| 4.6 | `SELECT *` in most database queries                      | Low      | Database           | Unnecessary data transfer            |
| 4.7 | Webhook payload stored without retention                 | Low      | Database           | Unbounded table growth               |
| 4.8 | Auth listener race condition                             | Low      | Frontend           | Momentary incorrect state            |

---

## Priority Action Plan

### Immediate (Before Production)

1. Fix `p_amount` parameter mismatch in SQL function (1.3)
2. Add recursion depth guard to `incrementUsage` (1.2)
3. Batch N+1 queries in `initializeUsage` and `updateLimitsForTier` (1.1)
4. Add size cap and `timer.unref()` to rate limiter (1.4)
5. Add graceful shutdown (3.1)
6. Wire up real data in usage page (3.4)

### Short Term (First Month)

7. Add in-memory cache for tiers and features (2.2)
8. Remove redundant `checkAndResetPeriod` call (2.3)
9. Parallelize Stripe subscription lookups (2.4)
10. Parallelize `getAllUsage` DB calls (3.2)
11. Add missing database indexes (3.5)
12. Create bulk reset SQL function (2.6)

### Medium Term (First Quarter)

13. Replace in-memory rate limiter with Redis-backed (1.4)
14. Create consolidated dashboard API endpoint (3.8)
15. Optimize auth middleware dual-check (3.6)
16. Pre-fetch pricing data in SSR loader (3.3)
17. Break circular import cycle (2.5)
18. Self-host fonts (4.1)
19. Use path imports for MUI components (3.9)
