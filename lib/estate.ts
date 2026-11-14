import type { BadgeProps } from '@/components/ui/badge';

export interface Account {
  bank_name: string;
  bank_code: string | null;
  account_number: string;
  account_name: string | null;
  account_type: string | null;
}

export interface Estate {
  id: string;
  user_id: string;
  estate_name: string;
  deceased_name: string;
  status: 'pending_review' | 'under_review' | 'verified' | 'rejected' | 'settled';
  payment_status: 'unpaid' | 'paid' | 'refunded';
  mandate_acknowledged: boolean;
  discovered_accounts: unknown[] | null;
  death_certificate_path: string | null;
  letter_of_administration_path: string | null;
  submitted_at: string;
  updated_at: string;
  // Present once migration 0005 has been run:
  date_of_death?: string | null;
  review_note?: string | null;
  total_asset_value?: number | null;
  discovery_completed_at?: string | null;
}

/** Accepts every shape an account has ever been stored in and returns one. */
export function normaliseAccount(raw: any): Account {
  const inst = raw?.institution;
  return {
    bank_name: (typeof inst === 'object' && inst ? inst.name : inst) || raw?.bank_name || raw?.bankName || raw?.bank || 'Unknown bank',
    bank_code: (typeof inst === 'object' && inst ? inst.bank_code : null) ?? raw?.bank_code ?? null,
    account_number: String(raw?.account_number ?? raw?.accountNumber ?? ''),
    account_name: raw?.account_name ?? raw?.accountName ?? null,
    account_type: raw?.account_type ?? raw?.type ?? null,
  };
}

export const accountsOf = (estate: Estate): Account[] =>
  (Array.isArray(estate.discovered_accounts) ? estate.discovered_accounts : []).map(normaliseAccount).filter((a) => a.account_number);

/**
 * Where a case is, in the family's terms. The database has a few separate
 * flags (status, mandate_acknowledged, discovered_accounts); this turns them
 * into ONE answer to "what is happening, and what do I do next?".
 */
export type Stage = 'in_review' | 'needs_attention' | 'find_accounts' | 'accounts_found' | 'settled';

export function stageOf(estate: Estate): Stage {
  if (estate.status === 'settled') return 'settled';
  if (estate.status === 'rejected') return 'needs_attention';
  if (estate.status !== 'verified') return 'in_review';
  if (accountsOf(estate).length > 0) return 'accounts_found';
  return 'find_accounts';
}

interface StageCopy {
  badge: string;
  tone: NonNullable<BadgeProps['tone']>;
  /** One sentence: what is happening now. */
  summary: string;
  /** The button on the case card, when the family has something to do. */
  action?: string;
  /** Who has the next move. */
  waitingOn: 'you' | 'us' | 'nobody';
}

export const STAGE_COPY: Record<Stage, StageCopy> = {
  in_review: {
    badge: 'In review',
    tone: 'warning',
    summary: 'Our team is checking your documents. There is nothing you need to do right now.',
    waitingOn: 'us',
  },
  needs_attention: {
    badge: 'Needs your attention',
    tone: 'danger',
    summary: 'We could not approve the documents as they are. Open the case to see what to do next.',
    action: 'See what to do',
    waitingOn: 'you',
  },
  find_accounts: {
    badge: 'Your turn',
    tone: 'info',
    summary: 'Your documents are approved. Next, search for every bank account linked to their BVN.',
    action: 'Find accounts',
    waitingOn: 'you',
  },
  accounts_found: {
    badge: 'Accounts found',
    tone: 'success',
    summary: 'We found accounts linked to your loved one. Open the case to see them and the next steps.',
    action: 'View accounts',
    waitingOn: 'you',
  },
  settled: {
    badge: 'Completed',
    tone: 'success',
    summary: 'This recovery is complete.',
    action: 'View summary',
    waitingOn: 'nobody',
  },
};

export const isOpen = (e: Estate) => e.status !== 'settled';

export const RELATIONSHIPS = ['Spouse', 'Child', 'Parent', 'Sibling', 'Other relative', 'Executor or lawyer'] as const;
