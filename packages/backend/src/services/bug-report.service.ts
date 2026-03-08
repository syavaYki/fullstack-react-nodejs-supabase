import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
import { logger } from '../utils/logger.js';
import { emailService } from './email/email.service.js';
import { env } from '../config/env.js';
import type {
  BugReport,
  BugReportImageMetadata,
  CreateBugReportInput,
} from '../types/bug-report.types.js';

const STORAGE_BUCKET = 'bug-report-images';

export class BugReportService {
  /**
   * Uploads a single image file to Supabase Storage.
   * Returns metadata including the permanent public URL.
   */
  async uploadImage(file: Express.Multer.File): Promise<BugReportImageMetadata> {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `reports/${timestamp}-${safeName}`;

    const { error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).upload(path, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

    if (error) {
      logger.error('BUG_REPORT', 'Image upload failed', { error: error.message, path });
      throw new ApiError(500, `Failed to upload image: ${file.originalname}`);
    }

    const { data: urlData } = supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(path);

    return {
      name: file.originalname,
      url: urlData.publicUrl,
      size: file.size,
      uploaded_at: new Date().toISOString(),
    };
  }

  /**
   * Inserts a bug report record into the database.
   */
  async createBugReport(
    input: CreateBugReportInput,
    images: BugReportImageMetadata[],
    ipAddress?: string,
    userAgent?: string
  ): Promise<BugReport> {
    const { data, error } = await supabaseAdmin
      .from('bug_reports')
      .insert({
        name: input.name || null,
        email: input.email || null,
        description: input.description,
        images,
        page_url: input.page_url || null,
        ip_address: ipAddress || null,
        user_agent: userAgent || null,
        status: 'new',
      })
      .select()
      .single();

    if (error) {
      logger.error('BUG_REPORT', 'DB insert failed', { error: error.message });
      throw new ApiError(500, 'Failed to save bug report');
    }

    return data as BugReport;
  }

  /**
   * Orchestrates image uploads and bug report creation.
   * Continues even if individual image uploads fail.
   */
  async submitBugReport(
    input: CreateBugReportInput,
    files: Express.Multer.File[],
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ report: BugReport; images_uploaded: number }> {
    // Upload all images in parallel — partial failures are tolerated
    const uploadResults = await Promise.allSettled(files.map((f) => this.uploadImage(f)));

    const uploadedImages: BugReportImageMetadata[] = [];
    for (const result of uploadResults) {
      if (result.status === 'fulfilled') {
        uploadedImages.push(result.value);
      } else {
        logger.warn('BUG_REPORT', 'Image upload skipped', { reason: result.reason?.message });
      }
    }

    const report = await this.createBugReport(input, uploadedImages, ipAddress, userAgent);

    logger.info('BUG_REPORT', 'Submitted', {
      id: report.id,
      images: uploadedImages.length,
      failed: files.length - uploadedImages.length,
    });

    // Fire-and-forget admin notification
    this.sendAdminNotification(report).catch(() => {});

    return { report, images_uploaded: uploadedImages.length };
  }

  /**
   * Sends an admin notification email for a new bug report.
   * Skipped silently if CONTACT_NOTIFICATION_EMAIL is not set.
   */
  private async sendAdminNotification(report: BugReport): Promise<void> {
    if (!env.CONTACT_NOTIFICATION_EMAIL) return;

    const imageList =
      report.images.length > 0
        ? report.images.map((img) => `- ${img.name}: ${img.url}`).join('\n')
        : 'No images attached';

    const result = await emailService.sendTemplateEmail({
      templateKey: 'bug_report_admin_notification',
      to: env.CONTACT_NOTIFICATION_EMAIL,
      replyTo: report.email || undefined,
      variables: {
        name: report.name || 'Anonymous',
        email: report.email || 'Not provided',
        description: report.description,
        page_url: report.page_url || 'Not specified',
        image_count: String(report.images.length),
        image_list: imageList,
        submitted_at: new Date(report.created_at).toLocaleString(),
        ip_address: report.ip_address || 'Unknown',
      },
    });

    if (!result.success) {
      logger.warn('BUG_REPORT', 'Admin notification email failed', {
        reportId: report.id,
        error: result.error,
      });
    }
  }
}

export const bugReportService = new BugReportService();
