import { HttpError } from './http';
import { adminClient } from './supabase';

export interface VerificationRow {
  id: string;
  user_id: string;
  nin: string;
  created_at: string;
  profile_data: {
    applicant?: { firstname?: string; lastname?: string };
    liveness?: { status: 'started' | 'submitted' | 'failed'; reference: string; product?: string; started_at?: string; completed_at?: string; result?: Record<string, unknown>; message?: string };
    [key: string]: unknown;
  };
}

/** The caller's most recent identity check, or null. */
export async function latestVerification(userId: string): Promise<VerificationRow | null> {
  const { data, error } = await adminClient()
    .from('verifications')
    .select('id, user_id, nin, created_at, profile_data')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) {
    console.error('[identity] lookup failed:', error.message);
    throw new HttpError(500, 'We could not load your identity check. Please try again.', 'DB_ERROR');
  }
  return (data?.[0] as VerificationRow) ?? null;
}

export async function saveProfile(row: VerificationRow, patch: Partial<VerificationRow['profile_data']>) {
  const profile = { ...row.profile_data, ...patch };
  const { error } = await adminClient().from('verifications').update({ profile_data: profile }).eq('id', row.id);
  if (error) {
    console.error('[identity] save failed:', error.message);
    throw new HttpError(500, 'We could not save the result. Please try again.', 'DB_ERROR');
  }
  return profile;
}

export const livenessPassed = (row: VerificationRow | null) => !!row && row.profile_data?.liveness?.status === 'submitted';
