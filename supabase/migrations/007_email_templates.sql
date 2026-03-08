-- ============================================================
-- 007_email_templates.sql
-- Email template system for Hostinger SMTP notifications.
--
-- Templates use {{variable}} interpolation (server-side).
-- All templates here route through Hostinger SMTP only.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- TABLE
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.email_templates (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    key                 TEXT         NOT NULL UNIQUE,
    name                TEXT         NOT NULL,
    description         TEXT,
    subject_template    TEXT         NOT NULL,
    html_template       TEXT         NOT NULL,
    text_template       TEXT,
    default_from_email  TEXT,
    default_from_name   TEXT,
    available_variables JSONB        NOT NULL DEFAULT '[]'::jsonb,
    is_active           BOOLEAN      NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.email_templates IS 'DB-backed email templates with {{variable}} interpolation. Cached in-process for 5 min.';
COMMENT ON COLUMN public.email_templates.key                 IS 'Unique string identifier used by emailService.sendTemplateEmail().';
COMMENT ON COLUMN public.email_templates.available_variables IS 'JSON array of variable names for documentation purposes.';

CREATE INDEX IF NOT EXISTS idx_email_templates_key    ON public.email_templates (key);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON public.email_templates (is_active) WHERE is_active = true;

CREATE OR REPLACE TRIGGER trg_email_templates_updated_at
    BEFORE UPDATE ON public.email_templates
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Service role reads/writes templates (backend only)
CREATE POLICY "Service role full access to email_templates"
    ON public.email_templates FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);


-- ────────────────────────────────────────────────────────────
-- SEED TEMPLATES
-- Idempotent: ON CONFLICT DO UPDATE ensures re-runnable
-- ────────────────────────────────────────────────────────────

INSERT INTO public.email_templates
    (key, name, description, subject_template, html_template, text_template, available_variables)
VALUES

-- ── Contact: admin notification ──────────────────────────
(
    'contact_admin_notification',
    'Contact Form — Admin Notification',
    'Sent to the admin when a new contact form is submitted.',
    'New Contact Form Submission: {{subject}}',
    '<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;background:#f8fafc;margin:0;padding:24px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:28px 32px">
      <h1 style="margin:0;color:#fff;font-size:1.25rem">New Contact Form Submission</h1>
    </div>
    <div style="padding:28px 32px">
      <table style="width:100%;border-collapse:collapse;font-size:.9rem">
        <tr><td style="padding:6px 0;color:#64748b;width:130px">From</td><td><strong>{{first_name}} {{last_name}}</strong> &lt;{{email}}&gt;</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Subject</td><td>{{subject}}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Submitted</td><td>{{submitted_at}}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">IP</td><td>{{ip_address}}</td></tr>
      </table>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
      <p style="color:#64748b;margin:0 0 8px;font-size:.85rem;text-transform:uppercase;letter-spacing:.05em">Message</p>
      <p style="background:#f8fafc;border-left:3px solid #2563eb;padding:14px 16px;border-radius:4px;margin:0;white-space:pre-wrap">{{message}}</p>
    </div>
    <div style="padding:16px 32px;background:#f8fafc;font-size:.8rem;color:#94a3b8">
      Reply to this email to respond directly to the sender.
    </div>
  </div>
</body>
</html>',
    'New Contact Form Submission: {{subject}}

From: {{first_name}} {{last_name}} <{{email}}>
Submitted: {{submitted_at}}

{{message}}',
    '["first_name", "last_name", "email", "subject", "message", "submitted_at", "ip_address"]'
),

-- ── Bug Report: admin notification ───────────────────────
(
    'bug_report_admin_notification',
    'Bug Report — Admin Notification',
    'Sent to the admin when a new bug report is submitted.',
    'New Bug Report: {{description}}',
    '<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;background:#f8fafc;margin:0;padding:24px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#dc2626,#9f1239);padding:28px 32px">
      <h1 style="margin:0;color:#fff;font-size:1.25rem">🐛 New Bug Report</h1>
    </div>
    <div style="padding:28px 32px">
      <table style="width:100%;border-collapse:collapse;font-size:.9rem">
        <tr><td style="padding:6px 0;color:#64748b;width:130px">Reporter</td><td><strong>{{name}}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Email</td><td>{{email}}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Page URL</td><td>{{page_url}}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Images</td><td>{{image_count}} attached</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Submitted</td><td>{{submitted_at}}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">IP</td><td>{{ip_address}}</td></tr>
      </table>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
      <p style="color:#64748b;margin:0 0 8px;font-size:.85rem;text-transform:uppercase;letter-spacing:.05em">Description</p>
      <p style="background:#fff5f5;border-left:3px solid #dc2626;padding:14px 16px;border-radius:4px;margin:0 0 20px;white-space:pre-wrap">{{description}}</p>
      <p style="color:#64748b;margin:0 0 8px;font-size:.85rem;text-transform:uppercase;letter-spacing:.05em">Attachments</p>
      <pre style="background:#f8fafc;padding:12px;border-radius:4px;font-size:.8rem;margin:0">{{image_list}}</pre>
    </div>
  </div>
</body>
</html>',
    'New Bug Report

Reporter: {{name}} ({{email}})
Page: {{page_url}}
Submitted: {{submitted_at}}

{{description}}

Attachments:
{{image_list}}',
    '["name", "email", "description", "page_url", "image_count", "image_list", "submitted_at", "ip_address"]'
)

ON CONFLICT (key) DO UPDATE SET
    name                = EXCLUDED.name,
    description         = EXCLUDED.description,
    subject_template    = EXCLUDED.subject_template,
    html_template       = EXCLUDED.html_template,
    text_template       = EXCLUDED.text_template,
    available_variables = EXCLUDED.available_variables,
    is_active           = EXCLUDED.is_active,
    updated_at          = NOW();
