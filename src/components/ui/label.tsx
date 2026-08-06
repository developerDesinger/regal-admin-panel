import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/lib/utils';

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & { required?: boolean }
>(({ className, children, required, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      'block text-[13px] font-medium leading-[18px] text-neutral-700 peer-disabled:opacity-60',
      className,
    )}
    {...props}
  >
    {children}
    {required && (
      <span className="ml-1 text-danger-500" aria-hidden>
        *
      </span>
    )}
  </LabelPrimitive.Root>
));
Label.displayName = LabelPrimitive.Root.displayName;

/** Helper text under a field — 12/16 neutral-500 (§2.3 caption). */
export function FieldHelp({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'danger' }) {
  return (
    <p
      className={cn(
        'mt-1 text-caption',
        tone === 'danger' ? 'text-danger-500' : 'text-neutral-500',
      )}
      role={tone === 'danger' ? 'alert' : undefined}
    >
      {children}
    </p>
  );
}

export { Label };
