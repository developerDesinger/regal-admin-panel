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
  const [detail, setDetail] = React.useState<Contribution | null>(null);

  const columns: Column<Contribution>[] = [
    {
      id: 'contributor',
      header: 'Contributor',
      width: '200px',
      sortable: true,
      sortValue: (c) => c.contributor?.name ?? c.guestName ?? '',
      cell: (c) =>
        c.isGuest ? (
          <div className="flex items-center gap-2">
            <Chip>Guest</Chip>
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
            header: 'Event',
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
      header: 'Amount',
      numeric: true,
      sortable: true,
      sortValue: (c) => c.amount,
      cell: (c) => <MoneyValue amount={c.amount} currency={c.currency} showCurrency={false} />,
    },
    {
      id: 'fee',
      header: 'Fee',
      numeric: true,
      sortable: true,
      sortValue: (c) => c.platformFee + c.stripeFee,
      cell: (c) => (
        <Tooltip
          content={`Platform ${formatMoney(c.platformFee, c.currency)} · Stripe ${formatMoney(c.stripeFee, c.currency)}`}
        >
          <span className="cursor-help underline decoration-neutral-300 decoration-dotted underline-offset-4">
            <MoneyValue amount={c.platformFee + c.stripeFee} currency={c.currency} showCurrency={false} />
          </span>
        </Tooltip>
      ),
    },
    {
      id: 'totalCharged',
      header: 'Total charged',
      numeric: true,
      sortable: true,
      sortValue: (c) => c.totalCharged,
      cell: (c) => <MoneyValue amount={c.totalCharged} currency={c.currency} showCurrency={false} />,
    },
    {
      id: 'credited',
      header: 'Credited',
      numeric: true,
      sortable: true,
      defaultHidden: true,
      sortValue: (c) => c.creditedAmount,
      cell: (c) => <MoneyValue amount={c.creditedAmount} currency={c.currency} showCurrency={false} />,
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (c) => c.status,
      cell: (c) => <StatusBadge status={c.status} />,
    },
    {
      id: 'feePayer',
      header: 'Fee payer',
      defaultHidden: true,
      cell: (c) => <Chip>{c.feePayer}</Chip>,
    },
    {
      id: 'card',
      header: 'Card',
      defaultHidden: true,
      cell: (c) => (c.cardSlug ? <Chip tone="accent">{c.cardSlug}</Chip> : <span className="text-neutral-400">—</span>),
    },
    {
      id: 'revealed',
      header: 'Revealed',
      defaultHidden: true,
      cell: (c) => (
        <StatusBadge status={c.revealed ? 'completed' : 'pending'} label={c.revealed ? 'Yes' : 'No'} />
      ),
    },
    {
      id: 'createdAt',
      header: 'Created at',
      sortable: true,
      sortValue: (c) => c.createdAt,
      cell: (c) => <span className="tnum whitespace-nowrap">{formatDate(c.createdAt)}</span>,
    },
    {
      id: 'pi',
      header: 'PaymentIntent',
      width: '190px',
      cell: (c) => (
        <span data-no-row-click onClick={(e) => e.stopPropagation()}>
          <CopyableId
            value={c.stripePaymentIntentId}
            display={shortId(c.stripePaymentIntentId, 14)}
            label="PaymentIntent ID"
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
          headline: 'No contributions match these filters',
          description:
            'Widen the date range or clear the status filter. Failed payments are excluded unless you select them explicitly.',
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
              {detail.isGuest && <Chip tone="brand">Guest checkout</Chip>}
            </div>

            {detail.failureReason && (
              <div className="rounded-md border border-danger-500/20 bg-danger-50 p-3">
                <p className="text-caption font-medium text-danger-500">Decline reason</p>
                <p className="mt-1 font-mono text-[13px] leading-5 text-danger-500">
                  {detail.failureReason}
                </p>
              </div>
            )}

            <section>
              <h3 className="mb-2 text-card-title text-neutral-700">Money</h3>
              <dl className="divide-y divide-neutral-200 rounded-md border border-neutral-200 px-3">
                <DetailRow label="Contribution amount">
                  <MoneyValue amount={detail.amount} currency={detail.currency} />
                </DetailRow>
                <DetailRow label="Platform fee">
                  <MoneyValue amount={detail.platformFee} currency={detail.currency} />
                </DetailRow>
                <DetailRow label="Stripe fee">
                  <MoneyValue amount={detail.stripeFee} currency={detail.currency} />
                </DetailRow>
                <DetailRow label="Total charged">
                  <MoneyValue amount={detail.totalCharged} currency={detail.currency} emphasis="strong" />
                </DetailRow>
                <DetailRow label="Credited to beneficiary">
                  <MoneyValue amount={detail.creditedAmount} currency={detail.currency} emphasis="strong" />
                </DetailRow>
                <DetailRow label="Fee payer">
                  <Chip>{detail.feePayer}</Chip>
                </DetailRow>
              </dl>
            </section>

            <section>
              <h3 className="mb-2 text-card-title text-neutral-700">Record</h3>
              <dl className="divide-y divide-neutral-200 rounded-md border border-neutral-200 px-3">
                <DetailRow label="Contribution ID">
                  <CopyableId value={detail.id} />
                </DetailRow>
                <DetailRow label="Stripe PaymentIntent">
                  <span className="inline-flex items-center gap-1">
                    <CopyableId value={detail.stripePaymentIntentId} />
                    <a
                      href={`https://dashboard.stripe.com/payments/${detail.stripePaymentIntentId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-500 hover:underline"
                      aria-label="Open in Stripe dashboard"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </span>
                </DetailRow>
                <DetailRow label="Contributor">
                  {detail.isGuest ? `${detail.guestName} (${detail.guestEmail})` : detail.contributor!.name}
                </DetailRow>
                <DetailRow label="Created at">
                  <span className="tnum">{formatDateTime(detail.createdAt)}</span>
                </DetailRow>
                <DetailRow label="Message">{detail.message || '—'}</DetailRow>
              </dl>
            </section>

            <section>
              <h3 className="mb-2 text-card-title text-neutral-700">Raw webhook payload</h3>
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
