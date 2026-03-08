/**
 * ╔══════════════════════════════════════════════════╗
 * ║           TEMPLATE BRANDING CONFIG               ║
 * ║   Edit this file to customize your app branding  ║
 * ╚══════════════════════════════════════════════════╝
 *
 * This is the single source of truth for project name,
 * colors, fonts, and landing page copy. Both the backend
 * and frontend read from this file.
 *
 * After editing, restart the dev servers to see changes.
 *
 * Tier names, prices, and descriptions live in:
 *   supabase/migrations/005_seed_data.sql
 */

import type { BrandingConfig } from './branding.types';

export const branding: BrandingConfig = {
  // ── Identity ───────────────────────────────────
  projectDisplayName: 'Fullstack App',
  projectSlug: 'app',
  domain: 'example.com',

  // ── Visual ─────────────────────────────────────
  primaryColor: '#2563eb',
  secondaryColor: '#7c3aed',
  fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  googleFontsUrl:
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',

  // ── Header / Sidebar ──────────────────────────
  logoText: 'SaaS',

  // ── Footer ─────────────────────────────────────
  footerBrandName: 'SaaS Boilerplate',
  footerDescription:
    'A production-ready SaaS starter with auth, billing, and feature gating.',

  // ── SEO / Meta ─────────────────────────────────
  metaTitleSuffix: 'SaaS Boilerplate',
  metaDescription:
    'A production-ready SaaS starter template with authentication, billing, and feature management.',

  // ── Landing: Hero ──────────────────────────────
  heroHeadline: 'Build Your SaaS',
  heroHeadlineAccent: 'Faster',
  heroSubheadline:
    'A production-ready foundation with auth, billing, feature gating, and a beautiful dashboard — so you can focus on what makes your product unique.',
  ctaText: 'Get Started Free',
  ctaSecondaryText: 'View Pricing',

  // ── Landing: CTA Section ───────────────────────
  ctaSectionHeadline: 'Ready to Get Started?',
  ctaSectionSubtext: 'Start building today — no credit card required.',
  ctaSectionButtonText: 'Create Free Account',

  // ── API Docs ───────────────────────────────────
  apiTitle: 'Fullstack App API',
  apiDescription:
    'Express API with Supabase Auth, Memberships, and Stripe Billing',
};
