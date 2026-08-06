/**
 * Mock dataset for the Regal admin panel.
 *
 * The backend gaps listed in §22 (lifecycle timestamps, invitations, card event
 * log, payouts, audit log) do not exist yet, so the whole panel is delivered
 * against this fixture — as the spec instructs, the UI work is not blocked.
 * Every record is generated from a fixed seed and the NOW anchor.
 */

import type {
  Alert,
  AdminUser,
  AuditEntry,
  Contribution,
  ContributionStatus,
  CloverTransaction,
  EventStatus,
  ExportJob,
  GiftCardDesign,
  Occasion,
  Participant,
  RegalEvent,
  RegalUser,
  TimelineEntry,
  UserRef,
  Withdrawal,
} from '../types';
import {
  AVATAR_COLORS,
  FIRST_NAMES,
  LAST_NAMES,
  NOW,
  between,
  daysAgo,
  daysAhead,
  makeRng,
  pick,
} from './seed';

const rng = makeRng(20260806);

/* ------------------------------------------------------------------ users -- */

const OCCASIONS: Occasion[] = [
  'birthday', 'wedding', 'farewell', 'graduation', 'baby', 'thanks', 'holiday', 'general',
];

export const users: RegalUser[] = Array.from({ length: 64 }, (_, i) => {
  const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
  const lastName = LAST_NAMES[(i * 7) % LAST_NAMES.length];
  const providers: RegalUser['authProviders'] = [];
  if (rng() > 0.35) providers.push('local');
  if (rng() > 0.55) providers.push('google');
  if (rng() > 0.8) providers.push('apple');
  if (providers.length === 0) providers.push('local');

  const contributedTo = between(rng, 0, 9);
  return {
    id: `usr_${(1000 + i).toString(36)}${i}`,
    firstName,
    lastName,
    email: `${firstName.toLowerCase().replace(/[íáéó]/g, 'i')}.${lastName
      .toLowerCase()
      .replace(/[íáéóñ]/g, 'n')}@${pick(rng, ['gmail.com', 'outlook.com', 'regal.app', 'icloud.com'])}`,
    phoneNumber: `+52 55 ${between(rng, 1000, 9999)} ${between(rng, 1000, 9999)}`,
    avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
    isActive: rng() > 0.07,
    isVerified: rng() > 0.18,
    isDeleted: rng() > 0.96,
    lastLoginAt: rng() > 0.1 ? daysAgo(between(rng, 0, 60)) : null,
    cloverBalance: rng() > 0.25 ? between(rng, 0, 1800) : 0,
    authProviders: providers,
    createdAt: daysAgo(between(rng, 5, 420)),
    eventsOrganized: between(rng, 0, 4),
    eventsContributedTo: contributedTo,
    invitationsReceived: contributedTo + between(rng, 0, 8),
    totalContributed: contributedTo * between(rng, 8_000, 45_000),
    medianDecisionTimeHours: Number((rng() * 60 + 1).toFixed(1)),
  };
});

export const userRef = (u: RegalUser): UserRef => ({
  id: u.id,
  name: `${u.firstName} ${u.lastName}`,
  email: u.email,
  avatarColor: u.avatarColor,
});

/* ----------------------------------------------------------------- events -- */

const EVENT_NAME_TEMPLATES: Record<Occasion, string[]> = {
  birthday: ["{n}'s Birthday", "Sorpresa para {n}", "{n} cumple años"],
  wedding: ['{n} & Partner Wedding', 'Boda de {n}'],
  farewell: ['Farewell {n}', 'Despedida de {n}'],
  graduation: ['{n} Graduation', 'Graduación {n}'],
  baby: ['Baby shower {n}', "{n}'s Baby Fund"],
  thanks: ['Thank you {n}', 'Gracias {n}'],
  holiday: ['Holiday gift for {n}', 'Navidad {n}'],
  general: ['Gift for {n}', 'Regalo para {n}'],
};

const EVENT_STATUSES: { status: EventStatus; weight: number }[] = [
  { status: 'active', weight: 34 },
  { status: 'completed', weight: 26 },
  { status: 'goal_reached', weight: 8 },
  { status: 'delivered', weight: 10 },
  { status: 'published', weight: 6 },
  { status: 'paused', weight: 5 },
  { status: 'draft', weight: 4 },
  { status: 'cancelled', weight: 7 },
];

function weightedStatus(): EventStatus {
  const total = EVENT_STATUSES.reduce((s, x) => s + x.weight, 0);
  let r = rng() * total;
  for (const s of EVENT_STATUSES) {
    r -= s.weight;
    if (r <= 0) return s.status;
  }
  return 'active';
}

export const events: RegalEvent[] = Array.from({ length: 48 }, (_, i) => {
  const organizer = users[(i * 3) % users.length];
  const beneficiaryUser = users[(i * 5 + 2) % users.length];
  const occasion = OCCASIONS[i % OCCASIONS.length];
  const beneficiaryType: RegalEvent['beneficiaryType'] = rng() > 0.7 ? 'self' : 'someone_else';
  const beneficiaryName =
    beneficiaryType === 'self'
      ? `${organizer.firstName} ${organizer.lastName}`
      : `${beneficiaryUser.firstName} ${beneficiaryUser.lastName}`;

  const status = weightedStatus();
  const createdDaysAgo = between(rng, 1, 180);
  const goalAmount = between(rng, 15, 900) * 10_000; // 1,500 – 90,000 MXN in centavos
  const progress =
    status === 'completed' || status === 'delivered' || status === 'goal_reached'
      ? 1 + rng() * 0.25
      : status === 'cancelled'
        ? rng() * 0.4
        : status === 'draft'
          ? 0
          : rng() * 1.05;
  const raisedAmount = Math.round(goalAmount * progress);
  const published = status !== 'draft';
  const publishedDaysAgo = createdDaysAgo - between(rng, 0, 2);
  const closed = ['completed', 'delivered', 'cancelled'].includes(status);
  const endsIn = createdDaysAgo - between(rng, 5, 45);

  const template = pick(rng, EVENT_NAME_TEMPLATES[occasion]);
  const source: RegalEvent['source'] = rng() > 0.65 ? 'group' : 'personal';

  return {
    id: `evt_${(2000 + i).toString(36)}${i}`,
    name: template.replace('{n}', beneficiaryName.split(' ')[0]),
    occasion,
    beneficiaryType,
    beneficiaryName,
    goalAmount,
    raisedAmount,
    currency: 'MXN',
    startDate: daysAgo(createdDaysAgo),
    endDate: endsIn > 0 ? daysAgo(endsIn) : daysAhead(-endsIn),
    personalMessage: pick(rng, [
      '¡Felicidades! Que cumplas muchos más.',
      'Un pequeño detalle de todo el equipo.',
      'Te vamos a extrañar muchísimo. ¡Mucho éxito!',
      'Gracias por todo lo que haces por nosotros.',
    ]),
    location: pick(rng, ['Polanco, CDMX', 'Guadalajara, JAL', 'Monterrey, NL', 'Mérida, YUC']),
    locationUrl: 'https://maps.google.com/?q=19.4326,-99.1332',
    source,
    groupName: source === 'group' ? pick(rng, ['Colegio Alemán 6°B', 'Equipo Producto', 'Familia Torres', 'Club de Running']) : null,
    totalMembers: between(rng, 6, 60),
    contributorsCount: between(rng, 0, 34),
    organizer: userRef(organizer),
    shareSlug: `${occasion}-${(3000 + i).toString(36)}`,
    status,
    createdAt: daysAgo(createdDaysAgo),
    publishedAt: published ? daysAgo(publishedDaysAgo) : null,
    halfGoalReachedAt: progress >= 0.5 ? daysAgo(publishedDaysAgo - between(rng, 1, 6)) : null,
    goalReachedAt: progress >= 1 ? daysAgo(publishedDaysAgo - between(rng, 3, 14)) : null,
    closedAt: closed ? daysAgo(Math.max(0, endsIn)) : null,
    deliveredAt: status === 'delivered' ? daysAgo(Math.max(0, endsIn - 1)) : null,
    cardSlug: rng() > 0.18 ? `card-${between(rng, 1, 12)}` : null,
    cardRevealed: closed && rng() > 0.25,
    feePayer: rng() > 0.5 ? 'contributor' : 'beneficiary',
    withdrawalStatus: closed
      ? pick(rng, ['completed', 'processing', 'requested', 'failed', 'none'] as const)
      : 'none',
    stripeAccountStatus: pick(rng, ['verified', 'verified', 'pending', 'not_started', 'restricted'] as const),
  } satisfies RegalEvent;
});

/* ---------------------------------------------------------- contributions -- */

const DECLINE_CODES = [
  'card_declined — insufficient_funds',
  'card_declined — do_not_honor',
  'authentication_required (3DS abandoned)',
  'expired_card',
  'processing_error',
];

/**
 * `cancelled` is deliberately absent: `ContributionStatus` in the backend is
 * `pending | succeeded | failed` today (§22). The UI is built for four states
 * and renders — for cancelled until the enum gains it, rather than a
 * misleading $0.00.
 */
const CONTRIB_STATUS: { status: ContributionStatus; weight: number }[] = [
  { status: 'succeeded', weight: 84 },
  { status: 'pending', weight: 7 },
  { status: 'failed', weight: 9 },
];

function weightedContribStatus(): ContributionStatus {
  const total = CONTRIB_STATUS.reduce((s, x) => s + x.weight, 0);
  let r = rng() * total;
  for (const s of CONTRIB_STATUS) {
    r -= s.weight;
    if (r <= 0) return s.status;
  }
  return 'succeeded';
}

/** Contributions only exist for events that were actually published. */
const fundableEvents = events.filter((e) => e.publishedAt !== null);

/**
 * Assign each contribution to an event. Every fundable event gets a base
 * allocation so no published event is left empty, plus a weighted share so the
 * spread looks realistic. A plain `(i * k) % n` stride is deliberately avoided:
 * when n and k share a factor it silently collapses onto a handful of events.
 */
const eventSlots: RegalEvent[] = [];
for (const e of fundableEvents) {
  const weight = e.status === 'cancelled' || e.status === 'paused' ? 2 : between(rng, 3, 11);
  for (let n = 0; n < weight; n++) eventSlots.push(e);
}

export const contributions: Contribution[] = Array.from({ length: 260 }, (_, i) => {
  const event = eventSlots[i % eventSlots.length];
  const isGuest = rng() > 0.78;
  const contributorUser = users[(i * 13 + 4) % users.length];
  const amount = between(rng, 5, 120) * 5_000; // 250 – 6,000 MXN in centavos
  const platformFee = Math.round(amount * 0.03);
  const stripeFee = Math.round(amount * 0.035 + 300);
  const status = weightedContribStatus();
  const feePayer = event.feePayer;

  return {
    id: `con_${(4000 + i).toString(36)}${i}`,
    eventId: event.id,
    eventName: event.name,
    contributor: isGuest ? null : userRef(contributorUser),
    isGuest,
    guestName: isGuest ? `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}` : null,
    guestEmail: isGuest ? `guest${i}@${pick(rng, ['gmail.com', 'hotmail.com'])}` : null,
    stripePaymentIntentId: `pi_3P${(90000 + i * 37).toString(36).toUpperCase()}Kx2Lm${between(rng, 100, 999)}`,
    amount,
    platformFee,
    stripeFee,
    totalCharged: feePayer === 'contributor' ? amount + platformFee + stripeFee : amount,
    creditedAmount: feePayer === 'contributor' ? amount : amount - platformFee - stripeFee,
    feePayer,
    currency: 'MXN',
    cardSlug: event.cardSlug,
    message: pick(rng, ['¡Felicidades!', 'Con mucho cariño 💜', 'Que lo disfrutes', '', 'De parte de todo el equipo']),
    status,
    failureReason: status === 'failed' ? pick(rng, DECLINE_CODES) : null,
    paymentMethod: pick(rng, ['Visa •••4242', 'Mastercard •••8210', 'Amex •••1004', 'OXXO', 'SPEI']),
    revealed: status === 'succeeded' && rng() > 0.4,
    createdAt: daysAgo(between(rng, 0, 90), between(rng, 0, 23)),
  } satisfies Contribution;
});

/* Reconcile each event's headline totals with its actual contributions, so the
 * list progress bar, the detail financial panel and the dashboard never
 * disagree about the same event. */
for (const event of events) {
  const confirmed = contributions.filter((c) => c.eventId === event.id && c.status === 'succeeded');
  event.raisedAmount = confirmed.reduce((a, c) => a + c.amount, 0);
  event.contributorsCount = new Set(
    confirmed.map((c) => c.contributor?.id ?? c.guestEmail ?? c.id),
  ).size;
  event.totalMembers = Math.max(event.totalMembers, event.contributorsCount);
}

/* ------------------------------------------------------------- gift cards -- */

const CARD_NAMES = [
  ['Confetti Burst', 'birthday', 250, '#7C3AED', '🎉'],
  ['Golden Hour', 'general', 0, '#F59E0B', '🌇'],
  ['Botanical Wedding', 'wedding', 400, '#22C55E', '🌿'],
  ['Neon Farewell', 'farewell', 300, '#EF4444', '👋'],
  ['Graduation Cap', 'graduation', 0, '#3B82F6', '🎓'],
  ['Little Star', 'baby', 200, '#FE6ECF', '⭐'],
  ['Simple Thanks', 'thanks', 0, '#14B8A6', '🙏'],
  ['Winter Pine', 'holiday', 350, '#0EA5E9', '🌲'],
  ['Balloon Party', 'birthday', 0, '#F1BD42', '🎈'],
  ['Midnight Gold', 'general', 500, '#111827', '✨'],
  ['Pastel Bloom', 'wedding', 0, '#C1ACFF', '🌸'],
  ['Retro Arcade', 'birthday', 450, '#865EFF', '🕹️'],
] as const;

export const giftCards: GiftCardDesign[] = CARD_NAMES.map(([name, category, cost, bg, emoji], i) => {
  const timesSelected = between(rng, 12, 940);
  return {
    id: `gc_${(5000 + i).toString(36)}${i}`,
    slug: `card-${i + 1}`,
    name: name as string,
    categories: [category as Occasion, ...(rng() > 0.6 ? ['general' as Occasion] : [])],
    bg: bg as string,
    imageUrl: null,
    emojiKey: emoji as string,
    cloverCost: cost as number,
    sortOrder: i + 1,
    isActive: rng() > 0.15,
    availableFrom: i === 7 ? daysAgo(30) : null,
    availableUntil: i === 7 ? daysAhead(120) : null,
    version: rng() > 0.7 ? 2 : 1,
    timesSelected,
    unlocks: (cost as number) > 0 ? Math.round(timesSelected * (0.4 + rng() * 0.4)) : 0,
    revealRate: Number((55 + rng() * 42).toFixed(1)),
    uniqueDownloads: Math.round(timesSelected * (0.3 + rng() * 0.4)),
    totalDownloads: Math.round(timesSelected * (0.6 + rng() * 1.1)),
    createdAt: daysAgo(between(rng, 20, 400)),
  } satisfies GiftCardDesign;
});

/* ---------------------------------------------------------------- clovers -- */

const EARN_ACTIONS = [
  'event_created', 'first_contribution', 'invite_accepted', 'profile_completed',
  'streak_bonus', 'referral', 'card_shared',
];

export const cloverLedger: CloverTransaction[] = Array.from({ length: 180 }, (_, i) => {
  const user = users[(i * 17) % users.length];
  const roll = rng();
  const type: CloverTransaction['type'] = roll > 0.42 ? 'earn' : roll > 0.08 ? 'redeem' : 'adjust';
  const card = giftCards[(i * 5) % giftCards.length];
  const amount =
    type === 'earn' ? between(rng, 10, 150) : type === 'redeem' ? -card.cloverCost || -250 : between(rng, -200, 200);

  return {
    id: `clv_${(6000 + i).toString(36)}${i}`,
    user: userRef(user),
    type,
    action:
      type === 'earn' ? pick(rng, EARN_ACTIONS) : type === 'redeem' ? 'card_unlock' : 'manual_adjustment',
    amount,
    balanceAfter: Math.max(0, user.cloverBalance + between(rng, -200, 400)),
    reference:
      type === 'redeem'
        ? { label: card.name, href: `/cards/catalog/${card.id}` }
        : rng() > 0.5
          ? { label: events[(i * 3) % events.length].name, href: `/events/${events[(i * 3) % events.length].id}` }
          : null,
    note: type === 'adjust' ? pick(rng, ['Support goodwill credit', 'Duplicate earn reversal', 'Campaign correction']) : '',
    adminName: type === 'adjust' ? pick(rng, ['Ana Ramírez', 'Diego Flores']) : null,
    createdAt: daysAgo(between(rng, 0, 90), between(rng, 0, 23)),
  } satisfies CloverTransaction;
});

/* ------------------------------------------------------------ withdrawals -- */

export const withdrawals: Withdrawal[] = Array.from({ length: 34 }, (_, i) => {
  const event = events[(i * 7 + 1) % events.length];
  const beneficiaryUser = users[(i * 9) % users.length];
  const status = pick(rng, [
    'completed', 'completed', 'processing', 'requested', 'validated', 'failed',
  ] as const);
  const requestedDaysAgo = between(rng, 0, 40);

  return {
    id: `wdr_${(7000 + i).toString(36)}${i}`,
    beneficiary: userRef(beneficiaryUser),
    eventId: event.id,
    eventName: event.name,
    amount: Math.round(event.raisedAmount * 0.94),
    currency: 'MXN',
    status,
    stripeAccountStatus: status === 'failed' ? pick(rng, ['restricted', 'pending'] as const) : 'verified',
    stripePayoutId: status === 'completed' || status === 'processing' ? `po_1P${(80000 + i * 41).toString(36).toUpperCase()}` : null,
    requestedAt: daysAgo(requestedDaysAgo),
    completedAt: status === 'completed' ? daysAgo(Math.max(0, requestedDaysAgo - between(rng, 1, 4))) : null,
    failureReason:
      status === 'failed'
        ? pick(rng, [
            'account_closed — The bank account has been closed.',
            'no_account — The bank account number is invalid.',
            'debit_not_authorized — Beneficiary must re-verify identity.',
          ])
        : null,
  } satisfies Withdrawal;
});

/* ----------------------------------------------------------------- alerts -- */

export const alerts: Alert[] = [
  ...events.slice(0, 4).map((e, i) => ({
    id: `alr_stag_${i}`,
    type: 'stagnant_event' as const,
    severity: 'warning' as const,
    subject: { label: e.name, href: `/events/${e.id}` },
    triggeredAt: daysAgo(between(rng, 0, 5), between(rng, 0, 20)),
    assignedTo: i === 0 ? 'Ana Ramírez' : null,
    status: (i === 0 ? 'acknowledged' : 'open') as Alert['status'],
    evidence: [
      { label: 'Published', value: '4 days ago' },
      { label: 'Confirmed contributions since', value: '0' },
      { label: 'Threshold', value: 'no contribution 72h after publication' },
    ],
  })),
  ...events.slice(6, 9).map((e, i) => ({
    id: `alr_risk_${i}`,
    type: 'at_risk_event' as const,
    severity: 'warning' as const,
    subject: { label: e.name, href: `/events/${e.id}` },
    triggeredAt: daysAgo(between(rng, 0, 3), between(rng, 0, 20)),
    assignedTo: null,
    status: 'open' as const,
    evidence: [
      { label: 'Goal progress', value: `${Math.round((e.raisedAmount / e.goalAmount) * 100)}%` },
      { label: 'Time remaining', value: '31 hours' },
      { label: 'Threshold', value: '< 40% progress with < 48h remaining' },
    ],
  })),
  {
    id: 'alr_fric_0',
    type: 'payment_friction',
    severity: 'danger',
    subject: { label: 'Platform-wide, last 24h', href: '/contributions?status=failed' },
    triggeredAt: daysAgo(0, -3),
    assignedTo: 'Diego Flores',
    status: 'open',
    evidence: [
      { label: 'Failed + pending rate', value: '17.4%' },
      { label: 'Threshold', value: '> 10% platform-wide in 24h' },
      { label: 'Top decline code', value: 'card_declined — insufficient_funds (41%)' },
    ],
  },
  ...events.slice(12, 14).map((e, i) => ({
    id: `alr_card_${i}`,
    type: 'unrevealed_card' as const,
    severity: 'warning' as const,
    subject: { label: e.name, href: `/events/${e.id}/card` },
    triggeredAt: daysAgo(between(rng, 1, 6)),
    assignedTo: null,
    status: 'open' as const,
    evidence: [
      { label: 'Event closed', value: '3 days ago' },
      { label: 'Card revealed', value: 'No' },
      { label: 'Threshold', value: 'not revealed 48h after closure' },
    ],
  })),
  {
    id: 'alr_prem_0',
    type: 'premium_card_unused',
    severity: 'info',
    subject: { label: 'Retro Arcade — 6 unlocks unused', href: '/cards/catalog' },
    triggeredAt: daysAgo(2),
    assignedTo: null,
    status: 'open',
    evidence: [
      { label: 'Redeemed', value: '6 users, 450 clovers each' },
      { label: 'Revealed / downloaded', value: '0' },
      { label: 'Threshold', value: 'unused 7 days after redemption' },
    ],
  },
  ...withdrawals
    .filter((w) => w.status === 'requested' || w.status === 'failed')
    .slice(0, 5)
    .map((w, i) => ({
      id: `alr_wdr_${i}`,
      type: 'withdrawal_pending' as const,
      severity: (w.status === 'failed' ? 'danger' : 'warning') as Alert['severity'],
      subject: { label: `${w.beneficiary.name} — ${w.eventName}`, href: '/withdrawals' },
      triggeredAt: w.requestedAt,
      assignedTo: null,
      status: 'open' as const,
      evidence: [
        { label: 'Amount available', value: 'MXN' },
        { label: 'Age', value: '4 days' },
        { label: 'Threshold', value: 'not completed after 72h' },
      ],
    })),
  {
    id: 'alr_clv_0',
    type: 'clover_anomaly',
    severity: 'danger',
    subject: { label: `${users[3].firstName} ${users[3].lastName}`, href: `/users/${users[3].id}` },
    triggeredAt: daysAgo(1, 6),
    assignedTo: null,
    status: 'open',
    evidence: [
      { label: 'Earn volume (24h)', value: '1,840 clovers' },
      { label: '30-day baseline', value: '410 clovers' },
      { label: 'Magnitude', value: '4.5× baseline' },
      { label: 'Threshold', value: '> 3× the user’s 30-day baseline' },
    ],
  },
  {
    id: 'alr_inact_0',
    type: 'inactive_event',
    severity: 'info',
    subject: { label: events[20].name, href: `/events/${events[20].id}` },
    triggeredAt: daysAgo(3),
    assignedTo: null,
    status: 'snoozed',
    evidence: [
      { label: 'Last contribution', value: '9 days ago' },
      { label: 'Threshold', value: 'no activity for 7 days' },
    ],
  },
];

/* ------------------------------------------------------------ admin users -- */

export const adminUsers: AdminUser[] = [
  { id: 'adm_1', name: 'Ana Ramírez', email: 'ana@regal.app', role: 'super_admin', avatarColor: 'bg-brand-500', lastLoginAt: daysAgo(0, -2), isActive: true, twoFactorEnabled: true, createdAt: daysAgo(380) },
  { id: 'adm_2', name: 'Diego Flores', email: 'diego@regal.app', role: 'operations', avatarColor: 'bg-info-500', lastLoginAt: daysAgo(0, -6), isActive: true, twoFactorEnabled: true, createdAt: daysAgo(240) },
  { id: 'adm_3', name: 'Sofía Herrera', email: 'sofia@regal.app', role: 'finance', avatarColor: 'bg-success-500', lastLoginAt: daysAgo(1), isActive: true, twoFactorEnabled: false, createdAt: daysAgo(190) },
  { id: 'adm_4', name: 'Mateo Cruz', email: 'mateo@regal.app', role: 'support', avatarColor: 'bg-secondary-500', lastLoginAt: daysAgo(2), isActive: true, twoFactorEnabled: false, createdAt: daysAgo(120) },
  { id: 'adm_5', name: 'Camila Ortiz', email: 'camila@regal.app', role: 'analyst', avatarColor: 'bg-accent-500', lastLoginAt: daysAgo(9), isActive: false, twoFactorEnabled: false, createdAt: daysAgo(95) },
];

export const currentAdmin = adminUsers[0];

/* ------------------------------------------------------------ audit trail -- */

const AUDIT_ACTIONS: [string, string, string][] = [
  ['event.status_override', 'Event', 'Forced event to completed'],
  ['clover.adjust', 'User', 'Manual clover adjustment'],
  ['card.price_change', 'Gift card', 'Changed clover cost'],
  ['card.deactivate', 'Gift card', 'Deactivated design'],
  ['withdrawal.retry', 'Withdrawal', 'Retried failed payout'],
  ['user.suspend', 'User', 'Suspended account'],
  ['pii.unmask', 'User', 'Unmasked contact details'],
  ['export.run', 'Export', 'Generated export'],
  ['settings.update', 'Settings', 'Updated alert threshold'],
  ['auth.login', 'Session', 'Signed in'],
];

export const auditEntries: AuditEntry[] = Array.from({ length: 90 }, (_, i) => {
  const [action, resourceType, reason] = AUDIT_ACTIONS[i % AUDIT_ACTIONS.length];
  const admin = adminUsers[i % adminUsers.length];
  const event = events[(i * 5) % events.length];
  const user = users[(i * 3) % users.length];

  const isEvent = resourceType === 'Event';
  return {
    id: `aud_${(8000 + i).toString(36)}${i}`,
    timestamp: daysAgo(between(rng, 0, 45), between(rng, 0, 23)),
    admin: { id: admin.id, name: admin.name, email: admin.email, avatarColor: admin.avatarColor },
    action,
    resourceType,
    resource: isEvent
      ? { label: event.name, href: `/events/${event.id}` }
      : { label: `${user.firstName} ${user.lastName}`, href: `/users/${user.id}` },
    before: action === 'event.status_override' ? { status: 'active' } : action === 'clover.adjust' ? { cloverBalance: 320 } : action === 'card.price_change' ? { cloverCost: 250 } : null,
    after: action === 'event.status_override' ? { status: 'completed' } : action === 'clover.adjust' ? { cloverBalance: 520 } : action === 'card.price_change' ? { cloverCost: 300 } : null,
    reason,
    ip: `189.${between(rng, 100, 250)}.${between(rng, 1, 250)}.${between(rng, 1, 250)}`,
    userAgent: pick(rng, [
      'Chrome 141 / macOS 15.2',
      'Safari 18.1 / macOS 15.2',
      'Edge 141 / Windows 11',
      'Firefox 134 / Windows 11',
    ]),
  } satisfies AuditEntry;
});

/* ---------------------------------------------------------------- exports -- */

export const exportJobs: ExportJob[] = [
  { id: 'exp_1', dataset: 'Contributions', format: 'csv', filters: 'Last 30 days · status=succeeded', rows: 4213, status: 'ready', progress: 100, requestedBy: 'Sofía Herrera', requestedAt: daysAgo(0, -1), expiresAt: daysAhead(1), containsPii: true },
  { id: 'exp_2', dataset: 'Events', format: 'csv', filters: 'Last 90 days', rows: null, status: 'running', progress: 62, requestedBy: 'Ana Ramírez', requestedAt: daysAgo(0), expiresAt: null, containsPii: false },
  { id: 'exp_3', dataset: 'Clover ledger', format: 'json', filters: 'Year to date', rows: 18740, status: 'ready', progress: 100, requestedBy: 'Diego Flores', requestedAt: daysAgo(0, -8), expiresAt: daysAhead(0.6), containsPii: false },
  { id: 'exp_4', dataset: 'Users', format: 'csv', filters: 'All · verified=true', rows: 12840, status: 'expired', progress: 100, requestedBy: 'Ana Ramírez', requestedAt: daysAgo(3), expiresAt: daysAgo(2), containsPii: true },
  { id: 'exp_5', dataset: 'Withdrawals', format: 'csv', filters: 'Last 30 days · status=failed', rows: null, status: 'queued', progress: 0, requestedBy: 'Sofía Herrera', requestedAt: daysAgo(0), expiresAt: null, containsPii: true },
  { id: 'exp_6', dataset: 'Audit log', format: 'json', filters: 'Last 7 days', rows: null, status: 'failed', progress: 0, requestedBy: 'Mateo Cruz', requestedAt: daysAgo(1), expiresAt: null, containsPii: false },
];

/* -------------------------------------------------- per-event derived data -- */

export function contributionsForEvent(eventId: string): Contribution[] {
  return contributions.filter((c) => c.eventId === eventId);
}

/**
 * Invitees for an event. The first N participants are the people who actually
 * contributed, so the Participants tab reconciles with the Contributions tab
 * and with the participation funnel on Overview.
 */
export function participantsForEvent(eventId: string): Participant[] {
  const evt = events.find((e) => e.id === eventId);
  const evtContribs = contributionsForEvent(eventId);
  const count = Math.max(evtContribs.length, Math.min(evt?.totalMembers ?? 12, 24));
  const local = makeRng(eventId.length * 977 + count);

  return Array.from({ length: count }, (_, i) => {
    const contrib = evtContribs[i];
    // Reuse the real contributor when there is one, so names line up across tabs.
    const user = contrib?.contributor ?? userRef(users[(i * 5 + eventId.length) % users.length]);
    const contributed = Boolean(contrib);
    // Everyone who contributed necessarily opened their invitation first.
    const opened = contributed || local() > 0.3;

    return {
      id: `par_${eventId}_${i}`,
      user,
      invitedAt: daysAgo(between(local, 5, 40)),
      openedAt: opened ? daysAgo(between(local, 1, 30)) : null,
      contributed,
      amount: contributed ? contrib.amount : null,
      decisionTimeHours: contributed ? Number((local() * 72 + 0.5).toFixed(1)) : null,
      paymentStatus: contributed ? contrib.status : null,
      remindersReceived: between(local, 0, 3),
    } satisfies Participant;
  });
}

export function timelineForEvent(eventId: string): TimelineEntry[] {
  const e = events.find((x) => x.id === eventId);
  if (!e) return [];
  const entries: TimelineEntry[] = [];
  const push = (
    category: TimelineEntry['category'],
    title: string,
    description: string,
    actor: string,
    timestamp: string | null,
    payload?: Record<string, unknown>,
  ) => {
    if (!timestamp) return;
    const elapsed = e.publishedAt
      ? `${((new Date(timestamp).getTime() - new Date(e.publishedAt).getTime()) / 3_600_000).toFixed(1)}h from publication`
      : null;
    entries.push({
      id: `tl_${entries.length}`,
      category,
      title,
      description,
      actor,
      timestamp,
      elapsedFromPublication: elapsed,
      payload,
    });
  };

  push('event', 'Event created', `Goal set to ${e.goalAmount / 100} ${e.currency}`, e.organizer.name, e.createdAt, {
    goalAmount: e.goalAmount,
    currency: e.currency,
    occasion: e.occasion,
  });
  push('event', 'Event published', 'Share link activated', e.organizer.name, e.publishedAt, { shareSlug: e.shareSlug });
  push('invitation', 'Invitation batch sent', `${e.totalMembers} invitations dispatched`, 'system', e.publishedAt, {
    channel: 'push+email',
    recipients: e.totalMembers,
  });
  const firstContrib = contributionsForEvent(eventId).find((c) => c.status === 'succeeded');
  if (firstContrib) {
    push('contribution', 'First confirmed contribution', `${firstContrib.amount / 100} ${e.currency}`, firstContrib.contributor?.name ?? firstContrib.guestName ?? 'Guest', firstContrib.createdAt, {
      paymentIntent: firstContrib.stripePaymentIntentId,
    });
  }
  push('event', '50% of goal reached', 'Half-goal milestone', 'system', e.halfGoalReachedAt);
  push('reminder', 'Reminder sent', 'Nudge to non-contributors', 'system', e.publishedAt ? daysAgo(2) : null, {
    recipients: 14,
    opened: 9,
    converted: 3,
  });
  push('event', '100% of goal reached', 'Goal milestone', 'system', e.goalReachedAt);
  push('event', 'Event closed', 'Collection window ended', 'system', e.closedAt);
  push('card', 'Gift card revealed', e.cardSlug ?? '—', e.beneficiaryName, e.cardRevealed ? e.closedAt : null);
  push('event', 'Gift delivered', 'Beneficiary confirmed delivery', e.beneficiaryName, e.deliveredAt);
  push(
    'withdrawal',
    'Withdrawal requested',
    'Payout to Stripe Connect account',
    e.beneficiaryName,
    e.withdrawalStatus !== 'none' ? e.closedAt : null,
  );

  return entries.sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));
}

/* ------------------------------------------------------------ time series -- */

export interface SeriesPoint {
  date: string;
  created: number;
  completed: number;
  volume: number;
  prevVolume: number;
  count: number;
  earned: number;
  redeemed: number;
  outstanding: number;
  succeeded: number;
  pending: number;
  failed: number;
  cancelled: number;
  standard: number;
  premium: number;
  reminder: boolean;
}

export const timeSeries: SeriesPoint[] = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(NOW.getTime() - (29 - i) * 86_400_000);
  const wave = Math.sin(i / 3.4) * 0.28 + 1;
  const volume = Math.round((180_000 + rng() * 120_000) * wave);
  const succeeded = Math.round((22 + rng() * 14) * wave);
  return {
    date: d.toISOString().slice(0, 10),
    created: Math.round((9 + rng() * 8) * wave),
    completed: Math.round((6 + rng() * 6) * wave),
    volume,
    prevVolume: Math.round(volume * (0.78 + rng() * 0.24)),
    count: succeeded + 4,
    earned: Math.round((900 + rng() * 700) * wave),
    redeemed: Math.round((420 + rng() * 500) * wave),
    outstanding: Math.round(180_000 + i * 2_400 + rng() * 9_000),
    succeeded,
    pending: Math.round(1 + rng() * 4),
    failed: Math.round(1 + rng() * 5),
    cancelled: Math.round(rng() * 2),
    standard: Math.round((7 + rng() * 6) * wave),
    premium: Math.round((3 + rng() * 5) * wave),
    reminder: i % 7 === 3,
  };
});

/* ------------------------------------------------------------------ stats -- */

const succeededContribs = contributions.filter((c) => c.status === 'succeeded');
const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
const median = (arr: number[]) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export const stats = {
  activeEvents: events.filter((e) => e.status === 'active').length,
  eventsCreated: events.length,
  successRate:
    (events.filter((e) => ['completed', 'delivered', 'goal_reached'].includes(e.status)).length /
      events.length) *
    100,
  avgDurationDays: 8.3,
  totalConfirmed: sum(succeededContribs.map((c) => c.amount)),
  totalPending: sum(contributions.filter((c) => c.status === 'pending').map((c) => c.amount)),
  totalFailed: sum(contributions.filter((c) => c.status === 'failed').map((c) => c.amount)),
  totalCancelled: sum(contributions.filter((c) => c.status === 'cancelled').map((c) => c.amount)),
  participationRate: 54.1,
  uniqueDownloads: 1204,
  totalDownloads: 2310,
  cloverRedemptionRate: 31.7,
  avgContribution: Math.round(sum(succeededContribs.map((c) => c.amount)) / succeededContribs.length),
  medianContribution: median(succeededContribs.map((c) => c.amount)),
  failureRate:
    (contributions.filter((c) => c.status === 'failed').length / contributions.length) * 100,
  totalFees: sum(succeededContribs.map((c) => c.platformFee + c.stripeFee)),
  totalUsers: users.length * 268,
  newUsers: 1284,
  activeContributors: users.filter((u) => u.eventsContributedTo > 0).length * 41,
  recurrentContributors: users.filter((u) => u.eventsContributedTo >= 2).length * 22,
  avgLifetimeContribution: Math.round(sum(users.map((u) => u.totalContributed)) / users.length),
  usersWithClovers: users.filter((u) => u.cloverBalance > 0).length * 190,
  cloversEarned: sum(cloverLedger.filter((c) => c.amount > 0).map((c) => c.amount)) * 34,
  cloversRedeemed: Math.abs(sum(cloverLedger.filter((c) => c.amount < 0).map((c) => c.amount))) * 34,
  outstandingClovers: sum(users.map((u) => u.cloverBalance)) * 190,
  availableForWithdrawal: sum(
    events.filter((e) => e.withdrawalStatus === 'none' && e.closedAt).map((e) => e.raisedAmount),
  ),
};

/** §02 Section D — lifecycle timing, median headline with p90 and mean in tooltip. */
export const lifecycleTiming = [
  { metric: 'Planned Duration', definition: 'Event date − creation date', median: 14.2, p90: 41.0, mean: 18.6, unit: 'days', trend: [12, 13, 14, 13, 15, 14, 14] },
  { metric: 'Published Duration', definition: 'Closure date − publication date', median: 9.4, p90: 26.5, mean: 12.1, unit: 'days', trend: [10, 9, 9, 10, 9, 9, 9] },
  { metric: 'Time to First Contribution', definition: 'First confirmed contribution − publication', median: 5.6, p90: 38.2, mean: 11.4, unit: 'hours', trend: [7, 6, 6, 5, 6, 5, 6] },
  { metric: 'Time to 50% Goal', definition: '50%-of-goal timestamp − publication', median: 2.1, p90: 7.4, mean: 3.0, unit: 'days', trend: [2, 2, 3, 2, 2, 2, 2] },
  { metric: 'Time to Goal', definition: '100%-of-goal timestamp − publication', median: 5.3, p90: 15.8, mean: 7.2, unit: 'days', trend: [6, 5, 5, 6, 5, 5, 5] },
  { metric: 'Actual Duration', definition: 'Closure date − creation date', median: 11.0, p90: 29.3, mean: 14.4, unit: 'days', trend: [11, 12, 11, 11, 10, 11, 11] },
  { metric: 'Time to Delivery', definition: 'Reveal/delivery − closure', median: 18.4, p90: 96.0, mean: 31.2, unit: 'hours', trend: [20, 19, 18, 18, 19, 18, 18] },
];

export const funnelStages = [
  { stage: 'Invited', value: 8420 },
  { stage: 'Opened', value: 6104 },
  { stage: 'Contributed', value: 4557 },
];

export const cardFunnelStages = [
  { stage: 'Selected', value: 3210 },
  { stage: 'Available', value: 3102 },
  { stage: 'Revealed', value: 2418 },
  { stage: 'Viewed', value: 2260 },
  { stage: 'Downloaded', value: 1204 },
  { stage: 'Shared', value: 486 },
];

export const contributionSizeBuckets = [
  { bucket: '< $50', count: 41 },
  { bucket: '$50–100', count: 88 },
  { bucket: '$100–250', count: 74 },
  { bucket: '$250–500', count: 39 },
  { bucket: '$500+', count: 18 },
];

export const failureReasonBreakdown = [
  { reason: 'insufficient_funds', count: 34 },
  { reason: 'do_not_honor', count: 21 },
  { reason: '3DS abandoned', count: 17 },
  { reason: 'expired_card', count: 9 },
  { reason: 'processing_error', count: 5 },
];

export const earnActionBreakdown = [
  { action: 'first_contribution', clovers: 41200 },
  { action: 'event_created', clovers: 28400 },
  { action: 'invite_accepted', clovers: 19800 },
  { action: 'referral', clovers: 12600 },
  { action: 'streak_bonus', clovers: 8400 },
  { action: 'profile_completed', clovers: 5100 },
];

export const cardErrorSeries = Array.from({ length: 14 }, (_, i) => ({
  date: new Date(NOW.getTime() - (13 - i) * 86_400_000).toISOString().slice(0, 10),
  generation: between(rng, 0, 5),
  loading: between(rng, 0, 8),
  reveal: between(rng, 0, 3),
  download: between(rng, 0, 6),
}));

export const cloverAnomalies = [
  { user: userRef(users[3]), signal: 'Earn velocity', magnitude: '4.5× 30-day baseline', detail: '1,840 clovers earned in 24h vs 410 baseline' },
  { user: userRef(users[11]), signal: 'Manual adjustments', magnitude: '6 adjustments in 7 days', detail: 'All by the same admin, no reason on 4 of 6' },
  { user: userRef(users[27]), signal: 'Redemption velocity', magnitude: '3.2× baseline', detail: '5 premium unlocks in one session' },
];

export const eventsAtRisk = events
  .filter((e) => e.status === 'active' && e.raisedAmount / e.goalAmount < 0.45)
  .slice(0, 5);

export const largestActiveEvents = [...events]
  .filter((e) => e.status === 'active')
  .sort((a, b) => b.goalAmount - a.goalAmount)
  .slice(0, 5);

export const recentlyCompleted = [...events]
  .filter((e) => e.status === 'completed' || e.status === 'delivered')
  .sort((a, b) => +new Date(b.closedAt ?? 0) - +new Date(a.closedAt ?? 0))
  .slice(0, 5);

export const DATA_AS_OF = new Date(NOW.getTime() - 11 * 60_000).toISOString();
