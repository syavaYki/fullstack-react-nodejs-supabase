# Backend API Documentation

A comprehensive Node.js/Express backend with Supabase authentication, membership tiers, Stripe billing, trial management, and usage tracking.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
  - [Authentication](#authentication-apiauth)
  - [Profile](#profile-apiprofile)
  - [Membership](#membership-apimembership)
  - [Billing](#billing-apibilling)
  - [Admin](#admin-apiadmin)
- [Services](#services)
- [Middleware](#middleware)
- [Database Schema](#database-schema)
- [Feature System](#feature-system)
- [Trial System](#trial-system)
- [Usage Tracking](#usage-tracking)
- [Stripe Integration](#stripe-integration)
- [Error Handling](#error-handling)
- [Testing](#testing)
- [Common Mistakes to Avoid](#common-mistakes-to-avoid)
- [Troubleshooting](#troubleshooting)

---

## Overview

This backend provides a complete SaaS infrastructure including:

- **Authentication**: Supabase Auth integration with JWT validation
- **User Profiles**: Extended user data with company info, bio, website
- **Membership Tiers**: Free, Premium, Pro, and Trial tiers with feature access
- **Feature Flags**: Boolean, limit-based, and enum feature types
- **Billing**: Stripe integration for subscriptions and one-time payments
- **Trial Management**: 14-day trial periods with auto-expiration
- **Usage Tracking**: Daily, monthly, and lifetime usage limits
- **Admin System**: Full CRUD for tiers, features, and user management

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT REQUEST                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             EXPRESS SERVER                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         MIDDLEWARE CHAIN                             │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐ │   │
│  │  │  CORS    │─▶│  JSON    │─▶│  Auth    │─▶│  Admin/Membership/   │ │   │
│  │  │          │  │  Parser  │  │ Validate │  │  Usage Middleware    │ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                     │                                       │
│                                     ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                           ROUTE HANDLERS                             │   │
│  │  ┌────────┐ ┌─────────┐ ┌────────────┐ ┌─────────┐ ┌───────┐       │   │
│  │  │  Auth  │ │ Profile │ │ Membership │ │ Billing │ │ Admin │       │   │
│  │  └────────┘ └─────────┘ └────────────┘ └─────────┘ └───────┘       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                     │                                       │
│                                     ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                          SERVICE LAYER                               │   │
│  │  ┌────────────┐ ┌─────────────┐ ┌────────────┐ ┌──────────────┐    │   │
│  │  │ AuthService│ │MemberService│ │StripeService│ │ UsageService │    │   │
│  │  └────────────┘ └─────────────┘ └────────────┘ └──────────────┘    │   │
│  │  ┌──────────────┐ ┌─────────────┐ ┌────────────────┐               │   │
│  │  │ProfileService│ │ TrialService│ │ WebhookService │               │   │
│  │  └──────────────┘ └─────────────┘ └────────────────┘               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    ▼                                 ▼
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│         SUPABASE                │   │           STRIPE                 │
│  ┌───────────────────────────┐  │   │  ┌───────────────────────────┐  │
│  │     PostgreSQL Database   │  │   │  │    Payment Processing     │  │
│  │  • user_profiles          │  │   │  │  • Subscriptions          │  │
│  │  • membership_tiers       │  │   │  │  • Checkout Sessions      │  │
│  │  • user_memberships       │  │   │  │  • Customer Management    │  │
│  │  • tier_features          │  │   │  │  • Webhook Events         │  │
│  │  • usage_tracking         │  │   │  └───────────────────────────┘  │
│  │  • admin_users            │  │   └─────────────────────────────────┘
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │   Supabase Auth (JWT)     │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

### Request Flow

1. Client sends request (with cookie or Authorization header)
2. Express receives request through CORS, Cookie Parser, and JSON middleware
3. Auth middleware validates JWT via cookie or header with Supabase
4. Route-specific middleware (admin, membership, usage) applied
5. Route handler processes request using services
6. Services interact with Supabase DB or Stripe API
7. Response sent back through middleware chain

### Cookie-Based Authentication

The backend supports **dual authentication methods**:

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (creates/deletes cookies via Supabase client)     │
│  - Login/Signup → Supabase sets cookie automatically        │
│  - OAuth (Google, GitHub) → Supabase handles redirect       │
│  - Logout → Supabase clears cookie                          │
└─────────────────────────────────────────────────────────────┘
                              │
                    Cookie sent with requests
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  BACKEND (reads/refreshes cookies)                          │
│  - Reads cookie to authenticate requests                    │
│  - Refreshes expired tokens (sends Set-Cookie in response)  │
│  - Never creates initial cookie (frontend's job)            │
└─────────────────────────────────────────────────────────────┘
```

#### Authentication Priority

1. **Cookies** (browser clients) - Uses `@supabase/ssr` for automatic token refresh
2. **Authorization Header** (API clients) - Bearer token for programmatic access

#### How It Works

**Browser Clients (Cookie Auth):**
- Frontend calls `supabase.auth.signInWithPassword()` or OAuth
- Supabase client automatically sets HttpOnly cookies
- Backend middleware reads cookies using `@supabase/ssr`
- Expired tokens are automatically refreshed, new cookies set in response

**API Clients (Bearer Token):**
- Get token from Supabase auth
- Send `Authorization: Bearer <token>` header
- Backend validates token with Supabase Admin client

#### Cookie Security

| Property | Value | Description |
|----------|-------|-------------|
| `HttpOnly` | `true` | Prevents XSS access via JavaScript |
| `Secure` | `true` (prod) | HTTPS only in production |
| `SameSite` | `lax` | CSRF protection |

#### OAuth Callback

For OAuth providers (Google, GitHub, etc.), add the callback URL to Supabase:

```
# Development
http://localhost:3001/api/auth/callback

# Production
https://your-domain.com/api/auth/callback
```

Configure in: **Supabase Dashboard > Authentication > URL Configuration > Redirect URLs**

---

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Supabase project with Auth enabled
- Stripe account with API keys
- PostgreSQL (via Supabase)

### Installation

```bash
# From the monorepo root
npm install

# Or from this package
cd packages/backend
npm install
```

### Environment Variables

Create a `.env` file in `packages/backend/`:

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `development` or `production` |
| `PORT` | No | Server port (default: 3001) |
| `BACKEND_URL` | Yes | Full backend URL (e.g., `http://localhost:3001`) |
| `FRONTEND_URL` | Yes | Frontend URL for CORS and redirects |
| `SUPABASE_URL` | Yes | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (admin operations) |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret API key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |

Example `.env`:

```env
NODE_ENV=development
PORT=3001
BACKEND_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Running the Server

```bash
# Development with hot reload
npm run dev

# Production build
npm run build
npm start
```

The server starts at `http://localhost:3001` with Swagger docs at `/api-docs`.

---

## Project Structure

```
packages/backend/
├── src/
│   ├── config/
│   │   ├── env.ts              # Environment variable validation (Zod)
│   │   ├── supabase.ts         # Supabase client initialization
│   │   └── swagger.ts          # Swagger/OpenAPI configuration
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts      # JWT validation, user attachment
│   │   ├── admin.middleware.ts     # Admin role verification
│   │   ├── membership.middleware.ts # Tier/feature access control
│   │   ├── usage.middleware.ts     # Usage limit enforcement
│   │   └── error.middleware.ts     # Global error handling
│   │
│   ├── routes/
│   │   ├── index.ts            # Route aggregator
│   │   ├── auth.routes.ts      # Authentication endpoints
│   │   ├── profile.routes.ts   # User profile endpoints
│   │   ├── membership.routes.ts # Membership & trials
│   │   ├── billing.routes.ts   # Stripe billing endpoints
│   │   └── admin.routes.ts     # Admin management endpoints
│   │
│   ├── services/
│   │   ├── auth.service.ts     # Auth operations
│   │   ├── profile.service.ts  # Profile CRUD
│   │   ├── membership.service.ts # Tier management
│   │   ├── stripe.service.ts   # Stripe API wrapper
│   │   ├── trial.service.ts    # Trial management
│   │   ├── usage.service.ts    # Usage tracking
│   │   └── webhook.service.ts  # Stripe webhook handling
│   │
│   ├── types/
│   │   └── index.ts            # TypeScript interfaces
│   │
│   └── index.ts                # Application entry point
│
├── package.json
└── tsconfig.json
```

---

## API Reference

All endpoints return JSON with this structure:

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error message",
  "details": { ... }
}
```

### Authentication (`/api/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | No | Register new user |
| POST | `/login` | No | Login with email/password |
| POST | `/logout` | Yes | Logout current session |
| POST | `/refresh` | No | Refresh access token |
| POST | `/forgot-password` | No | Request password reset |
| POST | `/reset-password` | No | Reset password with token |
| GET | `/me` | Yes | Get current user info |

#### POST `/api/auth/register`

Register a new user account.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "first_name": "John",
  "last_name": "Doe"
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com"
    },
    "session": {
      "access_token": "eyJ...",
      "refresh_token": "..."
    }
  },
  "message": "Registration successful"
}
```

#### POST `/api/auth/login`

Authenticate with email and password.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "email": "..." },
    "session": {
      "access_token": "eyJ...",
      "refresh_token": "...",
      "expires_in": 3600
    }
  }
}
```

#### POST `/api/auth/logout`

Logout and invalidate the current session.

**Headers:** `Authorization: Bearer <access_token>`

**Response (200):**

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### POST `/api/auth/refresh`

Refresh an expired access token.

**Request Body:**

```json
{
  "refresh_token": "your-refresh-token"
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "session": {
      "access_token": "new-access-token",
      "refresh_token": "new-refresh-token"
    }
  }
}
```

#### POST `/api/auth/forgot-password`

Request a password reset email.

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

#### POST `/api/auth/reset-password`

Reset password using the token from email.

**Request Body:**

```json
{
  "token": "reset-token-from-email",
  "password": "newSecurePassword123"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Password reset successful"
}
```

#### GET `/api/auth/me`

Get current authenticated user information.

**Headers:** `Authorization: Bearer <access_token>`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "email_confirmed_at": "2024-01-01T00:00:00Z",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

---

### Profile (`/api/profile`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Yes | Get current user profile |
| PUT | `/` | Yes | Update user profile |
| DELETE | `/` | Yes | Delete user account |

#### GET `/api/profile`

Get the authenticated user's profile.

**Headers:** `Authorization: Bearer <access_token>`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "full_name": "John Doe",
    "avatar_url": "https://...",
    "phone": "+1234567890",
    "company": "Acme Inc",
    "bio": "Software developer",
    "website": "https://johndoe.com",
    "stripe_customer_id": "cus_...",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

#### PUT `/api/profile`

Update user profile fields.

**Headers:** `Authorization: Bearer <access_token>`

**Request Body (all fields optional):**

```json
{
  "first_name": "John",
  "last_name": "Smith",
  "phone": "+1234567890",
  "company": "New Company",
  "bio": "Updated bio",
  "website": "https://newsite.com",
  "avatar_url": "https://..."
}
```

**Response (200):**

```json
{
  "success": true,
  "data": { /* updated profile */ }
}
```

#### DELETE `/api/profile`

Delete the user account and all associated data.

**Headers:** `Authorization: Bearer <access_token>`

**Response (200):**

```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```

---

### Membership (`/api/membership`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/tiers` | Yes | Get all membership tiers |
| GET | `/tiers/:tierId/features` | Yes | Get features for a tier |
| GET | `/` | Yes | Get current membership |
| GET | `/features` | Yes | Get user's tier with features |
| GET | `/check-feature/:featureKey` | Yes | Check if user has feature |
| GET | `/feature-limit/:featureKey` | Yes | Get feature limit value |
| GET | `/trial/status` | Yes | Get trial status |
| POST | `/trial/start` | Yes | Start 14-day trial |
| POST | `/trial/convert` | Yes | Convert trial to paid |
| GET | `/usage` | Yes | Get all usage data |
| GET | `/usage/:featureKey` | Yes | Get specific feature usage |

#### GET `/api/membership/tiers`

Get all available membership tiers.

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "free",
      "display_name": "Free",
      "description": "Basic features for getting started",
      "price_monthly": 0,
      "price_yearly": 0,
      "is_active": true
    },
    {
      "id": "uuid",
      "name": "premium",
      "display_name": "Premium",
      "description": "Enhanced features for power users",
      "price_monthly": 9.99,
      "price_yearly": 99.99,
      "is_active": true
    }
  ]
}
```

#### GET `/api/membership`

Get current user's membership details.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "tier_id": "uuid",
    "status": "active",
    "billing_cycle": "monthly",
    "started_at": "2024-01-01T00:00:00Z",
    "expires_at": "2024-02-01T00:00:00Z",
    "trial_starts_at": null,
    "trial_ends_at": null,
    "stripe_subscription_id": "sub_...",
    "tier": {
      "name": "premium",
      "display_name": "Premium"
    }
  }
}
```

#### GET `/api/membership/check-feature/:featureKey`

Check if user has access to a specific feature.

**Example:** `GET /api/membership/check-feature/advanced_analytics`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "has_feature": true
  }
}
```

#### GET `/api/membership/feature-limit/:featureKey`

Get the limit value for a feature. Returns -1 for unlimited.

**Example:** `GET /api/membership/feature-limit/max_projects`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "limit": 10
  }
}
```

#### GET `/api/membership/trial/status`

Get current trial status.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "is_on_trial": true,
    "trial_starts_at": "2024-01-01T00:00:00Z",
    "trial_ends_at": "2024-01-15T00:00:00Z",
    "days_remaining": 10,
    "has_used_trial": true,
    "can_start_trial": false
  }
}
```

#### POST `/api/membership/trial/start`

Start a 14-day trial period. Upgrades user to Pro tier temporarily.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "trial",
    "trial_starts_at": "2024-01-01T00:00:00Z",
    "trial_ends_at": "2024-01-15T00:00:00Z"
  },
  "message": "Trial started successfully. You have 14 days to explore all Pro features."
}
```

**Error (400):** User already used trial or not eligible.

#### POST `/api/membership/trial/convert`

Convert trial to paid subscription.

**Request Body:**

```json
{
  "tier_id": "uuid-of-target-tier",
  "billing_cycle": "monthly"
}
```

**Response (200):**

```json
{
  "success": true,
  "data": { /* updated membership */ },
  "message": "Successfully upgraded to paid plan"
}
```

#### GET `/api/membership/usage`

Get all usage tracking data for current user.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "tier_name": "Premium",
    "features": [
      {
        "feature_key": "api_calls",
        "feature_name": "API Calls",
        "current_usage": 450,
        "usage_limit": 1000,
        "percentage_used": 45,
        "period_type": "monthly",
        "is_exceeded": false
      },
      {
        "feature_key": "max_projects",
        "feature_name": "Max Projects",
        "current_usage": 3,
        "usage_limit": 10,
        "percentage_used": 30,
        "period_type": "lifetime",
        "is_exceeded": false
      }
    ]
  }
}
```

---

### Billing (`/api/billing`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/create-checkout-session` | Yes | Create Stripe checkout |
| POST | `/create-portal-session` | Yes | Create billing portal |
| GET | `/payment-history` | Yes | Get payment history |
| POST | `/webhook` | No | Stripe webhook handler |

#### POST `/api/billing/create-checkout-session`

Create a Stripe Checkout session for subscription.

**Request Body:**

```json
{
  "tier_id": "uuid-of-tier",
  "billing_cycle": "monthly"
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "checkout_url": "https://checkout.stripe.com/..."
  }
}
```

#### POST `/api/billing/create-portal-session`

Create a Stripe Customer Portal session for managing subscription.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "portal_url": "https://billing.stripe.com/..."
  }
}
```

#### GET `/api/billing/payment-history`

Get payment history for current user.

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "pi_...",
      "amount": 999,
      "currency": "usd",
      "status": "succeeded",
      "created": 1704067200,
      "description": "Premium Monthly Subscription"
    }
  ]
}
```

#### POST `/api/billing/webhook`

Stripe webhook endpoint. Automatically processes these events:

- `checkout.session.completed` - Activates subscription
- `customer.subscription.updated` - Updates membership status
- `customer.subscription.deleted` - Handles cancellation
- `invoice.paid` - Records successful payment
- `invoice.payment_failed` - Marks membership as past_due

---

### Admin (`/api/admin`)

All admin endpoints require `admin` or `super_admin` role.

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| **Tier Management** ||||
| GET | `/tiers` | admin | List all tiers (including inactive) |
| POST | `/tiers` | admin | Create new tier |
| PUT | `/tiers/:id` | admin | Update tier |
| DELETE | `/tiers/:id` | admin | Deactivate tier |
| **Feature Management** ||||
| GET | `/features` | admin | List all features |
| POST | `/features` | admin | Create new feature |
| PUT | `/features/:id` | admin | Update feature |
| DELETE | `/features/:id` | admin | Delete feature |
| **Tier-Feature Assignment** ||||
| GET | `/tiers/:tierId/features` | admin | Get tier's features |
| POST | `/tiers/:tierId/features` | admin | Assign feature to tier |
| DELETE | `/tiers/:tierId/features/:featureId` | admin | Remove feature |
| **User Management** ||||
| GET | `/users/:userId/membership` | admin | Get user membership |
| PUT | `/users/:userId/membership` | super_admin | Update user membership |
| GET | `/users/:userId/usage` | admin | Get user usage |
| POST | `/users/:userId/usage/reset` | super_admin | Reset user usage |
| **Cron Jobs** ||||
| POST | `/cron/expire-trials` | admin | Expire trials (for cron) |
| POST | `/cron/reset-usage` | admin | Reset periodic usage |

#### POST `/api/admin/tiers`

Create a new membership tier.

**Request Body:**

```json
{
  "name": "enterprise",
  "display_name": "Enterprise",
  "description": "Full-featured enterprise plan",
  "price_monthly": 49.99,
  "price_yearly": 499.99,
  "stripe_monthly_price_id": "price_...",
  "stripe_yearly_price_id": "price_...",
  "is_active": true,
  "sort_order": 4
}
```

#### POST `/api/admin/features`

Create a new feature.

**Request Body:**

```json
{
  "key": "custom_branding",
  "name": "Custom Branding",
  "description": "Remove branding and add your own logo",
  "feature_type": "boolean"
}
```

Feature types:

- `boolean` - Feature is enabled/disabled
- `limit` - Feature has a numeric limit (e.g., max_projects: 10)
- `enum` - Feature has specific value options

#### POST `/api/admin/tiers/:tierId/features`

Assign a feature to a tier.

**Request Body:**

```json
{
  "feature_id": "uuid-of-feature",
  "value": "true",
  "usage_limit": null,
  "period_type": "none"
}
```

Period types for usage limits:

- `none` - No usage tracking
- `daily` - Resets daily
- `monthly` - Resets monthly
- `lifetime` - Never resets

#### POST `/api/admin/cron/expire-trials`

Expire all trials that have passed their end date. Call this from a cron job.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "expired_count": 5
  },
  "message": "Expired 5 trial memberships"
}
```

---

## Services

### AuthService

Handles all authentication operations through Supabase Auth.

```typescript
// Key methods
authService.register(email, password, metadata)
authService.login(email, password)
authService.logout(accessToken)
authService.refreshToken(refreshToken)
authService.resetPassword(email)
authService.updatePassword(accessToken, newPassword)
authService.getUser(accessToken)
```

### ProfileService

Manages user profile data with automatic Stripe customer creation.

```typescript
profileService.getProfile(userId, accessToken)
profileService.updateProfile(userId, data, accessToken)
profileService.deleteProfile(userId, accessToken)
```

### MembershipService

Handles membership tiers, features, and user memberships.

```typescript
membershipService.getTiers(accessToken)
membershipService.getTierFeatures(tierId, accessToken)
membershipService.getUserMembership(userId, accessToken)
membershipService.getUserTierWithFeatures(userId)
membershipService.userHasFeature(userId, featureKey)
membershipService.getFeatureLimit(userId, featureKey)
membershipService.updateMembership(userId, data)
```

### TrialService

Manages 14-day trial periods.

```typescript
trialService.getTrialStatus(userId)
trialService.canStartTrial(userId)
trialService.startTrial(userId)
trialService.expireTrials()
trialService.convertTrialToPaid(userId, tierId, billingCycle)
```

### UsageService

Tracks feature usage against tier limits.

```typescript
usageService.initializeUsage(userId, tierId)
usageService.updateLimitsForTier(userId, tierId)
usageService.canUseFeature(userId, featureKey)
usageService.incrementUsage(userId, featureKey, amount?)
usageService.getUsage(userId, featureKey)
usageService.getAllUsage(userId)
usageService.resetPeriodicUsage()
```

### StripeService

Wrapper for Stripe API operations.

```typescript
stripeService.createCustomer(email, metadata)
stripeService.createCheckoutSession(customerId, priceId, ...)
stripeService.createPortalSession(customerId, returnUrl)
stripeService.getPaymentHistory(customerId)
stripeService.cancelSubscription(subscriptionId)
```

### WebhookService

Processes Stripe webhook events.

```typescript
webhookService.handleEvent(event)
// Internally handles:
// - checkout.session.completed
// - customer.subscription.updated
// - customer.subscription.deleted
// - invoice.paid
// - invoice.payment_failed
```

---

## Middleware

### authMiddleware

Validates JWT tokens and attaches user info to request.

```typescript
// Usage in routes
router.get('/protected', authMiddleware, handler);

// Access in handler
const userId = req.user.id;
const accessToken = req.accessToken;
```

### adminMiddleware

Verifies admin role from `admin_users` table.

```typescript
import { requireAdmin, requireSuperAdmin } from './middleware/admin.middleware';

// Requires admin or super_admin role
router.get('/admin-only', authMiddleware, requireAdmin, handler);

// Requires super_admin role only
router.post('/super-only', authMiddleware, requireSuperAdmin, handler);
```

### membershipMiddleware

Controls access based on membership tier and features.

```typescript
import { requireTier, requireFeature } from './middleware/membership.middleware';

// Require specific tier
router.get('/premium', authMiddleware, requireTier('premium'), handler);

// Require specific feature
router.get('/analytics', authMiddleware, requireFeature('advanced_analytics'), handler);
```

### usageMiddleware

Enforces usage limits with optional auto-increment.

```typescript
import { enforceLimit, requireFeature } from './middleware/usage.middleware';

// Check limit and auto-increment on success
router.post('/api-call', authMiddleware, enforceLimit('api_calls'), handler);

// Check limit without incrementing
router.get('/projects', authMiddleware, enforceLimit('max_projects', false), handler);

// Just check feature access (no usage tracking)
router.get('/feature', authMiddleware, requireFeature('some_feature'), handler);
```

### errorMiddleware

Global error handling with Zod validation support.

```typescript
// Custom API errors
throw new ApiError(404, 'Resource not found');
throw new ApiError(403, 'Access denied', { reason: 'insufficient_permissions' });

// Zod errors are automatically formatted
// Returns 400 with field-level error details
```

---

## Database Schema

### Tables Overview

```
┌─────────────────────┐     ┌─────────────────────┐
│   user_profiles     │────▶│  user_memberships   │
└─────────────────────┘     └─────────────────────┘
         │                           │
         │                           │
         ▼                           ▼
┌─────────────────────┐     ┌─────────────────────┐
│   usage_tracking    │     │  membership_tiers   │
└─────────────────────┘     └─────────────────────┘
                                     │
                                     │
                                     ▼
                            ┌─────────────────────┐
                            │   tier_features     │
                            └─────────────────────┘
                                     │
                                     ▼
                            ┌─────────────────────┐
                            │      features       │
                            └─────────────────────┘
```

### user_profiles

Extended user data linked to Supabase Auth.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key, links to auth.users |
| email | text | User email |
| first_name | text | First name |
| last_name | text | Last name |
| full_name | text | Computed: first_name + last_name |
| phone | text | Phone number |
| company | text | Company name |
| bio | text | User biography |
| website | text | Personal website |
| avatar_url | text | Profile picture URL |
| stripe_customer_id | text | Stripe customer ID |

### membership_tiers

Available subscription tiers.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Internal name (free, premium, pro) |
| display_name | text | Display name |
| description | text | Tier description |
| price_monthly | decimal | Monthly price |
| price_yearly | decimal | Yearly price |
| stripe_monthly_price_id | text | Stripe price ID for monthly |
| stripe_yearly_price_id | text | Stripe price ID for yearly |
| is_active | boolean | Whether tier is available |
| sort_order | integer | Display order |

### user_memberships

User subscription status.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Foreign key to user_profiles |
| tier_id | uuid | Foreign key to membership_tiers |
| status | enum | active, cancelled, expired, trial, past_due |
| billing_cycle | enum | monthly, yearly |
| started_at | timestamp | Membership start date |
| expires_at | timestamp | Membership expiration |
| trial_starts_at | timestamp | Trial start (if applicable) |
| trial_ends_at | timestamp | Trial end (if applicable) |
| stripe_subscription_id | text | Stripe subscription ID |

### features

Feature definitions.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| key | text | Unique feature key |
| name | text | Display name |
| description | text | Feature description |
| feature_type | enum | boolean, limit, enum |

### tier_features

Feature assignments to tiers.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| tier_id | uuid | Foreign key to membership_tiers |
| feature_id | uuid | Foreign key to features |
| value | text | Feature value (true, 10, "advanced") |
| usage_limit | integer | Max usage (for limit types) |
| period_type | enum | none, daily, monthly, lifetime |

### usage_tracking

User feature usage.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Foreign key to user_profiles |
| feature_id | uuid | Foreign key to features |
| current_usage | integer | Current usage count |
| usage_limit | integer | Limit from tier_features |
| period_type | enum | none, daily, monthly, lifetime |
| period_start | timestamp | Current period start |
| last_reset | timestamp | Last usage reset time |

### admin_users

Admin role assignments.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Foreign key to user_profiles |
| role | enum | admin, super_admin |
| created_by | uuid | Who granted admin access |

---

## Feature System

### Feature Types

1. **Boolean** - Simple on/off features
   - Value: `"true"` or `"false"`
   - Example: `advanced_analytics`, `priority_support`

2. **Limit** - Numeric limits with usage tracking
   - Value: Number as string (e.g., `"10"`)
   - Use with `period_type` for reset behavior
   - Example: `max_projects`, `api_calls`

3. **Enum** - Specific value options
   - Value: One of predefined options
   - Example: `storage_type` with values `basic`, `premium`, `enterprise`

### Checking Features in Code

```typescript
// In route handlers
const hasFeature = await membershipService.userHasFeature(userId, 'advanced_analytics');

// Get limit value (-1 = unlimited)
const limit = await membershipService.getFeatureLimit(userId, 'max_projects');

// Using middleware
router.get('/analytics',
  authMiddleware,
  requireFeature('advanced_analytics'),
  handler
);
```

### Adding New Features

1. Create feature via Admin API:

```bash
POST /api/admin/features
{
  "key": "new_feature",
  "name": "New Feature",
  "description": "Description here",
  "feature_type": "boolean"
}
```

2. Assign to tiers:

```bash
POST /api/admin/tiers/{tierId}/features
{
  "feature_id": "uuid",
  "value": "true"
}
```

---

## Trial System

### How Trials Work

1. User calls `POST /api/membership/trial/start`
2. System checks eligibility (never had a trial before)
3. User upgraded to "trial" tier with Pro features
4. Membership status set to `trial`
5. `trial_ends_at` set to 14 days from now
6. Usage limits initialized for trial tier

### Trial Lifecycle

```
┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│  Start Trial   │────▶│  14 Days Pass  │────▶│   Auto-Expire  │
│  status=trial  │     │                │     │  status=expired│
└────────────────┘     └────────────────┘     └────────────────┘
        │                                              │
        │                                              │
        ▼                                              ▼
┌────────────────┐                           ┌────────────────┐
│ Convert to     │                           │ Downgrade to   │
│ Paid Plan      │                           │ Free Tier      │
│ status=active  │                           │                │
└────────────────┘                           └────────────────┘
```

### Auto-Expiration

Set up a cron job to call:

```bash
POST /api/admin/cron/expire-trials
```

This will:

- Find all memberships where `trial_ends_at < now`
- Set status to `expired`
- Downgrade to free tier

---

## Usage Tracking

### Period Types

| Type | Description | Reset Behavior |
|------|-------------|----------------|
| `none` | No tracking | N/A |
| `daily` | Resets every day | At midnight UTC |
| `monthly` | Resets monthly | First of each month |
| `lifetime` | Never resets | Counts forever |

### How Limits Work

1. When user performs action, check current usage
2. Compare against `usage_limit` in their tier
3. If under limit, increment and allow
4. If at/over limit, reject with 403

```typescript
// Middleware handles this automatically
router.post('/action',
  authMiddleware,
  enforceLimit('api_calls'),  // Checks and increments
  handler
);
```

### Manual Increment

```typescript
// In service code
const canUse = await usageService.canUseFeature(userId, 'api_calls');
if (canUse) {
  await usageService.incrementUsage(userId, 'api_calls');
  // Perform action
} else {
  throw new ApiError(403, 'Usage limit exceeded');
}
```

### Usage Reset

Set up a cron job to call daily:

```bash
POST /api/admin/cron/reset-usage
```

This automatically resets:

- `daily` features at midnight
- `monthly` features on the 1st

---

## Stripe Integration

### Setup Requirements

1. Create products in Stripe Dashboard
2. Create prices (monthly/yearly) for each product
3. Add price IDs to membership_tiers table
4. Configure webhook endpoint in Stripe Dashboard

### Webhook Configuration

Endpoint: `POST /api/billing/webhook`

Required events:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

### Payment Flow

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ User    │───▶│ Backend │───▶│ Stripe  │───▶│ Webhook │
│ Clicks  │    │ Creates │    │ Checkout│    │ Updates │
│ Upgrade │    │ Session │    │ Page    │    │ Database│
└─────────┘    └─────────┘    └─────────┘    └─────────┘
     │                             │              │
     │                             │              │
     └─────────────────────────────┘              │
              User completes                      │
              payment on Stripe                   │
                                                  ▼
                                         ┌─────────────┐
                                         │ Membership  │
                                         │ Activated   │
                                         └─────────────┘
```

### Test Cards

| Card Number | Description |
|-------------|-------------|
| 4242 4242 4242 4242 | Successful payment |
| 4000 0000 0000 9995 | Declined payment |
| 4000 0025 0000 3155 | Requires 3D Secure |

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": "Error message here",
  "details": {
    "field": "Additional context"
  }
}
```

### Common Status Codes

| Code | Meaning |
|------|---------|
| 400 | Bad Request - Invalid input/validation error |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions or quota |
| 404 | Not Found - Resource doesn't exist |
| 500 | Internal Server Error |

### Using ApiError

```typescript
import { ApiError } from '../middleware/error.middleware';

// Throw custom errors
throw new ApiError(404, 'User not found');

// With details (hidden in production)
throw new ApiError(403, 'Access denied', {
  required_tier: 'premium',
  current_tier: 'free'
});
```

### Validation Errors

Zod validation errors are automatically formatted:

```json
{
  "success": false,
  "error": "Validation error",
  "details": [
    { "field": "email", "message": "Invalid email format" },
    { "field": "password", "message": "Must be at least 8 characters" }
  ]
}
```

---

## Testing

### Testing Endpoints

Use the Swagger UI at `/api-docs` for interactive testing.

Or use curl:

```bash
# Register
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Authenticated request
curl http://localhost:3001/api/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Testing Stripe Webhooks

Use Stripe CLI for local webhook testing:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3001/api/billing/webhook
```

### Test Environment

Set these environment variables for testing:

```env
NODE_ENV=development
STRIPE_SECRET_KEY=sk_test_...
```

---

## Common Mistakes to Avoid

When implementing Supabase authentication, avoid these common pitfalls:

| Mistake | Why It's Bad | Solution |
|---------|--------------|----------|
| Using Service Role Key in frontend | Bypasses all RLS - exposes your entire database | Only use in backend, never expose to client |
| Using `@supabase/auth-helpers` | Deprecated package | Use `@supabase/ssr` instead |
| Creating new Supabase client per request | Memory leaks, poor performance | Use singleton clients, reuse instances |
| Missing `/auth/callback` route | OAuth will redirect to nowhere | Add callback endpoint for OAuth providers |
| Not adding localhost to redirect URLs | OAuth fails in development | Add `http://localhost:3001/api/auth/callback` in Supabase Dashboard |
| Backend creating login cookies | Wrong architecture | Frontend creates cookies via Supabase client, backend only reads/refreshes |
| Forgetting cookie-parser middleware | Cookies won't be parsed | Add `app.use(cookieParser())` before routes |
| Not setting `credentials: true` in CORS | Cookies won't be sent cross-origin | Already configured in this project |

---

## Troubleshooting

### Common Issues

**"Invalid token" errors**

- Check that Authorization header format is `Bearer <token>`
- Verify token hasn't expired (refresh if needed)
- Ensure SUPABASE_URL and keys are correct

**Stripe webhooks not working**

- Verify STRIPE_WEBHOOK_SECRET matches your endpoint
- Check webhook is pointing to correct URL
- Ensure events are enabled in Stripe Dashboard

**"User not found" after registration**

- Check that the trigger for creating user_profiles exists
- Verify RLS policies allow the operation
- Check Supabase logs for errors

**Usage limits not enforcing**

- Ensure usage_tracking records exist for user
- Verify tier_features has correct period_type
- Check that middleware is applied to route

**CORS errors**

- Verify FRONTEND_URL in environment variables
- Check that URL matches exactly (including port)

### Debug Mode

Enable detailed logging in development:

```env
NODE_ENV=development
```

This will:

- Show detailed error messages in responses
- Log all errors to console
- Include error details in API responses

### Getting Help

- Check Supabase Dashboard logs for database errors
- Check Stripe Dashboard for payment issues
- Review server console for application errors
