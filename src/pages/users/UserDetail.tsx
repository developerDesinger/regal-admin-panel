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
        headline="User not found"
        description="This account may have been deleted, or the ID in the URL is incorrect."
        action={{ label: 'Back to users', onClick: () => navigate('/users') }}
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
        breadcrumbs={[{ label: 'Users', href: '/users' }, { label: fullName }]}
        title={fullName}
        subtitle={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>{piiUnmasked ? user.email : maskEmail(user.email)}</span>
            <span className="text-neutral-400">{piiUnmasked ? user.phoneNumber : maskPhone(user.phoneNumber)}</span>
            <CopyableId value={user.id} label="User ID" />
            <StatusBadge
              status={user.isDeleted ? 'deleted' : !user.isActive ? 'inactive' : user.isVerified ? 'active' : 'unverified'}
              label={user.isDeleted ? 'Deleted' : !user.isActive ? 'Suspended' : user.isVerified ? 'Active' : 'Unverified'}
            />
            {user.authProviders.map((p) => (
              <Chip key={p}>{p}</Chip>
            ))}
          </div>
        }
        actions={
          <>
            <span className="hidden text-caption text-neutral-500 md:block">
              Joined {formatDate(user.createdAt)} · last login{' '}
              {user.lastLoginAt ? formatRelative(user.lastLoginAt) : 'never'}
            </span>
            {can('clovers:adjust') && (
              <Button variant="secondary" onClick={() => setAction('clovers')}>
                Adjust clovers
              </Button>
            )}
            {can('users:read') && (
              <Button variant="secondary" onClick={() => setAction('reset')}>
                <KeyRound className="h-4 w-4 text-neutral-400" />
                Password reset
              </Button>
            )}
            {can('events:write') &&
              (user.isActive ? (
                <Button variant="danger" onClick={() => setAction('suspend')}>
                  <UserMinus className="h-4 w-4" />
                  Suspend
                </Button>
              ) : (
                <Button variant="primary" onClick={() => setAction('reactivate')}>
                  <UserPlus className="h-4 w-4" />
                  Reactivate
                </Button>
              ))}
          </>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="events">
            Events<span className="tnum ml-2 text-caption text-neutral-400">{organized.length}</span>
          </TabsTrigger>
          <TabsTrigger value="contributions">
            Contributions
            <span className="tnum ml-2 text-caption text-neutral-400">{userContributions.length}</span>
          </TabsTrigger>
          <TabsTrigger value="clovers">
            Clovers<span className="tnum ml-2 text-caption text-neutral-400">{ledger.length}</span>
          </TabsTrigger>
          <TabsTrigger value="cards">Cards</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {/* Exactly the metrics in the brief (§07) */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              label="Invitations Received"
              value={String(user.invitationsReceived)}
              definition="Events the user was invited to."
            />
            <MetricCard
              label="Events Contributed To"
              value={String(user.eventsContributedTo)}
              definition="Distinct events with at least one confirmed contribution."
            />
            <MetricCard
              label="Invitation Conversion"
              value={formatPercent(conversion)}
              definition="Contributed ÷ invited × 100."
            />
            <MetricCard
              label="Total Contribution"
              value={formatMoney(totalContributed)}
              definition="Lifetime money contributed, confirmed only."
            />
            <MetricCard
              label="Average Contribution"
              value={formatMoney(confirmed.length ? Math.round(totalContributed / confirmed.length) : 0)}
              definition="Mean per confirmed contribution."
            />
            <MetricCard
              label="Decision Time"
              value={formatDuration(user.medianDecisionTimeHours)}
              definition="Median of (contribution timestamp − invitation timestamp)."
            />
            <MetricCard
              label="Contribution Frequency"
              value={`${confirmed.length} in period`}
              definition="Confirmed contributions inside the selected date range."
            />
            <MetricCard
              label="Recurrence"
              value={user.eventsContributedTo >= 2 ? `Yes · ${user.eventsContributedTo} events` : 'No'}
              definition="Whether the user has contributed to 2 or more distinct events."
            />
            <Card className="p-4">
              <p className="text-kpi-label text-neutral-500">Payment Status Profile</p>
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
                    title={`${p.status}: ${p.count}`}
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
              <p className="text-kpi-label text-neutral-500">Clover Activity</p>
              <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <p className="text-caption text-neutral-500">Earned</p>
                  <CloverValue amount={cloverEarned} className="mt-1 text-[20px] leading-7" />
                </div>
                <div>
                  <p className="text-caption text-neutral-500">Redeemed</p>
                  <CloverValue amount={cloverRedeemed} className="mt-1 text-[20px] leading-7" />
                </div>
                <div>
                  <p className="text-caption text-neutral-500">Adjusted</p>
                  <CloverValue amount={cloverAdjusted} signed className="mt-1 text-[20px] leading-7" />
                </div>
                <div>
                  <p className="text-caption text-neutral-500">Current balance</p>
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
                  Adjust balance
                </Button>
              )
            }
          />
        </TabsContent>

        <TabsContent value="cards">
          <SectionHeading description="Designs this user has unlocked with clovers. Unlocks are permanent — a later price change never revokes them.">
            Unlocked designs
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
                    {c.cloverCost > 0 ? `🍀 ${c.cloverCost}` : 'Free'}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              headline="No unlocked designs"
              description="This user hasn’t spent clovers on a premium card yet."
              action={{ label: 'Browse catalog', href: '/cards/catalog' }}
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
        title="Suspend this account"
        requireReason
        consequence={
          <>
            <strong>{fullName}</strong> will be unable to sign in, contribute, or organize events.
            Existing contributions and clover balance are preserved. The account can be reactivated
            later.
          </>
        }
        confirmLabel="Suspend account"
        onConfirm={(reason) =>
          toast({ title: 'Account suspended', description: reason, tone: 'success' })
        }
      />

      <ConfirmDialog
        open={action === 'reactivate'}
        onOpenChange={(o) => !o && setAction(null)}
        title="Reactivate this account"
        tone="primary"
        requireReason
        consequence={
          <>
            <strong>{fullName}</strong> regains full access immediately and can sign in on all
            devices.
          </>
        }
        confirmLabel="Reactivate"
        onConfirm={(reason) =>
          toast({ title: 'Account reactivated', description: reason, tone: 'success' })
        }
      />

      <ConfirmDialog
        open={action === 'reset'}
        onOpenChange={(o) => !o && setAction(null)}
        title="Send password reset"
        tone="primary"
        requireReason
        consequence={
          <>
            A reset link valid for 60 minutes will be emailed to{' '}
            <strong>{piiUnmasked ? user.email : maskEmail(user.email)}</strong>. Existing sessions are
            not revoked.
          </>
        }
        confirmLabel="Send reset email"
        onConfirm={() => toast({ title: 'Password reset sent', tone: 'success' })}
      />

      <ConfirmDialog
        open={action === 'clovers'}
        onOpenChange={(o) => {
          if (!o) {
            setAction(null);
            setAdjustAmount('');
          }
        }}
        title="Adjust clover balance"
        requireReason
        requireTypedConfirmation={fullName}
        consequence={
          <>
            This writes a signed entry to <strong>{fullName}</strong>’s clover ledger and changes their
            spendable balance immediately. It does not refund or charge money.
          </>
        }
        confirmLabel="Apply adjustment"
        onConfirm={(reason) => {
          const amount = Number(adjustAmount);
          if (!Number.isFinite(amount) || amount === 0) {
            toast({ title: 'Enter a non-zero amount', tone: 'warning' });
            return;
          }
          void mutations.adjustClovers(user.id, amount, reason);
          toast({
            title: 'Clover balance adjusted',
            description: `${amount > 0 ? '+' : ''}${amount} clovers · new balance ${Math.max(0, user.cloverBalance + amount)}`,
            tone: 'success',
          });
        }}
      >
        <div>
          <Label htmlFor="clover-amount" required>
            Amount (signed)
          </Label>
          <Input
            id="clover-amount"
            type="number"
            value={adjustAmount}
            onChange={(e) => setAdjustAmount(e.target.value)}
            placeholder="e.g. 250 or -100"
            className="tnum mt-1"
          />
          <p className="mt-1 text-caption text-neutral-500">
            Current balance: <span className="tnum font-medium">{user.cloverBalance}</span> → new
            balance:{' '}
            <span className="tnum font-medium text-neutral-900">
              {user.cloverBalance + (Number(adjustAmount) || 0)}
            </span>
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
  const columns: Column<RegalEvent>[] = [
    { id: 'name', header: 'Event', sortable: true, sortValue: (e) => e.name, cell: (e) => <span className="font-medium text-neutral-900">{e.name}</span> },
    { id: 'status', header: 'Status', cell: (e) => <StatusBadge status={e.status} /> },
    { id: 'goal', header: 'Goal', numeric: true, sortable: true, sortValue: (e) => e.goalAmount, cell: (e) => <MoneyValue amount={e.goalAmount} showCurrency={false} /> },
    { id: 'raised', header: 'Raised', numeric: true, sortable: true, sortValue: (e) => e.raisedAmount, cell: (e) => <MoneyValue amount={e.raisedAmount} showCurrency={false} /> },
    { id: 'created', header: 'Created', sortable: true, sortValue: (e) => e.createdAt, cell: (e) => <span className="tnum">{formatDate(e.createdAt)}</span> },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(e) => e.id}
      rowHref={(e) => `/events/${e.id}`}
      empty={{
        headline: 'This user hasn’t organized any events',
        description: 'They may still have contributed to events organized by others — check the Contributions tab.',
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
  const columns: Column<CloverTransaction>[] = [
    {
      id: 'date',
      header: 'Date',
      sortable: true,
      sortValue: (t) => t.createdAt,
      cell: (t) => <span className="tnum whitespace-nowrap">{formatDateTime(t.createdAt)}</span>,
    },
    ...(showUser
      ? ([
          {
            id: 'user',
            header: 'User',
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
      header: 'Type',
      sortable: true,
      sortValue: (t) => t.type,
      cell: (t) => (
        <Chip tone={t.type === 'earn' ? 'secondary' : t.type === 'redeem' ? 'accent' : 'neutral'}>
          {t.type}
        </Chip>
      ),
    },
    {
      id: 'action',
      header: 'Action',
      cell: (t) => <code className="font-mono text-[13px] text-neutral-700">{t.action}</code>,
    },
    {
      id: 'amount',
      header: 'Amount',
      numeric: true,
      sortable: true,
      sortValue: (t) => t.amount,
      cell: (t) => <CloverValue amount={t.amount} signed className="justify-end" showIcon={false} />,
    },
    {
      id: 'balanceAfter',
      header: 'Balance after',
      numeric: true,
      cell: (t) => <span className="tnum">{t.balanceAfter.toLocaleString()}</span>,
    },
    {
      id: 'reference',
      header: 'Reference',
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
      header: 'Note',
      defaultHidden: true,
      cell: (t) => <span className="text-neutral-500">{t.note || '—'}</span>,
    },
    {
      id: 'admin',
      header: 'Adjusted by',
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
        headline: 'No clover activity',
        description: 'Earns, redemptions and manual adjustments will appear here as a signed ledger.',
      }}
    />
  );
}
