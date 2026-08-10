import { useTranslation } from 'react-i18next';
import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Upload } from 'lucide-react';
import { PageHeader, SectionHeading } from '@/components/common/PageHeader';
import { KpiCard, KpiGrid } from '@/components/common/KpiCard';
import { DateRangePicker } from '@/components/common/DateRangePicker';
import { ChartCard, ChartTooltip } from '@/components/common/ChartCard';
import { CHART_COLORS } from '@/lib/chart-tokens';
import { DataTable, type Column } from '@/components/common/DataTable';
import { DrillDownDrawer } from '@/components/common/DrillDownDrawer';
import { Chip } from '@/components/common/StatusBadge';
import { CloverValue } from '@/components/common/MoneyValue';
import { Button } from '@/components/ui/button';

import {
  useCatalog,
  useCardKpis,
  useCardTimeseries,
  useCardFunnel,
  useCardErrors,
  useCardTemplates,
} from '@/hooks/data';
import { useUrlState } from '@/hooks/useUrlState';
import type { CardTemplateRow } from '@/lib/api/types';
import { cardColumns } from '@/lib/datasets';
import { ExportButton } from '@/components/common/ExportButton';
import { formatDuration, formatNumber, formatPercent } from '@/lib/format';


/** Screen 08 — Gift Cards Analytics (§08). */
export default function CardAnalytics() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { all } = useUrlState();
  const range = all.range ?? '30d';
  const { rows: giftCards } = useCatalog();
  const { data: kpis } = useCardKpis({ range, compare: all.compare === '1' });
  const { data: cardSeries } = useCardTimeseries({ range });
  const { data: funnel } = useCardFunnel({ range });
  const { data: errors } = useCardErrors({ range });
  const { data: templates } = useCardTemplates({ range });

  const kpi = (key: keyof NonNullable<typeof kpis>, fmt: (v: number) => string) => {
    const v = kpis?.[key];
    return { value: typeof v?.value === 'number' ? fmt(v.value) : '—', delta: v?.delta ?? null };
  };
  const series = cardSeries ?? [];
  const funnelStages = funnel ?? [];
  const errorSeries = errors?.series ?? [];
  const errorRecords = errors?.records ?? [];
  void errorRecords;
  const templateRows = templates ?? [];
  const [errorDrill, setErrorDrill] = React.useState(false);

  const totalErrors = errorSeries.reduce(
    (a, d) => a + d.generation + d.loading + d.reveal + d.download,
    0,
  );

  const templateColumns: Column<CardTemplateRow>[] = [
    {
      id: 'design',
      header: t('cards.analytics.table.design'),
      width: '220px',
      sortable: true,
      sortValue: (c) => c.name,
      cell: (c) => (
        <div className="flex min-w-0 items-center gap-3">
          {c.thumbUrl ? (
            <img
              src={c.thumbUrl}
              alt=""
              className="h-10 w-8 shrink-0 rounded-sm object-cover"
              loading="lazy"
            />
          ) : (
            <span className="h-10 w-8 shrink-0 rounded-sm bg-neutral-100" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="truncate font-medium text-neutral-900">{c.name}</p>
            <p className="truncate font-mono text-caption text-neutral-500">{c.slug}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'type',
      header: t('cards.analytics.table.type'),
      cell: (c) => (
        <Chip tone={c.cloverCost > 0 ? 'secondary' : 'neutral'}>
          {c.cloverCost > 0 ? t('cards.premium') : t('cards.standard')}
        </Chip>
      ),
    },
    {
      id: 'selected',
      header: t('cards.analytics.table.timesSelected'),
      numeric: true,
      sortable: true,
      sortValue: (c) => c.timesSelected,
      cell: (c) => <span className="tnum">{formatNumber(c.timesSelected)}</span>,
    },
    {
      id: 'share',
      header: t('cards.analytics.table.selectionShare'),
      numeric: true,
      sortable: true,
      sortValue: (c) => c.selectionSharePercent,
      cell: (c) => <span className="tnum">{formatPercent(c.selectionSharePercent)}</span>,
    },
    {
      id: 'revealRate',
      header: t('cards.analytics.table.revealRate'),
      numeric: true,
      sortable: true,
      sortValue: (c) => c.revealRate,
      cell: (c) => <span className="tnum">{formatPercent(c.revealRate)}</span>,
    },
    {
      id: 'uniqueDownloads',
      header: t('cards.analytics.table.uniqueDownloads'),
      numeric: true,
      sortable: true,
      sortValue: (c) => c.uniqueDownloads,
      cell: (c) => <span className="tnum">{formatNumber(c.uniqueDownloads)}</span>,
    },
    {
      id: 'totalDownloads',
      header: t('cards.analytics.table.totalDownloads'),
      numeric: true,
      sortable: true,
      sortValue: (c) => c.totalDownloads,
      cell: (c) => <span className="tnum">{formatNumber(c.totalDownloads)}</span>,
    },
    {
      id: 'perReveal',
      header: t('cards.analytics.table.downloadsPerReveal'),
      numeric: true,
      sortable: true,
      sortValue: (c) => c.downloadsPerReveal,
      cell: (c) => <span className="tnum">{c.downloadsPerReveal.toFixed(2)}</span>,
    },
    {
      id: 'cloverCost',
      header: t('cards.analytics.table.cloverCost'),
      numeric: true,
      sortable: true,
      sortValue: (c) => c.cloverCost,
      cell: (c) =>
        c.cloverCost > 0 ? (
          <CloverValue amount={c.cloverCost} className="justify-end" />
        ) : (
          <span className="text-neutral-400">{t('cards.free')}</span>
        ),
    },
    {
      id: 'revenue',
      header: t('cards.analytics.table.revenue'),
      numeric: true,
      sortable: true,
      sortValue: (c) => c.revenueInClovers,
      cell: (c) =>
        c.cloverCost > 0 ? (
          <CloverValue amount={c.revenueInClovers} className="justify-end" />
        ) : (
          <span className="text-neutral-400">—</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: t('nav.giftCards') },
          { label: t('cards.analytics.breadcrumb') },
        ]}
        title={t('cards.analytics.title')}
        subtitle={t('cards.analytics.subtitle')}
        actions={
          <>
            <DateRangePicker />
            <ExportButton
              name="card-performance"
              label={t('cards.analytics.exportLabel')}
              columns={cardColumns}
              rows={giftCards}
              filterSummary={t('cards.analytics.designCount', { count: giftCards.length })}
            />
            <Button variant="primary" onClick={() => navigate('/cards/catalog')}>
              <Upload className="h-4 w-4" />
              {t('cards.analytics.manageCatalog')}
            </Button>
          </>
        }
      />

      <KpiGrid className="mb-6">
        <KpiCard
          label={t('cards.analytics.kpi.created')}
          {...kpi('cardsCreated', formatNumber)}
          accent="accent"
          definition={t('cards.analytics.kpi.createdDef')}
        />
        <KpiCard
          label={t('cards.analytics.kpi.standardVsPremium')}
          value={
            kpis
              ? `${formatNumber(kpis.standardCount?.value ?? 0)} / ${formatNumber(kpis.premiumCount?.value ?? 0)}`
              : '—'
          }
          secondary={t('cards.analytics.kpi.standardVsPremiumSecondary')}
          definition={t('cards.analytics.kpi.standardVsPremiumDef')}
        />
        <KpiCard
          label={t('cards.analytics.kpi.premiumRedeemed')}
          {...kpi('premiumRedeemedWithClovers', formatNumber)}
          accent="secondary"
          definition={t('cards.analytics.kpi.premiumRedeemedDef')}
          onDrillDown={() => navigate('/clovers')}
        />
        <KpiCard
          label={t('cards.analytics.kpi.revealRate')}
          {...kpi('revealRate', formatPercent)}
          deltaUnit="pp"
          definition={t('cards.analytics.kpi.revealRateDef')}
        />
        <KpiCard
          label={t('cards.analytics.kpi.uniqueDownloads')}
          {...kpi('uniqueDownloads', formatNumber)}
          definition={t('cards.analytics.kpi.uniqueDownloadsDef')}
        />
        <KpiCard
          label={t('cards.analytics.kpi.totalDownloads')}
          {...kpi('totalDownloads', formatNumber)}
          definition={t('cards.analytics.kpi.totalDownloadsDef')}
        />
        <KpiCard
          label={t('cards.analytics.kpi.medianFirstView')}
          {...kpi('medianTimeToFirstViewHours', formatDuration)}
          invertDelta
          definition={t('cards.analytics.kpi.medianFirstViewDef')}
        />
        <KpiCard
          label={t('cards.analytics.kpi.errors')}
          {...kpi('cardErrors', formatNumber)}
          invertDelta
          accent="danger"
          definition={t('cards.analytics.kpi.errorsDef')}
          onDrillDown={() => setErrorDrill(true)}
        />
      </KpiGrid>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title={t('cards.analytics.charts.createdOverTime')}
          subtitle={t('cards.analytics.charts.createdOverTimeSub')}
          legend={[
            { label: t('cards.standard'), color: CHART_COLORS[6] },
            { label: t('cards.premium'), color: CHART_COLORS[4] },
          ]}
          tableData={{
            columns: [t('fields.date'), t('cards.standard'), t('cards.premium')],
            rows: series.map((d) => [d.date, d.standard, d.premium]),
          }}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
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
                dataKey="standard"
                name={t('cards.standard')}
                stackId="c"
                fill={CHART_COLORS[6]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="premium"
                name={t('cards.premium')}
                stackId="c"
                fill={CHART_COLORS[4]}
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={t('cards.analytics.charts.funnel')}
          subtitle={t('cards.analytics.charts.funnelSub')}
          tableData={{
            columns: [
              t('cards.analytics.charts.stage'),
              t('cards.analytics.charts.count'),
              t('cards.analytics.charts.conversion'),
            ],
            rows: funnelStages.map((s, i) => [
              t(`cards.analytics.funnelStage.${s.stage.toLowerCase()}`, { defaultValue: s.stage }),
              s.value,
              i === 0 ? '—' : `${((s.value / funnelStages[i - 1].value) * 100).toFixed(1)}%`,
            ]),
          }}
        >
          <div className="flex h-full flex-col justify-center gap-2 py-2">
            {funnelStages.map((stage, i) => {
              const pct = (stage.value / funnelStages[0].value) * 100;
              const conv = i === 0 ? 100 : (stage.value / funnelStages[i - 1].value) * 100;
              return (
                <div key={stage.stage} className="flex items-center gap-3">
                  <span className="w-[80px] shrink-0 text-body text-neutral-700">
                    {t(`cards.analytics.funnelStage.${stage.stage.toLowerCase()}`, {
                      defaultValue: stage.stage,
                    })}
                  </span>
                  <div className="relative h-6 flex-1 overflow-hidden rounded-sm bg-neutral-100">
                    <div
                      className="h-full rounded-sm"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: CHART_COLORS[Math.min(i, CHART_COLORS.length - 1)],
                      }}
                    />
                  </div>
                  <span className="tnum w-[56px] shrink-0 text-right text-body font-medium text-neutral-900">
                    {formatNumber(stage.value)}
                  </span>
                  <span className="tnum w-[52px] shrink-0 text-right text-caption text-neutral-500">
                    {i === 0 ? '—' : `${conv.toFixed(0)}%`}
                  </span>
                </div>
              );
            })}
          </div>
        </ChartCard>
      </div>

      <div className="mb-6">
        <ChartCard
          title={t('cards.analytics.charts.errorsOverTime')}
          subtitle={t('cards.analytics.charts.errorsOverTimeSub')}
          legend={[
            { label: t('cards.analytics.errorType.generation'), color: CHART_COLORS[0] },
            { label: t('cards.analytics.errorType.loading'), color: CHART_COLORS[1] },
            { label: t('cards.analytics.errorType.reveal'), color: CHART_COLORS[3] },
            { label: t('cards.analytics.errorType.download'), color: 'rgb(var(--danger-500))' },
          ]}
          tableData={{
            columns: [
              t('fields.date'),
              t('cards.analytics.errorType.generation'),
              t('cards.analytics.errorType.loading'),
              t('cards.analytics.errorType.reveal'),
              t('cards.analytics.errorType.download'),
            ],
            rows: errorSeries.map((d) => [d.date, d.generation, d.loading, d.reveal, d.download]),
          }}
          onViewRecords={() => setErrorDrill(true)}
          minHeight={240}
        >
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={errorSeries} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => String(v).slice(5)}
                minTickGap={24}
              />
              <YAxis tickLine={false} axisLine={false} width={40} />
              <RTooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="generation"
                name={t('cards.analytics.errorType.generation')}
                stroke={CHART_COLORS[0]}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="loading"
                name={t('cards.analytics.errorType.loading')}
                stroke={CHART_COLORS[1]}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="reveal"
                name={t('cards.analytics.errorType.reveal')}
                stroke={CHART_COLORS[3]}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="download"
                name={t('cards.analytics.errorType.download')}
                stroke="rgb(var(--danger-500))"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <SectionHeading description={t('cards.analytics.templateDescription')}>
        {t('cards.analytics.templateHeading')}
      </SectionHeading>
      <DataTable
        columns={templateColumns}
        rows={templateRows}
        rowKey={(c) => c.id}
        rowHref={(c) => `/cards/catalog/${c.id}`}
        storageKey="template-performance"
        initialSort={{ id: 'selected', dir: 'desc' }}
        pageSize={20}
        empty={{
          headline: t('cards.analytics.table.empty'),
          description: t('cards.analytics.table.emptyBody'),
          action: {
            label: t('cards.analytics.table.openCatalog'),
            onClick: () => navigate('/cards/catalog'),
          },
        }}
      />

      <DrillDownDrawer
        open={errorDrill}
        onOpenChange={setErrorDrill}
        title={t('cards.analytics.drillTitle')}
        subtitle={t('cards.analytics.drillSubtitle')}
        recordCount={totalErrors}
        fullPageHref="/cards/analytics"
      >
        <ul className="divide-y divide-neutral-200">
          {errorSeries
            .slice()
            .reverse()
            .flatMap((d) =>
              (
                [
                  ['generation', d.generation],
                  ['loading', d.loading],
                  ['reveal', d.reveal],
                  ['download', d.download],
                ] as const
              )
                .filter(([, count]) => count > 0)
                .map(([type, count]) => (
                  <li key={`${d.date}-${type}`} className="px-6 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-body font-medium text-neutral-900">
                          {t(`cards.analytics.errorMessage.${type}`)}
                        </p>
                        <p className="mt-1 font-mono text-caption text-neutral-500">
                          {t('cards.analytics.drillMeta', { type, date: d.date })}
                        </p>
                      </div>
                      <span className="tnum shrink-0 rounded-sm bg-danger-50 px-2 py-1 text-caption font-medium text-danger-500">
                        ×{count}
                      </span>
                    </div>
                  </li>
                )),
            )}
        </ul>
        <p className="px-6 py-4 text-caption text-neutral-500">
          {t('cards.analytics.drillNote')}{' '}
          <Link to="/cards/catalog" className="text-brand-500 hover:underline">
            {t('cards.analytics.table.openCatalog')}
          </Link>
        </p>
      </DrillDownDrawer>
    </>
  );
}
