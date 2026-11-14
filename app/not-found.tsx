import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Motif } from '@/components/brand/motifs';
import { HelpButton } from '@/components/help-button';
import { SiteHeader } from '@/components/site-chrome';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <>
      <SiteHeader minimal />
      <main id="main" className="container flex min-h-[calc(100dvh-4.25rem)] flex-col items-center justify-center py-16 text-center">
        <div className="relative">
          <Motif name="spiral" seed={4} className="size-40 text-saffron sm:size-52" strokeWidth={3.2} />
        </div>
        <p className="eyebrow mt-8">Page not found</p>
        <h1 className="mt-3 max-w-xl text-display-md font-extrabold">This path doesn’t lead anywhere, yet.</h1>
        <p className="mt-4 max-w-md text-lg text-ink/75">The link may be old or mistyped. Everything you started is still safe in your account.</p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/app">Go to your cases</Link>
          </Button>
          <Button asChild size="lg" variant="ghost">
            <Link href="/"><ArrowLeft aria-hidden="true" />Back to the home page</Link>
          </Button>
        </div>
      </main>
      <HelpButton />
    </>
  );
}
