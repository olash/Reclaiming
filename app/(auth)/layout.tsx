import { AdireQuilt } from '@/components/brand/motifs';
import { HelpButton } from '@/components/help-button';
import { Logo } from '@/components/logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-indigo-night p-12 text-cotton lg:flex">
        <Logo tone="reversed" />
        <div className="relative z-10">
          <p className="font-display text-[2.75rem] font-extrabold leading-[1.02] tracking-tight">
            One calm place for <span className="text-saffron">everything</span> they left you.
          </p>
          <ul className="mt-8 space-y-3 text-lg text-cotton/85">
            {['Every account that is found, in one list', 'Fees shown before you pay', 'A real person to talk to, at every step'].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="size-2.5 shrink-0 rounded-full bg-saffron" aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <AdireQuilt cols={6} tiles={['waves', 'sun', 'dots', 'coin', 'leaves', 'zigzag']} className="-mx-12 mb-8 bg-indigo-night p-0" />
          <p className="text-sm text-cotton/70">Your details are private and protected under the Nigeria Data Protection Act 2023.</p>
        </div>
      </aside>
      <div className="grain flex flex-col">
        <header className="container flex h-[4.25rem] items-center lg:hidden">
          <Logo />
        </header>
        <main id="main" className="container flex flex-1 items-center justify-center py-8 lg:py-14">
          <div className="w-full max-w-md animate-fade-up">{children}</div>
        </main>
      </div>
    </div>
    <HelpButton />
    </>
  );
}
