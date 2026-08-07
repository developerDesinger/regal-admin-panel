import * as React from 'react';
import type { AdminUser } from '@/lib/types';
import type { Permission } from '@/lib/permissions';
import { AuthContext, type AuthContextValue } from '@/hooks/use-auth';
import { authService } from '@/lib/api/services';
import { registerCsrfRefresher, setCsrfToken, ApiError } from '@/lib/api/client';
import type { AdminSession, LoginResponse } from '@/lib/api/types';
import { avatarColorFor } from '@/lib/api/adapters';

/**
 * Session provider.
 *
 * The session is an httpOnly cookie the server sets — there is no token here to
 * store or leak. We hold only the CSRF token, in memory, and re-read it from
 * /auth/me on boot so a refresh keeps the session alive.
 */

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
  const [admin, setAdmin] = React.useState<AdminUser | null>(null);
  /** The server is the source of truth for what this session may do. */
  const [permissions, setPermissions] = React.useState<string[]>([]);
  const [isRestoring, setIsRestoring] = React.useState(true);
  const [piiUnmasked, setPiiUnmasked] = React.useState(false);

  const applySession = React.useCallback((session: AdminSession) => {
    setAdmin(toAdminUser(session));
    setPermissions(session.permissions);
  }, []);

  // Boot: restore the session from the cookie. A 401 here is the normal
  // signed-out case, not an error worth surfacing.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await authService.me();
        if (!cancelled) applySession(session);
      } catch {
        if (!cancelled) {
          setAdmin(null);
          setPermissions([]);
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
    registerCsrfRefresher(async () => {
      const session = await authService.me();
      applySession(session);
    });
    return () => registerCsrfRefresher(null);
  }, [applySession]);

  // Idle timeout is 30 minutes server-side and any request refreshes it, so a
  // periodic heartbeat while the tab is in use keeps an active admin signed in.
  React.useEffect(() => {
    if (!admin) return;
    const beat = () => {
      if (document.visibilityState === 'visible') void authService.heartbeat().catch(() => {});
    };
    const id = setInterval(beat, 5 * 60_000);
    return () => clearInterval(id);
  }, [admin]);

  const signIn = React.useCallback(
    async (email: string, password: string, rememberMe = false): Promise<LoginResponse> => {
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
    void authService.logout().catch(() => {});
    setCsrfToken(null);
    setAdmin(null);
    setPermissions([]);
    setPiiUnmasked(false);
  }, []);


  const can = React.useCallback(
    // Hiding a button is UX; every route is enforced server-side too.
    (permission: Permission) => permissions.includes(permission),
    [permissions],
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
    }),
    [admin, isRestoring, signIn, verifyTwoFactor, signOut, can, piiUnmasked],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { ApiError };
