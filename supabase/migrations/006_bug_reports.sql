-- ============================================================
-- 006_bug_reports.sql
-- Bug reporting: table + RLS + Supabase Storage bucket
--
-- ARCHITECTURE:
--   - Public endpoint — anyone can submit (rate-limited in API)
--   - Only service_role can read/update/delete reports
--   - Images uploaded to 'bug-report-images' bucket via service_role
--   - Bucket is PUBLIC so images are served via permanent CDN URLs
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- TABLE
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bug_reports (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT,
    email       TEXT,
    description TEXT         NOT NULL,
    images      JSONB        NOT NULL DEFAULT '[]'::jsonb,
    page_url    TEXT,
    user_agent  TEXT,
    ip_address  TEXT,
    status      TEXT         NOT NULL DEFAULT 'new'
                             CHECK (status IN ('new', 'in_progress', 'resolved', 'closed', 'duplicate')),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.bug_reports IS 'User-submitted bug reports with optional screenshot attachments.';
COMMENT ON COLUMN public.bug_reports.images     IS 'JSONB array of {name, url, size, uploaded_at} objects.';
COMMENT ON COLUMN public.bug_reports.status     IS 'Workflow status: new → in_progress → resolved | closed | duplicate';
COMMENT ON COLUMN public.bug_reports.page_url   IS 'URL where the bug was observed (auto-captured by frontend).';
COMMENT ON COLUMN public.bug_reports.ip_address IS 'Stored for spam/abuse prevention; hash or remove if privacy required.';


-- ────────────────────────────────────────────────────────────
-- INDEXES
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_bug_reports_status
    ON public.bug_reports (status);

CREATE INDEX IF NOT EXISTS idx_bug_reports_created
    ON public.bug_reports (created_at DESC);

-- Partial index — only rows that have an email (avoids indexing NULLs)
CREATE INDEX IF NOT EXISTS idx_bug_reports_email
    ON public.bug_reports (email)
    WHERE email IS NOT NULL;


-- ────────────────────────────────────────────────────────────
-- AUTO-UPDATE updated_at  (reuses function from 002_functions_triggers.sql)
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE TRIGGER trg_bug_reports_updated_at
    BEFORE UPDATE ON public.bug_reports
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY  (table)
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- Backend (service_role) has unrestricted access for all operations
CREATE POLICY "Service role full access to bug_reports"
    ON public.bug_reports FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Authenticated users can insert their own reports via the public API
-- (In practice the API uses service_role, but this allows direct Supabase client calls too)
CREATE POLICY "Anyone can insert bug reports"
    ON public.bug_reports FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);


-- ────────────────────────────────────────────────────────────
-- STORAGE BUCKET
-- ────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'bug-report-images',
    'bug-report-images',
    true,                   -- CDN public URLs work without auth token
    10485760,               -- 10 MB per file (enforced by both bucket + API multer)
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public             = EXCLUDED.public,
    file_size_limit    = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;


-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY  (storage.objects)
-- ────────────────────────────────────────────────────────────

-- Service role: full control (upload, delete, list)
CREATE POLICY "Service role manages bug report images"
    ON storage.objects FOR ALL
    TO service_role
    USING (bucket_id = 'bug-report-images')
    WITH CHECK (bucket_id = 'bug-report-images');

-- Public: read-only (serves images in bug report admin views)
-- Note: public bucket CDN URLs bypass RLS entirely; this covers API-path reads.
CREATE POLICY "Public read access to bug report images"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'bug-report-images');
