'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MailCheck } from 'lucide-react';
import { GoogleButton, OrDivider, PasswordInput, friendlyAuthError } from '@/components/auth-bits';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase-browser';

export default function SignupPage() {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [errors, setErrors] = React.useState<{ name?: string; email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = React.useState(false);
  const [confirmSentTo, setConfirmSentTo] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!authLoading && user) router.replace('/app');
  }, [authLoading, user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (name.trim().length < 2) next.name = 'Enter your full name.';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Enter your email address, like name@example.com.';
    if (password.length < 8) next.password = 'Choose a password with at least 8 characters.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const { data, error } = await supabase().auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim() }, emailRedirectTo: `${window.location.origin}/app` },
    });
    if (error) {
      setBusy(false);
      setErrors({ form: friendlyAuthError(error) });
      return;
    }
    if (data.session) router.replace('/app');
    else {
      setBusy(false);
      setConfirmSentTo(email.trim());
    }
  }

  if (confirmSentTo) {
    return (
      <div className="text-center" role="status">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary"><MailCheck className="size-7" aria-hidden="true" /></span>
        <h1 className="mt-6 text-[2.5rem] font-extrabold leading-[1.02]">Check your email</h1>
        <p className="mt-3 text-muted-foreground">
          We sent a confirmation link to <strong className="text-ink">{confirmSentTo}</strong>. Open it to finish creating your account. It can take a minute to arrive — check your spam folder too.
        </p>
        <Button asChild variant="secondary" className="mt-8">
          <Link href="/login">Back to log in</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-[2.5rem] font-extrabold leading-[1.02]">Create your account</h1>
      <p className="mt-2 text-muted-foreground">It is free to create an account. You only pay when you are ready to open a case.</p>

      {errors.form && <Alert tone="danger" className="mt-6" title="We could not create your account">{errors.form}</Alert>}

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
        <Field label="Your full name" error={errors.name}>
          {(f) => <Input {...f} name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="Email address" hint="We will send updates about your case here." error={errors.email}>
          {(f) => <Input {...f} type="email" name="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label="Create a password" hint="At least 8 characters." error={errors.password}>
          {(f) => <PasswordInput {...f} name="new-password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <Button type="submit" className="w-full" loading={busy} loadingText="Creating your account…">Create account</Button>
        <p className="text-sm text-muted-foreground">
          By creating an account you agree to our{' '}
          <Link href="/terms" className="font-semibold text-primary underline underline-offset-2">Terms</Link> and{' '}
          <Link href="/privacy" className="font-semibold text-primary underline underline-offset-2">Privacy Policy</Link>.
        </p>
      </form>

      <OrDivider />
      <GoogleButton label="Sign up with Google" />

      <p className="mt-8 text-center text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-bold text-primary underline decoration-saffron decoration-2 underline-offset-4 hover:decoration-primary">Log in</Link>
      </p>
    </>
  );
}
