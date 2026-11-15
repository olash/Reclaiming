import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check, Landmark, Lock, ShieldCheck, Users } from 'lucide-react';
import { AdireQuilt, Circled, Motif, type MotifName, Underline } from '@/components/brand/motifs';
import { HelpButton } from '@/components/help-button';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { FEES, SUPPORT_WHATSAPP } from '@/lib/fees';
import { formatNaira } from '@/lib/utils';

const STEPS: Array<{ motif: MotifName; title: string; body: string; time: string; tone: string }> = [
  {
    motif: 'sun',
    title: 'Show us it’s you',
    body: 'A quick NIN check and a selfie, so only a genuine family member or administrator can act for the estate.',
    time: 'About 5 minutes',
    tone: 'bg-saffron text-ink',
  },
  {
    motif: 'leaves',
    title: 'Send the papers',
    body: 'The death certificate, and Letters of Administration if you have them. A photo from your phone is fine.',
    time: 'About 5 minutes',
    tone: 'bg-indigo text-cotton',
  },
  {
    motif: 'waves',
    title: 'We review, you search',
    body: 'A real person checks your documents. Then, with your consent, one search shows every account linked to their BVN.',
    time: 'Review: up to 30 days',
    tone: 'bg-clay text-cotton',
  },
  {
    motif: 'house',
    title: 'Bring it home',
    body: 'Every account in one list, the letters each bank asks for, and our team beside you until funds reach the estate.',
    time: 'Depends on each bank',
    tone: 'bg-leaf text-cotton',
  },
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
    a: 'Starting a case takes about ten minutes. Our document review can take up to 30 days. After that, timing depends on each bank: some respond in days, some take longer. You can see exactly where your case stands at any time.',
  },
  {
    q: 'What does it cost, and when do I pay?',
    a: `There are two fixed fees while you set up your case: ${formatNaira(FEES.identity.kobo, { kobo: true })} for the identity check and ${formatNaira(FEES.submission.kobo, { kobo: true })} when you send your documents for review. After that we charge ${FEES.successRate * 100}% of what is actually recovered, taken only when money reaches the estate. If nothing is recovered, there is no success fee.`,
  },
  {
    q: 'Is my information safe?',
    a: 'Your documents are stored in private, encrypted storage that only you and our review team can open. Your identity is checked through QoreID against the national identity database, and payments are handled by Paystack. We never see your card details. You can ask us to correct or delete your data at any time under the Nigeria Data Protection Act.',
  },
  {
    q: 'Can I stop and come back later?',
    a: 'Yes. Your answers are kept while you work, and once a case is open it stays in your account. Come back whenever you are ready.',
  },
];

/** A case, drawn like a paper slip pinned to the cloth. Purely illustrative. */
function CaseSlip() {
  const rows = [
    ['Identity confirmed', true],
    ['Documents reviewed', true],
    ['Accounts found', true],
    ['Claims with each bank', false],
  ] as const;
  return (
    <figure
      className="relative w-[17.5rem] rotate-[-3deg] rounded-md border border-ink/15 bg-paper p-5 shadow-pop sm:w-[19rem]"
      role="img"
      aria-label="Example of a case in progress: identity confirmed, documents reviewed, three accounts found, claims with each bank coming next."
    >
      <div aria-hidden="true">
        <span className="absolute -top-3 left-1/2 h-6 w-20 -translate-x-1/2 rotate-2 bg-saffron/80" />
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-clay">Example case</p>
        <p className="mt-1 font-display text-xl font-bold leading-tight">Estate of Samuel Bello</p>
        <ul className="mt-4 space-y-2.5">
          {rows.map(([label, done]) => (
            <li key={label} className="flex items-center gap-2.5 text-[0.95rem]">
              <span className={`flex size-5 items-center justify-center rounded-full ${done ? 'bg-leaf text-cotton' : 'border-2 border-dashed border-ink/35'}`}>
                {done && <Check className="size-3" strokeWidth={3.5} />}
              </span>
              <span className={done ? 'font-bold' : 'text-muted-foreground'}>{label}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex gap-1.5">
          {['GTBank', 'First Bank', 'Access'].map((b) => (
            <span key={b} className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary">{b}</span>
          ))}
        </div>
      </div>
    </figure>
  );
}

function Marquee() {
  const items = ['No queues at the bank', 'Every account in one place', 'Real people on WhatsApp', 'Fees shown before you pay', 'Stop and continue anytime', 'Private by default'];
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-10 pr-10" aria-hidden={hidden || undefined}>
      {items.map((t) => (
        <li key={t} className="flex items-center gap-10 whitespace-nowrap font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {t}
          <span className="size-3 rounded-full bg-saffron" aria-hidden="true" />
        </li>
      ))}
    </ul>
  );
  return (
    <section aria-label="Why families use Reclaiming" className="overflow-hidden border-y border-ink bg-ink py-5 text-cotton">
      <div className="flex w-max motion-safe:animate-[marquee_40s_linear_infinite]">
        {row(false)}
        {row(true)}
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        {/* ───────────── Hero ───────────── */}
        <section className="grain relative overflow-hidden">
          <div className="container grid items-center gap-14 pb-16 pt-10 md:pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10 lg:pb-24">
            <div className="animate-fade-up">
              <p className="eyebrow">
                <span className="size-2 rounded-full bg-clay" aria-hidden="true" />
                For Nigerian families
              </p>
              <h1 className="mt-5 text-display-xl font-extrabold">
                Find what they left behind, and <Underline>bring it home.</Underline>
              </h1>
              <p className="mt-7 max-w-xl text-xl leading-relaxed text-ink/75">
                When someone you love passes on, their money doesn’t disappear. It waits in accounts no one knew about. We help you find
                every one of them and claim it, one clear step at a time.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button asChild size="lg" variant="accent">
                  <Link href="/signup">
                    Start a recovery <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="ghost">
                  <Link href="#how-it-works">See how it works</Link>
                </Button>
              </div>
              <p className="mt-6 text-[0.95rem] text-muted-foreground">Free to create an account. About 10 minutes to start.</p>
            </div>

            <div className="relative mx-auto w-full max-w-[30rem]">
              <AdireQuilt className="rotate-[1.5deg] rounded-lg shadow-pop [&>div:first-child]:rounded-tl-[1rem] [&>div:last-child]:rounded-br-[1rem] [&>div:nth-child(3)]:rounded-tr-[1rem] [&>div:nth-child(7)]:rounded-bl-[1rem]" />
              <div className="absolute -bottom-10 -left-4 sm:-left-12">
                <CaseSlip />
              </div>
            </div>
          </div>
        </section>

        <Marquee />

        {/* ───────────── The why ───────────── */}
        <section className="container py-20 md:py-28">
          <div className="grid gap-10 lg:grid-cols-[0.35fr_1fr]">
            <p className="eyebrow">Why we exist</p>
            <div>
              <p className="font-display text-display-md font-bold">
                Grief is heavy enough. Chasing banks, searching for account numbers and queueing for answers{' '}
                <span className="text-clay">shouldn’t be part of it.</span>
              </p>
              <p className="mt-8 max-w-2xl text-lg text-ink/75">
                Across Nigeria, money sits untouched in the accounts of people who have passed on, because families don’t know where it is
                or how to ask. Reclaiming turns that maze into a single, guided path, with real people beside you.
              </p>
            </div>
          </div>
        </section>

        {/* ───────────── How it works ───────────── */}
        <section id="how-it-works" className="scroll-mt-20 border-t border-dashed border-ink/20 bg-paper">
          <div className="container py-20 md:py-28">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="eyebrow">How it works</p>
                <h2 className="mt-4 max-w-xl text-display-lg font-extrabold">Four steps. You’re never guessing.</h2>
              </div>
              <p className="max-w-sm text-lg text-ink/75">At every step we tell you what is happening now, and what comes next.</p>
            </div>
            <ol className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="group flex flex-col overflow-hidden rounded-lg border border-ink/10 bg-cotton">
                  <div className={`relative aspect-[5/3] ${s.tone}`}>
                    <Motif name={s.motif} seed={i + 11} className="absolute inset-0 size-full p-6 opacity-40 transition-transform duration-500 group-hover:scale-105" />
                    <span className="absolute bottom-3 left-5 font-display text-7xl font-extrabold leading-none tracking-tighter">{i + 1}</span>
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <h3 className="text-2xl font-bold">{s.title}</h3>
                    <p className="mt-2 flex-1 text-ink/75">{s.body}</p>
                    <p className="mt-5 inline-flex w-fit rounded-full border border-ink/20 px-3 py-1 text-sm font-bold">{s.time}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ───────────── What you'll need ───────────── */}
        <section className="container grid items-center gap-12 py-20 md:py-28 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Before you start</p>
            <h2 className="mt-4 text-display-lg font-extrabold">
              Three things. <Circled>That’s it.</Circled>
            </h2>
            <p className="mt-6 max-w-md text-lg text-ink/75">Have these nearby. You don’t need to visit a bank, a lawyer or an office to begin.</p>
          </div>
          <div className="relative">
            <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-lg bg-indigo" aria-hidden="true" />
            <ul className="relative space-y-0 divide-y divide-dashed divide-ink/20 rounded-lg border-[1.5px] border-ink bg-paper p-2">
              {[
                ['Your NIN', 'The 11-digit National Identification Number on your NIN slip or ID card.'],
                ['The death certificate', 'A clear scan or phone photo. PDF, JPG or PNG.'],
                ['Letters of Administration', 'If you have them. If not, you can still start. Banks will ask for them before releasing money.'],
              ].map(([title, body], i) => (
                <li key={title} className="flex gap-4 p-5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-saffron font-display text-lg font-extrabold" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-xl font-bold">{title}</h3>
                    <p className="mt-1 text-ink/75">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ───────────── Pricing ───────────── */}
        <section id="pricing" className="scroll-mt-20 bg-saffron">
          <div className="container py-20 md:py-28">
            <p className="eyebrow text-ink">Pricing</p>
            <h2 className="mt-4 max-w-3xl text-display-lg font-extrabold">Clear fees, shown before you pay. Always.</h2>
            <div className="mt-14 grid gap-5 lg:grid-cols-3">
              {[
                { when: 'When you confirm your identity', amount: formatNaira(FEES.identity.kobo, { kobo: true }), title: FEES.identity.label, body: 'Covers the check of your NIN against the national identity database. Paid once, and reused if you come back within 30 days.' },
                { when: 'When you send your documents', amount: formatNaira(FEES.submission.kobo, { kobo: true }), title: FEES.submission.label, body: 'Covers the review of your documents by our team and opening your recovery case.' },
                { when: 'Only when money is recovered', amount: `${FEES.successRate * 100}%`, title: 'Success fee', body: 'Taken from the funds recovered, when they are released to the estate. If nothing is recovered, this fee is zero.', dark: true },
              ].map((p) => (
                <div key={p.title} className={`flex flex-col rounded-lg border-[1.5px] border-ink p-7 ${p.dark ? 'bg-ink text-cotton' : 'bg-paper'}`}>
                  <p className={`text-sm font-bold uppercase tracking-[0.12em] ${p.dark ? 'text-saffron' : 'text-clay'}`}>{p.when}</p>
                  <p className="mt-6 font-display text-6xl font-extrabold tracking-tighter">{p.amount}</p>
                  <h3 className={`mt-2 text-xl font-bold ${p.dark ? 'text-cotton' : ''}`}>{p.title}</h3>
                  <p className={`mt-3 ${p.dark ? 'text-cotton/80' : 'text-ink/75'}`}>{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ───────────── Safety ───────────── */}
        <section className="relative overflow-hidden bg-indigo-night text-cotton">
          <Motif name="sun" seed={7} className="pointer-events-none absolute -right-24 -top-24 size-[28rem] text-cotton/[0.07]" strokeWidth={1.6} />
          <div className="container relative py-20 md:py-28">
            <p className="eyebrow text-saffron">Safety</p>
            <h2 className="mt-4 max-w-2xl text-display-lg font-extrabold text-cotton">Built to protect your family, not just your data.</h2>
            <ul className="mt-14 grid gap-x-12 gap-y-10 md:grid-cols-2">
              {[
                [ShieldCheck, 'Only the right people can act', 'Every person is checked against the national identity database before a case is opened, and a human reviews every set of documents.'],
                [Lock, 'Private by default', 'Documents sit in private, encrypted storage. Only you and our review team can open them, never other users.'],
                [Landmark, 'Money goes to the estate, not to us', 'Recovered funds are only ever paid into an account in the name of the estate. Payments to us go through Paystack; we never see your card.'],
                [Users, 'People, not just software', 'Message our team on WhatsApp at any point. We will tell you plainly what is happening with your case.'],
              ].map(([Icon, title, body]: any) => (
                <li key={title} className="flex gap-5 border-t border-cotton/15 pt-6">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-saffron text-ink">
                    <Icon className="size-6" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-2xl font-bold text-cotton">{title}</h3>
                    <p className="mt-2 text-cotton/80">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ───────────── FAQ ───────────── */}
        <section id="questions" className="scroll-mt-20">
          <div className="container grid gap-10 py-20 md:py-28 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="eyebrow">Questions</p>
              <h2 className="mt-4 text-display-md font-extrabold">What families ask us.</h2>
              <p className="mt-5 text-lg text-ink/75">
                Something else on your mind?{' '}
                <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer" className="font-bold text-primary underline decoration-saffron decoration-2 underline-offset-4">
                  Ask us on WhatsApp
                </a>
                .
              </p>
            </div>
            <Accordion type="single" collapsible className="border-t border-dashed border-ink/20">
              {FAQS.map((f, i) => (
                <AccordionItem key={f.q} value={`q${i}`}>
                  <AccordionTrigger>{f.q}</AccordionTrigger>
                  <AccordionContent>{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* ───────────── Closing ───────────── */}
        <section className="container pb-20 md:pb-28">
          <div className="relative overflow-hidden rounded-xl bg-clay px-6 py-14 text-cotton sm:px-14 sm:py-20">
            <Motif name="leaves" seed={3} className="pointer-events-none absolute -bottom-10 right-4 size-72 text-cotton/15 sm:right-14" />
            <h2 className="relative max-w-2xl text-display-lg font-extrabold text-cotton">Let us carry the paperwork. You stay with family.</h2>
            <p className="relative mt-5 max-w-lg text-lg text-cotton">Start whenever you are ready. It’s free to create an account and look around.</p>
            <Button asChild size="lg" variant="accent" className="relative mt-9">
              <Link href="/signup">
                Start a recovery <ArrowUpRight aria-hidden="true" />
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
