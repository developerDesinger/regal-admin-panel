import { useTranslation } from 'react-i18next';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { DataTable, type Column } from '@/components/common/DataTable';
import { DrillDownDrawer } from '@/components/common/DrillDownDrawer';
import { StatusBadge, Chip } from '@/components/common/StatusBadge';
import { MoneyValue } from '@/components/common/MoneyValue';
import { DetailRow } from '@/components/common/PageHeader';
import { Avatar, CopyableId } from '@/components/ui/misc';
import { Tooltip } from '@/components/ui/tooltip';
import { formatDate, formatDateTime, formatMoney, shortId } from '@/lib/format';
import type { Contribution } from '@/lib/types';

/**
 * The contributions table (§05), reused by the Event detail Contributions tab.
 * Row click opens a drawer with the full record including the raw webhook
 * payload for support triage.
 */
export function ContributionsTable({
  rows,
  storageKey = 'contributions',
  hideEventColumn,
  toolbar,
  bulkActions,
  loading,
  error,
  onRetry,
}: {
  rows: Contribution[];
  storageKey?: string;
  hideEventColumn?: boolean;
  toolbar?: React.ReactNode;
  bulkActions?: (selected: Contribution[], clear: () => void) => React.ReactNode;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  const [detail, setDetail] = React.useState<Contribution | null>(null);

  const columns: Column<Contribution>[] = [
    {
      id: 'contributor',
      header: t('contributions.table.contributor'),
      width: '200px',
      sortable: true,
      sortValue: (c) => c.contributor?.name ?? c.guestName ?? '',
      cell: (c) =>
        c.isGuest ? (
          <div className="flex items-center gap-2">
            <Chip>{t('contributions.table.guest')}</Chip>
            <span className="min-w-0 truncate">{c.guestName}</span>
          </div>
        ) : (
          <Link
            to={`/users/${c.contributor!.id}`}
            data-no-row-click
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 rounded-sm transition-colors hover:text-brand-500"
          >
            <Avatar name={c.contributor!.name} color={c.contributor!.avatarColor} size="sm" />
            <span className="truncate">{c.contributor!.name}</span>
          </Link>
        ),
    },
    ...(hideEventColumn
      ? []
      : ([
          {
            id: 'event',
            header: t('fields.event'),
            sortable: true,
            sortValue: (c: Contribution) => c.eventName,
            cell: (c: Contribution) => (
              <Link
                to={`/events/${c.eventId}`}
                data-no-row-click
                onClick={(e) => e.stopPropagation()}
                className="truncate rounded-sm transition-colors hover:text-brand-500"
              >
                {c.eventName}
              </Link>
            ),
          },
        ] as Column<Contribution>[])),
    {
      id: 'amount',
      header: t('contributions.table.amount'),
      numeric: true,
      sortable: true,
      sortValue: (c) => c.amount,
      cell: (c) => <MoneyValue amount={c.amount} currency={c.currency} showCurrency={false} />,
    },
    {
      id: 'fee',
      header: t('contributions.table.fee'),
      numeric: true,
      sortable: true,
      sortValue: (c) => c.platformFee + c.stripeFee,
      cell: (c) => (
        <Tooltip
          content={t('contributions.table.feeTooltip', {
            platform: formatMoney(c.platformFee, c.currency),
            stripe: formatMoney(c.stripeFee, c.currency),
          })}
        >
          <span className="cursor-help underline decoration-neutral-300 decoration-dotted underline-offset-4">
            <MoneyValue amount={c.platformFee + c.stripeFee} currency={c.currency} showCurrency={false} />
          </span>
        </Tooltip>
      ),
    },
    {
      id: 'totalCharged',
      header: t('contributions.table.totalCharged'),
      numeric: true,
      sortable: true,
      sortValue: (c) => c.totalCharged,
      cell: (c) => <MoneyValue amount={c.totalCharged} currency={c.currency} showCurrency={false} />,
    },
    {
      id: 'credited',
      header: t('contributions.table.credited'),
      numeric: true,
      sortable: true,
      defaultHidden: true,
      sortValue: (c) => c.creditedAmount,
      cell: (c) => <MoneyValue amount={c.creditedAmount} currency={c.currency} showCurrency={false} />,
    },
    {
      id: 'status',
      header: t('fields.status'),
      sortable: true,
      sortValue: (c) => c.status,
      cell: (c) => <StatusBadge status={c.status} />,
    },
    {
      id: 'feePayer',
      header: t('contributions.table.feePayer'),
      defaultHidden: true,
      cell: (c) => <Chip>{c.feePayer}</Chip>,
    },
    {
      id: 'card',
      header: t('contributions.table.card'),
      defaultHidden: true,
      cell: (c) => (c.cardSlug ? <Chip tone="accent">{c.cardSlug}</Chip> : <span className="text-neutral-400">—</span>),
    },
    {
      id: 'revealed',
      header: t('contributions.table.revealed'),
      defaultHidden: true,
      cell: (c) => (
        <StatusBadge status={c.revealed ? 'completed' : 'pending'} label={c.revealed ? t('common.yes') : t('common.no')} />
      ),
    },
    {
      id: 'createdAt',
      header: t('contributions.table.createdAt'),
      sortable: true,
      sortValue: (c) => c.createdAt,
      cell: (c) => <span className="tnum whitespace-nowrap">{formatDate(c.createdAt)}</span>,
    },
    {
      id: 'pi',
      header: t('contributions.table.paymentIntent'),
      width: '190px',
      cell: (c) => (
        <span data-no-row-click onClick={(e) => e.stopPropagation()}>
          <CopyableId
            value={c.stripePaymentIntentId}
            display={shortId(c.stripePaymentIntentId, 14)}
            label={t('contributions.table.paymentIntentId')}
          />
        </span>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(c) => c.id}
        loading={loading}
        error={error}
        onRetry={onRetry}
        onRowClick={(c) => setDetail(c)}
        storageKey={storageKey}
        initialSort={{ id: 'createdAt', dir: 'desc' }}
        toolbar={toolbar}
        bulkActions={bulkActions}
        empty={{
          headline: t('contributions.table.empty'),
          description: t('contributions.table.emptyBody'),
        }}
      />

      {detail && (
        <DrillDownDrawer
          open
          onOpenChange={(o) => !o && setDetail(null)}
          title={formatMoney(detail.amount, detail.currency)}
          subtitle={detail.eventName}
          fullPageHref={`/events/${detail.eventId}/contributions`}
        >
          <div className="space-y-6 p-6">
            <div className="flex items-center gap-3">
              <StatusBadge status={detail.status} />
              <Chip>{detail.paymentMethod}</Chip>
              {detail.isGuest && <Chip tone="brand">{t('contributions.table.guestCheckout')}</Chip>}
            </div>

            {detail.failureReason && (
              <div className="rounded-md border border-danger-500/20 bg-danger-50 p-3">
                <p className="text-caption font-medium text-danger-500">
                  {t('contributions.table.declineReason')}
                </p>
                <p className="mt-1 font-mono text-[13px] leading-5 text-danger-500">
                  {detail.failureReason}
                </p>
              </div>
            )}

            <section>
              <h3 className="mb-2 text-card-title text-neutral-700">
                {t('contributions.table.money')}
              </h3>
              <dl className="divide-y divide-neutral-200 rounded-md border border-neutral-200 px-3">
                <DetailRow label={t('contributions.table.contributionAmount')}>
                  <MoneyValue amount={detail.amount} currency={detail.currency} />
                </DetailRow>
                <DetailRow label={t('contributions.table.platformFee')}>
                  <MoneyValue amount={detail.platformFee} currency={detail.currency} />
                </DetailRow>
                <DetailRow label={t('contributions.table.stripeFee')}>
                  <MoneyValue amount={detail.stripeFee} currency={detail.currency} />
                </DetailRow>
                <DetailRow label={t('contributions.table.totalCharged')}>
                  <MoneyValue amount={detail.totalCharged} currency={detail.currency} emphasis="strong" />
                </DetailRow>
                <DetailRow label={t('contributions.table.creditedToBeneficiary')}>
                  <MoneyValue amount={detail.creditedAmount} currency={detail.currency} emphasis="strong" />
                </DetailRow>
                <DetailRow label={t('contributions.table.feePayer')}>
                  <Chip>{detail.feePayer}</Chip>
                </DetailRow>
              </dl>
            </section>

            <section>
              <h3 className="mb-2 text-card-title text-neutral-700">
                {t('contributions.table.record')}
              </h3>
              <dl className="divide-y divide-neutral-200 rounded-md border border-neutral-200 px-3">
                <DetailRow label={t('contributions.table.contributionId')}>
                  <CopyableId value={detail.id} />
                </DetailRow>
                <DetailRow label={t('contributions.table.stripePaymentIntent')}>
                  <span className="inline-flex items-center gap-1">
                    <CopyableId value={detail.stripePaymentIntentId} />
                    <a
                      href={`https://dashboard.stripe.com/payments/${detail.stripePaymentIntentId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-500 hover:underline"
                      aria-label={t('contributions.table.openInStripe')}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </span>
                </DetailRow>
                <DetailRow label={t('contributions.table.contributor')}>
                  {detail.isGuest ? `${detail.guestName} (${detail.guestEmail})` : detail.contributor!.name}
                </DetailRow>
                <DetailRow label={t('contributions.table.createdAt')}>
                  <span className="tnum">{formatDateTime(detail.createdAt)}</span>
                </DetailRow>
                <DetailRow label={t('contributions.table.message')}>
                  {detail.message || '—'}
                </DetailRow>
              </dl>
            </section>

            <section>
              <h3 className="mb-2 text-card-title text-neutral-700">
                {t('contributions.table.rawPayload')}
              </h3>
              <pre className="overflow-x-auto rounded-md border border-neutral-200 bg-neutral-50 p-3 font-mono text-[13px] leading-5 text-neutral-700">
                {JSON.stringify(
                  {
                    id: `evt_${detail.id}`,
                    type:
                      detail.status === 'succeeded'
                        ? 'payment_intent.succeeded'
                        : detail.status === 'failed'
                          ? 'payment_intent.payment_failed'
                          : 'payment_intent.processing',
                    data: {
                      object: {
                        id: detail.stripePaymentIntentId,
                        amount: detail.totalCharged,
                        currency: detail.currency.toLowerCase(),
                        status: detail.status,
                        metadata: {
                          collectionRef: detail.eventId,
                          feePayer: detail.feePayer,
                          isGuest: detail.isGuest,
                        },
                        last_payment_error: detail.failureReason
                          ? { message: detail.failureReason }
                          : null,
                      },
                    },
                  },
                  null,
                  2,
                )}
              </pre>
            </section>
          </div>
        </DrillDownDrawer>
      )}
    </>
  );
}
