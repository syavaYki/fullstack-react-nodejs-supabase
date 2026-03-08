// ── Database ──────────────────────────────────────────────
export interface EmailTemplate {
  id: string;
  key: string;
  name: string;
  description: string | null;
  subject_template: string;
  html_template: string;
  text_template: string | null;
  default_from_email: string | null;
  default_from_name: string | null;
  available_variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Rendered output ───────────────────────────────────────
export interface RenderedEmail {
  subject: string;
  html: string;
  text: string | null;
  from_email: string | null;
  from_name: string | null;
}

// ── Service inputs ────────────────────────────────────────
export interface SendEmailInput {
  to: string;
  toName?: string;
  from?: string;
  fromName?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendTemplateEmailInput {
  to: string;
  toName?: string;
  replyTo?: string;
  templateKey: string;
  variables: Record<string, unknown>;
}

// ── Provider result ───────────────────────────────────────
export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
