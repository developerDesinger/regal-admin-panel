/**
 * Wire types — the shapes the server actually emits, per the backend's
 * ADMIN_PANEL_API reference. Kept separate from `lib/types.ts` (the fixture
 * shapes) so a backend change is a compile error here rather than a silent
 * mismatch inside a component.
 */

import type { Currency } from '@/lib/format';
import type { AdminRole, AlertType, EventStatus, Occasion, Severity } from '@/lib/types';

export type ContributionStatusApi = 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'refunded';
export type WithdrawalStatusApi =
  | 'none'
  | 'requested'
  | 'validated'
  | 'processing'
  | 'completed'
  | 'failed';
export type StripeAccountStatusApi = 'not_started' | 'pending' | 'verified' | 'restricted';

export interface UserBrief {
  id: string;
  name: string;
  avatarUrl: string | null;
}

/** KPI cards. `delta` is null when `previous` is 0 — render "—", never Infinity%. */
export interface Kpi {
  value: number;
  previous?: number | null;
  delta?: number | null;
  deltaUnit?: 'percent' | 'pp';
  currency?: Currency;
  definition?: string;
  filter?: Record<string, string>;
}

/** Card-downloads KPI carries two counts instead of one value. */
export interface DownloadsKpi extends Omit<Kpi, 'value'> {
  value?: number;
  unique: number;
  total: number;
}

export interface RangeMeta {
  from: string;
  to: string;
  tz: string;
  preset?: string;
}

export interface AggregateMeta {
  dataAsOf?: string;
  range?: RangeMeta;
  [k: string]: unknown;
}

/* -------------------------------------------------------------- auth -- */

export interface AdminSession {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  permissions: string[];
  avatarUrl: string | null;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
}

export interface LoginSuccess {
  admin: AdminSession;
  csrfToken: string;
}

export interface TwoFactorChallenge {
  status: '2fa_required';
  challengeId: string;
  expiresIn: number;
  /** Present only outside production, so 2FA is testable without a mail server. */
  devCode?: string;
}

export type LoginResponse = LoginSuccess | TwoFactorChallenge;

export function isTwoFactorChallenge(r: LoginResponse): r is TwoFactorChallenge {
  return (r as TwoFactorChallenge).status === '2fa_required';
}

export interface RolesResponse {
  permissions: string[];
  roles: Record<AdminRole, { label: string; description: string; permissions: string[] }>;
}

/* --------------------------------------------------------- dashboard -- */

export interface DashboardKpis {
  activeEvents: Kpi;
  eventsCreated: Kpi;
  eventSuccessRate: Kpi;
  avgEventDurationDays: Kpi;
  totalConfirmed: Kpi;
  participationRate: Kpi;
  cardDownloads: DownloadsKpi;
  cloverRedemptionRate: Kpi;
}

export interface TimeseriesPoint {
  date: string;
  eventsCreated: number;
  eventsCompleted: number;
  contributionVolume: number;
  contributionCount: number;
  previousVolume: number;
  reminderSent: boolean;
}

export interface FunnelStage {
  stage: string;
  value: number;
  percentOfSelected?: number;
}

export interface StatusDistributionRow {
  status: EventStatus;
  count: number;
  percent: number;
}

export interface LifecycleTimingRow {
  metric: string;
  label: string;
  definition: string;
  median: number;
  p90: number;
  mean: number;
  unit: 'days' | 'hours';
  /** A median over 3 events is a very different claim from one over 300. */
  sampleSize: number;
  trend: number[];
}

export interface AttentionLists {
  atRisk: {
    id: string;
    name: string;
    progressPercent: number;
    endDate: string;
    goalAmount: number;
    raisedAmount: number;
    currency: Currency;
  }[];
  largestActive: {
    id: string;
    name: string;
    goalAmount: number;
    raisedAmount: number;
    progressPercent: number;
    currency: Currency;
  }[];
  recentlyCompleted: {
    id: string;
    name: string;
    closedAt: string;
    raisedAmount: number;
    currency: Currency;
  }[];
}

/* ------------------------------------------------------------- events -- */

export interface EventRow {
  id: string;
  name: string;
  occasion: Occasion;
  status: EventStatus;
  goalAmount: number;
  raisedAmount: number;
  currency: Currency;
  /** Uncapped — an overfunded event reports 140. */
  progressPercent: number;
  contributorsCount: number;
  totalMembers: number;
  organizer: UserBrief;
  beneficiaryName: string;
  beneficiaryType: 'self' | 'someone_else';
  source: 'personal' | 'group';
  groupName: string | null;
  createdAt: string;
  endDate: string;
  shareSlug: string;
  card: { slug: string; name: string; thumbUrl: string | null } | null;
}

export interface EventWithdrawal {
  status: WithdrawalStatusApi;
  availableBalance: number;
  requestedAmount: number;
  stripeAccountStatus: StripeAccountStatusApi;
  requestedAt: string | null;
  completedAt: string | null;
  failureReason: string | null;
  stripePayoutId: string | null;
}

export interface EventDetailApi extends EventRow {
  personalMessage: string;
  location: string;
  locationUrl: string;
  feePayer: 'contributor' | 'beneficiary';
  publishedAt: string | null;
  halfGoalReachedAt: string | null;
  goalReachedAt: string | null;
  closedAt: string | null;
  deliveredAt: string | null;
  cardRevealed: boolean;
  flaggedAt: string | null;
  flagReason: string | null;
  withdrawal: EventWithdrawal;
}

export interface EventFinancials {
  currency: Currency;
  goalAmount: number;
  /** Every status key is always present, even at zero. */
  byStatus: Record<ContributionStatusApi, { amount: number; count: number }>;
  uniqueContributors: number;
  contributionCount: number;
  averageContribution: number;
  medianContribution: number;
  platformFees: number;
  stripeFees: number;
  netToBeneficiary: number;
}

export interface TimelineRow {
  id: string;
  category: 'event' | 'invitation' | 'contribution' | 'reminder' | 'card' | 'withdrawal' | 'admin';
  title: string;
  description: string;
  actor: string;
  timestamp: string;
  elapsedFromPublicationHours: number | null;
  payload?: Record<string, unknown>;
}

export interface ParticipantRow {
  id: string;
  user: UserBrief;
  invitedAt: string;
  openedAt: string | null;
  contributed: boolean;
  amount: number | null;
  /** null when they arrived via a share link rather than an invitation. */
  decisionTimeHours: number | null;
  paymentStatus: ContributionStatusApi | null;
  remindersReceived: number;
}

export interface EventCardApi {
  slug: string;
  name: string;
  tier: 'standard' | 'premium';
  cloverCostPaid: number;
  revealed: boolean;
  revealedAt: string | null;
  uniqueDownloads: number;
  totalDownloads: number;
  uniqueDownloaders: number;
  timeToFirstViewHours: number | null;
  timeToFirstDownloadHours: number | null;
  errors: { type: string; message: string; occurredAt: string }[];
}

/* ------------------------------------------------------ contributions -- */

export interface ContributionRow {
  id: string;
  eventId: string;
  eventName: string;
  /** null for guests — distinguish by `isGuest`, not by the null. */
  contributor: UserBrief | null;
  isGuest: boolean;
  guestName: string | null;
  guestEmail: string | null;
  amount: number;
  platformFee: number;
  stripeFee: number;
  totalCharged: number;
  creditedAmount: number;
  feePayer: 'contributor' | 'beneficiary';
  currency: Currency;
  status: ContributionStatusApi;
  failureReason: string | null;
  paymentMethod: string;
  stripePaymentIntentId: string;
  cardSlug: string | null;
  revealed: boolean;
  message: string;
  createdAt: string;
}

export interface ContributionDetailApi extends ContributionRow {
  beneficiary: UserBrief;
  fee: number;
  revealedAt: string | null;
  updatedAt: string;
  webhookPayload: Record<string, unknown>;
}

export interface ContributionKpis {
  totalConfirmed: Kpi;
  totalPending: Kpi;
  totalFailed: Kpi;
  totalCancelled: Kpi;
  totalRefunded: Kpi;
  averageContribution: Kpi;
  medianContribution: Kpi;
  /** failed ÷ (succeeded + failed) — pending is not a failure. */
  failureRate: Kpi;
  totalFees: Kpi;
}

export interface ContributionCharts {
  volumeOverTime: (Record<ContributionStatusApi, number> & { date: string })[];
  sizeDistribution: { bucket: string; count: number }[];
  failureReasons: { reason: string; count: number }[];
}

/* -------------------------------------------------------------- users -- */

export interface UserRow {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  /** Check this rather than assuming `?unmask=true` worked. */
  emailMasked: boolean;
  phoneNumber: string;
  avatarUrl: string | null;
  isActive: boolean;
  isVerified: boolean;
  isDeleted: boolean;
  authProviders: ('local' | 'google' | 'apple')[];
  createdAt: string;
  lastLoginAt: string | null;
  cloverBalance: number;
  eventsOrganized: number;
  eventsContributedTo: number;
  invitationsReceived: number;
  /** Capped at 100 — share-link contributions have no invitation. */
  invitationConversionPercent: number;
  totalContributed: number;
  currency: Currency;
}

export interface UserDetailApi extends UserRow {
  averageContribution: number;
  medianDecisionTimeHours: number | null;
  contributionFrequency: number;
  recurrence: { isRecurrent: boolean; eventCount: number };
  paymentStatusProfile: Record<ContributionStatusApi, number>;
  cloverActivity: { earned: number; redeemed: number; adjusted: number; balance: number };
}

export interface UserKpis {
  totalUsers: Kpi;
  newUsers: Kpi;
  activeContributors: Kpi;
  /** 2+ distinct events, not 2+ contributions. */
  recurrentContributors: Kpi;
  avgLifetimeContribution: Kpi;
  usersWithCloverBalance: Kpi;
}

export interface UserCardRow {
  id: string;
  slug: string;
  name: string;
  thumbUrl: string | null;
  tier: 'standard' | 'premium';
  cloverCost: number;
  unlockedAt: string;
  revealed: boolean;
  revealedAt: string | null;
  downloaded: boolean;
  downloadCount: number;
}

/* --------------------------------------------------------- gift cards -- */

export interface CardKpis {
  cardsCreated: Kpi;
  standardCount: Kpi;
  premiumCount: Kpi;
  premiumRedeemedWithClovers: Kpi;
  revealRate: Kpi;
  uniqueDownloads: Kpi;
  totalDownloads: Kpi;
  uniqueDownloaders: Kpi;
  medianTimeToFirstViewHours: Kpi;
  medianTimeToFirstDownloadHours: Kpi;
  cardErrors: Kpi;
}

export interface CardTemplateRow {
  id: string;
  slug: string;
  name: string;
  thumbUrl: string | null;
  timesSelected: number;
  selectionSharePercent: number;
  revealRate: number;
  uniqueDownloads: number;
  totalDownloads: number;
  downloadsPerReveal: number;
  cloverCost: number;
  revenueInClovers: number;
}

export interface CardErrorsResponse {
  series: { date: string; generation: number; loading: number; reveal: number; download: number }[];
  records: {
    id: string;
    type: string;
    cardSlug: string;
    userId: string;
    message: string;
    context: Record<string, unknown>;
    occurredAt: string;
  }[];
}

export interface CatalogRow {
  id: string;
  slug: string;
  name: string;
  categories: Occasion[];
  bg: string;
  emojiKey: string;
  images: { thumb: string; preview: string; full: string };
  cloverCost: number;
  /** Derived from cloverCost, never stored separately. */
  tier: 'standard' | 'premium';
  sortOrder: number;
  isActive: boolean;
  availableFrom: string | null;
  availableUntil: string | null;
  version: number;
  timesSelected: number;
  unlocks: number;
  /** The server's answer — don't infer it from `unlocks === 0`. */
  canHardDelete: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UploadTarget {
  uploadUrl: string;
  assetId: string;
  expiresIn: number;
  method: 'PUT' | 'POST';
  storage: 's3' | 'local';
}

export interface CardVersion {
  version: number;
  images: { thumb: string; preview: string; full: string };
  createdAt: string;
  createdBy: string;
  isCurrent: boolean;
}

/* ------------------------------------------------------------ clovers -- */

export interface CloverKpis {
  cloversEarned: Kpi;
  cloversRedeemed: Kpi;
  outstandingBalance: Kpi;
  redemptionRate: Kpi;
  burnRate: Kpi;
  repeatRedemption: Kpi;
  premiumCardDownloadRate: Kpi;
}

export interface CloverLedgerRow {
  id: string;
  user: UserBrief;
  type: 'earn' | 'redeem';
  action: string;
  /** Signed — positive earns, negative redemptions. */
  amount: number;
  balanceAfter: number;
  reference: { type: string; id: string; label: string } | null;
  note: string;
  adminName: string | null;
  createdAt: string;
}

export interface CloverAnomaly {
  id: string;
  user: UserBrief;
  signal: string;
  magnitude: string;
  detail: string;
  detectedAt: string;
}

/* -------------------------------------------------------- withdrawals -- */

export interface WithdrawalRow {
  id: string;
  beneficiary: UserBrief;
  /** Best-effort: payouts are per-user, not per-event. May be null. */
  eventId: string | null;
  eventName: string | null;
  amount: number;
  currency: Currency;
  status: Exclude<WithdrawalStatusApi, 'none'>;
  stripeAccountStatus: StripeAccountStatusApi;
  stripePayoutId: string | null;
  requestedAt: string;
  completedAt: string | null;
  elapsedHours: number;
  failureReason: string | null;
}

export interface WithdrawalKpis {
  availableForWithdrawal: Kpi;
  requested: Kpi;
  processing: Kpi;
  completedInPeriod: Kpi;
  failed: Kpi;
  medianTimeToPayoutHours: Kpi;
}

/* ------------------------------------------------------------- alerts -- */

export interface AlertTypeRow {
  type: AlertType;
  label: string;
  defaultTrigger: string;
  /** Reflects live Settings — show this, not defaultTrigger. */
  currentTrigger: string;
  severity: Severity;
  openCount: number;
}

export interface AlertRow {
  id: string;
  type: AlertType;
  severity: Severity;
  subject: { type: 'event' | 'user' | 'card' | 'withdrawal' | 'platform'; id: string; label: string };
  triggeredAt: string;
  ageHours: number;
  assignedTo: { id: string; name: string } | null;
  status: 'open' | 'acknowledged' | 'snoozed' | 'resolved' | 'dismissed';
  snoozedUntil: string | null;
  resolvedAt: string | null;
  resolutionReason: string | null;
  /** Always present — the numbers that fired the rule. */
  evidence: { label: string; value: string }[];
}

/* ------------------------------------------------------------ exports -- */

export interface ExportJobRow {
  id: string;
  dataset: string;
  format: 'csv' | 'json';
  filters: string;
  rows: number;
  status: 'queued' | 'running' | 'ready' | 'expired' | 'failed';
  progress: number;
  requestedBy: string;
  requestedAt: string;
  expiresAt: string | null;
  containsPii: boolean;
  errorMessage: string | null;
}

/* -------------------------------------------------------------- audit -- */

export interface AuditRow {
  id: string;
  timestamp: string;
  admin: UserBrief;
  action: string;
  resourceType: string;
  resource: { type: string; id: string; label: string };
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string;
  ip: string;
  userAgent: string;
}

export interface AuditFacets {
  actions: string[];
  resourceTypes: string[];
  admins: { id: string; name: string; email: string }[];
}

/* ------------------------------------------------------------ admins -- */

export interface AdminRow {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

/* ---------------------------------------------------------- settings -- */

export interface SettingsApi {
  alertThresholds: Record<string, number>;
  cloverRules: Record<string, number>;
  financial: {
    platform_fee: number;
    default_fee_payer: string;
    supported_currencies: Currency[];
    /** MAJOR units — an admin config value, not a transaction amount. */
    min_withdrawal: number;
  };
  notifications: { digest: string; routing: Record<string, string[]> };
  branding: {
    logoUrl: string;
    support_email: string;
    terms_url: string;
    privacy_url: string;
    maintenance_mode: boolean;
  };
}

export interface SettingsMeta {
  defaults: Record<string, number | string>;
  notes: Record<string, string>;
}

/* ------------------------------------------------------------ search -- */

export interface SearchHit {
  type: 'event' | 'user' | 'contribution' | 'card';
  id: string;
  title: string;
  subtitle: string;
  href: string;
}
