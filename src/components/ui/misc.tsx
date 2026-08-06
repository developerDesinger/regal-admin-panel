import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import * as SeparatorPrimitive from '@radix-ui/react-separator';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { initials } from '@/lib/format';

/* --------------------------------------------------------------- popover -- */

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'start', sideOffset = 6, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-50 rounded-md border border-neutral-200 bg-neutral-0 p-4 shadow-e1 outline-none data-[state=open]:animate-fade-in',
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

/* ----------------------------------------------------------- radio group -- */

const RadioGroup = RadioGroupPrimitive.Root;

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      'h-4 w-4 shrink-0 rounded-full border border-neutral-300 bg-neutral-0 transition-colors duration-micro',
      'hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=checked]:border-brand-500 data-[state=checked]:border-[5px]',
      className,
    )}
    {...props}
  />
));
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

/* ------------------------------------------------------------- separator -- */

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = 'horizontal', decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      'shrink-0 bg-neutral-200',
      orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
      className,
    )}
    {...props}
  />
));
Separator.displayName = SeparatorPrimitive.Root.displayName;

/* ---------------------------------------------------------------- avatar -- */

export function Avatar({
  name,
  color = 'bg-brand-500',
  size = 'md',
  className,
}: {
  name: string;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizes = {
    xs: 'h-5 w-5 text-[9px]',
    sm: 'h-6 w-6 text-[10px]',
    md: 'h-8 w-8 text-[11px]',
    lg: 'h-12 w-12 text-[16px]',
  };
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold uppercase text-white',
        sizes[size],
        color,
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/* -------------------------------------------------------------- skeleton -- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-neutral-100', className)} aria-hidden />;
}

/* -------------------------------------------------------- progress track -- */

/** 6px bar. Turns amber when a live event is under-funded near its deadline (§03). */
export function ProgressBar({
  value,
  tone = 'brand',
  className,
  label,
}: {
  value: number;
  tone?: 'brand' | 'success' | 'warning' | 'danger';
  className?: string;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const fill = {
    brand: 'bg-brand-500',
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    danger: 'bg-danger-500',
  }[tone];
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? 'Progress'}
      className={cn('h-[6px] w-full overflow-hidden rounded-full bg-neutral-200', className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-panel ease-standard', fill)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/* ---------------------------------------------------------- copyable id -- */

/** Mono id with a copy button — used for event/user/Stripe ids everywhere. */
export function CopyableId({
  value,
  display,
  className,
  label = 'ID',
}: {
  value: string;
  display?: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  const copy = React.useCallback(() => {
    void navigator.clipboard?.writeText(value);
    setCopied(true);
  }, [value]);

  React.useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <code className="font-mono text-[13px] leading-5 text-neutral-700">{display ?? value}</code>
      <button
        type="button"
        onClick={copy}
        className="rounded-sm p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
        aria-label={copied ? `${label} copied` : `Copy ${label}`}
      >
        {copied ? <Check className="h-3 w-3 text-success-500" /> : <Copy className="h-3 w-3" />}
      </button>
      <span className="sr-only" role="status">
        {copied ? `${label} copied to clipboard` : ''}
      </span>
    </span>
  );
}

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  RadioGroup,
  RadioGroupItem,
  Separator,
};
