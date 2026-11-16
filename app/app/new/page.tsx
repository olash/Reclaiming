'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, BadgeCheck, Camera, CheckCircle2, Clock, FileText, Fingerprint, Lock, Pencil, ScrollText, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { FilePicker } from '@/components/file-picker';
import { Stepper } from '@/components/stepper';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, api } from '@/lib/api';
import { supabase } from '@/lib/supabase-browser';
import { displayName, useAuth } from '@/lib/auth-context';
import { clearDraft, useDraft, type Draft } from '@/lib/draft';
import { RELATIONSHIPS } from '@/lib/estate';
import { FEES, SUPPORT_WHATSAPP } from '@/lib/fees';
import { useIdentity } from '@/lib/use-estates';
import { LIVENESS_MODE, useLiveness } from '@/lib/use-liveness';
import { digitsOnly, useFocusFirstError } from '@/lib/use-focus-error';
import { usePaystack } from '@/lib/use-paystack';
import { cn, formatDate, formatNaira } from '@/lib/utils';

const STEPS = ['About you', 'Your loved one', 'Confirm identity', 'Documents', 'Review and send'];
const ID_FEE = formatNaira(FEES.identity.kobo, { kobo: true });
const DOC_FEE = formatNaira(FEES.submission.kobo, { kobo: true });
const today = () => new Date().toISOString().slice(0, 10);

type Errors = Partial<Record<keyof Draft | 'deathCert' | 'form' | 'liveness', string>>;

function validateYou(d: Draft): Errors {
  const e: Errors = {};
  if (d.firstname.trim().length < 2) e.firstname = 'Enter your first name as it appears on your NIN slip.';
  if (d.lastname.trim().length < 2) e.lastname = 'Enter your last name as it appears on your NIN slip.';
  if (!/^(?:\+?234|0)[7-9][01]\d{8}$/.test(d.phone.replace(/[\s-]/g, ''))) e.phone = 'Enter a Nigerian mobile number, like 0801 234 5678.';
  if (!d.dob) e.dob = 'Enter your date of birth.';
  else {
    const age = (Date.now() - new Date(d.dob).getTime()) / (365.25 * 86_400_000);
    if (age < 18) e.dob = 'You need to be 18 or older to act for an estate.';
    if (age > 120 || Number.isNaN(age)) e.dob = 'Please check your date of birth.';
  }
  if (!/^\d{11}$/.test(d.nin.trim())) e.nin = 'Your NIN is 11 digits. You can find it on your NIN slip or by dialling *346#.';
  return e;
}

function validateLovedOne(d: Draft): Errors {
  const e: Errors = {};
  if (d.deceasedName.trim().split(/\s+/).length < 2) e.deceasedName = 'Enter their full name (first name and surname), as written on the death certificate.';
  if (!d.dateOfDeath) e.dateOfDeath = 'Enter the date they passed away.';
  else if (d.dateOfDeath > today()) e.dateOfDeath = 'This date is in the future. Please check it.';
  if (!d.relationship) e.relationship = 'Choose how you are related.';
  return e;
}

function StepCard({ title, intro, children, footer, headingRef }: { title: string; intro?: React.ReactNode; children: React.ReactNode; footer: React.ReactNode; headingRef: React.Ref<HTMLHeadingElement> }) {
  return (
    <Card className="mt-8 animate-fade-up">
      <CardHeader className="space-y-3 pb-6 sm:p-8 sm:pb-7">
        <h2 ref={headingRef} tabIndex={-1} className="text-[2rem] font-extrabold leading-[1.05] outline-none sm:text-[2.5rem]">{title}</h2>
        {intro && <p className="max-w-xl text-lg text-ink/75">{intro}</p>}
      </CardHeader>
      <CardContent className="space-y-6 sm:px-8 sm:pb-8">{children}</CardContent>
      <CardFooter className="flex-col-reverse sm:flex-row sm:justify-between">{footer}</CardFooter>
    </Card>
  );
}

function SummaryRow({ label, value, onEdit }: { label: string; value: React.ReactNode; onEdit?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <dt className="text-sm font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</dt>
        <dd className="mt-1 break-words text-lg font-bold">{value}</dd>
      </div>
      {onEdit && (
        <button type="button" onClick={onEdit} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 font-bold text-primary hover:bg-primary-soft">
          <Pencil className="size-4" aria-hidden="true" />
          Change<span className="sr-only"> {label}</span>
        </button>
      )}
    </div>
  );
}

function FeeBox({ icon: Icon, title, amount, children }: { icon: React.ComponentType<{ className?: string }>; title: string; amount: string; children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-md border-[1.5px] border-ink bg-accent-soft p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <p className="flex items-center gap-2 font-bold"><Icon className="size-5" aria-hidden="true" />{title}</p>
        <p className="font-display text-3xl font-extrabold tracking-tight">{amount}</p>
      </div>
      <div className="mt-2 text-ink/80">{children}</div>
    </div>
  );
}

export default function NewRecoveryPage() {
  const { user } = useAuth();
  const { draft, update, ready } = useDraft(user?.id);
  const identity = useIdentity();
  const pay = usePaystack();

  const [started, setStarted] = React.useState(false);
  const [errors, setErrors] = React.useState<Errors>({});
  const [busy, setBusy] = React.useState<null | 'identity' | 'submit'>(null);
  const [deathCert, setDeathCert] = React.useState<File | null>(null);
  const [loa, setLoa] = React.useState<File | null>(null);
  const [done, setDone] = React.useState<{ estateId: string } | null>(null);
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const focusFirstError = useFocusFirstError();

  const step = draft.step;
  const verified = identity.state.status === 'ready' ? identity.state.data : null;
  const liveness = useLiveness();
  const livenessDone = LIVENESS_MODE === 'off' || verified?.liveness === 'submitted';
  const [skippedSelfie, setSkippedSelfie] = React.useState(false);

  // Prefill the name from the account the first time through.
  React.useEffect(() => {
    if (!ready || draft.firstname || draft.lastname) return;
    const parts = displayName(user).trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) update({ firstname: parts[0], lastname: parts.slice(1).join(' ') });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // A returning visitor with saved answers skips the intro.
  React.useEffect(() => {
    if (ready && (draft.step > 0 || draft.nin || draft.identityRef)) setStarted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const [stepChanges, setStepChanges] = React.useState(0);
  const go = React.useCallback(
    (next: number) => {
      setErrors({});
      update({ step: next });
      setStepChanges((n) => n + 1);
    },
    [update],
  );

  // After a step change has rendered, move focus to the new step's heading so
  // keyboard and screen-reader users land in the right place.
  React.useEffect(() => {
    if (!stepChanges) return;
    window.scrollTo({ top: 0 });
    headingRef.current?.focus();
  }, [stepChanges]);

  const set = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    update({ [key]: e.target.value } as Partial<Draft>);
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  function next(validate: (d: Draft) => Errors, to: number) {
    const found = validate(draft);
    setErrors(found);
    if (Object.keys(found).length) {
      focusFirstError();
      return;
    }
    go(to);
  }

  // ── Step 3: pay the identity fee (once) and check the NIN ───────────────
  async function confirmIdentity() {
    if (!user?.email) return;
    setErrors({});
    setBusy('identity');
    try {
      const details = {
        nin: draft.nin.trim(),
        firstname: draft.firstname.trim(),
        lastname: draft.lastname.trim(),
        phone: draft.phone.replace(/[\s-]/g, ''),
        dob: draft.dob,
      };
      let reference = draft.identityRef;
      if (!reference) {
        // Free pre-check: already verified, or a problem we can tell them about before taking any money?
        const pre = await api('/api/verify-nin', details).catch((err: ApiError) => {
          if (err.code === 'PAYMENT_REQUIRED') return null;
          throw err;
        });
        if (pre?.verified) {
          identity.reload();
          toast.success('Your NIN is already confirmed.');
          if (LIVENESS_MODE === 'off') go(3);
          return;
        }
        const result = await pay({ purpose: 'identity', email: user.email, userId: user.id });
        if (result.status === 'cancelled') return toast.info('Payment was not completed. You can try again when you are ready.');
        if (result.status === 'error') return setErrors({ form: result.message });
        reference = result.reference;
        update({ identityRef: reference }); // remember it straight away so a failed check never means paying twice
      }
      await api('/api/verify-nin', { ...details, payment_reference: reference });
      update({ identityRef: '' });
      identity.reload();
      toast.success('Your NIN is confirmed.');
      if (LIVENESS_MODE === 'off') go(3);
    } catch (err) {
      const e = err as ApiError;
      if (e.code === 'PAYMENT_ALREADY_USED' || e.code === 'PAYMENT_NOT_FOUND' || e.code === 'PAYMENT_OWNER_MISMATCH') update({ identityRef: '' });
      setErrors({ form: e.message, ...(e.code === 'NAME_MISMATCH' || e.code === 'NIN_NOT_FOUND' ? { nin: 'check' } : {}) });
    } finally {
      setBusy(null);
    }
  }

  // ── Step 3b: selfie liveness check (QoreID Web SDK) ─────────────────────
  async function startSelfie() {
    setErrors({});
    const outcome = await liveness.run();
    if (outcome.status === 'submitted') {
      identity.reload();
      toast.success('Selfie check complete.');
      return go(3);
    }
    if (outcome.status === 'closed') return toast.info('The selfie check was closed before it finished. You can start it again when you are ready.');
    setErrors({ liveness: outcome.message });
  }

  // ── Step 5: pay the filing fee (once) and send the documents ─────────────
  const uploaded = React.useRef(new Map<File, string>());
  async function uploadOnce(file: File, slug: string) {
    const known = uploaded.current.get(file);
    if (known) return known;
    const ext = (file.name.split('.').pop() ?? 'pdf').toLowerCase();
    const path = `${user!.id}/${Date.now()}_${slug}.${ext}`;
    const { error } = await supabase().storage.from('probate_documents').upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (error) {
      throw new ApiError('Your payment is safe, but we could not upload your documents. Check your connection and press the button again; you will not be charged twice.', 0, 'UPLOAD_FAILED');
    }
    uploaded.current.set(file, path);
    return path;
  }

  async function submit() {
    if (!user?.email) return;
    const found: Errors = {};
    if (!deathCert) found.deathCert = 'Please attach the death certificate.';
    if (!draft.consent) found.consent = 'Please tick the box to confirm before you continue.';
    setErrors(found);
    if (found.deathCert) return go(3);
    if (found.consent) return document.getElementById('consent')?.focus();

    setBusy('submit');
    try {
      let reference = draft.submissionRef;
      if (!reference) {
        const result = await pay({ purpose: 'submission', email: user.email, userId: user.id });
        if (result.status === 'cancelled') return toast.info('Payment was not completed. Nothing has been sent yet.');
        if (result.status === 'error') return setErrors({ form: result.message });
        reference = result.reference;
        update({ submissionRef: reference });
      }
      // The files go straight from this device to private storage (only this
      // person's own folder is allowed), so large phone photos never hit the
      // server's 4.5 MB request limit. A retry reuses what already uploaded.
      const deathCertificatePath = await uploadOnce(deathCert!, 'death_certificate');
      const loaPath = loa ? await uploadOnce(loa, 'letter_of_administration') : null;
      const res = await api<{ estateId: string }>('/api/submit-documents', {
        death_certificate_path: deathCertificatePath,
        letter_of_administration_path: loaPath,
        deceased_name: draft.deceasedName.trim(),
        date_of_death: draft.dateOfDeath,
        relationship: draft.relationship,
        paystack_reference: reference,
      });
      clearDraft(user.id);
      setDone({ estateId: res.estateId });
      window.scrollTo({ top: 0 });
    } catch (err) {
      const e = err as ApiError;
      if (e.code === 'PAYMENT_ALREADY_USED' || e.code === 'PAYMENT_NOT_FOUND') update({ submissionRef: '' });
      setErrors({ form: e.message });
    } finally {
      setBusy(null);
    }
  }

  if (!ready || identity.state.status === 'loading') {
    return (
      <div className="space-y-4" role="status">
        <span className="sr-only">Loading…</span>
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  // ── Finished ─────────────────────────────────────────────────────────────
  if (done) {
    return (
      <Card className="mx-auto max-w-2xl p-6 text-center sm:p-10" role="status">
        <span className="mx-auto flex size-20 items-center justify-center rounded-full bg-saffron text-ink shadow-stamp"><CheckCircle2 className="size-10" aria-hidden="true" /></span>
        <h1 className="mt-6 text-[2.5rem] font-extrabold leading-[1.02]">We have received your documents</h1>
        <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
          Thank you. Your case for <strong className="text-ink">{draft.deceasedName || 'your loved one'}</strong> is now open and our team has started the review.
        </p>
        <div className="mx-auto mt-8 max-w-md rounded-md border border-dashed border-ink/25 bg-cotton p-6 text-left">
          <h2 className="font-sans text-base font-semibold tracking-normal">What happens next</h2>
          <ol className="mt-3 space-y-3 text-[0.95rem]">
            {[
              'Our team checks your documents. This can take up to 30 days.',
              'We email you as soon as the review is finished.',
              'You then search, with a one-time code, for every bank account linked to their BVN.',
            ].map((t, i) => (
              <li key={t} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink font-display text-sm font-extrabold text-cotton">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        </div>
        <Button asChild size="lg" variant="accent" className="mt-9"><Link href={`/app/estates/${done.estateId}`}>View your case <ArrowRight aria-hidden="true" /></Link></Button>
      </Card>
    );
  }

  // ── Before you start ─────────────────────────────────────────────────────
  if (!started) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="eyebrow">New recovery</p>
        <h1 className="mt-3 text-display-lg font-extrabold">Start a recovery</h1>
        <p className="mt-4 text-xl text-ink/75">We are sorry for your loss. We will take this one step at a time, together.</p>
        <Card className="mt-10 p-6 sm:p-9">
          <h2 className="text-3xl font-extrabold">Before you begin</h2>
          <ul className="mt-7 space-y-6">
            {[
              [Clock, 'It takes about 10 minutes', 'Your answers are saved as you go, so you can stop and continue later on this device.'],
              [Fingerprint, 'Have your NIN ready', 'We use it, with a quick selfie on your phone or laptop camera, to confirm you are who you say you are.'],
              [FileText, 'Have the death certificate ready', 'A clear phone photo or scan is fine. Letters of Administration are optional for now.'],
              [Wallet, `There are two fees along the way`, `${ID_FEE} to confirm your identity and ${DOC_FEE} when you send your documents. We always show the amount before you pay. Later, we charge ${FEES.successRate * 100}% only of money actually recovered.`],
            ].map(([Icon, title, body]: any) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-saffron text-ink"><Icon className="size-5" aria-hidden="true" /></span>
                <div>
                  <p className="text-lg font-bold">{title}</p>
                  <p className="text-ink/75">{body}</p>
                </div>
              </li>
            ))}
          </ul>
          <Button size="lg" variant="accent" className="mt-9 w-full sm:w-auto" onClick={() => { setStarted(true); go(0); }}>
            Begin <ArrowRight aria-hidden="true" />
          </Button>
        </Card>
      </div>
    );
  }

  const back = (to: number) => (
    <Button type="button" variant="secondary" onClick={() => go(to)} className="w-full sm:w-auto"><ArrowLeft aria-hidden="true" />Back</Button>
  );

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Start a recovery</h1>
        <Link href="/app" className="shrink-0 rounded-md py-2 font-bold text-primary underline decoration-saffron decoration-2 underline-offset-4 hover:decoration-primary">Save and exit</Link>
      </div>
      <div className="mt-6"><Stepper steps={STEPS} current={step} /></div>

      {/* Step 1 — About you */}
      {step === 0 && (
        <form noValidate onSubmit={(e) => { e.preventDefault(); next(validateYou, 1); }}>
          <StepCard
            headingRef={headingRef}
            title="About you"
            intro="Enter your details exactly as they appear on your NIN slip. We use them to confirm your identity in a later step."
            footer={<><span /><Button type="submit" className="w-full sm:w-auto">Continue <ArrowRight aria-hidden="true" /></Button></>}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="First name" error={errors.firstname}>{(f) => <Input {...f} autoComplete="given-name" value={draft.firstname} onChange={set('firstname')} />}</Field>
              <Field label="Last name" error={errors.lastname}>{(f) => <Input {...f} autoComplete="family-name" value={draft.lastname} onChange={set('lastname')} />}</Field>
            </div>
            <Field label="Mobile number" hint="We will only use this to contact you about your case." error={errors.phone}>
              {(f) => <Input {...f} type="tel" inputMode="tel" autoComplete="tel" placeholder="0801 234 5678" value={draft.phone} onChange={set('phone')} />}
            </Field>
            <Field label="Date of birth" error={errors.dob}>
              {(f) => <Input {...f} type="date" autoComplete="bday" max={today()} value={draft.dob} onChange={set('dob')} className="sm:max-w-xs" />}
            </Field>
            <Field label="National Identification Number (NIN)" hint="11 digits. It is on your NIN slip, or dial *346# from your registered line." error={errors.nin}>
              {(f) => <Input {...f} inputMode="numeric" autoComplete="off" value={draft.nin} onChange={(e) => { e.target.value = digitsOnly(e.target.value, 11); set('nin')(e); }} className="tracking-widest sm:max-w-xs" />}
            </Field>
            <Alert tone="neutral" icon={Lock}>Your NIN is sent securely to our identity partner for this check only. It is never shown to anyone else.</Alert>
          </StepCard>
        </form>
      )}

      {/* Step 2 — Your loved one */}
      {step === 1 && (
        <form noValidate onSubmit={(e) => { e.preventDefault(); next(validateLovedOne, 2); }}>
          <StepCard
            headingRef={headingRef}
            title="About your loved one"
            intro="Tell us about the person whose accounts you would like to trace."
            footer={<>{back(0)}<Button type="submit" className="w-full sm:w-auto">Continue <ArrowRight aria-hidden="true" /></Button></>}
          >
            <Field label="Their full legal name" hint="As written on the death certificate, including middle names." error={errors.deceasedName}>
              {(f) => <Input {...f} autoComplete="off" value={draft.deceasedName} onChange={set('deceasedName')} />}
            </Field>
            <Field label="Date they passed away" error={errors.dateOfDeath}>
              {(f) => <Input {...f} type="date" max={today()} value={draft.dateOfDeath} onChange={set('dateOfDeath')} className="sm:max-w-xs" />}
            </Field>
            <Field label="How are you related to them?" error={errors.relationship}>
              {(f) => (
                <select
                  {...f}
                  value={draft.relationship}
                  onChange={set('relationship')}
                  className="block h-12 w-full rounded-md border border-input bg-surface px-3 text-base focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 aria-[invalid=true]:border-danger sm:max-w-xs"
                >
                  <option value="">Choose one</option>
                  {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              )}
            </Field>
          </StepCard>
        </form>
      )}

      {/* Step 3 — Confirm identity */}
      {step === 2 && (
        <StepCard
          headingRef={headingRef}
          title="Confirm your identity"
          intro={verified ? undefined : 'We check your NIN against the national identity database. This protects your family: only a verified person can open a case.'}
          footer={
            <>
              {back(1)}
              {verified && (livenessDone || skippedSelfie) ? (
                <Button onClick={() => go(3)} className="w-full sm:w-auto">Continue <ArrowRight aria-hidden="true" /></Button>
              ) : verified ? (
                <div className="flex w-full flex-col-reverse gap-3 sm:w-auto sm:flex-row">
                  {LIVENESS_MODE === 'optional' && (
                    <Button variant="ghost" onClick={() => { setSkippedSelfie(true); go(3); }} className="w-full sm:w-auto">Skip for now</Button>
                  )}
                  <Button onClick={startSelfie} loading={liveness.running} loadingText="Opening camera…" className="w-full sm:w-auto">
                    <Camera aria-hidden="true" />Start selfie check
                  </Button>
                </div>
              ) : (
                <Button onClick={confirmIdentity} loading={busy === 'identity'} loadingText="Checking your identity…" className="w-full sm:w-auto">
                  {draft.identityRef ? 'Check again (already paid)' : `Pay ${ID_FEE} and confirm`}
                </Button>
              )}
            </>
          }
        >
          {verified ? (
            <>
              <Alert tone="success" icon={BadgeCheck} title="Your NIN is confirmed">
                Confirmed on {formatDate(verified.verifiedAt)}{verified.name ? ` as ${verified.name}` : ''}. There is nothing more to pay for this step.
              </Alert>
              {LIVENESS_MODE !== 'off' &&
                (livenessDone ? (
                  <Alert tone="success" icon={Camera} title="Selfie check complete">Your selfie has been matched to the photo on your NIN record.</Alert>
                ) : (
                  <div className="rounded-md border border-dashed border-ink/25 bg-cotton p-5 sm:p-6">
                    <h3 className="flex items-center gap-2 font-sans text-lg font-semibold tracking-normal">
                      <Camera className="size-5 text-primary" aria-hidden="true" />
                      One last thing: a quick selfie
                    </h3>
                    <p className="mt-2 text-muted-foreground">
                      To make sure it is really you, our identity partner QoreID will match a short selfie video to the photo on your NIN record. It takes about 30
                      seconds.
                    </p>
                    <ul className="mt-3 space-y-1.5 text-[0.95rem] text-muted-foreground">
                      <li>• Find a well-lit spot and remove glasses or a face covering.</li>
                      <li>• Allow camera access when your browser asks.</li>
                      <li>• Your selfie is used for this check only.</li>
                    </ul>
                    {errors.liveness && <Alert tone="danger" className="mt-4" title="The selfie check did not finish">{errors.liveness}</Alert>}
                  </div>
                ))}
            </>
          ) : (
            <>
              {errors.form && (
                <Alert tone="danger" title="We could not confirm your identity">
                  <p>{errors.form}</p>
                  {errors.nin && <Button size="sm" variant="secondary" className="mt-3" onClick={() => go(0)}><Pencil aria-hidden="true" />Check my details</Button>}
                </Alert>
              )}
              {draft.identityRef && !errors.form && (
                <Alert tone="info" title="Your payment is saved">You have already paid for this check. Press the button below to try again — you will not be charged twice.</Alert>
              )}
              <dl className="divide-y divide-dashed divide-ink/20 rounded-md border border-ink/15 bg-cotton px-5">
                <SummaryRow label="Name" value={`${draft.firstname} ${draft.lastname}`} onEdit={() => go(0)} />
                <SummaryRow label="NIN" value={<span className="tracking-widest">{draft.nin.replace(/^(\d{3})\d{5}(\d{3})$/, '$1•••••$2')}</span>} />
                <SummaryRow label="Date of birth" value={formatDate(draft.dob)} />
              </dl>
              <FeeBox icon={Fingerprint} title={FEES.identity.label} amount={ID_FEE}>
                Paid once, securely through Paystack. If you come back within 30 days you will not pay this again.
              </FeeBox>
            </>
          )}
        </StepCard>
      )}

      {/* Step 4 — Documents */}
      {step === 3 && (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!deathCert) return setErrors({ deathCert: 'Please attach the death certificate to continue.' });
            go(4);
          }}
        >
          <StepCard
            headingRef={headingRef}
            title="Add the documents"
            intro="Photos taken with your phone are fine, as long as all four corners are visible and the writing is easy to read."
            footer={<>{back(2)}<Button type="submit" className="w-full sm:w-auto">Continue <ArrowRight aria-hidden="true" /></Button></>}
          >
            {draft.submissionRef && !deathCert && (
              <Alert tone="info" title="Your payment is saved">Please attach your documents again to finish. You will not be charged twice.</Alert>
            )}
            <FilePicker
              label="Death certificate"
              hint="Issued by the National Population Commission, a hospital or a local government registry."
              file={deathCert}
              onChange={(f) => { setDeathCert(f); setErrors({}); }}
              error={errors.deathCert}
            />
            <FilePicker
              label="Letters of Administration or Grant of Probate"
              hint="Add this if you already have it. If not, you can continue — banks will ask for it before releasing any money."
              optional
              file={loa}
              onChange={setLoa}
            />
            <Alert tone="neutral" icon={Lock}>Your documents are stored privately. Only you and our review team can open them.</Alert>
          </StepCard>
        </form>
      )}

      {/* Step 5 — Review and send */}
      {step === 4 && (
        <StepCard
          headingRef={headingRef}
          title="Review and send"
          intro="Please check everything is correct. You can change anything before you send it."
          footer={
            <>
              {back(3)}
              <Button onClick={submit} loading={busy === 'submit'} loadingText="Sending your documents…" className="w-full sm:w-auto">
                {draft.submissionRef ? 'Send documents (already paid)' : `Pay ${DOC_FEE} and send`}
              </Button>
            </>
          }
        >
          {errors.form && (
            <Alert tone="danger" title="Your documents were not sent">
              <p>{errors.form}</p>
              {draft.submissionRef && <p className="mt-1">Payment reference: <span className="font-mono">{draft.submissionRef}</span></p>}
            </Alert>
          )}
          <dl className="divide-y divide-dashed divide-ink/20 rounded-md border border-ink/15 bg-cotton px-5">
            <SummaryRow label="You" value={`${draft.firstname} ${draft.lastname} · ${draft.phone}`} onEdit={verified ? undefined : () => go(0)} />
            <SummaryRow label="Your loved one" value={<>{draft.deceasedName}<br /><span className="font-normal text-muted-foreground">Passed away {formatDate(draft.dateOfDeath)} · {draft.relationship}</span></>} onEdit={() => go(1)} />
            <SummaryRow label="Death certificate" value={deathCert ? deathCert.name : <span className="text-danger">Not attached yet</span>} onEdit={() => go(3)} />
            <SummaryRow label="Letters of Administration" value={loa ? loa.name : <span className="font-normal text-muted-foreground">Not added (optional)</span>} onEdit={() => go(3)} />
          </dl>

          <FeeBox icon={ScrollText} title={FEES.submission.label} amount={DOC_FEE}>
            Covers the review of your documents by our team and opening your case. Paid securely through Paystack.
          </FeeBox>

          <div className={cn('rounded-md border p-4', errors.consent && 'border-danger bg-danger-soft')}>
            <div className="flex gap-3">
              <Checkbox
                id="consent"
                checked={draft.consent}
                onCheckedChange={(v) => { update({ consent: v === true }); setErrors((p) => ({ ...p, consent: undefined })); }}
                aria-invalid={!!errors.consent}
                aria-describedby={errors.consent ? 'consent-error' : undefined}
              />
              <label htmlFor="consent" className="text-[0.95rem] leading-relaxed">
                I confirm that I am entitled to act for this estate and that the information I have given is true. I authorise Reclaiming to act on the estate&apos;s
                behalf in tracing these assets, and I agree to the{' '}
                <Link href="/terms" target="_blank" className="font-semibold text-primary underline underline-offset-2">Terms</Link> and{' '}
                <Link href="/privacy" target="_blank" className="font-semibold text-primary underline underline-offset-2">Privacy Policy</Link>, including a service fee of{' '}
                <strong>{FEES.successRate * 100}% of any funds recovered</strong>, taken only when they are released to the estate.
              </label>
            </div>
            {errors.consent && <p id="consent-error" role="alert" className="mt-2 pl-9 text-sm font-medium text-danger">{errors.consent}</p>}
          </div>
        </StepCard>
      )}

      <p className="mt-6 text-center text-muted-foreground">
        Not sure about something?{' '}
        <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer" className="font-bold text-primary underline decoration-saffron decoration-2 underline-offset-4 hover:decoration-primary">Ask us on WhatsApp</a>
      </p>
    </div>
  );
}
