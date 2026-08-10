import { Trans, useTranslation } from 'react-i18next';
import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { KeyRound, ShieldAlert, UserMinus, UserPlus } from 'lucide-react';
import { PageHeader, SectionHeading } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusBadge, Chip } from '@/components/common/StatusBadge';
import { MoneyValue, CloverValue } from '@/components/common/MoneyValue';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ContributionsTable } from '@/pages/contributions/ContributionsTable';
import { ActivityLog } from '@/pages/events/EventDetail';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, CopyableId } from '@/components/ui/misc';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

import { useAdminMutations } from '@/hooks/data/mutations';
import {
  useUser,
  useUserEvents,
  useUserContributions,
  useUserClovers,
  useUserActivity,
  useUserCards,
} from '@/hooks/data';
import {
  formatDate,
  formatDateTime,
  formatDuration,
  formatMoney,
  formatPercent,
  formatRelative,
  maskEmail,
  maskPhone,
} from '@/lib/format';
import type { CloverTransaction, RegalEvent } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Screen 07 — User Detail (§07). */
export default function UserDetail() {
  const { t } = useTranslation();
  const { userId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { can, piiUnmasked } = useAuth();
  const { rows: events } = useUserEvents(userId);
  const { rows: contributions } = useUserContributions(userId);
  const { rows: cloverLedger } = useUserClovers(userId);
  const { rows: auditEntries } = useUserActivity(userId);
  const unlockedCardRows = useUserCards(userId);
  const { user: resolvedUser } = useUser(userId);
  const mutations = useAdminMutations();
  const [action, setAction] = React.useState<null | 'suspend' | 'reactivate' | 'clovers' | 'reset'>(null);
  const [adjustAmount, setAdjustAmount] = React.useState('');

  const user = resolvedUser;

  if (!user) {
    return (
      <EmptyState
        icon={ShieldAlert}
        headline={t('userDetail.notFound')}
        description={t('userDetail.notFoundBody')}
        action={{ label: t('userDetail.backToUsers'), onClick: () => navigate('/users') }}
      />
    );
  }

  const fullName = `${user.firstName} ${user.lastName}`;
  const organized = events;
  const userContributions = contributions;
  const confirmed = userContributions.filter((c) => c.status === 'succeeded');
  const ledger = cloverLedger;
  const userAudit = auditEntries;
  const unlockedCards = unlockedCardRows;

  const totalContributed = confirmed.reduce((a, c) => a + c.amount, 0);
  const conversion = user.invitationsReceived
    ? (user.eventsContributedTo / user.invitationsReceived) * 100
    : 0;

  const paymentProfile = (['succeeded', 'pending', 'failed', 'cancelled'] as const).map((s) => ({
    status: s,
    count: userContributions.filter((c) => c.status === s).length,
  }));
  const profileTotal = Math.max(1, paymentProfile.reduce((a, p) => a + p.count, 0));

  const cloverEarned = ledger.filter((t) => t.type === 'earn').reduce((a, t) => a + t.amount, 0);
  const cloverRedeemed = Math.abs(
    ledger.filter((t) => t.type === 'redeem').reduce((a, t) => a + t.amount, 0),
  );
  const cloverAdjusted = ledger.filter((t) => t.type === 'adjust').reduce((a, t) => a + t.amount, 0);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: t('users.title'), href: '/users' }, { label: fullName }]}
        title={fullName}
        subtitle={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>{piiUnmasked ? user.email : maskEmail(user.email)}</span>
            <span className="text-neutral-400">{piiUnmasked ? user.phoneNumber : maskPhone(user.phoneNumber)}</span>
            <CopyableId value={user.id} label={t('userDetail.userId')} />
            <StatusBadge
              status={user.isDeleted ? 'deleted' : !user.isActive ? 'inactive' : user.isVerified ? 'active' : 'unverified'}
              label={
                user.isDeleted
                  ? t('status.deleted')
                  : !user.isActive
                    ? t('users.table.suspended')
                    : user.isVerified
                      ? t('status.active')
                      : t('status.unverified')
              }
            />
            {user.authProviders.map((p) => (
              <Chip key={p}>{p}</Chip>
            ))}
          </div>
        }
        actions={
          <>
            <span className="hidden text-caption text-neutral-500 md:block">
              {t('userDetail.joined', {
                date: formatDate(user.createdAt),
                lastLogin: user.lastLoginAt
                  ? formatRelative(user.lastLoginAt)
                  : t('userDetail.never'),
              })}
            </span>
            {can('clovers:adjust') && (
              <Button variant="secondary" onClick={() => setAction('clovers')}>
                {t('userDetail.adjustClovers')}
              </Button>
            )}
            {can('users:read') && (
              <Button variant="secondary" onClick={() => setAction('reset')}>
                <KeyRound className="h-4 w-4 text-neutral-400" />
                {t('userDetail.passwordReset')}
              </Button>
            )}
            {can('events:write') &&
              (user.isActive ? (
                <Button variant="danger" onClick={() => setAction('suspend')}>
                  <UserMinus className="h-4 w-4" />
                  {t('userDetail.suspend')}
                </Button>
              ) : (
                <Button variant="primary" onClick={() => setAction('reactivate')}>
                  <UserPlus className="h-4 w-4" />
                  {t('userDetail.reactivate')}
                </Button>
              ))}
          </>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t('userDetail.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="events">
            {t('userDetail.tabs.events')}
            <span className="tnum ml-2 text-caption text-neutral-400">{organized.length}</span>
          </TabsTrigger>
          <TabsTrigger value="contributions">
            {t('userDetail.tabs.contributions')}
            <span className="tnum ml-2 text-caption text-neutral-400">{userContributions.length}</span>
          </TabsTrigger>
          <TabsTrigger value="clovers">
            {t('userDetail.tabs.clovers')}
            <span className="tnum ml-2 text-caption text-neutral-400">{ledger.length}</span>
          </TabsTrigger>
          <TabsTrigger value="cards">{t('userDetail.tabs.cards')}</TabsTrigger>
          <TabsTrigger value="activity">{t('userDetail.tabs.activity')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {/* Exactly the metrics in the brief (§07) */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              label={t('userDetail.metrics.invitations')}
              value={String(user.invitationsReceived)}
              definition={t('userDetail.metrics.invitationsDef')}
            />
            <MetricCard
              label={t('userDetail.metrics.eventsContributed')}
              value={String(user.eventsContributedTo)}
              definition={t('userDetail.metrics.eventsContributedDef')}
            />
            <MetricCard
              label={t('userDetail.metrics.conversion')}
              value={formatPercent(conversion)}
              definition={t('userDetail.metrics.conversionDef')}
            />
            <MetricCard
              label={t('userDetail.metrics.totalContribution')}
              value={formatMoney(totalContributed)}
              definition={t('userDetail.metrics.totalContributionDef')}
            />
            <MetricCard
              label={t('userDetail.metrics.avgContribution')}
              value={formatMoney(
                confirmed.length ? Math.round(totalContributed / confirmed.length) : 0,
              )}
              definition={t('userDetail.metrics.avgContributionDef')}
            />
            <MetricCard
              label={t('userDetail.metrics.decisionTime')}
              value={formatDuration(user.medianDecisionTimeHours)}
              definition={t('userDetail.metrics.decisionTimeDef')}
            />
            <MetricCard
              label={t('userDetail.metrics.frequency')}
              value={t('userDetail.metrics.frequencyValue', { count: confirmed.length })}
              definition={t('userDetail.metrics.frequencyDef')}
            />
            <MetricCard
              label={t('userDetail.metrics.recurrence')}
              value={
                user.eventsContributedTo >= 2
                  ? t('userDetail.metrics.recurrenceYes', { count: user.eventsContributedTo })
                  : t('common.no')
              }
              definition={t('userDetail.metrics.recurrenceDef')}
            />
            <Card className="p-4">
              <p className="text-kpi-label text-neutral-500">{t('userDetail.paymentProfile')}</p>
              <div className="mt-3 flex h-6 w-full overflow-hidden rounded-sm bg-neutral-100">
                {paymentProfile.map((p) => (
                  <div
                    key={p.status}
                    className={cn(
                      'h-full',
                      p.status === 'succeeded'
                        ? 'bg-success-500'
                        : p.status === 'pending'
                          ? 'bg-warning-500'
                          : p.status === 'failed'
                            ? 'bg-danger-500'
                            : 'bg-neutral-400',
                    )}
                    style={{ width: `${(p.count / profileTotal) * 100}%` }}
                    title={`${t(`status.${p.status}`)}: ${p.count}`}
                  />
                ))}
              </div>
              <ul className="mt-3 grid grid-cols-2 gap-2">
                {paymentProfile.map((p) => (
                  <li key={p.status} className="flex items-center justify-between gap-2">
                    <StatusBadge status={p.status} />
                    <span className="tnum text-body font-medium text-neutral-900">{p.count}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-4 lg:col-span-2 xl:col-span-3">
              <p className="text-kpi-label text-neutral-500">{t('userDetail.cloverActivity')}</p>
              <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <p className="text-caption text-neutral-500">{t('userDetail.earned')}</p>
                  <CloverValue amount={cloverEarned} className="mt-1 text-[20px] leading-7" />
                </div>
                <div>
                  <p className="text-caption text-neutral-500">{t('userDetail.redeemed')}</p>
                  <CloverValue amount={cloverRedeemed} className="mt-1 text-[20px] leading-7" />
                </div>
                <div>
                  <p className="text-caption text-neutral-500">{t('userDetail.adjusted')}</p>
                  <CloverValue amount={cloverAdjusted} signed className="mt-1 text-[20px] leading-7" />
                </div>
                <div>
                  <p className="text-caption text-neutral-500">{t('userDetail.currentBalance')}</p>
                  <CloverValue amount={user.cloverBalance} className="mt-1 text-[20px] font-bold leading-7" />
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="events">
          <UserEventsTable events={organized} />
        </TabsContent>

        <TabsContent value="contributions">
          <ContributionsTable rows={userContributions} storageKey="user-contributions" />
        </TabsContent>

        <TabsContent value="clovers">
          <CloverLedgerTable
            rows={ledger}
            action={
              can('clovers:adjust') && (
                <Button variant="secondary" size="sm" onClick={() => setAction('clovers')}>
                  {t('userDetail.adjustBalance')}
                </Button>
              )
            }
          />
        </TabsContent>

        <TabsContent value="cards">
          <SectionHeading description={t('userDetail.unlockedDescription')}>
            {t('userDetail.unlockedHeading')}
          </SectionHeading>
          {unlockedCards.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
              {unlockedCards.map((c) => (
                <Link key={c.id} to={`/cards/catalog/${c.id}`} className="group">
                  {c.thumbUrl ? (
                    <img
                      src={c.thumbUrl}
                      alt=""
                      loading="lazy"
                      className="aspect-[3/4] w-full rounded-md object-cover transition-transform duration-micro group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex aspect-[3/4] items-center justify-center rounded-md bg-neutral-100 text-[36px]">
                      🎁
                    </div>
                  )}
                  <p className="mt-2 truncate text-body font-medium text-neutral-900">{c.name}</p>
                  <p className="text-caption text-neutral-500">
                    {c.cloverCost > 0 ? `🍀 ${c.cloverCost}` : t('userDetail.free')}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              headline={t('userDetail.noUnlocked')}
              description={t('userDetail.noUnlockedBody')}
              action={{ label: t('userDetail.browseCatalog'), href: '/cards/catalog' }}
            />
          )}
        </TabsContent>

        <TabsContent value="activity">
          <ActivityLog entries={userAudit} />
        </TabsContent>
      </Tabs>

      {/* Admin actions — permission-gated, all audited (§07) */}
      <ConfirmDialog
        open={action === 'suspend'}
        onOpenChange={(o) => !o && setAction(null)}
        title={t('userDetail.suspendTitle')}
        requireReason
        consequence={
          <Trans
            i18nKey="userDetail.suspendConsequence"
            values={{ name: fullName }}
            components={[<strong key="0" />]}
          />
        }
        confirmLabel={t('userDetail.suspendConfirm')}
        onConfirm={(reason) =>
          toast({ title: t('userDetail.suspendDone'), description: reason, tone: 'success' })
        }
      />

      <ConfirmDialog
        open={action === 'reactivate'}
        onOpenChange={(o) => !o && setAction(null)}
        title={t('userDetail.reactivateTitle')}
        tone="primary"
        requireReason
        consequence={
          <Trans
            i18nKey="userDetail.reactivateConsequence"
            values={{ name: fullName }}
            components={[<strong key="0" />]}
          />
        }
        confirmLabel={t('userDetail.reactivate')}
        onConfirm={(reason) =>
          toast({ title: t('userDetail.reactivateDone'), description: reason, tone: 'success' })
        }
      />

      <ConfirmDialog
        open={action === 'reset'}
        onOpenChange={(o) => !o && setAction(null)}
        title={t('userDetail.resetTitle')}
        tone="primary"
        requireReason
        consequence={
          <Trans
            i18nKey="userDetail.resetConsequence"
            values={{ email: piiUnmasked ? user.email : maskEmail(user.email) }}
            components={[<span key="0" />, <strong key="1" />]}
          />
        }
        confirmLabel={t('userDetail.resetConfirm')}
        onConfirm={() => toast({ title: t('userDetail.resetDone'), tone: 'success' })}
      />

      <ConfirmDialog
        open={action === 'clovers'}
        onOpenChange={(o) => {
          if (!o) {
            setAction(null);
            setAdjustAmount('');
          }
        }}
        title={t('userDetail.cloverTitle')}
        requireReason
        requireTypedConfirmation={fullName}
        consequence={
          <Trans
            i18nKey="userDetail.cloverConsequence"
            values={{ name: fullName }}
            components={[<strong key="0" />]}
          />
        }
        confirmLabel={t('userDetail.cloverConfirm')}
        onConfirm={(reason) => {
          const amount = Number(adjustAmount);
          if (!Number.isFinite(amount) || amount === 0) {
            toast({ title: t('userDetail.cloverNonZero'), tone: 'warning' });
            return;
          }
          void mutations.adjustClovers(user.id, amount, reason);
          toast({
            title: t('userDetail.cloverAdjusted'),
            description: t('userDetail.cloverAdjustedBody', {
              delta: `${amount > 0 ? '+' : ''}${amount}`,
              balance: Math.max(0, user.cloverBalance + amount),
            }),
            tone: 'success',
          });
        }}
      >
        <div>
          <Label htmlFor="clover-amount" required>
            {t('userDetail.cloverAmountLabel')}
          </Label>
          <Input
            id="clover-amount"
            type="number"
            value={adjustAmount}
            onChange={(e) => setAdjustAmount(e.target.value)}
            placeholder={t('userDetail.cloverAmountPlaceholder')}
            className="tnum mt-1"
          />
          <p className="mt-1 text-caption text-neutral-500">
            <Trans
              i18nKey="userDetail.cloverBalancePreview"
              values={{
                current: user.cloverBalance,
                next: user.cloverBalance + (Number(adjustAmount) || 0),
              }}
              components={[
                <span key="0" />,
                <span key="1" className="tnum font-medium" />,
                <span key="2" />,
                <span key="3" className="tnum font-medium text-neutral-900" />,
              ]}
            />
          </p>
        </div>
      </ConfirmDialog>
    </>
  );
}

function MetricCard({
  label,
  value,
  definition,
}: {
  label: string;
  value: string;
  definition: string;
}) {
  return (
    <Card className="p-4">
      <p className="text-kpi-label text-neutral-500">{label}</p>
      <p className="tnum mt-2 text-[24px] font-bold leading-8 text-neutral-900">{value}</p>
      <p className="mt-1 text-caption text-neutral-400">{definition}</p>
    </Card>
  );
}

function UserEventsTable({ events: rows }: { events: RegalEvent[] }) {
  const { t } = useTranslation();
  const columns: Column<RegalEvent>[] = [
    { id: 'name', header: t('fields.event'), sortable: true, sortValue: (e) => e.name, cell: (e) => <span className="font-medium text-neutral-900">{e.name}</span> },
    { id: 'status', header: t('fields.status'), cell: (e) => <StatusBadge status={e.status} /> },
    { id: 'goal', header: t('fields.goal'), numeric: true, sortable: true, sortValue: (e) => e.goalAmount, cell: (e) => <MoneyValue amount={e.goalAmount} showCurrency={false} /> },
    { id: 'raised', header: t('fields.raised'), numeric: true, sortable: true, sortValue: (e) => e.raisedAmount, cell: (e) => <MoneyValue amount={e.raisedAmount} showCurrency={false} /> },
    { id: 'created', header: t('fields.created'), sortable: true, sortValue: (e) => e.createdAt, cell: (e) => <span className="tnum">{formatDate(e.createdAt)}</span> },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(e) => e.id}
      rowHref={(e) => `/events/${e.id}`}
      empty={{
        headline: t('userDetail.noEvents'),
        description: t('userDetail.noEventsBody'),
      }}
    />
  );
}

/** The full signed clover ledger (§07 Clovers tab). */
export function CloverLedgerTable({
  rows,
  action,
  showUser,
}: {
  rows: CloverTransaction[];
  action?: React.ReactNode;
  showUser?: boolean;
}) {
  const { t: translate } = useTranslation();
  const columns: Column<CloverTransaction>[] = [
    {
      id: 'date',
      header: translate('cloverLedger.date'),
      sortable: true,
      sortValue: (t) => t.createdAt,
      cell: (t) => <span className="tnum whitespace-nowrap">{formatDateTime(t.createdAt)}</span>,
    },
    ...(showUser
      ? ([
          {
            id: 'user',
            header: translate('cloverLedger.user'),
            cell: (t: CloverTransaction) => (
              <Link
                to={`/users/${t.user.id}`}
                data-no-row-click
                className="flex items-center gap-2 rounded-sm transition-colors hover:text-brand-500"
              >
                <Avatar name={t.user.name} color={t.user.avatarColor} size="sm" />
                <span className="truncate">{t.user.name}</span>
              </Link>
            ),
          },
        ] as Column<CloverTransaction>[])
      : []),
    {
      id: 'type',
      header: translate('cloverLedger.type'),
      sortable: true,
      sortValue: (t) => t.type,
      cell: (t) => (
        <Chip tone={t.type === 'earn' ? 'secondary' : t.type === 'redeem' ? 'accent' : 'neutral'}>
          {translate(`cloverLedger.types.${t.type}`, { defaultValue: t.type })}
        </Chip>
      ),
    },
    {
      id: 'action',
      header: translate('cloverLedger.action'),
      cell: (t) => <code className="font-mono text-[13px] text-neutral-700">{t.action}</code>,
    },
    {
      id: 'amount',
      header: translate('cloverLedger.amount'),
      numeric: true,
      sortable: true,
      sortValue: (t) => t.amount,
      cell: (t) => <CloverValue amount={t.amount} signed className="justify-end" showIcon={false} />,
    },
    {
      id: 'balanceAfter',
      header: translate('cloverLedger.balanceAfter'),
      numeric: true,
      cell: (t) => <span className="tnum">{t.balanceAfter.toLocaleString()}</span>,
    },
    {
      id: 'reference',
      header: translate('cloverLedger.reference'),
      cell: (t) =>
        t.reference ? (
          <Link
            to={t.reference.href}
            data-no-row-click
            className="truncate rounded-sm text-brand-500 transition-colors hover:underline"
          >
            {t.reference.label}
          </Link>
        ) : (
          <span className="text-neutral-400">—</span>
        ),
    },
    {
      id: 'note',
      header: translate('cloverLedger.note'),
      defaultHidden: true,
      cell: (t) => <span className="text-neutral-500">{t.note || '—'}</span>,
    },
    {
      id: 'admin',
      header: translate('cloverLedger.adjustedBy'),
      cell: (t) => (t.adminName ? <span>{t.adminName}</span> : <span className="text-neutral-400">—</span>),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(t) => t.id}
      storageKey="clover-ledger"
      initialSort={{ id: 'date', dir: 'desc' }}
      toolbar={action}
      empty={{
        headline: translate('cloverLedger.empty'),
        description: translate('cloverLedger.emptyBody'),
      }}
    />
  );
}
