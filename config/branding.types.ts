/**
 * Branding configuration for the template.
 * Edit config/branding.ts to customize your app.
 */
export interface BrandingConfig {
  // ── Identity ───────────────────────────────────
  /** Displayed in the browser tab, emails, and Swagger docs */
  projectDisplayName: string;
  /** URL-safe slug (used in generated IDs, analytics, etc.) */
  projectSlug: string;
  /** Production domain (without protocol) */
  domain: string;

  // ── Visual ─────────────────────────────────────
  /** MUI primary color — buttons, links, active states */
  primaryColor: string;
  /** MUI secondary color — accents, badges */
  secondaryColor: string;
  /** CSS font-family stack */
  fontFamily: string;
  /** Google Fonts URL (set to empty string to skip loading) */
  googleFontsUrl: string;

  // ── Header / Sidebar ──────────────────────────
  /** Text next to the logo icon */
  logoText: string;

  // ── Footer ─────────────────────────────────────
  footerBrandName: string;
  footerDescription: string;

  // ── SEO / Meta ─────────────────────────────────
  /** Appended to every page title: "Page - {suffix}" */
  metaTitleSuffix: string;
  /** Default meta description for pages without one */
  metaDescription: string;

  // ── Landing: Hero ──────────────────────────────
  /** Main headline (plain portion) */
  heroHeadline: string;
  /** Accented word in the headline (rendered in primary color) */
  heroHeadlineAccent: string;
  /** Subheadline paragraph below the main headline */
  heroSubheadline: string;
  /** Primary CTA button text */
  ctaText: string;
  /** Secondary CTA button text */
  ctaSecondaryText: string;

  // ── Landing: CTA Section ───────────────────────
  ctaSectionHeadline: string;
  ctaSectionSubtext: string;
  ctaSectionButtonText: string;

  // ── API Docs ───────────────────────────────────
  /** Swagger UI title */
  apiTitle: string;
  /** Swagger UI description */
  apiDescription: string;
}
