import * as React from 'react';
import type { AdminUser } from '@/lib/types';
import { adminUsers, currentAdmin } from '@/lib/mock/data';
import { roleHas, type Permission } from '@/lib/permissions';
import { AuthContext, type AuthContextValue } from '@/hooks/use-auth';
import { readLocal, writeLocal } from '@/hooks/useUrlState';

/**
 * Session provider.
 *
 * In production the session token lives in an httpOnly, Secure,
 * SameSite=Strict cookie — never localStorage (§01 Non-negotiables). This
 * UI-only build stores just the signed-in admin id so the panel can be
 * navigated without a backend; there is no token here to leak.
 */

const SESSION_KEY = 'regal:session-admin';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = React.useState<AdminUser | null>(() => {
    const id = readLocal<string | null>(SESSION_KEY, null);
    return id ? (adminUsers.find((a) => a.id === id) ?? null) : null;
  });
  const [piiUnmasked, setPiiUnmasked] = React.useState(false);

  const signIn = React.useCallback((email: string) => {
    const found = adminUsers.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
    const next = found ?? currentAdmin;
    writeLocal(SESSION_KEY, next.id);
    setAdmin(next);
    return next;
  }, []);

  const signOut = React.useCallback(() => {
    writeLocal(SESSION_KEY, null);
    setAdmin(null);
    setPiiUnmasked(false);
  }, []);

  const switchRole = React.useCallback((adminId: string) => {
    const next = adminUsers.find((a) => a.id === adminId);
    if (!next) return;
    writeLocal(SESSION_KEY, next.id);
    setAdmin(next);
  }, []);

  const can = React.useCallback(
    (permission: Permission) => (admin ? roleHas(admin.role, permission) : false),
    [admin],
  );

  const value = React.useMemo<AuthContextValue>(
    () => ({
      admin,
      signIn,
      signOut,
      can,
      piiUnmasked: piiUnmasked && can('pii:read'),
      togglePii: () => setPiiUnmasked((v) => !v),
      switchRole,
    }),
    [admin, signIn, signOut, can, piiUnmasked, switchRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
