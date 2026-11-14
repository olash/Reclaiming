import { MessageCircle } from 'lucide-react';
import { SUPPORT_WHATSAPP } from '@/lib/fees';
import { cn } from '@/lib/utils';

/**
 * Always-available route to a human. Fixed to the corner on every page,
 * labelled in words (not just an icon), and still: a looping bounce is
 * distracting and fails WCAG 2.2.2 for people sensitive to motion.
 */
export function HelpButton({ className }: { className?: string }) {
  return (
    <aside aria-label="Help" className="no-print">
      <a
        href={SUPPORT_WHATSAPP}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'no-print fixed bottom-4 right-4 z-40 inline-flex min-h-12 items-center gap-2.5 rounded-full bg-ink py-2 pl-2 pr-5 font-bold text-cotton shadow-pop transition-transform hover:-translate-y-0.5 sm:bottom-6 sm:right-6',
          className,
        )}
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-saffron text-ink" aria-hidden="true">
          <MessageCircle className="size-[1.15rem]" strokeWidth={2.5} />
        </span>
        <span>Chat with us</span>
        <span className="sr-only"> on WhatsApp (opens in a new tab)</span>
      </a>
    </aside>
  );
}
