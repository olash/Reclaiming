import Link from 'next/link';
import { Logo } from './logo';
import { Button } from './ui/button';
import { SUPPORT_WHATSAPP } from '@/lib/fees';

export function SiteHeader({ minimal = false }: { minimal?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Logo />
        {!minimal && (
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {[
              ['How it works', '/#how-it-works'],
              ['Pricing', '/#pricing'],
              ['Questions', '/#questions'],
            ].map(([label, href]) => (
              <Link key={href} href={href} className="rounded-md px-3 py-2.5 font-medium text-muted-foreground hover:bg-muted hover:text-ink">
                {label}
              </Link>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-2">
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
  return (
    <footer className="border-t bg-surface">
      <div className="container flex flex-col gap-6 py-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm space-y-3">
          <Logo />
          <p className="text-sm text-muted-foreground">
            Helping Nigerian families trace and recover the bank accounts and dividends a loved one left behind.
          </p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-1 text-[0.95rem] sm:flex sm:gap-8">
          {[
            ['How it works', '/#how-it-works'],
            ['Pricing', '/#pricing'],
            ['Questions', '/#questions'],
            ['Privacy', '/privacy'],
            ['Terms', '/terms'],
          ].map(([label, href]) => (
            <Link key={href} href={href} className="py-2 text-muted-foreground underline-offset-4 hover:text-ink hover:underline">
              {label}
            </Link>
          ))}
          <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer" className="py-2 text-muted-foreground underline-offset-4 hover:text-ink hover:underline">
            WhatsApp support
          </a>
        </nav>
      </div>
      <div className="border-t">
        <p className="container py-5 text-sm text-muted-foreground">© {new Date().getFullYear()} Reclaimng. All rights reserved.</p>
      </div>
    </footer>
  );
}
