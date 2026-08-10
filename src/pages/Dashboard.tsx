import { Trans, useTranslation } from 'react-i18next';
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
import {
  useDashboardKpis,
  useDashboardTimeseries,
  useDashboardFunnel,
  useStatusDistribution,
  useLifecycleTiming,
  useAttentionLists,
  useAlerts,
  useEvents,
  useContributions,
} from '@/hooks/data';
import { useUrlState } from '@/hooks/useUrlState';
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
  formatDate,
  formatMoney,
  formatMoneyCompact,
  formatNumber,
  formatPercent,
  formatRelative,
} from '@/lib/format';
import type { DrillTo } from '@/lib/types';
import type { Currency } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Screen 02 — Global Dashboard (§02). The daily operational health check.
 * A: alert strip · B: 8 KPI cards (all clickable) · C: 2×2 charts ·
 * D: lifecycle timing table · E: attention lists.
 */
export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [drill, setDrill] = React.useState<DrillTo | null>(null);
  // The date-range picker writes these to the URL; the aggregates read them
  // back so the whole page moves together and the view stays shareable.
  const { get } = useUrlState();
  const range = get('range', '30d');
  const compare = get('compare') === '1';

  const { rows: openAlerts } = useAlerts({ state: 'open' });

  const { data: apiKpis, meta: kpiMeta } = useDashboardKpis({ range, compare: compare ? 1 : undefined });
  const { data: seriesData } = useDashboardTimeseries({ range });
  const { data: funnelData } = useDashboardFunnel({ range });
  const { data: statusData } = useStatusDistribution({ range });
  const { data: timingData } = useLifecycleTiming({ range });
  const { data: attention } = useAttentionLists({ range });

  const timeSeries = seriesData ?? [];
  const funnelStages = funnelData ?? [];
  const lifecycleTiming = timingData ?? [];
  const eventsAtRisk = attention?.atRisk ?? [];
  const largestActiveEvents = attention?.largestActive ?? [];
  const recentlyCompleted = attention?.recentlyCompleted ?? [];
  const alertChips = (
    [
      { type: 'stagnant_event', severity: 'warning' },
      { type: 'payment_friction', severity: 'danger' },
      { type: 'withdrawal_pending', severity: 'warning' },
      { type: 'clover_anomaly', severity: 'danger' },
    ] as const
  )
    .map((chip) => ({
      ...chip,
      label: t(`dashboard.alertChip.${chip.type}`),
      count: openAlerts.filter((a) => a.type === chip.type).length,
    }))
    .filter((c) => c.count > 0);

  const sparks = {
    created: timeSeries.slice(-14).map((d) => d.eventsCreated),
    completed: timeSeries.slice(-14).map((d) => d.eventsCompleted),
    volume: timeSeries.slice(-14).map((d) => d.contributionVolume),
    count: timeSeries.slice(-14).map((d) => d.contributionCount),
  };

  const statusDistribution = React.useMemo(
    () =>
      (statusData ?? []).map((row, i) => ({
        label: t(`status.${row.status.toLowerCase()}`, { defaultValue: row.status }),
        count: row.count,
        pct: row.percent,
        color: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [statusData, t],
  );


  // The server owns these numbers when the API is the data source; the fixture
  // computation below stays as the fallback so the panel still renders offline.

  const kpi = (
    key: keyof NonNullable<typeof apiKpis>,
    definition: string,
    format: (v: number) => string,
  ) => {
    const server = apiKpis?.[key];
    const hasValue = typeof server?.value === 'number';
    return {
      // '—' rather than NaN when the server omits a key.
      value: hasValue ? format(server.value as number) : '—',
      // delta is null when the previous period was 0 — render "—", not Infinity%.
      delta: server?.delta ?? null,
      definition: server?.definition ?? definition,
    };
  };

  return (
    <>
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
        dataAsOf={kpiMeta?.dataAsOf as string | undefined}
        actions={
          <>
            <DateRangePicker />
            <Button variant="secondary" onClick={() => navigate('/exports')}>
              <Download className="h-4 w-4 text-neutral-400" />
              {t('common.export')}
            </Button>
          </>
        }
      />

      {/* Section A — Alert strip, only when alerts exist */}
      {alertChips.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2" role="region" aria-label={t('dashboard.activeAlerts')}>
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
          label={t('dashboard.kpi.activeEvents')}
          {...kpi('activeEvents', t('dashboard.kpi.activeEventsDef'), formatNumber)}
          sparkline={sparks.created}
          onDrillDown={() =>
            setDrill({
              resource: 'events',
              label: t('dashboard.drill.activeEvents'),
              filters: { status: 'active' },
            })
          }
        />
        <KpiCard
          label={t('dashboard.kpi.eventsCreated')}
          {...kpi('eventsCreated', t('dashboard.kpi.eventsCreatedDef'), formatNumber)}
          sparkline={sparks.created}
          onDrillDown={() =>
            setDrill({ resource: 'events', label: t('dashboard.drill.eventsCreated'), filters: {} })
          }
        />
        <KpiCard
          label={t('dashboard.kpi.successRate')}
          {...kpi('eventSuccessRate', t('dashboard.kpi.successRateDef'), formatPercent)}
          deltaUnit="pp"
          sparkline={sparks.completed}
          onDrillDown={() =>
            setDrill({
              resource: 'events',
              label: t('dashboard.drill.completedVsNot'),
              filters: { status: 'completed' },
            })
          }
        />
        <KpiCard
          label={t('dashboard.kpi.avgDuration')}
          {...kpi('avgEventDurationDays', t('dashboard.kpi.avgDurationDef'), (v: number) =>
            t('dashboard.days', { value: v.toFixed(1) }),
          )}
          invertDelta
          onDrillDown={() =>
            setDrill({
              resource: 'events',
              label: t('dashboard.drill.eventsWithDuration'),
              filters: {},
            })
          }
        />
        <KpiCard
          label={t('dashboard.kpi.totalConfirmed')}
          {...kpi('totalConfirmed', t('dashboard.kpi.totalConfirmedDef'), (v: number) =>
            formatMoney(v),
          )}
          sparkline={sparks.volume}
          onDrillDown={() =>
            setDrill({
              resource: 'contributions',
              label: t('dashboard.drill.confirmedContributions'),
              filters: { status: 'succeeded' },
            })
          }
        />
        <KpiCard
          label={t('dashboard.kpi.participation')}
          {...kpi('participationRate', t('dashboard.kpi.participationDef'), formatPercent)}
          deltaUnit="pp"
          sparkline={sparks.count}
          onDrillDown={() =>
            setDrill({
              resource: 'users',
              label: t('dashboard.drill.invitedVsContributed'),
              filters: {},
            })
          }
        />
        <KpiCard
          label={t('dashboard.kpi.cardDownloads')}
          value={
            // Guard each field: a partial KPI payload must degrade to the
            // fallback, not crash the whole dashboard.
            apiKpis?.cardDownloads
              ? `${formatNumber(apiKpis.cardDownloads.unique)} / ${formatNumber(apiKpis.cardDownloads.total)}`
              : '—'
          }
          secondary={t('dashboard.kpi.cardDownloadsSecondary')}
          delta={apiKpis?.cardDownloads?.delta ?? null}
          accent="accent"
          definition={apiKpis?.cardDownloads?.definition ?? t('dashboard.kpi.cardDownloadsDef')}
          onDrillDown={() =>
            setDrill({ resource: 'cards', label: t('dashboard.drill.downloadLog'), filters: {} })
          }
        />
        <KpiCard
          label={t('dashboard.kpi.cloverRedemption')}
          {...kpi('cloverRedemptionRate', t('dashboard.kpi.cloverRedemptionDef'), formatPercent)}
          deltaUnit="pp"
          accent="secondary"
          onDrillDown={() =>
            setDrill({
              resource: 'clovers',
              label: t('dashboard.drill.eligibleVsRedeemed'),
              filters: {},
            })
          }
        />
      </KpiGrid>

      {/* Section C — Charts 2×2 */}
      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title={t('dashboard.charts.eventsOverTime')}
          subtitle={t('dashboard.charts.eventsOverTimeSub')}
          legend={[
            { label: t('dashboard.charts.created'), color: CHART_COLORS[0] },
            { label: t('dashboard.charts.completed'), color: CHART_COLORS[2] },
            { label: t('dashboard.charts.previousPeriod'), color: COMPARISON_COLOR, dashed: true },
          ]}
          tableData={{
            columns: [
              t('dashboard.charts.date'),
              t('dashboard.charts.created'),
              t('dashboard.charts.completed'),
            ],
            rows: timeSeries.map((d) => [d.date, d.eventsCreated, d.eventsCompleted]),
          }}
          onViewRecords={() => navigate('/events')}
        >
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={timeSeries} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={(v) => String(v).slice(5)} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} width={40} />
              <RTooltip content={<ChartTooltip />} cursor={{ fill: 'rgb(var(--neutral-100))' }} />
              <Bar
                dataKey="eventsCreated"
                name={t('dashboard.charts.created')}
                fill={CHART_COLORS[0]}
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="eventsCompleted"
                name={t('dashboard.charts.completed')}
                fill={CHART_COLORS[2]}
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="previousVolume"
                name={t('dashboard.charts.previousPeriod')}
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
          title={t('dashboard.charts.volume')}
          subtitle={t('dashboard.charts.volumeSub')}
          legend={[
            { label: t('dashboard.charts.confirmedVolume'), color: CHART_COLORS[0] },
            { label: t('dashboard.charts.previousPeriod'), color: COMPARISON_COLOR, dashed: true },
            { label: t('dashboard.charts.reminderSent'), color: CHART_COLORS[3] },
          ]}
          tableData={{
            columns: [
              t('dashboard.charts.date'),
              t('dashboard.charts.volumeCol'),
              t('dashboard.charts.reminderSent'),
            ],
            rows: timeSeries.map((d) => [
              d.date,
              formatMoney(d.contributionVolume),
              d.reminderSent ? t('common.yes') : t('common.no'),
            ]),
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
                dataKey="previousVolume"
                name={t('dashboard.charts.previousPeriod')}
                stroke={COMPARISON_COLOR}
                strokeDasharray="4 4"
                strokeWidth={2}
                fill="none"
                dot={false}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="contributionVolume"
                name={t('dashboard.charts.confirmedVolume')}
                stroke={CHART_COLORS[0]}
                strokeWidth={2}
                fill="url(#volFill)"
                isAnimationActive={false}
              />
              {timeSeries
                .filter((d) => d.reminderSent)
                .map((d) => (
                  <ReferenceDot
                    key={d.date}
                    x={d.date}
                    y={d.contributionVolume}
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
          title={t('dashboard.charts.funnel')}
          subtitle={t('dashboard.charts.funnelSub')}
          tableData={{
            columns: [
              t('dashboard.charts.stage'),
              t('dashboard.charts.users'),
              t('dashboard.charts.conversion'),
            ],
            rows: funnelStages.map((s, i) => [
              t(`dashboard.funnelStage.${s.stage.toLowerCase()}`, { defaultValue: s.stage }),
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
                      {t('dashboard.charts.convertedFrom', {
                        percent: conversion.toFixed(1),
                        stage: t(
                          `dashboard.funnelStage.${funnelStages[i - 1].stage.toLowerCase()}`,
                          { defaultValue: funnelStages[i - 1].stage },
                        ).toLowerCase(),
                      })}
                    </p>
                  )}
                  <div className="flex items-center gap-3">
                    <span className="w-[92px] shrink-0 text-body text-neutral-700">
                      {t(`dashboard.funnelStage.${stage.stage.toLowerCase()}`, {
                        defaultValue: stage.stage,
                      })}
                    </span>
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
          title={t('dashboard.charts.statusDistribution')}
          subtitle={t('dashboard.charts.statusDistributionSub')}
          tableData={{
            columns: [
              t('dashboard.charts.statusCol'),
              t('dashboard.charts.eventsCol'),
              t('dashboard.charts.shareCol'),
            ],
            rows: statusDistribution.map((s) => [s.label, s.count, `${s.pct.toFixed(1)}%`]),
          }}
          onViewRecords={() => navigate('/events')}
        >
          <div className="flex h-full flex-col justify-center gap-6 py-4">
            {/* Horizontal stacked bar, not a pie (§02 C4) */}
            <div className="flex h-10 w-full overflow-hidden rounded-sm">
              {statusDistribution.map((s) => (
                <Tooltip
                  key={s.label}
                  content={t('dashboard.charts.sliceTooltip', {
                    label: s.label,
                    count: s.count,
                    percent: s.pct.toFixed(1),
                  })}
                >
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
            <h2 className="text-card-title text-neutral-700">{t('dashboard.lifecycle.title')}</h2>
            <p className="mt-1 text-caption text-neutral-500">{t('dashboard.lifecycle.subtitle')}</p>
          </div>
        </div>
        <div className="scroll-x">
          <table className="w-full border-collapse">
            <thead className="bg-neutral-50">
              <tr className="border-y border-neutral-200">
                <th scope="col" className="px-4 py-3 text-left text-table-header uppercase text-neutral-500">
                  {t('dashboard.lifecycle.metric')}
                </th>
                <th scope="col" className="px-4 py-3 text-right text-table-header uppercase text-neutral-500">
                  {t('dashboard.lifecycle.median')}
                </th>
                <th scope="col" className="px-4 py-3 text-right text-table-header uppercase text-neutral-500">
                  {t('dashboard.lifecycle.p90')}
                </th>
                <th scope="col" className="px-4 py-3 text-right text-table-header uppercase text-neutral-500">
                  {t('dashboard.lifecycle.trend')}
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
                    <Tooltip
                      content={t('dashboard.lifecycle.meanTooltip', {
                        definition: row.definition,
                        mean: row.mean,
                        unit: row.unit,
                      })}
                    >
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
      <SectionHeading description={t('dashboard.attention.description')}>
        {t('dashboard.attention.heading')}
      </SectionHeading>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AttentionList
          title={t('dashboard.attention.atRisk')}
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
                label={t('dashboard.attention.progressLabel', { name: e.name })}
              />
              <p className="tnum mt-1 text-caption text-neutral-500">
                {t('dashboard.attention.ofGoal', {
                  percent: formatPercent((e.raisedAmount / e.goalAmount) * 100, 0),
                  when: formatRelative(e.endDate),
                })}
              </p>
            </>
          )}
        />
        <AttentionList
          title={t('dashboard.attention.largestActive')}
          icon={Wallet}
          tone="brand"
          viewAllHref="/events?status=active"
          events={largestActiveEvents}
          render={(e) => (
            <p className="mt-1 text-caption text-neutral-500">
              <Trans
                i18nKey="dashboard.attention.goalRaised"
                components={{
                  goal: <MoneyValue amount={e.goalAmount ?? 0} className="text-caption" />,
                  raised: <MoneyValue amount={e.raisedAmount} className="text-caption" />,
                }}
              />
            </p>
          )}
        />
        <AttentionList
          title={t('dashboard.attention.recentlyCompleted')}
          icon={Clock}
          tone="success"
          viewAllHref="/events?status=completed"
          events={recentlyCompleted}
          render={(e) => (
            <p className="mt-1 text-caption text-neutral-500">
              <Trans
                i18nKey="dashboard.attention.closedOn"
                values={{ date: e.closedAt ? formatDate(e.closedAt) : '—' }}
                components={{
                  amount: <MoneyValue amount={e.raisedAmount} className="text-caption" />,
                }}
              />
            </p>
          )}
        />
      </div>

      <KpiDrillDown drill={drill} onClose={() => setDrill(null)} />
    </>
  );
}

/** The attention lists are server aggregates, lighter than a full event row. */
interface AttentionRow {
  id: string;
  name: string;
  goalAmount?: number;
  raisedAmount: number;
  progressPercent?: number;
  endDate?: string;
  closedAt?: string;
  currency: Currency;
}

function AttentionList<T extends AttentionRow>({
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
  events: T[];
  render: (e: T) => React.ReactNode;
}) {
  const { t } = useTranslation();
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
          {t('common.viewAll')}
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
  const { t } = useTranslation();
  const isContributions = drill?.resource === 'contributions';
  // Both hooks must run unconditionally; only the matching one is enabled by
  // passing the drill's filters, and the other returns an empty page.
  const { rows: drillContributions } = useContributions(
    isContributions ? { ...drill?.filters, pageSize: 40 } : { pageSize: 1 },
  );
  const { rows: drillEvents } = useEvents(
    !isContributions ? { ...drill?.filters, pageSize: 40 } : { pageSize: 1 },
  );

  if (!drill) return null;

  const rows = isContributions
      ? drillContributions
          .map((c) => ({
            id: c.id,
            primary: c.contributor?.name ?? c.guestName ?? t('dashboard.guest'),
            secondary: c.eventName,
            value: formatMoney(c.amount),
            status: c.status,
            href: `/contributions?q=${c.id}`,
          }))
      : drillEvents
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
      subtitle={t('dashboard.drill.firstRecords')}
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
