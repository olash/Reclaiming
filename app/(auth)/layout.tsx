import { Check } from 'lucide-react';
import { HelpButton } from '@/components/help-button';
import { Logo } from '@/components/logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="hidden flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <Logo className="[&_span]:text-primary-foreground [&_rect]:fill-white/15" />
        <div>
          <p className="font-display text-3xl font-semibold leading-snug">A calmer way to recover what a loved one left behind.</p>
          <ul className="mt-8 space-y-4 text-lg text-primary-foreground/90">
            {['One place to see every account that is found', 'Clear fees, shown before you pay', 'A real person to talk to at every step'].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <Check className="mt-1 size-5 shrink-0" aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-primary-foreground/75">Your details are private and protected under the Nigeria Data Protection Act 2023.</p>
      </aside>
      <div className="flex flex-col">
        <header className="container flex h-16 items-center lg:hidden">
          <Logo />
        </header>
        <main id="main" className="container flex flex-1 items-center justify-center py-8 lg:py-12">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
      <HelpButton />
    </div>
  );
}
