/**
 * Data access for every screen. All reads come from the admin API — there is
 * no fixture path.
 *
 * Every list hook returns the same `{ rows, meta, isLoading, error, refetch }`
 * shape so a screen can render loading / empty / error states uniformly (§21).
 */

import { useQuery, type QueryKey } from '@tanstack/react-query';
import * as React from 'react';
import i18n from '@/i18n';
import type { PageMeta } from '@/lib/api/client';
import type { AggregateMeta } from '@/lib/api/types';
import {
  adaptAlert,
  adaptAuditEntry,
  adaptCatalogCard,
  adaptCloverTransaction,
  adaptContribution,
  adaptEvent,
  adaptParticipant,
  adaptTimeline,
  adaptUser,
  adaptWithdrawal,
} from '@/lib/api/adapters';
import {
  adminsService,
  alertsService,
  auditService,
  cardAnalyticsService,
  catalogService,
  cloversService,
  contributionsService,
  dashboardService,
  eventsService,
  exportsService,
  searchService,
  settingsService,
  usersService,
  withdrawalsService,
  type Params,
} from '@/lib/api/services';
import type {
  Alert,
  AuditEntry,
  CloverTransaction,
  Contribution,
  GiftCardDesign,
  Participant,
  RegalEvent,
  RegalUser,
  TimelineEntry,
  Withdrawal,
} from '@/lib/types';

/** Uniform result every list screen consumes. */
export interface ListResult<T> {
  rows: T[];
  meta: PageMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

function errorMessage(e: unknown): string | null {
  return e ? ((e as Error).message ?? i18n.t('common.somethingWentWrong')) : null;
}

/** Wraps a paged query into the shared ListResult shape. */
function useListQuery<TApi, TView>(
  key: QueryKey,
  fetcher: () => Promise<{ data: TApi[]; meta?: PageMeta }>,
  adapt: (row: TApi) => TView,
  enabled = true,
): ListResult<TView> {
  const q = useQuery({ queryKey: key, queryFn: fetcher, enabled });
  const rows = React.useMemo(() => (q.data?.data ?? []).map(adapt), [q.data, adapt]);
  return {
    rows,
    meta: q.data?.meta ?? null,
    isLoading: q.isPending && enabled,
    error: errorMessage(q.error),
    refetch: () => void q.refetch(),
  };
}

/** Aggregate (KPI / chart) query — a single object rather than a page of rows. */
function useAggregate<T>(
  key: QueryKey,
  fetcher: () => Promise<{ data: T; meta?: AggregateMeta | PageMeta }>,
) {
  const q = useQuery({ queryKey: key, queryFn: fetcher });
  return {
    data: q.data?.data ?? null,
    meta: (q.data?.meta ?? null) as (AggregateMeta & Partial<PageMeta>) | null,
    isLoading: q.isPending,
    error: errorMessage(q.error),
    refetch: () => void q.refetch(),
  };
}

/* ------------------------------------------------------------ events -- */

export const useEvents = (params: Params, page = 1): ListResult<RegalEvent> =>
  useListQuery(['events', params, page], () => eventsService.list({ ...params, page }), adaptEvent);

export function useEvent(eventId: string | undefined) {
  const q = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => eventsService.detail(eventId!),
    enabled: Boolean(eventId),
  });
  return {
    event: q.data ? adaptEvent(q.data) : null,
    raw: q.data ?? null,
    isLoading: q.isPending,
    error: errorMessage(q.error),
  };
}

export function useEventFinancials(eventId: string | undefined) {
  const q = useQuery({
    queryKey: ['event-financials', eventId],
    queryFn: () => eventsService.financials(eventId!),
    enabled: Boolean(eventId),
  });
  return { financials: q.data ?? null, isLoading: q.isPending, error: errorMessage(q.error) };
}

export function useEventTimeline(eventId: string | undefined): TimelineEntry[] {
  const q = useQuery({
    queryKey: ['event-timeline', eventId],
    queryFn: () => eventsService.timeline(eventId!),
    enabled: Boolean(eventId),
  });
  return React.useMemo(() => (q.data ? adaptTimeline(q.data) : []), [q.data]);
}

export function useEventParticipants(eventId: string | undefined): Participant[] {
  const q = useQuery({
    queryKey: ['event-participants', eventId],
    queryFn: () => eventsService.participants(eventId!),
    enabled: Boolean(eventId),
  });
  return React.useMemo(() => (q.data?.data ?? []).map(adaptParticipant), [q.data]);
}

export function useEventCard(eventId: string | undefined) {
  const q = useQuery({
    queryKey: ['event-card', eventId],
    queryFn: () => eventsService.card(eventId!),
    enabled: Boolean(eventId),
  });
  return { card: q.data ?? null, isLoading: q.isPending };
}

export const useEventActivity = (eventId: string | undefined): ListResult<AuditEntry> =>
  useListQuery(
    ['event-activity', eventId],
    () => eventsService.activity(eventId!),
    adaptAuditEntry,
    Boolean(eventId),
  );

/* ----------------------------------------------------- contributions -- */

export const useContributions = (params: Params, page = 1): ListResult<Contribution> =>
  useListQuery(
    ['contributions', params, page],
    () => contributionsService.list({ ...params, page }),
    adaptContribution,
  );

/* ------------------------------------------------------------- users -- */

export const useUsers = (params: Params, page = 1): ListResult<RegalUser> =>
  useListQuery(['users', params, page], () => usersService.list({ ...params, page }), adaptUser);

export function useUser(userId: string | undefined, unmask = false) {
  const q = useQuery({
    queryKey: ['user', userId, unmask],
    queryFn: () => usersService.detail(userId!, unmask),
    enabled: Boolean(userId),
  });
  return {
    user: q.data ? adaptUser(q.data) : null,
    raw: q.data ?? null,
    isLoading: q.isPending,
    error: errorMessage(q.error),
  };
}

export const useUserEvents = (userId: string | undefined): ListResult<RegalEvent> =>
  useListQuery(['user-events', userId], () => usersService.events(userId!), adaptEvent, Boolean(userId));

export const useUserContributions = (userId: string | undefined): ListResult<Contribution> =>
  useListQuery(
    ['user-contributions', userId],
    () => usersService.contributions(userId!),
    adaptContribution,
    Boolean(userId),
  );

export const useUserClovers = (userId: string | undefined): ListResult<CloverTransaction> =>
  useListQuery(
    ['user-clovers', userId],
    () => usersService.clovers(userId!),
    adaptCloverTransaction,
    Boolean(userId),
  );

export function useUserCards(userId: string | undefined) {
  const q = useQuery({
    queryKey: ['user-cards', userId],
    queryFn: () => usersService.cards(userId!),
    enabled: Boolean(userId),
  });
  return q.data ?? [];
}

export const useUserActivity = (userId: string | undefined): ListResult<AuditEntry> =>
  useListQuery(
    ['user-activity', userId],
    () => usersService.activity(userId!),
    adaptAuditEntry,
    Boolean(userId),
  );

/* ------------------------------------------------------ card catalog -- */

export const useCatalog = (params: Params = {}, page = 1): ListResult<GiftCardDesign> =>
  useListQuery(
    ['catalog', params, page],
    () => catalogService.list({ ...params, page, pageSize: 100 }),
    adaptCatalogCard,
  );

export function useCatalogCard(cardId: string | undefined) {
  const q = useQuery({
    queryKey: ['catalog-card', cardId],
    queryFn: () => catalogService.detail(cardId!),
    enabled: Boolean(cardId),
  });
  return {
    card: q.data ? adaptCatalogCard(q.data) : null,
    raw: q.data ?? null,
    isLoading: q.isPending,
  };
}

export function useCardVersions(cardId: string | undefined) {
  const q = useQuery({
    queryKey: ['card-versions', cardId],
    queryFn: () => catalogService.versions(cardId!),
    enabled: Boolean(cardId),
  });
  return q.data ?? [];
}

/* ----------------------------------------------------------- clovers -- */

export const useCloverLedger = (params: Params = {}, page = 1): ListResult<CloverTransaction> =>
  useListQuery(
    ['clover-ledger', params, page],
    () => cloversService.ledger({ ...params, page }),
    adaptCloverTransaction,
  );

export function useCloverAnomalies() {
  const q = useQuery({ queryKey: ['clover-anomalies'], queryFn: () => cloversService.anomalies() });
  return { anomalies: q.data?.data ?? [], isLoading: q.isPending };
}

/* ------------------------------------------------------- withdrawals -- */

export const useWithdrawals = (params: Params = {}, page = 1): ListResult<Withdrawal> =>
  useListQuery(
    ['withdrawals', params, page],
    () => withdrawalsService.list({ ...params, page }),
    adaptWithdrawal,
  );

/* ------------------------------------------------------------ alerts -- */

export const useAlerts = (params: Params = {}, page = 1): ListResult<Alert> =>
  useListQuery(['alerts', params, page], () => alertsService.list({ ...params, page }), adaptAlert);

export function useAlertTypes() {
  const q = useQuery({ queryKey: ['alert-types'], queryFn: () => alertsService.types() });
  return q.data ?? [];
}

/* ------------------------------------------------------------- audit -- */

export const useAuditTrail = (params: Params = {}, page = 1): ListResult<AuditEntry> =>
  useListQuery(['audit', params, page], () => auditService.list({ ...params, page }), adaptAuditEntry);

/** Distinct values actually present in the trail, for the filter dropdowns. */
export function useAuditFacets() {
  const q = useQuery({ queryKey: ['audit-facets'], queryFn: () => auditService.facets() });
  return q.data ?? { actions: [], resourceTypes: [], admins: [] };
}

/* ------------------------------------------------------------ admins -- */

export function useAdmins() {
  const q = useQuery({ queryKey: ['admins'], queryFn: () => adminsService.list() });
  return {
    admins: q.data?.data ?? [],
    isLoading: q.isPending,
    error: errorMessage(q.error),
    refetch: () => void q.refetch(),
  };
}

export function useRoleMatrix() {
  const q = useQuery({ queryKey: ['role-matrix'], queryFn: () => adminsService.permissions() });
  return q.data ?? null;
}

/* ----------------------------------------------------------- exports -- */

export function useExportJobs() {
  const q = useQuery({
    queryKey: ['exports'],
    queryFn: () => exportsService.list(),
    // Jobs move queued → running → ready server-side, so poll while any is
    // still in flight and stop as soon as they all settle.
    refetchInterval: (query) => {
      const rows = query.state.data?.data ?? [];
      return rows.some((j) => j.status === 'queued' || j.status === 'running') ? 2000 : false;
    },
  });
  return {
    jobs: q.data?.data ?? [],
    isLoading: q.isPending,
    error: errorMessage(q.error),
    refetch: () => void q.refetch(),
  };
}

/* ---------------------------------------------------------- settings -- */

export function useSettings() {
  const q = useQuery({ queryKey: ['settings'], queryFn: () => settingsService.get() });
  return {
    settings: q.data?.data ?? null,
    /** Powers the "Default: 72 · Reset to default" affordance. */
    defaults: (q.data?.meta?.defaults ?? {}) as Record<string, number | string>,
    notes: (q.data?.meta?.notes ?? {}) as Record<string, string>,
    isLoading: q.isPending,
    error: errorMessage(q.error),
    refetch: () => q.refetch(),
  };
}

/* ------------------------------------------------------------ search -- */

export function useSearch(query: string) {
  const q = useQuery({
    queryKey: ['search', query],
    queryFn: () => searchService.query(query),
    // The server returns [] below 2 characters; don't spend a request on it.
    enabled: query.trim().length >= 2,
  });
  return { hits: q.data?.data ?? [], isLoading: q.isPending };
}

/* -------------------------------------------------------- aggregates -- */

export const useDashboardKpis = (p: Params) =>
  useAggregate(['dashboard-kpis', p], () => dashboardService.kpis(p));
export const useDashboardTimeseries = (p: Params) =>
  useAggregate(['dashboard-timeseries', p], () => dashboardService.timeseries(p));
export const useDashboardFunnel = (p: Params) =>
  useAggregate(['dashboard-funnel', p], () => dashboardService.funnel(p));
export const useStatusDistribution = (p: Params) =>
  useAggregate(['status-distribution', p], () => dashboardService.statusDistribution(p));
export const useLifecycleTiming = (p: Params) =>
  useAggregate(['lifecycle-timing', p], () => dashboardService.lifecycleTiming(p));
export const useAttentionLists = (p: Params) =>
  useAggregate(['attention-lists', p], () => dashboardService.attentionLists(p));
export const useContributionKpis = (p: Params) =>
  useAggregate(['contribution-kpis', p], () => contributionsService.kpis(p));
export const useContributionCharts = (p: Params) =>
  useAggregate(['contribution-charts', p], () => contributionsService.charts(p));
export const useUserKpis = (p: Params) => useAggregate(['user-kpis', p], () => usersService.kpis(p));
export const useCardKpis = (p: Params) =>
  useAggregate(['card-kpis', p], () => cardAnalyticsService.kpis(p));
export const useCardTimeseries = (p: Params) =>
  useAggregate(['card-timeseries', p], () => cardAnalyticsService.timeseries(p));
export const useCardTemplates = (p: Params) =>
  useAggregate(['card-templates', p], () => cardAnalyticsService.templates(p));
export const useCardFunnel = (p: Params) =>
  useAggregate(['card-funnel', p], () => cardAnalyticsService.funnel(p));
export const useCardErrors = (p: Params) =>
  useAggregate(['card-errors', p], () => cardAnalyticsService.errors(p));
export const useCloverKpis = (p: Params) =>
  useAggregate(['clover-kpis', p], () => cloversService.kpis(p));
export const useCloverTimeseries = (p: Params) =>
  useAggregate(['clover-timeseries', p], () => cloversService.timeseries(p));
export const useCloverEarnBreakdown = (p: Params) =>
  useAggregate(['clover-earn', p], () => cloversService.earnBreakdown(p));
export const useCloverRedemptionByDesign = (p: Params) =>
  useAggregate(['clover-redemption', p], () => cloversService.redemptionByDesign(p));
export const useWithdrawalKpis = (p: Params) =>
  useAggregate(['withdrawal-kpis', p], () => withdrawalsService.kpis(p));
