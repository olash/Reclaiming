import Link from 'next/link';
import { AdireQuilt } from './brand/motifs';
import { Logo, Wordmark } from './logo';
import { Button } from './ui/button';
import { SUPPORT_WHATSAPP } from '@/lib/fees';

const LINKS = [
  ['How it works', '/#how-it-works'],
  ['Pricing', '/#pricing'],
  ['Questions', '/#questions'],
] as const;

export function SiteHeader({ minimal = false }: { minimal?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-ink/10 bg-cotton/85 backdrop-blur-md">
      <div className="container flex h-[4.25rem] items-center justify-between gap-4">
        <Logo />
        {!minimal && (
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {LINKS.map(([label, href]) => (
              <Link key={href} href={href} className="rounded-full px-4 py-2.5 font-bold text-ink/75 transition-colors hover:bg-ink/[0.06] hover:text-ink">
                {label}
              </Link>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-1.5">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative overflow-hidden bg-indigo-night text-cotton">
      <AdireQuilt
        cols={12}
        tiles={['waves', 'dots', 'sun', 'zigzag', 'leaves', 'stitch', 'coin', 'spiral', 'house', 'waves', 'dots', 'sun']}
        className="bg-indigo-night p-0 [&>div]:aspect-[1/0.55]"
      />
      <div className="container grid gap-12 py-14 md:grid-cols-[1.2fr_1fr] md:py-20">
        <div>
          <p className="max-w-md font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            What they built for you should reach you.
          </p>
          <p className="mt-4 max-w-sm text-cotton/75">
            Reclaimng helps Nigerian families trace and recover the bank accounts and dividends a loved one left behind.
          </p>
          <Button asChild variant="accent" className="mt-8">
            <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer">
              Talk to a person<span className="sr-only"> on WhatsApp (opens in a new tab)</span>
            </a>
          </Button>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 content-start gap-x-8 gap-y-1 sm:grid-cols-3">
          {[...LINKS, ['Privacy', '/privacy'], ['Terms', '/terms'], ['Brand', '/brand']].map(([label, href]) => (
            <Link key={href} href={href} className="py-2.5 font-bold text-cotton/80 underline-offset-4 hover:text-cotton hover:underline">
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="container pb-8">
        <Wordmark className="h-auto w-full text-cotton/[0.12]" coin="fill-saffron" />
        <div className="mt-6 flex flex-col justify-between gap-2 border-t border-cotton/15 pt-6 text-sm text-cotton/70 sm:flex-row">
          <p>© {year} Reclaimng. Made with care in Lagos.</p>
          <p>Protected under the Nigeria Data Protection Act 2023.</p>
        </div>
      </div>
    </footer>
  );
}
