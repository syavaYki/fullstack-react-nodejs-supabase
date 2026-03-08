-- ============================================
-- 004_views.sql
-- User-facing and admin views
-- ============================================

-- User membership with tier details
CREATE OR REPLACE VIEW public.user_membership_details
WITH (security_invoker = true)
AS
SELECT
    m.id AS membership_id,
    m.user_id,
    up.email,
    up.first_name,
    up.last_name,
    up.full_name,
    up.stripe_customer_id,
    mt.id AS tier_id,
    mt.name AS tier_name,
    mt.display_name AS tier_display_name,
    mt.price_monthly,
    mt.price_yearly,
    m.status,
    m.billing_cycle,
    m.started_at,
    m.stripe_subscription_id,
    m.stripe_status,
    m.stripe_current_period_end,
    m.cancel_at_period_end,
    m.last_synced_at,
    m.sync_expires_at
FROM public.memberships m
JOIN public.user_profiles up ON up.id = m.user_id
JOIN public.membership_tiers mt ON mt.id = m.tier_id;

-- Tier comparison (for pricing page)
CREATE OR REPLACE VIEW public.tier_comparison
WITH (security_invoker = true)
AS
SELECT
    mt.id AS tier_id,
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
    ) AS features
FROM public.membership_tiers mt
LEFT JOIN public.tier_features tf ON tf.tier_id = mt.id
LEFT JOIN public.features f ON f.id = tf.feature_id
WHERE mt.is_active = true
GROUP BY mt.id, mt.name, mt.display_name, mt.description,
         mt.price_monthly, mt.price_yearly, mt.trial_days, mt.sort_order
ORDER BY mt.sort_order;

-- Admin: dashboard stats
CREATE OR REPLACE VIEW public.v_dashboard_stats AS
SELECT
    (SELECT COUNT(*) FROM public.user_profiles) AS total_users,
    (SELECT COUNT(*) FROM public.memberships WHERE status = 'active') AS active_memberships,
    (SELECT COUNT(*) FROM public.memberships WHERE stripe_status = 'trialing') AS trialing_users,
    (SELECT COUNT(*) FROM public.admin_users) AS admin_users,
    (SELECT jsonb_object_agg(mt.name, COALESCE(counts.user_count, 0))
     FROM public.membership_tiers mt
     LEFT JOIN (
         SELECT tier_id, COUNT(*) AS user_count
         FROM public.memberships WHERE status = 'active'
         GROUP BY tier_id
     ) counts ON mt.id = counts.tier_id
    ) AS users_by_tier,
    (SELECT COUNT(*) FROM public.features WHERE is_active = true) AS active_features,
    (SELECT COUNT(*) FROM public.user_profiles WHERE created_at > NOW() - INTERVAL '7 days') AS new_users_7d,
    (SELECT COUNT(*) FROM public.user_profiles WHERE created_at > NOW() - INTERVAL '30 days') AS new_users_30d,
    (SELECT COUNT(*) FROM public.contact_submissions WHERE status = 'new') AS pending_contacts,
    (SELECT COUNT(*) FROM public.stripe_webhook_events WHERE processed = false AND retry_count < 3) AS pending_webhooks;

-- tier_comparison is public pricing data; grant read to all roles
GRANT SELECT ON public.tier_comparison TO anon, authenticated;

REVOKE ALL ON public.v_dashboard_stats FROM anon, authenticated;
GRANT SELECT ON public.v_dashboard_stats TO service_role;
