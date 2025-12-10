-- ============================================
-- 002_functions.sql
-- All functions, triggers, and views
-- ============================================

-- ============================================
-- UTILITY FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS - Updated At
-- ============================================
CREATE TRIGGER on_profile_updated
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_tier_updated
    BEFORE UPDATE ON public.membership_tiers
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_membership_updated
    BEFORE UPDATE ON public.memberships
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_usage_tracking_updated
    BEFORE UPDATE ON public.usage_tracking
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- MEMBERSHIP AUDIT LOGGING
-- ============================================
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
-- AUTO-CREATE PROFILE & MEMBERSHIP ON SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_tier_id UUID;
BEGIN
    SELECT id INTO default_tier_id FROM public.membership_tiers WHERE is_default = true LIMIT 1;

    INSERT INTO public.user_profiles (id, email, first_name, last_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
    );

    INSERT INTO public.memberships (user_id, tier_id, status)
    VALUES (NEW.id, default_tier_id, 'active');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- HELPER FUNCTIONS - User Features
-- ============================================

-- Get user's current tier with all features
CREATE OR REPLACE FUNCTION public.get_user_tier_with_features(p_user_id UUID)
RETURNS TABLE (
    tier_id UUID,
    tier_name TEXT,
    tier_display_name TEXT,
    membership_status membership_status,
    trial_ends_at TIMESTAMPTZ,
    features JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        mt.id,
        mt.name,
        mt.display_name,
        m.status,
        m.trial_ends_at,
        COALESCE(
            jsonb_object_agg(f.key, tf.value),
            '{}'::jsonb
        ) as features
    FROM public.memberships m
    JOIN public.membership_tiers mt ON mt.id = m.tier_id
    LEFT JOIN public.tier_features tf ON tf.tier_id = mt.id
    LEFT JOIN public.features f ON f.id = tf.feature_id
    WHERE m.user_id = p_user_id
    GROUP BY mt.id, mt.name, mt.display_name, m.status, m.trial_ends_at;
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

    IF feature_val = 'true'::jsonb THEN
        RETURN TRUE;
    ELSIF feature_val = 'false'::jsonb THEN
        RETURN FALSE;
    END IF;

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
-- ATOMIC USAGE TRACKING FUNCTIONS
-- ============================================

-- Atomically increment usage for a feature
CREATE OR REPLACE FUNCTION increment_usage(
    p_user_id UUID,
    p_feature_key TEXT,
    p_amount INTEGER DEFAULT 1
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    feature_key TEXT,
    current_usage INTEGER,
    usage_limit INTEGER,
    period_type TEXT,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    is_exceeded BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    UPDATE usage_tracking ut
    SET
        current_usage = ut.current_usage + p_amount,
        last_used_at = NOW()
    WHERE ut.user_id = p_user_id
      AND ut.feature_key = p_feature_key
    RETURNING
        ut.id,
        ut.user_id,
        ut.feature_key,
        ut.current_usage,
        ut.usage_limit,
        ut.period_type,
        ut.period_start,
        ut.period_end,
        ut.last_used_at,
        CASE
            WHEN ut.usage_limit = -1 THEN FALSE
            ELSE ut.current_usage > ut.usage_limit
        END as is_exceeded;
END;
$$ LANGUAGE plpgsql;

-- Atomically reset usage period if expired
CREATE OR REPLACE FUNCTION reset_usage_if_expired(
    p_user_id UUID,
    p_feature_key TEXT
)
RETURNS TABLE (
    was_reset BOOLEAN,
    current_usage INTEGER,
    period_end TIMESTAMPTZ
) AS $$
DECLARE
    v_record usage_tracking%ROWTYPE;
    v_new_period_end TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_record
    FROM usage_tracking
    WHERE user_id = p_user_id AND feature_key = p_feature_key
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    IF v_record.period_end IS NULL
       OR v_record.period_type IN ('lifetime', 'none')
       OR NOW() <= v_record.period_end THEN
        RETURN QUERY SELECT FALSE, v_record.current_usage, v_record.period_end;
        RETURN;
    END IF;

    IF v_record.period_type = 'daily' THEN
        v_new_period_end := DATE_TRUNC('day', NOW()) + INTERVAL '1 day' - INTERVAL '1 millisecond';
    ELSIF v_record.period_type = 'monthly' THEN
        v_new_period_end := DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 millisecond';
    ELSE
        v_new_period_end := v_record.period_end;
    END IF;

    UPDATE usage_tracking
    SET
        current_usage = 0,
        period_start = NOW(),
        period_end = v_new_period_end
    WHERE id = v_record.id;

    RETURN QUERY SELECT TRUE, 0, v_new_period_end;
END;
$$ LANGUAGE plpgsql;

-- Combined atomic operation: check period, reset if needed, then increment
CREATE OR REPLACE FUNCTION check_reset_and_increment_usage(
    p_user_id UUID,
    p_feature_key TEXT,
    p_amount INTEGER DEFAULT 1
)
RETURNS TABLE (
    success BOOLEAN,
    current_usage INTEGER,
    usage_limit INTEGER,
    remaining INTEGER,
    is_exceeded BOOLEAN,
    was_period_reset BOOLEAN
) AS $$
DECLARE
    v_record usage_tracking%ROWTYPE;
    v_new_period_end TIMESTAMPTZ;
    v_was_reset BOOLEAN := FALSE;
    v_new_usage INTEGER;
BEGIN
    SELECT * INTO v_record
    FROM usage_tracking
    WHERE user_id = p_user_id AND feature_key = p_feature_key
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0, 0, 0, FALSE, FALSE;
        RETURN;
    END IF;

    IF v_record.period_end IS NOT NULL
       AND v_record.period_type NOT IN ('lifetime', 'none')
       AND NOW() > v_record.period_end THEN
        IF v_record.period_type = 'daily' THEN
            v_new_period_end := DATE_TRUNC('day', NOW()) + INTERVAL '1 day' - INTERVAL '1 millisecond';
        ELSE
            v_new_period_end := DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 millisecond';
        END IF;

        UPDATE usage_tracking
        SET
            current_usage = p_amount,
            period_start = NOW(),
            period_end = v_new_period_end,
            last_used_at = NOW()
        WHERE id = v_record.id
        RETURNING current_usage INTO v_new_usage;

        v_was_reset := TRUE;
    ELSE
        UPDATE usage_tracking
        SET
            current_usage = current_usage + p_amount,
            last_used_at = NOW()
        WHERE id = v_record.id
        RETURNING current_usage INTO v_new_usage;
    END IF;

    RETURN QUERY SELECT
        TRUE,
        v_new_usage,
        v_record.usage_limit,
        CASE
            WHEN v_record.usage_limit = -1 THEN -1
            ELSE GREATEST(0, v_record.usage_limit - v_new_usage)
        END,
        CASE
            WHEN v_record.usage_limit = -1 THEN FALSE
            ELSE v_new_usage > v_record.usage_limit
        END,
        v_was_reset;
END;
$$ LANGUAGE plpgsql;

-- Atomically change a user's tier
CREATE OR REPLACE FUNCTION change_user_tier(
    p_user_id UUID,
    p_tier_id UUID,
    p_billing_cycle TEXT DEFAULT 'monthly'
)
RETURNS TABLE (
    success BOOLEAN,
    membership_id UUID,
    tier_name TEXT,
    error_message TEXT
) AS $$
DECLARE
    v_tier membership_tiers%ROWTYPE;
    v_membership_id UUID;
BEGIN
    SELECT * INTO v_tier
    FROM membership_tiers
    WHERE id = p_tier_id
    FOR SHARE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'Tier not found'::TEXT;
        RETURN;
    END IF;

    IF NOT v_tier.is_active THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'Tier is not active'::TEXT;
        RETURN;
    END IF;

    UPDATE memberships
    SET
        tier_id = p_tier_id,
        status = 'active',
        billing_cycle = p_billing_cycle,
        started_at = NOW(),
        stripe_subscription_id = NULL,
        stripe_price_id = NULL,
        current_period_start = NOW(),
        current_period_end = NULL,
        trial_starts_at = NULL,
        trial_ends_at = NULL,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING id INTO v_membership_id;

    IF v_membership_id IS NULL THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'Membership not found'::TEXT;
        RETURN;
    END IF;

    RETURN QUERY SELECT TRUE, v_membership_id, v_tier.name, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION PERMISSIONS
-- ============================================
GRANT EXECUTE ON FUNCTION increment_usage(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION reset_usage_if_expired(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_reset_and_increment_usage(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION change_user_tier(UUID, UUID, TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION increment_usage(UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION reset_usage_if_expired(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION check_reset_and_increment_usage(UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION change_user_tier(UUID, UUID, TEXT) TO service_role;

-- ============================================
-- FUNCTION COMMENTS
-- ============================================
COMMENT ON FUNCTION increment_usage IS 'Atomically increments usage counter for a feature.';
COMMENT ON FUNCTION reset_usage_if_expired IS 'Atomically resets usage if the period has expired.';
COMMENT ON FUNCTION check_reset_and_increment_usage IS 'Combined atomic operation: checks period, resets if needed, then increments.';
COMMENT ON FUNCTION change_user_tier IS 'Atomically changes a user tier with validation.';

-- ============================================
-- VIEWS
-- ============================================

-- User membership with full details
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
