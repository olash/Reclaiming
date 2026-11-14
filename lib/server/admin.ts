import type { User } from '@supabase/supabase-js';
import { HttpError } from './http';
import { requireUser } from './supabase';

/** Staff are listed by email in ADMIN_EMAILS (comma-separated). */
export function isAdmin(user: Pick<User, 'email'> | null | undefined) {
  const list = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return !!user?.email && list.includes(user.email.toLowerCase());
}

export async function requireAdmin(request: Request): Promise<User> {
  const user = await requireUser(request);
  if (!isAdmin(user)) throw new HttpError(403, 'This area is for the Reclaimng review team.', 'FORBIDDEN');
  return user;
}
