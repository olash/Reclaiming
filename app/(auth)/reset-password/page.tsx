'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PasswordInput, friendlyAuthError } from '@/components/auth-bits';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase-browser';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { loading, user } = useAuth();
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (password.length < 8) return setError('Choose a password with at least 8 characters.');
    setError(null);
    setBusy(true);
    const { error: err } = await supabase().auth.updateUser({ password });
    if (err) {
      setBusy(false);
      return setFormError(friendlyAuthError(err));
    }
    toast.success('Your password has been changed.');
    router.replace('/app');
  }

  if (loading) return <Skeleton className="h-64 w-full" />;

  if (!user) {
    return (
      <>
        <h1 className="text-3xl font-semibold">This link has expired</h1>
        <p className="mt-3 text-muted-foreground">Password links only work once and for a short time. Ask for a new one and we will email it straight away.</p>
        <Button asChild className="mt-8"><Link href="/forgot-password">Send me a new link</Link></Button>
      </>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-semibold">Choose a new password</h1>
      <p className="mt-2 text-muted-foreground">For {user.email}</p>
      {formError && <Alert tone="danger" className="mt-6">{formError}</Alert>}
      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
        <Field label="New password" hint="At least 8 characters." error={error}>
          {(f) => <PasswordInput {...f} name="new-password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <Button type="submit" className="w-full" loading={busy} loadingText="Saving…">Save new password</Button>
      </form>
    </>
  );
}
