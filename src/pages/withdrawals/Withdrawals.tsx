import * as React from 'react';
import { Link } from 'react-router-dom';
import { CheckCheck, ExternalLink, Mail, RotateCw } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { KpiCard, KpiGrid } from '@/components/common/KpiCard';
import { DataTable, type Column } from '@/components/common/DataTable';
import { FilterBar } from '@/components/common/FilterBar';
import { DateRangePicker } from '@/components/common/DateRangePicker';
import { StatusBadge } from '@/components/common/StatusBadge';
import { MoneyValue } from '@/components/common/MoneyValue';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Avatar, CopyableId } from '@/components/ui/misc';
import { Tooltip } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

import { useAdminMutations } from '@/hooks/data/mutations';
import { useWithdrawals, useWithdrawalKpis } from '@/hooks/data';
import { withdrawalColumns } from '@/lib/datasets';
import { ExportButton } from '@/components/common/ExportButton';
import { rangeLabel } from '@/lib/date-ranges';
import { useUrlState } from '@/hooks/useUrlState';
import { formatDate, formatDuration, formatMoney, formatNumber, shortId } from '@/lib/format';
import type { Withdrawal } from '@/lib/types';

/** Screen 11 — Withdrawals & Payouts (§11). */
export default function Withdrawals() {
  const { all } = useUrlState();
  const { toast } = useToast();
  const { can } = useAuth();
  const { rows: withdrawals, isLoading, error, refetch } = useWithdrawals(all);
  const { data: kpis } = useWithdrawalKpis({ range: all.range ?? '30d', compare: all.compare === '1' });
  const kpi = (key: keyof NonNullable<typeof kpis>, fmt: (v: number) => string) => {
    const v = kpis?.[key];
    return { value: typeof v?.value === 'number' ? fmt(v.value) : '—', delta: v?.delta ?? null };
  };
  const mutations = useAdminMutations();
  const [retrying, setRetrying] = React.useState<Withdrawal | null>(null);
  const [resolving, setResolving] = React.useState<Withdrawal | null>(null);

  const filtered = React.useMemo(
    () =>
      withdrawals.filter((w) => {
        if (all.status && all.status !== 'all' && w.status !== all.status) return false;
        if (all.account && all.account !== 'all' && w.stripeAccountStatus !== all.account) return false;
        if (all.q) {
          const q = all.q.toLowerCase();
          if (!`${w.beneficiary.name} ${w.eventName} ${w.stripePayoutId ?? ''}`.toLowerCase().includes(q))
            return false;
        }
        return true;
      }),
    [all, withdrawals],
  );

  // Failed payouts pin to the top with a danger-50 row tint until resolved (§11)
  const sorted = React.useMemo(
    () => [...filtered].sort((a, b) => (a.status === 'failed' ? -1 : 0) - (b.status === 'failed' ? -1 : 0)),
    [filtered],
  );


  const elapsedHours = (w: Withdrawal) =>
    ((w.completedAt ? +new Date(w.completedAt) : Date.now()) - +new Date(w.requestedAt)) / 3_600_000;

  const columns: Column<Withdrawal>[] = [
    {
      id: 'beneficiary',
      header: 'Beneficiary',
      width: '200px',
      sortable: true,
      sortValue: (w) => w.beneficiary.name,
      cell: (w) => (
        <Link
          to={`/users/${w.beneficiary.id}`}
          data-no-row-click
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-2 rounded-sm transition-colors hover:text-brand-500"
        >
          <Avatar name={w.beneficiary.name} color={w.beneficiary.avatarColor} size="sm" />
          <span className="truncate">{w.beneficiary.name}</span>
        </Link>
      ),
    },
    {
      id: 'event',
      header: 'Event',
      sortable: true,
      sortValue: (w) => w.eventName,
      cell: (w) => (
        <Link
          to={`/events/${w.eventId}`}
          data-no-row-click
          onClick={(e) => e.stopPropagation()}
          className="truncate rounded-sm transition-colors hover:text-brand-500"
        >
          {w.eventName}
        </Link>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      numeric: true,
      sortable: true,
      sortValue: (w) => w.amount,
      cell: (w) => <MoneyValue amount={w.amount} currency={w.currency} showCurrency={false} />,
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (w) => w.status,
      cell: (w) => <StatusBadge status={w.status} />,
    },
    {
      id: 'account',
      header: 'Connect account',
      cell: (w) => <StatusBadge status={w.stripeAccountStatus} />,
    },
    {
      id: 'requestedAt',
      header: 'Requested',
      sortable: true,
      sortValue: (w) => w.requestedAt,
      cell: (w) => <span className="tnum whitespace-nowrap">{formatDate(w.requestedAt)}</span>,
    },
    {
      id: 'completedAt',
      header: 'Completed',
      sortable: true,
      defaultHidden: true,
      sortValue: (w) => w.completedAt ?? '',
      cell: (w) =>
        w.completedAt ? (
          <span className="tnum whitespace-nowrap">{formatDate(w.completedAt)}</span>
        ) : (
          <span className="text-neutral-400">—</span>
        ),
    },
    {
      id: 'elapsed',
      header: 'Elapsed',
      numeric: true,
      sortable: true,
      sortValue: (w) => elapsedHours(w),
      cell: (w) => <span className="tnum">{formatDuration(elapsedHours(w))}</span>,
    },
    {
      id: 'failureReason',
      header: 'Failure reason',
      cell: (w) =>
        w.failureReason ? (
          <Tooltip content={w.failureReason}>
            <span className="block max-w-[200px] cursor-help truncate font-mono text-caption text-danger-500">
              {w.failureReason}
            </span>
          </Tooltip>
        ) : (
          <span className="text-neutral-400">—</span>
        ),
    },
    {
      id: 'payoutId',
      header: 'Stripe payout',
      cell: (w) =>
        w.stripePayoutId ? (
          <span data-no-row-click onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1">
            <CopyableId value={w.stripePayoutId} display={shortId(w.stripePayoutId, 12)} label="Payout ID" />
            <a
              href={`https://dashboard.stripe.com/payouts/${w.stripePayoutId}`}
              target="_blank"
              rel="noreferrer"
              className="text-brand-500 hover:underline"
              aria-label="Open payout in Stripe"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </span>
        ) : (
          <span className="text-neutral-400">—</span>
        ),
    },
    {
      id: 'actions',
      header: '',
      width: '220px',
      cell: (w) =>
        w.status === 'failed' && can('payouts:write') ? (
          <div className="flex gap-1" data-no-row-click onClick={(e) => e.stopPropagation()}>
            <Button variant="secondary" size="sm" onClick={() => setRetrying(w)}>
              <RotateCw className="h-3 w-3 text-neutral-400" />
              Retry
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                toast({ title: 'Email drafted', description: w.beneficiary.name, tone: 'info' })
              }
              aria-label={`Contact ${w.beneficiary.name}`}
            >
              <Mail className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setResolving(w)}>
              <CheckCheck className="h-3 w-3" />
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Withdrawals & Payouts"
        subtitle="Money leaving the platform. Failed payouts stay pinned at the top until resolved."
        actions={
          <>
            <DateRangePicker />
            <ExportButton
              name="withdrawals"
              label="Withdrawals"
              columns={withdrawalColumns}
              rows={filtered}
              containsPii
              filterSummary={`${rangeLabel(all.range ?? '30d')} · ${filtered.length} of ${withdrawals.length} payouts`}
            />
          </>
        }
      />

      <KpiGrid columns={3} className="mb-6">
        <KpiCard
          label="Available for Withdrawal"
          {...kpi('availableForWithdrawal', (v) => formatMoney(v))}
          definition="System-wide net balance on closed events where no withdrawal has been started."
        />
        <KpiCard
          label="Requested"
          {...kpi('requested', formatNumber)}
          secondary={`${formatNumber(withdrawals.filter((w) => w.status === 'requested' || w.status === 'validated').length)} payouts`}
          definition="Payouts a beneficiary has requested but Stripe hasn't started processing."
        />
        <KpiCard
          label="Processing"
          {...kpi('processing', formatNumber)}
          secondary={`${formatNumber(withdrawals.filter((w) => w.status === 'processing').length)} payouts`}
          definition="Payouts in flight at Stripe, not yet settled in the beneficiary's bank."
        />
        <KpiCard
          label="Completed"
          {...kpi('completedInPeriod', formatNumber)}
          secondary={`${formatNumber(withdrawals.filter((w) => w.status === 'completed').length)} payouts`}
          definition="Payouts settled inside the selected range."
        />
        <KpiCard
          label="Failed"
          {...kpi('failed', formatNumber)}
          invertDelta
          accent="danger"
          secondary={`${formatNumber(withdrawals.filter((w) => w.status === 'failed').length)} payouts`}
          definition="Payouts Stripe rejected. The reason is shown verbatim in the table."
        />
        <KpiCard
          label="Median Time to Payout"
          {...kpi('medianTimeToPayoutHours', formatDuration)}
          invertDelta
          definition="Median of (completion timestamp − request timestamp) across completed payouts."
        />
      </KpiGrid>

      <FilterBar
        className="mb-4"
        searchPlaceholder="Search beneficiary, event, payout ID…"
        filters={[
          {
            id: 'status',
            label: 'Status',
            options: [
              { value: 'requested', label: 'Requested' },
              { value: 'validated', label: 'Validated' },
              { value: 'processing', label: 'Processing' },
              { value: 'completed', label: 'Completed' },
              { value: 'failed', label: 'Failed' },
            ],
          },
          {
            id: 'account',
            label: 'Connect account',
            options: [
              { value: 'verified', label: 'Verified' },
              { value: 'pending', label: 'Pending' },
              { value: 'restricted', label: 'Restricted' },
              { value: 'not_started', label: 'Not started' },
            ],
          },
        ]}
      />

      <DataTable
        columns={columns}
        rows={sorted}
        rowKey={(w) => w.id}
        loading={isLoading}
        error={error}
        onRetry={refetch}
        storageKey="withdrawals"
        rowClassName={(w) => (w.status === 'failed' ? 'bg-danger-50 hover:bg-danger-50/70' : undefined)}
        empty={{
          headline: 'No withdrawals match these filters',
          description: 'Clear the status filter, or widen the date range to see settled payouts.',
        }}
      />

      {retrying && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setRetrying(null)}
          title="Retry this payout"
          tone="primary"
          requireReason
          consequence={
            <>
              A new payout of <strong>{formatMoney(retrying.amount, retrying.currency)}</strong> will be
              created for <strong>{retrying.beneficiary.name}</strong>. The original failure was:{' '}
              <span className="font-mono text-[13px]">{retrying.failureReason}</span>. If the
              underlying bank details are still wrong, this will fail again.
            </>
          }
          confirmLabel="Retry payout"
          onConfirm={(reason) => {
            void mutations.retryPayout(retrying.id, reason);
            toast({
              title: 'Payout retry queued',
              description: `${retrying.beneficiary.name} · now processing`,
              tone: 'success',
            });
          }}
        />
      )}

      {resolving && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setResolving(null)}
          title="Mark as resolved"
          tone="primary"
          requireReason
          consequence={
            <>
              This removes <strong>{resolving.beneficiary.name}</strong>’s failed payout from the pinned
              list. It does <strong>not</strong> move any money — use it only when the payout was
              settled another way.
            </>
          }
          confirmLabel="Mark resolved"
          onConfirm={(reason) => {
            void mutations.markPayoutResolved(resolving.id, reason);
            toast({
              title: 'Marked resolved',
              description: `${resolving.beneficiary.name} · removed from the pinned list`,
              tone: 'success',
            });
          }}
        />
      )}
    </>
  );
}
