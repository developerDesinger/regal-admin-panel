/** Deterministic PRNG so mock data is stable across reloads and reviews. */
export function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function between(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** Anchor date — mock data is generated relative to this so it never drifts. */
export const NOW = new Date('2026-08-06T10:00:00.000Z');

export function daysAgo(n: number, hourOffset = 0): string {
  return new Date(NOW.getTime() - n * 86_400_000 + hourOffset * 3_600_000).toISOString();
}

export function daysAhead(n: number): string {
  return new Date(NOW.getTime() + n * 86_400_000).toISOString();
}

export const AVATAR_COLORS = [
  'bg-brand-500',
  'bg-info-500',
  'bg-success-500',
  'bg-secondary-500',
  'bg-accent-500',
  'bg-chart-6',
] as const;

export const FIRST_NAMES = [
  'Ana', 'Luis', 'Sofía', 'Mateo', 'Camila', 'Diego', 'Valentina', 'Santiago',
  'Isabella', 'Sebastián', 'Lucía', 'Emiliano', 'Regina', 'Nicolás', 'Renata',
  'Alejandro', 'Ximena', 'Gabriel', 'Fernanda', 'Andrés', 'Paula', 'Tomás',
];

export const LAST_NAMES = [
  'García', 'Hernández', 'Martínez', 'López', 'Rodríguez', 'Pérez', 'Sánchez',
  'Ramírez', 'Torres', 'Flores', 'Rivera', 'Gómez', 'Díaz', 'Cruz', 'Morales',
];
