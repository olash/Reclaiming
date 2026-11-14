'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, ChevronRight, Clock, FileText, Fingerprint, FolderHeart, PlusCircle, ScrollText } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { displayName, useAuth } from '@/lib/auth-context';
import { readDraft } from '@/lib/draft';
import { STAGE_COPY, isOpen, stageOf, type Estate } from '@/lib/estate';
import { AdireQuilt, Motif } from '@/components/brand/motifs';
import { STAGE_ART } from '@/components/brand/stage-art';
import { useEstates } from '@/lib/use-estates';
import { caseRef, cn, formatDate } from '@/lib/utils';

type Filter = 'all' | 'open' | 'done';

function CaseCard({ estate }: { estate: Estate }) {
  const stage = stageOf(estate);
  const copy = STAGE_COPY[stage];
  const art = STAGE_ART[stage];
  return (
    <li>
      <Card className="group flex overflow-hidden transition-shadow hover:shadow-pop">
        <div className={cn('relative hidden w-28 shrink-0 sm:block', art.tone)} aria-hidden="true">
          <Motif name={art.motif} seed={estate.id.length + 3} className="absolute inset-0 size-full p-4 opacity-45 transition-transform duration-500 group-hover:scale-110" />
        </div>
        <div className="min-w-0 flex-1 p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-muted-foreground">{caseRef(estate.id)} · Opened {formatDate(estate.submitted_at)}</p>
              <h2 className="mt-1 text-2xl font-bold leading-tight">
                <Link href={`/app/estates/${estate.id}`} className="rounded-sm decoration-saffron decoration-[3px] underline-offset-4 hover:underline">{estate.estate_name}</Link>
              </h2>
            </div>
            <Badge tone={copy.tone}>
              {copy.waitingOn === 'us' ? <Clock aria-hidden="true" /> : copy.tone === 'success' ? <CheckCircle2 aria-hidden="true" /> : null}
              {copy.badge}
            </Badge>
          </div>
          <div className="mt-5 flex gap-1.5" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className={cn('h-1.5 flex-1 rounded-full', n < art.step || stage === 'settled' ? 'bg-ink' : n === art.step ? 'bg-saffron' : 'bg-ink/10')} />
            ))}
          </div>
          <p className="mt-4 text-ink/75">{copy.summary}</p>
          <div className="mt-6">
            {copy.action ? (
              <Button asChild size="sm"><Link href={`/app/estates/${estate.id}`}>{copy.action} <ArrowRight aria-hidden="true" /></Link></Button>
            ) : (
              <Button asChild size="sm" variant="secondary"><Link href={`/app/estates/${estate.id}`}>View case <ChevronRight aria-hidden="true" /></Link></Button>
            )}
          </div>
        </div>
      </Card>
    </li>
  );
}

function EmptyState({ hasDraft }: { hasDraft: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-card">
      <AdireQuilt cols={6} tiles={['sun', 'waves', 'coin', 'leaves', 'dots', 'zigzag']} className="bg-indigo-night p-0 [&>div]:aspect-[1/0.7]" />
      <div className="p-6 sm:p-10">
        <h2 className="text-display-md font-extrabold">{hasDraft ? 'Pick up where you stopped' : 'Start your first recovery'}</h2>
        <p className="mt-4 max-w-xl text-lg text-ink/75">
          {hasDraft
            ? 'Your answers so far are saved on this device. Continue when you are ready.'
            : 'We will ask a few questions about you and your loved one, then check your documents. It takes about 10 minutes, and you can stop and come back.'}
        </p>
        <h3 className="mt-8 font-sans text-sm font-bold uppercase tracking-[0.14em] text-clay">Have these ready</h3>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            [Fingerprint, 'Your NIN', 'The 11-digit number on your NIN slip.'],
            [FileText, 'The death certificate', 'A clear photo or scan (PDF, JPG or PNG).'],
            [ScrollText, 'Letters of Administration', 'Optional for now. Banks will ask for them later.'],
          ].map(([Icon, title, body]: any) => (
            <li key={title} className="rounded-md border border-dashed border-ink/25 p-4">
              <Icon className="size-6 text-primary" aria-hidden="true" />
              <p className="mt-3 font-bold">{title}</p>
              <p className="mt-1 text-[0.95rem] text-ink/70">{body}</p>
            </li>
          ))}
        </ul>
        <Button asChild size="lg" variant="accent" className="mt-9 w-full sm:w-auto">
          <Link href="/app/new">{hasDraft ? 'Continue' : 'Start a recovery'} <ArrowRight aria-hidden="true" /></Link>
        </Button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { state, reload } = useEstates();
  const [filter, setFilter] = React.useState<Filter>('all');
  const [hasDraft, setHasDraft] = React.useState(false);

  React.useEffect(() => {
    if (!user) return;
    const d = readDraft(user.id);
    setHasDraft(!!d && (d.step > 0 || !!d.firstname || !!d.identityRef));
  }, [user]);

  const first = displayName(user).split(' ')[0];
  const estates = state.status === 'ready' ? state.data : [];
  const counts = { all: estates.length, open: estates.filter(isOpen).length, done: estates.filter((e) => !isOpen(e)).length };
  const shown = estates.filter((e) => (filter === 'all' ? true : filter === 'open' ? isOpen(e) : !isOpen(e)));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your cases</p>
          <h1 className="mt-3 text-display-md font-extrabold">{first ? `Welcome, ${first}` : 'Your cases'}</h1>
          <p className="mt-3 text-lg text-ink/75">Everything about your recoveries, in one place.</p>
        </div>
        {estates.length > 0 && (
          <Button asChild variant="secondary">
            <Link href="/app/new"><PlusCircle aria-hidden="true" />{hasDraft ? 'Continue new recovery' : 'Start another recovery'}</Link>
          </Button>
        )}
      </div>

      <div className="mt-8">
        {state.status === 'loading' && (
          <div className="space-y-4" role="status">
            <span className="sr-only">Loading your cases…</span>
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-44 w-full" />
          </div>
        )}

        {state.status === 'error' && (
          <Alert tone="danger" title="We could not load your cases">
            <p>{state.message}</p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={reload}>Try again</Button>
          </Alert>
        )}

        {state.status === 'ready' && estates.length === 0 && <EmptyState hasDraft={hasDraft} />}

        {state.status === 'ready' && estates.length > 0 && (
          <>
            {hasDraft && (
              <Alert tone="info" className="mb-6" title="You have an unfinished recovery">
                Your answers are saved on this device. <Link href="/app/new">Continue where you stopped</Link>.
              </Alert>
            )}
            <div role="group" aria-label="Filter cases" className="mb-6 inline-flex flex-wrap gap-1 rounded-[1.6rem] border border-ink/15 bg-surface p-1">
              {([['all', 'All'], ['open', 'In progress'], ['done', 'Completed']] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                  className={cn('min-h-11 rounded-full px-4 text-[0.95rem] font-bold transition-colors', filter === key ? 'bg-ink text-cotton' : 'text-ink/70 hover:text-ink')}
                >
                  {label} <span className="font-normal">({counts[key]})</span>
                </button>
              ))}
            </div>
            {shown.length === 0 ? (
              <Card className="border-dashed p-10 text-center text-ink/70">
                {filter === 'done' ? 'No completed recoveries yet. They will appear here once funds have been released to the estate.' : 'Nothing in progress right now.'}
              </Card>
            ) : (
              <ul className="space-y-5" aria-live="polite">{shown.map((e) => <CaseCard key={e.id} estate={e} />)}</ul>
            )}
          </>
        )}
      </div>
    </>
  );
}
