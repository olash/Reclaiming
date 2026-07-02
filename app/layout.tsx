import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reclaimng',
  description: 'Estate asset recovery platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
