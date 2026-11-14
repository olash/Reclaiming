import type { Metadata, Viewport } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const display = Fraunces({ subsets: ['latin'], variable: '--font-display', display: 'swap', axes: ['opsz'] });

export const metadata: Metadata = {
  title: { default: 'Reclaimng — Recover what your loved one left behind', template: '%s · Reclaimng' },
  description:
    'Reclaimng helps Nigerian families find and recover the bank accounts and unclaimed dividends of a relative who has passed away — step by step, with real people to help.',
};

export const viewport: Viewport = { themeColor: '#1f5138', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG" className={`${sans.variable} ${display.variable}`}>
      <body>
        <a href="#main" className="skip-link">Skip to main content</a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
