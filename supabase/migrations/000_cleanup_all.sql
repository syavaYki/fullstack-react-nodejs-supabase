-- ============================================
-- 000_cleanup_all.sql
-- Idempotent cleanup: drops everything for fresh reset
-- Safe to re-run (all DROP IF EXISTS)
-- ============================================

-- 1. Drop trigger on auth.users (not dropped by CASCADE below since auth schema is external)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Drop views (CASCADE handles dependent objects)
DROP VIEW IF EXISTS public.user_membership_details CASCADE;
DROP VIEW IF EXISTS public.tier_comparison CASCADE;
DROP VIEW IF EXISTS public.v_features_with_tiers CASCADE;
DROP VIEW IF EXISTS public.v_features_overview CASCADE;
DROP VIEW IF EXISTS public.v_membership_tiers_overview CASCADE;
DROP VIEW IF EXISTS public.v_users_membership_details CASCADE;
DROP VIEW IF EXISTS public.v_usage_tracking_details CASCADE;
DROP VIEW IF EXISTS public.v_tier_features_matrix CASCADE;
DROP VIEW IF EXISTS public.v_membership_audit_details CASCADE;
DROP VIEW IF EXISTS public.v_stripe_webhook_events_summary CASCADE;
DROP VIEW IF EXISTS public.v_contact_submissions_overview CASCADE;
DROP VIEW IF EXISTS public.v_dashboard_stats CASCADE;

-- 3. Drop tables with CASCADE (automatically drops all triggers on these tables)
DROP TABLE IF EXISTS public.usage_tracking CASCADE;
DROP TABLE IF EXISTS public.tier_features CASCADE;
DROP TABLE IF EXISTS public.features CASCADE;
DROP TABLE IF EXISTS public.membership_audit_log CASCADE;
DROP TABLE IF EXISTS public.memberships CASCADE;
DROP TABLE IF EXISTS public.membership_tiers CASCADE;
DROP TABLE IF EXISTS public.stripe_webhook_events CASCADE;
DROP TABLE IF EXISTS public.admin_users CASCADE;
DROP TABLE IF EXISTS public.contact_submissions CASCADE;
DROP TABLE IF EXISTS public.newsletter_subscribers CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- 4. Drop functions (tables are gone, so no dependency issues)
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.log_membership_change() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_tier_with_features(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.user_has_feature(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_feature_limit(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_tier_features(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.increment_usage(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.reset_usage_if_expired(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.check_reset_and_increment_usage(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.change_user_tier(UUID, UUID) CASCADE;
