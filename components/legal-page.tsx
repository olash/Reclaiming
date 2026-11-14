import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { HelpButton } from './help-button';
import { SiteFooter, SiteHeader } from './site-chrome';

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <SiteHeader minimal />
      <main id="main" className="container max-w-3xl py-12 md:py-16">
        <Link href="/" className="inline-flex items-center gap-1.5 rounded-md py-2 font-semibold text-primary"><ArrowLeft className="size-4" aria-hidden="true" />Home</Link>
        <h1 className="mt-4 text-4xl font-semibold">{title}</h1>
        <p className="mt-2 text-muted-foreground">{updated}</p>
        <div className="prose-legal mt-4 text-[1.05rem] leading-relaxed">{children}</div>
      </main>
      <SiteFooter />
      <HelpButton />
    </>
  );
}
