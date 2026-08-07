/**
 * Data access for every screen.
 *
 * Each hook resolves EITHER the fixtures in lib/mock/data.ts OR the real API,
 * decided once by `usingMockData` (VITE_DATA_SOURCE). Screens call the hook and
 * never learn which; that keeps the switch to a single env var instead of a
 * conditional in twenty components.
 *
 * The mock path deliberately returns the same `{ rows, meta, isLoading, error }`
 * shape as the API path, including client-side filtering and paging, so a
 * screen behaves identically either way.
 */

import { useQuery, useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import * as React from 'react';
import { usingMockData, type PageMeta } from '@/lib/api/client';
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
  alertsService,
  auditService,
  cardAnalyticsService,
  catalogService,
  cloversService,
  contributionsService,
  dashboardService,
  eventsService,
  usersService,
  withdrawalsService,
  type Params,
} from '@/lib/api/services';
import { useStore } from '@/lib/store';
import { participantsForEvent, timelineForEvent } from '@/lib/mock/data';
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
  /** True when the rows came from fixtures rather than the backend. */
  isMock: boolean;
}

const PAGE_SIZE = 25;

/** Client-side paging for the fixture path, mirroring the server's meta. */
function paginate<T>(all: T[], page: number, pageSize = PAGE_SIZE) {
  const start = (page - 1) * pageSize;
  return {
    rows: all.slice(start, start + pageSize),
    meta: {
      page,
      pageSize,
      totalRows: all.length,
      totalPages: Math.max(1, Math.ceil(all.length / pageSize)),
    } satisfies PageMeta,
  };
}

function mockResult<T>(rows: T[], page = 1): ListResult<T> {
  const paged = paginate(rows, page);
  return {
    ...paged,
    isLoading: false,
    error: null,
    refetch: () => {},
    isMock: true,
  };
}

/** Wraps a react-query result into the shared ListResult shape. */
function useListQuery<TApi, TView>(
  key: QueryKey,
  fetcher: () => Promise<{ data: TApi[]; meta?: PageMeta }>,
  adapt: (row: TApi) => TView,
  enabled = true,
): ListResult<TView> {
  const q = useQuery({
    queryKey: key,
    queryFn: fetcher,
    enabled: enabled && !usingMockData,
  });

  return {
    rows: React.useMemo(() => (q.data?.data ?? []).map(adapt), [q.data, adapt]),
    meta: q.data?.meta ?? null,
    isLoading: q.isPending,
    error: q.error ? (q.error as Error).message : null,
    refetch: () => void q.refetch(),
    isMock: false,
  };
}

/* ------------------------------------------------------------ events -- */

export function useEvents(params: Params, page = 1): ListResult<RegalEvent> {
  const { events } = useStore();
  const query = useListQuery(
    ['events', params, page],
    () => eventsService.list({ ...params, page }),
    adaptEvent,
  );

  const filtered = React.useMemo(() => filterEventsLocally(events, params), [events, params]);
  return usingMockData ? mockResult(filtered, page) : query;
}

function filterEventsLocally(events: RegalEvent[], p: Params): RegalEvent[] {
  const s = (k: string) => (p[k] == null ? '' : String(p[k]));
  return events.filter((e) => {
    if (s('status') && s('status') !== 'all' && e.status !== s('status')) return false;
    if (s('occasion') && s('occasion') !== 'all' && e.occasion !== s('occasion')) return false;
    if (s('source') && s('source') !== 'all' && e.source !== s('source')) return false;
    if (s('currency') && s('currency') !== 'all' && e.currency !== s('currency')) return false;
    if (s('card') === 'yes' && !e.cardSlug) return false;
    if (s('card') === 'no' && e.cardSlug) return false;
    if (s('progress') && s('progress') !== 'all') {
      const pct = (e.raisedAmount / e.goalAmount) * 100;
      const ranges: Record<string, [number, number]> = {
        '0-25': [0, 25],
        '25-50': [25, 50],
        '50-75': [50, 75],
        '75-99': [75, 99.999],
        '100': [100, Infinity],
      };
      const [lo, hi] = ranges[s('progress')] ?? [0, Infinity];
      if (pct < lo || pct >= hi) return false;
    }
    if (s('q')) {
      const q = s('q').toLowerCase();
      const hay = `${e.name} ${e.organizer.name} ${e.beneficiaryName} ${e.id} ${e.shareSlug}`;
      if (!hay.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

export function useEvent(eventId: string | undefined) {
  const { events } = useStore();
  const q = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => eventsService.detail(eventId!),
    enabled: Boolean(eventId) && !usingMockData,
  });

  if (usingMockData) {
    const event = events.find((e) => e.id === eventId) ?? null;
    return { event, isLoading: false, error: null as string | null, isMock: true };
  }
  return {
    event: q.data ? adaptEvent(q.data) : null,
    isLoading: q.isPending,
    error: q.error ? (q.error as Error).message : null,
    isMock: false,
  };
}

export function useEventTimeline(eventId: string | undefined): TimelineEntry[] {
  const q = useQuery({
    queryKey: ['event-timeline', eventId],
    queryFn: () => eventsService.timeline(eventId!),
    enabled: Boolean(eventId) && !usingMockData,
  });
  if (usingMockData) return eventId ? timelineForEvent(eventId) : [];
  return q.data ? adaptTimeline(q.data) : [];
}

export function useEventParticipants(eventId: string | undefined): Participant[] {
  const q = useQuery({
    queryKey: ['event-participants', eventId],
    queryFn: () => eventsService.participants(eventId!),
    enabled: Boolean(eventId) && !usingMockData,
  });
  if (usingMockData) return eventId ? participantsForEvent(eventId) : [];
  return (q.data?.data ?? []).map(adaptParticipant);
}

/* ----------------------------------------------------- contributions -- */

export function useContributions(params: Params, page = 1): ListResult<Contribution> {
  const { contributions } = useStore();
  const query = useListQuery(
    ['contributions', params, page],
    () => contributionsService.list({ ...params, page }),
    adaptContribution,
  );

  const filtered = React.useMemo(
    () => filterContributionsLocally(contributions, params),
    [contributions, params],
  );
  return usingMockData ? mockResult(filtered, page) : query;
}

function filterContributionsLocally(rows: Contribution[], p: Params): Contribution[] {
  const s = (k: string) => (p[k] == null ? '' : String(p[k]));
  return rows.filter((c) => {
    if (s('status') && s('status') !== 'all' && c.status !== s('status')) return false;
    if (s('eventId') && c.eventId !== s('eventId')) return false;
    if (s('guest') === 'guest' && !c.isGuest) return false;
    if (s('guest') === 'registered' && c.isGuest) return false;
    if (s('feePayer') && s('feePayer') !== 'all' && c.feePayer !== s('feePayer')) return false;
    if (s('method') && s('method') !== 'all' && !c.paymentMethod.startsWith(s('method'))) return false;
    if (s('amount') && s('amount') !== 'all') {
      const major = c.amount / 100;
      const ranges: Record<string, [number, number]> = {
        '0-50': [0, 50],
        '50-100': [50, 100],
        '100-250': [100, 250],
        '250-500': [250, 500],
        '500+': [500, Infinity],
      };
      const [lo, hi] = ranges[s('amount')] ?? [0, Infinity];
      if (major < lo || major >= hi) return false;
    }
    if (s('q')) {
      const q = s('q').toLowerCase();
      const hay = `${c.id} ${c.stripePaymentIntentId} ${c.eventName} ${c.contributor?.name ?? ''} ${c.guestName ?? ''} ${c.guestEmail ?? ''}`;
      if (!hay.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

/* ------------------------------------------------------------- users -- */

export function useUsers(params: Params, page = 1): ListResult<RegalUser> {
  const { users } = useStore();
  const query = useListQuery(
    ['users', params, page],
    () => usersService.list({ ...params, page }),
    adaptUser,
  );

  const filtered = React.useMemo(() => filterUsersLocally(users, params), [users, params]);
  return usingMockData ? mockResult(filtered, page) : query;
}

function filterUsersLocally(users: RegalUser[], p: Params): RegalUser[] {
  const s = (k: string) => (p[k] == null ? '' : String(p[k]));
  return users.filter((u) => {
    if (s('verified') === 'yes' && !u.isVerified) return false;
    if (s('verified') === 'no' && u.isVerified) return false;
    if (s('state') === 'active' && (!u.isActive || u.isDeleted)) return false;
    if (s('state') === 'deleted' && !u.isDeleted) return false;
    if (s('provider') && s('provider') !== 'all' && !u.authProviders.includes(s('provider') as 'local'))
      return false;
    if (s('activity') === 'contributed' && u.eventsContributedTo === 0) return false;
    if (s('activity') === 'organized' && u.eventsOrganized === 0) return false;
    if (s('clovers') === 'has' && u.cloverBalance === 0) return false;
    if (s('clovers') === 'none' && u.cloverBalance > 0) return false;
    if (s('q')) {
      const q = s('q').toLowerCase();
      if (!`${u.firstName} ${u.lastName} ${u.email} ${u.id}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

export function useUser(userId: string | undefined) {
  const { users } = useStore();
  const q = useQuery({
    queryKey: ['user', userId],
    queryFn: () => usersService.detail(userId!),
    enabled: Boolean(userId) && !usingMockData,
  });

  if (usingMockData) {
    return { user: users.find((u) => u.id === userId) ?? null, isLoading: false, isMock: true };
  }
  return { user: q.data ? adaptUser(q.data) : null, isLoading: q.isPending, isMock: false };
}

/* ------------------------------------------------------ card catalog -- */

export function useCatalog(params: Params = {}, page = 1): ListResult<GiftCardDesign> {
  const { giftCards } = useStore();
  const query = useListQuery(
    ['catalog', params, page],
    () => catalogService.list({ ...params, page, pageSize: 100 }),
    adaptCatalogCard,
  );
  return usingMockData ? mockResult(giftCards, page) : query;
}

/* ----------------------------------------------------------- clovers -- */

export function useCloverLedger(params: Params = {}, page = 1): ListResult<CloverTransaction> {
  const { cloverLedger } = useStore();
  const query = useListQuery(
    ['clover-ledger', params, page],
    () => cloversService.ledger({ ...params, page }),
    adaptCloverTransaction,
  );
  return usingMockData ? mockResult(cloverLedger, page) : query;
}

/* ------------------------------------------------------- withdrawals -- */

export function useWithdrawals(params: Params = {}, page = 1): ListResult<Withdrawal> {
  const { withdrawals } = useStore();
  const query = useListQuery(
    ['withdrawals', params, page],
    () => withdrawalsService.list({ ...params, page }),
    adaptWithdrawal,
  );

  const filtered = React.useMemo(() => {
    const s = (k: string) => (params[k] == null ? '' : String(params[k]));
    return withdrawals.filter((w) => {
      if (s('status') && s('status') !== 'all' && w.status !== s('status')) return false;
      if (s('account') && s('account') !== 'all' && w.stripeAccountStatus !== s('account'))
        return false;
      if (s('q')) {
        const q = s('q').toLowerCase();
        const hay = `${w.beneficiary.name} ${w.eventName} ${w.stripePayoutId ?? ''}`;
        if (!hay.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [withdrawals, params]);

  return usingMockData ? mockResult(filtered, page) : query;
}

/* ------------------------------------------------------------ alerts -- */

export function useAlerts(params: Params = {}, page = 1): ListResult<Alert> {
  const { alerts } = useStore();
  const query = useListQuery(
    ['alerts', params, page],
    () => alertsService.list({ ...params, page }),
    adaptAlert,
  );

  const filtered = React.useMemo(() => {
    const s = (k: string) => (params[k] == null ? '' : String(params[k]));
    return alerts.filter((a) => {
      if (s('type') && a.type !== s('type')) return false;
      if (s('state') && s('state') !== 'all' && a.status !== s('state')) return false;
      return true;
    });
  }, [alerts, params]);

  return usingMockData ? mockResult(filtered, 1) : query;
}

/* ------------------------------------------------------------- audit -- */

export function useAuditTrail(params: Params = {}, page = 1): ListResult<AuditEntry> {
  const { auditEntries } = useStore();
  const query = useListQuery(
    ['audit', params, page],
    () => auditService.list({ ...params, page }),
    adaptAuditEntry,
  );

  const filtered = React.useMemo(() => {
    const s = (k: string) => (params[k] == null ? '' : String(params[k]));
    return auditEntries.filter((e) => {
      if (s('adminId') && s('adminId') !== 'all' && e.admin.id !== s('adminId')) return false;
      if (s('action') && s('action') !== 'all' && e.action !== s('action')) return false;
      if (s('resourceType') && s('resourceType') !== 'all' && e.resourceType !== s('resourceType'))
        return false;
      if (s('q')) {
        const q = s('q').toLowerCase();
        const hay = `${e.action} ${e.admin.name} ${e.resource.label} ${e.id} ${e.ip}`;
        if (!hay.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [auditEntries, params]);

  return usingMockData ? mockResult(filtered, page) : query;
}

/* -------------------------------------------------------- aggregates -- */

/**
 * Aggregate endpoints (KPIs, charts) have no fixture equivalent that is worth
 * faking twice — the screens already compute their own numbers from the
 * fixtures. These return `null` on the mock path and the screen keeps its
 * existing local computation as the fallback.
 */
function useAggregate<T>(
  key: QueryKey,
  fetcher: () => Promise<{ data: T; meta?: AggregateMeta | PageMeta }>,
) {
  const q = useQuery({ queryKey: key, queryFn: fetcher, enabled: !usingMockData });
  return {
    data: usingMockData ? null : (q.data?.data ?? null),
    meta: usingMockData ? null : ((q.data?.meta ?? null) as (AggregateMeta & Partial<PageMeta>) | null),
    isLoading: usingMockData ? false : q.isPending,
    error: q.error ? (q.error as Error).message : null,
  };
}

export const useDashboardKpis = (p: Params) => useAggregate(['dashboard-kpis', p], () => dashboardService.kpis(p));
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
export const useCardKpis = (p: Params) => useAggregate(['card-kpis', p], () => cardAnalyticsService.kpis(p));
export const useCardTemplates = (p: Params) =>
  useAggregate(['card-templates', p], () => cardAnalyticsService.templates(p));
export const useCardFunnel = (p: Params) =>
  useAggregate(['card-funnel', p], () => cardAnalyticsService.funnel(p));
export const useCardErrors = (p: Params) =>
  useAggregate(['card-errors', p], () => cardAnalyticsService.errors(p));
export const useCloverKpis = (p: Params) => useAggregate(['clover-kpis', p], () => cloversService.kpis(p));
export const useWithdrawalKpis = (p: Params) =>
  useAggregate(['withdrawal-kpis', p], () => withdrawalsService.kpis(p));

/* -------------------------------------------------------- mutations -- */

/**
 * Wraps a mutation so the affected queries refetch afterwards. On the mock
 * path the store mutation already re-renders, so this is a no-op there.
 */
export function useApiMutation<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  invalidate: QueryKey[] = [],
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      invalidate.forEach((key) => void qc.invalidateQueries({ queryKey: key }));
    },
  });
}
