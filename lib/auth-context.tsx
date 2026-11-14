'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './supabase-browser';

interface AuthState {
  /** True until we know whether someone is signed in. */
  loading: boolean;
  session: Session | null;
  user: User | null;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthState>({ loading: true, session: null, user: null, signOut: async () => {} });

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
      } else if (event === 'SIGNED_IN' && cameFromLink && !window.location.pathname.startsWith('/app')) {
        router.replace('/app');
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  const signOut = React.useCallback(async () => {
    await supabase().auth.signOut();
    try {
      Object.keys(sessionStorage).filter((k) => k.startsWith('reclaimng:')).forEach((k) => sessionStorage.removeItem(k));
    } catch {}
    router.replace('/login');
  }, [router]);

  const value = React.useMemo(() => ({ loading, session, user: session?.user ?? null, signOut }), [loading, session, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => React.useContext(AuthContext);

export function displayName(user: User | null | undefined) {
  const meta = user?.user_metadata ?? {};
  return (meta.full_name as string) || (meta.name as string) || '';
}
