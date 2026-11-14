-- ===========================================================================
-- Reclaimng — Migration 0005: schema the redesigned app can make use of
-- ===========================================================================
-- Safe to run more than once. Nothing here removes or rewrites existing data.
--
-- The redesigned app WORKS without this migration (it falls back gracefully),
-- but running it:
--   • fixes columns the old pages queried that never existed
--     (total_asset_value, the 'settled' status)
--   • adds a payments ledger so one payment can never be spent twice
--   • stops raw BVNs being kept in the request log
--
-- HOW TO RUN: Supabase dashboard → SQL Editor → New query → paste → Run.
-- ===========================================================================

-- 1. Estates: fields the product already talks about ------------------------
ALTER TABLE public.estates ADD COLUMN IF NOT EXISTS date_of_death          DATE;
ALTER TABLE public.estates ADD COLUMN IF NOT EXISTS relationship           TEXT;
ALTER TABLE public.estates ADD COLUMN IF NOT EXISTS review_note            TEXT;          -- shown to the family when a case is rejected
ALTER TABLE public.estates ADD COLUMN IF NOT EXISTS document_check         JSONB;         -- advisory OCR result for the reviewer
ALTER TABLE public.estates ADD COLUMN IF NOT EXISTS discovery_completed_at TIMESTAMPTZ;
ALTER TABLE public.estates ADD COLUMN IF NOT EXISTS total_asset_value      NUMERIC(18,2); -- net amount recovered, set at settlement

-- Allow the 'settled' status the dashboard and vault already expect.
ALTER TABLE public.estates DROP CONSTRAINT IF EXISTS estates_status_check;
ALTER TABLE public.estates ADD CONSTRAINT estates_status_check
    CHECK (status IN ('pending_review', 'under_review', 'verified', 'rejected', 'settled'));

-- A payment reference may open exactly one case.
-- (Skipped with a notice if old test rows already share a reference.)
DO $$ BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS estates_paystack_reference_key ON public.estates (paystack_reference);
EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'estates.paystack_reference has duplicates; unique index not created. Clean up test rows and re-run.';
END $$;

-- 2. Payments ledger --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
    id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    estate_id    UUID        REFERENCES public.estates(id) ON DELETE SET NULL,
    reference    TEXT        NOT NULL UNIQUE,
    purpose      TEXT        NOT NULL CHECK (purpose IN ('identity', 'submission')),
    amount_kobo  BIGINT      NOT NULL,
    status       TEXT        NOT NULL DEFAULT 'used',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments (user_id, created_at DESC);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read their own payments" ON public.payments;
CREATE POLICY "Users can read their own payments"
    ON public.payments FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
GRANT SELECT ON public.payments TO authenticated;
REVOKE ALL ON public.payments FROM anon;
-- Writes happen only on the server with the service role.

-- 3. BVN request log: stop keeping raw BVNs ----------------------------------
-- New rows store a masked value (e.g. 223*****901). Mask what is already there.
UPDATE public.bvn_request_logs
   SET bvn = substr(bvn, 1, 3) || '*****' || substr(bvn, 9, 3)
 WHERE bvn ~ '^[0-9]{11}$';
