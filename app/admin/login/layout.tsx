import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Reviewer login', robots: { index: false } };

export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
