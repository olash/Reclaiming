import { MessageCircle } from 'lucide-react';
import { SUPPORT_WHATSAPP } from '@/lib/fees';
import { cn } from '@/lib/utils';

/**
 * Always-available route to a human. Fixed to the corner on every page,
 * labelled in words (not just an icon), and still — a looping bounce is
 * distracting and fails WCAG 2.2.2 for people sensitive to motion.
 */
export function HelpButton({ className }: { className?: string }) {
  return (
    <a
      href={SUPPORT_WHATSAPP}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'no-print fixed bottom-4 right-4 z-40 inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-4 font-semibold text-primary-foreground shadow-pop transition-colors hover:bg-primary-hover sm:bottom-6 sm:right-6',
        className,
      )}
    >
      <MessageCircle className="size-5" aria-hidden="true" />
      <span>Chat with us</span>
      <span className="sr-only"> on WhatsApp (opens in a new tab)</span>
    </a>
  );
}
