'use client';

import * as React from 'react';

/**
 * The answers a family has given so far in "Start a recovery".
 * Kept in sessionStorage so a refresh, a dropped connection or the Paystack
 * window never wipes them — and cleared when the tab closes or they sign out,
 * so nothing sensitive lingers on a shared phone or cybercafé computer.
 */
export interface Draft {
  step: number;
  firstname: string;
  lastname: string;
  phone: string;
  dob: string;
  nin: string;
  deceasedName: string;
  dateOfDeath: string;
  relationship: string;
  /** Paid but not yet used payment references, so nobody is asked to pay twice. */
  identityRef: string;
  submissionRef: string;
  consent: boolean;
}

export const EMPTY_DRAFT: Draft = {
  step: 0, firstname: '', lastname: '', phone: '', dob: '', nin: '', deceasedName: '', dateOfDeath: '', relationship: '',
  identityRef: '', submissionRef: '', consent: false,
};

const key = (userId: string) => `reclaiming:draft:${userId}`;

export function readDraft(userId: string): Draft | null {
  try {
    const raw = sessionStorage.getItem(key(userId));
    return raw ? { ...EMPTY_DRAFT, ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}

export function clearDraft(userId: string) {
  try {
    sessionStorage.removeItem(key(userId));
  } catch {}
}

export function useDraft(userId: string | undefined) {
  const [draft, setDraft] = React.useState<Draft>(EMPTY_DRAFT);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (!userId) return;
    setDraft(readDraft(userId) ?? EMPTY_DRAFT);
    setReady(true);
  }, [userId]);

  const update = React.useCallback(
    (patch: Partial<Draft>) => {
      setDraft((prev) => {
        const next = { ...prev, ...patch };
        if (userId) {
          try {
            sessionStorage.setItem(key(userId), JSON.stringify(next));
          } catch {}
        }
        return next;
      });
    },
    [userId],
  );

  return { draft, update, ready };
}
