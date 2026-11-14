import Link from 'next/link';
import {
  ArrowRight, BadgeCheck, Check, CircleDashed, Clock, FileText, Fingerprint, Landmark, Lock, MessageCircle, Search, ShieldCheck, Users,
} from 'lucide-react';
import { HelpButton } from '@/components/help-button';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FEES, SUPPORT_WHATSAPP } from '@/lib/fees';
import { formatNaira } from '@/lib/utils';

const STEPS = [
  {
    icon: Fingerprint,
    title: 'Confirm who you are',
    body: 'We check your NIN so that only a genuine family member or administrator can act for the estate.',
    time: 'About 5 minutes',
  },
  {
    icon: FileText,
    title: 'Send us the documents',
    body: 'Upload the death certificate, and the Letters of Administration if you already have them. A photo from your phone is fine.',
    time: 'About 5 minutes',
  },
  {
    icon: Search,
    title: 'We review, then search',
    body: 'Our team checks the documents. Once approved, we help you run a consented search for every bank account linked to your loved one.',
    time: 'Review can take up to 30 days',
  },
  {
    icon: Landmark,
    title: 'Claim what is found',
    body: 'You see every account in one place, with the letters and schedules each bank asks for, and our team beside you until the funds reach the estate.',
    time: 'Depends on each bank',
  },
];

const NEEDS = [
  { title: 'Your NIN', body: 'The 11-digit National Identification Number on your NIN slip or ID card.' },
  { title: 'The death certificate', body: 'A clear scan or phone photo. PDF, JPG or PNG.' },
  { title: 'Letters of Administration or Probate', body: 'If you have them. If not, you can still start — banks will ask for them before releasing money.' },
];

const FAQS = [
  {
    q: 'Who can start a recovery?',
    a: 'A spouse, child, parent or sibling of the person who has passed, or the executor or administrator of their estate. We confirm your identity before anything else, and banks will only release money to whoever the court has appointed.',
  },
  {
    q: 'I do not have Letters of Administration yet. Can I still begin?',
    a: 'Yes. You can open a case with the death certificate alone so that the review and search can begin. Banks and registrars will need Letters of Administration (or Probate, if there is a will) before they pay anything out, so it is worth applying at your state Probate Registry in parallel.',
  },
  {
    q: 'How long does it take?',
    a: 'Starting a case takes about ten minutes. Our document review can take up to 30 days. After that, timing depends on each bank — some respond in days, some take longer. You can see exactly where your case stands at any time.',
  },
  {
    q: 'What does it cost, and when do I pay?',
    a: `There are two fixed fees while you set up your case: ${formatNaira(FEES.identity.kobo, { kobo: true })} for the identity check and ${formatNaira(FEES.submission.kobo, { kobo: true })} when you send your documents for review. After that we charge ${FEES.successRate * 100}% of what is actually recovered, taken only when money reaches the estate. If nothing is recovered, there is no success fee.`,
  },
  {
    q: 'Is my information safe?',
    a: 'Your documents are stored in private, encrypted storage that only you and our review team can open. Your identity is checked through QoreID against the national identity database, and payments are handled by Paystack — we never see your card details. You can ask us to correct or delete your data at any time under the Nigeria Data Protection Act.',
  },
  {
    q: 'Can I stop and come back later?',
    a: 'Yes. Your answers are kept while you work, and once a case is open it stays in your account. Come back whenever you are ready.',
  },
];

function ExampleCase() {
  const rows = [
    { label: 'Identity confirmed', state: 'done' },
    { label: 'Documents received', state: 'done' },
    { label: 'Review by our team', state: 'done' },
    { label: 'Accounts found', state: 'now' },
    { label: 'Claims with each bank', state: 'next' },
  ] as const;
  return (
    <Card className="relative mx-auto w-full max-w-md p-6 sm:p-7" role="img" aria-label="Example of a case in progress: identity confirmed, documents received and reviewed, three accounts found, claims with each bank coming next.">
      <div aria-hidden="true">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Example case</p>
            <p className="mt-0.5 font-display text-xl font-semibold">Estate of Samuel Bello</p>
          </div>
          <Badge tone="success"><BadgeCheck />Accounts found</Badge>
        </div>
        <ol className="mt-6 space-y-0">
          {rows.map((row, i) => (
            <li key={row.label} className="relative flex gap-3 pb-5 last:pb-0">
              {i < rows.length - 1 && <span className={`absolute left-[11px] top-6 h-full w-0.5 ${row.state === 'done' ? 'bg-primary' : 'bg-border'}`} />}
              <span
                className={`relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${
                  row.state === 'done' ? 'bg-primary text-white' : row.state === 'now' ? 'border-2 border-primary bg-surface' : 'border-2 border-border bg-surface'
                }`}
              >
                {row.state === 'done' && <Check className="size-3.5" strokeWidth={3} />}
                {row.state === 'now' && <span className="size-2 rounded-full bg-primary" />}
              </span>
              <span className={row.state === 'next' ? 'text-muted-foreground' : 'font-medium'}>{row.label}</span>
            </li>
          ))}
        </ol>
        <div className="mt-6 grid grid-cols-3 gap-2 rounded-md bg-muted p-3 text-center">
          {[['GTBank', '6789'], ['First Bank', '4321'], ['Access', '1234']].map(([bank, last4]) => (
            <div key={bank} className="rounded-sm bg-surface px-2 py-2.5">
              <p className="text-sm font-semibold">{bank}</p>
              <p className="text-xs text-muted-foreground">•••• {last4}</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        {/* Hero */}
        <section className="container grid items-center gap-12 py-14 md:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div>
            <h1 className="text-4xl font-semibold leading-[1.1] sm:text-5xl lg:text-[3.5rem]">
              Find and recover what your loved one left behind.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground sm:text-xl">
              When someone passes away, their bank accounts and dividends are often scattered and hard to trace. Reclaimng guides your family through
              finding them and claiming them — one clear step at a time.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/signup">
                  Start a recovery <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="#how-it-works">See how it works</Link>
              </Button>
            </div>
            <ul className="mt-8 grid gap-3 text-[0.95rem] text-muted-foreground sm:grid-cols-3">
              {[
                [Clock, 'About 10 minutes to start'],
                [CircleDashed, 'Stop and continue anytime'],
                [MessageCircle, 'Real people on WhatsApp'],
              ].map(([Icon, text]: any) => (
                <li key={text} className="flex items-center gap-2">
                  <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <ExampleCase />
        </section>

        {/* What you'll need */}
        <section className="border-y bg-surface">
          <div className="container py-14 md:py-16">
            <h2 className="text-2xl font-semibold sm:text-3xl">What you will need</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">Have these nearby before you begin. You do not need to visit a bank to get started.</p>
            <ul className="mt-8 grid gap-4 md:grid-cols-3">
              {NEEDS.map((n, i) => (
                <li key={n.title} className="rounded-lg border bg-background p-5">
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary" aria-hidden="true">{i + 1}</span>
                  <h3 className="mt-4 font-sans text-lg font-semibold tracking-normal">{n.title}</h3>
                  <p className="mt-1.5 text-muted-foreground">{n.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="container scroll-mt-20 py-16 md:py-20">
          <h2 className="text-2xl font-semibold sm:text-3xl">How it works</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">Four steps. We tell you what is happening, and what comes next, at every one.</p>
          <ol className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex flex-col rounded-lg border bg-surface p-6 shadow-card">
                <div className="flex items-center justify-between">
                  <span className="flex size-11 items-center justify-center rounded-md bg-primary-soft text-primary"><s.icon className="size-6" aria-hidden="true" /></span>
                  <span className="text-sm font-semibold text-muted-foreground">Step {i + 1}</span>
                </div>
                <h3 className="mt-5 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 flex-1 text-muted-foreground">{s.body}</p>
                <p className="mt-4 flex items-center gap-1.5 text-sm font-medium text-ink"><Clock className="size-4 text-muted-foreground" aria-hidden="true" />{s.time}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-20 border-y bg-primary-soft/50">
          <div className="container py-16 md:py-20">
            <h2 className="text-2xl font-semibold sm:text-3xl">Clear pricing, shown before you pay</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Two fixed fees while you set up your case, then a share only of what is actually recovered. Nothing is ever taken without you seeing the amount first.
            </p>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {[
                { when: 'When you confirm your identity', amount: formatNaira(FEES.identity.kobo, { kobo: true }), title: FEES.identity.label, body: 'Covers the check of your NIN against the national identity database. Paid once — reused if you come back within 30 days.' },
                { when: 'When you send your documents', amount: formatNaira(FEES.submission.kobo, { kobo: true }), title: FEES.submission.label, body: 'Covers the review of your documents by our team and opening your recovery case.' },
                { when: 'Only when money is recovered', amount: `${FEES.successRate * 100}%`, title: 'Success fee', body: 'Taken from the funds recovered, at the point they are released to the estate. If nothing is recovered, this fee is zero.' },
              ].map((p) => (
                <Card key={p.title} className="p-6">
                  <p className="text-sm font-semibold text-primary">{p.when}</p>
                  <p className="mt-4 font-display text-4xl font-semibold">{p.amount}</p>
                  <h3 className="mt-1 font-sans text-lg font-semibold tracking-normal">{p.title}</h3>
                  <p className="mt-3 text-muted-foreground">{p.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Safety */}
        <section className="container py-16 md:py-20">
          <h2 className="text-2xl font-semibold sm:text-3xl">How we keep your family safe</h2>
          <ul className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-2">
            {[
              [ShieldCheck, 'Only the right people can act', 'Every person is checked against the national identity database before a case is opened, and a human reviews every set of documents.'],
              [Lock, 'Private by default', 'Documents sit in private, encrypted storage. Only you and our review team can open them — never other users.'],
              [Landmark, 'Money goes to the estate, not to us', 'Recovered funds are only ever paid into an account opened in the name of the estate. Payments to us go through Paystack; we never see your card.'],
              [Users, 'People, not just software', 'Message our team on WhatsApp at any point. We will tell you plainly what is happening with your case.'],
            ].map(([Icon, title, body]: any) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary"><Icon className="size-6" aria-hidden="true" /></span>
                <div>
                  <h3 className="font-sans text-lg font-semibold tracking-normal">{title}</h3>
                  <p className="mt-1 text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* FAQ */}
        <section id="questions" className="scroll-mt-20 border-t bg-surface">
          <div className="container grid gap-10 py-16 md:py-20 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <h2 className="text-2xl font-semibold sm:text-3xl">Questions families ask us</h2>
              <p className="mt-3 text-muted-foreground">
                Something else on your mind?{' '}
                <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline underline-offset-4">
                  Ask us on WhatsApp
                </a>
                .
              </p>
            </div>
            <Accordion type="single" collapsible className="border-t">
              {FAQS.map((f, i) => (
                <AccordionItem key={f.q} value={`q${i}`}>
                  <AccordionTrigger>{f.q}</AccordionTrigger>
                  <AccordionContent>{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="container py-16 md:py-20">
          <div className="rounded-2xl bg-primary px-6 py-12 text-center text-primary-foreground sm:px-12 sm:py-16">
            <h2 className="mx-auto max-w-2xl text-3xl font-semibold text-primary-foreground sm:text-4xl">Let us carry the paperwork, so you can be with family.</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-primary-foreground/85">Start when you are ready. It is free to create an account and look around.</p>
            <Button asChild size="lg" variant="secondary" className="mt-8 border-transparent">
              <Link href="/signup">
                Start a recovery <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
      <HelpButton />
    </>
  );
}
