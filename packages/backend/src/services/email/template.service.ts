import { supabaseAdmin } from '../../config/supabase.js';
import { logger } from '../../utils/logger.js';
import type { EmailTemplate, RenderedEmail } from '../../types/email.types.js';

interface CacheEntry {
  template: EmailTemplate;
  cachedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class TemplateService {
  private cache = new Map<string, CacheEntry>();

  /**
   * Load a template from DB (or cache).
   * Returns null if not found or inactive.
   */
  async getTemplate(key: string): Promise<EmailTemplate | null> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return cached.template;
    }

    const { data, error } = await supabaseAdmin
      .from('email_templates')
      .select('*')
      .eq('key', key)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      logger.error('EMAIL', 'Failed to load email template', { key, error: error.message });
      return null;
    }

    this.cache.set(key, { template: data as EmailTemplate, cachedAt: Date.now() });
    return data as EmailTemplate;
  }

  /**
   * Render a template with variables, returning subject + html + text.
   * Unknown {{variables}} are left as-is rather than throwing.
   */
  async render(key: string, variables: Record<string, unknown>): Promise<RenderedEmail> {
    const template = await this.getTemplate(key);
    if (!template) throw new Error(`Email template not found: ${key}`);

    return {
      subject: this.interpolate(template.subject_template, variables),
      html: this.interpolate(template.html_template, variables),
      text: template.text_template ? this.interpolate(template.text_template, variables) : null,
      from_email: template.default_from_email,
      from_name: template.default_from_name,
    };
  }

  async exists(key: string): Promise<boolean> {
    return (await this.getTemplate(key)) !== null;
  }

  clearCache(): void {
    this.cache.clear();
  }

  // ── Private ──────────────────────────────────────────────

  /**
   * Replace {{variable}} placeholders. Values are HTML-escaped for safety.
   * Unknown keys are kept as-is (no crash on partial variables).
   */
  private interpolate(template: string, variables: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
      const value = variables[key];
      if (value === undefined || value === null) return match;
      return this.escapeHtml(String(value));
    });
  }

  private escapeHtml(str: string): string {
    return str.replace(
      /[&<>"']/g,
      (ch) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[ch] ?? ch
    );
  }
}

export const templateService = new TemplateService();
