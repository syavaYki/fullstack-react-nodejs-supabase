# Phase 3: Testing & Documentation Review

## Test Coverage Findings

**Current state:** 6.89% coverage — 11 tests across 3 files (response.utils.test.ts, contact.routes.test.ts, membership.middleware.test.ts). Phase 4 plan specified 5 test files; 2 were never created (auth.routes.test.ts, profile.routes.test.ts).

### Critical (7 findings)

| ID   | Finding                                                                                                                                                              | File                                      |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| T-C1 | **Auth middleware completely untested** — `authMiddleware`, `requireUserMiddleware`, `optionalAuthMiddleware` have zero tests. Fail-open behavior (S-H4) unverified. | `auth.middleware.ts`                      |
| T-C2 | **Checkout URL open redirect untested** — No test verifies `success_url`/`cancel_url` are validated against frontend origin. S-C2 exploitable.                       | `billing.routes.ts`, `billing.schemas.ts` |
| T-C3 | **Webhook signature verification untested** — `stripe.webhooks.constructEvent` never tested with invalid signatures, replay attacks, or wrong secrets.               | `webhook.service.ts`                      |
| T-C4 | **`incrementUsage` infinite recursion untested** — No test covers the retry path where DB function returns mismatched columns.                                       | `usage.service.ts:105-135`                |
| T-C5 | **`/change-tier` authorization untested** — No test confirms that non-admin users cannot change tiers. S-C4 unverified.                                              | `membership.routes.ts:257-271`            |
| T-C6 | **SECURITY DEFINER function permissions untested** — No migration test verifies `REVOKE`/`GRANT` on DB functions. S-C6 unverified.                                   | `002_functions_triggers.sql`              |
| T-C7 | **Logout session invalidation untested** — No test verifies that `signOut` actually revokes the session. S-C1 unverified.                                            | `auth.service.ts:64-69`                   |

### High (6 findings)

| ID   | Finding                                                                                                                                                                                          | File                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| T-H1 | **All services at 0% coverage** — auth.service.ts, profile.service.ts, membership.service.ts, stripe.service.ts, usage.service.ts, webhook.service.ts, contact.service.ts, newsletter.service.ts | `services/`               |
| T-H2 | **All routes except contact at 0% coverage** — auth.routes.ts, profile.routes.ts, billing.routes.ts, membership.routes.ts, newsletter.routes.ts                                                  | `routes/`                 |
| T-H3 | **Usage middleware untested** — `enforceCollectionLimit` fail-open behavior (S-H5) unverified                                                                                                    | `usage.middleware.ts`     |
| T-H4 | **Rate limiter untested** — IP spoofing bypass (S-H2), memory leak (P-H1), `setInterval` cleanup never tested                                                                                    | `rateLimit.middleware.ts` |
| T-H5 | **Error middleware untested** — Global error handler, `ApiError` formatting, stack trace suppression in production                                                                               | `error.middleware.ts`     |
| T-H6 | **Stripe webhook event processing untested** — `customer.subscription.updated`, `invoice.payment_failed`, `checkout.session.completed` handlers                                                  | `webhook.service.ts`      |

### Medium (8 findings)

| ID   | Finding                                                                                                                                   | File                 |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| T-M1 | **No integration tests** — All tests mock Supabase/Stripe; no tests verify actual DB function signatures match service calls              | All                  |
| T-M2 | **No validation schema tests** — Zod schemas in `validation/` directory untested                                                          | `validation/`        |
| T-M3 | **Frontend zero test coverage** — No component, hook, or API client tests exist                                                           | `packages/frontend/` |
| T-M4 | **Mock factories incomplete** — `supabase.mock.ts` doesn't mock `auth.admin.signOut`, `stripe.mock.ts` missing webhook event construction | `__tests__/mocks/`   |
| T-M5 | **No E2E or smoke tests** — No Playwright/Cypress tests for critical user flows                                                           | Project root         |
| T-M6 | **No load/stress tests** — Rate limiter and usage tracking under concurrent load untested                                                 | Project root         |
| T-M7 | **Test environment variables hardcoded** — `vitest.config.ts` contains placeholder secrets that could drift from `.env.example`           | `vitest.config.ts`   |
| T-M8 | **No test for graceful shutdown** — `process.exit(0)` without `server.close()` untested                                                   | `index.ts:75-84`     |

### Low (3 findings)

| ID   | Finding                                                             | File                      |
| ---- | ------------------------------------------------------------------- | ------------------------- |
| T-L1 | Duplicate mock factories across stripe.mock.ts and supabase.mock.ts | `__tests__/mocks/`        |
| T-L2 | `createdResponse` utility defined but never used or tested          | `response.utils.ts:42-48` |
| T-L3 | No snapshot tests for API response shapes                           | All routes                |

### Recommended Test Files (~100 new tests)

1. `auth.middleware.test.ts` — auth, requireUser, optionalAuth (12+ tests)
2. `auth.routes.test.ts` — register, login, logout, refresh, password reset (15+ tests)
3. `profile.routes.test.ts` — get/update profile, Stripe customer ID (8+ tests)
4. `billing.routes.test.ts` — checkout, portal, payment history, URL validation (12+ tests)
5. `membership.routes.test.ts` — tiers, features, trial, change-tier auth (10+ tests)
6. `usage.middleware.test.ts` — enforce limits, fail-open behavior (8+ tests)
7. `usage.service.test.ts` — increment, initialize, getAllUsage (10+ tests)
8. `webhook.service.test.ts` — all event types, signature verification (12+ tests)
9. `stripe.service.test.ts` — checkout creation, customer management (8+ tests)
10. `rateLimit.middleware.test.ts` — throttling, cleanup, IP handling (6+ tests)
11. `error.middleware.test.ts` — error formatting, stack suppression (5+ tests)
12. `validation.test.ts` — all Zod schemas edge cases (10+ tests)
13. `newsletter.routes.test.ts` — subscribe, unsubscribe, validation (6+ tests)

---

## Documentation Findings

### Critical (4 findings)

| ID   | Finding                                                                                                                                                      | File            |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| D-C1 | **CLAUDE.md references deleted services/tables** — Lists `TrialService`, `admin_users`, `payment_history` table, admin routes — all deleted or never created | `CLAUDE.md`     |
| D-C2 | **README Swagger URL incorrect** — Documents `/api-docs` but actual path depends on swagger config; swagger also exposed in production (S-H1)                | `README.md`     |
| D-C3 | **Auth endpoint documentation inaccurate** — CLAUDE.md lists endpoints that don't match actual routes (e.g., token refresh endpoint)                         | `CLAUDE.md`     |
| D-C4 | **Zero OpenAPI annotations on routes** — Swagger setup exists but every route file has 0 `@swagger` JSDoc annotations, producing empty API docs              | All route files |

### High (7 findings)

| ID   | Finding                                                                                                                                               | File                          |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| D-H1 | **13 admin endpoints documented but deleted** — CLAUDE.md `/api/admin` section references removed routes                                              | `CLAUDE.md`                   |
| D-H2 | **Newsletter routes missing from docs** — `/api/newsletter` endpoints not in CLAUDE.md or README                                                      | `newsletter.routes.ts`        |
| D-H3 | **Missing environment variable documentation** — `.env.example` exists but CLAUDE.md doesn't match; RESEND_API_KEY listed in some places but not used | `.env.example`, `CLAUDE.md`   |
| D-H4 | **No database schema documentation** — No ERD or table relationship docs. Only raw SQL migrations.                                                    | `supabase/migrations/`        |
| D-H5 | **SECURITY DEFINER function permissions undocumented** — Critical security consideration (S-C6) has no docs                                           | `002_functions_triggers.sql`  |
| D-H6 | **Phase plan deviations undocumented** — SSR mode (plan said SPA), missing admin routes, missing test files — none documented                         | Phase plans vs implementation |
| D-H7 | **Cookie configuration undocumented** — `sameSite: 'none'` in production vs development behavior differences not documented                           | `supabase.ts`                 |

### Medium (8 findings)

| ID   | Finding                                                                           | File                                     |
| ---- | --------------------------------------------------------------------------------- | ---------------------------------------- |
| D-M1 | No deployment guide or production checklist                                       | `docs/`                                  |
| D-M2 | No architecture decision records (ADRs)                                           | `docs/`                                  |
| D-M3 | Stripe price ID configuration steps missing from setup guide                      | `README.md`                              |
| D-M4 | No inline comments on complex business logic (webhook processing, usage tracking) | `webhook.service.ts`, `usage.service.ts` |
| D-M5 | No API versioning documentation or strategy                                       | All routes                               |
| D-M6 | Response format in CLAUDE.md doesn't note inconsistent usage                      | `CLAUDE.md`                              |
| D-M7 | No contribution guide or code style documentation                                 | Project root                             |
| D-M8 | Feature system (boolean/limit/enum types) undocumented for consumers              | `features.types.ts`                      |

### Low (7 findings)

| ID   | Finding                                                                        | File              |
| ---- | ------------------------------------------------------------------------------ | ----------------- |
| D-L1 | No changelog or release notes                                                  | Project root      |
| D-L2 | Phase plan docs still in `docs/` but implementation has diverged significantly | `docs/phase-*.md` |
| D-L3 | Missing JSDoc on all exported service functions                                | `services/`       |
| D-L4 | No troubleshooting section in README                                           | `README.md`       |
| D-L5 | No example `.env` values or descriptions for each variable                     | `.env.example`    |
| D-L6 | License file missing                                                           | Project root      |
| D-L7 | No health check endpoint documentation                                         | `index.ts`        |
