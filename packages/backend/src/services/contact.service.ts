import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { ContactSubmission, CreateContactSubmissionInput } from '../types/index.js';
import { ApiError } from '../middleware/error.middleware.js';

/**
 * Service for handling public contact form submissions.
 * Stores submissions in the database and sends email notifications.
 * Uses admin client to bypass RLS for anonymous submissions.
 */
export class ContactService {
  /**
   * Creates a new contact form submission.
   * Uses supabaseAdmin (service role) to bypass RLS since submitters may be anonymous.
   * Records IP address and user agent for spam prevention.
   *
   * @param input - Contact form data (name, email, subject, message)
   * @param ipAddress - Optional IP address of the submitter
   * @param userAgent - Optional user agent string of the submitter
   * @returns The created contact submission record
   * @throws {ApiError} 500 if database insert fails
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
      console.error('Contact submission error:', error);
      throw new ApiError(500, 'Failed to submit contact form');
    }

    return data;
  }

  /**
   * Sends an email notification for a new contact submission.
   * Uses the Resend email service (optional dependency).
   * Silently fails if Resend is not configured or installed.
   *
   * @param submission - The contact submission to notify about
   */
  async sendNotificationEmail(submission: ContactSubmission): Promise<void> {
    // Check if email is configured
    if (!env.RESEND_API_KEY || !env.CONTACT_NOTIFICATION_EMAIL) {
      console.log('Email not configured, skipping notification for submission:', submission.id);
      return;
    }

    try {
      // Dynamic import to avoid errors if resend is not installed
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const resendModule = await import('resend').catch(() => null);
      if (!resendModule) {
        console.log(
          'Resend module not installed, skipping email notification. Install with: npm install resend'
        );
        return;
      }

      const { Resend } = resendModule;
      const resend = new Resend(env.RESEND_API_KEY);

      await resend.emails.send({
        from: 'Contact Form <noreply@yourdomain.com>',
        to: env.CONTACT_NOTIFICATION_EMAIL,
        replyTo: submission.email,
        subject: `[Contact Form] ${submission.subject}`,
        html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>From:</strong> ${submission.first_name} ${submission.last_name}</p>
          <p><strong>Email:</strong> <a href="mailto:${submission.email}">${submission.email}</a></p>
          <p><strong>Subject:</strong> ${submission.subject}</p>
          <hr>
          <p><strong>Message:</strong></p>
          <p style="white-space: pre-wrap;">${submission.message}</p>
          <hr>
          <p style="color: #666; font-size: 12px;">
            Submitted at: ${submission.created_at}<br>
            IP: ${submission.ip_address || 'Unknown'}
          </p>
        `,
      });

      console.log('Contact notification email sent for submission:', submission.id);
    } catch (error) {
      console.error('Failed to send contact notification email:', error);
      // Don't throw - email failure shouldn't fail the submission
    }
  }
}

export const contactService = new ContactService();
