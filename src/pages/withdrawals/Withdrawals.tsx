import { Trans, useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      header: t('withdrawals.table.beneficiary'),
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
      header: t('withdrawals.table.event'),
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
      header: t('withdrawals.table.amount'),
      numeric: true,
      sortable: true,
      sortValue: (w) => w.amount,
      cell: (w) => <MoneyValue amount={w.amount} currency={w.currency} showCurrency={false} />,
    },
    {
      id: 'status',
      header: t('fields.status'),
      sortable: true,
      sortValue: (w) => w.status,
      cell: (w) => <StatusBadge status={w.status} />,
    },
    {
      id: 'account',
      header: t('withdrawals.table.connectAccount'),
      cell: (w) => <StatusBadge status={w.stripeAccountStatus} />,
    },
    {
      id: 'requestedAt',
      header: t('withdrawals.table.requested'),
      sortable: true,
      sortValue: (w) => w.requestedAt,
      cell: (w) => <span className="tnum whitespace-nowrap">{formatDate(w.requestedAt)}</span>,
    },
    {
      id: 'completedAt',
      header: t('withdrawals.table.completed'),
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
      header: t('withdrawals.table.elapsed'),
      numeric: true,
      sortable: true,
      sortValue: (w) => elapsedHours(w),
      cell: (w) => <span className="tnum">{formatDuration(elapsedHours(w))}</span>,
    },
    {
      id: 'failureReason',
      header: t('withdrawals.table.failureReason'),
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
      header: t('withdrawals.table.stripePayout'),
      cell: (w) =>
        w.stripePayoutId ? (
          <span data-no-row-click onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1">
            <CopyableId value={w.stripePayoutId} display={shortId(w.stripePayoutId, 12)} label={t('withdrawals.table.payoutId')} />
            <a
              href={`https://dashboard.stripe.com/payouts/${w.stripePayoutId}`}
              target="_blank"
              rel="noreferrer"
              className="text-brand-500 hover:underline"
              aria-label={t('withdrawals.table.openInStripe')}
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
              {t('withdrawals.table.retry')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                toast({
                  title: t('withdrawals.table.emailDrafted'),
                  description: w.beneficiary.name,
                  tone: 'info',
                })
              }
              aria-label={t('withdrawals.table.contact', { name: w.beneficiary.name })}
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
        title={t('withdrawals.title')}
        subtitle={t('withdrawals.subtitle')}
        actions={
          <>
            <DateRangePicker />
            <ExportButton
              name="withdrawals"
              label={t('withdrawals.exportLabel')}
              columns={withdrawalColumns}
              rows={filtered}
              containsPii
              filterSummary={t('withdrawals.filterSummary', {
                range: t(rangeLabel(all.range ?? '30d')),
                shown: filtered.length,
                total: withdrawals.length,
              })}
            />
          </>
        }
      />

      <KpiGrid columns={3} className="mb-6">
        <KpiCard
          label={t('withdrawals.kpi.available')}
          {...kpi('availableForWithdrawal', (v) => formatMoney(v))}
          definition={t('withdrawals.kpi.availableDef')}
        />
        <KpiCard
          label={t('withdrawals.kpi.requested')}
          {...kpi('requested', formatNumber)}
          secondary={t('withdrawals.kpi.payoutCount', {
            count: withdrawals.filter(
              (w) => w.status === 'requested' || w.status === 'validated',
            ).length,
          })}
          definition={t('withdrawals.kpi.requestedDef')}
        />
        <KpiCard
          label={t('withdrawals.kpi.processing')}
          {...kpi('processing', formatNumber)}
          secondary={t('withdrawals.kpi.payoutCount', {
            count: withdrawals.filter((w) => w.status === 'processing').length,
          })}
          definition={t('withdrawals.kpi.processingDef')}
        />
        <KpiCard
          label={t('withdrawals.kpi.completed')}
          {...kpi('completedInPeriod', formatNumber)}
          secondary={t('withdrawals.kpi.payoutCount', {
            count: withdrawals.filter((w) => w.status === 'completed').length,
          })}
          definition={t('withdrawals.kpi.completedDef')}
        />
        <KpiCard
          label={t('withdrawals.kpi.failed')}
          {...kpi('failed', formatNumber)}
          invertDelta
          accent="danger"
          secondary={t('withdrawals.kpi.payoutCount', {
            count: withdrawals.filter((w) => w.status === 'failed').length,
          })}
          definition={t('withdrawals.kpi.failedDef')}
        />
        <KpiCard
          label={t('withdrawals.kpi.medianTime')}
          {...kpi('medianTimeToPayoutHours', formatDuration)}
          invertDelta
          definition={t('withdrawals.kpi.medianTimeDef')}
        />
      </KpiGrid>

      <FilterBar
        className="mb-4"
        searchPlaceholder={t('withdrawals.searchPlaceholder')}
        filters={[
          {
            id: 'status',
            label: t('fields.status'),
            options: ['requested', 'validated', 'processing', 'completed', 'failed'].map((s) => ({
              value: s,
              label: t(`status.${s}`),
            })),
          },
          {
            id: 'account',
            label: t('withdrawals.table.connectAccount'),
            options: ['verified', 'pending', 'restricted', 'not_started'].map((s) => ({
              value: s,
              label: t(`status.${s}`),
            })),
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
          headline: t('withdrawals.table.empty'),
          description: t('withdrawals.table.emptyBody'),
        }}
      />

      {retrying && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setRetrying(null)}
          title={t('withdrawals.retryTitle')}
          tone="primary"
          requireReason
          consequence={
            <Trans
              i18nKey="withdrawals.retryConsequence"
              values={{
                amount: formatMoney(retrying.amount, retrying.currency),
                name: retrying.beneficiary.name,
                reason: retrying.failureReason,
              }}
              components={[
                <span key="0" />,
                <strong key="1" />,
                <span key="2" />,
                <strong key="3" />,
                <span key="4" />,
                <span key="5" className="font-mono text-[13px]" />,
              ]}
            />
          }
          confirmLabel={t('withdrawals.retryConfirm')}
          onConfirm={(reason) => {
            void mutations.retryPayout(retrying.id, reason);
            toast({
              title: t('withdrawals.retryQueued'),
              description: t('withdrawals.retryQueuedBody', { name: retrying.beneficiary.name }),
              tone: 'success',
            });
          }}
        />
      )}

      {resolving && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setResolving(null)}
          title={t('withdrawals.resolveTitle')}
          tone="primary"
          requireReason
          consequence={
            <Trans
              i18nKey="withdrawals.resolveConsequence"
              values={{ name: resolving.beneficiary.name }}
              components={[
                <span key="0" />,
                <strong key="1" />,
                <span key="2" />,
                <strong key="3" />,
              ]}
            />
          }
          confirmLabel={t('withdrawals.resolveConfirm')}
          onConfirm={(reason) => {
            void mutations.markPayoutResolved(resolving.id, reason);
            toast({
              title: t('withdrawals.resolved'),
              description: t('withdrawals.resolvedBody', { name: resolving.beneficiary.name }),
              tone: 'success',
            });
          }}
        />
      )}
    </>
  );
}
