import * as React from 'react';
import { ArrowDown, ArrowUp, HelpCircle, Minus } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * KpiCard (§4) — label · value · delta pill vs previous period · optional
 * sparkline · ⓘ tooltip carrying the metric's exact definition · the ENTIRE
 * card is clickable and drills down. No number in this panel is a dead end (§21).
 */

export interface KpiCardProps {
  label: string;
  value: string;
  /** Signed delta vs previous period. Percent for counts, pp for rates. */
  delta?: number | null;
  deltaUnit?: '%' | 'pp';
  /** true when a falling number is the good outcome (failure rate, time to payout). */
  invertDelta?: boolean;
  /** The exact definition and formula from §22 — admins never guess what a number means. */
  definition?: string;
  sparkline?: number[];
  /** Drill-down handler — opens a DrillDownDrawer pre-filtered. */
  onDrillDown?: () => void;
  secondary?: string;
  accent?: 'brand' | 'secondary' | 'accent' | 'success' | 'danger';
  className?: string;
}

function DeltaPill({
  delta,
  unit = '%',
  invert = false,
}: {
  delta: number;
  unit?: '%' | 'pp';
  invert?: boolean;
}) {
  const flat = Math.abs(delta) < 0.05;
  const up = delta > 0;
  const good = invert ? !up : up;

  const tone = flat
    ? 'bg-neutral-100 text-neutral-500'
    : good
      ? 'bg-success-50 text-success-500'
      : 'bg-danger-50 text-danger-500';
  const Icon = flat ? Minus : up ? ArrowUp : ArrowDown;

  return (
    <span
      className={cn(
        'tnum inline-flex items-center gap-1 rounded-sm px-2 py-[2px] text-[12px] font-medium leading-4',
        tone,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {Math.abs(delta).toFixed(1)}
      {unit === 'pp' ? ' pp' : '%'}
    </span>
  );
}

function Sparkline({ data, accent }: { data: number[]; accent: string }) {
  const points = data.map((v, i) => ({ i, v }));
  const id = React.useId();
  return (
    <div className="h-10 w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity={0.22} />
              <stop offset="100%" stopColor={accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={accent}
            strokeWidth={1.5}
            fill={`url(#spark-${id})`}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const ACCENT_VAR: Record<NonNullable<KpiCardProps['accent']>, string> = {
  brand: 'rgb(var(--brand-500))',
  secondary: 'rgb(var(--secondary-500))',
  accent: 'rgb(var(--accent-500))',
  success: 'rgb(var(--success-500))',
  danger: 'rgb(var(--danger-500))',
};

export function KpiCard({
  label,
  value,
  delta,
  deltaUnit = '%',
  invertDelta,
  definition,
  sparkline,
  onDrillDown,
  secondary,
  accent = 'brand',
  className,
}: KpiCardProps) {
  const clickable = Boolean(onDrillDown);

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onDrillDown}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onDrillDown?.();
              }
            }
          : undefined
      }
      aria-label={clickable ? `${label}: ${value}. Open underlying records.` : undefined}
      className={cn(
        'flex flex-col rounded-lg border border-neutral-200 bg-neutral-0 p-4 text-left transition-colors duration-micro ease-standard',
        clickable && 'cursor-pointer hover:border-brand-300',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <span className="truncate text-kpi-label text-neutral-500">{label}</span>
          {definition && (
            <Tooltip content={definition}>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 rounded-full text-neutral-400 transition-colors hover:text-neutral-700"
                aria-label={`What does ${label} mean?`}
              >
                <HelpCircle className="h-[13px] w-[13px]" />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      <p className="tnum mt-2 text-kpi-value text-neutral-900">{value}</p>
      {secondary && <p className="tnum mt-1 text-caption text-neutral-500">{secondary}</p>}

      {delta !== undefined && delta !== null && (
        <div className="mt-3 flex items-center gap-2">
          <DeltaPill delta={delta} unit={deltaUnit} invert={invertDelta} />
          <span className="text-caption text-neutral-400">vs previous period</span>
        </div>
      )}

      {sparkline && sparkline.length > 1 && (
        <div className="mt-3">
          <Sparkline data={sparkline} accent={ACCENT_VAR[accent]} />
        </div>
      )}
    </div>
  );
}

/** 4-up ≥1280 · 2-up 768–1279 · 1-up <768 (§2.5). */
export function KpiGrid({
  children,
  className,
  columns = 4,
}: {
  children: React.ReactNode;
  className?: string;
  columns?: 3 | 4;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4 md:grid-cols-2',
        columns === 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-3',
        className,
      )}
    >
      {children}
    </div>
  );
}
