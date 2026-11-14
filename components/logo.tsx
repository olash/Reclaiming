import Link from 'next/link';
import { cn } from '@/lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden="true">
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path d="M16 7.5c-3.6 2.7-6.2 5-6.2 9.2a6.2 6.2 0 0 0 12.4 0c0-4.2-2.6-6.5-6.200-9.200Z" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M16 13.500v9" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m12.900 17 3.100 2.600 3.100-2.600" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ href = '/', className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn('inline-flex items-center gap-2.5 rounded-md', className)} aria-label="Reclaimng home">
      <LogoMark />
      <span className="font-display text-xl font-semibold tracking-tight text-ink">Reclaimng</span>
    </Link>
  );
}
