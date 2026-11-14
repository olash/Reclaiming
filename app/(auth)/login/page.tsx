'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { GoogleButton, OrDivider, PasswordInput, friendlyAuthError } from '@/components/auth-bits';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase-browser';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');
  const destination = next && next.startsWith('/app') ? next : '/app';
  const { loading: authLoading, user } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [errors, setErrors] = React.useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!authLoading && user) router.replace(destination);
  }, [authLoading, user, router, destination]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Enter your email address, like name@example.com.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setBusy(false);
      setErrors({ form: friendlyAuthError(error) });
      return;
    }
    router.replace(destination);
  }

  return (
    <>
      <h1 className="text-[2.5rem] font-extrabold leading-[1.02]">Welcome back</h1>
      <p className="mt-2 text-muted-foreground">Log in to see your cases and continue where you stopped.</p>

      {params.get('reason') === 'signin' && (
        <Alert tone="info" className="mt-6">Please log in to continue.</Alert>
      )}
      {errors.form && (
        <Alert tone="danger" className="mt-6" title="We could not log you in">{errors.form}</Alert>
      )}

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
        <Field label="Email address" error={errors.email}>
          {(f) => <Input {...f} type="email" name="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label="Password" error={errors.password}>
          {(f) => <PasswordInput {...f} name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <div className="flex justify-end">
          <Link href={email.trim() ? `/forgot-password?email=${encodeURIComponent(email.trim())}` : '/forgot-password'} className="py-1 font-bold text-primary underline decoration-saffron decoration-2 underline-offset-4 hover:decoration-primary">Forgot your password?</Link>
        </div>
        <Button type="submit" className="w-full" loading={busy} loadingText="Logging in…">Log in</Button>
      </form>

      <OrDivider />
      <GoogleButton next={destination} />

      <p className="mt-8 text-center text-muted-foreground">
        New to Reclaimng?{' '}
        <Link href="/signup" className="font-bold text-primary underline decoration-saffron decoration-2 underline-offset-4 hover:decoration-primary">Create an account</Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense>
      <LoginForm />
    </React.Suspense>
  );
}
