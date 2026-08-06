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
import {
  contributionSizeBuckets,
  failureReasonBreakdown,
  stats,
  timeSeries,
} from '@/lib/mock/data';
import { useStore } from '@/lib/store';
import { contributionColumns } from '@/lib/datasets';
import { ExportButton } from '@/components/common/ExportButton';
import { rangeLabel } from '@/lib/date-ranges';
import { downloadDataset } from '@/lib/export';
import { useUrlState } from '@/hooks/useUrlState';
import { formatMoney, formatMoneyCompact, formatPercent } from '@/lib/format';

/** Screen 05 — Contributions & Financials (§05). */
export default function Contributions() {
  const { all } = useUrlState();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { contributions } = useStore();

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

  const statusSeries = timeSeries.map((d) => ({
    date: d.date,
    succeeded: d.succeeded,
    pending: d.pending,
    failed: d.failed,
    cancelled: d.cancelled,
  }));

  return (
    <>
      <PageHeader
        title="Contributions & Financials"
        subtitle="Every payment into the platform, with the fee split and the reason behind each failure."
        actions={
          <>
            <DateRangePicker />
            <ExportButton
              name="contributions"
              label="Contributions"
              columns={contributionColumns}
              rows={filtered}
              containsPii
              filterSummary={`${rangeLabel(all.range ?? '30d')} · ${filtered.length} of ${contributions.length} contributions`}
            />
          </>
        }
      />

      <KpiGrid className="mb-6">
        <KpiCard
          label="Total Confirmed"
          value={formatMoney(stats.totalConfirmed)}
          delta={18.9}
          definition="Sum of contribution.amount where status = succeeded, in minor units ÷ 100."
          onDrillDown={() => navigate('/contributions?status=succeeded')}
        />
        <KpiCard
          label="Pending"
          value={formatMoney(stats.totalPending)}
          delta={-4.2}
          invertDelta
          definition="Sum of amounts for payments still processing — 3DS challenges, OXXO vouchers, SPEI transfers."
          onDrillDown={() => navigate('/contributions?status=pending')}
        />
        <KpiCard
          label="Failed"
          value={formatMoney(stats.totalFailed)}
          delta={6.4}
          invertDelta
          accent="danger"
          definition="Sum of amounts for payments Stripe declined. See the failure-reason breakdown below."
          onDrillDown={() => navigate('/contributions?status=failed')}
        />
        <KpiCard
          label="Cancelled"
          value={stats.totalCancelled > 0 ? formatMoney(stats.totalCancelled) : '—'}
          definition="Backend gap: ContributionStatus is currently pending | succeeded | failed. Until cancelled/refunded is added to the enum this renders — rather than a misleading $0.00."
          onDrillDown={() => navigate('/contributions?status=cancelled')}
        />
        <KpiCard
          label="Average Contribution"
          value={formatMoney(stats.avgContribution)}
          delta={2.8}
          definition="Mean of confirmed contribution amounts in the range."
        />
        <KpiCard
          label="Median Contribution"
          value={formatMoney(stats.medianContribution)}
          delta={0}
          definition="50th percentile of confirmed contribution amounts — resistant to a single large outlier."
        />
        <KpiCard
          label="Failure Rate"
          value={formatPercent(stats.failureRate)}
          delta={1.9}
          deltaUnit="pp"
          invertDelta
          accent="danger"
          definition="Failed contributions ÷ all contribution attempts × 100 in the selected range."
          onDrillDown={() => navigate('/contributions?status=failed')}
        />
        <KpiCard
          label="Total Fees Collected"
          value={formatMoney(stats.totalFees)}
          delta={17.2}
          definition="Platform fee + Stripe fee across confirmed contributions. Hover any row's Fee cell to see the split."
        />
      </KpiGrid>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard
          title="Volume over time"
          subtitle="Stacked by payment status"
          className="xl:col-span-2"
          legend={[
            { label: 'Succeeded', color: CHART_COLORS[2] },
            { label: 'Pending', color: CHART_COLORS[3] },
            { label: 'Failed', color: 'rgb(var(--danger-500))' },
            { label: 'Cancelled', color: CHART_COLORS[6] },
          ]}
          tableData={{
            columns: ['Date', 'Succeeded', 'Pending', 'Failed', 'Cancelled'],
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
              <Bar dataKey="succeeded" name="Succeeded" stackId="s" fill={CHART_COLORS[2]} isAnimationActive={false} />
              <Bar dataKey="pending" name="Pending" stackId="s" fill={CHART_COLORS[3]} isAnimationActive={false} />
              <Bar dataKey="failed" name="Failed" stackId="s" fill="rgb(var(--danger-500))" isAnimationActive={false} />
              <Bar
                dataKey="cancelled"
                name="Cancelled"
                stackId="s"
                fill={CHART_COLORS[6]}
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Contribution size distribution"
          subtitle="Confirmed contributions by amount bucket"
          tableData={{
            columns: ['Bucket', 'Contributions'],
            rows: contributionSizeBuckets.map((b) => [b.bucket, b.count]),
          }}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={contributionSizeBuckets}
              layout="vertical"
              margin={{ top: 8, right: 16, bottom: 0, left: 8 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} />
              <YAxis dataKey="bucket" type="category" tickLine={false} axisLine={false} width={88} />
              <RTooltip content={<ChartTooltip />} cursor={{ fill: 'rgb(var(--neutral-100))' }} />
              <Bar dataKey="count" name="Contributions" radius={[0, 2, 2, 0]} isAnimationActive={false}>
                {contributionSizeBuckets.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[0]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mb-6">
        <ChartCard
          title="Failure reasons"
          subtitle="From Stripe decline codes — the actionable half of the failure rate"
          tableData={{
            columns: ['Decline code', 'Count'],
            rows: failureReasonBreakdown.map((f) => [f.reason, f.count]),
          }}
          minHeight={200}
        >
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={failureReasonBreakdown}
              layout="vertical"
              margin={{ top: 0, right: 24, bottom: 0, left: 8 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} />
              <YAxis dataKey="reason" type="category" tickLine={false} axisLine={false} width={140} />
              <RTooltip content={<ChartTooltip />} cursor={{ fill: 'rgb(var(--neutral-100))' }} />
              <Bar dataKey="count" name="Failures" radius={[0, 2, 2, 0]} isAnimationActive={false}>
                {failureReasonBreakdown.map((_, i) => (
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
          <strong>Backend gap:</strong> the brief asks for a cancelled contribution total, but{' '}
          <code className="font-mono">ContributionStatus</code> is currently{' '}
          <code className="font-mono">pending | succeeded | failed</code>. The UI is designed for four
          states and renders — until <code className="font-mono">cancelled</code> /{' '}
          <code className="font-mono">refunded</code> exist in the enum.
        </p>
      </div>

      <FilterBar
        className="mb-4"
        searchPlaceholder="Search contributor, event, PaymentIntent…"
        filters={[
          {
            id: 'status',
            label: 'Status',
            options: [
              { value: 'succeeded', label: 'Succeeded' },
              { value: 'pending', label: 'Pending' },
              { value: 'failed', label: 'Failed' },
              { value: 'cancelled', label: 'Cancelled' },
            ],
          },
          {
            id: 'guest',
            label: 'Contributor',
            options: [
              { value: 'guest', label: 'Guest' },
              { value: 'registered', label: 'Registered' },
            ],
          },
          {
            id: 'amount',
            label: 'Amount',
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
            label: 'Fee payer',
            options: [
              { value: 'contributor', label: 'Contributor' },
              { value: 'beneficiary', label: 'Beneficiary' },
            ],
          },
          {
            id: 'method',
            label: 'Method',
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
        bulkActions={(selected, clear) => (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const file = downloadDataset('contributions-selection', contributionColumns, selected, 'csv');
              toast({
                title: 'Download started',
                description: `${file} · ${selected.length} contributions`,
                tone: 'success',
              });
              clear();
            }}
          >
            <Download className="h-4 w-4 text-neutral-400" />
            Export CSV
          </Button>
        )}
      />
      <p className="mt-3 text-caption text-neutral-500">
        Total in view:{' '}
        <span className="tnum font-medium text-neutral-900">
          {formatMoneyCompact(filtered.reduce((a, c) => a + c.amount, 0))}
        </span>{' '}
        across {filtered.length.toLocaleString()} records.
      </p>
    </>
  );
}
