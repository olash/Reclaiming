import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-base font-bold transition-[background-color,color,transform,box-shadow] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-60 aria-disabled:pointer-events-none aria-disabled:opacity-60 [&_svg]:size-5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary-hover [&_svg]:transition-transform hover:[&_svg:last-child]:translate-x-0.5',
        /** The loudest button: saffron with a printed edge. One per screen, for the moment that matters most. */
        accent: 'bg-saffron text-ink shadow-stamp hover:-translate-y-px hover:shadow-[0_4px_0_0_hsl(var(--ink))] active:translate-y-[2px] active:shadow-stamp-sm',
        secondary: 'bg-surface text-ink border-[1.5px] border-ink/75 hover:bg-ink hover:text-cotton',
        soft: 'bg-primary-soft text-primary hover:bg-primary-soft/70',
        ghost: 'text-ink hover:bg-ink/[0.06]',
        link: 'text-primary underline decoration-2 decoration-saffron underline-offset-4 hover:decoration-primary',
        danger: 'bg-danger text-white hover:bg-danger/90',
      },
      size: {
        md: 'min-h-12 px-6',
        sm: 'min-h-11 px-4 text-[0.95rem]',
        lg: 'min-h-14 px-8 text-lg',
        icon: 'size-11',
        inline: 'min-h-0 p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  loadingText?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, loadingText, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    if (asChild) {
      return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props}>{children}</Comp>;
    }
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
        {loading && loadingText ? loadingText : children}
      </Comp>
    );
  },
);
Button.displayName = 'Button';
export { buttonVariants };
