import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'h-9 w-full rounded-sm border bg-neutral-0 px-3 text-[14px] leading-5 text-neutral-900 transition-colors duration-micro',
        'placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400',
        invalid ? 'border-danger-500' : 'border-neutral-300 hover:border-neutral-400',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(({ className, invalid, ...props }, ref) => (
  <textarea
    ref={ref}
    aria-invalid={invalid || undefined}
    className={cn(
      'w-full rounded-sm border bg-neutral-0 px-3 py-2 text-[14px] leading-5 text-neutral-900 transition-colors duration-micro',
      'placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-100',
      invalid ? 'border-danger-500' : 'border-neutral-300 hover:border-neutral-400',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export { Input, Textarea };
