import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Check, Download, X } from 'lucide-react';
import { AdireQuilt, Circled, Motif, type MotifName, Underline } from '@/components/brand/motifs';
import { HelpButton } from '@/components/help-button';
import { LogoMark, Wordmark } from '@/components/logo';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const metadata: Metadata = {
  title: 'Brand guidelines',
  description: 'The Reclaiming identity: logo, colour, type, pattern, voice and components.',
};

const COLOURS = [
  { name: 'Cotton', hex: '#F7F1E6', role: 'The page. Undyed cloth: warm, never stark white.', cls: 'bg-cotton text-ink border border-ink/15', share: 'Most of every screen' },
  { name: 'Indigo', hex: '#2A3586', role: 'Primary actions, links and the mark. The dye of adire.', cls: 'bg-indigo text-cotton', share: 'Actions' },
  { name: 'Indigo night', hex: '#1A2160', role: 'Deep blocks: footer, safety, the quilt.', cls: 'bg-indigo-night text-cotton', share: 'Big moments' },
  { name: 'Ink', hex: '#151A3B', role: 'Text, and selected states.', cls: 'bg-ink text-cotton', share: 'Text' },
  { name: 'Saffron', hex: '#F2B035', role: 'The coin. Highlights, the one loud button, progress “now”. Never text on light.', cls: 'bg-saffron text-ink', share: 'Sparingly' },
  { name: 'Clay', hex: '#B0432A', role: 'Eyebrows, warmth, things that need you.', cls: 'bg-clay text-cotton', share: 'Accents' },
  { name: 'Leaf', hex: '#1D6A48', role: 'Success: done, found, released.', cls: 'bg-leaf text-cotton', share: 'Status only' },
];

const CONTRAST: Array<[string, string, string, string]> = [
  ['Ink on Cotton', '15.0 : 1', 'bg-cotton text-ink border border-ink/15', 'Body text'],
  ['Indigo on Cotton', '9.6 : 1', 'bg-cotton text-indigo border border-ink/15', 'Links, buttons'],
  ['Muted on Cotton', '5.8 : 1', 'bg-cotton text-muted-foreground border border-ink/15', 'Hints'],
  ['Clay on Cotton', '5.1 : 1', 'bg-cotton text-clay border border-ink/15', 'Eyebrows'],
  ['Cotton on Indigo night', '13.1 : 1', 'bg-indigo-night text-cotton', 'Deep blocks'],
  ['Saffron on Indigo night', '7.7 : 1', 'bg-indigo-night text-saffron', 'Highlights'],
  ['Ink on Saffron', '8.9 : 1', 'bg-saffron text-ink', 'Accent button'],
  ['Cotton on Clay', '5.1 : 1', 'bg-clay text-cotton', 'Closing blocks'],
];

const MOTIF_INFO: Array<[MotifName, string, string]> = [
  ['sun', 'Oòrùn: the sun', 'A new day after loss. Used for identity: being seen.'],
  ['waves', 'Olókun: the river', 'Money moving back to where it belongs. Used for search.'],
  ['dots', 'Ìbàdàn dún: market dots', 'Many accounts, found and counted.'],
  ['leaves', 'Ewé: leaves on a stem', 'Family, growth, the papers that hold a lineage.'],
  ['zigzag', 'Àkàbà: the ladder', 'One step at a time. Used where something needs you.'],
  ['spiral', 'Ìgbín: the snail', 'Patience. Used while we review.'],
  ['stitch', 'Ìràwọ̀: stitched stars', 'Care, and the hands that made the cloth.'],
  ['house', 'Ilé: the house', 'Home: where everything recovered ends up.'],
];

function Section({ id, n, title, intro, children }: { id: string; n: string; title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-dashed border-ink/20 py-16 md:py-24">
      <div className="grid gap-8 lg:grid-cols-[0.32fr_1fr]">
        <div>
          <p aria-hidden="true" className="inline-block rounded-md bg-saffron px-3 py-1 font-display text-5xl font-extrabold tracking-tighter text-ink">{n}</p>
          <h2 className="mt-3 text-3xl font-extrabold">{title}</h2>
        </div>
        <div className="min-w-0">
          {intro && <div className="max-w-2xl text-lg text-ink/80 [&>p+p]:mt-4">{intro}</div>}
          <div className={intro ? 'mt-10' : ''}>{children}</div>
        </div>
      </div>
    </section>
  );
}

function DoDont({ good, bad }: { good: string[]; bad: string[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-md border-[1.5px] border-leaf bg-success-soft p-5">
        <p className="flex items-center gap-2 font-bold text-leaf"><Check className="size-5" aria-hidden="true" />Do</p>
        <ul className="mt-3 space-y-2">{good.map((g) => <li key={g}>{g}</li>)}</ul>
      </div>
      <div className="rounded-md border-[1.5px] border-danger bg-danger-soft p-5">
        <p className="flex items-center gap-2 font-bold text-danger"><X className="size-5" aria-hidden="true" />Don’t</p>
        <ul className="mt-3 space-y-2">{bad.map((b) => <li key={b}>{b}</li>)}</ul>
      </div>
    </div>
  );
}

export default function BrandPage() {
  return (
    <>
      <SiteHeader minimal />
      <main id="main">
        {/* Cover */}
        <section className="relative overflow-hidden bg-indigo-night text-cotton">
          <div className="container grid items-end gap-12 py-16 md:py-24 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="eyebrow text-saffron">Brand guidelines · v1.0 · 2026</p>
              <h1 className="mt-5 text-display-xl font-extrabold text-cotton">
                Bring it <span className="text-saffron">home.</span>
              </h1>
              <p className="mt-6 max-w-xl text-xl text-cotton/80">
                How Reclaiming looks, sounds and behaves, so every screen, letter and message feels like it came from the same careful hands.
              </p>
              <nav aria-label="On this page" className="mt-10 flex flex-wrap gap-2">
                {[['Idea', '#idea'], ['Logo', '#logo'], ['Colour', '#colour'], ['Type', '#type'], ['Pattern', '#pattern'], ['Voice', '#voice'], ['Components', '#components'], ['Files', '#files']].map(([l, h]) => (
                  <a key={h} href={h} className="rounded-full border border-cotton/30 px-4 py-2 font-bold text-cotton/90 hover:border-saffron hover:text-saffron">{l}</a>
                ))}
              </nav>
            </div>
            <AdireQuilt className="rounded-lg bg-indigo-night/0" />
          </div>
        </section>

        <div className="container">
          {/* 01 Idea */}
          <Section
            id="idea"
            n="01"
            title="The idea"
            intro={
              <>
                <p>
                  Reclaiming exists for one of the hardest weeks of a family’s life. The brand has to hold two things at once: the weight of grief, and
                  the relief of finally knowing what to do. We call that feeling <strong>liberating calm</strong>.
                </p>
                <p>
                  Our visual language comes from <strong>adire</strong>, the indigo resist-dyed cloth of Abeokuta and Ibadan. Adire is made by hand,
                  square by square, each with its own motif and meaning. It is Nigerian without being a cliché, it is crafted rather than generated,
                  and it is literally about bringing something hidden back to the surface. That is exactly what we do with money.
                </p>
              </>
            }
          >
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ['Human, not corporate', 'Hand-drawn lines, real words, warm paper. Nothing glossy, nothing that looks like a template.'],
                ['Clear, not clever', 'One idea per screen, plain language, big readable type. Older relatives are our core users.'],
                ['Hopeful, not heavy', 'Saffron light against indigo. We acknowledge loss and move people forward.'],
              ].map(([t, b]) => (
                <div key={t} className="rounded-md bg-paper p-6 shadow-card">
                  <h3 className="text-xl font-bold">{t}</h3>
                  <p className="mt-2 text-ink/75">{b}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* 02 Logo */}
          <Section
            id="logo"
            n="02"
            title="Logo"
            intro={
              <p>
                The mark is a lowercase <strong>r</strong> whose arm reaches out and brings the coin home. Read it as a letter, as a person, or as a path
                that curves back. The same saffron coin dots the first <strong>i</strong> in the wordmark, so the two always belong together.
              </p>
            }
          >
            <div className="grid gap-4 md:grid-cols-2">
              <figure className="flex aspect-[16/9] items-center justify-center rounded-lg bg-paper shadow-card">
                <div className="flex items-center gap-3"><LogoMark className="size-16" /><Wordmark className="h-12" /></div>
                <figcaption className="sr-only">Primary lockup on cotton</figcaption>
              </figure>
              <figure className="flex aspect-[16/9] items-center justify-center rounded-lg bg-indigo-night">
                <div className="flex items-center gap-3"><LogoMark className="size-16 text-cotton" /><Wordmark className="h-12 text-cotton" /></div>
                <figcaption className="sr-only">Reversed lockup on indigo night</figcaption>
              </figure>
              <figure className="relative flex aspect-[16/9] items-center justify-center rounded-lg bg-paper shadow-card">
                <div className="relative">
                  <LogoMark className="size-36" />
                  <span className="absolute -right-24 top-2 hidden text-sm font-bold text-clay sm:block">← the coin: what is recovered</span>
                  <span className="absolute -left-28 bottom-6 hidden text-sm font-bold text-clay sm:block">the stem: family →</span>
                </div>
                <figcaption className="absolute bottom-4 left-5 text-sm text-ink/70">Anatomy</figcaption>
              </figure>
              <figure className="flex aspect-[16/9] items-center justify-center gap-6 rounded-lg bg-saffron">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/app-icon.svg" alt="App icon" className="size-24 rounded-[1.4rem] shadow-pop" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/app-icon.svg" alt="" className="size-12 rounded-xl" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/app-icon.svg" alt="" className="size-6 rounded-md" />
              </figure>
            </div>
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="text-xl font-bold">Clear space and size</h3>
                <p className="mt-2 text-ink/75">
                  Keep clear space around the logo equal to the diameter of the coin. The lockup is never smaller than 96px wide on screen
                  (24mm in print); the mark alone is never smaller than 20px.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-bold">Colour</h3>
                <p className="mt-2 text-ink/75">
                  Indigo or ink stem on cotton; cotton stem on indigo night. The coin is always saffron, except in one-colour printing (fax,
                  embossing, stamps), where everything is ink.
                </p>
              </div>
            </div>
            <div className="mt-8">
              <DoDont
                good={['Use the files in /brand as they are', 'Place it on cotton, paper or indigo night', 'Let the coin be the only saffron nearby']}
                bad={['Stretch, rotate or outline it', 'Change the coin colour or drop it', 'Put it on photos or busy patterns', 'Rebuild the wordmark in another font']}
              />
            </div>
          </Section>

          {/* 03 Colour */}
          <Section
            id="colour"
            n="03"
            title="Colour"
            intro={<p>Indigo dye on undyed cotton, with saffron and clay from the market. Cotton does most of the work; saffron is the coin, so it is used like one: rarely, and where it matters.</p>}
          >
            <div className="flex h-14 overflow-hidden rounded-md border border-ink/15" aria-hidden="true">
              <span className="w-[58%] bg-cotton" /><span className="w-[16%] bg-indigo" /><span className="w-[10%] bg-indigo-night" /><span className="w-[8%] bg-ink" /><span className="w-[5%] bg-saffron" /><span className="w-[2%] bg-clay" /><span className="w-[1%] bg-leaf" />
            </div>
            <p className="mt-2 text-sm text-ink/70">Rough proportions across a typical screen.</p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {COLOURS.map((c) => (
                <li key={c.name} className="overflow-hidden rounded-lg bg-paper shadow-card">
                  <div className={`flex h-28 items-end p-4 ${c.cls}`}>
                    <span className="font-display text-2xl font-extrabold">{c.name}</span>
                  </div>
                  <div className="p-4">
                    <p className="font-mono text-sm font-bold">{c.hex}</p>
                    <p className="mt-1.5 text-[0.95rem] text-ink/75">{c.role}</p>
                    <p className="mt-2 text-sm font-bold text-clay">{c.share}</p>
                  </div>
                </li>
              ))}
            </ul>
            <h3 className="mt-12 text-xl font-bold">Approved text pairs (WCAG 2.2 AA)</h3>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {CONTRAST.map(([name, ratio, cls, use]) => (
                <li key={name} className={`flex items-center justify-between gap-3 rounded-md px-4 py-3.5 ${cls}`}>
                  <span className="font-bold">{name}<span className="block text-sm font-normal">{use}</span></span>
                  <span className="font-mono text-sm font-bold">{ratio}</span>
                </li>
              ))}
            </ul>
          </Section>

          {/* 04 Type */}
          <Section
            id="type"
            n="04"
            title="Typography"
            intro={
              <p>
                Two families. <strong>Bricolage Grotesque</strong> for headlines: expressive, slightly irregular, like letters cut by hand.{' '}
                <strong>Atkinson Hyperlegible</strong> for everything you read: designed by the Braille Institute so that similar letters and numbers
                never get confused. Its slashed zero matters when someone is typing an 11-digit NIN or a bank account number.
              </p>
            }
          >
            <div className="space-y-6">
              <div className="rounded-lg bg-paper p-6 shadow-card sm:p-8">
                <p className="text-sm font-bold text-clay">Bricolage Grotesque · ExtraBold 800 · tight tracking</p>
                <p className="mt-3 font-display text-display-lg font-extrabold">Find what they left behind.</p>
                <p className="mt-6 text-sm font-bold text-clay">Atkinson Hyperlegible · Regular 400 / Bold 700 · 17px minimum</p>
                <p className="mt-3 max-w-2xl text-xl">
                  Il1 O0 rn m — 0123456789. Every account linked to their BVN, in one list, with the letters each bank asks for.
                </p>
              </div>
              <table className="w-full text-left">
                <caption className="sr-only">Type scale</caption>
                <thead className="text-sm text-ink/70"><tr><th scope="col" className="pb-2 font-bold">Style</th><th scope="col" className="pb-2 font-bold">Size</th><th scope="col" className="pb-2 font-bold">Use</th></tr></thead>
                <tbody className="divide-y divide-dashed divide-ink/20">
                  {[
                    ['Display XL', '48 → 108px', 'Landing hero only'],
                    ['Display L', '40 → 72px', 'Section headlines, page heroes'],
                    ['Display M', '32 → 48px', 'Page titles in the app'],
                    ['Heading', '24 → 32px', 'Card and step titles'],
                    ['Body L', '20px', 'Intros'],
                    ['Body', '17px', 'Everything else'],
                    ['Eyebrow', '14px, bold, caps, clay', 'Labels above headings'],
                  ].map(([s, z, u]) => (
                    <tr key={s}><th scope="row" className="py-3 font-bold">{s}</th><td className="py-3 font-mono text-sm">{z}</td><td className="py-3 text-ink/75">{u}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* 05 Pattern */}
          <Section
            id="pattern"
            n="05"
            title="Pattern & hand"
            intro={
              <p>
                Eight motifs, drawn with a deliberate wobble so no line is perfectly straight. Each has a meaning and a job. Together they form the{' '}
                <strong>quilt</strong>, our signature image. A saffron square in the quilt is always the coin.
              </p>
            }
          >
            <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {MOTIF_INFO.map(([m, name, meaning], i) => (
                <li key={m} className="overflow-hidden rounded-lg bg-paper shadow-card">
                  <div className={`aspect-square ${i % 3 === 0 ? 'bg-indigo text-cotton/85' : i % 3 === 1 ? 'bg-indigo-night text-cotton/85' : 'bg-saffron text-ink'}`}>
                    <Motif name={m} seed={i + 1} className="size-full p-[14%]" />
                  </div>
                  <div className="p-4">
                    <p className="font-bold">{name}</p>
                    <p className="mt-1 text-sm text-ink/75">{meaning}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <div className="rounded-lg bg-paper p-8 shadow-card">
                <p className="font-display text-4xl font-extrabold tracking-tight">Every account, <Underline>in one place.</Underline></p>
                <p className="mt-4 text-ink/75">The saffron underline marks the one phrase that matters. Once per screen, at most.</p>
              </div>
              <div className="rounded-lg bg-paper p-8 shadow-card">
                <p className="font-display text-4xl font-extrabold tracking-tight">Three things. <Circled>That’s it.</Circled></p>
                <p className="mt-4 text-ink/75">The clay circle reassures: it marks something small, simple or done.</p>
              </div>
            </div>
            <div className="mt-8">
              <DoDont
                good={['Use motifs as texture behind or beside content', 'Match motif to meaning (spiral = waiting)', 'Keep text off busy pattern areas']}
                bad={['Put text directly on a motif', 'Use more than one hand-drawn accent per screen', 'Recolour motifs outside the palette', 'Animate patterns continuously']}
              />
            </div>
          </Section>

          {/* 06 Voice */}
          <Section
            id="voice"
            n="06"
            title="Voice & tone"
            intro={<p>We sound like the most capable person in the family: the one who has done this before, speaks plainly, and doesn’t rush you.</p>}
          >
            <ul className="grid gap-4 sm:grid-cols-2">
              {[
                ['Plain over legal', 'Say “the papers the court gives you”, then name them: Letters of Administration.'],
                ['Honest about time and money', 'Always show the amount before payment and the real wait (“up to 30 days”).'],
                ['Gentle with grief', '“Your loved one”, “passed away”. Never “the deceased” on screen.'],
                ['Say what happens next', 'Every screen ends by telling people what comes next, and whose turn it is.'],
              ].map(([t, b]) => (
                <li key={t} className="rounded-md border border-ink/15 bg-paper p-5">
                  <p className="text-lg font-bold">{t}</p>
                  <p className="mt-1.5 text-ink/75">{b}</p>
                </li>
              ))}
            </ul>
            <div className="mt-8 overflow-hidden rounded-lg border border-ink/15">
              <table className="w-full text-left">
                <caption className="sr-only">Words we use and avoid</caption>
                <thead className="bg-ink text-cotton"><tr><th scope="col" className="px-4 py-3">We say</th><th scope="col" className="px-4 py-3">Instead of</th></tr></thead>
                <tbody className="divide-y divide-ink/10 bg-paper">
                  {[
                    ['Your loved one passed away', 'The deceased / decedent'],
                    ['We could not approve the documents yet', 'Submission rejected'],
                    ['There is nothing you need to do right now', 'Status: pending'],
                    ['Find every linked account', 'Initiate BVN asset discovery'],
                    ['Chat with us', 'Contact support'],
                  ].map(([a, b]) => (
                    <tr key={a}><td className="px-4 py-3 font-bold">{a}</td><td className="px-4 py-3 text-ink/70 line-through decoration-clay/60">{b}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* 07 Components */}
          <Section
            id="components"
            n="07"
            title="Components"
            intro={<p>Built on Radix primitives in the shadcn/ui style, themed with our tokens. Big targets (48px+), visible focus, labels always above fields.</p>}
          >
            <div className="space-y-8 rounded-lg bg-paper p-6 shadow-card sm:p-8">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-clay">Buttons</h3>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button variant="accent">The one big action <ArrowRight aria-hidden="true" /></Button>
                  <Button>Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="ghost">Ghost</Button>
                </div>
                <p className="mt-3 text-[0.95rem] text-ink/70">Saffron “accent” is used once per screen at most, for the moment that matters most.</p>
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-clay">Status</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge tone="warning">In review</Badge><Badge tone="info">Your turn</Badge><Badge tone="success">Accounts found</Badge><Badge tone="danger">Needs your attention</Badge><Badge tone="accent">New</Badge>
                </div>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-clay">Field</h3>
                  <label htmlFor="demo-nin" className="mt-4 block font-bold">National Identification Number (NIN)</label>
                  <p id="demo-nin-hint" className="mt-1 text-[0.95rem] text-muted-foreground">11 digits, on your NIN slip.</p>
                  <Input id="demo-nin" aria-describedby="demo-nin-hint" defaultValue="63184876213" className="mt-2 tracking-widest" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-clay">Message</h3>
                  <Alert tone="success" title="Your documents are approved" className="mt-4">The next step is yours: search for every linked account.</Alert>
                </div>
              </div>
            </div>
          </Section>

          {/* 08 Files */}
          <Section id="files" n="08" title="Files">
            <ul className="grid gap-3 sm:grid-cols-2">
              {[
                ['Primary lockup', '/brand/lockup.svg'],
                ['Reversed lockup', '/brand/lockup-reversed.svg'],
                ['Mark', '/brand/mark.svg'],
                ['Mark, one colour', '/brand/mark-ink.svg'],
                ['Mark on indigo', '/brand/mark-reversed.svg'],
                ['Wordmark', '/brand/wordmark.svg'],
                ['Wordmark, reversed', '/brand/wordmark-reversed.svg'],
                ['App icon', '/brand/app-icon.svg'],
              ].map(([l, h]) => (
                <li key={h}>
                  <a href={h} download className="flex min-h-14 items-center justify-between gap-3 rounded-md border border-ink/15 bg-paper px-5 font-bold hover:border-ink">
                    {l} <span className="flex items-center gap-1.5 text-sm text-ink/70">SVG <Download className="size-4" aria-hidden="true" /></span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-ink/75">
              The full written guide lives in the repository at <code className="rounded bg-muted px-1.5 py-0.5 text-[0.95em]">docs/BRAND.md</code>. Fonts are free on Google Fonts.{' '}
              <Link href="/" className="font-bold text-primary underline decoration-saffron decoration-2 underline-offset-4">Back to the site</Link>.
            </p>
          </Section>
        </div>
      </main>
      <SiteFooter />
      <HelpButton />
    </>
  );
}
