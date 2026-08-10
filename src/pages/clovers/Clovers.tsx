import { Trans, useTranslation } from 'react-i18next';
import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, Search, Snowflake } from 'lucide-react';
import { PageHeader, SectionHeading } from '@/components/common/PageHeader';
import { KpiCard, KpiGrid } from '@/components/common/KpiCard';
import { DateRangePicker } from '@/components/common/DateRangePicker';
import { ChartCard, ChartTooltip } from '@/components/common/ChartCard';
import { CHART_COLORS } from '@/lib/chart-tokens';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { CloverLedgerTable } from '@/pages/users/UserDetail';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/misc';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import type { CloverAnomaly } from '@/lib/api/types';
import { avatarColorFor } from '@/lib/api/adapters';
import {
  useCloverLedger,
  useCloverAnomalies,
  useCloverKpis,
  useCloverTimeseries,
  useCloverEarnBreakdown,
  useCloverRedemptionByDesign,
} from '@/hooks/data';
import { useAdminMutations } from '@/hooks/data/mutations';
import { cloverColumns } from '@/lib/datasets';
import { ExportButton } from '@/components/common/ExportButton';
import { rangeLabel } from '@/lib/date-ranges';
import { useUrlState } from '@/hooks/useUrlState';
import { formatNumber, formatPercent } from '@/lib/format';

/** Screen 10 — Clovers (§10). */
export default function Clovers() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { can } = useAuth();
  const { all } = useUrlState();
  const range = all.range ?? '30d';
  const compare = all.compare === '1';

  const { anomalies: cloverAnomalies } = useCloverAnomalies();
  const { data: cloverKpis } = useCloverKpis({ range, compare: compare ? 1 : undefined });
  const { data: cloverSeries } = useCloverTimeseries({ range });
  const { data: earnBreakdown } = useCloverEarnBreakdown({ range });
  const { data: redemption } = useCloverRedemptionByDesign({ range });
  const { rows: cloverLedger } = useCloverLedger({});
  const mutations = useAdminMutations();
  const [freezing, setFreezing] = React.useState<CloverAnomaly | null>(null);

  // Every figure below is the server's; `k` returns '—' rather than NaN when a
  // key is missing, and null delta means the previous period was 0.
  const k = (key: keyof NonNullable<typeof cloverKpis>) => cloverKpis?.[key] ?? null;
  const num = (key: keyof NonNullable<typeof cloverKpis>) => {
    const v = k(key);
    return typeof v?.value === 'number' ? formatNumber(v.value) : '—';
  };
  const pct = (key: keyof NonNullable<typeof cloverKpis>) => {
    const v = k(key);
    return typeof v?.value === 'number' ? formatPercent(v.value) : '—';
  };
  const series = cloverSeries ?? [];
  const earnRows = earnBreakdown ?? [];

  // Server-side: counts every redemption, not just what the catalog page holds.
  const redemptionByDesign = (redemption ?? []).slice(0, 8);

  return (
    <>
      <PageHeader
        title={t('clovers.title')}
        subtitle={t('clovers.subtitle')}
        actions={
          <>
            <DateRangePicker />
            <ExportButton
              name="clover-ledger"
              label={t('clovers.exportLabel')}
              columns={cloverColumns}
              rows={cloverLedger}
              filterSummary={t('clovers.filterSummary', {
                range: t(rangeLabel(all.range ?? '30d')),
                count: cloverLedger.length,
              })}
            />
          </>
        }
      />

      <KpiGrid className="mb-6">
        <KpiCard
          label={t('clovers.kpi.earned')}
          value={num('cloversEarned')}
          delta={k('cloversEarned')?.delta ?? null}
          accent="secondary"
          definition={t('clovers.kpi.earnedDef')}
        />
        <KpiCard
          label={t('clovers.kpi.redeemed')}
          value={num('cloversRedeemed')}
          delta={k('cloversRedeemed')?.delta ?? null}
          accent="secondary"
          definition={t('clovers.kpi.redeemedDef')}
        />
        <KpiCard
          label={t('clovers.kpi.outstanding')}
          value={num('outstandingBalance')}
          delta={k('outstandingBalance')?.delta ?? null}
          invertDelta
          definition={t('clovers.kpi.outstandingDef')}
        />
        <KpiCard
          label={t('clovers.kpi.redemptionRate')}
          value={pct('redemptionRate')}
          delta={k('redemptionRate')?.delta ?? null}
          deltaUnit="pp"
          definition={t('clovers.kpi.redemptionRateDef')}
        />
        <KpiCard
          label={t('clovers.kpi.burnRate')}
          value={pct('burnRate')}
          delta={k('burnRate')?.delta ?? null}
          deltaUnit="pp"
          definition={t('clovers.kpi.burnRateDef')}
        />
        <KpiCard
          label={t('clovers.kpi.repeatRedemption')}
          value={pct('repeatRedemption')}
          delta={k('repeatRedemption')?.delta ?? null}
          deltaUnit="pp"
          definition={t('clovers.kpi.repeatRedemptionDef')}
        />
        <KpiCard
          label={t('clovers.kpi.premiumDownloadRate')}
          value={pct('premiumCardDownloadRate')}
          delta={k('premiumCardDownloadRate')?.delta ?? null}
          deltaUnit="pp"
          accent="accent"
          definition={t('clovers.kpi.premiumDownloadRateDef')}
          onDrillDown={() => navigate('/cards/analytics')}
        />
        <KpiCard
          label={t('clovers.kpi.anomalies')}
          value={formatNumber(cloverAnomalies.length)}
          accent="danger"
          definition={t('clovers.kpi.anomaliesDef')}
          onDrillDown={() => navigate('/alerts?type=clover_anomaly')}
        />
      </KpiGrid>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title={t('clovers.charts.flow')}
          subtitle={t('clovers.charts.flowSub')}
          legend={[
            { label: t('clovers.charts.earned'), color: CHART_COLORS[3] },
            { label: t('clovers.charts.redeemed'), color: CHART_COLORS[4] },
          ]}
          tableData={{
            columns: [t('fields.date'), t('clovers.charts.earned'), t('clovers.charts.redeemed')],
            rows: series.map((d) => [d.date, d.earned, d.redeemed]),
          }}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => String(v).slice(5)}
                minTickGap={24}
              />
              <YAxis tickLine={false} axisLine={false} width={48} />
              <RTooltip content={<ChartTooltip />} cursor={{ fill: 'rgb(var(--neutral-100))' }} />
              <Bar
                dataKey="earned"
                name={t('clovers.charts.earned')}
                fill={CHART_COLORS[3]}
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="redeemed"
                name={t('clovers.charts.redeemed')}
                fill={CHART_COLORS[4]}
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={t('clovers.charts.liability')}
          subtitle={t('clovers.charts.liabilitySub')}
          legend={[{ label: t('clovers.charts.outstanding'), color: CHART_COLORS[0] }]}
          tableData={{
            columns: [t('fields.date'), t('clovers.charts.outstandingCol')],
            rows: series.map((d) => [d.date, d.outstandingBalance]),
          }}
        >
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="liabilityFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.24} />
                  <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => String(v).slice(5)}
                minTickGap={24}
              />
              <YAxis tickLine={false} axisLine={false} width={56} />
              <RTooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="outstandingBalance"
                name={t('clovers.charts.outstanding')}
                stroke={CHART_COLORS[0]}
                strokeWidth={2}
                fill="url(#liabilityFill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={t('clovers.charts.earnBreakdown')}
          subtitle={t('clovers.charts.earnBreakdownSub')}
          tableData={{
            columns: [t('clovers.charts.action'), t('clovers.charts.clovers')],
            rows: earnRows.map((a) => [a.action, a.clovers]),
          }}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={earnRows}
              layout="vertical"
              margin={{ top: 8, right: 24, bottom: 0, left: 8 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} />
              <YAxis dataKey="action" type="category" tickLine={false} axisLine={false} width={130} />
              <RTooltip content={<ChartTooltip />} cursor={{ fill: 'rgb(var(--neutral-100))' }} />
              <Bar
                dataKey="clovers"
                name={t('clovers.charts.cloversMinted')}
                radius={[0, 2, 2, 0]}
                isAnimationActive={false}
              >
                {earnRows.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[3]} fillOpacity={1 - i * 0.11} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={t('clovers.charts.redemptionByDesign')}
          subtitle={t('clovers.charts.redemptionByDesignSub')}
          tableData={{
            columns: [
              t('clovers.charts.design'),
              t('clovers.charts.clovers'),
              t('clovers.charts.unlocks'),
            ],
            rows: redemptionByDesign.map((d) => [d.name, d.clovers, d.redemptions]),
          }}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={redemptionByDesign}
              layout="vertical"
              margin={{ top: 8, right: 24, bottom: 0, left: 8 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} />
              <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={130} />
              <RTooltip content={<ChartTooltip />} cursor={{ fill: 'rgb(var(--neutral-100))' }} />
              <Bar
                dataKey="clovers"
                name={t('clovers.charts.cloversBurned')}
                radius={[0, 2, 2, 0]}
                isAnimationActive={false}
              >
                {redemptionByDesign.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[4]} fillOpacity={1 - i * 0.09} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Anomaly panel — satisfies the brief's clover anomaly alert (§10) */}
      <SectionHeading description={t('clovers.anomalyDescription')}>
        {t('clovers.anomalyHeading')}
      </SectionHeading>
      <Card className="mb-6">
        <ul className="divide-y divide-neutral-200">
          {cloverAnomalies.map((a) => (
            <li key={a.user.id} className="flex flex-wrap items-center gap-4 p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger-50">
                <AlertTriangle className="h-4 w-4 text-danger-500" aria-hidden />
              </span>
              <Link
                to={`/users/${a.user.id}`}
                className="flex min-w-0 items-center gap-2 rounded-sm transition-colors hover:text-brand-500"
              >
                <Avatar name={a.user.name} color={avatarColorFor(a.user.id)} size="sm" />
                <span className="truncate text-body font-medium text-neutral-900">{a.user.name}</span>
              </Link>
              <div className="min-w-0 flex-1">
                <p className="text-body text-neutral-700">
                  {a.signal} · <span className="font-medium text-danger-500">{a.magnitude}</span>
                </p>
                <p className="mt-0.5 text-caption text-neutral-500">{a.detail}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" size="sm" onClick={() => navigate(`/users/${a.user.id}`)}>
                  <Search className="h-3 w-3 text-neutral-400" />
                  {t('clovers.investigate')}
                </Button>
                {can('clovers:adjust') && (
                  <Button variant="secondary" size="sm" onClick={() => setFreezing(a)}>
                    <Snowflake className="h-3 w-3 text-neutral-400" />
                    {t('clovers.freezeEarning')}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    toast({
                      title: t('clovers.dismissed'),
                      description: t('clovers.dismissedBody'),
                      tone: 'info',
                    })
                  }
                >
                  {t('clovers.dismiss')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <SectionHeading description={t('clovers.ledgerDescription')}>
        {t('clovers.ledgerHeading')}
      </SectionHeading>
      <CloverLedgerTable rows={cloverLedger} showUser />

      {freezing && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setFreezing(null)}
          title={t('clovers.freezeTitle')}
          requireReason
          requireTypedConfirmation={freezing.user.name}
          consequence={
            <Trans
              i18nKey="clovers.freezeConsequence"
              values={{ name: freezing.user.name }}
              components={[<strong key="0" />]}
            />
          }
          confirmLabel={t('clovers.freezeEarning')}
          onConfirm={(reason) => {
            void mutations.freezeAnomaly(freezing.id, reason);
            toast({
              title: t('clovers.frozen'),
              description: t('clovers.frozenBody', { name: freezing.user.name }),
              tone: 'success',
            });
          }}
        />
      )}
    </>
  );
}
