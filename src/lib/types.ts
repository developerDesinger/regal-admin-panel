/**
 * Domain types — field names as they exist in `regal-backend` today (§22),
 * plus the fields the panel depends on that are still backend gaps.
 *
 * Vocabulary: the backend calls it `Collection`; the UI says **Event** everywhere.
 */

import type { Currency } from './format';

export type EventStatus =
  | 'draft'
  | 'active'
  | 'published'
  | 'paused'
  | 'goal_reached'
  | 'completed'
  | 'delivered'
  | 'cancelled';

export type ContributionStatus = 'pending' | 'succeeded' | 'failed' | 'cancelled';

export type WithdrawalStatus =
  | 'none'
  | 'requested'
  | 'validated'
  | 'processing'
  | 'completed'
  | 'failed';

export type StripeAccountStatus = 'not_started' | 'pending' | 'verified' | 'restricted';

export type Occasion =
  | 'birthday'
  | 'wedding'
  | 'farewell'
  | 'graduation'
  | 'historical'
  | 'baby'
  | 'thanks'
  | 'holiday'
  | 'general';

export type Severity = 'danger' | 'warning' | 'info';

/** Every status in the panel maps to exactly one badge tone (§2.2). */
export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface UserRef {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
}

/** `Collection` → Event */
export interface RegalEvent {
  id: string;
  name: string;
  occasion: Occasion;
  beneficiaryType: 'self' | 'someone_else';
  beneficiaryName: string;
  goalAmount: number; // minor units
  raisedAmount: number; // minor units
  currency: Currency;
  startDate: string;
  endDate: string;
  personalMessage: string;
  location: string;
  locationUrl: string;
  source: 'personal' | 'group';
  groupName: string | null;
  totalMembers: number;
  contributorsCount: number;
  organizer: UserRef;
  shareSlug: string;
  status: EventStatus;
  createdAt: string;
  /* backend gaps the panel depends on (§22) */
  publishedAt: string | null;
  halfGoalReachedAt: string | null;
  goalReachedAt: string | null;
  closedAt: string | null;
  deliveredAt: string | null;
  cardSlug: string | null;
  cardRevealed: boolean;
  feePayer: 'contributor' | 'beneficiary';
  withdrawalStatus: WithdrawalStatus;
  stripeAccountStatus: StripeAccountStatus;
}

/**
 * How a contribution was paid. `wallet` means it came out of an existing
 * balance — no card, no processor, and nothing that will ever appear on a
 * Stripe or Openpay statement.
 */
export type PaymentProvider = 'stripe' | 'openpay' | 'wallet';

export interface Contribution {
  id: string;
  eventId: string;
  eventName: string;
  contributor: UserRef | null; // absent for guests
  isGuest: boolean;
  guestName: string | null;
  guestEmail: string | null;
  /** Stripe PaymentIntent id or Openpay charge id — see `provider`. */
  stripePaymentIntentId: string;
  /**
   * Which processor took the money, and so: whose dashboard the charge is in,
   * whose schedule `stripeFee` follows, and which API a refund goes through.
   * Openpay MX charges 2.9% + MX$2.50 where Stripe MX charges 3.6% + MX$3.00,
   * so the same gift carries a different fee depending on this.
   */
  provider: PaymentProvider;
  amount: number;
  platformFee: number;
  /** The processor's cut. Named for Stripe historically — see `provider`. */
  stripeFee: number;
  totalCharged: number;
  creditedAmount: number;
  feePayer: 'contributor' | 'beneficiary';
  currency: Currency;
  cardSlug: string | null;
  message: string;
  status: ContributionStatus;
  failureReason: string | null;
  paymentMethod: string;
  revealed: boolean;
  createdAt: string;
}

export interface RegalUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  avatarColor: string;
  isActive: boolean;
  isVerified: boolean;
  isDeleted: boolean;
  lastLoginAt: string | null;
  cloverBalance: number;
  authProviders: ('local' | 'google' | 'apple')[];
  createdAt: string;
  eventsOrganized: number;
  eventsContributedTo: number;
  invitationsReceived: number;
  totalContributed: number; // minor units
  medianDecisionTimeHours: number;
}

export interface GiftCardDesign {
  id: string;
  slug: string;
  name: string;
  /**
   * Category keys, as the category manager holds them — not the `Occasion`
   * union, which is this build's older nine-key list. An admin can add a
   * category, so the vocabulary is data and cannot be a compiled-in type.
   */
  categories: string[];
  bg: string; // hex — artwork background, author-supplied content not a design token
  imageUrl: string | null;
  emojiKey: string;
  cloverCost: number; // 0 = free / standard
  sortOrder: number;
  isActive: boolean;
  availableFrom: string | null;
  availableUntil: string | null;
  version: number;
  timesSelected: number;
  unlocks: number;
  revealRate: number;
  uniqueDownloads: number;
  totalDownloads: number;
  createdAt: string;
}

export interface CloverTransaction {
  id: string;
  user: UserRef;
  type: 'earn' | 'redeem' | 'adjust';
  action: string;
  amount: number; // signed
  balanceAfter: number;
  reference: { label: string; href: string } | null;
  note: string;
  adminName: string | null;
  createdAt: string;
}

export interface Withdrawal {
  id: string;
  beneficiary: UserRef;
  eventId: string;
  eventName: string;
  amount: number;
  currency: Currency;
  status: Exclude<WithdrawalStatus, 'none'>;
  stripeAccountStatus: StripeAccountStatus;
  stripePayoutId: string | null;
  requestedAt: string;
  completedAt: string | null;
  failureReason: string | null;
}

export type AlertType =
  | 'stagnant_event'
  | 'at_risk_event'
  | 'inactive_event'
  | 'payment_friction'
  | 'unrevealed_card'
  | 'premium_card_unused'
  | 'withdrawal_pending'
  | 'clover_anomaly';

export interface Alert {
  id: string;
  type: AlertType;
  severity: Severity;
  subject: { label: string; href: string };
  triggeredAt: string;
  assignedTo: string | null;
  status: 'open' | 'acknowledged' | 'snoozed' | 'resolved' | 'dismissed';
  /** The actual numbers that fired the rule — so the admin needn't go verify it. */
  evidence: { label: string; value: string }[];
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  admin: UserRef;
  action: string;
  resourceType: string;
  resource: { label: string; href: string };
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string;
  ip: string;
  userAgent: string;
}

export type AdminRole = 'super_admin' | 'finance' | 'operations' | 'support' | 'analyst';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  avatarColor: string;
  lastLoginAt: string | null;
  isActive: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
}

export interface ExportJob {
  id: string;
  dataset: string;
  format: 'csv' | 'json';
  filters: string;
  rows: number | null;
  status: 'queued' | 'running' | 'ready' | 'expired' | 'failed';
  progress: number;
  requestedBy: string;
  requestedAt: string;
  expiresAt: string | null;
  containsPii: boolean;
}

export interface TimelineEntry {
  id: string;
  category: 'event' | 'invitation' | 'contribution' | 'reminder' | 'card' | 'withdrawal' | 'admin';
  title: string;
  description: string;
  actor: string;
  timestamp: string;
  elapsedFromPublication: string | null;
  payload?: Record<string, unknown>;
}

export interface Participant {
  id: string;
  user: UserRef;
  invitedAt: string;
  openedAt: string | null;
  contributed: boolean;
  amount: number | null;
  decisionTimeHours: number | null;
  paymentStatus: ContributionStatus | null;
  remindersReceived: number;
}

/** Drill-down descriptor carried by every KpiCard (§21) — no number is a dead end. */
export interface DrillTo {
  resource: 'events' | 'contributions' | 'users' | 'cards' | 'clovers' | 'withdrawals';
  label: string;
  filters: Record<string, string>;
}
