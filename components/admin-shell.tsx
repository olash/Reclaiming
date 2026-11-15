'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { displayName, useAuth } from '@/lib/auth-context';
import { isSupabaseConfigured } from '@/lib/supabase-browser';
import { Motif } from './brand/motifs';
import { Logo } from './logo';
import { Alert } from './ui/alert';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';

/** What a family account sees at an admin address: an ordinary "not found". */
function NotForYou() {
  return (
    <main id="main" className="grain container flex min-h-dvh flex-col items-center justify-center py-16 text-center">
      <Motif name="spiral" seed={4} className="size-36 text-saffron" strokeWidth={3.2} />
      <p className="eyebrow mt-8">Page not found</p>
      <h1 className="mt-3 max-w-xl text-display-md font-extrabold">This path doesn’t lead anywhere, yet.</h1>
      <p className="mt-4 max-w-md text-lg text-ink/75">The link may be old or mistyped. Everything you started is still safe in your account.</p>
      <Button asChild size="lg" className="mt-8"><Link href="/app">Go to your cases</Link></Button>
    </main>
  );
}

/**
 * Frame for the review console. Only reviewers (ADMIN_EMAILS, checked on the
 * server) get past it: signed-out visitors go to the reviewer login, and
 * family accounts see "page not found". Every admin API also checks the role
 * on the server, so this frame is about what people see, not the only lock.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const { loading, user, role, roleLoading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (!loading && !user && isSupabaseConfigured()) router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, user, router, pathname]);

  if (!isSupabaseConfigured()) {
    return (
      <main id="main" className="container max-w-xl py-20">
        <Alert tone="warning" title="The app is not connected yet">NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY need to be set for this deployment.</Alert>
      </main>
    );
  }
  if (loading || !user || roleLoading) {
    return (
      <div className="container max-w-4xl space-y-4 py-16" role="status" aria-live="polite">
        <span className="sr-only">Loading…</span>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (role !== 'admin') return <NotForYou />;

  const name = displayName(user) || user.email || 'Reviewer';
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="no-print sticky top-0 z-30 bg-indigo-night text-cotton">
        <div className="mx-auto flex h-[4.25rem] w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Logo href="/admin" tone="reversed" />
            <span className="hidden rounded-full bg-saffron px-3 py-1 text-sm font-bold text-ink sm:inline-block">Review console</span>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden max-w-56 truncate text-sm text-cotton/80 md:block">
              Signed in as <span className="font-bold text-cotton">{name}</span>
            </span>
            <Button variant="ghost" size="sm" className="text-cotton hover:bg-cotton/10 hover:text-cotton" onClick={() => signOut()}>
              <LogOut aria-hidden="true" />
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main id="main" className="grain flex-1 px-4 pb-24 pt-8 sm:px-6 lg:px-8 lg:pt-12">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
