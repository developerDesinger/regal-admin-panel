/**
 * The server's password policy (§4 Session rules): at least 8 characters with
 * upper, lower, digit and special. Mirrored here so the requirement is visible
 * while typing rather than only as a 422 after submit.
 *
 * Rules carry ids only — the checklist text lives under `auth.passwordRules.<id>`.
 */
export const PASSWORD_RULES = [
  { id: 'length', test: (v: string) => v.length >= 8 },
  { id: 'upper', test: (v: string) => /[A-Z]/.test(v) },
  { id: 'lower', test: (v: string) => /[a-z]/.test(v) },
  { id: 'digit', test: (v: string) => /\d/.test(v) },
  { id: 'special', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

export function passwordMeetsPolicy(v: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(v));
}
