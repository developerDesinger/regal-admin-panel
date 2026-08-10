import { Trans, useTranslation } from 'react-i18next';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download, Info } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { KpiCard, KpiGrid } from '@/components/common/KpiCard';
import { FilterBar } from '@/components/common/FilterBar';
import { DateRangePicker } from '@/components/common/DateRangePicker';
import { ChartCard, ChartTooltip } from '@/components/common/ChartCard';
import { CHART_COLORS } from '@/lib/chart-tokens';
import { ContributionsTable } from './ContributionsTable';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useContributions, useContributionKpis, useContributionCharts } from '@/hooks/data';
import { contributionColumns } from '@/lib/datasets';
import { ExportButton } from '@/components/common/ExportButton';
import { rangeLabel } from '@/lib/date-ranges';
import { downloadDataset } from '@/lib/export';
import { useUrlState } from '@/hooks/useUrlState';
import { formatMoney, formatMoneyCompact, formatPercent } from '@/lib/format';

/** Screen 05 — Contributions & Financials (§05). */
export default function Contributions() {
  const { t } = useTranslation();
  const { all } = useUrlState();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { rows: contributions, isLoading, error, refetch, meta } = useContributions(all);
  const range = all.range ?? '30d';
  const { data: kpis } = useContributionKpis({ range, compare: all.compare === '1' });
  const { data: charts } = useContributionCharts({ range });

  const kpi = (key: keyof NonNullable<typeof kpis>, fmt: (v: number) => string) => {
    const v = kpis?.[key];
    return { value: typeof v?.value === 'number' ? fmt(v.value) : '—', delta: v?.delta ?? null };
  };
  const statusSeries = charts?.volumeOverTime ?? [];
  const sizeBuckets = charts?.sizeDistribution ?? [];
  const failureReasons = charts?.failureReasons ?? [];

  const filtered = React.useMemo(
    () =>
      contributions.filter((c) => {
        if (all.status && all.status !== 'all' && c.status !== all.status) return false;
        if (all.event && c.eventId !== all.event) return false;
        if (all.guest === 'guest' && !c.isGuest) return false;
        if (all.guest === 'registered' && c.isGuest) return false;
        if (all.feePayer && all.feePayer !== 'all' && c.feePayer !== all.feePayer) return false;
        if (all.method && all.method !== 'all' && !c.paymentMethod.startsWith(all.method)) return false;
        if (all.amount && all.amount !== 'all') {
          const major = c.amount / 100;
          const ranges: Record<string, [number, number]> = {
            '0-50': [0, 50],
            '50-100': [50, 100],
            '100-250': [100, 250],
            '250-500': [250, 500],
            '500+': [500, Infinity],
          };
          const [lo, hi] = ranges[all.amount] ?? [0, Infinity];
          if (major < lo || major >= hi) return false;
        }
        if (all.q) {
          const q = all.q.toLowerCase();
          const hay = `${c.id} ${c.stripePaymentIntentId} ${c.eventName} ${c.contributor?.name ?? ''} ${c.guestName ?? ''} ${c.guestEmail ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }),
    [all, contributions],
  );


  return (
    <>
      <PageHeader
        title={t('contributions.title')}
        subtitle={t('contributions.subtitle')}
        actions={
          <>
            <DateRangePicker />
            <ExportButton
              name="contributions"
              label={t('contributions.exportLabel')}
              columns={contributionColumns}
              rows={filtered}
              containsPii
              filterSummary={t('contributions.filterSummary', {
                range: t(rangeLabel(all.range ?? '30d')),
                shown: filtered.length,
                total: meta?.totalRows ?? contributions.length,
              })}
            />
          </>
        }
      />

      <KpiGrid className="mb-6">
        <KpiCard
          label={t('contributions.kpi.totalConfirmed')}
          {...kpi('totalConfirmed', (v) => formatMoney(v))}
          definition={t('contributions.kpi.totalConfirmedDef')}
          onDrillDown={() => navigate('/contributions?status=succeeded')}
        />
        <KpiCard
          label={t('contributions.kpi.pending')}
          {...kpi('totalPending', (v) => formatMoney(v))}
          invertDelta
          definition={t('contributions.kpi.pendingDef')}
          onDrillDown={() => navigate('/contributions?status=pending')}
        />
        <KpiCard
          label={t('contributions.kpi.failed')}
          {...kpi('totalFailed', (v) => formatMoney(v))}
          invertDelta
          accent="danger"
          definition={t('contributions.kpi.failedDef')}
          onDrillDown={() => navigate('/contributions?status=failed')}
        />
        <KpiCard
          label={t('contributions.kpi.cancelled')}
          {...kpi('totalCancelled', (v) => formatMoney(v))}
          definition={t('contributions.kpi.cancelledDef')}
          onDrillDown={() => navigate('/contributions?status=cancelled')}
        />
        <KpiCard
          label={t('contributions.kpi.average')}
          {...kpi('averageContribution', (v) => formatMoney(v))}
          definition={t('contributions.kpi.averageDef')}
        />
        <KpiCard
          label={t('contributions.kpi.median')}
          {...kpi('medianContribution', (v) => formatMoney(v))}
          definition={t('contributions.kpi.medianDef')}
        />
        <KpiCard
          label={t('contributions.kpi.failureRate')}
          {...kpi('failureRate', formatPercent)}
          deltaUnit="pp"
          invertDelta
          accent="danger"
          definition={t('contributions.kpi.failureRateDef')}
          onDrillDown={() => navigate('/contributions?status=failed')}
        />
        <KpiCard
          label={t('contributions.kpi.totalFees')}
          {...kpi('totalFees', (v) => formatMoney(v))}
          definition={t('contributions.kpi.totalFeesDef')}
        />
      </KpiGrid>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard
          title={t('contributions.charts.volume')}
          subtitle={t('contributions.charts.volumeSub')}
          className="xl:col-span-2"
          legend={[
            { label: t('status.succeeded'), color: CHART_COLORS[2] },
            { label: t('status.pending'), color: CHART_COLORS[3] },
            { label: t('status.failed'), color: 'rgb(var(--danger-500))' },
            { label: t('status.cancelled'), color: CHART_COLORS[6] },
          ]}
          tableData={{
            columns: [
              t('fields.date'),
              t('status.succeeded'),
              t('status.pending'),
              t('status.failed'),
              t('status.cancelled'),
            ],
            rows: statusSeries.map((d) => [d.date, d.succeeded, d.pending, d.failed, d.cancelled]),
          }}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={statusSeries} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => String(v).slice(5)}
                minTickGap={24}
              />
              <YAxis tickLine={false} axisLine={false} width={40} />
              <RTooltip content={<ChartTooltip />} cursor={{ fill: 'rgb(var(--neutral-100))' }} />
              <Bar
                dataKey="succeeded"
                name={t('status.succeeded')}
                stackId="s"
                fill={CHART_COLORS[2]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="pending"
                name={t('status.pending')}
                stackId="s"
                fill={CHART_COLORS[3]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="failed"
                name={t('status.failed')}
                stackId="s"
                fill="rgb(var(--danger-500))"
                isAnimationActive={false}
              />
              <Bar
                dataKey="cancelled"
                name={t('status.cancelled')}
                stackId="s"
                fill={CHART_COLORS[6]}
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={t('contributions.charts.sizeDistribution')}
          subtitle={t('contributions.charts.sizeDistributionSub')}
          tableData={{
            columns: [
              t('contributions.charts.bucket'),
              t('contributions.charts.contributions'),
            ],
            rows: sizeBuckets.map((b) => [b.bucket, b.count]),
          }}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={sizeBuckets}
              layout="vertical"
              margin={{ top: 8, right: 16, bottom: 0, left: 8 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} />
              <YAxis dataKey="bucket" type="category" tickLine={false} axisLine={false} width={88} />
              <RTooltip content={<ChartTooltip />} cursor={{ fill: 'rgb(var(--neutral-100))' }} />
              <Bar
                dataKey="count"
                name={t('contributions.charts.contributions')}
                radius={[0, 2, 2, 0]}
                isAnimationActive={false}
              >
                {sizeBuckets.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[0]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mb-6">
        <ChartCard
          title={t('contributions.charts.failureReasons')}
          subtitle={t('contributions.charts.failureReasonsSub')}
          tableData={{
            columns: [
              t('contributions.charts.declineCode'),
              t('contributions.charts.count'),
            ],
            rows: failureReasons.map((f) => [f.reason, f.count]),
          }}
          minHeight={200}
        >
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={failureReasons}
              layout="vertical"
              margin={{ top: 0, right: 24, bottom: 0, left: 8 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} />
              <YAxis dataKey="reason" type="category" tickLine={false} axisLine={false} width={140} />
              <RTooltip content={<ChartTooltip />} cursor={{ fill: 'rgb(var(--neutral-100))' }} />
              <Bar
                dataKey="count"
                name={t('contributions.charts.failures')}
                radius={[0, 2, 2, 0]}
                isAnimationActive={false}
              >
                {failureReasons.map((_, i) => (
                  <Cell key={i} fill="rgb(var(--danger-500))" fillOpacity={1 - i * 0.14} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mb-3 flex items-start gap-2 rounded-md border border-info-500/20 bg-info-50 p-3">
        <Info className="mt-px h-4 w-4 shrink-0 text-info-500" aria-hidden />
        <p className="text-caption text-info-500">
          <Trans
            i18nKey="contributions.backendGap"
            components={[
              <strong key="0" />,
              <span key="1" />,
              <code key="2" className="font-mono" />,
              <span key="3" />,
              <code key="4" className="font-mono" />,
              <span key="5" />,
              <code key="6" className="font-mono" />,
              <span key="7" />,
              <code key="8" className="font-mono" />,
            ]}
          />
        </p>
      </div>

      <FilterBar
        className="mb-4"
        searchPlaceholder={t('contributions.searchPlaceholder')}
        filters={[
          {
            id: 'status',
            label: t('fields.status'),
            options: ['succeeded', 'pending', 'failed', 'cancelled'].map((s) => ({
              value: s,
              label: t(`status.${s}`),
            })),
          },
          {
            id: 'guest',
            label: t('contributions.filters.contributor'),
            options: [
              { value: 'guest', label: t('contributions.filters.guest') },
              { value: 'registered', label: t('contributions.filters.registered') },
            ],
          },
          {
            id: 'amount',
            label: t('contributions.filters.amount'),
            options: [
              { value: '0-50', label: '< $50' },
              { value: '50-100', label: '$50–100' },
              { value: '100-250', label: '$100–250' },
              { value: '250-500', label: '$250–500' },
              { value: '500+', label: '$500+' },
            ],
          },
          {
            id: 'feePayer',
            label: t('contributions.filters.feePayer'),
            options: [
              { value: 'contributor', label: t('contributions.filters.contributor') },
              { value: 'beneficiary', label: t('contributions.filters.beneficiary') },
            ],
          },
          {
            id: 'method',
            label: t('contributions.filters.method'),
            options: [
              { value: 'Visa', label: 'Visa' },
              { value: 'Mastercard', label: 'Mastercard' },
              { value: 'Amex', label: 'Amex' },
              { value: 'OXXO', label: 'OXXO' },
              { value: 'SPEI', label: 'SPEI' },
            ],
          },
        ]}
      />

      <ContributionsTable
        rows={filtered}
        loading={isLoading}
        error={error}
        onRetry={refetch}
        bulkActions={(selected, clear) => (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const file = downloadDataset('contributions-selection', contributionColumns, selected, 'csv');
              toast({
                title: t('common.downloadStarted'),
                description: t('contributions.exportedCount', {
                  filename: file,
                  count: selected.length,
                }),
                tone: 'success',
              });
              clear();
            }}
          >
            <Download className="h-4 w-4 text-neutral-400" />
            {t('events.exportCsv')}
          </Button>
        )}
      />
      <p className="mt-3 text-caption text-neutral-500">
        <Trans
          i18nKey="contributions.totalInView"
          values={{
            amount: formatMoneyCompact(filtered.reduce((a, c) => a + c.amount, 0)),
            count: filtered.length.toLocaleString(),
          }}
          components={[<span key="0" />, <span key="1" className="tnum font-medium text-neutral-900" />]}
        />
      </p>
    </>
  );
}
