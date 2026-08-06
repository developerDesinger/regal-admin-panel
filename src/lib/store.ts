import { useSyncExternalStore } from 'react';
import {
  adminUsers as seedAdmins,
  alerts as seedAlerts,
  auditEntries as seedAudit,
  cloverLedger as seedClovers,
  contributions as seedContributions,
  events as seedEvents,
  exportJobs as seedExports,
  giftCards as seedCards,
  users as seedUsers,
  withdrawals as seedWithdrawals,
} from './mock/data';
import { NOW } from './mock/seed';
import type {
  AdminUser,
  Alert,
  AuditEntry,
  CloverTransaction,
  Contribution,
  ExportJob,
  GiftCardDesign,
  RegalEvent,
  RegalUser,
  Withdrawal,
} from './types';

/**
 * Application store.
 *
 * The panel is UI-only, but every admin action still has to *do* something —
 * a confirmation toast over unchanged data is not a working button. This holds
 * the mutable copy of the fixtures, applies real mutations, and appends a real
 * audit entry for each one so the Audit Trail reflects what you just did.
 *
 * State is persisted to localStorage so a save survives a reload. Bump
 * STORAGE_VERSION when the shape changes, and use `actions.resetDemoData()`
 * from Settings to get back to the seeded fixtures.
 */

const STORAGE_KEY = 'regal:store';
const STORAGE_VERSION = 3;

export interface SettingsState {
  values: Record<string, string>;
  defaultFeePayer: string;
  digest: string;
  notify: Record<string, string[]>;
  supportEmail: string;
  termsUrl: string;
  privacyUrl: string;
  maintenanceMode: boolean;
}

export const SETTING_DEFAULTS: Record<string, string> = {
  stagnant_hours: '72',
  at_risk_progress: '40',
  at_risk_hours: '48',
  inactive_days: '7',
  friction_event: '15',
  friction_platform: '10',
  unrevealed_hours: '48',
  premium_unused_days: '7',
  withdrawal_hours: '72',
  clover_multiple: '3',
  earn_event_created: '100',
  earn_first_contribution: '150',
  earn_invite_accepted: '25',
  earn_referral: '200',
  earn_profile: '50',
  cap_daily: '500',
  expiry_days: '0',
  platform_fee: '3.0',
  min_withdrawal: '100',
};

export const DEFAULT_SETTINGS: SettingsState = {
  values: { ...SETTING_DEFAULTS },
  defaultFeePayer: 'contributor',
  digest: 'daily',
  notify: {
    payment_friction: ['adm_1', 'adm_3'],
    clover_anomaly: ['adm_1'],
    withdrawal_pending: ['adm_3'],
  },
  supportEmail: 'soporte@regal.app',
  termsUrl: 'https://regal.app/terminos',
  privacyUrl: 'https://regal.app/privacidad',
  maintenanceMode: false,
};

export interface AppState {
  events: RegalEvent[];
  contributions: Contribution[];
  users: RegalUser[];
  giftCards: GiftCardDesign[];
  cloverLedger: CloverTransaction[];
  withdrawals: Withdrawal[];
  alerts: Alert[];
  adminUsers: AdminUser[];
  exportJobs: ExportJob[];
  auditEntries: AuditEntry[];
  settings: SettingsState;
}

function seedState(): AppState {
  return {
    events: seedEvents.map((e) => ({ ...e })),
    contributions: seedContributions.map((c) => ({ ...c })),
    users: seedUsers.map((u) => ({ ...u })),
    giftCards: seedCards.map((c) => ({ ...c })),
    cloverLedger: seedClovers.map((c) => ({ ...c })),
    withdrawals: seedWithdrawals.map((w) => ({ ...w })),
    alerts: seedAlerts.map((a) => ({ ...a })),
    adminUsers: seedAdmins.map((a) => ({ ...a })),
    exportJobs: seedExports.map((j) => ({ ...j })),
    auditEntries: seedAudit.map((a) => ({ ...a })),
    settings: structuredClone(DEFAULT_SETTINGS),
  };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw) as { version: number; state: AppState };
    if (parsed.version !== STORAGE_VERSION) return seedState();
    // Merge over a fresh seed so a partial/older payload can't leave holes.
    return { ...seedState(), ...parsed.state };
  } catch {
    return seedState();
  }
}

let state: AppState = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, state }));
  } catch {
    /* quota or private mode — mutations still work for this session */
  }
}

function setState(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  persist();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;

/**
 * Returns the whole state object, which is referentially stable between
 * mutations. Derive/filter inside a `useMemo` in the component — returning a
 * freshly-built array from here would re-render on every check.
 */
export function useStore(): AppState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/* ---------------------------------------------------------------- audit --- */

let auditSeq = 0;

interface AuditContext {
  admin: AdminUser | null;
  action: string;
  resourceType: string;
  resource: { label: string; href: string };
  reason?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

/** Every mutating action writes here — the Audit Trail is the receipt (§14). */
function appendAudit(ctx: AuditContext) {
  const admin = ctx.admin ?? state.adminUsers[0];
  const entry: AuditEntry = {
    id: `aud_live_${++auditSeq}_${state.auditEntries.length}`,
    timestamp: new Date().toISOString(),
    admin: { id: admin.id, name: admin.name, email: admin.email, avatarColor: admin.avatarColor },
    action: ctx.action,
    resourceType: ctx.resourceType,
    resource: ctx.resource,
    before: ctx.before ?? null,
    after: ctx.after ?? null,
    reason: ctx.reason ?? '',
    ip: '189.203.14.62',
    userAgent: navigator.userAgent.includes('Edg')
      ? 'Edge / this session'
      : 'Chrome / this session',
  };
  return [entry, ...state.auditEntries];
}

/* -------------------------------------------------------------- actions --- */

export const actions = {
  /* ---- events ---- */
  updateEvent(
    admin: AdminUser | null,
    eventId: string,
    patch: Partial<RegalEvent>,
    meta: { action: string; reason: string },
  ) {
    const target = state.events.find((e) => e.id === eventId);
    if (!target) return;
    const before = Object.fromEntries(
      Object.keys(patch).map((k) => [k, target[k as keyof RegalEvent]]),
    );
    setState({
      events: state.events.map((e) => (e.id === eventId ? { ...e, ...patch } : e)),
      auditEntries: appendAudit({
        admin,
        action: meta.action,
        resourceType: 'Event',
        resource: { label: target.name, href: `/events/${target.id}` },
        reason: meta.reason,
        before,
        after: patch as Record<string, unknown>,
      }),
    });
  },

  /* ---- users ---- */
  setUserActive(admin: AdminUser | null, userId: string, isActive: boolean, reason: string) {
    const target = state.users.find((u) => u.id === userId);
    if (!target) return;
    setState({
      users: state.users.map((u) => (u.id === userId ? { ...u, isActive } : u)),
      auditEntries: appendAudit({
        admin,
        action: isActive ? 'user.reactivate' : 'user.suspend',
        resourceType: 'User',
        resource: {
          label: `${target.firstName} ${target.lastName}`,
          href: `/users/${target.id}`,
        },
        reason,
        before: { isActive: target.isActive },
        after: { isActive },
      }),
    });
  },

  adjustClovers(admin: AdminUser | null, userId: string, amount: number, reason: string) {
    const target = state.users.find((u) => u.id === userId);
    if (!target || !Number.isFinite(amount) || amount === 0) return;
    const balanceAfter = Math.max(0, target.cloverBalance + amount);
    const tx: CloverTransaction = {
      id: `clv_live_${Date.now()}`,
      user: {
        id: target.id,
        name: `${target.firstName} ${target.lastName}`,
        email: target.email,
        avatarColor: target.avatarColor,
      },
      type: 'adjust',
      action: 'manual_adjustment',
      amount,
      balanceAfter,
      reference: null,
      note: reason,
      adminName: (admin ?? state.adminUsers[0]).name,
      createdAt: new Date().toISOString(),
    };
    setState({
      users: state.users.map((u) => (u.id === userId ? { ...u, cloverBalance: balanceAfter } : u)),
      cloverLedger: [tx, ...state.cloverLedger],
      auditEntries: appendAudit({
        admin,
        action: 'clover.adjust',
        resourceType: 'User',
        resource: { label: tx.user.name, href: `/users/${target.id}` },
        reason,
        before: { cloverBalance: target.cloverBalance },
        after: { cloverBalance: balanceAfter },
      }),
    });
  },

  /* ---- gift card catalog ---- */
  upsertCard(admin: AdminUser | null, card: GiftCardDesign, isNew: boolean, reason = '') {
    const existing = state.giftCards.find((c) => c.id === card.id);
    setState({
      giftCards: isNew
        ? [...state.giftCards, card]
        : state.giftCards.map((c) => (c.id === card.id ? card : c)),
      auditEntries: appendAudit({
        admin,
        action: isNew ? 'card.create' : 'card.update',
        resourceType: 'Gift card',
        resource: { label: card.name, href: `/cards/catalog/${card.id}` },
        reason,
        before: existing
          ? { name: existing.name, cloverCost: existing.cloverCost, isActive: existing.isActive }
          : null,
        after: { name: card.name, cloverCost: card.cloverCost, isActive: card.isActive },
      }),
    });
  },

  setCardActive(admin: AdminUser | null, cardId: string, isActive: boolean, reason = '') {
    const target = state.giftCards.find((c) => c.id === cardId);
    if (!target) return;
    setState({
      giftCards: state.giftCards.map((c) => (c.id === cardId ? { ...c, isActive } : c)),
      auditEntries: appendAudit({
        admin,
        action: isActive ? 'card.activate' : 'card.deactivate',
        resourceType: 'Gift card',
        resource: { label: target.name, href: `/cards/catalog/${target.id}` },
        reason,
        before: { isActive: target.isActive },
        after: { isActive },
      }),
    });
  },

  setCardPrice(admin: AdminUser | null, cardId: string, cloverCost: number, reason: string) {
    const target = state.giftCards.find((c) => c.id === cardId);
    if (!target) return;
    setState({
      giftCards: state.giftCards.map((c) => (c.id === cardId ? { ...c, cloverCost } : c)),
      auditEntries: appendAudit({
        admin,
        action: 'card.price_change',
        resourceType: 'Gift card',
        resource: { label: target.name, href: `/cards/catalog/${target.id}` },
        reason,
        before: { cloverCost: target.cloverCost },
        after: { cloverCost },
      }),
    });
  },

  deleteCard(admin: AdminUser | null, cardId: string, reason: string) {
    const target = state.giftCards.find((c) => c.id === cardId);
    if (!target) return;
    setState({
      giftCards: state.giftCards.filter((c) => c.id !== cardId),
      auditEntries: appendAudit({
        admin,
        action: 'card.delete',
        resourceType: 'Gift card',
        resource: { label: target.name, href: '/cards/catalog' },
        reason,
        before: { name: target.name, slug: target.slug },
        after: null,
      }),
    });
  },

  duplicateCard(admin: AdminUser | null, cardId: string) {
    const target = state.giftCards.find((c) => c.id === cardId);
    if (!target) return null;
    const copy: GiftCardDesign = {
      ...target,
      id: `gc_live_${Date.now()}`,
      name: `${target.name} (copy)`,
      slug: `${target.slug}-copy`,
      isActive: false,
      timesSelected: 0,
      unlocks: 0,
      uniqueDownloads: 0,
      totalDownloads: 0,
      version: 1,
      sortOrder: state.giftCards.length + 1,
      createdAt: new Date().toISOString(),
    };
    setState({
      giftCards: [...state.giftCards, copy],
      auditEntries: appendAudit({
        admin,
        action: 'card.duplicate',
        resourceType: 'Gift card',
        resource: { label: copy.name, href: `/cards/catalog/${copy.id}` },
        after: { slug: copy.slug },
      }),
    });
    return copy;
  },

  saveCardOrder(admin: AdminUser | null, orderedIds: string[]) {
    const rank = new Map(orderedIds.map((id, i) => [id, i + 1]));
    setState({
      giftCards: state.giftCards.map((c) => ({ ...c, sortOrder: rank.get(c.id) ?? c.sortOrder })),
      auditEntries: appendAudit({
        admin,
        action: 'card.reorder',
        resourceType: 'Gift card',
        resource: { label: `${orderedIds.length} designs`, href: '/cards/catalog' },
        after: { sortOrder: 'updated' },
      }),
    });
  },

  /* ---- alerts ---- */
  updateAlert(
    admin: AdminUser | null,
    alertId: string,
    patch: Partial<Alert>,
    meta: { action: string; reason?: string },
  ) {
    const target = state.alerts.find((a) => a.id === alertId);
    if (!target) return;
    setState({
      alerts: state.alerts.map((a) => (a.id === alertId ? { ...a, ...patch } : a)),
      auditEntries: appendAudit({
        admin,
        action: meta.action,
        resourceType: 'Alert',
        resource: target.subject,
        reason: meta.reason,
        before: { status: target.status, assignedTo: target.assignedTo },
        after: patch as Record<string, unknown>,
      }),
    });
  },

  /* ---- withdrawals ---- */
  updateWithdrawal(
    admin: AdminUser | null,
    id: string,
    patch: Partial<Withdrawal>,
    meta: { action: string; reason: string },
  ) {
    const target = state.withdrawals.find((w) => w.id === id);
    if (!target) return;
    setState({
      withdrawals: state.withdrawals.map((w) => (w.id === id ? { ...w, ...patch } : w)),
      auditEntries: appendAudit({
        admin,
        action: meta.action,
        resourceType: 'Withdrawal',
        resource: { label: `${target.beneficiary.name} — ${target.eventName}`, href: '/withdrawals' },
        reason: meta.reason,
        before: { status: target.status },
        after: patch as Record<string, unknown>,
      }),
    });
  },

  /* ---- admins ---- */
  setAdminActive(admin: AdminUser | null, adminId: string, isActive: boolean, reason: string) {
    const target = state.adminUsers.find((a) => a.id === adminId);
    if (!target) return;
    setState({
      adminUsers: state.adminUsers.map((a) => (a.id === adminId ? { ...a, isActive } : a)),
      auditEntries: appendAudit({
        admin,
        action: isActive ? 'admin.restore' : 'admin.revoke',
        resourceType: 'Admin',
        resource: { label: target.name, href: '/admins' },
        reason,
        before: { isActive: target.isActive },
        after: { isActive },
      }),
    });
  },

  /* ---- exports ---- */
  createExportJob(admin: AdminUser | null, job: Omit<ExportJob, 'id'>) {
    const id = `exp_live_${Date.now()}`;
    setState({
      exportJobs: [{ ...job, id }, ...state.exportJobs],
      auditEntries: appendAudit({
        admin,
        action: 'export.run',
        resourceType: 'Export',
        resource: { label: `${job.dataset} (${job.format.toUpperCase()})`, href: '/exports' },
        reason: job.filters,
        after: { dataset: job.dataset, format: job.format, containsPii: job.containsPii },
      }),
    });
    return id;
  },

  patchExportJob(id: string, patch: Partial<ExportJob>) {
    setState({
      exportJobs: state.exportJobs.map((j) => (j.id === id ? { ...j, ...patch } : j)),
    });
  },

  /* ---- settings ---- */
  saveSettings(admin: AdminUser | null, next: SettingsState, reason: string) {
    const before = state.settings;
    const changed: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(next.values)) {
      if (before.values[k] !== v) {
        changed[k] = before.values[k];
        after[k] = v;
      }
    }
    if (before.defaultFeePayer !== next.defaultFeePayer) {
      changed.defaultFeePayer = before.defaultFeePayer;
      after.defaultFeePayer = next.defaultFeePayer;
    }
    if (before.digest !== next.digest) {
      changed.digest = before.digest;
      after.digest = next.digest;
    }
    if (before.maintenanceMode !== next.maintenanceMode) {
      changed.maintenanceMode = before.maintenanceMode;
      after.maintenanceMode = next.maintenanceMode;
    }
    setState({
      settings: structuredClone(next),
      auditEntries: appendAudit({
        admin,
        action: 'settings.update',
        resourceType: 'Settings',
        resource: { label: 'Platform settings', href: '/settings' },
        reason,
        before: Object.keys(changed).length ? changed : null,
        after: Object.keys(after).length ? after : null,
      }),
    });
  },

  resetDemoData() {
    state = seedState();
    persist();
    listeners.forEach((l) => l());
  },
};

/** Anchor used by mock timestamps, exposed for pure-render date math. */
export { NOW };
