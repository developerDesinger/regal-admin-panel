import * as React from 'react';
import type { AdminUser } from '@/lib/types';
import type { Permission } from '@/lib/permissions';
import type { LoginResponse } from '@/lib/api/types';

export interface AuthContextValue {
  admin: AdminUser | null;
  /** True while the boot-time /auth/me is in flight, so we don't flash /login. */
  isRestoring: boolean;
  /**
   * Resolves to the server's response so the login screen can branch on a 2FA
   * challenge. On the mock path it always resolves to a completed sign-in.
   */
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<LoginResponse>;
  verifyTwoFactor: (challengeId: string, code: string) => Promise<LoginResponse>;
  signOut: () => void;
  /** UI gating only — the API re-authorizes every call server-side (§15). */
  can: (permission: Permission) => boolean;
  /** PII unmasking is itself an audited action (§06). */
  piiUnmasked: boolean;
  togglePii: () => void;
  switchRole: (adminId: string) => void;
}

export const AuthContext = React.createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Maps the API's admin payload onto the shape the UI already renders. */
export type { AdminUser };
