import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'block h-14 w-full rounded-md border-[1.5px] border-input bg-surface px-4 text-[1.0625rem] text-ink placeholder:text-muted-foreground/80 transition-colors hover:border-ink/60',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 focus-visible:ring-offset-0',
        'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'block min-h-28 w-full rounded-md border-[1.5px] border-input bg-surface px-4 py-3 text-[1.0625rem] text-ink placeholder:text-muted-foreground/80 hover:border-ink/60',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 focus-visible:ring-offset-0 aria-[invalid=true]:border-danger',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
