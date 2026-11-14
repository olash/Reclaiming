'use client';

import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FieldProps {
  label: string;
  /** Plain-language help shown under the label, before the control. */
  hint?: React.ReactNode;
  error?: string | null;
  optional?: boolean;
  className?: string;
  /** Receives the ids to wire the control to its label, hint and error. */
  children: (ids: { id: string; 'aria-describedby': string | undefined; 'aria-invalid': boolean }) => React.ReactNode;
}

/**
 * Label + hint + control + error, wired together for screen readers.
 * Errors are announced (role="alert") and never rely on colour alone.
 */
export function Field({ label, hint, error, optional, className, children }: FieldProps) {
  const id = React.useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
        {optional && <span className="ml-1.5 font-normal text-muted-foreground">(optional)</span>}
      </label>
      {hint && <p id={hintId} className="text-sm text-muted-foreground">{hint}</p>}
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': !!error })}
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-sm font-medium text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
