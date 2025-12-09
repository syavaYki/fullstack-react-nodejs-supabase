-- ============================================
-- FULLSTACK SAAS - DATABASE SETUP
-- Run this entire script in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. ENUMS
-- ============================================
CREATE TYPE membership_status AS ENUM ('active', 'cancelled', 'expired', 'trial', 'past_due');
CREATE TYPE billing_cycle AS ENUM ('monthly', 'yearly');

-- ============================================
-- 2. USER PROFILES TABLE
-- Extended user data + Stripe customer ID
-- NOTE: Populated automatically when users sign up via Supabase Auth
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

    -- Stripe customer ID (one per user)
    stripe_customer_id TEXT UNIQUE,

    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX idx_user_profiles_stripe_customer ON public.user_profiles(stripe_customer_id);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_profile_updated
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- 3. MEMBERSHIP TIERS TABLE
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

CREATE TRIGGER on_tier_updated
    BEFORE UPDATE ON public.membership_tiers
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Seed membership tiers: Trial, Free, Premium, Pro
INSERT INTO public.membership_tiers (name, display_name, description, price_monthly, price_yearly, trial_days, is_default, sort_order) VALUES
('trial', 'Trial', 'Try all Pro features free for 14 days. No credit card required.', 0, 0, 14, false, 1),
('free', 'Free', 'Perfect for getting started. Basic features to explore the platform.', 0, 0, 0, true, 2),
('premium', 'Premium', 'For growing teams who need more power and collaboration features.', 29.00, 290.00, 0, false, 3),
('pro', 'Pro', 'For professionals and businesses. Unlimited access with priority support.', 79.00, 790.00, 0, false, 4);

-- ============================================
-- 4. MEMBERSHIPS TABLE
-- User's active subscription status
-- ============================================
CREATE TABLE public.memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    tier_id UUID NOT NULL REFERENCES public.membership_tiers(id),
    status membership_status DEFAULT 'active' NOT NULL,

    -- Subscription timing
    started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,

    -- Trial management
    trial_starts_at TIMESTAMPTZ,
    trial_ends_at TIMESTAMPTZ,
    has_used_trial BOOLEAN DEFAULT false,

    -- Billing
    billing_cycle billing_cycle,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,

    -- Stripe subscription data
    stripe_subscription_id TEXT UNIQUE,
    stripe_price_id TEXT,
    stripe_latest_invoice_id TEXT,
    stripe_latest_invoice_status TEXT,

    -- Payment tracking
    last_payment_at TIMESTAMPTZ,
    last_payment_amount DECIMAL(10,2),
    last_payment_currency TEXT DEFAULT 'usd',
    next_billing_date TIMESTAMPTZ,

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- One membership per user
    CONSTRAINT unique_user_membership UNIQUE (user_id)
);

-- Indexes
CREATE INDEX idx_memberships_user_id ON public.memberships(user_id);
CREATE INDEX idx_memberships_tier_id ON public.memberships(tier_id);
CREATE INDEX idx_memberships_status ON public.memberships(status);
CREATE INDEX idx_memberships_stripe_subscription ON public.memberships(stripe_subscription_id);

CREATE TRIGGER on_membership_updated
    BEFORE UPDATE ON public.memberships
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- 5. FEATURES TABLE
-- 5 Popular SaaS Feature Definitions
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

-- Seed 5 popular SaaS features
INSERT INTO public.features (key, name, description, feature_type, default_value) VALUES
(
    'ai_assistant',
    'AI Assistant',
    'Access to AI-powered assistant for smart suggestions, content generation, and automated workflows. Includes GPT-4 integration for natural language processing and intelligent recommendations.',
    'boolean',
    'false'
),
(
    'team_collaboration',
    'Team Collaboration',
    'Real-time collaboration features including shared workspaces, live editing, comments, mentions, and team chat. Perfect for distributed teams working together on projects.',
    'limit',
    '1'
),
(
    'analytics_dashboard',
    'Analytics Dashboard',
    'Comprehensive analytics with real-time metrics, custom reports, data visualization, conversion tracking, and exportable insights. Make data-driven decisions with powerful analytics.',
    'boolean',
    'false'
),
(
    'api_integrations',
    'API & Integrations',
    'Connect with 100+ popular tools including Slack, Zapier, Salesforce, HubSpot, and Google Workspace. Full REST API access with webhooks for custom integrations.',
    'limit',
    '0'
),
(
    'cloud_storage',
    'Cloud Storage',
    'Secure cloud storage for files, documents, and media. Includes automatic backups, version history, file sharing, and CDN delivery for fast global access.',
    'limit',
    '100'
);

-- ============================================
-- 6. TIER FEATURES TABLE (Join Table)
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

-- Seed tier features for all 4 tiers
DO $$
DECLARE
    trial_tier_id UUID;
    free_tier_id UUID;
    premium_tier_id UUID;
    pro_tier_id UUID;
    feat_ai_assistant UUID;
    feat_team_collaboration UUID;
    feat_analytics_dashboard UUID;
    feat_api_integrations UUID;
    feat_cloud_storage UUID;
BEGIN
    -- Get tier IDs
    SELECT id INTO trial_tier_id FROM public.membership_tiers WHERE name = 'trial';
    SELECT id INTO free_tier_id FROM public.membership_tiers WHERE name = 'free';
    SELECT id INTO premium_tier_id FROM public.membership_tiers WHERE name = 'premium';
    SELECT id INTO pro_tier_id FROM public.membership_tiers WHERE name = 'pro';

    -- Get feature IDs
    SELECT id INTO feat_ai_assistant FROM public.features WHERE key = 'ai_assistant';
    SELECT id INTO feat_team_collaboration FROM public.features WHERE key = 'team_collaboration';
    SELECT id INTO feat_analytics_dashboard FROM public.features WHERE key = 'analytics_dashboard';
    SELECT id INTO feat_api_integrations FROM public.features WHERE key = 'api_integrations';
    SELECT id INTO feat_cloud_storage FROM public.features WHERE key = 'cloud_storage';

    -- TRIAL TIER FEATURES (Full Pro access for 14 days)
    INSERT INTO public.tier_features (tier_id, feature_id, value) VALUES
    (trial_tier_id, feat_ai_assistant, 'true'),
    (trial_tier_id, feat_team_collaboration, '10'),        -- 10 team members
    (trial_tier_id, feat_analytics_dashboard, 'true'),
    (trial_tier_id, feat_api_integrations, '100'),         -- 100 integrations
    (trial_tier_id, feat_cloud_storage, '10000');          -- 10 GB

    -- FREE TIER FEATURES (Limited)
    INSERT INTO public.tier_features (tier_id, feature_id, value) VALUES
    (free_tier_id, feat_ai_assistant, 'false'),
    (free_tier_id, feat_team_collaboration, '1'),          -- Solo only
    (free_tier_id, feat_analytics_dashboard, 'false'),
    (free_tier_id, feat_api_integrations, '0'),            -- No integrations
    (free_tier_id, feat_cloud_storage, '500');             -- 500 MB

    -- PREMIUM TIER FEATURES (Growing teams)
    INSERT INTO public.tier_features (tier_id, feature_id, value) VALUES
    (premium_tier_id, feat_ai_assistant, 'true'),
    (premium_tier_id, feat_team_collaboration, '5'),       -- 5 team members
    (premium_tier_id, feat_analytics_dashboard, 'true'),
    (premium_tier_id, feat_api_integrations, '10'),        -- 10 integrations
    (premium_tier_id, feat_cloud_storage, '5000');         -- 5 GB

    -- PRO TIER FEATURES (Unlimited)
    INSERT INTO public.tier_features (tier_id, feature_id, value) VALUES
    (pro_tier_id, feat_ai_assistant, 'true'),
    (pro_tier_id, feat_team_collaboration, '-1'),          -- Unlimited
    (pro_tier_id, feat_analytics_dashboard, 'true'),
    (pro_tier_id, feat_api_integrations, '-1'),            -- Unlimited
    (pro_tier_id, feat_cloud_storage, '50000');            -- 50 GB
END $$;

-- ============================================
-- 7. PAYMENT HISTORY TABLE
-- ============================================
CREATE TABLE public.payment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    membership_id UUID REFERENCES public.memberships(id) ON DELETE SET NULL,

    -- Stripe identifiers
    stripe_payment_intent_id TEXT UNIQUE,
    stripe_invoice_id TEXT,
    stripe_charge_id TEXT,
    stripe_subscription_id TEXT,

    -- Payment details
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'usd',
    status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded')),

    -- Invoice/receipt
    invoice_url TEXT,
    receipt_url TEXT,
    invoice_pdf TEXT,

    -- Metadata
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    failure_reason TEXT,

    -- Timestamps
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_payment_history_user ON public.payment_history(user_id);
CREATE INDEX idx_payment_history_status ON public.payment_history(status);
CREATE INDEX idx_payment_history_created ON public.payment_history(created_at DESC);

-- ============================================
-- 8. STRIPE WEBHOOK EVENTS LOG
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

-- Seed dummy webhook events (example events for testing)
INSERT INTO public.stripe_webhook_events (stripe_event_id, event_type, payload, processed, processed_at) VALUES
(
    'evt_demo_checkout_completed_001',
    'checkout.session.completed',
    '{"id": "cs_demo_001", "object": "checkout.session", "customer": "cus_demo_001", "subscription": "sub_demo_001", "mode": "subscription", "payment_status": "paid", "amount_total": 2900}',
    true,
    NOW() - INTERVAL '5 days'
),
(
    'evt_demo_subscription_created_001',
    'customer.subscription.created',
    '{"id": "sub_demo_001", "object": "subscription", "customer": "cus_demo_001", "status": "active", "current_period_start": 1699488000, "current_period_end": 1702166400}',
    true,
    NOW() - INTERVAL '5 days'
),
(
    'evt_demo_invoice_paid_001',
    'invoice.paid',
    '{"id": "in_demo_001", "object": "invoice", "customer": "cus_demo_001", "subscription": "sub_demo_001", "amount_paid": 2900, "currency": "usd", "status": "paid"}',
    true,
    NOW() - INTERVAL '4 days'
),
(
    'evt_demo_subscription_updated_001',
    'customer.subscription.updated',
    '{"id": "sub_demo_002", "object": "subscription", "customer": "cus_demo_002", "status": "active", "plan": {"id": "price_pro_monthly"}, "cancel_at_period_end": false}',
    true,
    NOW() - INTERVAL '2 days'
),
(
    'evt_demo_payment_failed_001',
    'invoice.payment_failed',
    '{"id": "in_demo_failed_001", "object": "invoice", "customer": "cus_demo_003", "subscription": "sub_demo_003", "amount_due": 7900, "currency": "usd", "attempt_count": 1}',
    true,
    NOW() - INTERVAL '1 day'
);

-- ============================================
-- 9. USAGE TRACKING TABLE
-- Track feature usage for enforcement
-- ============================================
CREATE TABLE public.usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,

    -- Usage counters
    current_usage INTEGER DEFAULT 0,
    usage_limit INTEGER DEFAULT 0,  -- -1 = unlimited

    -- Period tracking (for resettable limits)
    period_start TIMESTAMPTZ DEFAULT NOW(),
    period_end TIMESTAMPTZ,
    period_type TEXT CHECK (period_type IN ('daily', 'monthly', 'lifetime', 'none')),

    -- Timestamps
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    CONSTRAINT unique_user_feature_usage UNIQUE (user_id, feature_key)
);

CREATE INDEX idx_usage_tracking_user ON public.usage_tracking(user_id);
CREATE INDEX idx_usage_tracking_feature ON public.usage_tracking(feature_key);
CREATE INDEX idx_usage_tracking_period_end ON public.usage_tracking(period_end) WHERE period_end IS NOT NULL;

CREATE TRIGGER on_usage_tracking_updated
    BEFORE UPDATE ON public.usage_tracking
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- 10. ADMIN USERS TABLE
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
-- 11. MEMBERSHIP AUDIT LOG
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

-- Trigger to log membership changes
CREATE OR REPLACE FUNCTION public.log_membership_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD.tier_id != NEW.tier_id OR OLD.status != NEW.status THEN
            INSERT INTO public.membership_audit_log (
                membership_id, user_id, action,
                old_tier_id, new_tier_id,
                old_status, new_status,
                metadata
            ) VALUES (
                NEW.id, NEW.user_id,
                CASE
                    WHEN OLD.tier_id != NEW.tier_id THEN 'tier_changed'
                    ELSE 'status_changed'
                END,
                OLD.tier_id, NEW.tier_id,
                OLD.status, NEW.status,
                jsonb_build_object(
                    'old_billing_cycle', OLD.billing_cycle,
                    'new_billing_cycle', NEW.billing_cycle
                )
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_membership_changed
    AFTER UPDATE ON public.memberships
    FOR EACH ROW
    EXECUTE FUNCTION public.log_membership_change();

-- ============================================
-- 12. AUTO-CREATE PROFILE & MEMBERSHIP ON SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_tier_id UUID;
BEGIN
    -- Get the default (free) tier
    SELECT id INTO default_tier_id FROM public.membership_tiers WHERE is_default = true LIMIT 1;

    -- Create user profile
    -- Note: full_name is a computed column (first_name + last_name)
    INSERT INTO public.user_profiles (id, email, first_name, last_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
    );

    -- Create free membership
    INSERT INTO public.memberships (user_id, tier_id, status)
    VALUES (NEW.id, default_tier_id, 'active');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 13. HELPER FUNCTIONS
-- ============================================

-- Get user's current tier with all features
CREATE OR REPLACE FUNCTION public.get_user_tier_with_features(p_user_id UUID)
RETURNS TABLE (
    tier_id UUID,
    tier_name TEXT,
    tier_display_name TEXT,
    membership_status membership_status,
    features JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        mt.id,
        mt.name,
        mt.display_name,
        m.status,
        COALESCE(
            jsonb_object_agg(f.key, tf.value),
            '{}'::jsonb
        ) as features
    FROM public.memberships m
    JOIN public.membership_tiers mt ON mt.id = m.tier_id
    LEFT JOIN public.tier_features tf ON tf.tier_id = mt.id
    LEFT JOIN public.features f ON f.id = tf.feature_id
    WHERE m.user_id = p_user_id
    GROUP BY mt.id, mt.name, mt.display_name, m.status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user has a specific feature (boolean)
CREATE OR REPLACE FUNCTION public.user_has_feature(p_user_id UUID, p_feature_key TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    feature_val JSONB;
BEGIN
    SELECT tf.value INTO feature_val
    FROM public.memberships m
    JOIN public.tier_features tf ON tf.tier_id = m.tier_id
    JOIN public.features f ON f.id = tf.feature_id
    WHERE m.user_id = p_user_id
      AND f.key = p_feature_key
      AND m.status IN ('active', 'trial');

    IF feature_val IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Handle boolean values
    IF feature_val = 'true'::jsonb THEN
        RETURN TRUE;
    ELSIF feature_val = 'false'::jsonb THEN
        RETURN FALSE;
    END IF;

    -- For numeric limits, return true if > 0 or = -1 (unlimited)
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get feature limit value for user
CREATE OR REPLACE FUNCTION public.get_feature_limit(p_user_id UUID, p_feature_key TEXT)
RETURNS INTEGER AS $$
DECLARE
    feature_val JSONB;
BEGIN
    SELECT tf.value INTO feature_val
    FROM public.memberships m
    JOIN public.tier_features tf ON tf.tier_id = m.tier_id
    JOIN public.features f ON f.id = tf.feature_id
    WHERE m.user_id = p_user_id
      AND f.key = p_feature_key
      AND m.status IN ('active', 'trial');

    IF feature_val IS NULL THEN
        RETURN 0;
    END IF;

    RETURN (feature_val #>> '{}')::INTEGER;
EXCEPTION WHEN OTHERS THEN
    RETURN 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get all features for a tier
CREATE OR REPLACE FUNCTION public.get_tier_features(p_tier_id UUID)
RETURNS TABLE (
    feature_key TEXT,
    feature_name TEXT,
    feature_type TEXT,
    value JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        f.key,
        f.name,
        f.feature_type,
        tf.value
    FROM public.tier_features tf
    JOIN public.features f ON f.id = tf.feature_id
    WHERE tf.tier_id = p_tier_id
    ORDER BY f.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 14. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tier_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- USER PROFILES POLICIES
CREATE POLICY "Users can view own profile"
    ON public.user_profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete own profile"
    ON public.user_profiles FOR DELETE
    USING (auth.uid() = id);

-- MEMBERSHIP TIERS POLICIES (Public read for pricing pages)
CREATE POLICY "Anyone can view active tiers"
    ON public.membership_tiers FOR SELECT
    USING (is_active = true);

-- MEMBERSHIPS POLICIES
CREATE POLICY "Users can view own membership"
    ON public.memberships FOR SELECT
    USING (auth.uid() = user_id);

-- FEATURES POLICIES (Public read)
CREATE POLICY "Authenticated users can view features"
    ON public.features FOR SELECT
    TO authenticated
    USING (is_active = true);

-- TIER FEATURES POLICIES (Public read)
CREATE POLICY "Authenticated users can view tier features"
    ON public.tier_features FOR SELECT
    TO authenticated
    USING (true);

-- PAYMENT HISTORY POLICIES
CREATE POLICY "Users can view own payments"
    ON public.payment_history FOR SELECT
    USING (auth.uid() = user_id);

-- MEMBERSHIP AUDIT LOG POLICIES
CREATE POLICY "Users can view own audit log"
    ON public.membership_audit_log FOR SELECT
    USING (auth.uid() = user_id);

-- SERVICE ROLE POLICIES (for backend/webhooks)
CREATE POLICY "Service role full access to profiles"
    ON public.user_profiles FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access to tiers"
    ON public.membership_tiers FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access to memberships"
    ON public.memberships FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access to features"
    ON public.features FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access to tier_features"
    ON public.tier_features FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access to payments"
    ON public.payment_history FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access to webhook events"
    ON public.stripe_webhook_events FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access to audit log"
    ON public.membership_audit_log FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access to usage_tracking"
    ON public.usage_tracking FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access to admin_users"
    ON public.admin_users FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- USAGE TRACKING POLICIES
CREATE POLICY "Users can view own usage"
    ON public.usage_tracking FOR SELECT
    USING (auth.uid() = user_id);

-- ADMIN USERS POLICIES
CREATE POLICY "Admins can view admin_users"
    ON public.admin_users FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ============================================
-- 15. VIEWS
-- ============================================

-- User membership with full details
-- security_invoker = true ensures the view respects RLS policies of underlying tables
CREATE OR REPLACE VIEW public.user_membership_details
WITH (security_invoker = true)
AS
SELECT
    m.id as membership_id,
    m.user_id,
    up.email,
    up.first_name,
    up.last_name,
    up.full_name,
    up.stripe_customer_id,
    mt.id as tier_id,
    mt.name as tier_name,
    mt.display_name as tier_display_name,
    mt.price_monthly,
    mt.price_yearly,
    m.status,
    m.billing_cycle,
    m.started_at,
    m.expires_at,
    m.current_period_start,
    m.current_period_end,
    m.stripe_subscription_id,
    m.cancel_at_period_end
FROM public.memberships m
JOIN public.user_profiles up ON up.id = m.user_id
JOIN public.membership_tiers mt ON mt.id = m.tier_id;

-- Tier comparison view (for pricing page)
CREATE OR REPLACE VIEW public.tier_comparison AS
SELECT
    mt.id as tier_id,
    mt.name,
    mt.display_name,
    mt.description,
    mt.price_monthly,
    mt.price_yearly,
    mt.trial_days,
    mt.sort_order,
    COALESCE(
        jsonb_object_agg(f.key, jsonb_build_object('name', f.name, 'value', tf.value, 'type', f.feature_type)),
        '{}'::jsonb
    ) as features
FROM public.membership_tiers mt
LEFT JOIN public.tier_features tf ON tf.tier_id = mt.id
LEFT JOIN public.features f ON f.id = tf.feature_id
WHERE mt.is_active = true
GROUP BY mt.id, mt.name, mt.display_name, mt.description, mt.price_monthly, mt.price_yearly, mt.trial_days, mt.sort_order
ORDER BY mt.sort_order;

-- ============================================
-- SETUP COMPLETE!
-- ============================================
--
-- TABLES CREATED:
--   - user_profiles (with stripe_customer_id)
--   - membership_tiers (Trial, Free, Premium, Pro)
--   - memberships
--   - features (5 popular SaaS features)
--   - tier_features (join table)
--   - payment_history
--   - stripe_webhook_events (with dummy data)
--   - usage_tracking (feature usage enforcement)
--   - admin_users (admin role management)
--   - membership_audit_log
--
-- MEMBERSHIP TIERS:
--   1. Trial    - $0  (14-day trial with Pro features)
--   2. Free     - $0  (Limited features)
--   3. Premium  - $29/mo (Growing teams)
--   4. Pro      - $79/mo (Unlimited)
--
-- FEATURES:
--   1. AI Assistant - GPT-4 powered suggestions
--   2. Team Collaboration - Real-time collaboration
--   3. Analytics Dashboard - Data visualization
--   4. API & Integrations - 100+ integrations
--   5. Cloud Storage - Secure file storage
--
-- TRIGGERS:
--   - on_auth_user_created: Auto-create profile + free membership
--   - on_profile_updated: Update timestamp
--   - on_membership_changed: Audit log
--   - on_usage_tracking_updated: Update timestamp
--
-- HELPER FUNCTIONS:
--   - get_user_tier_with_features(user_id)
--   - user_has_feature(user_id, feature_key)
--   - get_feature_limit(user_id, feature_key)
--   - get_tier_features(tier_id)
--
-- NOTE: user_profiles table is populated automatically when
-- users sign up through Supabase Auth. Create test users
-- manually in Supabase Dashboard > Authentication > Users
-- ============================================
