-- ===========================================================================
-- Reclaimng — Supabase SQL Migration
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
    -- Primary key: auto-generated UUID for each verification record
    id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Links this record to the Supabase Auth user who triggered the lookup
    user_id       UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- The NIN that was verified. Unique constraint prevents duplicate records.
    nin           TEXT          NOT NULL UNIQUE,

    -- The full JSON response from QoreID (name, DOB, photo URL, etc.)
    -- Stored as JSONB for efficient indexing and querying.
    profile_data  JSONB         NOT NULL,

    -- Timestamp of when this verification was first cached.
    -- Used by the API route to enforce the 30-day cache window.
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Index on nin for fast lookups (the most common query pattern)
CREATE INDEX IF NOT EXISTS idx_verifications_nin
    ON public.verifications (nin);

-- Index on user_id for fast per-user queries
CREATE INDEX IF NOT EXISTS idx_verifications_user_id
    ON public.verifications (user_id);

-- Index on created_at to efficiently filter by the 30-day window
CREATE INDEX IF NOT EXISTS idx_verifications_created_at
    ON public.verifications (created_at DESC);


-- ---------------------------------------------------------------------------
-- 2. Enable Row Level Security (RLS)
-- ---------------------------------------------------------------------------
-- RLS is OFF by default. Enabling it means NO row is readable unless an
-- explicit policy grants access. This is the secure default for user data.

ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------------
-- 3. RLS Policies
-- ---------------------------------------------------------------------------

-- POLICY: SELECT — Authenticated users may only read their own records.
-- `auth.uid()` returns the UUID of the currently authenticated Supabase user.
-- This prevents User A from ever reading User B's NIN or identity data.

CREATE POLICY "Users can read their own verifications"
    ON public.verifications
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);


-- POLICY: INSERT — Authenticated users may only insert their own records.
-- The `user_id` in the new row must match the session user's UID.
-- The server-side API route (using the service_role key) bypasses RLS
-- and handles all inserts. This policy is a defence-in-depth measure
-- for any direct client SDK calls.

CREATE POLICY "Users can insert their own verifications"
    ON public.verifications
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);


-- POLICY: UPDATE — Explicitly deny direct updates from client.
-- All cache refreshes go through the server-side API route only.
-- (No UPDATE policy → no client can update records.)


-- POLICY: DELETE — Explicitly deny deletion from the client.
-- Records are managed exclusively by the server or Supabase admin.
-- (No DELETE policy → no client can delete records.)


-- ---------------------------------------------------------------------------
-- 4. Grant Necessary Permissions to the anon & authenticated roles
-- ---------------------------------------------------------------------------
-- Supabase uses two primary roles for client access:
--   anon        → unauthenticated requests
--   authenticated → logged-in users (after auth.signIn)
--
-- We grant SELECT/INSERT to `authenticated` only (no anonymous access).

GRANT SELECT, INSERT ON public.verifications TO authenticated;

-- Revoke any broad public access (defence-in-depth)
REVOKE ALL ON public.verifications FROM anon;


-- ---------------------------------------------------------------------------
-- 5. Verification: Run these queries to confirm setup is correct
-- ---------------------------------------------------------------------------
-- After running the script above, you can verify with:
--
--   SELECT tablename, rowsecurity
--   FROM pg_tables
--   WHERE tablename = 'verifications';
--   -- Expected: rowsecurity = true
--
--   SELECT policyname, cmd, roles, qual
--   FROM pg_policies
--   WHERE tablename = 'verifications';
--   -- Expected: two policies listed above
-- ===========================================================================
