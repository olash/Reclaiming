'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { GoogleButton, OrDivider, PasswordInput, friendlyAuthError } from '@/components/auth-bits';
import { AdireQuilt } from '@/components/brand/motifs';
import { Logo } from '@/components/logo';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase-browser';

/**
 * The reviewer's own front door. Anyone can sign in here, but only accounts
 * listed in ADMIN_EMAILS (checked on the server) are let through. A family
 * account is signed straight back out and told where families log in.
 */
function AdminLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');
  const destination = next && /^\/admin(\/|$)/.test(next) && !next.startsWith('/admin/login') ? next : '/admin';
  const { loading, user, role } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [errors, setErrors] = React.useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = React.useState(false);
  const attempted = React.useRef(false);

  React.useEffect(() => {
    if (loading || !user || !role) return;
    if (role === 'admin') {
      router.replace(destination);
    } else if (attempted.current) {
      // Signed in with a family account on the reviewer login: undo it and explain.
      attempted.current = false;
      setBusy(false);
      supabase().auth.signOut();
      setErrors({ form: 'This account does not have reviewer access. Families log in on the main login page.' });
    }
  }, [loading, user, role, router, destination]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) nextErrors.email = 'Enter your email address, like name@example.com.';
    if (!password) nextErrors.password = 'Enter your password.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setBusy(true);
    attempted.current = true;
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      attempted.current = false;
      setBusy(false);
      setErrors({ form: friendlyAuthError(error) });
    }
  }

  const signedInAsFamily = !loading && !!user && role === 'family' && !errors.form;

  return (
    <div className="w-full max-w-md rounded-xl bg-paper p-6 text-ink shadow-pop sm:p-9">
      <p className="eyebrow"><ShieldCheck className="size-4" aria-hidden="true" />Review team only</p>
      <h1 className="mt-3 text-[2.5rem] font-extrabold leading-[1.02]">Reviewer login</h1>
      <p className="mt-3 text-ink/75">Sign in to check documents and approve cases.</p>

      {errors.form && <Alert tone="danger" className="mt-6" title="We could not let you in">{errors.form}</Alert>}
      {signedInAsFamily && (
        <Alert tone="info" className="mt-6" title={`You are signed in as ${user?.email}`}>
          <p>That is a family account. Log out first to sign in as a reviewer.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => supabase().auth.signOut()}>Log out</Button>
            <Button size="sm" variant="ghost" asChild><Link href="/app">Go to your cases</Link></Button>
          </div>
        </Alert>
      )}

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
        <Field label="Email address" error={errors.email}>
          {(f) => <Input {...f} type="email" name="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label="Password" error={errors.password}>
          {(f) => <PasswordInput {...f} name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <Button type="submit" className="w-full" loading={busy} loadingText="Checking your access…">Log in to the console</Button>
      </form>

      <OrDivider />
      <GoogleButton next={destination} />

      <p className="mt-8 text-center text-ink/70">
        Not on the review team?{' '}
        <Link href="/login" className="font-bold text-primary underline decoration-saffron decoration-2 underline-offset-4 hover:decoration-primary">Family login</Link>
      </p>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-indigo-night text-cotton">
      <AdireQuilt cols={8} tiles={['waves', 'sun', 'dots', 'stitch', 'coin', 'zigzag', 'house', 'spiral']} className="bg-indigo-night p-0 [&>div]:aspect-[1/0.6]" />
      <header className="container flex h-[4.25rem] items-center justify-between">
        <Logo tone="reversed" />
        <span className="rounded-full bg-saffron px-3 py-1 text-sm font-bold text-ink">Review console</span>
      </header>
      <main id="main" className="container flex flex-1 items-start justify-center pb-16 pt-6 sm:items-center">
        <React.Suspense>
          <AdminLoginForm />
        </React.Suspense>
      </main>
    </div>
  );
}
