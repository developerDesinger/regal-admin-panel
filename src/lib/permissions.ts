/**
 * Roles and permissions (§15).
 *
 * The UI hides what a role can't do, but enforcement is SERVER-SIDE — hidden
 * buttons are not security. This module drives navigation and button visibility
 * only; every mutating call must be re-authorized by the API regardless.
 */

import type { AdminRole } from './types';

export const PERMISSIONS = [
  'events:read',
  'events:write',
  'contributions:read',
  'financials:read',
  'payouts:write',
  'users:read',
  'pii:read',
  'pii:export',
  'cards:read',
  'cards:write',
  'clovers:read',
  'clovers:adjust',
  'alerts:manage',
  'exports:run',
  'audit:read',
  'admins:manage',
  'settings:write',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  finance: 'Finance',
  operations: 'Operations',
  support: 'Support',
  analyst: 'Analyst',
};

export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  super_admin: 'Everything, including admin management and settings.',
  finance: 'Full financial data, contributions, withdrawals, exports. No PII unmasking beyond what reconciliation needs.',
  operations: 'Events, alerts, users, cards, clovers. Money shown as aggregates only; no payout actions.',
  support: 'Read-only across events and users, PII unmasking with audit. No financial actions, no exports.',
  analyst: 'Read-only aggregates and charts. No individual PII, no actions.',
};

export const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  super_admin: [...PERMISSIONS],
  finance: [
    'events:read',
    'contributions:read',
    'financials:read',
    'payouts:write',
    'users:read',
    'pii:export',
    'cards:read',
    'clovers:read',
    'exports:run',
    'audit:read',
  ],
  operations: [
    'events:read',
    'events:write',
    'contributions:read',
    'users:read',
    'cards:read',
    'cards:write',
    'clovers:read',
    'clovers:adjust',
    'alerts:manage',
    'exports:run',
    'audit:read',
  ],
  support: ['events:read', 'contributions:read', 'users:read', 'pii:read', 'cards:read', 'clovers:read', 'alerts:manage'],
  analyst: ['events:read', 'contributions:read', 'users:read', 'cards:read', 'clovers:read'],
};

export function roleHas(role: AdminRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
