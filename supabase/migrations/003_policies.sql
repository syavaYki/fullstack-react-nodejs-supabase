-- ============================================
-- 003_policies.sql
-- Row Level Security (RLS) policies
-- ============================================

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================
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
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- USER PROFILES POLICIES
-- ============================================
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

CREATE POLICY "Service role full access to profiles"
    ON public.user_profiles FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- MEMBERSHIP TIERS POLICIES
-- ============================================
CREATE POLICY "Anyone can view active tiers"
    ON public.membership_tiers FOR SELECT
    USING (is_active = true);

CREATE POLICY "Service role full access to tiers"
    ON public.membership_tiers FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- MEMBERSHIPS POLICIES
-- ============================================
CREATE POLICY "Users can view own membership"
    ON public.memberships FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to memberships"
    ON public.memberships FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- FEATURES POLICIES
-- ============================================
CREATE POLICY "Authenticated users can view features"
    ON public.features FOR SELECT
    TO authenticated
    USING (is_active = true);

CREATE POLICY "Service role full access to features"
    ON public.features FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- TIER FEATURES POLICIES
-- ============================================
CREATE POLICY "Authenticated users can view tier features"
    ON public.tier_features FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Service role full access to tier_features"
    ON public.tier_features FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- PAYMENT HISTORY POLICIES
-- ============================================
CREATE POLICY "Users can view own payments"
    ON public.payment_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to payments"
    ON public.payment_history FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- STRIPE WEBHOOK EVENTS POLICIES
-- ============================================
CREATE POLICY "Service role full access to webhook events"
    ON public.stripe_webhook_events FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- MEMBERSHIP AUDIT LOG POLICIES
-- ============================================
CREATE POLICY "Users can view own audit log"
    ON public.membership_audit_log FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to audit log"
    ON public.membership_audit_log FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- USAGE TRACKING POLICIES
-- ============================================
CREATE POLICY "Users can view own usage"
    ON public.usage_tracking FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to usage_tracking"
    ON public.usage_tracking FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- ADMIN USERS POLICIES
-- ============================================
CREATE POLICY "Admins can view admin_users"
    ON public.admin_users FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

CREATE POLICY "Service role full access to admin_users"
    ON public.admin_users FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- CONTACT SUBMISSIONS POLICIES
-- ============================================
CREATE POLICY "Service role full access to contact_submissions"
    ON public.contact_submissions FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');
