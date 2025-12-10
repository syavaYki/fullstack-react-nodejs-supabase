# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack SaaS boilerplate with Express.js backend, Supabase (PostgreSQL + Auth), and Stripe billing. Monorepo using npm workspaces.

## Commands

```bash
# Install dependencies (from root)
npm install

# Development (hot reload on port 3001)
npm run dev:backend

# Build for production
npm run build:backend

# Run production server
npm run start:backend

# Type checking only
npm run typecheck -w @app/backend
```

## Architecture

### Request Flow

```
Client → CORS/Helmet → JSON Parser → Auth Middleware → Route Handler → Service → Supabase/Stripe → Response
```

### Backend Structure (`packages/backend/src/`)

- **routes/** - API endpoint definitions (auth, profile, membership, billing, admin)
- **services/** - Business logic layer (AuthService, ProfileService, MembershipService, TrialService, UsageService, StripeService, WebhookService)
- **middleware/** - Auth (JWT validation), membership enforcement, admin checks, usage limits, error handling
- **config/** - Environment validation (Zod), Supabase client, Stripe client, Swagger setup
- **types/** - TypeScript interfaces

### Database (`supabase/migrations/`)

Core tables: `user_profiles`, `membership_tiers`, `memberships`, `features`, `tier_features`, `usage_tracking`, `admin_users`, `payment_history`, `stripe_webhook_events`

### Key Patterns

- Services handle all business logic; routes are thin
- Auth via Supabase JWT tokens validated in middleware
- Feature system: 3 types (boolean, limit, enum) assigned to 4 tiers (Trial, Free, Premium, Pro)
- Usage tracking with period types: daily, monthly, lifetime, none
- Stripe webhooks processed at `/api/billing/webhook` (raw body parsing required)

## API Endpoints

- `/api/auth` - Registration, login, logout, token refresh, password reset
- `/api/profile` - User profile CRUD
- `/api/membership` - Tiers, features, trial management, usage tracking
- `/api/billing` - Stripe checkout, portal, webhooks, payment history
- `/api/admin` - Tier/feature/user management (requires admin role)
- `/api/contact` - Contact form submission (public, rate-limited)
- `/api/health` - Health check

## Environment Variables

Copy `.env.example` to `.env`. Required: Supabase credentials (URL, keys, JWT secret), Stripe keys (secret, publishable, webhook secret), server config (PORT, NODE_ENV, FRONTEND_URL, BACKEND_URL).

## Response Format

```typescript
// Success
{ success: true, data: {...}, message?: string }

// Error
{ success: false, error: string, details?: {...} }
```
