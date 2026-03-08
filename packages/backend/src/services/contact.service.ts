import { supabaseAdmin } from '../config/supabase.js';
import { ContactSubmission, CreateContactSubmissionInput } from '../types/index.js';
import { ApiError } from '../middleware/error.middleware.js';
import { logger } from '../utils/logger.js';
import { emailService } from './email/email.service.js';
import { env } from '../config/env.js';

/**
 * Service for handling public contact form submissions.
 * Uses admin client to bypass RLS for anonymous submissions.
 */
export class ContactService {
  /**
   * Creates a new contact form submission.
   */
  async createSubmission(
    input: CreateContactSubmissionInput,
    ipAddress?: string,
    userAgent?: string
  ): Promise<ContactSubmission> {
    const { data, error } = await supabaseAdmin
      .from('contact_submissions')
      .insert({
        first_name: input.first_name,
        last_name: input.last_name,
        email: input.email,
        subject: input.subject,
        message: input.message,
        ip_address: ipAddress || null,
        user_agent: userAgent || null,
        status: 'new',
      })
      .select()
      .single();

    if (error) {
      logger.error('DB', 'Contact submission error', { error: error.message });
      throw new ApiError(500, 'Failed to submit contact form');
    }

    // Fire-and-forget: email failure never rejects the HTTP response
    this.sendAdminNotification(data).catch(() => {});

    return data;
  }

  /**
   * Sends an admin notification email for a new contact submission.
   * Skipped silently if CONTACT_NOTIFICATION_EMAIL is not set.
   */
  private async sendAdminNotification(submission: ContactSubmission): Promise<void> {
    if (!env.CONTACT_NOTIFICATION_EMAIL) return;

    const result = await emailService.sendTemplateEmail({
      templateKey: 'contact_admin_notification',
      to: env.CONTACT_NOTIFICATION_EMAIL,
      replyTo: submission.email,
      variables: {
        first_name: submission.first_name,
        last_name: submission.last_name,
        email: submission.email,
        subject: submission.subject,
        message: submission.message,
        submitted_at: new Date(submission.created_at).toLocaleString(),
        ip_address: submission.ip_address || 'Unknown',
      },
    });

    if (!result.success) {
      logger.warn('CONTACT', 'Admin notification email failed', {
        submissionId: submission.id,
        error: result.error,
      });
    }
  }
}

export const contactService = new ContactService();
