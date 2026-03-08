-- ============================================
-- 005_seed_data.sql
-- Seed data: tiers, features, and assignments
-- Idempotent: uses ON CONFLICT DO UPDATE
--
-- ARCHITECTURE NOTE:
-- - free tier has NO Stripe prices (absence of subscription = free)
-- - Only premium and pro have Stripe price IDs
-- - Trials managed by Stripe (trial_period_days on price)
-- ============================================

-- ============================================
-- MEMBERSHIP TIERS
-- ============================================
INSERT INTO public.membership_tiers
    (name, display_name, description, price_monthly, price_yearly, trial_days, is_active, is_default, sort_order)
VALUES
    ('free', 'Free', 'Basic access with limited features. Perfect for getting started.', 0.00, 0.00, 0, true, true, 1),
    ('premium', 'Premium', 'Enhanced features for power users.', 29.00, 290.00, 7, true, false, 2),
    ('pro', 'Pro', 'Full access with unlimited features and priority support.', 79.00, 790.00, 7, true, false, 3);

-- ============================================
-- FEATURES
-- Customize these for your SaaS product
-- ============================================
INSERT INTO public.features (key, name, description, feature_type, default_value, is_active, status, sort_order) VALUES
    ('example_boolean', 'Example Boolean Feature',
     'An example boolean feature that is either on or off per tier.',
     'boolean', 'false', true, 'active', 10),
    ('example_limit', 'Example Limit Feature',
     'An example limit feature with usage tracking per tier.',
     'limit', '5', true, 'active', 20),
    ('priority_support', 'Priority Support',
     'Get faster response times from our support team.',
     'boolean', 'false', true, 'active', 30)
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description,
    feature_type = EXCLUDED.feature_type, default_value = EXCLUDED.default_value,
    is_active = EXCLUDED.is_active, status = EXCLUDED.status, sort_order = EXCLUDED.sort_order;

-- ============================================
-- TIER FEATURE ASSIGNMENTS
-- Values: boolean = 'true'/'false', limit = integer string (-1 = unlimited)
-- ============================================
DO $$
DECLARE
    tier1_id UUID;
    tier2_id UUID;
    tier3_id UUID;
BEGIN
    SELECT id INTO tier1_id FROM public.membership_tiers WHERE name = 'free';
    SELECT id INTO tier2_id FROM public.membership_tiers WHERE name = 'premium';
    SELECT id INTO tier3_id FROM public.membership_tiers WHERE name = 'pro';

    IF tier1_id IS NULL THEN RAISE EXCEPTION 'free tier not found'; END IF;
    IF tier2_id IS NULL THEN RAISE EXCEPTION 'premium tier not found'; END IF;
    IF tier3_id IS NULL THEN RAISE EXCEPTION 'pro tier not found'; END IF;

    -- example_boolean: free=false, premium=true, pro=true
    INSERT INTO public.tier_features (tier_id, feature_id, value)
        SELECT tier1_id, id, 'false' FROM public.features WHERE key = 'example_boolean'
        ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value;
    INSERT INTO public.tier_features (tier_id, feature_id, value)
        SELECT tier2_id, id, 'true'  FROM public.features WHERE key = 'example_boolean'
        ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value;
    INSERT INTO public.tier_features (tier_id, feature_id, value)
        SELECT tier3_id, id, 'true'  FROM public.features WHERE key = 'example_boolean'
        ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value;

    -- example_limit: free=5, premium=50, pro=-1 (unlimited)
    INSERT INTO public.tier_features (tier_id, feature_id, value)
        SELECT tier1_id, id, '5'  FROM public.features WHERE key = 'example_limit'
        ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value;
    INSERT INTO public.tier_features (tier_id, feature_id, value)
        SELECT tier2_id, id, '50' FROM public.features WHERE key = 'example_limit'
        ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value;
    INSERT INTO public.tier_features (tier_id, feature_id, value)
        SELECT tier3_id, id, '-1' FROM public.features WHERE key = 'example_limit'
        ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value;

    -- priority_support: free=false, premium=false, pro=true
    INSERT INTO public.tier_features (tier_id, feature_id, value)
        SELECT tier1_id, id, 'false' FROM public.features WHERE key = 'priority_support'
        ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value;
    INSERT INTO public.tier_features (tier_id, feature_id, value)
        SELECT tier2_id, id, 'false' FROM public.features WHERE key = 'priority_support'
        ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value;
    INSERT INTO public.tier_features (tier_id, feature_id, value)
        SELECT tier3_id, id, 'true'  FROM public.features WHERE key = 'priority_support'
        ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value;

    RAISE NOTICE 'Seed data complete: 3 tiers, 3 features, all tier assignments configured';
END $$;
