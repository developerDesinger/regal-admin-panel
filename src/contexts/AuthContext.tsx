import * as React from 'react';
import type { AdminUser } from '@/lib/types';
import { adminUsers, currentAdmin } from '@/lib/mock/data';
import { roleHas, type Permission } from '@/lib/permissions';
import { AuthContext, type AuthContextValue } from '@/hooks/use-auth';
import { readLocal, writeLocal } from '@/hooks/useUrlState';
import { authService } from '@/lib/api/services';
import {
  registerCsrfRefresher,
  setCsrfToken,
  usingMockData,
  ApiError,
} from '@/lib/api/client';
import type { AdminSession, LoginResponse } from '@/lib/api/types';
import { avatarColorFor } from '@/lib/api/adapters';

/**
 * Session provider.
 *
 * On the API path the session is an httpOnly cookie the server sets — there is
 * no token here to store or leak. We hold only the CSRF token, in memory, and
 * re-read it from /auth/me on boot so a refresh keeps the session.
 *
 * On the mock path we persist just the signed-in admin id so the panel can be
 * navigated without a backend.
 */

const SESSION_KEY = 'regal:session-admin';

/** The API's admin payload → the AdminUser the UI renders. */
function toAdminUser(a: AdminSession): AdminUser {
  return {
    id: a.id,
    name: a.name,
    email: a.email,
    role: a.role,
    avatarColor: avatarColorFor(a.id),
    lastLoginAt: a.lastLoginAt,
    isActive: true,
    twoFactorEnabled: a.twoFactorEnabled,
    createdAt: a.lastLoginAt ?? new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = React.useState<AdminUser | null>(() => {
    if (!usingMockData) return null;
    const id = readLocal<string | null>(SESSION_KEY, null);
    return id ? (adminUsers.find((a) => a.id === id) ?? null) : null;
  });
  // The server is the source of truth for permissions; the role table is only
  // the fallback for the fixture path.
  const [permissions, setPermissions] = React.useState<string[] | null>(null);
  const [isRestoring, setIsRestoring] = React.useState(!usingMockData);
  const [piiUnmasked, setPiiUnmasked] = React.useState(false);

  const applySession = React.useCallback((session: AdminSession) => {
    setAdmin(toAdminUser(session));
    setPermissions(session.permissions);
  }, []);

  // Boot: restore the session from the cookie. A 401 here is the normal
  // signed-out case, not an error worth surfacing.
  React.useEffect(() => {
    if (usingMockData) return;
    let cancelled = false;
    (async () => {
      try {
        const session = await authService.me();
        if (!cancelled) applySession(session);
      } catch {
        if (!cancelled) {
          setAdmin(null);
          setPermissions(null);
        }
      } finally {
        if (!cancelled) setIsRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession]);

  // Lets the client re-mint a stale CSRF token and retry once.
  React.useEffect(() => {
    if (usingMockData) return;
    registerCsrfRefresher(async () => {
      const session = await authService.me();
      applySession(session);
    });
    return () => registerCsrfRefresher(null);
  }, [applySession]);

  // Idle timeout is 30 minutes server-side and any request refreshes it, so a
  // periodic heartbeat while the tab is in use keeps an active admin signed in.
  React.useEffect(() => {
    if (usingMockData || !admin) return;
    const beat = () => {
      if (document.visibilityState === 'visible') void authService.heartbeat().catch(() => {});
    };
    const id = setInterval(beat, 5 * 60_000);
    return () => clearInterval(id);
  }, [admin]);

  const signIn = React.useCallback(
    async (email: string, password: string, rememberMe = false): Promise<LoginResponse> => {
      if (usingMockData) {
        const found = adminUsers.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
        const next = found ?? currentAdmin;
        writeLocal(SESSION_KEY, next.id);
        setAdmin(next);
        return {
          admin: {
            id: next.id,
            name: next.name,
            email: next.email,
            role: next.role,
            permissions: [],
            avatarUrl: null,
            twoFactorEnabled: next.twoFactorEnabled,
            lastLoginAt: next.lastLoginAt,
            mustChangePassword: false,
          },
          csrfToken: '',
        };
      }

      const res = await authService.login(email, password, rememberMe);
      if ('admin' in res) applySession(res.admin);
      return res;
    },
    [applySession],
  );

  const verifyTwoFactor = React.useCallback(
    async (challengeId: string, code: string): Promise<LoginResponse> => {
      const res = await authService.verifyTwoFactor(challengeId, code);
      if ('admin' in res) applySession(res.admin);
      return res;
    },
    [applySession],
  );

  const signOut = React.useCallback(() => {
    if (!usingMockData) void authService.logout().catch(() => {});
    setCsrfToken(null);
    writeLocal(SESSION_KEY, null);
    setAdmin(null);
    setPermissions(null);
    setPiiUnmasked(false);
  }, []);

  const switchRole = React.useCallback((adminId: string) => {
    // Fixture-only affordance for previewing role gating.
    if (!usingMockData) return;
    const next = adminUsers.find((a) => a.id === adminId);
    if (!next) return;
    writeLocal(SESSION_KEY, next.id);
    setAdmin(next);
  }, []);

  const can = React.useCallback(
    (permission: Permission) => {
      if (permissions) return permissions.includes(permission);
      return admin ? roleHas(admin.role, permission) : false;
    },
    [admin, permissions],
  );

  const value = React.useMemo<AuthContextValue>(
    () => ({
      admin,
      isRestoring,
      signIn,
      verifyTwoFactor,
      signOut,
      can,
      piiUnmasked: piiUnmasked && can('pii:read'),
      togglePii: () => setPiiUnmasked((v) => !v),
      switchRole,
    }),
    [admin, isRestoring, signIn, verifyTwoFactor, signOut, can, piiUnmasked, switchRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { ApiError };
