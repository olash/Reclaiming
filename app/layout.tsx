import type { Metadata, Viewport } from 'next';
import { Atkinson_Hyperlegible, Bricolage_Grotesque } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';

// Body: Atkinson Hyperlegible, drawn for low-vision readers. Many of the people we serve are older relatives.
const sans = Atkinson_Hyperlegible({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-sans', display: 'swap' });
// Display: Bricolage Grotesque, expressive and a little irregular, like hand-cut type.
const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap', axes: ['opsz', 'wdth'] });

export const metadata: Metadata = {
  title: { default: 'Reclaimng — Recover what your loved one left behind', template: '%s · Reclaimng' },
  description:
    'Reclaimng helps Nigerian families find and recover the bank accounts and unclaimed dividends of a relative who has passed away — step by step, with real people to help.',
};

export const viewport: Viewport = { themeColor: '#1A2160', width: 'device-width', initialScale: 1 };

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
