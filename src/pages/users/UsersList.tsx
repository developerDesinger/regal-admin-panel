import { Trans, useTranslation } from 'react-i18next';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Eye, EyeOff, Lock, MapPin, UserMinus, UserPlus } from 'lucide-react';
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

import { useUsers, useUserKpis, useUserLocations } from '@/hooks/data';
import { canonicalCountry, countryFlag as flag, countryName } from '@/lib/api/adapters';
import type { UserLocations } from '@/lib/api/types';
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
import { cn } from '@/lib/utils';

/**
 * The breakdown as people read it: a retired code folded into its current
 * country (DD into DE), and cities merged regardless of case, since "Puebla"
 * and "puebla" are free text for the same place. A merged city is shown in its
 * most common spelling.
 */
function normalizeLocations(data: UserLocations): UserLocations {
  const byCountry = new Map<string, { users: number; cities: Map<string, Map<string, number>> }>();
  for (const c of data.countries) {
    const code = canonicalCountry(c.country);
    const entry = byCountry.get(code) ?? { users: 0, cities: new Map() };
    entry.users += c.users;
    for (const { city, users } of c.cities) {
      const key = city.trim().toLocaleLowerCase();
      const spellings = entry.cities.get(key) ?? new Map<string, number>();
      spellings.set(city.trim(), (spellings.get(city.trim()) ?? 0) + users);
      entry.cities.set(key, spellings);
    }
    byCountry.set(code, entry);
  }
  const countries = [...byCountry.entries()]
    .map(([country, e]) => ({
      country,
      users: e.users,
      percent: data.located > 0 ? Math.round((e.users / data.located) * 1000) / 10 : 0,
      cities: [...e.cities.values()]
        .map((spellings) => {
          const ranked = [...spellings.entries()].sort((a, b) => b[1] - a[1]);
          return { city: ranked[0][0], users: ranked.reduce((n, [, u]) => n + u, 0) };
        })
        .sort((a, b) => b.users - a.users),
    }))
    .sort((a, b) => b.users - a.users);
  return { ...data, countries };
}

const PROVIDER_ICON: Record<string, string> = { local: '✉️', google: 'G', apple: '' };

/** Screen 06 — Users (§06). */
export default function UsersList() {
  const { t } = useTranslation();
  const { all, set } = useUrlState();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { can, piiUnmasked, togglePii } = useAuth();
  const { rows: users, isLoading, error, refetch, meta } = useUsers(all);
  const mutations = useAdminMutations();
  /** The row whose suspend/reactivate is awaiting confirmation. */
  const [pending, setPending] = React.useState<RegalUser | null>(null);
  const { data: kpis } = useUserKpis({ range: all.range ?? '30d', compare: all.compare === '1' });
  // Same filters as the table, so the breakdown and the list always agree.
  const { data: rawLocations, isLoading: locationsLoading } = useUserLocations({ ...all, cities: 10 });
  const locations = React.useMemo(
    () => (rawLocations ? normalizeLocations(rawLocations) : undefined),
    [rawLocations],
  );
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
        if (all.country === 'none' && u.country) return false;
        if (all.country && all.country !== 'none' && canonicalCountry(u.country ?? '') !== canonicalCountry(all.country)) {
          return false;
        }
        if (all.city && !(u.city ?? '').toLowerCase().includes(all.city.toLowerCase())) return false;
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
      id: 'location',
      header: t('users.table.location'),
      sortable: true,
      sortValue: (u) => `${u.country ?? '~'} ${u.city ?? ''}`,
      cell: (u) =>
        u.country ? (
          <div className="min-w-0">
            <p className="truncate text-neutral-900">
              <span aria-hidden className="mr-1">{flag(u.country)}</span>
              {countryName(u.country)}
            </p>
            {u.city && <p className="truncate text-caption text-neutral-500">{u.city}</p>}
          </div>
        ) : (
          <span className="text-neutral-400">{t('users.location.notSet')}</span>
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
      // Activity, not authentication. The column used to read `lastLoginAt`,
      // which the app writes once and never again — it runs on refresh tokens
      // — so somebody who opens Regal every day showed a months-old date, or
      // "never". The tooltip keeps the login itself visible for the cases
      // where that is the question being asked.
      id: 'lastSeen',
      header: t('users.table.lastSeen'),
      sortable: true,
      sortValue: (u) => u.lastSeenAt ?? u.lastLoginAt ?? '',
      cell: (u) => {
        const seen = u.lastSeenAt ?? u.lastLoginAt;
        if (!seen) return <span className="text-neutral-400">{t('status.never')}</span>;
        return (
          <Tooltip
            content={t('users.table.lastSeenTooltip', {
              login: u.lastLoginAt ? formatRelative(u.lastLoginAt) : t('status.never'),
            })}
          >
            <span className="cursor-help text-neutral-500">{formatRelative(seen)}</span>
          </Tooltip>
        );
      },
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

      <LocationBreakdown
        data={locations}
        loading={locationsLoading}
        active={all.country}
        onSelect={(country) => set({ country: all.country === country ? null : country, city: null })}
      />

      <FilterBar
        className="mb-4"
        searchPlaceholder={t('users.searchPlaceholder')}
        filters={[
          {
            id: 'country',
            label: t('users.filters.country'),
            options: [
              ...(locations?.countries ?? []).map((c) => ({
                value: c.country,
                label: `${flag(c.country)} ${countryName(c.country)}`,
              })),
              // Keep a country picked from the URL selectable even when it has
              // fallen out of the breakdown's top list.
              ...(all.country && all.country !== 'none' && !locations?.countries.some((c) => c.country === all.country)
                ? [{ value: all.country, label: `${flag(all.country)} ${countryName(all.country)}` }]
                : []),
              { value: 'none', label: t('users.location.notSet') },
            ],
          },
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

/**
 * Users per self-declared country, with each country's top cities (§06).
 *
 * Shares are of the users who set a country; the ones who never did are shown
 * as their own line rather than folded in, so a split covering 12 of 400
 * accounts doesn't read like one covering all 400. Clicking a country filters
 * the table below to it.
 */
function LocationBreakdown({
  data,
  loading,
  active,
  onSelect,
}: {
  data: UserLocations | undefined;
  loading: boolean;
  active: string | undefined;
  onSelect: (country: string) => void;
}) {
  const { t } = useTranslation();
  const max = Math.max(1, ...(data?.countries ?? []).map((c) => c.users));

  return (
    <section className="mb-6 rounded-lg border border-neutral-200 bg-neutral-0 p-5 shadow-e1">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-card-title text-neutral-900">
            <MapPin className="h-4 w-4 text-brand-500" aria-hidden />
            {t('users.location.title')}
          </h2>
          <p className="mt-0.5 text-caption text-neutral-500">
            {data
              ? t('users.location.subtitle', {
                  located: formatNumber(data.located),
                  total: formatNumber(data.totalUsers),
                })
              : t('users.location.subtitleLoading')}
          </p>
        </div>
        {data && data.unset > 0 && (
          <button
            type="button"
            onClick={() => onSelect('none')}
            className={cn(
              'rounded-sm text-caption font-medium transition-colors',
              active === 'none' ? 'text-brand-600' : 'text-neutral-500 hover:text-brand-600',
            )}
          >
            {t('users.location.unset', { count: data.unset })}
          </button>
        )}
      </div>

      {loading && !data ? (
        <div className="space-y-3" aria-busy>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-neutral-100" />
          ))}
        </div>
      ) : !data || data.countries.length === 0 ? (
        <p className="py-6 text-center text-body text-neutral-500">{t('users.location.empty')}</p>
      ) : (
        <ul className="space-y-1">
          {data.countries.map((c) => {
            const selected = active === c.country;
            return (
              <li key={c.country}>
                <button
                  type="button"
                  onClick={() => onSelect(c.country)}
                  aria-pressed={selected}
                  className={cn(
                    'w-full rounded-md px-3 py-2 text-left transition-colors',
                    selected ? 'bg-brand-500/10' : 'hover:bg-neutral-50',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-44 shrink-0 truncate font-medium text-neutral-900">
                      <span aria-hidden className="mr-1.5">{flag(c.country)}</span>
                      {countryName(c.country)}
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                      <span
                        className="block h-full rounded-full bg-brand-500"
                        style={{ width: `${(c.users / max) * 100}%` }}
                      />
                    </span>
                    <span className="tnum w-24 shrink-0 text-right text-body text-neutral-900">
                      {formatNumber(c.users)}
                      <span className="ml-1.5 text-caption text-neutral-500">{formatPercent(c.percent, 1)}</span>
                    </span>
                  </div>
                  {c.cities.length > 0 && (
                    <p className="mt-1 truncate pl-[11.75rem] text-caption text-neutral-500">
                      {c.cities.slice(0, 5).map((city) => `${city.city} (${formatNumber(city.users)})`).join(' · ')}
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
