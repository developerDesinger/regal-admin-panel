/** Date-range presets shared by the picker and by export filter labels (§4). */

export const RANGE_PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: 'mtd', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'qtd', label: 'This quarter' },
  { id: 'ytd', label: 'Year to date' },
  { id: 'custom', label: 'Custom' },
] as const;

export type RangeId = (typeof RANGE_PRESETS)[number]['id'];

export function rangeLabel(id: string): string {
  return RANGE_PRESETS.find((p) => p.id === id)?.label ?? 'Last 30 days';
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
