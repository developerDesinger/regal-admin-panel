import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,

  CartesianGrid,
  Line,
  ComposedChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, ArrowRight, Clock, Download, Wallet } from 'lucide-react';
import { PageHeader, SectionHeading } from '@/components/common/PageHeader';
import { KpiCard, KpiGrid } from '@/components/common/KpiCard';
import { DateRangePicker } from '@/components/common/DateRangePicker';
import { ChartCard, ChartTooltip } from '@/components/common/ChartCard';
import { CHART_COLORS, COMPARISON_COLOR } from '@/lib/chart-tokens';
import { DrillDownDrawer } from '@/components/common/DrillDownDrawer';
import { StatusBadge } from '@/components/common/StatusBadge';
import { MoneyValue } from '@/components/common/MoneyValue';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { ProgressBar } from '@/components/ui/misc';
import { Card } from '@/components/ui/card';
import {
  DATA_AS_OF,
  alerts,
  contributions,
  events,
  eventsAtRisk,
  funnelStages,
  largestActiveEvents,
  lifecycleTiming,
  recentlyCompleted,
  stats,
  timeSeries,
} from '@/lib/mock/data';
import {
  formatDate,
  formatMoney,
  formatMoneyCompact,
  formatNumber,
  formatPercent,
  formatRelative,
} from '@/lib/format';
import type { DrillTo, RegalEvent } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Screen 02 — Global Dashboard (§02). The daily operational health check.
 * A: alert strip · B: 8 KPI cards (all clickable) · C: 2×2 charts ·
 * D: lifecycle timing table · E: attention lists.
 */
export default function Dashboard() {
  const navigate = useNavigate();
  const [drill, setDrill] = React.useState<DrillTo | null>(null);

  const openAlerts = alerts.filter((a) => a.status === 'open');
  const alertChips = [
    {
      type: 'stagnant_event',
      label: 'stagnant events',
      count: openAlerts.filter((a) => a.type === 'stagnant_event').length,
      severity: 'warning' as const,
    },
    {
      type: 'payment_friction',
      label: 'payment friction',
      count: openAlerts.filter((a) => a.type === 'payment_friction').length,
      severity: 'danger' as const,
    },
    {
      type: 'withdrawal_pending',
      label: 'withdrawals pending',
      count: openAlerts.filter((a) => a.type === 'withdrawal_pending').length,
      severity: 'warning' as const,
    },
    {
      type: 'clover_anomaly',
      label: 'clover anomalies',
      count: openAlerts.filter((a) => a.type === 'clover_anomaly').length,
      severity: 'danger' as const,
    },
  ].filter((c) => c.count > 0);

  const sparks = {
    created: timeSeries.slice(-14).map((d) => d.created),
    completed: timeSeries.slice(-14).map((d) => d.completed),
    volume: timeSeries.slice(-14).map((d) => d.volume),
    count: timeSeries.slice(-14).map((d) => d.count),
  };

  const statusDistribution = React.useMemo(() => {
    const buckets: Record<string, number> = {};
    events.forEach((e) => {
      const key = ['completed', 'delivered', 'goal_reached'].includes(e.status)
        ? 'Completed'
        : e.status === 'active' || e.status === 'published'
          ? 'Active'
          : e.status === 'cancelled'
            ? 'Cancelled'
            : 'Paused / Draft';
      buckets[key] = (buckets[key] ?? 0) + 1;
    });
    const total = events.length;
    const order = ['Active', 'Completed', 'Cancelled', 'Paused / Draft'];
    return order.map((label, i) => ({
      label,
      count: buckets[label] ?? 0,
      pct: ((buckets[label] ?? 0) / total) * 100,
      color: CHART_COLORS[i === 0 ? 0 : i === 1 ? 2 : i === 2 ? 6 : 3],
    }));
  }, []);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Platform health across events, money, participation and rewards."
        dataAsOf={DATA_AS_OF}
        actions={
          <>
            <DateRangePicker />
            <Button variant="secondary" onClick={() => navigate('/exports')}>
              <Download className="h-4 w-4 text-neutral-400" />
              Export
            </Button>
          </>
        }
      />

      {/* Section A — Alert strip, only when alerts exist */}
      {alertChips.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2" role="region" aria-label="Active alerts">
          {alertChips.map((chip) => (
            <Link
              key={chip.type}
              to={`/alerts?type=${chip.type}`}
              className={cn(
                'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-[13px] font-medium transition-colors',
                chip.severity === 'danger'
                  ? 'border-danger-500/20 bg-danger-50 text-danger-500 hover:border-danger-500/40'
                  : 'border-warning-500/20 bg-warning-50 text-warning-500 hover:border-warning-500/40',
              )}
            >
              <AlertTriangle className="h-4 w-4" aria-hidden />
              <span className="tnum">{chip.count}</span>
              {chip.label}
              <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          ))}
        </div>
      )}

      {/* Section B — Primary KPI row. Every card drills down (§21). */}
      <KpiGrid className="mb-6">
        <KpiCard
          label="Active Events"
          value={formatNumber(stats.activeEvents * 27)}
          delta={12.4}
          definition="Events with status = active at the end of the selected range."
          sparkline={sparks.created}
          onDrillDown={() =>
            setDrill({ resource: 'events', label: 'Active events', filters: { status: 'active' } })
          }
        />
        <KpiCard
          label="Events Created"
          value={formatNumber(stats.eventsCreated * 31)}
          delta={8.1}
          definition="Events whose creation timestamp falls inside the selected range, any status."
          sparkline={sparks.created}
          onDrillDown={() =>
            setDrill({ resource: 'events', label: 'Events created in range', filters: {} })
          }
        />
        <KpiCard
          label="Event Success Rate"
          value={formatPercent(stats.successRate)}
          delta={2.3}
          deltaUnit="pp"
          definition="Events reaching goal_reached, completed or delivered ÷ all events closed in the range × 100."
          sparkline={sparks.completed}
          onDrillDown={() =>
            setDrill({ resource: 'events', label: 'Completed vs not completed', filters: { status: 'completed' } })
          }
        />
        <KpiCard
          label="Average Event Duration"
          value={`${stats.avgDurationDays.toFixed(1)} days`}
          delta={-3.1}
          invertDelta
          definition="Mean of (closure date − creation date) across events closed in the range. Median is shown in §Lifecycle timing."
          onDrillDown={() =>
            setDrill({ resource: 'events', label: 'Events with duration', filters: {} })
          }
        />
        <KpiCard
          label="Total Confirmed Contributions"
          value={formatMoney(stats.totalConfirmed * 12)}
          delta={18.9}
          definition="Sum of contribution.amount where status = succeeded, in minor units ÷ 100. Excludes fees."
          sparkline={sparks.volume}
          onDrillDown={() =>
            setDrill({
              resource: 'contributions',
              label: 'Confirmed contributions',
              filters: { status: 'succeeded' },
            })
          }
        />
        <KpiCard
          label="Participation Rate"
          value={formatPercent(stats.participationRate)}
          delta={-1.4}
          deltaUnit="pp"
          definition="Distinct users with ≥1 confirmed contribution ÷ distinct users invited × 100."
          sparkline={sparks.count}
          onDrillDown={() =>
            setDrill({ resource: 'users', label: 'Invited vs contributed', filters: {} })
          }
        />
        <KpiCard
          label="Card Downloads"
          value={`${formatNumber(stats.uniqueDownloads)} / ${formatNumber(stats.totalDownloads)}`}
          secondary="unique / total"
          delta={6.7}
          accent="accent"
          definition="Unique downloaders and total download events from the card event log, in the selected range."
          onDrillDown={() => setDrill({ resource: 'cards', label: 'Download log', filters: {} })}
        />
        <KpiCard
          label="Clover Redemption Rate"
          value={formatPercent(stats.cloverRedemptionRate)}
          delta={4.2}
          deltaUnit="pp"
          accent="secondary"
          definition="Users who redeemed ≥1 premium card ÷ users holding enough clovers to redeem one × 100."
          onDrillDown={() =>
            setDrill({ resource: 'clovers', label: 'Eligible vs redeemed users', filters: {} })
          }
        />
      </KpiGrid>

      {/* Section C — Charts 2×2 */}
      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Events Created & Completed Over Time"
          subtitle="Daily · previous period overlaid"
          legend={[
            { label: 'Created', color: CHART_COLORS[0] },
            { label: 'Completed', color: CHART_COLORS[2] },
            { label: 'Previous period', color: COMPARISON_COLOR, dashed: true },
          ]}
          tableData={{
            columns: ['Date', 'Created', 'Completed'],
            rows: timeSeries.map((d) => [d.date, d.created, d.completed]),
          }}
          onViewRecords={() => navigate('/events')}
        >
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={timeSeries} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={(v) => String(v).slice(5)} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} width={40} />
              <RTooltip content={<ChartTooltip />} cursor={{ fill: 'rgb(var(--neutral-100))' }} />
              <Bar dataKey="created" name="Created" fill={CHART_COLORS[0]} radius={[2, 2, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="completed" name="Completed" fill={CHART_COLORS[2]} radius={[2, 2, 0, 0]} isAnimationActive={false} />
              <Line
                type="monotone"
                dataKey="prevVolume"
                name="Previous period"
                stroke={COMPARISON_COLOR}
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                yAxisId={0}
                hide
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Confirmed Contribution Volume"
          subtitle="Markers show reminder-send days — post-reminder spikes are visible"
          legend={[
            { label: 'Confirmed volume', color: CHART_COLORS[0] },
            { label: 'Previous period', color: COMPARISON_COLOR, dashed: true },
            { label: 'Reminder sent', color: CHART_COLORS[3] },
          ]}
          tableData={{
            columns: ['Date', 'Volume', 'Reminder sent'],
            rows: timeSeries.map((d) => [d.date, formatMoney(d.volume), d.reminder ? 'Yes' : 'No']),
          }}
          onViewRecords={() => navigate('/contributions?status=succeeded')}
        >
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={timeSeries} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="volFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.24} />
                  <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={(v) => String(v).slice(5)} minTickGap={24} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={(v) => formatMoneyCompact(Number(v))}
              />
              <RTooltip
                content={<ChartTooltip formatter={(v) => formatMoney(v)} />}
                cursor={{ stroke: 'rgb(var(--neutral-300))' }}
              />
              <Area
                type="monotone"
                dataKey="prevVolume"
                name="Previous period"
                stroke={COMPARISON_COLOR}
                strokeDasharray="4 4"
                strokeWidth={2}
                fill="none"
                dot={false}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="volume"
                name="Confirmed volume"
                stroke={CHART_COLORS[0]}
                strokeWidth={2}
                fill="url(#volFill)"
                isAnimationActive={false}
              />
              {timeSeries
                .filter((d) => d.reminder)
                .map((d) => (
                  <ReferenceDot
                    key={d.date}
                    x={d.date}
                    y={d.volume}
                    r={4}
                    fill={CHART_COLORS[3]}
                    stroke="rgb(var(--neutral-0))"
                    strokeWidth={2}
                  />
                ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Funnel: Invited → Opened → Contributed"
          subtitle="Conversion between each stage"
          tableData={{
            columns: ['Stage', 'Users', 'Conversion'],
            rows: funnelStages.map((s, i) => [
              s.stage,
              s.value,
              i === 0 ? '—' : `${((s.value / funnelStages[i - 1].value) * 100).toFixed(1)}%`,
            ]),
          }}
          onViewRecords={() => navigate('/users')}
        >
          <div className="flex h-full flex-col justify-center gap-4 py-4">
            {funnelStages.map((stage, i) => {
              const pctOfTop = (stage.value / funnelStages[0].value) * 100;
              const conversion = i === 0 ? null : (stage.value / funnelStages[i - 1].value) * 100;
              return (
                <div key={stage.stage}>
                  {conversion !== null && (
                    <p className="tnum mb-1 pl-1 text-caption text-neutral-400">
                      ↓ {conversion.toFixed(1)}% converted from {funnelStages[i - 1].stage.toLowerCase()}
                    </p>
                  )}
                  <div className="flex items-center gap-3">
                    <span className="w-[92px] shrink-0 text-body text-neutral-700">{stage.stage}</span>
                    <div className="relative h-8 flex-1 overflow-hidden rounded-sm bg-neutral-100">
                      <div
                        className="h-full rounded-sm"
                        style={{ width: `${pctOfTop}%`, backgroundColor: CHART_COLORS[i] }}
                      />
                    </div>
                    <span className="tnum w-[64px] shrink-0 text-right text-body font-medium text-neutral-900">
                      {formatNumber(stage.value)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>

        <ChartCard
          title="Event Status Distribution"
          subtitle="Counts and share of all events in range"
          tableData={{
            columns: ['Status', 'Events', 'Share'],
            rows: statusDistribution.map((s) => [s.label, s.count, `${s.pct.toFixed(1)}%`]),
          }}
          onViewRecords={() => navigate('/events')}
        >
          <div className="flex h-full flex-col justify-center gap-6 py-4">
            {/* Horizontal stacked bar, not a pie (§02 C4) */}
            <div className="flex h-10 w-full overflow-hidden rounded-sm">
              {statusDistribution.map((s) => (
                <Tooltip key={s.label} content={`${s.label}: ${s.count} (${s.pct.toFixed(1)}%)`}>
                  <div
                    className="h-full transition-opacity hover:opacity-80"
                    style={{ width: `${s.pct}%`, backgroundColor: s.color }}
                  />
                </Tooltip>
              ))}
            </div>
            <ul className="grid grid-cols-2 gap-3">
              {statusDistribution.map((s) => (
                <li key={s.label} className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-sm"
                    style={{ backgroundColor: s.color }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-body text-neutral-700">{s.label}</span>
                  <span className="tnum text-body font-medium text-neutral-900">{s.count}</span>
                  <span className="tnum w-[52px] text-right text-caption text-neutral-500">
                    {s.pct.toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </ChartCard>
      </div>

      {/* Section D — Event lifecycle timing */}
      <Card className="mb-6">
        <div className="flex items-start justify-between gap-4 p-4">
          <div>
            <h2 className="text-card-title text-neutral-700">Event Lifecycle Timing</h2>
            <p className="mt-1 text-caption text-neutral-500">
              Median is the headline — one 90-day outlier must not distort the number. Mean is in the
              tooltip.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-neutral-50">
              <tr className="border-y border-neutral-200">
                <th scope="col" className="px-4 py-3 text-left text-table-header uppercase text-neutral-500">
                  Metric
                </th>
                <th scope="col" className="px-4 py-3 text-right text-table-header uppercase text-neutral-500">
                  Median
                </th>
                <th scope="col" className="px-4 py-3 text-right text-table-header uppercase text-neutral-500">
                  p90
                </th>
                <th scope="col" className="px-4 py-3 text-right text-table-header uppercase text-neutral-500">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody>
              {lifecycleTiming.map((row, i) => (
                <tr
                  key={row.metric}
                  className={cn('border-b border-neutral-200 last:border-0', i % 2 === 1 && 'bg-neutral-50')}
                >
                  <td className="px-4 py-3">
                    <Tooltip content={`${row.definition} · mean ${row.mean} ${row.unit}`}>
                      <span className="cursor-help text-body font-medium text-neutral-900 underline decoration-neutral-300 decoration-dotted underline-offset-4">
                        {row.metric}
                      </span>
                    </Tooltip>
                    <p className="mt-0.5 text-caption text-neutral-500">{row.definition}</p>
                  </td>
                  <td className="tnum px-4 py-3 text-right text-body font-semibold text-neutral-900">
                    {row.median} {row.unit}
                  </td>
                  <td className="tnum px-4 py-3 text-right text-body text-neutral-500">
                    {row.p90} {row.unit}
                  </td>
                  <td className="px-4 py-3">
                    <div className="ml-auto h-6 w-[100px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={row.trend.map((v, idx) => ({ idx, v }))}>
                          <Area
                            type="monotone"
                            dataKey="v"
                            stroke={CHART_COLORS[0]}
                            strokeWidth={1.5}
                            fill={CHART_COLORS[0]}
                            fillOpacity={0.12}
                            isAnimationActive={false}
                            dot={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Section E — Attention lists */}
      <SectionHeading description="Three compact lists that decide where the day's attention goes.">
        Needs attention
      </SectionHeading>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AttentionList
          title="Events at risk"
          icon={AlertTriangle}
          tone="warning"
          viewAllHref="/alerts?type=at_risk_event"
          events={eventsAtRisk}
          render={(e) => (
            <>
              <ProgressBar
                value={(e.raisedAmount / e.goalAmount) * 100}
                tone="warning"
                className="mt-2"
                label={`${e.name} progress`}
              />
              <p className="tnum mt-1 text-caption text-neutral-500">
                {formatPercent((e.raisedAmount / e.goalAmount) * 100, 0)} of goal ·{' '}
                {formatRelative(e.endDate)}
              </p>
            </>
          )}
        />
        <AttentionList
          title="Largest active events"
          icon={Wallet}
          tone="brand"
          viewAllHref="/events?status=active"
          events={largestActiveEvents}
          render={(e) => (
            <p className="mt-1 text-caption text-neutral-500">
              Goal <MoneyValue amount={e.goalAmount} className="text-caption" /> · raised{' '}
              <MoneyValue amount={e.raisedAmount} className="text-caption" />
            </p>
          )}
        />
        <AttentionList
          title="Recently completed"
          icon={Clock}
          tone="success"
          viewAllHref="/events?status=completed"
          events={recentlyCompleted}
          render={(e) => (
            <p className="mt-1 text-caption text-neutral-500">
              Closed {e.closedAt ? formatDate(e.closedAt) : '—'} ·{' '}
              <MoneyValue amount={e.raisedAmount} className="text-caption" />
            </p>
          )}
        />
      </div>

      <KpiDrillDown drill={drill} onClose={() => setDrill(null)} />
    </>
  );
}

function AttentionList({
  title,
  icon: Icon,
  tone,
  viewAllHref,
  events: list,
  render,
}: {
  title: string;
  icon: typeof AlertTriangle;
  tone: 'warning' | 'brand' | 'success';
  viewAllHref: string;
  events: RegalEvent[];
  render: (e: RegalEvent) => React.ReactNode;
}) {
  const toneClass = {
    warning: 'bg-warning-50 text-warning-500',
    brand: 'bg-brand-50 text-brand-500',
    success: 'bg-success-50 text-success-500',
  }[tone];

  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-neutral-200 p-4">
        <div className="flex items-center gap-2">
          <span className={cn('flex h-6 w-6 items-center justify-center rounded-sm', toneClass)}>
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </span>
          <h3 className="text-card-title text-neutral-700">{title}</h3>
        </div>
        <Link
          to={viewAllHref}
          className="rounded-sm text-caption font-medium text-brand-500 transition-colors hover:text-brand-600"
        >
          View all
        </Link>
      </div>
      <ul className="divide-y divide-neutral-200">
        {list.slice(0, 5).map((e) => (
          <li key={e.id}>
            <Link
              to={`/events/${e.id}`}
              className="block px-4 py-3 transition-colors hover:bg-neutral-50"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-body font-medium text-neutral-900">
                  {e.name}
                </span>
                <StatusBadge status={e.status} />
              </div>
              {render(e)}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Every KPI opens its underlying records without losing page context (§21). */
export function KpiDrillDown({ drill, onClose }: { drill: DrillTo | null; onClose: () => void }) {
  if (!drill) return null;

  const rows =
    drill.resource === 'contributions'
      ? contributions
          .filter((c) => !drill.filters.status || c.status === drill.filters.status)
          .slice(0, 40)
          .map((c) => ({
            id: c.id,
            primary: c.contributor?.name ?? c.guestName ?? 'Guest',
            secondary: c.eventName,
            value: formatMoney(c.amount),
            status: c.status,
            href: `/contributions?q=${c.id}`,
          }))
      : events
          .filter((e) => !drill.filters.status || e.status === drill.filters.status)
          .slice(0, 40)
          .map((e) => ({
            id: e.id,
            primary: e.name,
            secondary: `${e.organizer.name} · ${formatDate(e.createdAt)}`,
            value: formatMoney(e.raisedAmount),
            status: e.status,
            href: `/events/${e.id}`,
          }));

  const fullPage =
    drill.resource === 'contributions'
      ? `/contributions${drill.filters.status ? `?status=${drill.filters.status}` : ''}`
      : drill.resource === 'events'
        ? `/events${drill.filters.status ? `?status=${drill.filters.status}` : ''}`
        : `/${drill.resource}`;

  return (
    <DrillDownDrawer
      open
      onOpenChange={(o) => !o && onClose()}
      title={drill.label}
      recordCount={rows.length}
      subtitle="Showing the first 40 records"
      fullPageHref={fullPage}
    >
      <ul className="divide-y divide-neutral-200">
        {rows.map((r) => (
          <li key={r.id}>
            <Link
              to={r.href}
              onClick={onClose}
              className="flex items-center gap-4 px-6 py-3 transition-colors hover:bg-neutral-50"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-medium text-neutral-900">{r.primary}</span>
                <span className="block truncate text-caption text-neutral-500">{r.secondary}</span>
              </span>
              <StatusBadge status={r.status} />
              <span className="tnum w-[120px] shrink-0 text-right text-body font-medium text-neutral-900">
                {r.value}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </DrillDownDrawer>
  );
}
