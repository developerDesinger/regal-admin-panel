import { useTranslation } from 'react-i18next';
import * as React from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUrlState } from '@/hooks/useUrlState';
import { cn } from '@/lib/utils';

/**
 * FilterBar (§4) — horizontal row of dropdown filters + active-filter chips
 * (each with an ✕) + "Clear all". All filter state is serialized to the URL.
 */

export interface FilterDef {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  width?: string;
}

export function FilterBar({
  filters,
  searchPlaceholder,
  showSearch = true,
  children,
  className,
}: {
  filters: FilterDef[];
  searchPlaceholder?: string;
  showSearch?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  const { get, set, clear, all } = useUrlState();
  const placeholder = searchPlaceholder ?? t('filters.searchPlaceholder');
  const [searchDraft, setSearchDraft] = React.useState(get('q'));

  React.useEffect(() => {
    const t = setTimeout(() => set({ q: searchDraft || null }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  const activeChips = filters
    .filter((f) => all[f.id] && all[f.id] !== 'all')
    .map((f) => ({
      id: f.id,
      label: f.label,
      value: f.options.find((o) => o.value === all[f.id])?.label ?? all[f.id],
    }));

  if (all.q) activeChips.push({ id: 'q', label: t('filters.searchChip'), value: all.q });

  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        {showSearch && (
          <div className="relative col-span-2 min-w-0 sm:min-w-[200px] sm:flex-1 md:max-w-[280px]">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
              aria-hidden
            />
            <Input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder={placeholder}
              className="pl-9"
              aria-label={placeholder}
            />
          </div>
        )}

        {filters.map((f) => (
          <Select
            key={f.id}
            value={all[f.id] ?? 'all'}
            onValueChange={(v) => set({ [f.id]: v })}
          >
            <SelectTrigger
              className={cn('w-full gap-2 sm:w-auto sm:min-w-[130px]', f.width)}
              aria-label={f.label}
            >
              <SelectValue placeholder={f.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('filters.allOf', { label: f.label.toLowerCase() })}
              </SelectItem>
              {f.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}

        {children}
      </div>

      {activeChips.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          {activeChips.map((chip) => (
            <span
              key={chip.id}
              className="inline-flex items-center gap-1 rounded-sm bg-brand-50 py-1 pl-2 pr-1 text-caption font-medium text-brand-900"
            >
              <span className="text-brand-900/70">{chip.label}:</span>
              {chip.value}
              <button
                type="button"
                onClick={() => {
                  set({ [chip.id]: null });
                  if (chip.id === 'q') setSearchDraft('');
                }}
                className="rounded-sm p-0.5 transition-colors hover:bg-brand-100"
                aria-label={t('filters.removeFilter', { label: chip.label })}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-caption"
            onClick={() => {
              clear();
              setSearchDraft('');
            }}
          >
            {t('common.clearAll')}
          </Button>
        </div>
      )}
    </div>
  );
}
