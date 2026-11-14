'use client';

import * as React from 'react';
import { FEES, type FeePurpose } from './fees';

declare global {
  interface Window {
    PaystackPop?: new () => { newTransaction: (options: Record<string, unknown>) => void };
  }
}

const SCRIPT = 'https://js.paystack.co/v2/inline.js';
let loading: Promise<void> | null = null;

function loadPaystack(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.PaystackPop) return Promise.resolve();
  if (!loading) {
    loading = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SCRIPT;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        loading = null;
        reject(new Error('Paystack could not be loaded'));
      };
      document.head.appendChild(s);
    });
  }
  return loading;
}

export type PayResult = { status: 'paid'; reference: string } | { status: 'cancelled' } | { status: 'error'; message: string };

/**
 * Opens Paystack checkout for one of our fixed fees.
 * The amount always comes from lib/fees.ts and the result is only a claim:
 * the server re-checks every reference with Paystack before acting on it.
 */
export function usePaystack() {
  React.useEffect(() => {
    loadPaystack().catch(() => {});
  }, []);

  return React.useCallback(async (opts: { purpose: FeePurpose; email: string; userId: string }): Promise<PayResult> => {
    const key = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
    if (!key) return { status: 'error', message: 'Payments are not set up yet. Please contact support.' };
    try {
      await loadPaystack();
    } catch {
      return { status: 'error', message: 'We could not open the payment window. Check your connection and try again.' };
    }
    return new Promise<PayResult>((resolve) => {
      try {
        new window.PaystackPop!().newTransaction({
          key,
          email: opts.email,
          amount: FEES[opts.purpose].kobo,
          currency: 'NGN',
          reference: `RC_${opts.purpose === 'identity' ? 'ID' : 'DOC'}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
          metadata: { user_id: opts.userId, purpose: opts.purpose },
          onSuccess: (tx: { reference: string }) => resolve({ status: 'paid', reference: tx.reference }),
          onCancel: () => resolve({ status: 'cancelled' }),
          onError: (err: { message?: string }) => resolve({ status: 'error', message: err?.message || 'The payment did not go through. Please try again.' }),
        });
      } catch {
        resolve({ status: 'error', message: 'We could not open the payment window. Please refresh the page and try again.' });
      }
    });
  }, []);
}
