import { cn } from '@/lib/utils';
import { formatMoney, formatClovers, type Currency } from '@/lib/format';

/**
 * MoneyValue (§4) — ALWAYS renders currency + minor-unit-corrected amount.
 * Never render a raw integer. Right-aligned, tabular. Negatives in danger-500
 * with a leading −.
 */
export function MoneyValue({
  amount,
  currency = 'MXN',
  className,
  showCurrency = true,
  align = 'right',
  emphasis = 'normal',
}: {
  amount: number | null | undefined;
  currency?: Currency;
  className?: string;
  showCurrency?: boolean;
  align?: 'left' | 'right';
  emphasis?: 'normal' | 'strong' | 'muted';
}) {
  const negative = (amount ?? 0) < 0;
  return (
    <span
      className={cn(
        'tnum whitespace-nowrap tabular-nums',
        align === 'right' ? 'text-right' : 'text-left',
        negative
          ? 'text-danger-500'
          : emphasis === 'strong'
            ? 'font-semibold text-neutral-900'
            : emphasis === 'muted'
              ? 'text-neutral-500'
              : 'font-medium text-neutral-900',
        className,
      )}
    >
      {formatMoney(amount, currency, { showCurrency })}
    </span>
  );
}

/** CloverValue (§4) — 🍀 icon + tabular integer, secondary-500 accent. */
export function CloverValue({
  amount,
  className,
  signed = false,
  showIcon = true,
}: {
  amount: number;
  className?: string;
  signed?: boolean;
  showIcon?: boolean;
}) {
  const negative = amount < 0;
  return (
    <span
      className={cn(
        'tnum inline-flex items-center gap-1 whitespace-nowrap font-medium tabular-nums',
        negative && signed ? 'text-danger-500' : 'text-neutral-900',
        className,
      )}
    >
      {showIcon && (
        <span className="text-secondary-500" aria-hidden>
          🍀
        </span>
      )}
      {formatClovers(amount, signed)}
      <span className="sr-only">clovers</span>
    </span>
  );
}
