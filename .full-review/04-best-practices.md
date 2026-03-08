# Phase 4: Best Practices & Standards

## Framework & Language Findings

### Critical (2 findings)

| ID   | Finding                                                                                                                                                                                          | Impact                          | File                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- | ------------------------------------ |
| F-C1 | **Stripe SDK pinned to v14 / API version `2023-10-16`** — 2+ years outdated. Plan specified `2024-11-20.acacia`. Missing security patches, new webhook event types, and improved error handling. | Security risk, missing features | `package.json`, `config/stripe.ts:5` |
| F-C2 | **Login page open redirect** — `redirectTo` query param passed directly to `navigate()` without validation. Attacker crafts `login?redirectTo=https://evil.com`.                                 | Phishing vector                 | Frontend login route                 |

### High (11 findings)

| ID    | Finding                                                                                                                                             | Impact                                      | File                   |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ---------------------- |
| F-H1  | **ESLint v8 with legacy `.eslintrc` config** — EOL, should migrate to v9 flat config                                                                | Missing new rules, no support               | `package.json`         |
| F-H2  | **Type assertions (`as Type`) instead of Supabase generics** — `.from('table').select('*')` should use `.from<Type>('table')` for type-safe queries | Runtime type mismatches                     | All services           |
| F-H3  | **Non-null assertions (`user.email!`)** — Used extensively instead of proper null checks                                                            | Potential runtime errors                    | Multiple files         |
| F-H4  | **`express.urlencoded()` enabled but unused** — No route accepts URL-encoded data                                                                   | Unnecessary attack surface                  | `index.ts:46`          |
| F-H5  | **No `express.json()` size limit** — Default allows up to 100KB payloads; webhook endpoint needs raw body but also no limit                         | DoS vector                                  | `index.ts:44`          |
| F-H6  | **React Router v7 SSR mode without proper server loaders** — Some routes use client-side `useEffect` for data fetching in SSR mode                  | SEO/performance penalty, hydration mismatch | Frontend routes        |
| F-H7  | **MUI `Grid` used instead of `Grid2`** — Legacy Grid component used in some places                                                                  | Deprecated, different API                   | Frontend components    |
| F-H8  | **`any` type used in catch blocks** — `catch (error: any)` instead of proper `unknown` typing                                                       | Type safety gap                             | Multiple service files |
| F-H9  | **Inconsistent import style** — Mix of default and named imports for same modules                                                                   | Code style inconsistency                    | All files              |
| F-H10 | **No strict TypeScript** — `strict: true` set but `noUncheckedIndexedAccess` and `exactOptionalProperties` missing                                  | Weaker type safety                          | `tsconfig.json`        |
| F-H11 | **Cookie storage implementation** — Custom `CookieStorage` for Supabase auth doesn't handle edge cases (expired cookies, malformed values)          | Auth failures                               | `supabase.ts`          |

### Medium (10 findings)

| ID    | Finding                                                                                     | Impact                         | File                      |
| ----- | ------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------- |
| F-M1  | `process.env` accessed directly in `resetPassword` instead of validated `env` object        | Config inconsistency           | `auth.service.ts:102-121` |
| F-M2  | Zod schemas not using `.transform()` for normalization (email lowercasing, string trimming) | Data inconsistency             | `validation/`             |
| F-M3  | No utility type for Supabase RPC responses                                                  | Repeated type casting          | All services              |
| F-M4  | `console.log` used alongside structured logger                                              | Inconsistent logging           | Multiple files            |
| F-M5  | No barrel exports — services imported individually                                          | Verbose imports                | `services/`               |
| F-M6  | Frontend `fetch` wrapper doesn't handle network errors distinctly from API errors           | Poor error UX                  | `api/client.ts`           |
| F-M7  | No retry logic for transient Supabase errors                                                | Reliability gap                | All services              |
| F-M8  | Helmet configured without `crossOriginEmbedderPolicy` or `crossOriginResourcePolicy`        | Security headers gap           | `index.ts`                |
| F-M9  | `Date.now()` used for cache TTL instead of monotonic clock                                  | Clock skew risk                | `membership.service.ts`   |
| F-M10 | No request timeout middleware                                                               | Slow requests hold connections | `index.ts`                |

### Low (7 findings)

| ID   | Finding                                                                               | Impact                     | File                           |
| ---- | ------------------------------------------------------------------------------------- | -------------------------- | ------------------------------ |
| F-L1 | `SUPABASE_JWT_SECRET` validated but never used for local JWT verification             | Unused env var             | `env.ts:20`                    |
| F-L2 | `optionalAuthMiddleware` is an alias for `authMiddleware` (no behavioral difference)  | Misleading API             | `auth.middleware.ts:56`        |
| F-L3 | `createdResponse` utility defined but never used                                      | Dead code                  | `response.utils.ts:42-48`      |
| F-L4 | Magic number `24 * 60 * 60 * 1000` instead of `STRIPE_SYNC_CACHE_TTL_MS` constant     | Maintainability            | `membership.service.ts`        |
| F-L5 | `MembershipRequest` defined inline in middleware instead of types directory           | Inconsistent typing        | `membership.middleware.ts:6-8` |
| F-L6 | Swagger `apis` glob `'./src/routes/*.ts'` won't match `.js` files in production build | Empty API docs in prod     | `swagger.ts:65`                |
| F-L7 | Frontend types monolithic instead of split per domain                                 | File size, maintainability | `frontend/types/index.ts`      |

---

## CI/CD & DevOps Findings

### Critical (4 findings)

| ID    | Finding                                                                                                                      | Impact                                  | File             |
| ----- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ---------------- |
| CD-C1 | **Zero CI/CD pipeline** — No GitHub Actions, no CircleCI, no Jenkins. No automated tests run on push/PR.                     | Regressions ship unchecked              | Project root     |
| CD-C2 | **No Dockerfile or container config** — No way to build reproducible deployment artifacts                                    | Manual deployment only                  | Project root     |
| CD-C3 | **No environment separation** — Single `.env` with no staging/production differentiation. `NODE_ENV` only toggle.            | Config drift, accidental prod changes   | `.env.example`   |
| CD-C4 | **Broken graceful shutdown** — `process.exit(0)` without `server.close()` drops in-flight requests including Stripe webhooks | Lost webhook events, data inconsistency | `index.ts:75-84` |

### High (10 findings)

| ID     | Finding                                                                                                                          | Impact                  | File                      |
| ------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------- |
| CD-H1  | **No dependency vulnerability scanning** — No `npm audit` in CI, no Dependabot/Renovate                                          | Known CVEs undetected   | Project root              |
| CD-H2  | **No pre-commit hooks** — No Husky/lint-staged for linting, formatting, type checking                                            | Bad code reaches repo   | Project root              |
| CD-H3  | **No unhandled rejection/exception handlers** — `process.on('unhandledRejection')` and `process.on('uncaughtException')` missing | Silent crashes          | `index.ts`                |
| CD-H4  | **Console-only logging** — No structured logging (JSON), no log levels in production, no log aggregation setup                   | No production debugging | `utils/logger.ts`         |
| CD-H5  | **No health check beyond basic endpoint** — `/api/health` doesn't check DB connectivity, Stripe connectivity, or memory usage    | False positive health   | `index.ts`                |
| CD-H6  | **No database migration CI step** — Migrations run manually; no `supabase db push` in deployment pipeline                        | Schema drift            | `supabase/migrations/`    |
| CD-H7  | **No secret rotation strategy** — Supabase keys, Stripe keys, JWT secret all static with no rotation plan                        | Long-lived secrets      | `.env.example`            |
| CD-H8  | **No backup/restore procedure** — No documented or automated database backup strategy                                            | Data loss risk          | Documentation             |
| CD-H9  | **No monitoring or alerting** — No APM (DataDog, New Relic), no error tracking (Sentry), no uptime monitoring                    | Blind to failures       | Project root              |
| CD-H10 | **No rate limiting at infrastructure level** — Application-level only, in-memory, lost on restart                                | DDoS vulnerability      | `rateLimit.middleware.ts` |

### Medium (7 findings)

| ID    | Finding                                                           | Impact                             | File           |
| ----- | ----------------------------------------------------------------- | ---------------------------------- | -------------- |
| CD-M1 | No `.dockerignore` or build optimization                          | Large container images             | Project root   |
| CD-M2 | No staging environment documented                                 | No pre-production validation       | Documentation  |
| CD-M3 | No rollback procedure documented                                  | Risky deployments                  | Documentation  |
| CD-M4 | No request tracing/correlation IDs                                | Cannot trace requests              | `index.ts`     |
| CD-M5 | No performance benchmarks or budgets                              | Performance regressions undetected | Project root   |
| CD-M6 | `npm` scripts don't include linting in build pipeline             | Lint errors in production          | `package.json` |
| CD-M7 | No container orchestration config (docker-compose, k8s manifests) | Complex local setup                | Project root   |
