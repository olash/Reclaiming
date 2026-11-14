import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { HttpError } from './http';

let admin: SupabaseClient | null = null;

/** Service-role client. Server only — bypasses RLS, so every caller must authorise first. */
export function adminClient(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('[supabase] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.');
    throw new HttpError(503, 'The service is not fully configured yet. Please contact support.', 'NOT_CONFIGURED');
  }
  admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

/**
 * Identifies the caller from their Supabase access token.
 * The user id is ALWAYS taken from the verified token, never from the request body.
 */
export async function requireUser(request: Request): Promise<User> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new HttpError(401, 'Please sign in to continue.', 'UNAUTHENTICATED');
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, 'Your session has expired. Please sign in again.', 'UNAUTHENTICATED');
  return data.user;
}

export interface EstateRow {
  id: string;
  user_id: string;
  estate_name: string;
  deceased_name: string;
  status: 'pending_review' | 'under_review' | 'verified' | 'rejected' | 'settled';
  payment_status: 'unpaid' | 'paid' | 'refunded';
  paystack_reference: string;
  mandate_acknowledged: boolean;
  discovered_accounts: unknown[] | null;
  death_certificate_path: string;
  letter_of_administration_path: string | null;
  submitted_at: string;
  updated_at: string;
  [key: string]: unknown;
}

/** Loads an estate and proves it belongs to the caller. A stranger's id looks the same as a missing one. */
export async function requireOwnEstate(userId: string, estateId: string): Promise<EstateRow> {
  const { data, error } = await adminClient().from('estates').select('*').eq('id', estateId).limit(1);
  if (error) {
    console.error('[supabase] estate lookup failed:', error.message);
    throw new HttpError(500, 'We could not load this case. Please try again.', 'DB_ERROR');
  }
  const estate = data?.[0] as EstateRow | undefined;
  if (!estate || estate.user_id !== userId) throw new HttpError(404, 'We could not find that case.', 'ESTATE_NOT_FOUND');
  return estate;
}

/** True when a PostgREST error means "that table/column has not been migrated yet". */
export function isMissingSchema(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return ['PGRST204', 'PGRST205', '42P01', '42703'].includes(error.code ?? '') || /schema cache|does not exist/i.test(error.message ?? '');
}

/**
 * Insert that survives a database which is behind on migrations: if PostgREST
 * reports an unknown column, that column is dropped and the insert retried.
 * Lets a demo keep working while migrations are pending; the dropped columns
 * are logged so the gap is visible.
 */
export async function insertTolerant(table: string, row: Record<string, unknown>, select = 'id') {
  const data = { ...row };
  const dropped: string[] = [];
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await adminClient().from(table).insert(data).select(select);
    const missing = res.error?.code === 'PGRST204' ? /'([^']+)' column/.exec(res.error.message)?.[1] : undefined;
    if (missing && missing in data) {
      delete data[missing];
      dropped.push(missing);
      continue;
    }
    if (dropped.length) console.warn(`[supabase] ${table}: column(s) ${dropped.join(', ')} missing — run the pending migrations.`);
    return res;
  }
  return adminClient().from(table).insert(data).select(select);
}
