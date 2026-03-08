import {
  getHostingerTransport,
  getHostingerFromEmail,
  getHostingerFromName,
  isHostingerConfigured,
} from '../../config/hostinger.js';
import { templateService } from './template.service.js';
import { logger } from '../../utils/logger.js';
import type {
  SendEmailInput,
  SendTemplateEmailInput,
  SendResult,
} from '../../types/email.types.js';

/**
 * Sends an email via Hostinger SMTP using a DB template.
 * Fire-and-forget safe: logs errors rather than throwing.
 */
async function sendTemplateEmail(input: SendTemplateEmailInput): Promise<SendResult> {
  if (!isHostingerConfigured()) {
    logger.warn('EMAIL', 'Hostinger SMTP not configured — email skipped', {
      templateKey: input.templateKey,
      to: input.to,
    });
    return { success: false, error: 'SMTP not configured' };
  }

  let rendered;
  try {
    rendered = await templateService.render(input.templateKey, input.variables);
  } catch (err) {
    logger.error('EMAIL', 'Template render failed', {
      templateKey: input.templateKey,
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, error: 'Template render failed' };
  }

  return sendEmail({
    to: input.to,
    toName: input.toName,
    replyTo: input.replyTo,
    from: rendered.from_email ?? undefined,
    fromName: rendered.from_name ?? undefined,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text ?? undefined,
  });
}

/**
 * Sends a raw email via Hostinger SMTP.
 */
async function sendEmail(input: SendEmailInput): Promise<SendResult> {
  const transport = getHostingerTransport();
  if (!transport) {
    return { success: false, error: 'SMTP not configured' };
  }

  const fromEmail = input.from || getHostingerFromEmail();
  const fromName = input.fromName || getHostingerFromName();
  const from = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;
  const to = input.toName ? `"${input.toName}" <${input.to}>` : input.to;

  try {
    const info = await transport.sendMail({
      from,
      to,
      replyTo: input.replyTo,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    logger.info('EMAIL', 'Email sent via Hostinger', { messageId: info.messageId, to: input.to });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('EMAIL', 'Hostinger SMTP send failed', { to: input.to, error });
    return { success: false, error };
  }
}

export const emailService = { sendTemplateEmail, sendEmail };
