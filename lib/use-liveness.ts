'use client';

import * as React from 'react';
import { ApiError, api } from './api';

export type LivenessOutcome = { status: 'submitted' } | { status: 'failed'; message: string } | { status: 'closed' } | { status: 'error'; message: string };

export const LIVENESS_MODE: 'required' | 'optional' | 'off' = (() => {
  const v = (process.env.NEXT_PUBLIC_LIVENESS_MODE || 'required').toLowerCase();
  return v === 'optional' || v === 'off' ? v : 'required';
})();

interface SessionResponse {
  token: string;
  reference: string;
  applicant: { firstname: string; lastname: string; email?: string };
  identity: { idType: string; idNumber: string; requiredIdType?: string };
}

/**
 * Runs QoreID's selfie liveness check (Web SDK, product `liveness_nin`).
 * The session token is minted on our server; the outcome is reported back to
 * our server, which records it against the session it started.
 */
export function useLiveness() {
  const [running, setRunning] = React.useState(false);

  const run = React.useCallback(async (): Promise<LivenessOutcome> => {
    setRunning(true);
    try {
      const session = await api<SessionResponse>('/api/identity/liveness/session');
      const { default: QoreID } = await import('@qore-id/web-sdk');
      QoreID.removeAllListeners();

      const outcome = await new Promise<LivenessOutcome>((resolve) => {
        let settled = false;
        const finish = (o: LivenessOutcome) => {
          if (settled) return;
          settled = true;
          QoreID.removeAllListeners();
          resolve(o);
        };
        QoreID.on('success', async (event: any) => {
          try {
            const r = await api<{ status: 'submitted' | 'failed' }>('/api/identity/liveness/result', { reference: session.reference, outcome: 'submitted', detail: event?.detail ?? event });
            QoreID.close();
            finish(r.status === 'submitted' ? { status: 'submitted' } : { status: 'failed', message: 'The selfie did not match the photo on your NIN record. Please try again in good light.' });
          } catch (err) {
            finish({ status: 'error', message: (err as ApiError).message });
          }
        });
        QoreID.on('error', async (event: any) => {
          const detail = event?.detail ?? event;
          await api('/api/identity/liveness/result', { reference: session.reference, outcome: 'error', detail }).catch(() => {});
          finish({ status: 'failed', message: 'The selfie check could not be completed. Please make sure your camera is allowed and try again.' });
        });
        QoreID.on('close', () => finish({ status: 'closed' }));
        QoreID.start({
          token: session.token,
          customerReference: session.reference,
          applicantData: session.applicant,
          identityData: session.identity,
        }).catch(() => finish({ status: 'error', message: 'We could not open the selfie check. Please check your connection and try again.' }));
      });
      return outcome;
    } catch (err) {
      return { status: 'error', message: (err as ApiError).message || 'We could not start the selfie check.' };
    } finally {
      setRunning(false);
    }
  }, []);

  return { run, running };
}
