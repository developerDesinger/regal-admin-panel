import * as React from 'react';
import type { AdminUser } from '@/lib/types';
import type { Permission } from '@/lib/permissions';

export interface AuthContextValue {
  admin: AdminUser | null;
  signIn: (email: string) => AdminUser;
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
