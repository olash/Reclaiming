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
import { useEstates } from '@/lib/use-estates';
import { caseRef, cn, formatDate } from '@/lib/utils';

type Filter = 'all' | 'open' | 'done';

function CaseCard({ estate }: { estate: Estate }) {
  const stage = stageOf(estate);
  const copy = STAGE_COPY[stage];
  return (
    <li>
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">
              <Link href={`/app/estates/${estate.id}`} className="rounded-sm hover:underline">{estate.estate_name}</Link>
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{caseRef(estate.id)} · Opened {formatDate(estate.submitted_at)}</p>
          </div>
          <Badge tone={copy.tone}>
            {copy.waitingOn === 'us' ? <Clock aria-hidden="true" /> : copy.tone === 'success' ? <CheckCircle2 aria-hidden="true" /> : null}
            {copy.badge}
          </Badge>
        </div>
        <p className="mt-4 text-muted-foreground">{copy.summary}</p>
        <div className="mt-5">
          {copy.action ? (
            <Button asChild size="sm"><Link href={`/app/estates/${estate.id}`}>{copy.action} <ArrowRight aria-hidden="true" /></Link></Button>
          ) : (
            <Button asChild size="sm" variant="secondary"><Link href={`/app/estates/${estate.id}`}>View case <ChevronRight aria-hidden="true" /></Link></Button>
          )}
        </div>
      </Card>
    </li>
  );
}

function EmptyState({ hasDraft }: { hasDraft: boolean }) {
  return (
    <Card className="p-6 sm:p-8">
      <span className="flex size-12 items-center justify-center rounded-md bg-primary-soft text-primary"><FolderHeart className="size-6" aria-hidden="true" /></span>
      <h2 className="mt-5 text-2xl font-semibold">{hasDraft ? 'Pick up where you stopped' : 'Start your first recovery'}</h2>
      <p className="mt-2 max-w-xl text-muted-foreground">
        {hasDraft
          ? 'Your answers so far are saved on this device. Continue when you are ready.'
          : 'We will ask a few questions about you and your loved one, then check your documents. It takes about 10 minutes, and you can stop and come back.'}
      </p>
      <h3 className="mt-7 font-sans text-base font-semibold tracking-normal">Have these ready</h3>
      <ul className="mt-3 space-y-3">
        {[
          [Fingerprint, 'Your NIN', 'The 11-digit number on your NIN slip.'],
          [FileText, 'The death certificate', 'A clear photo or scan (PDF, JPG or PNG).'],
          [ScrollText, 'Letters of Administration', 'Optional for now — banks will ask for them later.'],
        ].map(([Icon, title, body]: any) => (
          <li key={title} className="flex gap-3">
            <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <span><span className="font-medium">{title}.</span> <span className="text-muted-foreground">{body}</span></span>
          </li>
        ))}
      </ul>
      <Button asChild size="lg" className="mt-8 w-full sm:w-auto">
        <Link href="/app/new">{hasDraft ? 'Continue' : 'Start a recovery'} <ArrowRight aria-hidden="true" /></Link>
      </Button>
    </Card>
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
          <h1 className="text-3xl font-semibold sm:text-4xl">{first ? `Welcome, ${first}` : 'Your cases'}</h1>
          <p className="mt-2 text-muted-foreground">Everything about your recoveries, in one place.</p>
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
            <div role="group" aria-label="Filter cases" className="mb-5 inline-flex rounded-md border bg-surface p-1">
              {([['all', 'All'], ['open', 'In progress'], ['done', 'Completed']] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                  className={cn('min-h-11 rounded-sm px-3.5 text-[0.95rem] font-semibold', filter === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-ink')}
                >
                  {label} <span className="font-normal">({counts[key]})</span>
                </button>
              ))}
            </div>
            {shown.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                {filter === 'done' ? 'No completed recoveries yet. They will appear here once funds have been released to the estate.' : 'Nothing in progress right now.'}
              </Card>
            ) : (
              <ul className="space-y-4" aria-live="polite">{shown.map((e) => <CaseCard key={e.id} estate={e} />)}</ul>
            )}
          </>
        )}
      </div>
    </>
  );
}
