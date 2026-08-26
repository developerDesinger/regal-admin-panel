/**
 * Wire → view adapters.
 *
 * The components were built against the fixture shapes in `lib/types.ts`. The
 * API's shapes are close but not identical (`organizer.avatarUrl` vs a colour
 * class, `card` as an object rather than a slug, `refunded` as a fifth
 * contribution status). Translating here keeps that difference in one file
 * instead of scattering `?? ''` through every screen.
 */

import type {
  Alert,
  AuditEntry,
  CloverTransaction,
  Contribution,
  ContributionStatus,
  GiftCardDesign,
  Participant,
  RegalEvent,
  RegalUser,
  TimelineEntry,
  UserRef,
  Withdrawal,
} from '@/lib/types';
import type {
  AlertRow,
  AuditRow,
  CatalogRow,
  CloverLedgerRow,
  ContributionRow,
  ContributionStatusApi,
  EventDetailApi,
  EventRow,
  ParticipantRow,
  TimelineRow,
  UserBrief,
  UserRow,
  WithdrawalRow,
} from './types';

/** Deterministic avatar tint from an id, so a user keeps the same colour. */
const AVATAR_COLORS = [
  'bg-brand-500',
  'bg-info-500',
  'bg-success-500',
  'bg-secondary-500',
  'bg-accent-500',
  'bg-chart-6',
];

export function avatarColorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function toUserRef(u: UserBrief, email = ''): UserRef {
  return { id: u.id, name: u.name, email, avatarColor: avatarColorFor(u.id) };
}

/**
 * `refunded` has no fixture equivalent. The financial panels read it straight
 * off the API response, so only the row-level status needs narrowing — and
 * showing a refund as "cancelled" would misstate the accounting, so it maps to
 * its own badge via the raw string instead.
 */
export function toContributionStatus(s: ContributionStatusApi): ContributionStatus {
  return s === 'refunded' ? 'cancelled' : s;
}

export function adaptEvent(e: EventRow | EventDetailApi): RegalEvent {
  const detail = e as Partial<EventDetailApi>;
  return {
    id: e.id,
    name: e.name,
    occasion: e.occasion,
    beneficiaryType: e.beneficiaryType,
    beneficiaryName: e.beneficiaryName,
    goalAmount: e.goalAmount,
    raisedAmount: e.raisedAmount,
    currency: e.currency,
    startDate: e.createdAt,
    endDate: e.endDate,
    personalMessage: detail.personalMessage ?? '',
    location: detail.location ?? '',
    locationUrl: detail.locationUrl ?? '',
    source: e.source,
    groupName: e.groupName,
    totalMembers: e.totalMembers,
    contributorsCount: e.contributorsCount,
    organizer: toUserRef(e.organizer),
    shareSlug: e.shareSlug,
    status: e.status,
    createdAt: e.createdAt,
    publishedAt: detail.publishedAt ?? null,
    halfGoalReachedAt: detail.halfGoalReachedAt ?? null,
    goalReachedAt: detail.goalReachedAt ?? null,
    closedAt: detail.closedAt ?? null,
    deliveredAt: detail.deliveredAt ?? null,
    cardSlug: e.card?.slug ?? null,
    cardRevealed: detail.cardRevealed ?? false,
    feePayer: detail.feePayer ?? 'contributor',
    withdrawalStatus: detail.withdrawal?.status ?? 'none',
    stripeAccountStatus: detail.withdrawal?.stripeAccountStatus ?? 'not_started',
  };
}

export function adaptContribution(c: ContributionRow): Contribution {
  return {
    id: c.id,
    eventId: c.eventId,
    eventName: c.eventName,
    contributor: c.contributor ? toUserRef(c.contributor) : null,
    isGuest: c.isGuest,
    guestName: c.guestName,
    guestEmail: c.guestEmail,
    stripePaymentIntentId: c.stripePaymentIntentId,
    // Defaulted rather than left undefined: every row predating Openpay was a
    // Stripe charge, and a blank processor column would read as "unknown".
    provider: c.provider ?? 'stripe',
    amount: c.amount,
    platformFee: c.platformFee,
    stripeFee: c.stripeFee,
    totalCharged: c.totalCharged,
    creditedAmount: c.creditedAmount,
    feePayer: c.feePayer,
    currency: c.currency,
    cardSlug: c.cardSlug,
    message: c.message,
    status: toContributionStatus(c.status),
    failureReason: c.failureReason,
    paymentMethod: c.paymentMethod,
    revealed: c.revealed,
    createdAt: c.createdAt,
  };
}

export function adaptUser(u: UserRow): RegalUser {
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    phoneNumber: u.phoneNumber,
    avatarColor: avatarColorFor(u.id),
    isActive: u.isActive,
    isVerified: u.isVerified,
    isDeleted: u.isDeleted,
    lastLoginAt: u.lastLoginAt,
    cloverBalance: u.cloverBalance,
    authProviders: u.authProviders,
    createdAt: u.createdAt,
    eventsOrganized: u.eventsOrganized,
    eventsContributedTo: u.eventsContributedTo,
    invitationsReceived: u.invitationsReceived,
    totalContributed: u.totalContributed,
    medianDecisionTimeHours: 0,
  };
}

export function adaptCatalogCard(c: CatalogRow): GiftCardDesign {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    categories: c.categories,
    bg: c.bg,
    imageUrl: c.images?.preview ?? null,
    emojiKey: c.emojiKey,
    cloverCost: c.cloverCost,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    availableFrom: c.availableFrom,
    availableUntil: c.availableUntil,
    version: c.version,
    timesSelected: c.timesSelected,
    unlocks: c.unlocks,
    revealRate: 0,
    uniqueDownloads: 0,
    totalDownloads: 0,
    createdAt: c.createdAt,
  };
}

export function adaptCloverTransaction(t: CloverLedgerRow): CloverTransaction {
  return {
    id: t.id,
    user: toUserRef(t.user),
    // The ledger stores admin adjustments as earn/redeem; the UI shows them
    // as their own type so they can be told apart from organic activity.
    type: t.action === 'admin_adjustment' ? 'adjust' : t.type,
    action: t.action,
    amount: t.amount,
    balanceAfter: t.balanceAfter,
    reference: t.reference
      ? { label: t.reference.label, href: referenceHref(t.reference) }
      : null,
    note: t.note,
    adminName: t.adminName,
    createdAt: t.createdAt,
  };
}

function referenceHref(ref: { type: string; id: string }): string {
  switch (ref.type) {
    case 'event':
      return `/events/${ref.id}`;
    case 'user':
      return `/users/${ref.id}`;
    case 'gift_card':
    case 'card':
      return `/cards/catalog/${ref.id}`;
    default:
      return '#';
  }
}

export function adaptWithdrawal(w: WithdrawalRow): Withdrawal {
  return {
    id: w.id,
    beneficiary: toUserRef(w.beneficiary),
    // Payouts are per-user, not per-event: eventId is best-effort and nullable.
    eventId: w.eventId ?? '',
    eventName: w.eventName ?? '—',
    amount: w.amount,
    currency: w.currency,
    status: w.status,
    stripeAccountStatus: w.stripeAccountStatus,
    stripePayoutId: w.stripePayoutId,
    requestedAt: w.requestedAt,
    completedAt: w.completedAt,
    failureReason: w.failureReason,
  };
}

export function adaptAlert(a: AlertRow): Alert {
  return {
    id: a.id,
    type: a.type,
    severity: a.severity,
    subject: { label: a.subject.label, href: subjectHref(a.subject) },
    triggeredAt: a.triggeredAt,
    assignedTo: a.assignedTo?.name ?? null,
    status: a.status,
    evidence: a.evidence,
  };
}

function subjectHref(s: { type: string; id: string }): string {
  switch (s.type) {
    case 'event':
      return `/events/${s.id}`;
    case 'user':
      return `/users/${s.id}`;
    case 'card':
      return `/cards/catalog/${s.id}`;
    case 'withdrawal':
      return '/withdrawals';
    default:
      return '/alerts';
  }
}

export function adaptAuditEntry(a: AuditRow): AuditEntry {
  return {
    id: a.id,
    timestamp: a.timestamp,
    admin: toUserRef(a.admin),
    action: a.action,
    resourceType: a.resourceType,
    resource: { label: a.resource.label, href: referenceHref(a.resource) },
    before: a.before,
    after: a.after,
    reason: a.reason,
    ip: a.ip,
    userAgent: a.userAgent,
  };
}

export function adaptTimeline(rows: TimelineRow[]): TimelineEntry[] {
  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    title: r.title,
    description: r.description,
    actor: r.actor,
    timestamp: r.timestamp,
    elapsedFromPublication:
      r.elapsedFromPublicationHours == null
        ? null
        : `${r.elapsedFromPublicationHours.toFixed(1)}h from publication`,
    payload: r.payload,
  }));
}

export function adaptParticipant(p: ParticipantRow): Participant {
  return {
    id: p.id,
    user: toUserRef(p.user),
    invitedAt: p.invitedAt,
    openedAt: p.openedAt,
    contributed: p.contributed,
    amount: p.amount,
    decisionTimeHours: p.decisionTimeHours,
    paymentStatus: p.paymentStatus ? toContributionStatus(p.paymentStatus) : null,
    remindersReceived: p.remindersReceived,
  };
}
