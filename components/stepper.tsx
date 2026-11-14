import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * "Step 2 of 5" in words, then the journey as a row of stitched segments:
 * done ones in ink, the current one in saffron, the rest waiting.
 */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div>
      <p className="font-bold">
        Step {current + 1} of {steps.length}
        <span className="font-normal text-ink/70"> · {steps[current]}</span>
      </p>
      <div
        className="mt-4 grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
        role="progressbar"
        aria-label="Progress"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={current + 1}
        aria-valuetext={`Step ${current + 1} of ${steps.length}: ${steps[current]}`}
      >
        {steps.map((label, i) => (
          <div key={label} className="min-w-0" aria-hidden="true">
            <span className={cn('block h-2 rounded-full transition-colors duration-300', i < current ? 'bg-ink' : i === current ? 'bg-saffron' : 'bg-ink/10')} />
            <span className={cn('mt-2.5 hidden items-center gap-1.5 truncate text-sm md:flex', i === current ? 'font-bold text-ink' : 'text-ink/60')}>
              {i < current && <Check className="size-3.5 shrink-0" strokeWidth={3} />}
              <span className="truncate">{label}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
