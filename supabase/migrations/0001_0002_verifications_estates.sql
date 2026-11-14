-- ===========================================================================
-- Reclaimng — Supabase SQL Migration (Phase 1)
-- Purpose: "Never Pay Twice" — Verification Caching Layer
-- ===========================================================================
--
-- HOW TO EXECUTE:
--   1. Open your Supabase project dashboard.
--   2. Navigate to: SQL Editor → New Query.
--   3. Paste this entire script and click "Run".
--
-- WHAT THIS DOES:
--   Creates a `verifications` table that caches the result of each successful
--   NIN lookup against QoreID. On subsequent requests, the API route checks
--   this cache first. If a record exists and is < 30 days old, the live API
--   call is skipped entirely — saving both money and latency.
--
-- Row Level Security (RLS) ensures each authenticated user can only read
-- their own verification records, enforcing strict data isolation.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. Create the verifications table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.verifications (
    id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id       UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nin           TEXT          NOT NULL UNIQUE,
    profile_data  JSONB         NOT NULL,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verifications_nin        ON public.verifications (nin);
CREATE INDEX IF NOT EXISTS idx_verifications_user_id    ON public.verifications (user_id);
CREATE INDEX IF NOT EXISTS idx_verifications_created_at ON public.verifications (created_at DESC);

ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own verifications"
    ON public.verifications FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own verifications"
    ON public.verifications FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.verifications TO authenticated;
REVOKE ALL ON public.verifications FROM anon;


-- ===========================================================================
-- Reclaimng — Supabase SQL Migration (Phase 2)
-- Purpose: Estate Submissions Tracking + Probate Document Storage
-- ===========================================================================
--
-- WHAT THIS DOES:
--   1. Creates the `estates` table to track each user's probate application,
--      document paths, payment reference, and compliance review status.
--   2. Creates the `probate_documents` Storage bucket for secure file storage.
--   3. Applies RLS policies so users can only access their own records.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. Create the estates table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.estates (
    id                              UUID          DEFAULT gen_random_uuid() PRIMARY KEY,

    -- The authenticated user who submitted this application
    user_id                         UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Human-readable identifiers
    estate_name                     TEXT          NOT NULL DEFAULT 'Unknown Estate',
    deceased_name                   TEXT          NOT NULL DEFAULT 'Unknown',

    -- Compliance workflow status.
    -- Admin changes this manually in Supabase dashboard to unlock Step 5.
    -- Values: 'pending_review' | 'under_review' | 'verified' | 'rejected'
    status                          TEXT          NOT NULL DEFAULT 'pending_review'
                                    CHECK (status IN ('pending_review', 'under_review', 'verified', 'rejected')),

    -- Paystack payment reference — proof of the ₦75,000 legal submission fee
    paystack_reference              TEXT          NOT NULL,

    -- Supabase Storage paths for uploaded documents (relative to bucket root)
    death_certificate_path          TEXT          NOT NULL,
    letter_of_administration_path   TEXT,         -- NULL if not provided (optional)

    -- Timestamps
    submitted_at                    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estates_user_id     ON public.estates (user_id);
CREATE INDEX IF NOT EXISTS idx_estates_status      ON public.estates (status);
CREATE INDEX IF NOT EXISTS idx_estates_submitted_at ON public.estates (submitted_at DESC);


-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS estates_updated_at ON public.estates;
CREATE TRIGGER estates_updated_at
    BEFORE UPDATE ON public.estates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();


-- ---------------------------------------------------------------------------
-- 2. Enable RLS and set policies on estates
-- ---------------------------------------------------------------------------

ALTER TABLE public.estates ENABLE ROW LEVEL SECURITY;

-- SELECT: Users read only their own estate records.
CREATE POLICY "Users can view their own estates"
    ON public.estates FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- INSERT: Only the owning user may create a record.
-- (In practice the API route using service_role handles all inserts.)
CREATE POLICY "Users can create their own estates"
    ON public.estates FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- UPDATE + DELETE: Blocked. Status changes are admin-only via dashboard.

GRANT SELECT, INSERT ON public.estates TO authenticated;
REVOKE ALL ON public.estates FROM anon;


-- ---------------------------------------------------------------------------
-- 3. Create the probate_documents Storage bucket
-- ---------------------------------------------------------------------------
-- NOTE: If the INSERT below fails, create the bucket manually:
--   Supabase Dashboard → Storage → New Bucket
--     Name: probate_documents   |   Public: OFF
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'probate_documents',
    'probate_documents',
    false,           -- PRIVATE: no public URLs
    10485760,        -- 10 MB per file
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;  -- Idempotent: safe to re-run


-- ---------------------------------------------------------------------------
-- 4. Storage RLS Policies for probate_documents
-- ---------------------------------------------------------------------------

-- UPLOAD: Authenticated users may upload to their own folder only.
-- Folder structure enforced: {user_id}/{timestamp}_{filename}
CREATE POLICY "Users can upload their own probate documents"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'probate_documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- READ: Users may only read their own documents.
CREATE POLICY "Users can read their own probate documents"
    ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'probate_documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- DELETE & UPDATE: Blocked for all clients. (No policies = no access.)


-- ---------------------------------------------------------------------------
-- 5. Verification queries
-- ---------------------------------------------------------------------------
--
--   SELECT tablename, rowsecurity FROM pg_tables
--   WHERE tablename IN ('verifications', 'estates');
--   -- Expected: rowsecurity = true for both rows
--
--   SELECT policyname, tablename FROM pg_policies
--   WHERE tablename IN ('verifications', 'estates');
--   -- Expected: 4 policies total
--
--   SELECT id, name, public FROM storage.buckets
--   WHERE id = 'probate_documents';
--   -- Expected: 1 row, public = false
--
-- ===========================================================================
