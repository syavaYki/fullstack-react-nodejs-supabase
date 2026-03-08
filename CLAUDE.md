# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack SaaS boilerplate with Express.js backend, React Router v7 frontend (SSR mode), Supabase (PostgreSQL + Auth), Stripe billing, and MUI v6 theming. Monorepo using npm workspaces.

## Commands

```bash
# Install dependencies (from root)
npm install

# Development
npm run dev:backend          # Backend on port 3001
npm run dev:frontend         # Frontend on port 5173

# Build for production
npm run build:backend
npm run build:frontend

# Type checking
npm run typecheck -w @app/backend
npm run typecheck -w @app/frontend

# Tests (backend only)
cd packages/backend && npx vitest run         # Run all tests
cd packages/backend && npx vitest run --coverage  # With coverage report
```

## Architecture

### Request Flow

```
Client → CORS/Helmet → JSON Parser → Auth Middleware → Route Handler → Service → Supabase/Stripe → Response
```

### Backend Structure (`packages/backend/src/`)

- **routes/** — API endpoint definitions (auth, profile, membership, billing, contact, newsletter, bug-reports)
- **services/** — Business logic layer (AuthService, ProfileService, MembershipService, UsageService, StripeService, WebhookService, ContactService, NewsletterService, BugReportService, EmailService/TemplateService)
- **middleware/** — Auth (cookie + Bearer), requireUser, membership enforcement, usage limits, rate limiting, error handling
- **config/** — Environment validation (Zod), Supabase client, Stripe client, Swagger setup
- **validation/** — Zod schemas for all input validation (auth, profile, billing, contact, common)
- **types/** — TypeScript interfaces split by domain (auth, profile, membership, billing, usage, contact, features, shared)
- **constants/** — Feature period maps, collection table maps, cache TTLs
- **utils/** — Logger, response helpers, pagination, date utilities, RPC helpers
- ****tests**/** — Vitest tests with mock factories for Supabase and Stripe

### Frontend Structure (`packages/frontend/app/`)

- **routes/** — React Router v7 routes with SSR loaders
- **api/** — API client with typed request functions per domain
- **components/** — Landing page sections, dialogs, layout (Header, Footer, Sidebar)
- **contexts/** — AuthContext for client-side session management
- **config/** — Environment config
- **constants/** — Feature keys, upgrade messages
- **lib/** — Server-side fetch utilities, sitemap generation
- **types/** — Monolithic `index.ts` with all frontend types

### Database (`supabase/migrations/`)

Core tables: `user_profiles`, `membership_tiers`, `memberships`, `features`, `tier_features`, `usage_tracking`, `stripe_webhook_events`, `membership_audit_log`, `contact_submissions`, `newsletter_subscribers`, `admin_users`, `bug_reports`, `email_templates`

Supabase Storage: `bug-report-images` bucket (public read, service-role write, 10 MB limit, images only)

Key DB functions (SECURITY DEFINER, restricted to `authenticated` + `service_role`):

- `change_user_tier(p_user_id, p_tier_id, p_billing_cycle)` — Returns `(success, error_message)`
- `check_reset_and_increment_usage(p_user_id, p_feature_key)` — Returns `(new_usage, at_limit)`
- `get_user_tier_with_features(p_user_id)` — Returns tier info with aggregated features
- `get_feature_limit(p_user_id, p_feature_key)` — Returns `(usage_limit, current_usage, period_type)`
- `handle_new_user()` — Trigger: auto-provisions profile + free membership on signup

### Key Patterns

- Services handle all business logic; routes are thin
- Auth: cookie-based (browser sessions via @supabase/ssr) with Bearer token fallback (API clients)
- Auth middleware fails closed (returns 503 on service errors, not fail-open)
- Feature system: 3 types (boolean, limit, enum) assigned to 4 tiers (Free, Premium, Pro)
- Usage tracking with period types: daily, monthly, lifetime, none
- Stripe is source of truth for subscription state; 24-hour sync cache in DB
- Stripe webhooks at `/api/billing/webhook` (raw body for signature verification)
- `/change-tier` endpoint gated to development only (not available in production)
- Swagger UI gated to development only (`/api-docs`)
- Graceful shutdown with connection draining on SIGTERM/SIGINT
- Email: Hostinger SMTP via nodemailer (pool: true, port 465). Templates loaded from `email_templates` DB table with 5-min in-process cache. `{{variable}}` interpolation with HTML escaping. Fire-and-forget from ContactService and BugReportService.

## API Endpoints

- `/api/auth` — Registration, login, logout, token refresh, password reset (forgot + reset)
- `/api/profile` — User profile CRUD (get, update)
- `/api/membership` — Tiers, features, trial management, usage tracking, check-feature
  - `/api/membership/public/tiers-with-features` — Public pricing data (no auth)
  - `/api/membership/change-tier` — Dev-only tier change without payment
- `/api/billing` — Stripe checkout, portal, payment history, subscription status, webhook
- `/api/contact` — Contact form submission (public, rate-limited)
- `/api/newsletter` — Newsletter subscribe/unsubscribe (public, rate-limited)
- `/api/bug-reports` — Bug report submission with image uploads (public, rate-limited 5/15min, multipart/form-data)
- `/api/health` — Health check

## Environment Variables

Copy `.env.example` to `.env`. Required variables:

- **Server:** `PORT`, `NODE_ENV`, `FRONTEND_URL`, `BACKEND_URL`
- **Supabase:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Stripe:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- **Hostinger SMTP (optional):** `HOSTINGER_SMTP_HOST`, `HOSTINGER_SMTP_PORT`, `HOSTINGER_SMTP_SECURE`, `HOSTINGER_SMTP_USER`, `HOSTINGER_SMTP_PASSWORD`, `HOSTINGER_FROM_EMAIL`, `HOSTINGER_FROM_NAME`
- **Notifications (optional):** `CONTACT_NOTIFICATION_EMAIL` — admin email for contact form + bug report alerts

## Response Format

```typescript
// Success
{ success: true, data: {...}, message?: string }

// Error
{ success: false, error: string, code?: string, details?: {...} }
```

## Testing

Backend tests use Vitest with mock factories in `src/__tests__/mocks/`. Key patterns:

- `vi.hoisted()` + `vi.mock()` for module mocking (required for NodeNext resolution)
- Use `.ts` extensions in `vi.mock()` paths (not `.js`)
- Test env vars set in `vitest.config.ts` to prevent env validation exit
- Resolve alias strips `.js` extensions for Vitest compatibility

## Security Notes

- All SECURITY DEFINER functions have REVOKE/GRANT restricting access to `authenticated` and `service_role` roles
- Checkout URLs validated against frontend origin (prevents open redirect)
- Usage middleware fails closed on DB errors (returns 503, not bypass)
- Rate limiting is in-memory (resets on server restart); consider Redis for production
