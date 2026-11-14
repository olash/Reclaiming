import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/** "Step 2 of 5" in words, a progress bar, and (on wider screens) the named steps. */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  const pct = Math.round(((current + 1) / steps.length) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold">
          Step {current + 1} of {steps.length}
          <span className="font-normal text-muted-foreground"> · {steps[current]}</span>
        </p>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Progress"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={current + 1}
        aria-valuetext={`Step ${current + 1} of ${steps.length}: ${steps[current]}`}
      >
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
      <ol className="mt-4 hidden gap-2 md:grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-hidden="true">
        {steps.map((label, i) => (
          <li key={label} className={cn('flex items-center gap-2 text-sm', i === current ? 'font-semibold text-ink' : 'text-muted-foreground')}>
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                i < current ? 'bg-primary text-white' : i === current ? 'border-2 border-primary text-primary' : 'border border-input',
              )}
            >
              {i < current ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span className="truncate">{label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
