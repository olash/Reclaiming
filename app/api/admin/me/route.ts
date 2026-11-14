import { json, route } from '@/lib/server/http';
import { isAdmin } from '@/lib/server/admin';
import { requireUser } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

/** POST /api/admin/me — tells the app whether to show the review console. */
export const POST = route('admin-me', async (request) => {
  const user = await requireUser(request);
  return json({ admin: isAdmin(user) });
});
