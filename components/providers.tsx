'use client';

import { Toaster } from 'sonner';
import { AuthProvider } from '@/lib/auth-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <Toaster
        position="top-center"
        richColors
        closeButton
        duration={7000}
        toastOptions={{ classNames: { toast: 'text-base font-sans rounded-md', title: 'font-bold' } }}
      />
    </AuthProvider>
  );
}
