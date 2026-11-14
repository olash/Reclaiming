'use client';

import * as React from 'react';
import Link from 'next/link';
import { BadgeCheck, Camera, ExternalLink, FileText, RotateCcw, ShieldAlert, ThumbsDown, ThumbsUp, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, api } from '@/lib/api';
import { caseRef, cn, formatDate, formatNaira } from '@/lib/utils';

interface AdminCase {
  id: string;
  estate_name: string;
  deceased_name: string;
  status: 'pending_review' | 'under_review' | 'verified' | 'rejected' | 'settled';
  payment_status: string;
  submitted_at: string;
  applicant: string | null;
  nin_masked: string | null;
  liveness: string;
  has_letters: boolean;
  document_check: { status: string; reasons: string[] } | null;
  accounts: number;
  review_note: string | null;
  total_asset_value: number | null;
}

const TABS = [
  { key: 'waiting', label: 'Waiting for review', match: (c: AdminCase) => c.status === 'pending_review' || c.status === 'under_review' },
  { key: 'verified', label: 'Approved', match: (c: AdminCase) => c.status === 'verified' },
  { key: 'rejected', label: 'Sent back', match: (c: AdminCase) => c.status === 'rejected' },
  { key: 'settled', label: 'Settled', match: (c: AdminCase) => c.status === 'settled' },
  { key: 'all', label: 'All', match: () => true },
] as const;

const STATUS_BADGE: Record<AdminCase['status'], { label: string; tone: 'warning' | 'info' | 'success' | 'danger' | 'neutral' }> = {
  pending_review: { label: 'New', tone: 'warning' },
  under_review: { label: 'In review', tone: 'info' },
  verified: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Sent back', tone: 'danger' },
  settled: { label: 'Settled', tone: 'neutral' },
};

type Pending = { c: AdminCase; action: 'reject' | 'settle' } | null;

export default function AdminPage() {
  const [allowed, setAllowed] = React.useState<boolean | null>(null);
  const [cases, setCases] = React.useState<AdminCase[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<(typeof TABS)[number]['key']>('waiting');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<Pending>(null);
  const [note, setNote] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const res = await api<{ cases: AdminCase[] }>('/api/admin/cases', {});
      setCases(res.cases);
    } catch (err) {
      setError((err as ApiError).message);
    }
  }, []);

  React.useEffect(() => {
    api<{ admin: boolean }>('/api/admin/me')
      .then((r) => {
        setAllowed(r.admin);
        if (r.admin) load();
      })
      .catch(() => setAllowed(false));
  }, [load]);

  async function openDocument(c: AdminCase, which: 'death_certificate' | 'letter_of_administration') {
    const win = window.open('', '_blank');
    try {
      const res = await api<{ documents: Record<string, string | null> }>('/api/admin/case', { estate_id: c.id });
      const url = res.documents[which];
      if (!url) throw new ApiError('That document could not be opened.', 404);
      if (win) win.location.href = url;
      else window.location.href = url;
    } catch (err) {
      win?.close();
      toast.error((err as ApiError).message);
    }
  }

  async function decide(c: AdminCase, action: 'start_review' | 'approve' | 'reject' | 'reopen' | 'settle', extra: { note?: string; amount?: string } = {}) {
    setBusy(c.id + action);
    try {
      const r = await api<{ extrasSaved: boolean }>('/api/admin/decision', { estate_id: c.id, action, ...extra });
      const words = { start_review: 'Marked as in review', approve: 'Approved — the family can now search for accounts', reject: 'Sent back to the family', reopen: 'Moved back to the queue', settle: 'Marked as settled' };
      toast.success(words[action]);
      if (!r.extrasSaved && (action === 'reject' || action === 'settle')) toast.warning('Saved, but the note/amount needs migration 0005 to be stored.');
      setPending(null);
      await load();
    } catch (err) {
      const message = (err as ApiError).message;
      if (pending) setFormError(message);
      else toast.error(message);
    } finally {
      setBusy(null);
    }
  }

  if (allowed === null) return <Skeleton className="h-64 w-full" />;
  if (!allowed) {
    return (
      <Card className="p-8 text-center">
        <ShieldAlert className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold">This area is for the review team</h1>
        <p className="mt-2 text-muted-foreground">If you should have access, ask an administrator to add your email to ADMIN_EMAILS.</p>
        <Button asChild className="mt-6"><Link href="/app">Back to your cases</Link></Button>
      </Card>
    );
  }

  const current = TABS.find((t) => t.key === tab)!;
  const shown = (cases ?? []).filter(current.match);

  return (
    <>
      <h1 className="text-3xl font-semibold sm:text-4xl">Review queue</h1>
      <p className="mt-2 text-muted-foreground">Check each family&apos;s identity and documents, then approve the case or send it back with a note.</p>

      <div role="group" aria-label="Filter cases" className="mt-8 flex flex-wrap gap-1 rounded-md border bg-surface p-1">
        {TABS.map((t) => {
          const count = (cases ?? []).filter(t.match).length;
          return (
            <button
              key={t.key}
              type="button"
              aria-pressed={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn('min-h-11 rounded-sm px-3.5 text-[0.95rem] font-semibold', tab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-ink')}
            >
              {t.label} <span className="font-normal">({count})</span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 space-y-4">
        {error && (
          <Alert tone="danger" title="Could not load cases">
            <p>{error}</p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={load}>Try again</Button>
          </Alert>
        )}
        {!cases && !error && <Skeleton className="h-48 w-full" />}
        {cases && shown.length === 0 && <Card className="p-8 text-center text-muted-foreground">Nothing here right now.</Card>}
        {shown.map((c) => {
          const badge = STATUS_BADGE[c.status];
          return (
            <Card key={c.id} className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold">{c.estate_name}</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">{caseRef(c.id)} · Opened {formatDate(c.submitted_at)} · Payment {c.payment_status}</p>
                </div>
                <Badge tone={badge.tone}>{badge.label}</Badge>
              </div>

              <dl className="mt-5 grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-sm text-muted-foreground">Applicant</dt>
                  <dd className="font-medium">{c.applicant ?? '—'}</dd>
                  <dd className="text-sm text-muted-foreground">NIN {c.nin_masked ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Identity checks</dt>
                  <dd className="mt-1 flex flex-wrap gap-2">
                    <Badge tone={c.nin_masked ? 'success' : 'danger'}><BadgeCheck aria-hidden="true" />NIN {c.nin_masked ? 'matched' : 'missing'}</Badge>
                    <Badge tone={c.liveness === 'submitted' ? 'success' : 'warning'}><Camera aria-hidden="true" />Selfie {c.liveness === 'submitted' ? 'passed' : c.liveness}</Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Documents</dt>
                  <dd className="mt-1 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => openDocument(c, 'death_certificate')}><FileText aria-hidden="true" />Death certificate<ExternalLink aria-hidden="true" /></Button>
                    {c.has_letters && <Button size="sm" variant="secondary" onClick={() => openDocument(c, 'letter_of_administration')}><FileText aria-hidden="true" />Letters<ExternalLink aria-hidden="true" /></Button>}
                  </dd>
                </div>
              </dl>

              {c.document_check && c.document_check.status === 'needs_review' && (
                <Alert tone="warning" className="mt-4" title="Automatic read of the certificate flagged:">
                  <ul className="list-disc pl-5">{c.document_check.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                </Alert>
              )}
              {c.review_note && c.status === 'rejected' && <Alert tone="neutral" className="mt-4" title="Note sent to the family">{c.review_note}</Alert>}
              {c.status === 'settled' && c.total_asset_value !== null && <p className="mt-4 font-semibold">Released to estate: {formatNaira(c.total_asset_value)}</p>}
              {c.accounts > 0 && <p className="mt-4 text-sm text-muted-foreground">{c.accounts} account{c.accounts === 1 ? '' : 's'} found by the family&apos;s search.</p>}

              <div className="mt-5 flex flex-wrap gap-2 border-t pt-5">
                {c.status === 'pending_review' && (
                  <Button size="sm" variant="secondary" loading={busy === c.id + 'start_review'} onClick={() => decide(c, 'start_review')}>Mark as in review</Button>
                )}
                {(c.status === 'pending_review' || c.status === 'under_review' || c.status === 'rejected') && (
                  <Button size="sm" loading={busy === c.id + 'approve'} onClick={() => decide(c, 'approve')}><ThumbsUp aria-hidden="true" />Approve</Button>
                )}
                {(c.status === 'pending_review' || c.status === 'under_review' || c.status === 'verified') && (
                  <Button size="sm" variant="secondary" onClick={() => { setPending({ c, action: 'reject' }); setNote(''); setFormError(null); }}><ThumbsDown aria-hidden="true" />Send back</Button>
                )}
                {c.status === 'verified' && (
                  <Button size="sm" variant="secondary" onClick={() => { setPending({ c, action: 'settle' }); setAmount(''); setFormError(null); }}><Wallet aria-hidden="true" />Mark as settled</Button>
                )}
                {(c.status === 'rejected' || c.status === 'settled') && (
                  <Button size="sm" variant="ghost" loading={busy === c.id + 'reopen'} onClick={() => decide(c, 'reopen')}><RotateCcw aria-hidden="true" />Move back to queue</Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          {pending && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setFormError(null);
                decide(pending.c, pending.action, pending.action === 'reject' ? { note } : { amount });
              }}
              className="space-y-5"
            >
              <DialogHeader>
                <DialogTitle>{pending.action === 'reject' ? 'Send this case back' : 'Mark as settled'}</DialogTitle>
                <DialogDescription>
                  {pending.action === 'reject'
                    ? `${pending.c.estate_name}. The family will see your note on their case page — tell them exactly what to fix.`
                    : `${pending.c.estate_name}. Enter the net amount released to the estate account.`}
                </DialogDescription>
              </DialogHeader>
              {formError && <Alert tone="danger">{formError}</Alert>}
              {pending.action === 'reject' ? (
                <Field label="Note to the family">
                  {(f) => <Textarea {...f} rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. The death certificate photo is too blurry to read. Please upload a clearer scan." />}
                </Field>
              ) : (
                <Field label="Amount released (₦)">
                  {(f) => <Input {...f} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} />}
                </Field>
              )}
              <div className="flex flex-wrap justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
                <Button type="submit" variant={pending.action === 'reject' ? 'danger' : 'primary'} loading={busy === pending.c.id + pending.action}>
                  {pending.action === 'reject' ? 'Send back' : 'Mark as settled'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
