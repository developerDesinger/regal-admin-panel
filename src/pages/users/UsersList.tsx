import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Eye, EyeOff, Lock, UserMinus, UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { KpiCard, KpiGrid } from '@/components/common/KpiCard';
import { DataTable, type Column } from '@/components/common/DataTable';
import { FilterBar } from '@/components/common/FilterBar';
import { DateRangePicker } from '@/components/common/DateRangePicker';
import { StatusBadge } from '@/components/common/StatusBadge';
import { MoneyValue, CloverValue } from '@/components/common/MoneyValue';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/misc';
import { Tooltip } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

import { useUsers, useUserKpis } from '@/hooks/data';
import { useAdminMutations } from '@/hooks/data/mutations';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ApiError } from '@/lib/api/client';
import { userColumns } from '@/lib/datasets';
import { ExportButton } from '@/components/common/ExportButton';
import { rangeLabel } from '@/lib/date-ranges';
import { downloadDataset } from '@/lib/export';
import { useUrlState } from '@/hooks/useUrlState';
import { formatDate, formatMoney, formatNumber, formatPercent, formatRelative, maskEmail } from '@/lib/format';
import type { RegalUser } from '@/lib/types';

const PROVIDER_ICON: Record<string, string> = { local: '✉️', google: 'G', apple: '' };

/** Screen 06 — Users (§06). */
export default function UsersList() {
  const { all } = useUrlState();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { can, piiUnmasked, togglePii } = useAuth();
  const { rows: users, isLoading, error, refetch, meta } = useUsers(all);
  const mutations = useAdminMutations();
  /** The row whose suspend/reactivate is awaiting confirmation. */
  const [pending, setPending] = React.useState<RegalUser | null>(null);
  const { data: kpis } = useUserKpis({ range: all.range ?? '30d', compare: all.compare === '1' });
  const kpi = (key: keyof NonNullable<typeof kpis>, fmt: (v: number) => string) => {
    const v = kpis?.[key];
    return {
      value: typeof v?.value === 'number' ? fmt(v.value) : '—',
      delta: v?.delta ?? null,
    };
  };

  const filtered = React.useMemo(
    () =>
      users.filter((u) => {
        if (all.verified === 'yes' && !u.isVerified) return false;
        if (all.verified === 'no' && u.isVerified) return false;
        if (all.state === 'active' && (!u.isActive || u.isDeleted)) return false;
        if (all.state === 'deleted' && !u.isDeleted) return false;
        if (all.provider && all.provider !== 'all' && !u.authProviders.includes(all.provider as 'local')) {
          return false;
        }
        if (all.activity === 'contributed' && u.eventsContributedTo === 0) return false;
        if (all.activity === 'organized' && u.eventsOrganized === 0) return false;
        if (all.clovers === 'has' && u.cloverBalance === 0) return false;
        if (all.clovers === 'none' && u.cloverBalance > 0) return false;
        if (all.q) {
          const q = all.q.toLowerCase();
          if (!`${u.firstName} ${u.lastName} ${u.email} ${u.id}`.toLowerCase().includes(q)) return false;
        }
        return true;
      }),
    [all, users],
  );

  const showEmail = (u: RegalUser) => (piiUnmasked ? u.email : maskEmail(u.email));

  const columns: Column<RegalUser>[] = [
    {
      id: 'user',
      header: 'User',
      width: '260px',
      sortable: true,
      sortValue: (u) => `${u.firstName} ${u.lastName}`,
      cell: (u) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={`${u.firstName} ${u.lastName}`} color={u.avatarColor} size="md" />
          <div className="min-w-0">
            <p className="truncate font-medium text-neutral-900">
              {u.firstName} {u.lastName}
            </p>
            <p className="truncate text-caption text-neutral-500">{showEmail(u)}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'registered',
      header: 'Registered',
      sortable: true,
      sortValue: (u) => u.createdAt,
      cell: (u) => <span className="tnum whitespace-nowrap">{formatDate(u.createdAt)}</span>,
    },
    {
      id: 'lastLogin',
      header: 'Last login',
      sortable: true,
      sortValue: (u) => u.lastLoginAt ?? '',
      cell: (u) =>
        u.lastLoginAt ? (
          <span className="text-neutral-500">{formatRelative(u.lastLoginAt)}</span>
        ) : (
          <span className="text-neutral-400">Never</span>
        ),
    },
    {
      id: 'providers',
      header: 'Auth',
      cell: (u) => (
        <div className="flex gap-1">
          {u.authProviders.map((p) => (
            <Tooltip key={p} content={p}>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-semibold text-neutral-700">
                {PROVIDER_ICON[p]}
              </span>
            </Tooltip>
          ))}
        </div>
      ),
    },
    {
      id: 'organized',
      header: 'Organized',
      numeric: true,
      sortable: true,
      sortValue: (u) => u.eventsOrganized,
      cell: (u) => <span className="tnum">{u.eventsOrganized}</span>,
    },
    {
      id: 'contributed',
      header: 'Contributed to',
      numeric: true,
      sortable: true,
      sortValue: (u) => u.eventsContributedTo,
      cell: (u) => <span className="tnum">{u.eventsContributedTo}</span>,
    },
    {
      id: 'invitations',
      header: 'Invitations',
      numeric: true,
      sortable: true,
      defaultHidden: true,
      sortValue: (u) => u.invitationsReceived,
      cell: (u) => <span className="tnum">{u.invitationsReceived}</span>,
    },
    {
      id: 'conversion',
      header: 'Conversion',
      numeric: true,
      sortable: true,
      sortValue: (u) => (u.invitationsReceived ? u.eventsContributedTo / u.invitationsReceived : 0),
      cell: (u) => (
        <span className="tnum">
          {u.invitationsReceived
            ? formatPercent((u.eventsContributedTo / u.invitationsReceived) * 100, 0)
            : '—'}
        </span>
      ),
    },
    {
      id: 'totalContributed',
      header: 'Total contributed',
      numeric: true,
      sortable: true,
      sortValue: (u) => u.totalContributed,
      cell: (u) => <MoneyValue amount={u.totalContributed} showCurrency={false} />,
    },
    {
      id: 'clovers',
      header: 'Clovers',
      numeric: true,
      sortable: true,
      sortValue: (u) => u.cloverBalance,
      cell: (u) => <CloverValue amount={u.cloverBalance} className="justify-end" />,
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (u) => (u.isDeleted ? 'deleted' : u.isVerified ? 'active' : 'unverified'),
      cell: (u) => (
        <StatusBadge
          status={u.isDeleted ? 'deleted' : !u.isActive ? 'inactive' : u.isVerified ? 'active' : 'unverified'}
          label={u.isDeleted ? 'Deleted' : !u.isActive ? 'Suspended' : u.isVerified ? 'Active' : 'Unverified'}
        />
      ),
    },
    {
      id: 'actions',
      header: '',
      width: '56px',
      cell: (u) =>
        can('users:read') && !u.isDeleted ? (
          <div data-no-row-click onClick={(e) => e.stopPropagation()}>
            <Tooltip content={u.isActive ? `Suspend ${u.firstName}` : `Reactivate ${u.firstName}`}>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setPending(u)}
                aria-label={u.isActive ? `Suspend ${u.firstName} ${u.lastName}` : `Reactivate ${u.firstName} ${u.lastName}`}
                className={u.isActive ? 'text-neutral-400 hover:text-danger-500' : 'text-neutral-400 hover:text-success-500'}
              >
                {u.isActive ? <UserMinus className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              </Button>
            </Tooltip>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Everyone who organizes, contributes or receives a gift."
        actions={
          <>
            <DateRangePicker />
            {can('pii:read') ? (
              <Button
                variant="secondary"
                onClick={() => {
                  togglePii();
                  if (!piiUnmasked) {
                    toast({
                      title: 'PII unmasked',
                      description: 'This action was written to the audit trail.',
                      tone: 'warning',
                    });
                  }
                }}
              >
                {piiUnmasked ? <EyeOff className="h-4 w-4 text-neutral-400" /> : <Eye className="h-4 w-4 text-neutral-400" />}
                {piiUnmasked ? 'Mask PII' : 'Unmask PII'}
              </Button>
            ) : (
              <Tooltip content="Requires the pii:read permission. Ask a Super Admin to grant it.">
                <Button variant="secondary" disabled>
                  <Lock className="h-4 w-4" />
                  PII masked
                </Button>
              </Tooltip>
            )}
            <ExportButton
              name="users"
              label="Users"
              columns={userColumns}
              rows={filtered}
              containsPii
              filterSummary={`${rangeLabel(all.range ?? '30d')} · ${filtered.length} of ${meta?.totalRows ?? users.length} users`}
            />
          </>
        }
      />

      <KpiGrid columns={3} className="mb-6">
        <KpiCard
          label="Total Users"
          {...kpi('totalUsers', formatNumber)}
          definition="All registered accounts, excluding hard-deleted records."
          onDrillDown={() => navigate('/users')}
        />
        <KpiCard
          label="New Users"
          {...kpi('newUsers', formatNumber)}
          definition="Accounts whose registration timestamp falls inside the selected range."
        />
        <KpiCard
          label="Active Contributors"
          {...kpi('activeContributors', formatNumber)}
          definition="Distinct users with ≥1 confirmed contribution in the selected range."
          onDrillDown={() => navigate('/users?activity=contributed')}
        />
        <KpiCard
          label="Recurrent Contributors"
          {...kpi('recurrentContributors', formatNumber)}
          definition="Users who contributed to 2 or more distinct events, lifetime."
        />
        <KpiCard
          label="Average Lifetime Contribution"
          {...kpi('avgLifetimeContribution', (v) => formatMoney(v))}
          definition="Mean of total confirmed money contributed per user, lifetime."
        />
        <KpiCard
          label="Users with Clover Balance"
          {...kpi('usersWithCloverBalance', formatNumber)}
          accent="secondary"
          definition="Users whose current clover balance is greater than zero."
          onDrillDown={() => navigate('/users?clovers=has')}
        />
      </KpiGrid>

      {!piiUnmasked && (
        <p className="mb-3 flex items-center gap-2 text-caption text-neutral-500">
          <Lock className="h-3 w-3" aria-hidden />
          Email and phone are masked by default. Unmasking requires{' '}
          <code className="font-mono">pii:read</code> and is itself an audited action.
        </p>
      )}

      <FilterBar
        className="mb-4"
        searchPlaceholder="Search name, email, user ID…"
        filters={[
          {
            id: 'verified',
            label: 'Verified',
            options: [
              { value: 'yes', label: 'Verified' },
              { value: 'no', label: 'Unverified' },
            ],
          },
          {
            id: 'state',
            label: 'State',
            options: [
              { value: 'active', label: 'Active' },
              { value: 'deleted', label: 'Deleted' },
            ],
          },
          {
            id: 'provider',
            label: 'Provider',
            options: [
              { value: 'local', label: 'Email / password' },
              { value: 'google', label: 'Google' },
              { value: 'apple', label: 'Apple' },
            ],
          },
          {
            id: 'activity',
            label: 'Activity',
            options: [
              { value: 'contributed', label: 'Has contributed' },
              { value: 'organized', label: 'Has organized' },
            ],
          },
          {
            id: 'clovers',
            label: 'Clovers',
            options: [
              { value: 'has', label: 'Has balance' },
              { value: 'none', label: 'Zero balance' },
            ],
          },
        ]}
      />

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(u) => u.id}
        loading={isLoading}
        error={error}
        onRetry={refetch}
        rowHref={(u) => `/users/${u.id}`}
        storageKey="users"
        initialSort={{ id: 'registered', dir: 'desc' }}
        empty={{
          headline: 'No users match these filters',
          description: 'Clear a filter or search by email to widen the result set.',
        }}
        bulkActions={(selected, clear) => (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const file = downloadDataset('users-selection', userColumns, selected, 'csv');
              toast({
                title: 'Download started',
                description: `${file} · contains PII · audited`,
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

      {pending && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setPending(null)}
          title={pending.isActive ? 'Suspend this account' : 'Reactivate this account'}
          tone={pending.isActive ? 'danger' : 'primary'}
          // The server rejects these without a reason (422), and it lands in
          // the audit trail — so it stays required. The typed-name step does
          // not: suspending is reversible from this same button.
          requireReason
          confirmLabel={pending.isActive ? 'Suspend account' : 'Reactivate account'}
          consequence={
            pending.isActive ? (
              <>
                <strong>
                  {pending.firstName} {pending.lastName}
                </strong>{' '}
                will be unable to sign in, contribute or organize events. Their contributions and
                clover balance are preserved, and you can reactivate them from this same button.
              </>
            ) : (
              <>
                <strong>
                  {pending.firstName} {pending.lastName}
                </strong>{' '}
                will be able to sign in again immediately.
              </>
            )
          }
          onConfirm={(reason) => {
            const wasActive = pending.isActive;
            const name = `${pending.firstName} ${pending.lastName}`;
            mutations
              .setUserActive(pending.id, !wasActive, reason)
              .then(() =>
                toast({
                  title: wasActive ? 'Account suspended' : 'Account reactivated',
                  description: name,
                  tone: 'success',
                }),
              )
              .catch((err: ApiError) =>
                toast({
                  title: wasActive ? 'Could not suspend' : 'Could not reactivate',
                  // 409 means it is already in that state — worth saying plainly.
                  description: err.message,
                  tone: 'danger',
                }),
              );
          }}
        />
      )}
    </>
  );
}
