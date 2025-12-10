-- ============================================
-- 004_seed.sql
-- Seed data for membership tiers, features, etc.
-- ============================================

-- ============================================
-- MEMBERSHIP TIERS
-- ============================================
INSERT INTO public.membership_tiers (name, display_name, description, price_monthly, price_yearly, trial_days, is_default, sort_order) VALUES
('trial', 'Trial', 'Try all Pro features free for 14 days. No credit card required.', 0, 0, 14, false, 1),
('free', 'Free', 'Perfect for getting started. Basic features to explore the platform.', 0, 0, 0, true, 2),
('premium', 'Premium', 'For growing teams who need more power and collaboration features.', 29.00, 290.00, 0, false, 3),
('pro', 'Pro', 'For professionals and businesses. Unlimited access with priority support.', 79.00, 790.00, 0, false, 4);

-- ============================================
-- FEATURES
-- ============================================
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
-- TIER FEATURES
-- ============================================
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
    (trial_tier_id, feat_team_collaboration, '10'),
    (trial_tier_id, feat_analytics_dashboard, 'true'),
    (trial_tier_id, feat_api_integrations, '100'),
    (trial_tier_id, feat_cloud_storage, '10000');

    -- FREE TIER FEATURES (Limited)
    INSERT INTO public.tier_features (tier_id, feature_id, value) VALUES
    (free_tier_id, feat_ai_assistant, 'false'),
    (free_tier_id, feat_team_collaboration, '1'),
    (free_tier_id, feat_analytics_dashboard, 'false'),
    (free_tier_id, feat_api_integrations, '0'),
    (free_tier_id, feat_cloud_storage, '500');

    -- PREMIUM TIER FEATURES (Growing teams)
    INSERT INTO public.tier_features (tier_id, feature_id, value) VALUES
    (premium_tier_id, feat_ai_assistant, 'true'),
    (premium_tier_id, feat_team_collaboration, '5'),
    (premium_tier_id, feat_analytics_dashboard, 'true'),
    (premium_tier_id, feat_api_integrations, '10'),
    (premium_tier_id, feat_cloud_storage, '5000');

    -- PRO TIER FEATURES (Unlimited)
    INSERT INTO public.tier_features (tier_id, feature_id, value) VALUES
    (pro_tier_id, feat_ai_assistant, 'true'),
    (pro_tier_id, feat_team_collaboration, '-1'),
    (pro_tier_id, feat_analytics_dashboard, 'true'),
    (pro_tier_id, feat_api_integrations, '-1'),
    (pro_tier_id, feat_cloud_storage, '50000');
END $$;

-- ============================================
-- DEMO STRIPE WEBHOOK EVENTS (for testing)
-- ============================================
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
