import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
import { logger } from '../utils/logger.js';

/**
 * Newsletter subscriber record.
 */
export interface NewsletterSubscriber {
  id: string;
  email: string;
  created_at: string;
}

/**
 * Service for handling newsletter subscriptions.
 * Uses admin client to bypass RLS for anonymous subscriptions.
 */
export class NewsletterService {
  /**
   * Subscribe an email to the newsletter.
   * Silently succeeds if email already exists (privacy-first).
   */
  async subscribe(email: string): Promise<{ isNew: boolean }> {
    const normalizedEmail = email.toLowerCase().trim();

    const { error } = await supabaseAdmin
      .from('newsletter_subscribers')
      .insert({ email: normalizedEmail });

    if (error?.code === '23505') {
      return { isNew: false };
    }

    if (error) {
      logger.error('DB', 'Newsletter subscription error', { error: error.message });
      throw new ApiError(500, 'Failed to subscribe to newsletter');
    }

    return { isNew: true };
  }
}

export const newsletterService = new NewsletterService();
