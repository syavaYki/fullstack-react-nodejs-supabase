# Fullstack React + Node.js + Supabase

A monorepo containing a Node.js Express backend with Supabase authentication, memberships, feature flags, and Stripe billing.

## Project Structure

```text
fullstack-react-nodejs-supabase/
├── packages/
│   └── backend/          # Express API server
│       ├── src/
│       │   ├── config/   # Environment, Supabase, Stripe, Swagger
│       │   ├── middleware/
│       │   ├── routes/
│       │   ├── services/
│       │   └── types/
│       └── package.json
├── supabase/
│   └── migrations/       # SQL migration files
├── package.json          # Root workspace config
└── .env.example
```

## Quick Start

### 1. Prerequisites

- Node.js 18+
- Supabase account
- Stripe account (for billing features)

### 2. Setup Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** in your Supabase dashboard
3. Copy the contents of `supabase/migrations/001_initial_schema.sql`
4. Paste and run the SQL to create all tables, triggers, and RLS policies

### 3. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your credentials
```

Required environment variables:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (keep secret!) |
| `JWT_SECRET` | From Supabase Dashboard > Settings > API |
| `STRIPE_SECRET_KEY` | Stripe secret key (sk_test_...) |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (pk_test_...) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |

### 4. Setup Stripe Products

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Create products for Pro and Enterprise tiers
3. Create monthly and yearly prices for each
4. Update `membership_tiers` table with Stripe price IDs:

```sql
UPDATE membership_tiers
SET
  stripe_price_id_monthly = 'price_xxx',
  stripe_price_id_yearly = 'price_yyy'
WHERE name = 'pro';
```

### 5. Install & Run

```bash
# Install dependencies
npm install

# Run development server
npm run dev:backend
```

Server starts at `http://localhost:3001`

## API Documentation

Swagger UI available at: `http://localhost:3001/api/docs`

### Endpoints

#### Authentication (`/api/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/me` | Get current user (cookie or Bearer token) |
| GET | `/callback` | OAuth callback handler (sets session cookies) |
| POST | `/refresh` | Refresh access token |
| POST | `/forgot-password` | Send reset email |
| POST | `/reset-password` | Reset password |
| POST | `/register` | Register new user *(deprecated - use Supabase client)* |
| POST | `/login` | Login *(deprecated - use Supabase client)* |
| POST | `/logout` | Logout *(deprecated - use Supabase client)* |

> **Cookie-Based Auth**: For browser clients, use the Supabase client directly for login/logout.
> The backend reads cookies and auto-refreshes tokens. See [Authentication Architecture](#authentication-architecture) below.

#### Profile (`/api/profile`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get profile |
| PUT | `/` | Update profile |
| DELETE | `/` | Delete account |

#### Membership (`/api/membership`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get current membership |
| GET | `/tiers` | List available tiers |
| GET | `/features` | Get user's features |
| GET | `/check-feature/:key` | Check if user has feature |
| GET | `/feature-limit/:key` | Get feature limit |
| GET | `/trial/status` | Get trial status |
| POST | `/trial/start` | Start 14-day trial |
| POST | `/trial/convert` | Convert trial to paid |
| GET | `/usage` | Get all usage for user |
| GET | `/usage/:key` | Get usage for specific feature |

#### Billing (`/api/billing`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/create-checkout-session` | Start Stripe checkout |
| POST | `/create-portal-session` | Open customer portal |
| GET | `/payment-history` | Get payment history |
| POST | `/webhook` | Stripe webhook |

#### Admin (`/api/admin`) - Requires admin role

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tiers` | List all tiers (including inactive) |
| POST | `/tiers` | Create new tier |
| PUT | `/tiers/:id` | Update tier |
| DELETE | `/tiers/:id` | Deactivate tier |
| GET | `/tiers/:id/features` | Get tier features |
| PUT | `/tiers/:id/features` | Update tier features (bulk) |
| GET | `/features` | List all features |
| POST | `/features` | Create feature |
| PUT | `/features/:id` | Update feature |
| DELETE | `/features/:id` | Deactivate feature |
| POST | `/trials/expire` | Expire ended trials (cron) |
| POST | `/usage/reset` | Reset periodic usage (cron) |
| GET | `/users/:id/usage` | Get user's usage |
| GET | `/admins` | List admins (super_admin only) |
| POST | `/admins` | Add admin (super_admin only) |
| DELETE | `/admins/:id` | Remove admin (super_admin only) |

## Membership Tiers

| Tier | Price | Features |
|------|-------|----------|
| Trial | $0 (14 days) | Full Pro features for evaluation |
| Free | $0 | Basic features, 500MB storage, no AI |
| Premium | $29/mo | AI Assistant, 5 team members, 5GB storage |
| Pro | $79/mo | Unlimited team, 50GB storage, all integrations |

## Database Schema

### Tables

- `user_profiles` - User profile data (with stripe_customer_id)
- `membership_tiers` - Tier definitions (Trial, Free, Premium, Pro)
- `memberships` - User subscriptions with trial tracking
- `features` - Feature definitions (5 SaaS features)
- `tier_features` - Feature flags per tier (join table)
- `payment_history` - Payment records
- `stripe_webhook_events` - Webhook logs
- `membership_audit_log` - Membership change history
- `usage_tracking` - Feature usage enforcement
- `admin_users` - Admin role management

### Helper Functions

```sql
-- Get user's tier with all features
SELECT * FROM get_user_tier_with_features('user-uuid');

-- Check if user has a feature
SELECT user_has_feature('user-uuid', 'advanced_analytics');

-- Get numeric limit
SELECT get_feature_limit('user-uuid', 'max_projects');
```

## Testing with Stripe

1. Use Stripe test mode keys
2. Test card: `4242 4242 4242 4242`
3. Use [Stripe CLI](https://stripe.com/docs/stripe-cli) to forward webhooks:

```bash
stripe listen --forward-to localhost:3001/api/billing/webhook
```

## Scripts

```bash
npm run dev:backend    # Start dev server with hot reload
npm run build:backend  # Build for production
npm run start:backend  # Start production server
```

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth + `@supabase/ssr` (cookie-based)
- **Billing**: Stripe
- **Validation**: Zod
- **Docs**: Swagger/OpenAPI

## Authentication Architecture

This project uses **cookie-based authentication** with a clear separation of responsibilities:

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (creates/deletes cookies)                         │
│  └─ Uses Supabase client: signIn, signUp, signOut           │
└─────────────────────────────────────────────────────────────┘
                              │
                    Cookie sent automatically
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  BACKEND (reads/refreshes cookies)                          │
│  └─ Uses @supabase/ssr: getUser, auto-refresh               │
└─────────────────────────────────────────────────────────────┘
```

| Action | Who Handles It |
|--------|----------------|
| Create cookie (login/signup) | Frontend via Supabase client |
| Read cookie | Backend middleware |
| Refresh expired tokens | Backend (auto, sets new cookie) |
| Delete cookie (logout) | Frontend via Supabase client |

### OAuth Setup

For OAuth providers (Google, GitHub, etc.), add redirect URLs in Supabase Dashboard:

**Supabase Dashboard > Authentication > URL Configuration > Redirect URLs:**

```
http://localhost:3000                      # Frontend (dev)
http://localhost:3001/api/auth/callback    # Backend OAuth callback (dev)
https://your-frontend.com                  # Frontend (prod)
https://your-backend.com/api/auth/callback # Backend OAuth callback (prod)
```

## Common Mistakes to Avoid

| Mistake | Solution |
|---------|----------|
| Using Service Role Key in frontend | Never expose - backend only |
| Using `@supabase/auth-helpers` | Deprecated - use `@supabase/ssr` |
| Missing `/auth/callback` route | Required for OAuth |
| Not adding localhost to redirect URLs | Add in Supabase Dashboard |
| Backend creating login cookies | Frontend creates, backend reads |
