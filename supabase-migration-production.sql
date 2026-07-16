-- ===========================================================================
-- Reclaimng — Supabase SQL Migration (Phase 4: Live Production)
-- Purpose: Payment Status tracking and Paywall Enforcement
-- ===========================================================================

-- 1. Add `payment_status` to `estates` table
ALTER TABLE public.estates 
ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
CHECK (payment_status IN ('unpaid', 'paid', 'refunded'));

-- Index for efficient paywall checking
CREATE INDEX IF NOT EXISTS idx_estates_payment_status ON public.estates (payment_status);
