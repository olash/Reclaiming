import { Check, X } from 'lucide-react';
import { type Estate, type Stage, accountsOf, stageOf } from '@/lib/estate';
import { cn, formatDate } from '@/lib/utils';

type StepState = 'done' | 'current' | 'upcoming' | 'problem';

function stepsFor(estate: Estate, stage: Stage): Array<{ title: string; detail: string; state: StepState }> {
  const reviewed = estate.status === 'verified' || estate.status === 'settled';
  const found = accountsOf(estate).length;
  const discovered = stage === 'accounts_found' || stage === 'settled';
  return [
    { title: 'Identity confirmed', detail: 'Checked against the national identity database.', state: 'done' },
    { title: 'Documents received', detail: `Sent on ${formatDate(estate.submitted_at)}.`, state: 'done' },
    {
      title: 'Review by our team',
      detail: stage === 'needs_attention' ? 'We could not approve the documents as they are.' : reviewed ? 'Your documents were approved.' : 'In progress. This can take up to 30 days — we will email you.',
      state: stage === 'needs_attention' ? 'problem' : reviewed ? 'done' : 'current',
    },
    {
      title: 'Find linked accounts',
      detail: discovered ? `${found} account${found === 1 ? '' : 's'} found.` : 'A consented search of every bank account linked to their BVN.',
      state: discovered ? 'done' : stage === 'find_accounts' ? 'current' : 'upcoming',
    },
    {
      title: 'Claim and release of funds',
      detail: stage === 'settled' ? 'Funds released to the estate.' : 'Each bank releases its balance to the estate account once it has the court papers.',
      state: stage === 'settled' ? 'done' : stage === 'accounts_found' ? 'current' : 'upcoming',
    },
  ];
}

const STATE_LABEL: Record<StepState, string> = { done: 'Completed', current: 'In progress', upcoming: 'Not started', problem: 'Needs attention' };

/** The whole journey, top to bottom, with where the case is right now. */
export function CaseTimeline({ estate }: { estate: Estate }) {
  const steps = stepsFor(estate, stageOf(estate));
  return (
    <ol>
      {steps.map((s, i) => (
        <li key={s.title} className="relative flex gap-4 pb-7 last:pb-0" aria-current={s.state === 'current' ? 'step' : undefined}>
          {i < steps.length - 1 && <span aria-hidden="true" className={cn('absolute left-[15px] top-8 h-full', s.state === 'done' ? 'w-[3px] bg-ink' : 'w-0 border-l-[3px] border-dotted border-ink/25')} />}
          <span
            aria-hidden="true"
            className={cn(
              'relative z-10 flex size-[2.0625rem] shrink-0 items-center justify-center rounded-full',
              s.state === 'done' && 'bg-ink text-cotton',
              s.state === 'current' && 'bg-saffron text-ink ring-4 ring-saffron/30',
              s.state === 'upcoming' && 'border-2 border-dashed border-ink/30 bg-surface',
              s.state === 'problem' && 'bg-danger text-white',
            )}
          >
            {s.state === 'done' && <Check className="size-4" strokeWidth={3} />}
            {s.state === 'problem' && <X className="size-4" strokeWidth={3} />}
            {s.state === 'current' && <span className="size-3 rounded-full bg-ink" />}
          </span>
          <div className="min-w-0">
            <p className={cn('pt-1 text-lg font-bold leading-snug', s.state === 'upcoming' && 'text-ink/55')}>
              {s.title}
              <span className="sr-only"> — {STATE_LABEL[s.state]}</span>
            </p>
            <p className="mt-0.5 text-ink/70">{s.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
