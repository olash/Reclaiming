'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, Wallet } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Motif } from '@/components/brand/motifs';
import { Skeleton } from '@/components/ui/skeleton';
import { accountsOf } from '@/lib/estate';
import { useEstates } from '@/lib/use-estates';
import { caseRef, formatDate, formatNaira } from '@/lib/utils';

export default function VaultPage() {
  const { state, reload } = useEstates();
  const settled = state.status === 'ready' ? state.data.filter((e) => e.status === 'settled') : [];
  const open = state.status === 'ready' ? state.data.filter((e) => e.status !== 'settled') : [];
  const total = settled.reduce((sum, e) => sum + (typeof e.total_asset_value === 'number' ? e.total_asset_value : 0), 0);

  return (
    <>
      <p className="eyebrow">Recovered funds</p>
      <h1 className="mt-3 text-display-md font-extrabold">Recovered funds</h1>
      <p className="mt-3 text-lg text-ink/75">Money that has been released to an estate through Reclaiming.</p>

      <div className="mt-8 space-y-4">
        {state.status === 'loading' && (
          <div role="status"><span className="sr-only">Loading…</span><Skeleton className="h-40 w-full" /></div>
        )}
        {state.status === 'error' && (
          <Alert tone="danger" title="We could not load this page">
            <p>{state.message}</p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={reload}>Try again</Button>
          </Alert>
        )}

        {state.status === 'ready' && settled.length === 0 && (
          <Card className="relative overflow-hidden p-6 sm:p-10">
            <Motif name="house" seed={5} className="pointer-events-none absolute -right-10 -top-10 size-56 text-saffron/50" />
            <span className="relative flex size-14 items-center justify-center rounded-full bg-saffron text-ink"><Wallet className="size-7" aria-hidden="true" /></span>
            <h2 className="relative mt-6 text-3xl font-extrabold">Nothing has been released yet</h2>
            <p className="mt-2 max-w-xl text-muted-foreground">
              {open.length
                ? `You have ${open.length} case${open.length === 1 ? '' : 's'} in progress. When a bank releases funds to the estate, the amount and the date will appear here.`
                : 'When a recovery is complete and a bank releases funds to the estate, the amount and the date will appear here.'}
            </p>
            <Button asChild className="mt-6">
              <Link href={open.length ? '/app' : '/app/new'}>{open.length ? 'See your cases' : 'Start a recovery'} <ArrowRight aria-hidden="true" /></Link>
            </Button>
          </Card>
        )}

        {settled.length > 0 && (
          <>
            {total > 0 && (
              <Card className="relative overflow-hidden border-0 bg-indigo-night p-7 text-cotton sm:p-10">
                <Motif name="sun" seed={2} className="pointer-events-none absolute -right-14 -top-14 size-72 text-saffron/25" />
                <p className="relative font-bold uppercase tracking-[0.14em] text-saffron">Total released to your estates</p>
                <p className="relative mt-3 font-display text-display-lg font-extrabold">{formatNaira(total)}</p>
                <p className="relative mt-3 text-cotton/80">After Reclaiming&apos;s service fee.</p>
              </Card>
            )}
            <ul className="space-y-4">
              {settled.map((e) => (
                <li key={e.id}>
                  <Card className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
                    <div className="flex min-w-0 items-center gap-4">
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-leaf text-cotton"><CheckCircle2 className="size-6" aria-hidden="true" /></span>
                      <div className="min-w-0">
                        <h2 className="text-xl font-bold"><Link href={`/app/estates/${e.id}`} className="decoration-saffron decoration-[3px] underline-offset-4 hover:underline">{e.estate_name}</Link></h2>
                        <p className="text-sm text-muted-foreground">{caseRef(e.id)} · Completed {formatDate(e.updated_at)} · {accountsOf(e).length} account{accountsOf(e).length === 1 ? '' : 's'}</p>
                      </div>
                    </div>
                    <p className="font-display text-3xl font-extrabold tracking-tight">{typeof e.total_asset_value === 'number' ? formatNaira(e.total_asset_value) : 'Amount on your statement'}</p>
                  </Card>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}
