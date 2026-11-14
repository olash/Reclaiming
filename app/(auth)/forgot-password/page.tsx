'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { friendlyAuthError } from '@/components/auth-bits';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase-browser';

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter your email address, like name@example.com.');
    setError(null);
    setBusy(true);
    const { error: err } = await supabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    if (err) return setFormError(friendlyAuthError(err));
    setSent(true);
  }

  if (sent) {
    return (
      <div className="text-center" role="status">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary"><MailCheck className="size-7" aria-hidden="true" /></span>
        <h1 className="mt-6 text-3xl font-semibold">Check your email</h1>
        <p className="mt-3 text-muted-foreground">
          If there is an account for <strong className="text-ink">{email.trim()}</strong>, we have sent a link to choose a new password. It can take a minute to arrive.
        </p>
        <Button asChild variant="secondary" className="mt-8"><Link href="/login">Back to log in</Link></Button>
      </div>
    );
  }

  return (
    <>
      <Link href="/login" className="inline-flex items-center gap-1.5 py-2 font-semibold text-primary"><ArrowLeft className="size-4" aria-hidden="true" />Back to log in</Link>
      <h1 className="mt-4 text-3xl font-semibold">Forgot your password?</h1>
      <p className="mt-2 text-muted-foreground">Enter the email you signed up with and we will send you a link to choose a new one.</p>
      {formError && <Alert tone="danger" className="mt-6">{formError}</Alert>}
      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
        <Field label="Email address" error={error}>
          {(f) => <Input {...f} type="email" name="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Button type="submit" className="w-full" loading={busy} loadingText="Sending…">Send reset link</Button>
      </form>
    </>
  );
}
