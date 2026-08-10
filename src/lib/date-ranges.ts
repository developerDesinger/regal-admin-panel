/**
 * Date-range presets shared by the picker and by export filter labels (§4).
 *
 * Presets carry ids only — the visible label is looked up under `dateRange.<id>`
 * so switching language relabels them without touching this list.
 */

export const RANGE_PRESETS = [
  { id: 'today' },
  { id: 'yesterday' },
  { id: '7d' },
  { id: '30d' },
  { id: '90d' },
  { id: 'mtd' },
  { id: 'last_month' },
  { id: 'qtd' },
  { id: 'ytd' },
  { id: 'custom' },
] as const;

export type RangeId = (typeof RANGE_PRESETS)[number]['id'];

/** Translation key for a range id, falling back to the 30-day preset. */
export function rangeLabel(id: string): string {
  const known = RANGE_PRESETS.some((p) => p.id === id);
  return `dateRange.${known ? id : '30d'}`;
}

/** Number of days a preset covers — used to describe an export's filters. */
export function rangeDays(id: string): number | null {
  switch (id) {
    case 'today':
    case 'yesterday':
      return 1;
    case '7d':
      return 7;
    case '30d':
      return 30;
    case '90d':
      return 90;
    default:
      return null;
  }
}
