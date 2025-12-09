# Supabase Infrastructure Guide

Complete documentation for the database schema, triggers, functions, and security policies.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Database Architecture](#database-architecture)
3. [Tables Reference](#tables-reference)
4. [Enums](#enums)
5. [Database Triggers](#database-triggers)
6. [Helper Functions (RPC)](#helper-functions-rpc)
7. [Database Views](#database-views)
8. [Row Level Security (RLS)](#row-level-security-rls)
9. [Indexes](#indexes)
10. [Stripe Integration](#stripe-integration)
11. [Feature Flag System](#feature-flag-system)
12. [Common SQL Queries](#common-sql-queries)
13. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites

- [Supabase](https://supabase.com) account (free tier works)
- Node.js 18+ (for backend)
- Stripe account (for billing features)

### Setup Steps

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Wait for database to be provisioned (~2 minutes)

2. **Run Database Migration**
   - Go to **SQL Editor** in Supabase Dashboard
   - Copy entire contents of `migrations/001_initial_schema.sql`
   - Paste and click **Run**
   - All tables, triggers, and seed data will be created

3. **Get API Keys**
   - Go to **Settings > API**
   - Copy these values to your `.env`:
     - `SUPABASE_URL` - Project URL
     - `SUPABASE_ANON_KEY` - `anon` public key
     - `SUPABASE_SERVICE_ROLE_KEY` - `service_role` key (keep secret!)
     - `JWT_SECRET` - JWT Secret (under JWT Settings)

4. **Test the Setup**
   - Create a test user in **Authentication > Users**
   - Check `user_profiles` table - profile should auto-create
   - Check `memberships` table - free membership should auto-create

### Environment Variables

```env
# Supabase (Required)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
JWT_SECRET=your-jwt-secret-from-supabase

# Stripe (For billing)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## Database Architecture

```
┌─────────────────────┐
│     auth.users      │  Supabase Auth (managed)
│   (Supabase Auth)   │
└──────────┬──────────┘
           │ on_auth_user_created trigger
           ▼
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   user_profiles     │────▶│    memberships      │     │    admin_users      │
│                     │     │                     │     │                     │
│ - email             │     │ - status            │     │ - user_id           │
│ - first_name        │     │ - billing_cycle     │     │ - role (admin/      │
│ - last_name         │     │ - stripe_sub_id     │     │   super_admin)      │
│ - full_name (gen)   │     │ - trial fields      │     └─────────────────────┘
│ - stripe_customer_id│     │                     │
└──────────┬──────────┘     └──────────┬──────────┘
           │                           │
           │                ┌──────────┴──────────┐
           │                ▼                     ▼
           │     ┌─────────────────┐   ┌─────────────────────┐
           │     │ membership_tiers│   │ membership_audit_log│
           │     │                 │   │                     │
           │     │ - Trial         │   │ - action            │
           │     │ - Free          │   │ - old_tier_id       │
           │     │ - Premium       │   │ - new_tier_id       │
           │     │ - Pro           │   │ - old_status        │
           │     └────────┬────────┘   └─────────────────────┘
           │              │
           │  ┌───────────┼────────────────┐
           │  ▼           ▼                ▼
           │ ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐
           │ │  features   │  │ tier_features│  │ payment_history │
           │ │             │  │ (join table) │  │                 │
           │ │ - ai_asst   │──│              │  │ - amount        │
           │ │ - team_collab│ │ - value      │  │ - status        │
           │ │ - analytics │  └──────────────┘  │ - stripe_ids    │
           │ │ - api_integ │                    └─────────────────┘
           │ │ - storage   │
           │ └─────────────┘   ┌─────────────────────┐
           │                   │stripe_webhook_events│
           │                   │                     │
           │                   │ - event_type        │
           │                   │ - payload           │
           │                   │ - processed         │
           │                   └─────────────────────┘
           │
           ▼
┌─────────────────────┐
│   usage_tracking    │
│                     │
│ - feature_key       │
│ - current_usage     │
│ - usage_limit       │
│ - period_type       │
└─────────────────────┘
```

---

## Tables Reference

### 1. `user_profiles`

Extended user data linked to Supabase Auth. **Auto-created on signup.**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, FK→auth.users | User ID (matches auth.users.id) |
| `email` | TEXT | NOT NULL | User's email address |
| `first_name` | TEXT | - | User's first name |
| `last_name` | TEXT | - | User's last name |
| `full_name` | TEXT | **GENERATED** | Auto-computed: first_name + ' ' + last_name |
| `avatar_url` | TEXT | - | Profile image URL |
| `phone` | TEXT | - | Phone number |
| `company` | TEXT | - | Company/organization name |
| `bio` | TEXT | - | Short biography |
| `website` | TEXT | - | Personal/company website |
| `stripe_customer_id` | TEXT | UNIQUE | Stripe Customer ID (cus_xxx) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When profile was created |
| `updated_at` | TIMESTAMPTZ | NOT NULL, AUTO-UPDATE | Last modification time |

**Notes:**
- Automatically created when user signs up via Supabase Auth
- `full_name` is a **computed column** - you cannot INSERT/UPDATE it directly
- Update `first_name` and/or `last_name` to change the `full_name`
- `stripe_customer_id` is set when user first interacts with Stripe
- Deleting profile cascades to delete membership

---

### 2. `membership_tiers`

Subscription plan definitions. **Pre-seeded with 4 tiers.**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Tier identifier |
| `name` | TEXT | NOT NULL, UNIQUE | Internal name: trial, free, premium, pro |
| `display_name` | TEXT | NOT NULL | User-facing name: "Trial", "Free", etc. |
| `description` | TEXT | - | Description for pricing page |
| `price_monthly` | DECIMAL(10,2) | DEFAULT 0 | Monthly price in USD |
| `price_yearly` | DECIMAL(10,2) | DEFAULT 0 | Yearly price in USD (discounted) |
| `stripe_price_id_monthly` | TEXT | - | Stripe Price ID for monthly billing |
| `stripe_price_id_yearly` | TEXT | - | Stripe Price ID for yearly billing |
| `stripe_product_id` | TEXT | - | Stripe Product ID |
| `trial_days` | INTEGER | DEFAULT 0 | Trial duration (14 for Trial tier) |
| `is_active` | BOOLEAN | DEFAULT true | Whether tier is available for selection |
| `is_default` | BOOLEAN | DEFAULT false | Default tier for new users (Free) |
| `sort_order` | INTEGER | DEFAULT 0 | Display order on pricing page |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last update timestamp |

**Pre-seeded Tiers:**

| Tier | Monthly | Yearly | Trial Days | Default |
|------|---------|--------|------------|---------|
| Trial | $0 | $0 | 14 | No |
| Free | $0 | $0 | 0 | **Yes** |
| Premium | $29 | $290 | 0 | No |
| Pro | $79 | $790 | 0 | No |

---

### 3. `memberships`

User's active subscription. **Auto-created on signup with Free tier.**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Membership record ID |
| `user_id` | UUID | FK→user_profiles, UNIQUE | One membership per user |
| `tier_id` | UUID | FK→membership_tiers | Current tier |
| `status` | membership_status | NOT NULL, DEFAULT 'active' | Subscription status |
| **Timing** |
| `started_at` | TIMESTAMPTZ | NOT NULL | When membership started |
| `expires_at` | TIMESTAMPTZ | - | Expiration date (if applicable) |
| `cancelled_at` | TIMESTAMPTZ | - | When user cancelled |
| `cancel_at_period_end` | BOOLEAN | DEFAULT false | Cancel at end of billing period |
| **Trial** |
| `trial_starts_at` | TIMESTAMPTZ | - | Trial start date |
| `trial_ends_at` | TIMESTAMPTZ | - | Trial end date |
| `has_used_trial` | BOOLEAN | DEFAULT false | Prevents multiple trials |
| **Billing** |
| `billing_cycle` | billing_cycle | - | 'monthly' or 'yearly' |
| `current_period_start` | TIMESTAMPTZ | - | Current billing period start |
| `current_period_end` | TIMESTAMPTZ | - | Current billing period end |
| **Stripe** |
| `stripe_subscription_id` | TEXT | UNIQUE | Stripe Subscription ID (sub_xxx) |
| `stripe_price_id` | TEXT | - | Current Stripe Price ID |
| `stripe_latest_invoice_id` | TEXT | - | Latest invoice ID |
| `stripe_latest_invoice_status` | TEXT | - | 'paid', 'payment_failed', etc. |
| **Payment** |
| `last_payment_at` | TIMESTAMPTZ | - | Last successful payment |
| `last_payment_amount` | DECIMAL(10,2) | - | Amount of last payment |
| `last_payment_currency` | TEXT | DEFAULT 'usd' | Currency code |
| `next_billing_date` | TIMESTAMPTZ | - | Next scheduled payment |
| **Meta** |
| `metadata` | JSONB | DEFAULT '{}' | Custom metadata |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last update timestamp |

---

### 4. `features`

Feature definitions for the SaaS platform. **Pre-seeded with 5 features.**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Feature ID |
| `key` | TEXT | NOT NULL, UNIQUE | Unique identifier: ai_assistant, team_collaboration |
| `name` | TEXT | NOT NULL | Display name: "AI Assistant" |
| `description` | TEXT | - | Full feature description |
| `feature_type` | TEXT | CHECK (boolean/limit/enum) | How the feature value is interpreted |
| `default_value` | JSONB | DEFAULT 'false' | Default value if not in tier_features |
| `is_active` | BOOLEAN | DEFAULT true | Feature is enabled |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |

**Pre-seeded Features:**

| Key | Name | Type | Description |
|-----|------|------|-------------|
| `ai_assistant` | AI Assistant | boolean | GPT-4 powered suggestions, content generation, and automated workflows |
| `team_collaboration` | Team Collaboration | limit | Real-time collaboration with shared workspaces, live editing, comments, mentions, and team chat |
| `analytics_dashboard` | Analytics Dashboard | boolean | Comprehensive analytics with real-time metrics, custom reports, and data visualization |
| `api_integrations` | API & Integrations | limit | Connect with 100+ tools (Slack, Zapier, Salesforce). Full REST API access with webhooks |
| `cloud_storage` | Cloud Storage | limit | Secure cloud storage with automatic backups, version history, and CDN delivery (value in MB) |

---

### 5. `tier_features` (Join Table)

Maps features to tiers with specific values.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Record ID |
| `tier_id` | UUID | FK→membership_tiers, UNIQUE(tier_id, feature_id) | Tier this applies to |
| `feature_id` | UUID | FK→features | Feature being configured |
| `value` | JSONB | NOT NULL | Feature value for this tier |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |

**Feature Matrix (Pre-seeded):**

| Feature | Trial | Free | Premium | Pro |
|---------|-------|------|---------|-----|
| AI Assistant | `true` | `false` | `true` | `true` |
| Team Collaboration | `10` | `1` | `5` | `-1` (unlimited) |
| Analytics Dashboard | `true` | `false` | `true` | `true` |
| API Integrations | `100` | `0` | `10` | `-1` (unlimited) |
| Cloud Storage (MB) | `10000` | `500` | `5000` | `50000` |

**Value Interpretation:**
- `"true"` / `"false"` - Boolean features (enabled/disabled)
- `"5"` - Numeric limit
- `"-1"` - Unlimited

---

### 6. `payment_history`

Records all payment transactions from Stripe webhooks.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Payment record ID |
| `user_id` | UUID | FK→user_profiles | User who made payment |
| `membership_id` | UUID | FK→memberships | Related membership |
| **Stripe IDs** |
| `stripe_payment_intent_id` | TEXT | UNIQUE | PaymentIntent ID (pi_xxx) |
| `stripe_invoice_id` | TEXT | - | Invoice ID (in_xxx) |
| `stripe_charge_id` | TEXT | - | Charge ID (ch_xxx) |
| `stripe_subscription_id` | TEXT | - | Subscription ID (sub_xxx) |
| **Payment Details** |
| `amount` | DECIMAL(10,2) | NOT NULL | Amount in dollars |
| `currency` | TEXT | DEFAULT 'usd' | Currency code |
| `status` | TEXT | CHECK | pending, succeeded, failed, refunded, partially_refunded |
| **Documents** |
| `invoice_url` | TEXT | - | Hosted invoice URL |
| `receipt_url` | TEXT | - | Receipt URL |
| `invoice_pdf` | TEXT | - | PDF download URL |
| **Meta** |
| `description` | TEXT | - | Payment description |
| `metadata` | JSONB | DEFAULT '{}' | Custom metadata |
| `failure_reason` | TEXT | - | Error message if failed |
| `paid_at` | TIMESTAMPTZ | - | When payment succeeded |
| `created_at` | TIMESTAMPTZ | NOT NULL | Record creation time |

---

### 7. `stripe_webhook_events`

Log of all Stripe webhook events for debugging and retry logic.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Record ID |
| `stripe_event_id` | TEXT | NOT NULL, UNIQUE | Stripe Event ID (evt_xxx) |
| `event_type` | TEXT | NOT NULL | Event type: checkout.session.completed |
| `payload` | JSONB | NOT NULL | Full event payload |
| `processed` | BOOLEAN | DEFAULT false | Has been handled |
| `processed_at` | TIMESTAMPTZ | - | When processing completed |
| `error_message` | TEXT | - | Error if processing failed |
| `retry_count` | INTEGER | DEFAULT 0 | Number of retry attempts |
| `created_at` | TIMESTAMPTZ | NOT NULL | When event was received |

**Event Types Handled:**

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Upgrade user to new tier |
| `customer.subscription.created` | Record new subscription |
| `customer.subscription.updated` | Sync subscription changes |
| `customer.subscription.deleted` | Downgrade to Free tier |
| `invoice.paid` | Record successful payment |
| `invoice.payment_failed` | Mark payment as failed, update status |

---

### 8. `membership_audit_log`

Tracks all membership changes for compliance and debugging.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Log entry ID |
| `membership_id` | UUID | FK→memberships | Related membership |
| `user_id` | UUID | FK→user_profiles | User whose membership changed |
| `action` | TEXT | NOT NULL | Action type: tier_changed, status_changed |
| `old_tier_id` | UUID | FK→membership_tiers | Previous tier |
| `new_tier_id` | UUID | FK→membership_tiers | New tier |
| `old_status` | membership_status | - | Previous status |
| `new_status` | membership_status | - | New status |
| `metadata` | JSONB | DEFAULT '{}' | Additional context (billing_cycle, etc.) |
| `created_at` | TIMESTAMPTZ | NOT NULL | When change occurred |

**Note:** Automatically populated by the `on_membership_changed` trigger.

---

### 9. `usage_tracking`

Tracks feature usage per user for enforcement of limits.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Record ID |
| `user_id` | UUID | FK→user_profiles | User being tracked |
| `feature_key` | TEXT | NOT NULL | Feature being tracked (e.g., 'cloud_storage') |
| `current_usage` | INTEGER | DEFAULT 0 | Current usage count |
| `usage_limit` | INTEGER | DEFAULT 0 | Limit for this feature (-1 = unlimited) |
| `period_start` | TIMESTAMPTZ | DEFAULT NOW() | Start of current tracking period |
| `period_end` | TIMESTAMPTZ | - | End of period (null for lifetime) |
| `period_type` | TEXT | CHECK | 'daily', 'monthly', 'lifetime', 'none' |
| `last_used_at` | TIMESTAMPTZ | - | Last time feature was used |
| `created_at` | TIMESTAMPTZ | NOT NULL | Record creation time |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last update time |

**Period Types:**

- `daily` - Resets at end of each day (UTC)
- `monthly` - Resets at end of each month
- `lifetime` - Never resets
- `none` - Boolean features (no usage tracking)

**Constraint:** UNIQUE(user_id, feature_key)

---

### 10. `admin_users`

Tracks users with administrative privileges.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Record ID |
| `user_id` | UUID | FK→user_profiles, UNIQUE | Admin user |
| `role` | TEXT | NOT NULL, DEFAULT 'admin' | 'admin' or 'super_admin' |
| `created_at` | TIMESTAMPTZ | NOT NULL | When admin was added |
| `created_by` | UUID | FK→user_profiles | Who added this admin |

**Roles:**

- `admin` - Can manage tiers, features, view user data
- `super_admin` - Can also manage other admins

**Making a user an admin:**

```sql
INSERT INTO admin_users (user_id, role)
VALUES ('user-uuid-here', 'admin');
```

---

## Enums

### `membership_status`

```sql
CREATE TYPE membership_status AS ENUM (
  'active',      -- Subscription is active and paid
  'cancelled',   -- User cancelled, may still have access until period end
  'expired',     -- Subscription has ended
  'trial',       -- User is in trial period
  'past_due'     -- Payment failed, grace period
);
```

### `billing_cycle`

```sql
CREATE TYPE billing_cycle AS ENUM (
  'monthly',     -- Billed every month
  'yearly'       -- Billed annually (discounted)
);
```

---

## Database Triggers

### 1. `on_auth_user_created`

**Table:** `auth.users`
**Event:** AFTER INSERT
**Function:** `handle_new_user()`

**What it does:**
1. Creates a new `user_profiles` record with email, name from metadata
2. Creates a new `memberships` record with Free tier and 'active' status

```sql
-- Triggered automatically when user signs up
-- You don't need to call this manually
```

### 2. `on_profile_updated`

**Table:** `user_profiles`
**Event:** BEFORE UPDATE
**Function:** `handle_updated_at()`

Automatically updates `updated_at` timestamp on any profile change.

### 3. `on_tier_updated`

**Table:** `membership_tiers`
**Event:** BEFORE UPDATE
**Function:** `handle_updated_at()`

Automatically updates `updated_at` timestamp when tiers are modified.

### 4. `on_membership_updated`

**Table:** `memberships`
**Event:** BEFORE UPDATE
**Function:** `handle_updated_at()`

Automatically updates `updated_at` timestamp on membership changes.

### 5. `on_membership_changed`

**Table:** `memberships`
**Event:** AFTER UPDATE
**Function:** `log_membership_change()`

Records tier or status changes to `membership_audit_log` for compliance tracking.

### 6. `on_usage_tracking_updated`

**Table:** `usage_tracking`
**Event:** BEFORE UPDATE
**Function:** `handle_updated_at()`

Automatically updates `updated_at` timestamp when usage records are modified.

---

## Helper Functions (RPC)

Call these functions via Supabase client:

```typescript
const { data } = await supabase.rpc('function_name', { param: value });
```

### `get_user_tier_with_features(p_user_id UUID)`

Returns user's current tier with all feature values.

**Parameters:**
- `p_user_id` - User's UUID

**Returns:**
| Column | Type | Description |
|--------|------|-------------|
| `tier_id` | UUID | Tier ID |
| `tier_name` | TEXT | Internal tier name |
| `tier_display_name` | TEXT | Display name |
| `membership_status` | membership_status | Current status |
| `features` | JSONB | All features as key-value pairs |

**Example:**
```sql
SELECT * FROM get_user_tier_with_features('a1b2c3d4-...');

-- Returns:
-- tier_id: "uuid-here"
-- tier_name: "premium"
-- tier_display_name: "Premium"
-- membership_status: "active"
-- features: {
--   "ai_assistant": true,
--   "team_collaboration": "5",
--   "analytics_dashboard": true,
--   "api_integrations": "10",
--   "cloud_storage": "5000"
-- }
```

### `user_has_feature(p_user_id UUID, p_feature_key TEXT)`

Check if user has access to a specific feature.

**Parameters:**
- `p_user_id` - User's UUID
- `p_feature_key` - Feature key (e.g., 'ai_assistant')

**Returns:** `BOOLEAN`

**Example:**
```sql
SELECT user_has_feature('a1b2c3d4-...', 'ai_assistant');
-- Returns: TRUE or FALSE
```

**Logic:**
- Returns `TRUE` if feature value is `"true"` (boolean)
- Returns `TRUE` if feature value is numeric and > 0 or = -1 (unlimited)
- Returns `FALSE` if feature value is `"false"` or `"0"`
- Returns `FALSE` if user's membership status is not 'active' or 'trial'

### `get_feature_limit(p_user_id UUID, p_feature_key TEXT)`

Get the numeric limit for a feature.

**Parameters:**
- `p_user_id` - User's UUID
- `p_feature_key` - Feature key (e.g., 'cloud_storage')

**Returns:** `INTEGER`

**Example:**
```sql
SELECT get_feature_limit('a1b2c3d4-...', 'cloud_storage');
-- Returns: 5000 (MB) for Premium user
-- Returns: -1 for Pro user (unlimited)
-- Returns: 0 if feature not found
```

### `get_tier_features(p_tier_id UUID)`

Get all features configured for a specific tier.

**Parameters:**
- `p_tier_id` - Tier's UUID

**Returns:**
| Column | Type | Description |
|--------|------|-------------|
| `feature_key` | TEXT | Feature identifier |
| `feature_name` | TEXT | Display name |
| `feature_type` | TEXT | boolean, limit, or enum |
| `value` | JSONB | Feature value for this tier |

**Example:**
```sql
SELECT * FROM get_tier_features('premium-tier-uuid');

-- Returns rows like:
-- feature_key: "ai_assistant", feature_name: "AI Assistant", value: "true"
-- feature_key: "cloud_storage", feature_name: "Cloud Storage", value: "5000"
```

---

## Database Views

### `user_membership_details`

Joins user profile, membership, and tier for complete user info.

**Columns:**
- `membership_id`, `user_id`, `email`, `full_name`, `stripe_customer_id`
- `tier_id`, `tier_name`, `tier_display_name`, `price_monthly`, `price_yearly`
- `status`, `billing_cycle`, `started_at`, `expires_at`
- `current_period_start`, `current_period_end`, `stripe_subscription_id`, `cancel_at_period_end`

**Example:**
```sql
SELECT * FROM user_membership_details WHERE user_id = 'xxx';

-- Great for admin dashboards, user profile pages
```

### `tier_comparison`

Aggregates tier info with features for pricing pages.

**Columns:**
- `tier_id`, `name`, `display_name`, `description`
- `price_monthly`, `price_yearly`, `trial_days`, `sort_order`
- `features` - JSONB with all features and their values/types

**Example:**
```sql
SELECT * FROM tier_comparison ORDER BY sort_order;

-- Perfect for building pricing comparison tables
-- features contains: { "ai_assistant": { "name": "AI Assistant", "value": "true", "type": "boolean" }, ... }
```

---

## Row Level Security (RLS)

All tables have RLS enabled. Policies control who can read/write data.

### User Access Policies

| Table | SELECT | UPDATE | DELETE | INSERT |
|-------|--------|--------|--------|--------|
| `user_profiles` | Own profile only | Own profile only | Own profile only | - (trigger) |
| `membership_tiers` | All active tiers | - | - | - |
| `memberships` | Own membership only | - | - | - (trigger) |
| `features` | All active features | - | - | - |
| `tier_features` | All | - | - | - |
| `payment_history` | Own payments only | - | - | - |
| `membership_audit_log` | Own logs only | - | - | - |
| `stripe_webhook_events` | - | - | - | - |
| `usage_tracking` | Own usage only | - | - | - |
| `admin_users` | Admins only | - | - | - |

### Service Role Access

All tables have `Service role full access` policy that grants full CRUD when using the `SUPABASE_SERVICE_ROLE_KEY`.

**Important:** Only use service role key in backend servers, never expose to client!

### Policy Examples

```sql
-- Users can only see their own profile
CREATE POLICY "Users can view own profile"
ON user_profiles FOR SELECT
USING (auth.uid() = id);

-- Anyone can see active membership tiers (for pricing page)
CREATE POLICY "Anyone can view active tiers"
ON membership_tiers FOR SELECT
USING (is_active = true);

-- Service role can do anything (for backend operations)
CREATE POLICY "Service role full access"
ON memberships FOR ALL
USING (auth.jwt()->>'role' = 'service_role');
```

---

## Indexes

All indexes are created for optimal query performance:

| Index | Table | Column(s) | Purpose |
|-------|-------|-----------|---------|
| `idx_user_profiles_email` | user_profiles | email | User lookup by email |
| `idx_user_profiles_stripe_customer` | user_profiles | stripe_customer_id | Stripe webhook processing |
| `idx_memberships_user_id` | memberships | user_id | Get user's membership |
| `idx_memberships_tier_id` | memberships | tier_id | Analytics by tier |
| `idx_memberships_status` | memberships | status | Filter active/cancelled |
| `idx_memberships_stripe_subscription` | memberships | stripe_subscription_id | Webhook processing |
| `idx_features_key` | features | key | Feature lookup |
| `idx_tier_features_tier_id` | tier_features | tier_id | Get tier's features |
| `idx_tier_features_feature_id` | tier_features | feature_id | Feature analytics |
| `idx_payment_history_user` | payment_history | user_id | User's payment history |
| `idx_payment_history_status` | payment_history | status | Payment filtering |
| `idx_payment_history_created` | payment_history | created_at DESC | Recent payments |
| `idx_stripe_events_event_id` | stripe_webhook_events | stripe_event_id | Idempotency check |
| `idx_stripe_events_type` | stripe_webhook_events | event_type | Event type filtering |
| `idx_stripe_events_processed` | stripe_webhook_events | processed | Find unprocessed events |
| `idx_membership_audit_user` | membership_audit_log | user_id | User's audit history |
| `idx_membership_audit_created` | membership_audit_log | created_at DESC | Recent changes |
| `idx_usage_tracking_user` | usage_tracking | user_id | User's usage records |
| `idx_usage_tracking_feature` | usage_tracking | feature_key | Feature-based queries |
| `idx_usage_tracking_period_end` | usage_tracking | period_end (partial) | Find expiring periods |
| `idx_admin_users_user_id` | admin_users | user_id | Admin lookup |

---

## Stripe Integration

### Where Stripe IDs are Stored

| ID Type | Table | Column | Description |
|---------|-------|--------|-------------|
| Customer ID | `user_profiles` | `stripe_customer_id` | One per user (cus_xxx) |
| Subscription ID | `memberships` | `stripe_subscription_id` | Active subscription (sub_xxx) |
| Price ID | `memberships` | `stripe_price_id` | Current price being charged |
| Price IDs | `membership_tiers` | `stripe_price_id_monthly/yearly` | Prices for checkout |
| Product ID | `membership_tiers` | `stripe_product_id` | Stripe Product |

### Setup Stripe Products

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/products)
2. Create products for Premium and Pro tiers
3. Add monthly and yearly prices to each
4. Update database:

```sql
-- Update Premium tier with Stripe IDs
UPDATE membership_tiers SET
  stripe_product_id = 'prod_xxx',
  stripe_price_id_monthly = 'price_xxx_monthly',
  stripe_price_id_yearly = 'price_xxx_yearly'
WHERE name = 'premium';

-- Update Pro tier
UPDATE membership_tiers SET
  stripe_product_id = 'prod_yyy',
  stripe_price_id_monthly = 'price_yyy_monthly',
  stripe_price_id_yearly = 'price_yyy_yearly'
WHERE name = 'pro';
```

### Webhook Flow

```
Stripe Event → Backend /api/billing/webhook → Process Event → Update Database
```

1. User completes checkout → `checkout.session.completed`
2. Backend updates `memberships` table with new tier
3. Backend saves `stripe_customer_id` to `user_profiles`
4. Event logged to `stripe_webhook_events`

### Test Webhooks Locally

```bash
# Install Stripe CLI
stripe listen --forward-to localhost:3001/api/billing/webhook

# Test card: 4242 4242 4242 4242
```

---

## Feature Flag System

### Feature Types

| Type | Value Format | Example | Check Method |
|------|--------------|---------|--------------|
| `boolean` | `"true"` / `"false"` | AI Assistant enabled | `user_has_feature()` |
| `limit` | `"5"` / `"-1"` (unlimited) | 5 team members | `get_feature_limit()` |
| `enum` | `'["csv", "json"]'` | Export formats | Parse JSONB array |

### Checking Features in Code

```typescript
// Backend - Check if user has AI Assistant
const hasAI = await supabase.rpc('user_has_feature', {
  p_user_id: userId,
  p_feature_key: 'ai_assistant'
});

if (!hasAI) {
  throw new Error('Upgrade to Premium for AI features');
}

// Backend - Check storage limit
const storageLimit = await supabase.rpc('get_feature_limit', {
  p_user_id: userId,
  p_feature_key: 'cloud_storage'
});

if (storageLimit !== -1 && currentUsage >= storageLimit) {
  throw new Error('Storage limit reached');
}
```

### Adding New Features

1. Insert into `features` table:
```sql
INSERT INTO features (key, name, description, feature_type, default_value)
VALUES ('new_feature', 'New Feature', 'Description', 'boolean', 'false');
```

2. Configure for each tier:
```sql
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT
  mt.id,
  f.id,
  CASE mt.name
    WHEN 'trial' THEN '"true"'
    WHEN 'free' THEN '"false"'
    WHEN 'premium' THEN '"true"'
    WHEN 'pro' THEN '"true"'
  END::jsonb
FROM membership_tiers mt, features f
WHERE f.key = 'new_feature';
```

---

## Common SQL Queries

### Get User's Current Tier with Features

```sql
SELECT * FROM get_user_tier_with_features('user-uuid-here');
```

### Check if User Has Feature

```sql
SELECT user_has_feature('user-uuid', 'ai_assistant');
```

### Get Feature Limit

```sql
SELECT get_feature_limit('user-uuid', 'cloud_storage');
```

### List All Premium Users

```sql
SELECT * FROM user_membership_details
WHERE tier_name = 'premium' AND status = 'active';
```

### Get User's Payment History

```sql
SELECT * FROM payment_history
WHERE user_id = 'xxx'
ORDER BY created_at DESC;
```

### Get Tier Comparison for Pricing Page

```sql
SELECT * FROM tier_comparison ORDER BY sort_order;
```

### Find Users with Expiring Trials

```sql
SELECT up.email, m.trial_ends_at
FROM memberships m
JOIN user_profiles up ON up.id = m.user_id
WHERE m.status = 'trial'
AND m.trial_ends_at < NOW() + INTERVAL '3 days';
```

### Get Membership Changes for User

```sql
SELECT
  mal.action,
  old_tier.display_name as old_tier,
  new_tier.display_name as new_tier,
  mal.old_status,
  mal.new_status,
  mal.created_at
FROM membership_audit_log mal
LEFT JOIN membership_tiers old_tier ON old_tier.id = mal.old_tier_id
LEFT JOIN membership_tiers new_tier ON new_tier.id = mal.new_tier_id
WHERE mal.user_id = 'xxx'
ORDER BY mal.created_at DESC;
```

### Monthly Revenue Report

```sql
SELECT
  DATE_TRUNC('month', paid_at) as month,
  SUM(amount) as revenue,
  COUNT(*) as transactions
FROM payment_history
WHERE status = 'succeeded'
GROUP BY DATE_TRUNC('month', paid_at)
ORDER BY month DESC;
```

---

## Troubleshooting

### RLS Issues

**Problem:** "permission denied for table xxx"

**Solutions:**
1. Check you're using the correct API key (anon vs service_role)
2. Verify `auth.uid()` returns the expected user ID
3. Test with service role key to bypass RLS temporarily
4. Check policy conditions match your query

```sql
-- Debug: Check current user
SELECT auth.uid();

-- Debug: Check JWT claims
SELECT auth.jwt();
```

### Trigger Not Firing

**Problem:** Profile not created on signup

**Solutions:**
1. Check trigger exists:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
```

2. Check function exists:
```sql
SELECT * FROM pg_proc WHERE proname = 'handle_new_user';
```

3. Check Supabase logs for errors: **Dashboard > Logs > Postgres**

4. Manually test:
```sql
-- Simulate trigger (don't run in production!)
SELECT handle_new_user();
```

### Webhook Events Not Processing

**Problem:** Stripe webhooks failing

**Solutions:**
1. Check webhook signature in backend code
2. Verify `STRIPE_WEBHOOK_SECRET` is correct
3. Check `stripe_webhook_events` table for errors:
```sql
SELECT * FROM stripe_webhook_events
WHERE processed = false OR error_message IS NOT NULL
ORDER BY created_at DESC;
```

4. Test webhook locally:
```bash
stripe listen --forward-to localhost:3001/api/billing/webhook
stripe trigger checkout.session.completed
```

### Migration Failed

**Problem:** SQL script errors

**Solutions:**
1. Run script in smaller chunks
2. Check for existing objects:
```sql
-- Check if table exists
SELECT * FROM information_schema.tables WHERE table_name = 'user_profiles';

-- Drop and recreate if needed (WARNING: loses data!)
DROP TABLE IF EXISTS user_profiles CASCADE;
```

3. Check Supabase logs for detailed error messages

---

## Support

- **Supabase Docs:** https://supabase.com/docs
- **Stripe Docs:** https://stripe.com/docs
- **Project Issues:** Report bugs in the project repository
