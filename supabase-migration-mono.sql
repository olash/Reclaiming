-- ===========================================================================
-- Reclaimng — Supabase SQL Migration (Phase 3: Mono iGree BVN)
-- Purpose: Rate Limiting & Discovered Accounts Schema Update
-- ===========================================================================

-- 1. Create BVN Request Logs Table (for Throttling)
CREATE TABLE IF NOT EXISTS public.bvn_request_logs (
    id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id       UUID          REFERENCES auth.users(id) ON DELETE CASCADE,
    ip_address    TEXT,
    bvn           TEXT          NOT NULL,
    status        TEXT          NOT NULL, -- 'success' or 'failed'
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Index for fast rate limiting queries
CREATE INDEX IF NOT EXISTS idx_bvn_request_logs_ip ON public.bvn_request_logs (ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bvn_request_logs_user ON public.bvn_request_logs (user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.bvn_request_logs ENABLE ROW LEVEL SECURITY;
-- No policies needed since we only insert/select via Service Role Key on the backend

-- 2. Add `discovered_accounts` to `estates` table
ALTER TABLE public.estates 
ADD COLUMN IF NOT EXISTS discovered_accounts JSONB DEFAULT '[]'::jsonb;
