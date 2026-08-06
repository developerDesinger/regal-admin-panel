import { cn } from '@/lib/utils';
import type { StatusTone } from '@/lib/types';

/**
 * StatusBadge (§4) — pill, 6px radius, 12/500, 8px horizontal padding, 6px dot.
 * Status is NEVER communicated by colour alone: the dot always ships with a
 * text label, satisfying WCAG 1.4.1.
 */

/** Status → tone mapping. Must be used consistently across every screen (§2.2). */
const STATUS_TONES: Record<string, StatusTone> = {
  // success
  succeeded: 'success',
  confirmed: 'success',
  completed: 'success',
  delivered: 'success',
  goal_reached: 'success',
  verified: 'success',
  ready: 'success',
  resolved: 'success',
  // warning
  pending: 'warning',
  processing: 'warning',
  at_risk: 'warning',
  requested: 'warning',
  validated: 'warning',
  running: 'warning',
  queued: 'warning',
  restricted: 'warning',
  snoozed: 'warning',
  acknowledged: 'warning',
  // danger
  failed: 'danger',
  error: 'danger',
  anomaly: 'danger',
  // info
  active: 'info',
  published: 'info',
  in_progress: 'info',
  open: 'info',
  // neutral
  cancelled: 'neutral',
  paused: 'neutral',
  draft: 'neutral',
  inactive: 'neutral',
  archived: 'neutral',
  none: 'neutral',
  not_started: 'neutral',
  expired: 'neutral',
  dismissed: 'neutral',
  unverified: 'neutral',
  deleted: 'neutral',
};

function statusTone(status: string): StatusTone {
  return STATUS_TONES[status.toLowerCase()] ?? 'neutral';
}

const TONE_CLASSES: Record<StatusTone, { wrap: string; dot: string }> = {
  success: { wrap: 'bg-success-50 text-success-500 ring-success-500/20', dot: 'bg-success-500' },
  warning: { wrap: 'bg-warning-50 text-warning-500 ring-warning-500/20', dot: 'bg-warning-500' },
  danger: { wrap: 'bg-danger-50 text-danger-500 ring-danger-500/20', dot: 'bg-danger-500' },
  info: { wrap: 'bg-info-50 text-info-500 ring-info-500/20', dot: 'bg-info-500' },
  neutral: { wrap: 'bg-neutral-100 text-neutral-500 ring-neutral-300/40', dot: 'bg-neutral-400' },
};

/** Human label for a snake_case status. */
function statusLabel(status: string): string {
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function StatusBadge({
  status,
  label,
  tone,
  className,
  dot = true,
}: {
  status: string;
  label?: string;
  tone?: StatusTone;
  className?: string;
  dot?: boolean;
}) {
  const resolved = tone ?? statusTone(status);
  const c = TONE_CLASSES[resolved];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 whitespace-nowrap rounded-sm px-2 py-[3px] text-[12px] font-medium leading-4 ring-1 ring-inset',
        c.wrap,
        className,
      )}
    >
      {dot && <span className={cn('h-[6px] w-[6px] shrink-0 rounded-full', c.dot)} aria-hidden />}
      {label ?? statusLabel(status)}
    </span>
  );
}

/** Neutral, non-status chip — occasion, category, source, "self". */
export function Chip({
  children,
  className,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  className?: string;
  tone?: 'neutral' | 'brand' | 'accent' | 'secondary';
}) {
  const tones = {
    neutral: 'bg-neutral-100 text-neutral-500',
    brand: 'bg-brand-50 text-brand-900',
    accent: 'bg-accent-500/10 text-accent-500',
    secondary: 'bg-secondary-500/15 text-neutral-700',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-sm px-2 py-[2px] text-[12px] font-medium leading-4',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
