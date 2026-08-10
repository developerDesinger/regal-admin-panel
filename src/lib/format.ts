/**
 * Formatting helpers (§21 Money Handling / Time & Timezone).
 *
 * The backend stores money in MINOR UNITS (centavos). Every display divides by
 * 100 and renders with an explicit currency. A raw integer must never reach the
 * screen — route everything through `formatMoney`.
 */

export type Currency = 'MXN' | 'USD';

/** Minor units → "$1,250.00 MXN". The only sanctioned money formatter. */
export function formatMoney(
  minorUnits: number | null | undefined,
  currency: Currency = 'MXN',
  opts: { showCurrency?: boolean; signed?: boolean } = {},
): string {
  const { showCurrency = true, signed = false } = opts;
  if (minorUnits == null || Number.isNaN(minorUnits)) return '—';

  const negative = minorUnits < 0;
  const major = Math.abs(minorUnits) / 100;
  const body = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(major);

  const sign = negative ? '−' : signed ? '+' : '';
  return `${sign}${body}${showCurrency ? ` ${currency}` : ''}`;
}

/** Compact money for chart axes only — never for tables or KPI values. */
export function formatMoneyCompact(minorUnits: number, currency: Currency = 'MXN'): string {
  const major = minorUnits / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(major);
}

export function formatNumber(n: number | null | undefined, decimals = 0): string {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toFixed(decimals)}%`;
}

/** Percentage-point delta, e.g. "+2.4 pp" — used where the metric is itself a %. */
export function formatPP(value: number, decimals = 1): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(decimals)} pp`;
}

export function formatClovers(n: number, signed = false): string {
  const sign = n > 0 && signed ? '+' : n < 0 ? '−' : '';
  return `${sign}${formatNumber(Math.abs(n))}`;
}

export function formatDuration(hours: number): string {
  if (hours == null || Number.isNaN(hours)) return '—';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} days`;
}

/* ---------------------------------------------------------------- time --- */

/** The admin's display timezone. Stored/transmitted UTC, displayed local (§21). */
export const DISPLAY_TZ =
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Mexico_City';

export const TZ_LABEL = (() => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZoneName: 'short',
    timeZone: DISPLAY_TZ,
  }).formatToParts(new Date());
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? 'UTC';
})();

/** "2026-08-04 14:32 CST" — absolute time with an explicit timezone label. */
export function formatDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  const date = d.toISOString().slice(0, 10);
  const time = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: DISPLAY_TZ,
  }).format(d);
  return `${date} ${time} ${TZ_LABEL}`;
}

/** "4 Aug 2026" */
export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: DISPLAY_TZ,
  }).format(d);
}

/** "in 3 days" / "2 days ago" */
export function formatRelative(iso: string | Date | null | undefined, now = new Date()): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';

  const diffMs = d.getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000_000],
    ['month', 2_592_000_000],
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms) return rtf.format(Math.round(diffMs / ms), unit);
  }
  return 'just now';
}

/** Positive when the date is in the future. */
export function daysUntil(iso: string, now = new Date()): number {
  return (new Date(iso).getTime() - now.getTime()) / 86_400_000;
}

export function initials(name: string | null | undefined): string {
  return (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** Privacy masking (§06). `alishba@gmail.com` → `a•••@gmail.com`. */
export function maskEmail(email: string | null | undefined): string {
  const [local, domain] = (email ?? '').split('@');
  if (!domain) return '•••';
  return `${local.slice(0, 1)}•••@${domain}`;
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  return `••• ••• ${phone.slice(-4)}`;
}

/** Truncate an id for display while keeping it copyable in full. */
export function shortId(id: string | null | undefined, keep = 8): string {
  if (!id) return '—';
  return id.length <= keep + 3 ? id : `${id.slice(0, keep)}…`;
}
