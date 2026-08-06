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
import { cardErrorSeries, cardFunnelStages, timeSeries } from '@/lib/mock/data';
import { useStore } from '@/lib/store';
import { cardColumns } from '@/lib/datasets';
import { ExportButton } from '@/components/common/ExportButton';
import { formatDuration, formatNumber, formatPercent } from '@/lib/format';
import type { GiftCardDesign } from '@/lib/types';

/** Screen 08 — Gift Cards Analytics (§08). */
export default function CardAnalytics() {
  const navigate = useNavigate();
  const { giftCards } = useStore();
  const [errorDrill, setErrorDrill] = React.useState(false);

  const totalSelected = giftCards.reduce((a, c) => a + c.timesSelected, 0);
  const premium = giftCards.filter((c) => c.cloverCost > 0);
  const standard = giftCards.filter((c) => c.cloverCost === 0);
  const premiumSelected = premium.reduce((a, c) => a + c.timesSelected, 0);
  const totalUnlocks = premium.reduce((a, c) => a + c.unlocks, 0);
  const uniqueDownloads = giftCards.reduce((a, c) => a + c.uniqueDownloads, 0);
  const totalDownloads = giftCards.reduce((a, c) => a + c.totalDownloads, 0);
  const avgRevealRate =
    giftCards.reduce((a, c) => a + c.revealRate * c.timesSelected, 0) / Math.max(1, totalSelected);
  const totalErrors = cardErrorSeries.reduce(
    (a, d) => a + d.generation + d.loading + d.reveal + d.download,
    0,
  );

  const templateColumns: Column<GiftCardDesign>[] = [
    {
      id: 'design',
      header: 'Design',
      width: '220px',
      sortable: true,
      sortValue: (c) => c.name,
      cell: (c) => (
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-10 w-8 shrink-0 items-center justify-center rounded-sm text-[16px]"
            style={{ backgroundColor: c.bg }}
            aria-hidden
          >
            {c.emojiKey}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-neutral-900">{c.name}</p>
            <p className="truncate font-mono text-caption text-neutral-500">{c.slug}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'type',
      header: 'Type',
      cell: (c) => (
        <Chip tone={c.cloverCost > 0 ? 'secondary' : 'neutral'}>
          {c.cloverCost > 0 ? 'Premium' : 'Standard'}
        </Chip>
      ),
    },
    {
      id: 'selected',
      header: 'Times selected',
      numeric: true,
      sortable: true,
      sortValue: (c) => c.timesSelected,
      cell: (c) => <span className="tnum">{formatNumber(c.timesSelected)}</span>,
    },
    {
      id: 'share',
      header: 'Selection share',
      numeric: true,
      sortable: true,
      sortValue: (c) => c.timesSelected / totalSelected,
      cell: (c) => <span className="tnum">{formatPercent((c.timesSelected / totalSelected) * 100)}</span>,
    },
    {
      id: 'revealRate',
      header: 'Reveal rate',
      numeric: true,
      sortable: true,
      sortValue: (c) => c.revealRate,
      cell: (c) => <span className="tnum">{formatPercent(c.revealRate)}</span>,
    },
    {
      id: 'uniqueDownloads',
      header: 'Unique downloads',
      numeric: true,
      sortable: true,
      sortValue: (c) => c.uniqueDownloads,
      cell: (c) => <span className="tnum">{formatNumber(c.uniqueDownloads)}</span>,
    },
    {
      id: 'totalDownloads',
      header: 'Total downloads',
      numeric: true,
      sortable: true,
      sortValue: (c) => c.totalDownloads,
      cell: (c) => <span className="tnum">{formatNumber(c.totalDownloads)}</span>,
    },
    {
      id: 'perReveal',
      header: 'Downloads / reveal',
      numeric: true,
      sortable: true,
      sortValue: (c) => c.totalDownloads / Math.max(1, c.timesSelected * (c.revealRate / 100)),
      cell: (c) => (
        <span className="tnum">
          {(c.totalDownloads / Math.max(1, c.timesSelected * (c.revealRate / 100))).toFixed(2)}
        </span>
      ),
    },
    {
      id: 'cloverCost',
      header: 'Clover cost',
      numeric: true,
      sortable: true,
      sortValue: (c) => c.cloverCost,
      cell: (c) =>
        c.cloverCost > 0 ? (
          <CloverValue amount={c.cloverCost} className="justify-end" />
        ) : (
          <span className="text-neutral-400">Free</span>
        ),
    },
    {
      id: 'revenue',
      header: 'Revenue in clovers',
      numeric: true,
      sortable: true,
      sortValue: (c) => c.cloverCost * c.unlocks,
      cell: (c) =>
        c.cloverCost > 0 ? (
          <CloverValue amount={c.cloverCost * c.unlocks} className="justify-end" />
        ) : (
          <span className="text-neutral-400">—</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Gift Cards' }, { label: 'Analytics' }]}
        title="Gift Cards Analytics"
        subtitle="Which designs earn their place in the catalog, and where card delivery breaks."
        actions={
          <>
            <DateRangePicker />
            <ExportButton
              name="card-performance"
              label="Cards"
              columns={cardColumns}
              rows={giftCards}
              filterSummary={`${giftCards.length} designs`}
            />
            <Button variant="primary" onClick={() => navigate('/cards/catalog')}>
              <Upload className="h-4 w-4" />
              Manage catalog
            </Button>
          </>
        }
      />

      <KpiGrid className="mb-6">
        <KpiCard
          label="Cards Created"
          value={formatNumber(totalSelected)}
          delta={11.2}
          accent="accent"
          definition="Cards attached to an event in the selected range, standard and premium combined."
        />
        <KpiCard
          label="Standard vs Premium"
          value={`${formatPercent(((totalSelected - premiumSelected) / totalSelected) * 100, 0)} / ${formatPercent((premiumSelected / totalSelected) * 100, 0)}`}
          secondary={`${standard.length} standard · ${premium.length} premium designs`}
          definition="Share of cards created from free designs versus clover-unlocked premium designs."
        />
        <KpiCard
          label="Premium Redeemed with Clovers"
          value={formatNumber(totalUnlocks)}
          delta={19.4}
          accent="secondary"
          definition="CardUnlock rows created in the range — one per user per premium design."
          onDrillDown={() => navigate('/clovers')}
        />
        <KpiCard
          label="Reveal Rate"
          value={formatPercent(avgRevealRate)}
          delta={2.1}
          deltaUnit="pp"
          definition="Cards revealed by the beneficiary ÷ cards available × 100."
        />
        <KpiCard
          label="Unique Downloads"
          value={formatNumber(uniqueDownloads)}
          delta={7.8}
          definition="Distinct (user, card) pairs with at least one download event."
        />
        <KpiCard
          label="Total Downloads"
          value={formatNumber(totalDownloads)}
          delta={9.6}
          definition="All download events, including repeats by the same user."
        />
        <KpiCard
          label="Median Time to First View"
          value={formatDuration(4.2)}
          delta={-8.3}
          invertDelta
          definition="Median of (first view timestamp − card available timestamp)."
        />
        <KpiCard
          label="Card Errors"
          value={formatNumber(totalErrors)}
          delta={-14.2}
          invertDelta
          accent="danger"
          definition="Generation, loading, reveal and download failures logged in the card event log."
          onDrillDown={() => setErrorDrill(true)}
        />
      </KpiGrid>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Cards created over time"
          subtitle="Stacked standard vs premium"
          legend={[
            { label: 'Standard', color: CHART_COLORS[6] },
            { label: 'Premium', color: CHART_COLORS[4] },
          ]}
          tableData={{
            columns: ['Date', 'Standard', 'Premium'],
            rows: timeSeries.map((d) => [d.date, d.standard, d.premium]),
          }}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={timeSeries} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
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
              <Bar dataKey="standard" name="Standard" stackId="c" fill={CHART_COLORS[6]} isAnimationActive={false} />
              <Bar
                dataKey="premium"
                name="Premium"
                stackId="c"
                fill={CHART_COLORS[4]}
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Funnel: Selected → Shared"
          subtitle="Where cards drop out of the delivery path"
          tableData={{
            columns: ['Stage', 'Count', 'Conversion'],
            rows: cardFunnelStages.map((s, i) => [
              s.stage,
              s.value,
              i === 0 ? '—' : `${((s.value / cardFunnelStages[i - 1].value) * 100).toFixed(1)}%`,
            ]),
          }}
        >
          <div className="flex h-full flex-col justify-center gap-2 py-2">
            {cardFunnelStages.map((stage, i) => {
              const pct = (stage.value / cardFunnelStages[0].value) * 100;
              const conv = i === 0 ? 100 : (stage.value / cardFunnelStages[i - 1].value) * 100;
              return (
                <div key={stage.stage} className="flex items-center gap-3">
                  <span className="w-[80px] shrink-0 text-body text-neutral-700">{stage.stage}</span>
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
          title="Card errors over time"
          subtitle="By error type — drill down to individual error records with stack context"
          legend={[
            { label: 'Generation', color: CHART_COLORS[0] },
            { label: 'Loading', color: CHART_COLORS[1] },
            { label: 'Reveal', color: CHART_COLORS[3] },
            { label: 'Download', color: 'rgb(var(--danger-500))' },
          ]}
          tableData={{
            columns: ['Date', 'Generation', 'Loading', 'Reveal', 'Download'],
            rows: cardErrorSeries.map((d) => [d.date, d.generation, d.loading, d.reveal, d.download]),
          }}
          onViewRecords={() => setErrorDrill(true)}
          minHeight={240}
        >
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={cardErrorSeries} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
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
              <Line type="monotone" dataKey="generation" name="Generation" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="loading" name="Loading" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="reveal" name="Reveal" stroke={CHART_COLORS[3]} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="download" name="Download" stroke="rgb(var(--danger-500))" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <SectionHeading description="One row per design. This is what tells you which designs are worth commissioning more of.">
        Template performance
      </SectionHeading>
      <DataTable
        columns={templateColumns}
        rows={giftCards}
        rowKey={(c) => c.id}
        rowHref={(c) => `/cards/catalog/${c.id}`}
        storageKey="template-performance"
        initialSort={{ id: 'selected', dir: 'desc' }}
        pageSize={20}
        empty={{
          headline: 'No designs in the catalog',
          description: 'Upload the first gift-card design to start collecting performance data.',
          action: { label: 'Open catalog', onClick: () => navigate('/cards/catalog') },
        }}
      />

      <DrillDownDrawer
        open={errorDrill}
        onOpenChange={setErrorDrill}
        title="Card errors"
        subtitle="Last 14 days · newest first"
        recordCount={totalErrors}
        fullPageHref="/cards/analytics"
      >
        <ul className="divide-y divide-neutral-200">
          {cardErrorSeries
            .slice()
            .reverse()
            .flatMap((d) =>
              (
                [
                  ['generation', d.generation, 'Card image generation timed out'],
                  ['loading', d.loading, 'Artwork failed to load from CDN'],
                  ['reveal', d.reveal, 'Reveal animation crashed on client'],
                  ['download', d.download, 'Signed download URL expired'],
                ] as const
              )
                .filter(([, count]) => count > 0)
                .map(([type, count, message]) => (
                  <li key={`${d.date}-${type}`} className="px-6 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-body font-medium text-neutral-900">{message}</p>
                        <p className="mt-1 font-mono text-caption text-neutral-500">
                          error.type={type} · date={d.date}
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
          Individual error records include the failing card slug, user id and client stack once the
          card event log ships.{' '}
          <Link to="/cards/catalog" className="text-brand-500 hover:underline">
            Open catalog
          </Link>
        </p>
      </DrillDownDrawer>
    </>
  );
}
