'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, BadgeCheck, Building2, CheckCircle2, Clock, Download, FileCheck2, FileQuestion, KeyRound, MessageCircle, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { CaseTimeline } from '@/components/case-timeline';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, api, apiDownload, saveBlob } from '@/lib/api';
import { displayName, useAuth } from '@/lib/auth-context';
import { STAGE_COPY, accountsOf, stageOf, type Account, type Estate } from '@/lib/estate';
import { SUPPORT_WHATSAPP } from '@/lib/fees';
import { mandateParagraphs, type MandateLetter } from '@/lib/mandate-text';
import { useEstate, useIdentity } from '@/lib/use-estates';
import { digitsOnly, useFocusFirstError } from '@/lib/use-focus-error';
import { caseRef, cn, formatDate, formatNaira } from '@/lib/utils';

const bvnKey = (id: string) => `reclaimng:bvn:${id}`;
const whatsappAbout = (estate: Estate) => `${SUPPORT_WHATSAPP}?text=${encodeURIComponent(`Hello, I need help with case ${caseRef(estate.id)} (${estate.estate_name}).`)}`;

/* ───────────────────────── Bank letter ───────────────────────── */

function BankLetter({ estate, onDone, embedded = false }: { estate: Estate; onDone: () => void; embedded?: boolean }) {
  const { user } = useAuth();
  const identity = useIdentity();
  const verifiedName = identity.state.status === 'ready' ? identity.state.data?.name : undefined;
  const [letter, setLetter] = React.useState<MandateLetter>({ bankName: '', branchAddress: '', deceasedName: estate.deceased_name, deceasedBvn: '', executorName: '', executorPhone: '' });
  const [errors, setErrors] = React.useState<Partial<Record<keyof MandateLetter, string>>>({});
  const [busy, setBusy] = React.useState(false);
  const focusFirstError = useFocusFirstError();

  React.useEffect(() => {
    setLetter((l) => (l.executorName ? l : { ...l, executorName: verifiedName || displayName(user) }));
  }, [verifiedName, user]);

  const set = (k: keyof MandateLetter) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setLetter((l) => ({ ...l, [k]: e.target.value }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  };

  async function download(e: React.FormEvent) {
    e.preventDefault();
    const found: typeof errors = {};
    if (letter.bankName.trim().length < 2) found.bankName = 'Enter the name of the bank.';
    if (letter.branchAddress.trim().length < 5) found.branchAddress = 'Enter the address of the branch you will visit.';
    if (!/^\d{11}$/.test(letter.deceasedBvn)) found.deceasedBvn = 'A BVN is 11 digits. It is often on old bank statements or account opening papers.';
    if (letter.executorName.trim().length < 3) found.executorName = 'Enter your full name.';
    if (!/^(?:\+?234|0)[7-9][01]\d{8}$/.test(letter.executorPhone.replace(/[\s-]/g, ''))) found.executorPhone = 'Enter a Nigerian mobile number, like 0801 234 5678.';
    setErrors(found);
    if (Object.keys(found).length) return focusFirstError();

    setBusy(true);
    try {
      const { buildMandatePdf } = await import('@/lib/mandate-pdf');
      saveBlob(await buildMandatePdf(letter), `Bank letter - ${estate.estate_name}.pdf`);
      try {
        sessionStorage.setItem(bvnKey(estate.id), letter.deceasedBvn);
      } catch {}
      await api('/api/update-milestone', { estateId: estate.id, mandateAcknowledged: true });
      toast.success('Your letter has been downloaded.');
      onDone();
    } catch (err) {
      toast.error((err as ApiError).message || 'We could not create the letter. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const p = mandateParagraphs(letter);
  const Outer = embedded ? 'div' : Card;
  const Head = embedded ? 'div' : CardHeader;
  const Body = embedded ? 'div' : CardContent;
  return (
    <Outer className={embedded ? 'space-y-4' : undefined}>
      <Head className={embedded ? 'space-y-1.5' : undefined}>
        <CardTitle as={embedded ? 'h3' : 'h2'} className={embedded ? 'text-lg' : undefined}>Prepare a letter for the bank</CardTitle>
        <p className="text-muted-foreground">
          This letter asks one of your loved one&apos;s banks to link your phone number to their BVN, so the search code can reach you. Fill it in, download
          it, and take it to the branch with the documents it lists.
        </p>
      </Head>
      <Body>
        <div className="grid gap-8 lg:grid-cols-2">
          <form onSubmit={download} noValidate className="space-y-5">
            <Field label="Bank name" hint="Any bank where they held an account." error={errors.bankName}>
              {(f) => <Input {...f} value={letter.bankName} onChange={set('bankName')} />}
            </Field>
            <Field label="Branch address" error={errors.branchAddress}>
              {(f) => <Textarea {...f} rows={2} value={letter.branchAddress} onChange={set('branchAddress')} />}
            </Field>
            <Field label="Their BVN" hint="11 digits. Often printed on bank statements or account opening papers." error={errors.deceasedBvn}>
              {(f) => <Input {...f} inputMode="numeric" autoComplete="off" value={letter.deceasedBvn} onChange={(e) => { e.target.value = digitsOnly(e.target.value, 11); set('deceasedBvn')(e); }} className="tracking-widest" />}
            </Field>
            <Field label="Your full name" error={errors.executorName}>
              {(f) => <Input {...f} autoComplete="name" value={letter.executorName} onChange={set('executorName')} />}
            </Field>
            <Field label="Your mobile number" hint="The number the search code should be sent to." error={errors.executorPhone}>
              {(f) => <Input {...f} type="tel" inputMode="tel" autoComplete="tel" value={letter.executorPhone} onChange={set('executorPhone')} />}
            </Field>
            <Button type="submit" loading={busy} loadingText="Creating your letter…" className="w-full sm:w-auto"><Download aria-hidden="true" />Download letter (PDF)</Button>
          </form>

          <div>
            <p className="mb-2 text-sm font-semibold text-muted-foreground">Preview</p>
            <div className="rounded-md border bg-white p-5 font-serif text-[0.9rem] leading-relaxed text-black shadow-card sm:p-7" aria-label="Letter preview" role="group">
              <p className="text-right">{p.date}</p>
              <p className="mt-4">{p.addressee.map((l, i) => <React.Fragment key={i}>{i === 1 ? <strong>{l}</strong> : l}<br /></React.Fragment>)}</p>
              <p className="mt-4">{p.salutation}</p>
              <p className="mt-4 font-bold underline">{p.subject}</p>
              {p.body.map((b) => <p key={b.slice(0, 24)} className="mt-3 text-justify">{b}</p>)}
              <ol className="ml-5 mt-2 list-decimal">{p.attachments.map((a) => <li key={a}>{a}</li>)}</ol>
              <p className="mt-5">{p.closing}</p>
              <p className="mt-9 border-t border-black pt-1 font-bold" style={{ width: '60%' }}>{p.signature[0]}</p>
              <p>{p.signature[1]}</p>
            </div>
          </div>
        </div>
      </Body>
    </Outer>
  );
}

/* ───────────────────────── Account discovery ───────────────────────── */

type Channel = { method: string; label: string; needsPhone: boolean };

function FindAccounts({ estate, onDone, rerun = false }: { estate: Estate; onDone: () => void; rerun?: boolean }) {
  const [bvn, setBvn] = React.useState('');
  const [session, setSession] = React.useState<{ id: string; channels: Channel[]; startedAt: number } | null>(null);
  const [method, setMethod] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [otp, setOtp] = React.useState('');
  const [error, setError] = React.useState<{ bvn?: string; method?: string; phone?: string; otp?: string; form?: string }>({});
  const [busy, setBusy] = React.useState(false);
  const [showLetter, setShowLetter] = React.useState(false);
  const otpRef = React.useRef<HTMLInputElement>(null);
  const focusFirstError = useFocusFirstError();

  React.useEffect(() => {
    try {
      const saved = sessionStorage.getItem(bvnKey(estate.id));
      if (saved) setBvn(saved);
    } catch {}
  }, [estate.id]);

  const restart = (message?: string) => {
    setSession(null);
    setSentTo(null);
    setOtp('');
    setMethod('');
    setError(message ? { form: message } : {});
  };

  const handle = (err: unknown) => {
    const e = err as ApiError;
    if (e.code === 'SESSION_EXPIRED') return restart(e.message);
    setError({ form: e.message });
  };

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{11}$/.test(bvn)) {
      setError({ bvn: 'A BVN is exactly 11 digits.' });
      return focusFirstError();
    }
    setError({});
    setBusy(true);
    try {
      const res = await api<{ sessionId: string; channels: Channel[] }>('/api/igree/request-otp', { bvn, estate_id: estate.id });
      setSession({ id: res.sessionId, channels: res.channels, startedAt: Date.now() });
      setMethod(res.channels.length === 1 ? res.channels[0].method : '');
    } catch (err) {
      handle(err);
    } finally {
      setBusy(false);
    }
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    const chosen = session?.channels.find((c) => c.method === method);
    if (!chosen) {
      setError({ method: 'Choose where the code should be sent.' });
      return focusFirstError();
    }
    if (chosen.needsPhone && !/^(?:\+?234|0)[7-9][01]\d{8}$/.test(phone.replace(/[\s-]/g, ''))) {
      setError({ phone: 'Enter a Nigerian mobile number, like 0801 234 5678.' });
      return focusFirstError();
    }
    setError({});
    setBusy(true);
    try {
      const res = await api<{ sentTo: string }>('/api/igree/request-otp', {
        estate_id: estate.id,
        sessionId: session!.id,
        method: chosen.method,
        ...(chosen.needsPhone ? { phone_number: phone.replace(/[\s-]/g, '') } : {}),
      });
      setSentTo(res.sentTo);
      setOtp('');
      requestAnimationFrame(() => otpRef.current?.focus());
    } catch (err) {
      handle(err);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4,8}$/.test(otp)) {
      setError({ otp: 'Enter the code you received.' });
      return focusFirstError();
    }
    setError({});
    setBusy(true);
    try {
      const res = await api<{ accounts: Account[]; newlyFound: number }>('/api/igree/verify-otp', { sessionId: session!.id, otp, estate_id: estate.id });
      try {
        sessionStorage.removeItem(bvnKey(estate.id));
      } catch {}
      if (res.newlyFound) toast.success(`We found ${res.newlyFound} account${res.newlyFound === 1 ? '' : 's'}.`);
      else toast.info('The search finished, but no accounts were linked to that BVN.');
      onDone();
    } catch (err) {
      handle(err);
    } finally {
      setBusy(false);
    }
  }

  const step = !session ? 0 : !sentTo ? 1 : 2;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{rerun ? 'Search again' : 'Find every linked account'}</CardTitle>
        <p className="text-muted-foreground">
          {step === 0 && 'Enter their BVN. NIBSS will send a one-time code to confirm consent, and then every bank account linked to that BVN is listed here.'}
          {step === 1 && 'Where should the one-time code be sent? Choose a contact you can reach right now.'}
          {step === 2 && 'Enter the code to finish the search. The search stays open for 10 minutes.'}
        </p>
        <p className="text-sm font-semibold text-muted-foreground">Step {step + 1} of 3</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {error.form && <Alert tone="danger">{error.form}</Alert>}

        {step === 0 && (
          <form onSubmit={start} noValidate className="space-y-5">
            <Field label="Their BVN" hint="11 digits. Often printed on bank statements or account opening papers." error={error.bvn}>
              {(f) => <Input {...f} inputMode="numeric" autoComplete="off" value={bvn} onChange={(e) => { setBvn(digitsOnly(e.target.value, 11)); setError({}); }} className="tracking-widest sm:max-w-xs" />}
            </Field>
            <Button type="submit" loading={busy} loadingText="Starting search…"><Search aria-hidden="true" />Continue</Button>
          </form>
        )}

        {step === 1 && session && (
          <form onSubmit={sendCode} noValidate className="space-y-5">
            <fieldset aria-describedby={error.method ? 'channel-error' : undefined}>
              <legend className="text-sm font-semibold">Send the code to</legend>
              <div className="mt-3 space-y-2">
                {session.channels.map((c) => (
                  <label
                    key={c.method}
                    className={cn(
                      'flex min-h-14 cursor-pointer items-center gap-3 rounded-md border bg-surface px-4 py-3 hover:border-primary',
                      method === c.method && 'border-primary bg-primary-soft/50',
                      error.method && 'border-danger',
                    )}
                  >
                    <input
                      type="radio"
                      name="channel"
                      value={c.method}
                      checked={method === c.method}
                      onChange={() => { setMethod(c.method); setError({}); }}
                      aria-invalid={!!error.method}
                      className="size-5 accent-[hsl(var(--primary))]"
                    />
                    <span>{c.label}</span>
                  </label>
                ))}
              </div>
              {error.method && <p id="channel-error" role="alert" className="mt-2 text-sm font-medium text-danger">{error.method}</p>}
            </fieldset>
            {session.channels.find((c) => c.method === method)?.needsPhone && (
              <Field label="Phone number to receive the code" error={error.phone}>
                {(f) => <Input {...f} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setError({}); }} className="sm:max-w-xs" />}
              </Field>
            )}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" loading={busy} loadingText="Sending code…"><KeyRound aria-hidden="true" />Send the code</Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => restart()}>Use a different BVN</Button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={verify} noValidate className="space-y-5">
            <Alert tone="success" title="Code sent">{sentTo}</Alert>
            <Field label="One-time code" hint="It can take a minute to arrive." error={error.otp}>
              {(f) => <Input {...f} ref={otpRef} inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(e) => { setOtp(digitsOnly(e.target.value, 8)); setError({}); }} className="text-xl tracking-[0.4em] sm:max-w-[14rem]" />}
            </Field>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" loading={busy} loadingText="Searching…"><Search aria-hidden="true" />Find accounts</Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => { setSentTo(null); setError({}); }}>Send it somewhere else</Button>
            </div>
          </form>
        )}

        {!rerun && (
          <div className="border-t pt-5">
            <button type="button" onClick={() => setShowLetter((v) => !v)} aria-expanded={showLetter} className="min-h-11 font-semibold text-primary underline underline-offset-4">
              None of these contacts reach anyone in the family?
            </button>
            {showLetter && (
              <p className="mt-2 text-[0.95rem] text-muted-foreground">
                Ask one of their banks to link your phone number to the BVN. We have prepared the letter for you below — take it to the branch with the documents it lists, then come back and search again.
              </p>
            )}
          </div>
        )}
      </CardContent>
      {showLetter && !rerun && (
        <CardContent>
          <BankLetter estate={estate} onDone={() => { setShowLetter(false); toast.success('When the bank confirms the change, search again here.'); }} embedded />
        </CardContent>
      )}
    </Card>
  );
}

function AccountsCard({ estate }: { estate: Estate }) {
  const accounts = accountsOf(estate);
  const [busy, setBusy] = React.useState(false);
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Accounts found ({accounts.length})</CardTitle>
          <p className="mt-1 text-muted-foreground">Bank accounts linked to {estate.deceased_name}&apos;s BVN.</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          loading={busy}
          loadingText="Preparing…"
          onClick={async () => {
            setBusy(true);
            try {
              await apiDownload('/api/generate-inventory', { estate_id: estate.id }, 'Schedule of Assets.pdf');
            } catch (err) {
              toast.error((err as ApiError).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Download aria-hidden="true" />Download list (PDF)
        </Button>
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-md border">
          {accounts.map((a) => (
            <li key={a.bank_name + a.account_number} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary"><Building2 className="size-5" aria-hidden="true" /></span>
                <div className="min-w-0">
                  <p className="font-semibold">{a.bank_name}</p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-mono text-ink">{a.account_number}</span>
                    {a.account_type ? ` · ${a.account_type.charAt(0) + a.account_type.slice(1).toLowerCase()}` : ''}
                  </p>
                </div>
              </div>
              <Badge tone="warning"><Clock aria-hidden="true" />Balance held by bank</Badge>
            </li>
          ))}
        </ul>
        <Alert tone="info" className="mt-5" title="What happens next">
          Each bank will release its balance to the estate once it has seen the Letters of Administration (or Probate). Message our team and we will help you
          send the claim to each bank on this list.
        </Alert>
        <Button asChild className="mt-4">
          <a href={whatsappAbout(estate)} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />Start claims with our team</a>
        </Button>
      </CardContent>
    </Card>
  );
}

/* ───────────────────────── Page ───────────────────────── */

export default function EstatePage() {
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useEstate(id);
  const [searchAgain, setSearchAgain] = React.useState(false);

  if (state.status === 'loading') {
    return (
      <div className="space-y-4" role="status">
        <span className="sr-only">Loading this case…</span>
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <Alert tone="danger" title="We could not load this case">
        <p>{state.message}</p>
        <Button size="sm" variant="secondary" className="mt-3" onClick={reload}>Try again</Button>
      </Alert>
    );
  }
  const estate = state.data;
  if (!estate) {
    return (
      <Card className="p-8 text-center">
        <FileQuestion className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold">We could not find that case</h1>
        <p className="mt-2 text-muted-foreground">It may belong to a different account, or the link may be incomplete.</p>
        <Button asChild className="mt-6"><Link href="/app">Back to your cases</Link></Button>
      </Card>
    );
  }

  const stage = stageOf(estate);
  const copy = STAGE_COPY[stage];
  const done = () => {
    setSearchAgain(false);
    reload();
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      <Link href="/app" className="inline-flex items-center gap-1.5 rounded-md py-2 font-semibold text-primary"><ArrowLeft className="size-4" aria-hidden="true" />Your cases</Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold sm:text-4xl">{estate.estate_name}</h1>
          <p className="mt-1 text-muted-foreground">Case {caseRef(estate.id)} · Opened {formatDate(estate.submitted_at)}</p>
        </div>
        <Badge tone={copy.tone} className="mt-1">{copy.badge}</Badge>
      </div>

      <div className="mt-8 space-y-6">
        {/* What is happening now */}
        {stage === 'in_review' && (
          <Alert tone="warning" icon={Clock} title="We are reviewing your documents">
            There is nothing you need to do right now. Reviews can take up to 30 days, and we will email you the moment yours is finished.
          </Alert>
        )}
        {stage === 'needs_attention' && (
          <Alert tone="danger" title="We could not approve your documents yet">
            <p>{estate.review_note || 'Something in the documents needs to be corrected before we can continue.'}</p>
            <p className="mt-2">Message our team and we will tell you exactly what to send. You will not be asked to pay again.</p>
            <Button asChild size="sm" className="mt-3"><a href={whatsappAbout(estate)} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />Message our team</a></Button>
          </Alert>
        )}
        {stage === 'find_accounts' && (
          <Alert tone="success" icon={BadgeCheck} title="Your documents are approved">
            The next step is yours: search for every bank account linked to their BVN. It takes a couple of minutes.
          </Alert>
        )}
        {stage === 'settled' && (
          <Alert tone="success" icon={CheckCircle2} title="This recovery is complete">
            {typeof estate.total_asset_value === 'number'
              ? `${formatNaira(estate.total_asset_value)} was released to the estate on ${formatDate(estate.updated_at)}.`
              : `Funds were released to the estate on ${formatDate(estate.updated_at)}.`}
          </Alert>
        )}

        {/* The thing to do */}
        {stage === 'find_accounts' && <FindAccounts estate={estate} onDone={done} />}
        {(stage === 'accounts_found' || (stage === 'settled' && accountsOf(estate).length > 0)) && <AccountsCard estate={estate} />}
        {stage === 'accounts_found' &&
          (searchAgain ? (
            <FindAccounts estate={estate} onDone={done} rerun />
          ) : (
            <Button variant="ghost" onClick={() => setSearchAgain(true)}><RefreshCw aria-hidden="true" />Search again with a BVN</Button>
          ))}

        {/* Progress */}
        <Card>
          <CardHeader><CardTitle>Progress</CardTitle></CardHeader>
          <CardContent><CaseTimeline estate={estate} /></CardContent>
        </Card>

        {/* Documents + help */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle as="h2">Documents on file</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-center gap-3"><FileCheck2 className="size-5 shrink-0 text-success" aria-hidden="true" /><span>Death certificate <span className="text-muted-foreground">· received</span></span></li>
                <li className="flex items-start gap-3">
                  {estate.letter_of_administration_path ? (
                    <><FileCheck2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" /><span>Letters of Administration <span className="text-muted-foreground">· received</span></span></>
                  ) : (
                    <><FileQuestion className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" /><span>Letters of Administration <span className="text-muted-foreground">· not yet provided. Banks will ask for these before releasing funds.</span></span></>
                  )}
                </li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle as="h2">Need a hand?</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Our team can see this case and answer questions about it. Quote <strong className="text-ink">{caseRef(estate.id)}</strong>.</p>
              <Button asChild variant="secondary" className="mt-4"><a href={whatsappAbout(estate)} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />Message us on WhatsApp</a></Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
