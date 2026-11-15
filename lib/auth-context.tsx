'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './supabase-browser';

/** What the signed-in person may see. Decided on the server (ADMIN_EMAILS); null while unknown or signed out. */
export type Role = 'admin' | 'family' | null;

interface AuthState {
  /** True until we know whether someone is signed in. */
  loading: boolean;
  session: Session | null;
  user: User | null;
  role: Role;
  /** True until the role of a signed-in person is known. */
  roleLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthState>({ loading: true, session: null, user: null, role: null, roleLoading: true, signOut: async () => {} });

/**
 * One place that knows who is signed in. It also completes sign-ins that
 * arrive in the URL (Google, email confirmation, password reset) on whatever
 * page the provider sent the person back to, so those links never dead-end.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [session, setSession] = React.useState<Session | null>(null);

  React.useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    const cameFromLink = typeof window !== 'undefined' && /access_token=|[?&]code=/.test(window.location.hash + window.location.search);
    const isRecovery = typeof window !== 'undefined' && /type=recovery/.test(window.location.hash);
    let active = true;

    supabase().auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase().auth.onAuthStateChange((event, next) => {
      if (!active) return;
      setSession(next);
      setLoading(false);
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && isRecovery)) {
        router.replace('/reset-password');
      } else if (event === 'SIGNED_IN' && cameFromLink && !/^\/(app|admin)(\/|$)/.test(window.location.pathname)) {
        router.replace('/app');
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  // The role is asked of the server whenever a different person signs in.
  const userId = session?.user?.id ?? null;
  const token = session?.access_token ?? null;
  const [roleFor, setRoleFor] = React.useState<{ userId: string; role: Exclude<Role, null> } | null>(null);
  React.useEffect(() => {
    if (!userId || !token) return;
    if (roleFor?.userId === userId) return;
    let active = true;
    fetch('/api/admin/me', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: '{}' })
      .then((r) => (r.ok ? r.json() : { admin: false }))
      .catch(() => ({ admin: false }))
      .then((r: { admin?: boolean }) => active && setRoleFor({ userId, role: r.admin ? 'admin' : 'family' }));
    return () => {
      active = false;
    };
  }, [userId, token, roleFor?.userId]);
  const role: Role = userId && roleFor?.userId === userId ? roleFor.role : null;
  const roleLoading = loading || (!!userId && role === null);

  const signOut = React.useCallback(async () => {
    const wasAdmin = role === 'admin';
    await supabase().auth.signOut();
    try {
      Object.keys(sessionStorage).filter((k) => k.startsWith('reclaimng:')).forEach((k) => sessionStorage.removeItem(k));
    } catch {}
    router.replace(wasAdmin ? '/admin/login' : '/login');
  }, [router, role]);

  const value = React.useMemo(
    () => ({ loading, session, user: session?.user ?? null, role, roleLoading, signOut }),
    [loading, session, role, roleLoading, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => React.useContext(AuthContext);

export function displayName(user: User | null | undefined) {
  const meta = user?.user_metadata ?? {};
  return (meta.full_name as string) || (meta.name as string) || '';
}
