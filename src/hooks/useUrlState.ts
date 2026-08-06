import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * All filter, sort and pagination state is serialized to the URL so any view is
 * shareable (§4 DateRangePicker / FilterBar, Appendix checklist).
 */
export function useUrlState() {
  const [params, setParams] = useSearchParams();

  const get = useCallback((key: string, fallback = '') => params.get(key) ?? fallback, [params]);

  const set = useCallback(
    (patch: Record<string, string | number | null | undefined>, opts?: { resetPage?: boolean }) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === null || v === undefined || v === '' || v === 'all') next.delete(k);
            else next.set(k, String(v));
          }
          if (opts?.resetPage !== false) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const clear = useCallback(
    (keep: string[] = ['range', 'compare']) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams();
          keep.forEach((k) => {
            const v = prev.get(k);
            if (v) next.set(k, v);
          });
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const all = useMemo(() => Object.fromEntries(params.entries()), [params]);

  return { params, get, set, clear, all };
}

/** localStorage-backed state — sidebar collapse, recent searches, column visibility. */
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — non-fatal, state simply doesn't persist */
  }
}
