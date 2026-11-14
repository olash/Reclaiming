'use client';

import * as React from 'react';
import { useAuth } from './auth-context';
import type { Estate } from './estate';
import { supabase } from './supabase-browser';

type State<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T };

const FRIENDLY = 'We could not load your cases. Check your connection and try again.';

/** The signed-in user's cases, newest first. Row-level security limits this to their own. */
export function useEstates() {
  const { user } = useAuth();
  const [state, setState] = React.useState<State<Estate[]>>({ status: 'loading' });
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    if (!user) return;
    let active = true;
    setState({ status: 'loading' });
    supabase()
      .from('estates')
      .select('*')
      .eq('user_id', user.id)
      .order('submitted_at', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('[estates]', error.message);
          setState({ status: 'error', message: FRIENDLY });
        } else setState({ status: 'ready', data: (data ?? []) as Estate[] });
      });
    return () => {
      active = false;
    };
  }, [user, nonce]);

  return { state, reload: () => setNonce((n) => n + 1) };
}

export function useEstate(id: string) {
  const { user } = useAuth();
  const [state, setState] = React.useState<State<Estate | null>>({ status: 'loading' });
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    if (!user) return;
    let active = true;
    supabase()
      .from('estates')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .limit(1)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('[estate]', error.message);
          setState({ status: 'error', message: 'We could not load this case. Check your connection and try again.' });
        } else setState({ status: 'ready', data: ((data ?? [])[0] as Estate) ?? null });
      });
    return () => {
      active = false;
    };
  }, [user, id, nonce]);

  return { state, reload: () => setNonce((n) => n + 1) };
}

/** When the signed-in user last passed the identity check (null = never / not yet known). */
export function useIdentity() {
  const { user } = useAuth();
  const [state, setState] = React.useState<State<{ verifiedAt: string; name?: string; liveness: 'none' | 'started' | 'submitted' | 'failed' } | null>>({ status: 'loading' });
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    if (!user) return;
    let active = true;
    supabase()
      .from('verifications')
      .select('created_at, profile_data')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) return setState({ status: 'ready', data: null });
        const row = data?.[0];
        const a = row?.profile_data?.applicant;
        setState({
          status: 'ready',
          data: row ? { verifiedAt: row.created_at, name: a?.firstname ? `${a.firstname} ${a.lastname ?? ''}`.trim() : undefined, liveness: row.profile_data?.liveness?.status ?? 'none' } : null,
        });
      });
    return () => {
      active = false;
    };
  }, [user, nonce]);

  return { state, reload: () => setNonce((n) => n + 1) };
}
