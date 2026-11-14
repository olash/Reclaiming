'use client';

import * as React from 'react';
import { AlertCircle, FileCheck2, Trash2, UploadCloud } from 'lucide-react';
import { UPLOAD_RULES } from '@/lib/fees';
import { cn } from '@/lib/utils';

interface FilePickerProps {
  label: string;
  hint?: string;
  optional?: boolean;
  file: File | null;
  onChange: (file: File | null) => void;
  error?: string | null;
}

const prettySize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

export function validateUpload(file: File): string | null {
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  if (!UPLOAD_RULES.extensions.includes(ext as any) || (file.type && !UPLOAD_RULES.mimeTypes.includes(file.type as any))) {
    return 'That file type is not supported. Please choose a PDF, JPG or PNG.';
  }
  if (file.size > UPLOAD_RULES.maxBytes) return `That file is ${prettySize(file.size)}. The limit is 10 MB — try a smaller scan or photo.`;
  if (file.size === 0) return 'That file is empty. Please choose another.';
  return null;
}

/**
 * A file field that works with a mouse, a finger, a keyboard and a screen
 * reader. It is a real <input type="file"> (so phones offer the camera and
 * the gallery); dragging a file onto it is an extra, not a requirement.
 */
export function FilePicker({ label, hint, optional, file, onChange, error }: FilePickerProps) {
  const id = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const shownError = localError ?? error ?? null;

  function accept(next: File | null | undefined) {
    if (!next) return;
    const problem = validateUpload(next);
    setLocalError(problem);
    if (!problem) onChange(next);
  }

  return (
    <div className="space-y-1.5">
      <p id={`${id}-label`} className="text-sm font-semibold">
        {label}
        {optional && <span className="ml-1.5 font-normal text-muted-foreground">(optional)</span>}
      </p>
      {hint && <p id={`${id}-hint`} className="text-sm text-muted-foreground">{hint}</p>}

      {file ? (
        <div className="flex items-center gap-3 rounded-md border border-success/40 bg-success-soft p-4">
          <FileCheck2 className="size-6 shrink-0 text-success" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{file.name}</p>
            <p className="text-sm text-muted-foreground">{prettySize(file.size)} · Ready to send</p>
          </div>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setLocalError(null);
              if (inputRef.current) inputRef.current.value = '';
            }}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 font-semibold text-ink hover:bg-surface"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Remove<span className="sr-only"> {label}</span>
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            accept(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed border-input bg-surface px-4 py-7 text-center transition-colors hover:border-primary hover:bg-primary-soft/40',
            'has-[:focus-visible]:border-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2',
            dragging && 'border-primary bg-primary-soft/60',
            shownError && 'border-danger',
          )}
        >
          <UploadCloud className="size-8 text-primary" aria-hidden="true" />
          <span className="font-bold text-primary underline decoration-saffron decoration-2 underline-offset-4 hover:decoration-primary">Choose a file or take a photo</span>
          <span className="text-sm text-muted-foreground">PDF, JPG or PNG, up to 10 MB. You can also drag a file here.</span>
        </label>
      )}
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={UPLOAD_RULES.accept}
        className="sr-only"
        aria-labelledby={`${id}-label`}
        aria-describedby={[hint ? `${id}-hint` : '', shownError ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined}
        aria-invalid={!!shownError}
        tabIndex={file ? -1 : 0}
        onChange={(e) => accept(e.target.files?.[0])}
      />
      {shownError && (
        <p id={`${id}-error`} role="alert" className="flex items-start gap-1.5 text-sm font-medium text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {shownError}
        </p>
      )}
    </div>
  );
}
