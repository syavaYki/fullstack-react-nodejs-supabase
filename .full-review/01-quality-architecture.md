# Phase 1: Code Quality & Architecture Review

## Code Quality Findings

### Critical

| ID    | Finding                                                                                                                                               | File                                                          | Line    |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------- |
| CQ-C1 | Auth Service uses `process.env` directly, bypassing validated config (`env` object)                                                                   | `auth.service.ts`                                             | 106-107 |
| CQ-C2 | Auth Service calls `supabaseClient.auth.admin.signOut` on anon client (requires service_role)                                                         | `auth.service.ts`                                             | 66      |
| CQ-C3 | `change_user_tier` SQL function has 2 params but backend calls with 3 params + expects return rows                                                    | `002_functions_triggers.sql:334`, `membership.service.ts:203` |         |
| CQ-C4 | `check_reset_and_increment_usage` returns `(new_usage, at_limit)` but backend expects `(success, current_usage, usage_limit, remaining, is_exceeded)` | `002_functions_triggers.sql:274`, `usage.service.ts:120`      |         |
| CQ-C5 | Recursive infinite loop risk in `incrementUsage` — no depth guard on retry                                                                            | `usage.service.ts`                                            | 120-124 |
| CQ-C6 | Checkout `success_url`/`cancel_url` not validated against frontend origin (open redirect)                                                             | `billing.schemas.ts`                                          | 8-9     |

### High

| ID    | Finding                                                                                            | File                                                | Line  |
| ----- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----- |
| CQ-H1 | Frontend API client doesn't handle non-JSON responses (throws on HTML/502)                         | `api/client.ts`                                     | 28    |
| CQ-H2 | Rate limiter `setInterval` never cleared — memory leak, no cleanup method                          | `rateLimit.middleware.ts`                           | 23    |
| CQ-H3 | Stripe API version `'2023-10-16'` — outdated, plan specifies `'2024-11-20.acacia'`                 | `config/stripe.ts`                                  | 5     |
| CQ-H4 | Admin routes/middleware deleted but frontend admin UI + API module still exist (dead code)         | `admin.routes.ts` DELETED                           |       |
| CQ-H5 | Duplicate trial start logic in membership.routes.ts AND billing.routes.ts                          | `membership.routes.ts:206`, `billing.routes.ts:118` |       |
| CQ-H6 | Frontend-Backend type drift: Membership, UserProfile, Feature, ApiResponse all diverged            | `frontend/types/index.ts`                           |       |
| CQ-H7 | Frontend `checkLimitExceeded` reads `response.details.code` but backend sends `code` at root level | `api/errors.ts`                                     | 47-48 |

### Medium

| ID     | Finding                                                                                          | File                                   |
| ------ | ------------------------------------------------------------------------------------------------ | -------------------------------------- |
| CQ-M1  | No graceful shutdown — `process.exit(0)` without `server.close()`                                | `index.ts:76-84`                       |
| CQ-M2  | `contact_submissions` table missing `user_agent` column (service inserts it)                     | `001_schema.sql`, `contact.service.ts` |
| CQ-M3  | `payment_history` table documented but doesn't exist in migrations                               | CLAUDE.md vs migrations                |
| CQ-M4  | N+1 queries in `initializeUsage` and `updateLimitsForTier` (per-feature upserts)                 | `usage.service.ts:20-55,60-83`         |
| CQ-M5  | `getAllUsage` makes 3 sequential DB calls (could parallelize)                                    | `usage.service.ts:181-220`             |
| CQ-M6  | Dark theme `createTheme({...theme, ...})` spreads resolved theme (not input options)             | `theme/index.ts:160`                   |
| CQ-M7  | `checkFeature` frontend expects `has_access` but backend returns `has_feature`                   | `membership.api.ts:73-83`              |
| CQ-M8  | `incrementUsage` frontend calls non-existent backend endpoint                                    | `membership.api.ts:117-124`            |
| CQ-M9  | Cookie `sameSite: 'none'` hardcoded in browser client (breaks localhost dev)                     | `supabase.client.ts:38-42`             |
| CQ-M10 | `startTrial` frontend expects `{ membership }` but backend returns `{ checkout_url }`            | `membership.api.ts:100`                |
| CQ-M11 | Inconsistent response helper usage: some routes use `successResponse()`, others raw `res.json()` | Multiple route files                   |

### Low

| ID     | Finding                                                                                    | File                           |
| ------ | ------------------------------------------------------------------------------------------ | ------------------------------ |
| CQ-L1  | Duplicate mock factories across stripe.mock.ts and supabase.mock.ts                        | `__tests__/mocks/`             |
| CQ-L2  | Missing test files: `auth.routes.test.ts` and `profile.routes.test.ts` (plan specified 5)  | `__tests__/`                   |
| CQ-L3  | `STRIPE_SYNC_CACHE_TTL_MS` constant defined but never imported — magic number used instead | `cache.constants.ts:5`         |
| CQ-L4  | Non-null assertions on `user.email!` in multiple routes                                    | Multiple files                 |
| CQ-L5  | `optionalAuthMiddleware` is just an alias for `authMiddleware` (no behavioral difference)  | `auth.middleware.ts:56`        |
| CQ-L6  | Swagger `apis` path glob `'./src/routes/*.ts'` won't work in production builds             | `swagger.ts:65`                |
| CQ-L7  | `MembershipRequest` defined inline in middleware instead of types directory                | `membership.middleware.ts:6-8` |
| CQ-L8  | `createdResponse` utility defined but never used                                           | `response.utils.ts:42-48`      |
| CQ-L9  | Shadow variable `session` in AuthProvider effect                                           | `AuthContext.tsx:54,68`        |
| CQ-L10 | `getTier` frontend API calls non-existent backend endpoint                                 | `membership.api.ts:49`         |

---

## Architecture Findings

### Critical

| ID    | Finding                                                                                                       | Impact                                      |
| ----- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| AR-C1 | DB function `change_user_tier` signature mismatch with backend RPC call (2 params vs 3, void vs result table) | Tier changes fail at runtime                |
| AR-C2 | DB function `check_reset_and_increment_usage` return columns don't match backend expectations                 | Usage tracking misinterpreted on every call |
| AR-C3 | `AuthService.logout` uses anon client for admin operation                                                     | Logout never invalidates sessions           |

### High

| ID    | Finding                                                                        | Impact                                               |
| ----- | ------------------------------------------------------------------------------ | ---------------------------------------------------- |
| AR-H1 | `resetPassword` bypasses config system with dynamic import + raw `process.env` | Inconsistency, potential env missing error           |
| AR-H2 | Frontend admin API and pages exist but backend admin routes deleted            | Entire admin section non-functional                  |
| AR-H3 | Frontend `Membership` type has 8+ fields not in backend/DB schema              | Runtime property access returns undefined            |
| AR-H4 | Duplicate trial start endpoints in membership + billing routes                 | Maintenance hazard, API design violation             |
| AR-H5 | In-memory rate limiter with unbounded growth, no cluster support               | Memory leak in production, bypassed in multi-process |
| AR-H6 | `contact_submissions` missing `user_agent` column                              | Insert failures at runtime                           |

### Medium

| ID    | Finding                                                                  | Impact                                    |
| ----- | ------------------------------------------------------------------------ | ----------------------------------------- |
| AR-M1 | Inconsistent response wrapper usage across routes                        | Unpredictable API contract                |
| AR-M2 | SSR mode deviation from Phase 3 plan (ssr: true vs specified ssr: false) | Hybrid SPA/SSR creates complexity         |
| AR-M3 | Circular import between stripeService and membershipService              | Fragile initialization, DIP violation     |
| AR-M4 | Missing `stripe_price_id` in seed data with no documentation             | Checkout fails for seeded tiers           |
| AR-M5 | CORS doesn't allow backend URL for Swagger UI "Try It Out"               | Swagger broken for API testing            |
| AR-M6 | `ApiResponse.details` type differs between frontend and backend          | Error handling mismatch                   |
| AR-M7 | No graceful server shutdown                                              | In-flight requests lost on restart        |
| AR-M8 | `checkFeature` frontend API return type doesn't match backend response   | Returns undefined for expected properties |

### Low

| ID    | Finding                                                         | Impact               |
| ----- | --------------------------------------------------------------- | -------------------- |
| AR-L1 | `newsletter_subscribers.source` column never populated (unused) | Dead column          |
| AR-L2 | Unused pagination utilities (prepared for deleted admin routes) | Dead code            |
| AR-L3 | Swagger setup exists but no routes have OpenAPI annotations     | Empty API docs       |
| AR-L4 | Frontend `UserProfile` missing `profile_completeness` field     | Missing feature      |
| AR-L5 | `setInterval` in rate limiter creates uncleanable timer         | Test interference    |
| AR-L6 | Cookie security: `sameSite: 'none'` hardcoded in browser client | Broken localhost dev |

---

## Architectural Strengths

1. **Well-defined middleware chain** — auth -> requireUser -> membership -> usage pipeline is clean and composable
2. **Stripe webhook idempotency** — `stripe_webhook_events` table with unique constraint is production-grade
3. **Atomic usage tracking** — `FOR UPDATE` row lock and post-response increment via `res.on('finish')` is correct
4. **Database auto-provisioning trigger** — `handle_new_user` creates profile + free membership on signup
5. **Clean validation separation** — Zod schemas in dedicated `validation/` directory
6. **Error handling architecture** — `ApiError` + `asyncHandler` + `errorHandler` triple is well-implemented

---

## Plan Compliance Summary

| Area                   | Plan Spec                         | Actual                             | Status         |
| ---------------------- | --------------------------------- | ---------------------------------- | -------------- |
| Backend architecture   | Layered middleware chain          | Implemented correctly              | Compliant      |
| Supabase Auth + RLS    | Cookie-based with Bearer fallback | Implemented correctly              | Compliant      |
| Stripe source of truth | Webhooks + sync cache             | Implemented correctly              | Compliant      |
| Input validation       | Zod on all inputs                 | Implemented correctly              | Compliant      |
| Frontend SSR mode      | SPA mode (`ssr: false`)           | SSR mode with server loaders       | **DEVIATED**   |
| Admin routes           | Full admin CRUD                   | Backend deleted, frontend retained | **BROKEN**     |
| Shared types           | Frontend synced with backend      | Significant drift                  | **DEVIATED**   |
| Response format        | `{ success, data, message }`      | Inconsistently applied             | **DEVIATED**   |
| Test infrastructure    | 5 test files with mock factories  | 3 test files exist                 | **INCOMPLETE** |
| DB migrations          | 6 SQL files                       | 6 files present                    | Compliant      |
| Stripe API version     | `'2024-11-20.acacia'`             | `'2023-10-16'`                     | **DEVIATED**   |

### Missing Planned Files

- `admin.routes.ts` — DELETED
- `admin.middleware.ts` — DELETED
- `trial.service.ts` — DELETED
- `test.routes.ts` — DELETED
- `auth.routes.test.ts` — NEVER CREATED
- `profile.routes.test.ts` — NEVER CREATED
- `payment_history` table — NEVER CREATED

---

## Critical Issues for Phase 2 Context

The following findings should inform the security and performance review:

1. **Security**: Open redirect via unvalidated checkout URLs (CQ-C6)
2. **Security**: Auth logout doesn't work — sessions never invalidated (CQ-C2/AR-C3)
3. **Security**: Cookie `sameSite: 'none'` hardcoded in dev (CQ-M9)
4. **Performance**: N+1 queries in usage initialization (CQ-M4)
5. **Performance**: Sequential DB calls in getAllUsage (CQ-M5)
6. **Performance**: In-memory rate limiter memory leak (CQ-H2/AR-H5)
7. **Reliability**: DB function signature mismatches will cause runtime failures (CQ-C3,C4/AR-C1,C2)
8. **Reliability**: Infinite recursion in incrementUsage (CQ-C5)
