-- ============================================
-- 003_rls_policies.sql
-- Row Level Security policies
-- Pattern: user owns their data via (SELECT auth.uid()) = user_id
-- service_role has full access everywhere
-- ============================================

-- ============================================
-- USER PROFILES
-- ============================================
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
    ON public.user_profiles FOR SELECT
    USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users can update own profile"
    ON public.user_profiles FOR UPDATE
    USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users can insert own profile"
    ON public.user_profiles FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "Service role full access to profiles"
    ON public.user_profiles FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- MEMBERSHIP TIERS (public read for active tiers)
-- ============================================
ALTER TABLE public.membership_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active tiers"
    ON public.membership_tiers FOR SELECT
    USING (is_active = true);

CREATE POLICY "Service role full access to tiers"
    ON public.membership_tiers FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- MEMBERSHIPS
-- ============================================
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own membership"
    ON public.memberships FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Service role full access to memberships"
    ON public.memberships FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- FEATURES (public read for active features)
-- ============================================
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active features"
    ON public.features FOR SELECT
    USING (is_active = true);

CREATE POLICY "Service role full access to features"
    ON public.features FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- TIER FEATURES (public read)
-- ============================================
ALTER TABLE public.tier_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tier features"
    ON public.tier_features FOR SELECT
    USING (true);

CREATE POLICY "Service role full access to tier features"
    ON public.tier_features FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- USAGE TRACKING
-- ============================================
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
    ON public.usage_tracking FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Service role full access to usage"
    ON public.usage_tracking FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- STRIPE WEBHOOK EVENTS (backend only)
-- ============================================
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to webhook events"
    ON public.stripe_webhook_events FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- ADMIN USERS
-- ============================================
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view admin users"
    ON public.admin_users FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Service role full access to admin users"
    ON public.admin_users FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- MEMBERSHIP AUDIT LOG (backend only)
-- ============================================
ALTER TABLE public.membership_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to audit log"
    ON public.membership_audit_log FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- CONTACT SUBMISSIONS (backend only)
-- ============================================
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to contact submissions"
    ON public.contact_submissions FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- NEWSLETTER SUBSCRIBERS (backend only)
-- ============================================
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to newsletter"
    ON public.newsletter_subscribers FOR ALL
    USING (auth.role() = 'service_role');
