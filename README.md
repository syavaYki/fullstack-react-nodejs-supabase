# Fullstack React + Node.js + Supabase

A production-ready SaaS starter template with authentication, tiered memberships, feature flags, usage tracking, and Stripe billing — all wired up and ready to customize.

**Stack:** Express.js backend, React Router v7 frontend (SSR), Supabase (PostgreSQL + Auth), Stripe, MUI v6, TypeScript, npm workspaces monorepo.

## What's Included

- **Authentication** — Cookie-based sessions via `@supabase/ssr`, OAuth support, password reset
- **Membership tiers** — Free / Premium / Pro with 14-day trial system
- **Feature flags** — Boolean, limit, and enum feature types per tier
- **Usage tracking** — Daily, monthly, and lifetime usage enforcement
- **Stripe billing** — Checkout, customer portal, webhooks, payment history
- **API layer** — Typed Express routes with Zod validation and Swagger docs
- **Frontend** — SSR landing page, dashboard shell, auth flows, upgrade dialogs

## Project Structure

```
├── packages/
│   ├── backend/           # Express API server
│   │   └── src/
│   │       ├── config/        # Env validation, Supabase, Stripe, Swagger
│   │       ├── middleware/    # Auth, membership, usage, rate limiting
│   │       ├── routes/        # API route handlers
│   │       ├── services/      # Business logic
│   │       ├── types/         # TypeScript types (split by domain)
│   │       ├── validation/    # Zod schemas
│   │       ├── constants/     # Feature maps, cache TTLs
│   │       ├── utils/         # Logger, response helpers, pagination
│   │       └── __tests__/     # Vitest tests + mock factories
│   └── frontend/          # React Router v7 (SSR)
│       └── app/
│           ├── routes/        # Page routes with SSR loaders
│           ├── api/           # Typed API client
│           ├── components/    # Landing, dashboard, dialogs
│           ├── contexts/      # Auth context
│           ├── theme/         # MUI v6 theme
│           └── types/         # Frontend types
├── supabase/
│   └── migrations/        # SQL files (000–005), run in order
├── package.json           # Root workspace config
└── .env.example           # All required env vars
```

---

## Getting Started

### Prerequisites

- **Node.js 18+**
- **Supabase account** — [supabase.com](https://supabase.com) (free tier works)
- **Stripe account** — [stripe.com](https://stripe.com) (test mode)

### Step 1: Clone and Install

```bash
# Clone the template
git clone https://github.com/your-username/fullstack-react-nodejs-supabase.git my-saas-app
cd my-saas-app

# Remove the template's git history and start fresh
rm -rf .git
git init

# Install dependencies
npm install
```

### Step 2: Set Up Supabase

1. **Create a project** at [supabase.com/dashboard](https://supabase.com/dashboard)
2. **Get your credentials** — go to **Project Settings > API**:
   - Project URL → `SUPABASE_URL`
   - `anon` public key → `SUPABASE_ANON_KEY`
   - `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY`
3. **Run the migrations** — go to **SQL Editor** in the Supabase dashboard and run each file in order:

   | Order | File                         | What it creates                                                                                |
   | ----- | ---------------------------- | ---------------------------------------------------------------------------------------------- |
   | 1     | `000_cleanup_all.sql`        | Drops existing objects (safe for fresh projects)                                               |
   | 2     | `001_schema.sql`             | Tables: profiles, tiers, memberships, features, usage, etc.                                    |
   | 3     | `002_functions_triggers.sql` | DB functions: `change_user_tier`, `check_reset_and_increment_usage`, `handle_new_user` trigger |
   | 4     | `003_rls_policies.sql`       | Row Level Security policies for all tables                                                     |
   | 5     | `004_views.sql`              | Useful database views                                                                          |
   | 6     | `005_seed_data.sql`          | Default tiers (Free, Premium, Pro), features, and tier-feature mappings                        |

   > **Tip:** You can also use the Supabase CLI: `supabase db push` if you have it set up.

4. **Configure Auth redirect URLs** — go to **Authentication > URL Configuration > Redirect URLs** and add:

   ```
   http://localhost:5173
   http://localhost:3001/api/auth/callback
   ```

   For production, add your deployed URLs too.

5. **(Optional) Enable OAuth providers** — go to **Authentication > Providers** and enable Google, GitHub, etc. Each provider needs its own client ID/secret from the provider's developer console.

### Step 3: Set Up Stripe

1. **Get your API keys** from [Stripe Dashboard > Developers > API keys](https://dashboard.stripe.com/test/apikeys):
   - Secret key → `STRIPE_SECRET_KEY`
   - Publishable key → used in frontend if needed

2. **Create products and prices** in Stripe Dashboard > Products:
   - Create a **Premium** product with monthly (`$29/mo`) and yearly prices
   - Create a **Pro** product with monthly (`$79/mo`) and yearly prices

3. **Update the seed data** — after running migrations, update the `membership_tiers` table with your Stripe price IDs:

   ```sql
   UPDATE membership_tiers
   SET stripe_price_id_monthly = 'price_xxx', stripe_price_id_yearly = 'price_yyy'
   WHERE name = 'Premium';

   UPDATE membership_tiers
   SET stripe_price_id_monthly = 'price_aaa', stripe_price_id_yearly = 'price_bbb'
   WHERE name = 'Pro';
   ```

4. **Set up webhook forwarding** for local development:

   ```bash
   # Install Stripe CLI: https://stripe.com/docs/stripe-cli
   stripe listen --forward-to localhost:3001/api/billing/webhook
   ```

   Copy the webhook signing secret it prints → `STRIPE_WEBHOOK_SECRET`

   For production, create a webhook endpoint in Stripe Dashboard pointing to `https://your-backend.com/api/billing/webhook`.

### Step 4: Configure Environment

```bash
cp .env.example .env
```

Fill in your `.env`:

```env
# Server
PORT=3001
NODE_ENV=development
LOG_LEVEL=debug

# URLs
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3001

# Supabase (from Step 2)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Stripe (from Step 3)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Frontend (Vite)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_BACKEND_URL=http://localhost:3001
```

### Step 5: Run

```bash
# Start both backend and frontend
npm run dev

# Or run separately
npm run dev:backend     # Backend on http://localhost:3001
npm run dev:frontend    # Frontend on http://localhost:5173
```

API docs available at `http://localhost:3001/api-docs` (development only).

---

## Customizing Your App

### Branding & appearance

Edit **`config/branding.ts`** — the single source of truth for your app's name, colors, fonts, and landing page copy. Both the backend and frontend read from this file.

After editing, restart the dev servers to see changes.

| Token                                                               | Controls                                   |
| ------------------------------------------------------------------- | ------------------------------------------ |
| `projectDisplayName`                                                | Browser tabs, API docs, home page title    |
| `primaryColor` / `secondaryColor`                                   | MUI theme colors (buttons, links, accents) |
| `fontFamily` / `googleFontsUrl`                                     | Typography across the app                  |
| `logoText`                                                          | Header, sidebar, mobile drawer, auth pages |
| `footerBrandName` / `footerDescription`                             | Footer branding                            |
| `metaTitleSuffix`                                                   | All page titles: "Page - {suffix}"         |
| `heroHeadline` / `heroHeadlineAccent` / `heroSubheadline`           | Landing hero section                       |
| `ctaText` / `ctaSecondaryText`                                      | Hero CTA buttons                           |
| `ctaSectionHeadline` / `ctaSectionSubtext` / `ctaSectionButtonText` | Landing CTA section                        |
| `apiTitle` / `apiDescription`                                       | Swagger UI docs                            |

### Tiers, prices & features

Edit `supabase/migrations/005_seed_data.sql` before running migrations, or update directly in Supabase after setup. Tier names, prices, and descriptions are fetched via API at runtime — they are not in the branding config.

The feature system supports three types:

| Type      | Example              | How it works                                        |
| --------- | -------------------- | --------------------------------------------------- |
| `boolean` | `advanced_analytics` | On/off per tier                                     |
| `limit`   | `max_projects`       | Numeric limit, enforced by usage tracking           |
| `enum`    | `support_level`      | Text value per tier (e.g., "community", "priority") |

### Environment variables

Environment variables are **optional for exploration**. The server starts without them and prints a warning showing which services are unconfigured. Features requiring Supabase or Stripe will fail at request time with descriptive errors — but you can still browse the landing page and explore the codebase.

Copy `.env.example` to `.env` and fill in values when you're ready to connect services.

### Add new API routes

Follow the existing pattern: create a route file in `routes/`, a service in `services/`, validation schemas in `validation/`, and types in `types/`. Routes are thin — all logic goes in services.

---

## Available Scripts

```bash
# Development
npm run dev                  # Start backend + frontend
npm run dev:backend          # Backend only (port 3001)
npm run dev:frontend         # Frontend only (port 5173)

# Build
npm run build:backend        # Build backend
npm run build:frontend       # Build frontend

# Production
npm run start:backend        # Start production backend
npm run start:frontend       # Start production frontend

# Quality
npm run typecheck            # Type check both packages
npm run lint                 # Lint both packages
npm run lint:fix             # Lint and auto-fix
npm run format               # Format with Prettier

# Tests
npm run test:backend         # Run backend tests
npm run test:backend:watch   # Watch mode
npm run test:backend:coverage # With coverage report
```

## API Endpoints

| Route                                            | Description            | Auth              |
| ------------------------------------------------ | ---------------------- | ----------------- |
| `GET /api/health`                                | Health check           | No                |
| `POST /api/auth/register`                        | Register user          | No                |
| `POST /api/auth/login`                           | Login                  | No                |
| `POST /api/auth/logout`                          | Logout                 | Yes               |
| `GET /api/auth/me`                               | Current user           | Yes               |
| `POST /api/auth/refresh`                         | Refresh token          | Yes               |
| `POST /api/auth/forgot-password`                 | Send reset email       | No                |
| `POST /api/auth/reset-password`                  | Reset password         | No                |
| `GET /api/profile`                               | Get profile            | Yes               |
| `PUT /api/profile`                               | Update profile         | Yes               |
| `GET /api/membership`                            | Current membership     | Yes               |
| `GET /api/membership/public/tiers-with-features` | Public pricing data    | No                |
| `GET /api/membership/features`                   | User's features        | Yes               |
| `GET /api/membership/check-feature/:key`         | Check feature access   | Yes               |
| `POST /api/membership/trial/start`               | Start 14-day trial     | Yes               |
| `GET /api/membership/usage`                      | Usage stats            | Yes               |
| `POST /api/billing/create-checkout-session`      | Start Stripe checkout  | Yes               |
| `POST /api/billing/create-portal-session`        | Stripe customer portal | Yes               |
| `GET /api/billing/payment-history`               | Payment history        | Yes               |
| `POST /api/billing/webhook`                      | Stripe webhook         | No\*              |
| `POST /api/contact`                              | Contact form           | No (rate-limited) |
| `POST /api/newsletter/subscribe`                 | Newsletter signup      | No (rate-limited) |

_\*Verified by Stripe signature_

## Auth Architecture

```
Frontend (creates cookies)          Backend (reads cookies)
─────────────────────────           ──────────────────────
Supabase client:                    @supabase/ssr middleware:
  signIn / signUp / signOut           getUser, auto-refresh tokens
  → sets cookies in browser           → reads cookies from request
```

The frontend owns login/logout. The backend reads cookies and auto-refreshes expired tokens. Bearer token auth is also supported for API clients.

## Tech Stack

| Layer      | Technology                              |
| ---------- | --------------------------------------- |
| Backend    | Express.js, TypeScript, Node.js 18+     |
| Frontend   | React 19, React Router v7 (SSR), MUI v6 |
| Database   | Supabase (PostgreSQL)                   |
| Auth       | Supabase Auth + `@supabase/ssr`         |
| Billing    | Stripe (Checkout, Portal, Webhooks)     |
| Validation | Zod                                     |
| Testing    | Vitest                                  |
| API Docs   | Swagger / OpenAPI                       |

## License

MIT
