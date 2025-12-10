-- ============================================
-- 001_tables.sql
-- All table definitions, enums, and indexes
-- ============================================

-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE membership_status AS ENUM ('active', 'cancelled', 'expired', 'trial', 'past_due');
CREATE TYPE billing_cycle AS ENUM ('monthly', 'yearly');

-- ============================================
-- USER PROFILES
-- Extended user data + Stripe customer ID
-- ============================================
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    full_name TEXT GENERATED ALWAYS AS (
        TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
    ) STORED,
    avatar_url TEXT,
    phone TEXT,
    company TEXT,
    bio TEXT,
    website TEXT,
    stripe_customer_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX idx_user_profiles_stripe_customer ON public.user_profiles(stripe_customer_id);

-- ============================================
-- MEMBERSHIP TIERS
-- Plan definitions: Trial, Free, Premium, Pro
-- ============================================
CREATE TABLE public.membership_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10,2) DEFAULT 0,
    price_yearly DECIMAL(10,2) DEFAULT 0,
    stripe_price_id_monthly TEXT,
    stripe_price_id_yearly TEXT,
    stripe_product_id TEXT,
    trial_days INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- MEMBERSHIPS
-- User's active subscription status
-- ============================================
CREATE TABLE public.memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    tier_id UUID NOT NULL REFERENCES public.membership_tiers(id),
    status membership_status DEFAULT 'active' NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,
    trial_starts_at TIMESTAMPTZ,
    trial_ends_at TIMESTAMPTZ,
    has_used_trial BOOLEAN DEFAULT false,
    billing_cycle billing_cycle,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    stripe_subscription_id TEXT UNIQUE,
    stripe_price_id TEXT,
    stripe_latest_invoice_id TEXT,
    stripe_latest_invoice_status TEXT,
    last_payment_at TIMESTAMPTZ,
    last_payment_amount DECIMAL(10,2),
    last_payment_currency TEXT DEFAULT 'usd',
    next_billing_date TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT unique_user_membership UNIQUE (user_id)
);

CREATE INDEX idx_memberships_user_id ON public.memberships(user_id);
CREATE INDEX idx_memberships_tier_id ON public.memberships(tier_id);
CREATE INDEX idx_memberships_status ON public.memberships(status);
CREATE INDEX idx_memberships_stripe_subscription ON public.memberships(stripe_subscription_id);

-- ============================================
-- FEATURES
-- Feature definitions for the platform
-- ============================================
CREATE TABLE public.features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    feature_type TEXT NOT NULL CHECK (feature_type IN ('boolean', 'limit', 'enum')),
    default_value JSONB DEFAULT 'false'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_features_key ON public.features(key);

-- ============================================
-- TIER FEATURES (Join Table)
-- Which features each tier includes
-- ============================================
CREATE TABLE public.tier_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_id UUID NOT NULL REFERENCES public.membership_tiers(id) ON DELETE CASCADE,
    feature_id UUID NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT unique_tier_feature UNIQUE (tier_id, feature_id)
);

CREATE INDEX idx_tier_features_tier_id ON public.tier_features(tier_id);
CREATE INDEX idx_tier_features_feature_id ON public.tier_features(feature_id);

-- ============================================
-- PAYMENT HISTORY
-- ============================================
CREATE TABLE public.payment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    membership_id UUID REFERENCES public.memberships(id) ON DELETE SET NULL,
    stripe_payment_intent_id TEXT UNIQUE,
    stripe_invoice_id TEXT,
    stripe_charge_id TEXT,
    stripe_subscription_id TEXT,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'usd',
    status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded')),
    invoice_url TEXT,
    receipt_url TEXT,
    invoice_pdf TEXT,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    failure_reason TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_payment_history_user ON public.payment_history(user_id);
CREATE INDEX idx_payment_history_status ON public.payment_history(status);
CREATE INDEX idx_payment_history_created ON public.payment_history(created_at DESC);

-- ============================================
-- STRIPE WEBHOOK EVENTS LOG
-- ============================================
CREATE TABLE public.stripe_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_stripe_events_event_id ON public.stripe_webhook_events(stripe_event_id);
CREATE INDEX idx_stripe_events_type ON public.stripe_webhook_events(event_type);
CREATE INDEX idx_stripe_events_processed ON public.stripe_webhook_events(processed);

-- ============================================
-- USAGE TRACKING
-- Track feature usage for enforcement
-- ============================================
CREATE TABLE public.usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,
    current_usage INTEGER DEFAULT 0,
    usage_limit INTEGER DEFAULT 0,
    period_start TIMESTAMPTZ DEFAULT NOW(),
    period_end TIMESTAMPTZ,
    period_type TEXT CHECK (period_type IN ('daily', 'monthly', 'lifetime', 'none')),
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT unique_user_feature_usage UNIQUE (user_id, feature_key)
);

CREATE INDEX idx_usage_tracking_user ON public.usage_tracking(user_id);
CREATE INDEX idx_usage_tracking_feature ON public.usage_tracking(feature_key);
CREATE INDEX idx_usage_tracking_period_end ON public.usage_tracking(period_end) WHERE period_end IS NOT NULL;

-- ============================================
-- ADMIN USERS
-- Track users with admin privileges
-- ============================================
CREATE TABLE public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES public.user_profiles(id)
);

CREATE INDEX idx_admin_users_user_id ON public.admin_users(user_id);

-- ============================================
-- MEMBERSHIP AUDIT LOG
-- Track membership changes
-- ============================================
CREATE TABLE public.membership_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    membership_id UUID NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    old_tier_id UUID REFERENCES public.membership_tiers(id),
    new_tier_id UUID REFERENCES public.membership_tiers(id),
    old_status membership_status,
    new_status membership_status,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_membership_audit_user ON public.membership_audit_log(user_id);
CREATE INDEX idx_membership_audit_membership ON public.membership_audit_log(membership_id);
CREATE INDEX idx_membership_audit_created ON public.membership_audit_log(created_at DESC);

-- ============================================
-- CONTACT SUBMISSIONS
-- Store contact form submissions
-- ============================================
CREATE TABLE public.contact_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'archived')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_contact_submissions_email ON public.contact_submissions(email);
CREATE INDEX idx_contact_submissions_status ON public.contact_submissions(status);
CREATE INDEX idx_contact_submissions_created ON public.contact_submissions(created_at DESC);
