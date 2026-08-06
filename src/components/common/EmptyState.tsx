import type { LucideIcon } from 'lucide-react';
import { AlertCircle, Inbox, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

/**
 * EmptyState (§4) — icon + headline + one-sentence explanation + primary action
 * where one exists. Never a bare "No data".
 */
export function EmptyState({
  icon: Icon = Inbox,
  headline,
  description,
  action,
  className,
  compact,
}: {
  icon?: LucideIcon;
  headline: string;
  description: string;
  action?: { label: string; onClick?: () => void; href?: string };
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 text-center',
        compact ? 'py-8' : 'py-16',
        className,
      )}
    >
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
        <Icon className="h-6 w-6 text-neutral-400" aria-hidden />
      </span>
      <h3 className="text-[14px] font-semibold leading-5 text-neutral-900">{headline}</h3>
      <p className="mt-1 max-w-[380px] text-caption text-neutral-500">{description}</p>
      {action && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-4"
          onClick={action.onClick}
          {...(action.href ? { asChild: true } : {})}
        >
          {action.href ? <a href={action.href}>{action.label}</a> : action.label}
        </Button>
      )}
    </div>
  );
}

/** Error state — message + Retry. Required on every data surface (§21). */
export function ErrorState({
  message = 'Something went wrong loading this data.',
  onRetry,
  compact,
}: {
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center px-6 text-center', compact ? 'py-8' : 'py-16')}
      role="alert"
    >
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger-50">
        <AlertCircle className="h-6 w-6 text-danger-500" aria-hidden />
      </span>
      <h3 className="text-[14px] font-semibold leading-5 text-neutral-900">Couldn’t load data</h3>
      <p className="mt-1 max-w-[380px] text-caption text-neutral-500">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw className="h-3 w-3" />
          Retry
        </Button>
      )}
    </div>
  );
}

/** Loading skeleton — never a spinner over stale numbers (§21). */
export function TableSkeleton({ rows = 6, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading records…</span>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-neutral-200 px-4 py-4">
          {Array.from({ length: columns }).map((__, c) => (
            <Skeleton key={c} className={cn('h-4', c === 0 ? 'w-[22%]' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  );
}
