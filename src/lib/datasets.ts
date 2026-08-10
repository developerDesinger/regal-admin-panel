/**
 * Column definitions per dataset, shared by the page-level Export buttons and
 * the Exports screen so a CSV downloaded from either place is identical.
 */

import type { ExportColumn } from './export';
import { moneyCell } from './export';
import type {
  AuditEntry,
  CloverTransaction,
  Contribution,
  GiftCardDesign,
  RegalEvent,
  RegalUser,
  Withdrawal,
} from './types';

export const eventColumns: ExportColumn<RegalEvent>[] = [
  { key: 'id', header: 'Event ID', value: (e) => e.id },
  { key: 'name', header: 'Name', value: (e) => e.name },
  { key: 'occasion', header: 'Occasion', value: (e) => e.occasion },
  { key: 'status', header: 'Status', value: (e) => e.status },
  { key: 'goalAmount', header: 'Goal', value: (e) => moneyCell(e.goalAmount) },
  { key: 'raisedAmount', header: 'Raised', value: (e) => moneyCell(e.raisedAmount) },
  { key: 'currency', header: 'Currency', value: (e) => e.currency },
  {
    key: 'progressPct',
    header: 'Progress %',
    value: (e) => ((e.raisedAmount / e.goalAmount) * 100).toFixed(1),
  },
  { key: 'organizerId', header: 'Organizer ID', value: (e) => e.organizer.id },
  { key: 'organizerName', header: 'Organizer', value: (e) => e.organizer.name },
  { key: 'beneficiaryName', header: 'Beneficiary', value: (e) => e.beneficiaryName },
  { key: 'contributorsCount', header: 'Contributors', value: (e) => e.contributorsCount },
  { key: 'totalMembers', header: 'Invited', value: (e) => e.totalMembers },
  { key: 'source', header: 'Source', value: (e) => e.source },
  { key: 'groupName', header: 'Group', value: (e) => e.groupName ?? '' },
  { key: 'createdAt', header: 'Created at (UTC)', value: (e) => e.createdAt },
  { key: 'endDate', header: 'Ends at (UTC)', value: (e) => e.endDate },
  { key: 'closedAt', header: 'Closed at (UTC)', value: (e) => e.closedAt ?? '' },
  { key: 'shareSlug', header: 'Share slug', value: (e) => e.shareSlug },
];

export const contributionColumns: ExportColumn<Contribution>[] = [
  { key: 'id', header: 'Contribution ID', value: (c) => c.id },
  { key: 'eventId', header: 'Event ID', value: (c) => c.eventId },
  { key: 'eventName', header: 'Event', value: (c) => c.eventName },
  { key: 'contributorId', header: 'Contributor ID', value: (c) => c.contributor?.id ?? '' },
  {
    key: 'contributorName',
    header: 'Contributor',
    value: (c) => c.contributor?.name ?? c.guestName ?? 'Guest',
  },
  { key: 'isGuest', header: 'Guest checkout', value: (c) => c.isGuest },
  { key: 'amount', header: 'Amount', value: (c) => moneyCell(c.amount) },
  { key: 'platformFee', header: 'Platform fee', value: (c) => moneyCell(c.platformFee) },
  { key: 'stripeFee', header: 'Stripe fee', value: (c) => moneyCell(c.stripeFee) },
  { key: 'totalCharged', header: 'Total charged', value: (c) => moneyCell(c.totalCharged) },
  { key: 'creditedAmount', header: 'Credited', value: (c) => moneyCell(c.creditedAmount) },
  { key: 'currency', header: 'Currency', value: (c) => c.currency },
  { key: 'feePayer', header: 'Fee payer', value: (c) => c.feePayer },
  { key: 'status', header: 'Status', value: (c) => c.status },
  { key: 'failureReason', header: 'Failure reason', value: (c) => c.failureReason ?? '' },
  { key: 'paymentMethod', header: 'Payment method', value: (c) => c.paymentMethod },
  {
    key: 'stripePaymentIntentId',
    header: 'Stripe PaymentIntent',
    value: (c) => c.stripePaymentIntentId,
  },
  { key: 'createdAt', header: 'Created at (UTC)', value: (c) => c.createdAt },
];

/** PII columns are flagged so the Exports screen can require `pii:export`. */
export const PII_COLUMNS = new Set([
  'email',
  'phoneNumber',
  'guestEmail',
  'firstName',
  'lastName',
  'contributorName',
  'beneficiaryName',
]);

export const userColumns: ExportColumn<RegalUser>[] = [
  { key: 'id', header: 'User ID', value: (u) => u.id },
  { key: 'firstName', header: 'First name', value: (u) => u.firstName },
  { key: 'lastName', header: 'Last name', value: (u) => u.lastName },
  { key: 'email', header: 'Email', value: (u) => u.email },
  { key: 'phoneNumber', header: 'Phone', value: (u) => u.phoneNumber },
  { key: 'isVerified', header: 'Verified', value: (u) => u.isVerified },
  { key: 'isActive', header: 'Active', value: (u) => u.isActive },
  { key: 'authProviders', header: 'Auth providers', value: (u) => u.authProviders.join(' ') },
  { key: 'eventsOrganized', header: 'Events organized', value: (u) => u.eventsOrganized },
  { key: 'eventsContributedTo', header: 'Events contributed to', value: (u) => u.eventsContributedTo },
  { key: 'invitationsReceived', header: 'Invitations received', value: (u) => u.invitationsReceived },
  { key: 'totalContributed', header: 'Total contributed', value: (u) => moneyCell(u.totalContributed) },
  { key: 'currency', header: 'Currency', value: () => 'MXN' },
  { key: 'cloverBalance', header: 'Clover balance', value: (u) => u.cloverBalance },
  { key: 'createdAt', header: 'Registered at (UTC)', value: (u) => u.createdAt },
  { key: 'lastLoginAt', header: 'Last login (UTC)', value: (u) => u.lastLoginAt ?? '' },
];

export const cardColumns: ExportColumn<GiftCardDesign>[] = [
  { key: 'id', header: 'Card ID', value: (c) => c.id },
  { key: 'slug', header: 'Slug', value: (c) => c.slug },
  { key: 'name', header: 'Name', value: (c) => c.name },
  { key: 'categories', header: 'Categories', value: (c) => c.categories.join(' ') },
  { key: 'cloverCost', header: 'Clover cost', value: (c) => c.cloverCost },
  { key: 'tier', header: 'Tier', value: (c) => (c.cloverCost > 0 ? 'premium' : 'standard') },
  { key: 'isActive', header: 'Active', value: (c) => c.isActive },
  { key: 'sortOrder', header: 'Sort order', value: (c) => c.sortOrder },
  { key: 'timesSelected', header: 'Times selected', value: (c) => c.timesSelected },
  { key: 'unlocks', header: 'Unlocks', value: (c) => c.unlocks },
  { key: 'revealRate', header: 'Reveal rate %', value: (c) => c.revealRate },
  { key: 'uniqueDownloads', header: 'Unique downloads', value: (c) => c.uniqueDownloads },
  { key: 'totalDownloads', header: 'Total downloads', value: (c) => c.totalDownloads },
  { key: 'version', header: 'Version', value: (c) => c.version },
  { key: 'createdAt', header: 'Created at (UTC)', value: (c) => c.createdAt },
];

export const cloverColumns: ExportColumn<CloverTransaction>[] = [
  { key: 'id', header: 'Transaction ID', value: (t) => t.id },
  { key: 'userId', header: 'User ID', value: (t) => t.user.id },
  { key: 'userName', header: 'User', value: (t) => t.user.name },
  { key: 'type', header: 'Type', value: (t) => t.type },
  { key: 'action', header: 'Action', value: (t) => t.action },
  { key: 'amount', header: 'Amount', value: (t) => t.amount },
  { key: 'balanceAfter', header: 'Balance after', value: (t) => t.balanceAfter },
  { key: 'reference', header: 'Reference', value: (t) => t.reference?.label ?? '' },
  { key: 'note', header: 'Note', value: (t) => t.note },
  { key: 'adminName', header: 'Adjusted by', value: (t) => t.adminName ?? '' },
  { key: 'createdAt', header: 'Created at (UTC)', value: (t) => t.createdAt },
];

export const withdrawalColumns: ExportColumn<Withdrawal>[] = [
  { key: 'id', header: 'Withdrawal ID', value: (w) => w.id },
  { key: 'beneficiaryId', header: 'Beneficiary ID', value: (w) => w.beneficiary.id },
  { key: 'beneficiaryName', header: 'Beneficiary', value: (w) => w.beneficiary.name },
  { key: 'eventId', header: 'Event ID', value: (w) => w.eventId },
  { key: 'eventName', header: 'Event', value: (w) => w.eventName },
  { key: 'amount', header: 'Amount', value: (w) => moneyCell(w.amount) },
  { key: 'currency', header: 'Currency', value: (w) => w.currency },
  { key: 'status', header: 'Status', value: (w) => w.status },
  { key: 'stripeAccountStatus', header: 'Connect account', value: (w) => w.stripeAccountStatus },
  { key: 'stripePayoutId', header: 'Stripe payout ID', value: (w) => w.stripePayoutId ?? '' },
  { key: 'requestedAt', header: 'Requested at (UTC)', value: (w) => w.requestedAt },
  { key: 'completedAt', header: 'Completed at (UTC)', value: (w) => w.completedAt ?? '' },
  { key: 'failureReason', header: 'Failure reason', value: (w) => w.failureReason ?? '' },
];

export const auditColumns: ExportColumn<AuditEntry>[] = [
  { key: 'id', header: 'Entry ID', value: (a) => a.id },
  { key: 'timestamp', header: 'Timestamp (UTC)', value: (a) => a.timestamp },
  { key: 'adminId', header: 'Admin ID', value: (a) => a.admin.id },
  { key: 'adminName', header: 'Admin', value: (a) => a.admin.name },
  { key: 'action', header: 'Action', value: (a) => a.action },
  { key: 'resourceType', header: 'Resource type', value: (a) => a.resourceType },
  { key: 'resource', header: 'Resource', value: (a) => a.resource.label },
  { key: 'before', header: 'Before', value: (a) => (a.before ? JSON.stringify(a.before) : '') },
  { key: 'after', header: 'After', value: (a) => (a.after ? JSON.stringify(a.after) : '') },
  { key: 'reason', header: 'Reason', value: (a) => a.reason },
  { key: 'ip', header: 'IP address', value: (a) => a.ip },
  { key: 'userAgent', header: 'User agent', value: (a) => a.userAgent },
];
