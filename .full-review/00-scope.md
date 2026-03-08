# Review Scope

## Target

Full-stack SaaS boilerplate project review against 4 implementation phase plans:

- Phase 1: Foundation (monorepo scaffold, database, backend core)
- Phase 2: Billing Engine (Stripe, feature/usage system, contact, newsletter)
- Phase 3: Frontend (theme, auth, dashboard, landing, billing UI)
- Phase 4: Testing & Polish (contact form, newsletter, tests, documentation)

## Files

### Backend (55 files) - `packages/backend/src/`

- **Config (4):** env.ts, supabase.ts, stripe.ts, swagger.ts
- **Types (8):** shared.types.ts, auth.types.ts, profile.types.ts, membership.types.ts, billing.types.ts, usage.types.ts, contact.types.ts, features.types.ts, index.ts
- **Utils (6):** logger.ts, response.utils.ts, pagination.utils.ts, date.utils.ts, rpc.utils.ts, index.ts
- **Constants (3):** feature.constants.ts, cache.constants.ts, index.ts
- **Validation (6):** common.schemas.ts, auth.schemas.ts, profile.schemas.ts, billing.schemas.ts, contact.schemas.ts, index.ts
- **Middleware (6):** error.middleware.ts, auth.middleware.ts, requireUser.middleware.ts, membership.middleware.ts, usage.middleware.ts, rateLimit.middleware.ts
- **Services (7):** auth.service.ts, profile.service.ts, stripe.service.ts, membership.service.ts, usage.service.ts, webhook.service.ts, contact.service.ts, newsletter.service.ts
- **Routes (7):** auth.routes.ts, profile.routes.ts, billing.routes.ts, membership.routes.ts, contact.routes.ts, newsletter.routes.ts, index.ts
- **Entry (1):** index.ts
- **Tests (6):** vitest.config.ts, mocks/supabase.mock.ts, mocks/stripe.mock.ts, mocks/index.ts, response.utils.test.ts, contact.routes.test.ts, membership.middleware.test.ts

### Frontend (~80 files) - `packages/frontend/app/`

- **Config & Lib:** env.ts, supabase.client.ts, supabase.server.ts, fetch.server.ts, sitemap.ts
- **Theme:** index.ts
- **Types:** index.ts (monolithic)
- **API (9):** client.ts, errors.ts, auth.api.ts, billing.api.ts, membership.api.ts, profile.api.ts, contact.api.ts, newsletter.api.ts, admin.api.ts, index.ts
- **Context:** AuthContext.tsx
- **Utils (5):** formatting.ts, navigation.tsx, features.ts, user.ts, status.ts, index.ts
- **Constants (3):** featureKeys.ts, upgradeMessages.ts, index.ts
- **Root & Entry (3):** root.tsx, entry.client.tsx, entry.server.tsx, routes.ts
- **Layout routes:** \_layout.tsx, \_protected.tsx
- **Layout components:** Header (4 files), Footer.tsx, DashboardSidebar.tsx, DashboardAppBar.tsx
- **Auth pages (6):** login, register, logout, forgot-password, reset-password, change-password
- **Dashboard (6):** dashboard.tsx, \_index, profile, membership, billing, usage
- **Landing (5):** \_index.tsx, HeroSection, FeaturesSection, PricingSection, CTASection, NewsletterSection
- **Other:** pricing, features, contact, checkout (index/success/cancel), admin (4 pages), test, UpgradeDialog

### Database (6 files) - `supabase/migrations/`

- 000_cleanup_all.sql, 001_schema.sql, 002_functions_triggers.sql, 003_rls_policies.sql, 004_views.sql, 005_seed_data.sql

### Root files

- package.json, .env.example, .gitignore, CLAUDE.md, README.md, todo.md

## Flags

- Security Focus: yes
- Performance Critical: no
- Strict Mode: no
- Framework: Express.js + React Router v7 (SSR) + MUI v6 + Supabase + Stripe

## Review Phases

1. Code Quality & Architecture
2. Security & Performance
3. Testing & Documentation
4. Best Practices & Standards
5. Consolidated Report
