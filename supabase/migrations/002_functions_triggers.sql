-- ============================================
-- 002_functions_triggers.sql
-- Database functions and triggers
-- ============================================

-- ============================================
-- UTILITY FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Apply updated_at triggers
CREATE TRIGGER set_updated_at_user_profiles
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_memberships
    BEFORE UPDATE ON public.memberships
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_usage_tracking
    BEFORE UPDATE ON public.usage_tracking
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- MEMBERSHIP AUDIT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION public.log_membership_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.membership_audit_log (
        membership_id, user_id, action,
        old_status, new_status,
        old_tier_id, new_tier_id,
        metadata
    ) VALUES (
        NEW.id, NEW.user_id,
        CASE
            WHEN TG_OP = 'INSERT' THEN 'created'
            WHEN OLD.tier_id != NEW.tier_id THEN 'tier_changed'
            WHEN OLD.status != NEW.status THEN 'status_changed'
            ELSE 'updated'
        END,
        CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
        NEW.status,
        CASE WHEN TG_OP = 'UPDATE' THEN OLD.tier_id ELSE NULL END,
        NEW.tier_id,
        jsonb_build_object(
            'stripe_status', NEW.stripe_status,
            'billing_cycle', NEW.billing_cycle,
            'stripe_subscription_id', NEW.stripe_subscription_id
        )
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_membership_change
    AFTER INSERT OR UPDATE ON public.memberships
    FOR EACH ROW EXECUTE FUNCTION public.log_membership_change();

-- ============================================
-- AUTO-PROVISION ON SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    default_tier_id UUID;
BEGIN
    -- Get the default (free) tier
    SELECT id INTO default_tier_id
    FROM public.membership_tiers
    WHERE is_default = true
    LIMIT 1;

    -- Create user profile
    INSERT INTO public.user_profiles (id, email, first_name, last_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', '')
    );

    -- Create default membership
    IF default_tier_id IS NOT NULL THEN
        INSERT INTO public.memberships (user_id, tier_id, status)
        VALUES (NEW.id, default_tier_id, 'active');
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- MEMBERSHIP / FEATURE QUERY FUNCTIONS
-- ============================================

-- Get user's tier with all resolved features
CREATE OR REPLACE FUNCTION public.get_user_tier_with_features(p_user_id UUID)
RETURNS TABLE (
    tier_name TEXT,
    tier_display_name TEXT,
    membership_status TEXT,
    stripe_status TEXT,
    trial_ends_at TIMESTAMPTZ,
    features JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        mt.name,
        mt.display_name,
        m.status,
        m.stripe_status,
        m.trial_ends_at,
        COALESCE(
            jsonb_object_agg(f.key, tf.value) FILTER (WHERE f.key IS NOT NULL),
            '{}'::jsonb
        )
    FROM public.memberships m
    JOIN public.membership_tiers mt ON m.tier_id = mt.id
    LEFT JOIN public.tier_features tf ON tf.tier_id = mt.id
    LEFT JOIN public.features f ON f.id = tf.feature_id
    WHERE m.user_id = p_user_id
    GROUP BY mt.name, mt.display_name, m.status, m.stripe_status, m.trial_ends_at;
END;
$$;

-- Check if user has a specific feature (returns true/false)
CREATE OR REPLACE FUNCTION public.user_has_feature(p_user_id UUID, p_feature_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    feature_value TEXT;
BEGIN
    SELECT tf.value INTO feature_value
    FROM public.memberships m
    JOIN public.tier_features tf ON tf.tier_id = m.tier_id
    JOIN public.features f ON f.id = tf.feature_id
    WHERE m.user_id = p_user_id
      AND f.key = p_feature_key
      AND m.status = 'active';

    IF feature_value IS NULL THEN
        RETURN false;
    END IF;

    -- Boolean: 'true'/'false'
    -- Limit: any positive number or -1 (unlimited) means has feature
    IF feature_value = 'true' THEN RETURN true; END IF;
    IF feature_value = 'false' OR feature_value = '0' THEN RETURN false; END IF;

    -- Numeric (limit feature): has access if limit > 0 or -1
    RETURN true;
END;
$$;

-- Get feature limit details for a user
CREATE OR REPLACE FUNCTION public.get_feature_limit(p_user_id UUID, p_feature_key TEXT)
RETURNS TABLE (
    usage_limit INTEGER,
    current_usage INTEGER,
    period_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(tf.value::INTEGER, 0) AS usage_limit,
        COALESCE(ut.current_usage, 0) AS current_usage,
        COALESCE(ut.period_type, 'none')::TEXT AS period_type
    FROM public.memberships m
    JOIN public.tier_features tf ON tf.tier_id = m.tier_id
    JOIN public.features f ON f.id = tf.feature_id
    LEFT JOIN public.usage_tracking ut ON ut.user_id = m.user_id AND ut.feature_key = f.key
    WHERE m.user_id = p_user_id
      AND f.key = p_feature_key
      AND m.status = 'active';
END;
$$;

-- Get all features for a tier
CREATE OR REPLACE FUNCTION public.get_tier_features(p_tier_id UUID)
RETURNS TABLE (
    feature_key TEXT,
    feature_name TEXT,
    feature_type TEXT,
    value TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT f.key, f.name, f.feature_type, tf.value
    FROM public.tier_features tf
    JOIN public.features f ON f.id = tf.feature_id
    WHERE tf.tier_id = p_tier_id
    ORDER BY f.sort_order;
END;
$$;

-- ============================================
-- USAGE TRACKING FUNCTIONS (ATOMIC)
-- ============================================

-- Simple increment
CREATE OR REPLACE FUNCTION public.increment_usage(p_user_id UUID, p_feature_key TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.usage_tracking (user_id, feature_key, current_usage, last_used_at)
    VALUES (p_user_id, p_feature_key, 1, NOW())
    ON CONFLICT (user_id, feature_key)
    DO UPDATE SET
        current_usage = usage_tracking.current_usage + 1,
        last_used_at = NOW();
END;
$$;

-- Reset usage if period has expired
CREATE OR REPLACE FUNCTION public.reset_usage_if_expired(p_user_id UUID, p_feature_key TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.usage_tracking
    SET current_usage = 0,
        period_start = NOW(),
        period_end = CASE period_type
            WHEN 'daily' THEN (NOW() AT TIME ZONE 'UTC')::DATE + INTERVAL '1 day' - INTERVAL '1 second'
            WHEN 'monthly' THEN (DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month' - INTERVAL '1 second')
            ELSE period_end
        END
    WHERE user_id = p_user_id
      AND feature_key = p_feature_key
      AND period_end IS NOT NULL
      AND period_end < NOW();
END;
$$;

-- Atomic check-reset-and-increment with FOR UPDATE lock
CREATE OR REPLACE FUNCTION public.check_reset_and_increment_usage(p_user_id UUID, p_feature_key TEXT)
RETURNS TABLE (new_usage INTEGER, at_limit BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record RECORD;
    v_limit INTEGER;
BEGIN
    -- Get feature limit from tier
    SELECT COALESCE(tf.value::INTEGER, 0) INTO v_limit
    FROM public.memberships m
    JOIN public.tier_features tf ON tf.tier_id = m.tier_id
    JOIN public.features f ON f.id = tf.feature_id
    WHERE m.user_id = p_user_id AND f.key = p_feature_key AND m.status = 'active';

    -- Upsert and lock the usage row
    INSERT INTO public.usage_tracking (user_id, feature_key, current_usage, usage_limit, period_type, period_start, period_end)
    VALUES (p_user_id, p_feature_key, 0, COALESCE(v_limit, 0), 'monthly', NOW(),
            DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month' - INTERVAL '1 second')
    ON CONFLICT (user_id, feature_key) DO NOTHING;

    -- Lock the row for atomic update
    SELECT * INTO v_record
    FROM public.usage_tracking
    WHERE user_id = p_user_id AND feature_key = p_feature_key
    FOR UPDATE;

    -- Reset if period expired
    IF v_record.period_end IS NOT NULL AND v_record.period_end < NOW() THEN
        UPDATE public.usage_tracking
        SET current_usage = 0,
            period_start = NOW(),
            period_end = CASE v_record.period_type
                WHEN 'daily' THEN (NOW() AT TIME ZONE 'UTC')::DATE + INTERVAL '1 day' - INTERVAL '1 second'
                WHEN 'monthly' THEN DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month' - INTERVAL '1 second'
                ELSE v_record.period_end
            END,
            usage_limit = COALESCE(v_limit, v_record.usage_limit)
        WHERE user_id = p_user_id AND feature_key = p_feature_key;

        v_record.current_usage := 0;
    END IF;

    -- Increment
    UPDATE public.usage_tracking
    SET current_usage = v_record.current_usage + 1,
        last_used_at = NOW(),
        usage_limit = COALESCE(v_limit, v_record.usage_limit)
    WHERE user_id = p_user_id AND feature_key = p_feature_key;

    new_usage := v_record.current_usage + 1;
    at_limit := (v_limit != -1 AND new_usage >= v_limit);
    RETURN NEXT;
END;
$$;

-- ============================================
-- TIER CHANGE FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.change_user_tier(
    p_user_id UUID,
    p_tier_id UUID,
    p_billing_cycle TEXT DEFAULT 'monthly'
)
RETURNS TABLE (success BOOLEAN, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Validate tier exists and is active
    IF NOT EXISTS (SELECT 1 FROM public.membership_tiers WHERE id = p_tier_id AND is_active = true) THEN
        success := false;
        error_message := 'Invalid or inactive tier';
        RETURN NEXT;
        RETURN;
    END IF;

    UPDATE public.memberships
    SET tier_id = p_tier_id,
        billing_cycle = p_billing_cycle
    WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        success := false;
        error_message := 'User membership not found';
        RETURN NEXT;
        RETURN;
    END IF;

    success := true;
    error_message := NULL;
    RETURN NEXT;
END;
$$;

-- ============================================
-- SECURITY: Restrict SECURITY DEFINER functions
-- Only authenticated users should call these via PostgREST.
-- The anon role should NOT be able to call tier changes,
-- usage tracking, or other privileged operations.
-- ============================================

-- Revoke all from public (which includes anon)
REVOKE ALL ON FUNCTION public.change_user_tier(UUID, UUID, TEXT) FROM public;
REVOKE ALL ON FUNCTION public.check_reset_and_increment_usage(UUID, TEXT) FROM public;
REVOKE ALL ON FUNCTION public.increment_usage(UUID, TEXT) FROM public;
REVOKE ALL ON FUNCTION public.reset_usage_if_expired(UUID, TEXT) FROM public;
REVOKE ALL ON FUNCTION public.get_user_tier_with_features(UUID) FROM public;
REVOKE ALL ON FUNCTION public.user_has_feature(UUID, TEXT) FROM public;
REVOKE ALL ON FUNCTION public.get_feature_limit(UUID, TEXT) FROM public;
REVOKE ALL ON FUNCTION public.get_tier_features(UUID) FROM public;

-- Grant to authenticated role only
GRANT EXECUTE ON FUNCTION public.change_user_tier(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_reset_and_increment_usage(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_usage(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_usage_if_expired(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_tier_with_features(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_feature(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_feature_limit(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tier_features(UUID) TO authenticated;

-- Service role always has access (for backend admin operations)
GRANT EXECUTE ON FUNCTION public.change_user_tier(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_reset_and_increment_usage(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_usage(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_usage_if_expired(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_tier_with_features(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.user_has_feature(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_feature_limit(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_tier_features(UUID) TO service_role;
