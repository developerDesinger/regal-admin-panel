import { Trans, useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      header: t('users.table.user'),
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
      header: t('users.table.registered'),
      sortable: true,
      sortValue: (u) => u.createdAt,
      cell: (u) => <span className="tnum whitespace-nowrap">{formatDate(u.createdAt)}</span>,
    },
    {
      id: 'lastLogin',
      header: t('users.table.lastLogin'),
      sortable: true,
      sortValue: (u) => u.lastLoginAt ?? '',
      cell: (u) =>
        u.lastLoginAt ? (
          <span className="text-neutral-500">{formatRelative(u.lastLoginAt)}</span>
        ) : (
          <span className="text-neutral-400">{t('status.never')}</span>
        ),
    },
    {
      id: 'providers',
      header: t('users.table.auth'),
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
      header: t('users.table.organized'),
      numeric: true,
      sortable: true,
      sortValue: (u) => u.eventsOrganized,
      cell: (u) => <span className="tnum">{u.eventsOrganized}</span>,
    },
    {
      id: 'contributed',
      header: t('users.table.contributedTo'),
      numeric: true,
      sortable: true,
      sortValue: (u) => u.eventsContributedTo,
      cell: (u) => <span className="tnum">{u.eventsContributedTo}</span>,
    },
    {
      id: 'invitations',
      header: t('users.table.invitations'),
      numeric: true,
      sortable: true,
      defaultHidden: true,
      sortValue: (u) => u.invitationsReceived,
      cell: (u) => <span className="tnum">{u.invitationsReceived}</span>,
    },
    {
      id: 'conversion',
      header: t('users.table.conversion'),
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
      header: t('users.table.totalContributed'),
      numeric: true,
      sortable: true,
      sortValue: (u) => u.totalContributed,
      cell: (u) => <MoneyValue amount={u.totalContributed} showCurrency={false} />,
    },
    {
      id: 'clovers',
      header: t('users.table.clovers'),
      numeric: true,
      sortable: true,
      sortValue: (u) => u.cloverBalance,
      cell: (u) => <CloverValue amount={u.cloverBalance} className="justify-end" />,
    },
    {
      id: 'status',
      header: t('fields.status'),
      sortable: true,
      sortValue: (u) => (u.isDeleted ? 'deleted' : u.isVerified ? 'active' : 'unverified'),
      cell: (u) => (
        <StatusBadge
          status={u.isDeleted ? 'deleted' : !u.isActive ? 'inactive' : u.isVerified ? 'active' : 'unverified'}
          label={
            u.isDeleted
              ? t('status.deleted')
              : !u.isActive
                ? t('users.table.suspended')
                : u.isVerified
                  ? t('status.active')
                  : t('status.unverified')
          }
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
            <Tooltip
              content={
                u.isActive
                  ? t('users.suspend.tooltip', { name: u.firstName })
                  : t('users.suspend.reactivateTooltip', { name: u.firstName })
              }
            >
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setPending(u)}
                aria-label={
                  u.isActive
                    ? t('users.suspend.tooltip', { name: `${u.firstName} ${u.lastName}` })
                    : t('users.suspend.reactivateTooltip', {
                        name: `${u.firstName} ${u.lastName}`,
                      })
                }
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
        title={t('users.title')}
        subtitle={t('users.subtitle')}
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
                      title: t('users.piiUnmasked'),
                      description: t('users.piiUnmaskedBody'),
                      tone: 'warning',
                    });
                  }
                }}
              >
                {piiUnmasked ? <EyeOff className="h-4 w-4 text-neutral-400" /> : <Eye className="h-4 w-4 text-neutral-400" />}
                {piiUnmasked ? t('users.maskPii') : t('users.unmaskPii')}
              </Button>
            ) : (
              <Tooltip content={t('users.piiTooltip')}>
                <Button variant="secondary" disabled>
                  <Lock className="h-4 w-4" />
                  {t('users.piiMasked')}
                </Button>
              </Tooltip>
            )}
            <ExportButton
              name="users"
              label={t('users.exportLabel')}
              columns={userColumns}
              rows={filtered}
              containsPii
              filterSummary={t('users.filterSummary', {
                range: t(rangeLabel(all.range ?? '30d')),
                shown: filtered.length,
                total: meta?.totalRows ?? users.length,
              })}
            />
          </>
        }
      />

      <KpiGrid columns={3} className="mb-6">
        <KpiCard
          label={t('users.kpi.total')}
          {...kpi('totalUsers', formatNumber)}
          definition={t('users.kpi.totalDef')}
          onDrillDown={() => navigate('/users')}
        />
        <KpiCard
          label={t('users.kpi.new')}
          {...kpi('newUsers', formatNumber)}
          definition={t('users.kpi.newDef')}
        />
        <KpiCard
          label={t('users.kpi.activeContributors')}
          {...kpi('activeContributors', formatNumber)}
          definition={t('users.kpi.activeContributorsDef')}
          onDrillDown={() => navigate('/users?activity=contributed')}
        />
        <KpiCard
          label={t('users.kpi.recurrent')}
          {...kpi('recurrentContributors', formatNumber)}
          definition={t('users.kpi.recurrentDef')}
        />
        <KpiCard
          label={t('users.kpi.avgLifetime')}
          {...kpi('avgLifetimeContribution', (v) => formatMoney(v))}
          definition={t('users.kpi.avgLifetimeDef')}
        />
        <KpiCard
          label={t('users.kpi.withClovers')}
          {...kpi('usersWithCloverBalance', formatNumber)}
          accent="secondary"
          definition={t('users.kpi.withCloversDef')}
          onDrillDown={() => navigate('/users?clovers=has')}
        />
      </KpiGrid>

      {!piiUnmasked && (
        <p className="mb-3 flex items-center gap-2 text-caption text-neutral-500">
          <Lock className="h-3 w-3" aria-hidden />
          <Trans
            i18nKey="users.piiNote"
            components={[<span key="0" />, <code key="1" className="font-mono" />]}
          />
        </p>
      )}

      <FilterBar
        className="mb-4"
        searchPlaceholder={t('users.searchPlaceholder')}
        filters={[
          {
            id: 'verified',
            label: t('users.filters.verified'),
            options: [
              { value: 'yes', label: t('users.filters.verified') },
              { value: 'no', label: t('users.filters.unverified') },
            ],
          },
          {
            id: 'state',
            label: t('users.filters.state'),
            options: [
              { value: 'active', label: t('status.active') },
              { value: 'deleted', label: t('users.filters.deleted') },
            ],
          },
          {
            id: 'provider',
            label: t('users.filters.provider'),
            options: [
              { value: 'local', label: t('users.filters.emailPassword') },
              { value: 'google', label: 'Google' },
              { value: 'apple', label: 'Apple' },
            ],
          },
          {
            id: 'activity',
            label: t('users.filters.activity'),
            options: [
              { value: 'contributed', label: t('users.filters.hasContributed') },
              { value: 'organized', label: t('users.filters.hasOrganized') },
            ],
          },
          {
            id: 'clovers',
            label: t('users.filters.clovers'),
            options: [
              { value: 'has', label: t('users.filters.hasBalance') },
              { value: 'none', label: t('users.filters.zeroBalance') },
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
          headline: t('users.table.empty'),
          description: t('users.table.emptyBody'),
        }}
        bulkActions={(selected, clear) => (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const file = downloadDataset('users-selection', userColumns, selected, 'csv');
              toast({
                title: t('common.downloadStarted'),
                description: t('users.exportedPii', { filename: file }),
                tone: 'success',
              });
              clear();
            }}
          >
            <Download className="h-4 w-4 text-neutral-400" />
            {t('events.exportCsv')}
          </Button>
        )}
      />

      {pending && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setPending(null)}
          title={
            pending.isActive ? t('users.suspend.title') : t('users.suspend.reactivateTitle')
          }
          tone={pending.isActive ? 'danger' : 'primary'}
          // The server rejects these without a reason (422), and it lands in
          // the audit trail — so it stays required. The typed-name step does
          // not: suspending is reversible from this same button.
          requireReason
          confirmLabel={
            pending.isActive ? t('users.suspend.confirm') : t('users.suspend.reactivateConfirm')
          }
          consequence={
            <Trans
              i18nKey={
                pending.isActive
                  ? 'users.suspend.consequence'
                  : 'users.suspend.reactivateConsequence'
              }
              values={{ name: `${pending.firstName} ${pending.lastName}` }}
              components={[<strong key="0" />]}
            />
          }
          onConfirm={(reason) => {
            const wasActive = pending.isActive;
            const name = `${pending.firstName} ${pending.lastName}`;
            mutations
              .setUserActive(pending.id, !wasActive, reason)
              .then(() =>
                toast({
                  title: wasActive ? t('users.suspend.done') : t('users.suspend.reactivateDone'),
                  description: name,
                  tone: 'success',
                }),
              )
              .catch((err: ApiError) =>
                toast({
                  title: wasActive
                    ? t('users.suspend.failed')
                    : t('users.suspend.reactivateFailed'),
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
