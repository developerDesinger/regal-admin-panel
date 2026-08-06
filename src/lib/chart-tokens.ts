/**
 * Data-visualization tokens (§2.2).
 *
 * Ordered categorical series — use in this order, never randomize. Values
 * resolve through the CSS variables in index.css so charts follow the theme.
 */
export const CHART_COLORS = [
  'rgb(var(--chart-1))', // brand purple — primary metric
  'rgb(var(--chart-2))', // blue         — comparison / previous period
  'rgb(var(--chart-3))', // green        — positive / confirmed
  'rgb(var(--chart-4))', // amber        — clovers
  'rgb(var(--chart-5))', // pink         — gift cards
  'rgb(var(--chart-6))', // teal         — fifth series
  'rgb(var(--chart-7))', // slate        — other / remainder
];

/** Previous-period comparison lines: neutral-400, 2px dashed (`4 4`). */
export const COMPARISON_COLOR = 'rgb(var(--neutral-400))';

/** Grid lines: neutral-200, 1px, horizontal only. */
export const GRID_COLOR = 'rgb(var(--neutral-200))';
