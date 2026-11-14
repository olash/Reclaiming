import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNaira(amount: number, { kobo = false }: { kobo?: boolean } = {}) {
  const value = kobo ? amount / 100 : amount;
  return '₦' + value.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** "REQ-9D2DD8" — the short reference families quote to support. */
export function caseRef(id: string) {
  return 'REQ-' + id.replace(/-/g, '').slice(0, 6).toUpperCase();
}

export function maskAccount(n: string | undefined | null) {
  if (!n) return '—';
  return n.length > 4 ? '•••• ' + n.slice(-4) : n;
}
