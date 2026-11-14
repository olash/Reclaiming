import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { HelpButton } from './help-button';
import { SiteFooter, SiteHeader } from './site-chrome';

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <SiteHeader minimal />
      <main id="main">
        <div className="border-b border-ink/10 bg-paper">
          <div className="container max-w-3xl py-12 md:py-16">
            <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 rounded-full py-2 pr-3 font-bold text-ink/75 hover:text-ink"><ArrowLeft className="size-4" aria-hidden="true" />Home</Link>
            <p className="eyebrow mt-6">The fine print, in plain sight</p>
            <h1 className="mt-3 text-display-lg font-extrabold">{title}</h1>
            <p className="mt-4 text-ink/70">{updated}</p>
          </div>
        </div>
        <div className="container max-w-3xl pb-20">
          <div className="prose-legal text-[1.0625rem] leading-relaxed">{children}</div>
        </div>
      </main>
      <SiteFooter />
      <HelpButton />
    </>
  );
}
