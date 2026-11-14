'use client';

import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Accordion = AccordionPrimitive.Root;

export const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => <AccordionPrimitive.Item ref={ref} className={cn('border-b border-dashed border-ink/20', className)} {...props} />);
AccordionItem.displayName = 'AccordionItem';

export const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header asChild>
    <h3>
      <AccordionPrimitive.Trigger
        ref={ref}
        className={cn('group flex min-h-16 w-full items-center justify-between gap-4 py-5 text-left font-display text-xl font-bold tracking-tight hover:text-primary [&[data-state=open]>span]:rotate-45 [&[data-state=open]>span]:bg-saffron', className)}
        {...props}
      >
        {children}
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink/70 transition-transform duration-200" aria-hidden="true"><Plus className="size-4" strokeWidth={2.5} /></span>
      </AccordionPrimitive.Trigger>
    </h3>
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = 'AccordionTrigger';

export const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content ref={ref} className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down" {...props}>
    <div className={cn('max-w-2xl pb-6 text-[1.0625rem] text-ink/75', className)}>{children}</div>
  </AccordionPrimitive.Content>
));
AccordionContent.displayName = 'AccordionContent';
