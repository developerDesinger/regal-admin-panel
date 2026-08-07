/**
 * The server's password policy (§4 Session rules): at least 8 characters with
 * upper, lower, digit and special. Mirrored here so the requirement is visible
 * while typing rather than only as a 422 after submit.
 */
export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (v: string) => v.length >= 8 },
  { id: 'upper', label: 'An uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { id: 'lower', label: 'A lowercase letter', test: (v: string) => /[a-z]/.test(v) },
  { id: 'digit', label: 'A number', test: (v: string) => /\d/.test(v) },
  { id: 'special', label: 'A special character', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

export function passwordMeetsPolicy(v: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(v));
}
