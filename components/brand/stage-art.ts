import type { Stage } from '@/lib/estate';
import type { MotifName } from './motifs';

/** Each stage of a case has its own cloth: a motif and a dye. */
export const STAGE_ART: Record<Stage, { motif: MotifName; tone: string; step: number }> = {
  in_review: { motif: 'spiral', tone: 'bg-saffron text-ink', step: 3 },
  needs_attention: { motif: 'zigzag', tone: 'bg-clay text-cotton', step: 3 },
  find_accounts: { motif: 'waves', tone: 'bg-indigo text-cotton', step: 4 },
  accounts_found: { motif: 'dots', tone: 'bg-leaf text-cotton', step: 5 },
  settled: { motif: 'house', tone: 'bg-ink text-cotton', step: 5 },
};
