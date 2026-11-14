'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, ClipboardCheck, FolderHeart, LogOut, Menu, MessageCircle, PlusCircle, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
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

const ADMIN_NAV = { href: '/app/admin', label: 'Review queue', icon: ClipboardCheck, match: (p: string) => p.startsWith('/app/admin') };

/** Whether the signed-in person is on the review team (decided on the server). */
function useIsAdmin() {
  const { user } = useAuth();
  const [admin, setAdmin] = React.useState(false);
  React.useEffect(() => {
    if (!user) return;
    let active = true;
    api<{ admin: boolean }>('/api/admin/me').then((r) => active && setAdmin(r.admin)).catch(() => {});
    return () => {
      active = false;
    };
  }, [user]);
  return admin;
}

function NavLinks({ onNavigate, layout = 'stack' }: { onNavigate?: () => void; layout?: 'stack' | 'bar' }) {
  const pathname = usePathname();
  const admin = useIsAdmin();
  return (
    <ul className={layout === 'bar' ? 'flex items-center gap-1' : 'space-y-1'}>
      {(admin ? [...NAV, ADMIN_NAV] : NAV).map((item) => {
        const active = item.match(pathname);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                layout === 'bar'
                  ? 'flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full px-4 font-bold transition-colors'
                  : 'flex min-h-14 items-center gap-3 rounded-md px-4 text-lg font-bold',
                active ? 'bg-ink text-cotton' : 'text-ink/70 hover:bg-ink/[0.06] hover:text-ink',
              )}
            >
              <item.icon className={cn('size-5 shrink-0', active && 'text-saffron', layout === 'bar' && 'hidden xl:block')} aria-hidden="true" />
              {item.label}
            </Link>
          </li>
        );
      })}
      <li className={layout === 'bar' ? 'hidden' : 'border-t border-dashed border-ink/20 pt-2'}>
        <a
          href={SUPPORT_WHATSAPP}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-14 items-center gap-3 rounded-md px-4 text-lg font-bold text-ink/70 hover:bg-ink/[0.06] hover:text-ink"
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
      <DropdownMenuTrigger className="flex min-h-11 items-center gap-2 rounded-full border border-ink/15 bg-surface py-1 pl-1 pr-3 transition-colors hover:border-ink/40">
        <span className="flex size-9 items-center justify-center rounded-full bg-saffron font-display text-lg font-extrabold text-ink" aria-hidden="true">{initial}</span>
        <span className="hidden max-w-36 truncate font-bold sm:block">{name}</span>
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
    <div className="grain flex min-h-dvh flex-col">
      <header className="no-print sticky top-0 z-30 border-b border-ink/10 bg-cotton/85 backdrop-blur-md">
        <div className="mx-auto flex h-[4.25rem] w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1">
            <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
              <DialogTrigger className="-ml-2 inline-flex size-11 items-center justify-center rounded-full hover:bg-ink/[0.06] lg:hidden">
                <Menu className="size-6" aria-hidden="true" />
                <span className="sr-only">Open menu</span>
              </DialogTrigger>
              <DialogContent side="left">
                <DialogTitle className="sr-only">Menu</DialogTitle>
                <DialogDescription className="sr-only">Navigate around your account</DialogDescription>
                <div className="px-2 py-2"><Logo href="/app" /></div>
                <nav aria-label="Main" className="mt-8"><NavLinks onNavigate={() => setMenuOpen(false)} /></nav>
              </DialogContent>
            </Dialog>
            <Logo href="/app" />
          </div>
          <nav aria-label="Main" className="hidden lg:block"><NavLinks layout="bar" /></nav>
          <UserMenu />
        </div>
      </header>
      <main id="main" className="flex-1 px-4 pb-24 pt-8 sm:px-6 lg:px-8 lg:pt-12">
        <div className="mx-auto w-full max-w-4xl">{children}</div>
      </main>
    </div>
  );
}
