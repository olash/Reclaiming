'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, Wallet } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
      <h1 className="text-3xl font-semibold sm:text-4xl">Recovered funds</h1>
      <p className="mt-2 text-muted-foreground">Money that has been released to an estate through Reclaimng.</p>

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
          <Card className="p-6 sm:p-8">
            <span className="flex size-12 items-center justify-center rounded-md bg-primary-soft text-primary"><Wallet className="size-6" aria-hidden="true" /></span>
            <h2 className="mt-5 text-2xl font-semibold">Nothing has been released yet</h2>
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
              <Card className="bg-primary p-6 text-primary-foreground sm:p-8">
                <p className="text-primary-foreground/85">Total released to your estates</p>
                <p className="mt-1 font-display text-4xl font-semibold sm:text-5xl">{formatNaira(total)}</p>
                <p className="mt-2 text-sm text-primary-foreground/85">After Reclaimng&apos;s service fee.</p>
              </Card>
            )}
            <ul className="space-y-4">
              {settled.map((e) => (
                <li key={e.id}>
                  <Card className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
                    <div className="flex min-w-0 items-center gap-4">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success-soft text-success"><CheckCircle2 className="size-6" aria-hidden="true" /></span>
                      <div className="min-w-0">
                        <h2 className="text-lg font-semibold"><Link href={`/app/estates/${e.id}`} className="hover:underline">{e.estate_name}</Link></h2>
                        <p className="text-sm text-muted-foreground">{caseRef(e.id)} · Completed {formatDate(e.updated_at)} · {accountsOf(e).length} account{accountsOf(e).length === 1 ? '' : 's'}</p>
                      </div>
                    </div>
                    <p className="font-display text-2xl font-semibold">{typeof e.total_asset_value === 'number' ? formatNaira(e.total_asset_value) : 'Amount on your statement'}</p>
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
