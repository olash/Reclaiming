import Link from 'next/link';
import { WORDMARK } from '@/components/brand/wordmark-path';
import { cn } from '@/lib/utils';

/**
 * The mark: a lowercase "r" whose arm reaches out and brings the coin home.
 * Stem in currentColor (indigo by default), coin in saffron.
 */
export function LogoMark({ className, coin = 'fill-saffron' }: { className?: string; coin?: string }) {
  return (
    <svg viewBox="2.3 2.1 48 48" className={cn('size-9 text-primary', className)} aria-hidden="true" focusable="false">
      <path d="M13.5 39.5V25c0-7.6 5-12.2 12.6-12.2" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
      <circle cx="36.2" cy="15.6" r="7.4" className={coin} />
    </svg>
  );
}

/** The wordmark: "reclaimng", where the dot of the i is the same saffron coin. */
export function Wordmark({ className, coin = 'fill-saffron' }: { className?: string; coin?: string }) {
  return (
    <svg viewBox={WORDMARK.viewBox} className={cn('h-6 w-auto text-ink', className)} role="img" aria-label="Reclaimng" focusable="false">
      <path d={WORDMARK.d} fill="currentColor" />
      <circle cx={WORDMARK.dot.cx} cy={WORDMARK.dot.cy} r={WORDMARK.dot.r} className={coin} />
    </svg>
  );
}

export function Logo({
  href = '/',
  className,
  tone = 'default',
}: {
  href?: string;
  className?: string;
  /** "reversed" for indigo backgrounds. */
  tone?: 'default' | 'reversed';
}) {
  const rev = tone === 'reversed';
  return (
    <Link href={href} className={cn('group inline-flex items-center gap-2 rounded-md', className)} aria-label="Reclaimng home">
      <LogoMark className={cn('size-8 transition-transform duration-300 group-hover:-rotate-6', rev ? 'text-cotton' : 'text-primary')} />
      <Wordmark className={cn('h-[1.45rem]', rev ? 'text-cotton' : 'text-ink')} />
    </Link>
  );
}
