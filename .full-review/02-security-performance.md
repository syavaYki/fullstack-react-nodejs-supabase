# Phase 2: Security & Performance Review

## Security Findings

### Critical (7 findings)

| ID   | Finding                                                                                                                                                                                                     | CVSS | CWE     | File                                         |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------- | -------------------------------------------- |
| S-C1 | **Logout completely broken** — `supabaseClient.auth.admin.signOut()` uses anon client, requires service_role. Sessions never revoked.                                                                       | 8.1  | CWE-613 | `auth.service.ts:64-69`                      |
| S-C2 | **Open redirect via checkout URLs** — `success_url`/`cancel_url` accept arbitrary URLs. `safeRedirectUrlSchema` exists but unused. Attacker redirects user post-payment to phishing site.                   | 7.4  | CWE-601 | `billing.schemas.ts:7-8`                     |
| S-C3 | **Infinite recursion in `incrementUsage`** — DB function returns wrong columns, `!data[0].success` always true, recursive call with no depth guard → stack overflow crash.                                  | 7.5  | CWE-674 | `usage.service.ts:105-135`                   |
| S-C4 | **`/change-tier` exposed in production** — Any authenticated user can upgrade to Pro tier without payment. No admin check or environment guard.                                                             | 9.1  | CWE-284 | `membership.routes.ts:257-271`               |
| S-C5 | **`resetPassword` bypasses validated config** — Uses raw `process.env` with non-null assertions instead of validated `env` object and existing `createSupabaseClientWithAuth` utility.                      | 7.2  | CWE-209 | `auth.service.ts:102-121`                    |
| S-C6 | **All SECURITY DEFINER functions callable via anon key** — No `REVOKE`/`GRANT` statements. Anyone with the public anon key can call `change_user_tier`, `increment_usage`, etc. directly via PostgREST API. | 8.6  | CWE-269 | `002_functions_triggers.sql` (all functions) |
| S-C7 | **No paid-tier validation in checkout** — Code doesn't verify the requested tier is a paid tier before creating Stripe checkout session.                                                                    | 8.1  | CWE-639 | `stripe.service.ts:98-101`                   |

### High (6 findings)

| ID   | Finding                                                                                                                                    | CVSS | CWE     | File                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ------- | ----------------------------------------- |
| S-H1 | **Swagger UI exposed in production** — No environment guard on `/api-docs` endpoint.                                                       | 5.3  | CWE-200 | `index.ts:54`                             |
| S-H2 | **Rate limiter bypass via IP spoofing** — `trust proxy` not configured, `X-Forwarded-For` header trusted. In-memory store lost on restart. | 6.5  | CWE-307 | `rateLimit.middleware.ts:30-31`           |
| S-H3 | **Weak password policy** — Only 8-char minimum, no complexity requirements (uppercase, numbers, special chars).                            | 5.9  | CWE-521 | `auth.schemas.ts:6`                       |
| S-H4 | **Auth middleware fail-open** — On any exception, calls `next()` without auth. If Supabase is down, all routes process as unauthenticated. | 7.3  | CWE-280 | `auth.middleware.ts:46-49`                |
| S-H5 | **Usage enforcement fail-open** — `enforceCollectionLimit` calls `next()` on DB errors, allowing limit bypass during outages.              | 6.5  | CWE-755 | `usage.middleware.ts:134-135`             |
| S-H6 | **`contact_submissions` missing `user_agent` column** — Service inserts value but column doesn't exist, causing runtime error.             | N/A  | CWE-20  | `001_schema.sql`, `contact.service.ts:27` |

### Medium (8 findings)

| ID   | Finding                                                   | CVSS | CWE      | File                    |
| ---- | --------------------------------------------------------- | ---- | -------- | ----------------------- |
| S-M1 | Stripe API version pinned to `2023-10-16` (2+ years old)  | 4.3  | CWE-1104 | `stripe.ts:5`           |
| S-M2 | No CSRF protection for state-changing endpoints           | 5.4  | CWE-352  | `index.ts`              |
| S-M3 | `sameSite: 'none'` in production weakens cookie security  | 5.0  | CWE-1275 | `supabase.ts:51`        |
| S-M4 | No request body size limit on webhook endpoint            | 5.3  | CWE-770  | `index.ts:44`           |
| S-M5 | Full Stripe webhook payload stored in DB (sensitive data) | 4.6  | CWE-312  | `webhook.service.ts:33` |
| S-M6 | `payment-history` endpoint missing limit validation       | 4.3  | CWE-770  | `billing.routes.ts:85`  |
| S-M7 | Nullable `stripe_price_id` with no startup health check   | 4.3  | CWE-754  | `001_schema.sql:47-48`  |
| S-M8 | No Helmet CSP configuration for Swagger UI HTML           | 4.3  | CWE-1021 | `index.ts:20`           |

### Low (5 findings)

| ID   | Finding                                                                                   | File                         |
| ---- | ----------------------------------------------------------------------------------------- | ---------------------------- |
| S-L1 | `SUPABASE_JWT_SECRET` validated but never used (JWT validation delegated to Supabase API) | `env.ts:20`                  |
| S-L2 | `express.urlencoded` enabled but no route uses URL-encoded data                           | `index.ts:46`                |
| S-L3 | `setInterval` in rate limiter never cleared (memory leak potential)                       | `rateLimit.middleware.ts:23` |
| S-L4 | `stripe` package at version 14 — may be behind latest                                     | `package.json`               |
| S-L5 | Supabase error messages forwarded directly to client (info leakage)                       | `auth.service.ts:19,119`     |

### Database RLS Summary

All 11 tables have RLS enabled with well-implemented policies. The critical gap is **SECURITY DEFINER functions** (C-06) which bypass RLS and are callable by any role.

---

## Performance Findings

### Critical (1 finding)

| ID   | Finding                                                                                                                                   | Impact                     | File                       |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | -------------------------- |
| P-C1 | **Infinite recursion in `incrementUsage`** causes server crash — DB function signature mismatch guarantees the retry branch on every call | Server crash, complete DoS | `usage.service.ts:105-135` |

### High (3 findings)

| ID   | Finding                                                                                                                                                                 | Impact                                  | File                            |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------- |
| P-H1 | **In-memory rate limiter memory leak** — `Map` has no size cap, `setInterval` never cleared/unref'd. Under sustained traffic from rotating IPs, memory grows unbounded. | Memory exhaustion, eventual OOM         | `rateLimit.middleware.ts:18-28` |
| P-H2 | **No graceful shutdown** — `process.exit(0)` called without `server.close()`. In-flight requests (including Stripe webhooks) abruptly terminated.                       | Lost webhook events, inconsistent state | `index.ts:75-84`                |
| P-H3 | **Immediate downgrade on first payment failure** — Bypasses Stripe's Smart Retries. User loses access even if the retry would succeed.                                  | Poor UX, support burden                 | `webhook.service.ts:241-255`    |

### Medium (5 findings)

| ID   | Finding                                                                                                                                                      | Impact                                        | File                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- | --------------------------------------------- |
| P-M1 | **N+1 queries in `initializeUsage` and `updateLimitsForTier`** — Individual DB upsert per feature in a loop. With N features = N round-trips.                | Scales linearly with feature count            | `usage.service.ts:16-55,60-83`                |
| P-M2 | **3 sequential DB calls in `getAllUsage`** — `getUserTierWithFeatures`, `usage_tracking` query, `getAllFeatures` run sequentially but could be parallelized. | 3x latency vs 1x                              | `usage.service.ts:181-220`                    |
| P-M3 | **O(n\*m) feature lookup** — `features.find()` inside a loop for each usage record creates quadratic lookup.                                                 | Scales poorly with features                   | `usage.service.ts:200-215`                    |
| P-M4 | **`setStripeCustomerId` silently swallows errors** — Stripe customer ID created but not persisted, causing duplicate customer creation on next checkout.     | Duplicate Stripe customers, billing confusion | `profile.service.ts:73-82`                    |
| P-M5 | **Circular import between stripeService and membershipService** — Fragile module initialization, harder to test.                                             | Tech debt, potential init issues              | `stripe.service.ts` ↔ `membership.service.ts` |

### Low (3 findings)

| ID   | Finding                                                                                                   | Impact                       | File                                   |
| ---- | --------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------- |
| P-L1 | **Swagger `apis` glob won't match in production** — `./src/routes/*.ts` won't find `.js` files in `dist/` | Empty API docs in production | `swagger.ts:65`                        |
| P-L2 | **No request correlation ID** — Cannot trace requests across middleware/service log entries               | Debugging difficulty         | `index.ts`                             |
| P-L3 | **Magic number `24 * 60 * 60 * 1000` used instead of `STRIPE_SYNC_CACHE_TTL_MS` constant**                | Maintainability              | `membership.service.ts` multiple lines |

---

## Critical Issues for Phase 3 Context

These findings affect testing and documentation requirements:

1. **Testing**: DB function signature mismatches (S-C3, S-C4, S-C6) must be fixed before integration tests can be meaningful
2. **Testing**: Security-critical paths need test coverage: auth logout, checkout URL validation, tier change authorization, SECURITY DEFINER function permissions
3. **Testing**: Rate limiter needs test cleanup mechanism (setInterval leak)
4. **Documentation**: SECURITY DEFINER function permissions must be documented
5. **Documentation**: Stripe price ID configuration steps missing from README/setup guide
6. **Documentation**: In-memory rate limiter limitation must be documented prominently
7. **Documentation**: Cookie configuration differences between dev/prod environments need documentation
