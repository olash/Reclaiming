import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const alertVariants = cva('flex gap-3 rounded-md border p-4 leading-relaxed sm:p-5', {
  variants: {
    tone: {
      info: 'border-info/20 bg-info-soft text-ink [&>svg]:text-info',
      success: 'border-success/25 bg-success-soft text-ink [&>svg]:text-success',
      warning: 'border-warning/25 bg-warning-soft text-ink [&>svg]:text-warning',
      danger: 'border-danger/25 bg-danger-soft text-ink [&>svg]:text-danger',
      neutral: 'border-ink/10 bg-muted text-ink [&>svg]:text-muted-foreground',
    },
  },
  defaultVariants: { tone: 'info' },
});

const ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle, neutral: Info };

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  title?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export function Alert({ className, tone = 'info', title, icon, children, role, ...props }: AlertProps) {
  const Icon = icon ?? ICONS[tone ?? 'info'];
  return (
    <div role={role ?? (tone === 'danger' ? 'alert' : 'status')} className={cn(alertVariants({ tone }), className)} {...props}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 space-y-1">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className="text-ink/85 [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-2">{children}</div>}
      </div>
    </div>
  );
}
