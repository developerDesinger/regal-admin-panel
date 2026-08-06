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
import { cloverAnomalies, earnActionBreakdown, stats, timeSeries } from '@/lib/mock/data';
import { actions, useStore } from '@/lib/store';
import { cloverColumns } from '@/lib/datasets';
import { ExportButton } from '@/components/common/ExportButton';
import { rangeLabel } from '@/lib/date-ranges';
import { useUrlState } from '@/hooks/useUrlState';
import { formatNumber, formatPercent } from '@/lib/format';

/** Screen 10 — Clovers (§10). */
export default function Clovers() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { admin, can } = useAuth();
  const { cloverLedger, giftCards } = useStore();
  const { all } = useUrlState();
  const [freezing, setFreezing] = React.useState<(typeof cloverAnomalies)[number] | null>(null);

  const burnRate = (stats.cloversRedeemed / Math.max(1, stats.cloversEarned)) * 100;

  const redemptionByDesign = giftCards
    .filter((c) => c.cloverCost > 0)
    .map((c) => ({ name: c.name, clovers: c.cloverCost * c.unlocks, unlocks: c.unlocks }))
    .sort((a, b) => b.clovers - a.clovers)
    .slice(0, 8);

  return (
    <>
      <PageHeader
        title="Clovers"
        subtitle="The in-app reward currency: what mints it, what burns it, and what the platform still owes."
        actions={
          <>
            <DateRangePicker />
            <ExportButton
              name="clover-ledger"
              label="Clover ledger"
              columns={cloverColumns}
              rows={cloverLedger}
              filterSummary={`${rangeLabel(all.range ?? '30d')} · ${cloverLedger.length} transactions`}
            />
          </>
        }
      />

      <KpiGrid className="mb-6">
        <KpiCard
          label="Clovers Earned"
          value={formatNumber(stats.cloversEarned)}
          delta={13.7}
          accent="secondary"
          definition="Sum of positive clover ledger amounts in the range — every earn action combined."
        />
        <KpiCard
          label="Clovers Redeemed"
          value={formatNumber(stats.cloversRedeemed)}
          delta={21.4}
          accent="secondary"
          definition="Absolute sum of negative ledger amounts from card unlocks in the range."
        />
        <KpiCard
          label="Outstanding Balance"
          value={formatNumber(stats.outstandingClovers)}
          delta={4.9}
          invertDelta
          definition="System-wide unspent clover balance — the platform's outstanding liability."
        />
        <KpiCard
          label="Redemption Rate"
          value={formatPercent(stats.cloverRedemptionRate)}
          delta={4.2}
          deltaUnit="pp"
          definition="Users who redeemed ≥1 premium card ÷ users holding enough clovers to redeem one × 100."
        />
        <KpiCard
          label="Clover Burn Rate"
          value={formatPercent(burnRate)}
          delta={6.1}
          deltaUnit="pp"
          definition="Clovers redeemed ÷ clovers earned × 100. Below 100% means the liability is still growing."
        />
        <KpiCard
          label="Repeat Redemption"
          value={formatPercent(18.3)}
          delta={2.7}
          deltaUnit="pp"
          definition="Users who have unlocked 2 or more premium designs ÷ all users with ≥1 unlock × 100."
        />
        <KpiCard
          label="Premium Card Download Rate"
          value={formatPercent(64.8)}
          delta={-2.2}
          deltaUnit="pp"
          accent="accent"
          definition="Premium cards downloaded at least once ÷ premium cards unlocked × 100."
          onDrillDown={() => navigate('/cards/analytics')}
        />
        <KpiCard
          label="Anomalies flagged"
          value={formatNumber(cloverAnomalies.length)}
          accent="danger"
          definition="Users whose earn rate, adjustment count or redemption velocity exceeds the configured threshold."
          onDrillDown={() => navigate('/alerts?type=clover_anomaly')}
        />
      </KpiGrid>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Earned vs redeemed"
          subtitle="Daily clover flow"
          legend={[
            { label: 'Earned', color: CHART_COLORS[3] },
            { label: 'Redeemed', color: CHART_COLORS[4] },
          ]}
          tableData={{
            columns: ['Date', 'Earned', 'Redeemed'],
            rows: timeSeries.map((d) => [d.date, d.earned, d.redeemed]),
          }}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={timeSeries} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
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
              <Bar dataKey="earned" name="Earned" fill={CHART_COLORS[3]} radius={[2, 2, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="redeemed" name="Redeemed" fill={CHART_COLORS[4]} radius={[2, 2, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Outstanding balance trend"
          subtitle="The platform's clover liability curve"
          legend={[{ label: 'Outstanding balance', color: CHART_COLORS[0] }]}
          tableData={{
            columns: ['Date', 'Outstanding'],
            rows: timeSeries.map((d) => [d.date, d.outstanding]),
          }}
        >
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={timeSeries} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
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
                dataKey="outstanding"
                name="Outstanding balance"
                stroke={CHART_COLORS[0]}
                strokeWidth={2}
                fill="url(#liabilityFill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Earn actions breakdown"
          subtitle="Which behaviors mint the most clovers"
          tableData={{
            columns: ['Action', 'Clovers'],
            rows: earnActionBreakdown.map((a) => [a.action, a.clovers]),
          }}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={earnActionBreakdown}
              layout="vertical"
              margin={{ top: 8, right: 24, bottom: 0, left: 8 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} />
              <YAxis dataKey="action" type="category" tickLine={false} axisLine={false} width={130} />
              <RTooltip content={<ChartTooltip />} cursor={{ fill: 'rgb(var(--neutral-100))' }} />
              <Bar dataKey="clovers" name="Clovers minted" radius={[0, 2, 2, 0]} isAnimationActive={false}>
                {earnActionBreakdown.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[3]} fillOpacity={1 - i * 0.11} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Redemption by card design"
          subtitle="Clovers burned per premium design"
          tableData={{
            columns: ['Design', 'Clovers', 'Unlocks'],
            rows: redemptionByDesign.map((d) => [d.name, d.clovers, d.unlocks]),
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
              <Bar dataKey="clovers" name="Clovers burned" radius={[0, 2, 2, 0]} isAnimationActive={false}>
                {redemptionByDesign.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[4]} fillOpacity={1 - i * 0.09} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Anomaly panel — satisfies the brief's clover anomaly alert (§10) */}
      <SectionHeading description="Users whose earn rate, adjustment count or redemption velocity exceeds the configured threshold. Thresholds are set in Settings.">
        Anomaly review
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
                <Avatar name={a.user.name} color={a.user.avatarColor} size="sm" />
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
                  Investigate
                </Button>
                {can('clovers:adjust') && (
                  <Button variant="secondary" size="sm" onClick={() => setFreezing(a)}>
                    <Snowflake className="h-3 w-3 text-neutral-400" />
                    Freeze earning
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    toast({
                      title: 'Signal dismissed',
                      description: 'Feeds threshold tuning in Settings.',
                      tone: 'info',
                    })
                  }
                >
                  Dismiss
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <SectionHeading description="Every earn, redemption and manual adjustment, newest first.">
        Clover ledger
      </SectionHeading>
      <CloverLedgerTable rows={cloverLedger} showUser />

      {freezing && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setFreezing(null)}
          title="Freeze clover earning"
          requireReason
          requireTypedConfirmation={freezing.user.name}
          consequence={
            <>
              <strong>{freezing.user.name}</strong> will stop accruing clovers from any action. Their
              existing balance stays spendable and no clovers are removed. This is an authorized
              operational review measure and is written to the audit trail.
            </>
          }
          confirmLabel="Freeze earning"
          onConfirm={(reason) => {
            actions.adjustClovers(admin, freezing.user.id, 0, reason);
            toast({
              title: 'Clover earning frozen',
              description: `${freezing.user.name} · recorded in the audit trail`,
              tone: 'success',
            });
          }}
        />
      )}
    </>
  );
}
