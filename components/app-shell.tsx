'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, FolderHeart, LogOut, Menu, MessageCircle, PlusCircle, Wallet } from 'lucide-react';
import { displayName, useAuth } from '@/lib/auth-context';
import { isSupabaseConfigured } from '@/lib/supabase-browser';
import { SUPPORT_WHATSAPP } from '@/lib/fees';
import { cn } from '@/lib/utils';
import { Logo } from './logo';
import { Alert } from './ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Skeleton } from './ui/skeleton';

const NAV = [
  { href: '/app', label: 'Your cases', icon: FolderHeart, match: (p: string) => p === '/app' || p.startsWith('/app/estates') },
  { href: '/app/new', label: 'Start a recovery', icon: PlusCircle, match: (p: string) => p.startsWith('/app/new') },
  { href: '/app/vault', label: 'Recovered funds', icon: Wallet, match: (p: string) => p.startsWith('/app/vault') },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {NAV.map((item) => {
        const active = item.match(pathname);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-12 items-center gap-3 rounded-md px-3 font-medium',
                active ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:bg-muted hover:text-ink',
              )}
            >
              <item.icon className="size-5 shrink-0" aria-hidden="true" />
              {item.label}
            </Link>
          </li>
        );
      })}
      <li>
        <a
          href={SUPPORT_WHATSAPP}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-12 items-center gap-3 rounded-md px-3 font-medium text-muted-foreground hover:bg-muted hover:text-ink"
        >
          <MessageCircle className="size-5 shrink-0" aria-hidden="true" />
          Get help on WhatsApp
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </li>
    </ul>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const name = displayName(user) || user?.email || 'Account';
  const initial = name.trim().charAt(0).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-h-11 items-center gap-2 rounded-full border bg-surface py-1 pl-1 pr-3 hover:bg-muted">
        <span className="flex size-9 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground" aria-hidden="true">{initial}</span>
        <span className="hidden max-w-40 truncate font-medium sm:block">{name}</span>
        <span className="sr-only sm:hidden">Account menu</span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          Signed in as
          <span className="block truncate font-medium text-ink">{user?.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut()}>
          <LogOut aria-hidden="true" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Frame for every signed-in page. It also guards them: nothing inside is
 * rendered until we know someone is signed in, and a signed-out visitor is
 * sent to log in and then brought back to the page they asked for.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => {
    if (!loading && !user && isSupabaseConfigured()) {
      const here = pathname + (typeof window !== 'undefined' ? window.location.search : '');
      router.replace(`/login?reason=signin&next=${encodeURIComponent(here)}`);
    }
  }, [loading, user, router, pathname]);

  if (!isSupabaseConfigured()) {
    return (
      <main id="main" className="container max-w-xl py-20">
        <Alert tone="warning" title="The app is not connected yet">
          NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY need to be set for this deployment.
        </Alert>
      </main>
    );
  }

  if (loading || !user) {
    return (
      <div className="container max-w-3xl space-y-4 py-16" role="status" aria-live="polite">
        <span className="sr-only">Loading your account…</span>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-dvh flex-col border-r bg-surface p-4 lg:flex">
        <div className="px-2 py-3"><Logo href="/app" /></div>
        <nav aria-label="Main" className="mt-6 flex-1"><NavLinks /></nav>
        <p className="px-3 text-sm text-muted-foreground">Stuck on anything? Message us — a real person will reply.</p>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-background/90 px-4 backdrop-blur sm:px-6 lg:justify-end lg:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
              <DialogTrigger className="inline-flex size-11 items-center justify-center rounded-md hover:bg-muted">
                <Menu className="size-6" aria-hidden="true" />
                <span className="sr-only">Open menu</span>
              </DialogTrigger>
              <DialogContent side="left">
                <DialogTitle className="sr-only">Menu</DialogTitle>
                <DialogDescription className="sr-only">Navigate around your account</DialogDescription>
                <div className="px-2 py-2"><Logo href="/app" /></div>
                <nav aria-label="Main" className="mt-6"><NavLinks onNavigate={() => setMenuOpen(false)} /></nav>
              </DialogContent>
            </Dialog>
            <Logo href="/app" />
          </div>
          <UserMenu />
        </header>
        <main id="main" className="flex-1 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          <div className="mx-auto w-full max-w-4xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
