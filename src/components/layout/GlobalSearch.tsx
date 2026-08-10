import { useTranslation } from 'react-i18next';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Clock, CornerDownLeft, Search } from 'lucide-react';
import { useSearch } from '@/hooks/data';
import { readLocal, writeLocal } from '@/hooks/useUrlState';
import { cn } from '@/lib/utils';

/**
 * Global search (§21, ⌘K) — searches events (name, ID, share slug), users
 * (name, email, ID), contributions (ID, Stripe PaymentIntent ID) and cards
 * (name, slug). Grouped results with type badges; ↑↓ to navigate, ⏎ to open.
 * Recent searches persisted locally.
 */

type ResultType = 'event' | 'user' | 'contribution' | 'card';

const RESULT_TYPES: ResultType[] = ['event', 'user', 'contribution', 'card'];

const typeOf = (raw: string): ResultType =>
  (RESULT_TYPES as string[]).includes(raw) ? (raw as ResultType) : 'card';

interface Result {
  id: string;
  type: ResultType;
  title: string;
  subtitle: string;
  href: string;
}

const TYPE_TONE: Record<ResultType, string> = {
  event: 'bg-brand-50 text-brand-900',
  user: 'bg-info-50 text-info-500',
  contribution: 'bg-success-50 text-success-500',
  card: 'bg-accent-500/10 text-accent-500',
};


export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const [recent, setRecent] = React.useState<Result[]>(() => readLocal<Result[]>('regal:recent-search', []));

  // Server-side: results already respect the caller's permissions and
  // emails stay masked even for admins who could unmask (§19).
  const { hits } = useSearch(query);
  const results = React.useMemo(
    () => hits.map((h) => ({ id: h.id, type: typeOf(h.type), title: h.title, subtitle: h.subtitle, href: h.href })),
    [hits],
  );
  const showing = query.trim().length >= 2 ? results : recent;

  React.useEffect(() => {
    setActive(0);
  }, [query]);

  React.useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const open_ = (r: Result) => {
    const next = [r, ...recent.filter((x) => x.id !== r.id)].slice(0, 5);
    setRecent(next);
    writeLocal('regal:recent-search', next);
    onOpenChange(false);
    navigate(r.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(showing.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && showing[active]) {
      e.preventDefault();
      open_(showing[active]);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-neutral-900/40 data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[15vh] z-50 w-[calc(100vw-32px)] max-w-[600px] -translate-x-1/2 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-0 shadow-e2 data-[state=open]:animate-slide-up"
          aria-label={t('search.globalSearch')}
        >
          <DialogPrimitive.Title className="sr-only">{t('search.title')}</DialogPrimitive.Title>
          <div className="flex items-center gap-3 border-b border-neutral-200 px-4">
            <Search className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t('search.placeholder')}
              aria-label={t('search.ariaLabel')}
              aria-activedescendant={showing[active] ? `search-opt-${showing[active].id}` : undefined}
              className="h-14 w-full bg-transparent text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400"
            />
            <kbd className="hidden shrink-0 rounded-sm border border-neutral-200 px-1.5 py-0.5 font-mono text-[11px] text-neutral-400 sm:block">
              {t('search.esc')}
            </kbd>
          </div>

          <div className="max-h-[400px] overflow-y-auto p-2" role="listbox">
            {query.trim().length < 2 && recent.length > 0 && (
              <p className="px-3 py-2 text-table-header uppercase text-neutral-500">
                {t('search.recent')}
              </p>
            )}

            {showing.length === 0 ? (
              <p className="px-3 py-8 text-center text-body text-neutral-500">
                {query.trim().length < 2
                  ? t('search.minChars')
                  : t('search.noResults', { query })}
              </p>
            ) : (
              <ul>
                {showing.map((r, i) => (
                  <li key={`${r.type}-${r.id}`}>
                    <button
                      type="button"
                      id={`search-opt-${r.id}`}
                      role="option"
                      aria-selected={i === active}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => open_(r)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
                        i === active ? 'bg-neutral-100' : 'hover:bg-neutral-50',
                      )}
                    >
                      {query.trim().length < 2 && (
                        <Clock className="h-3 w-3 shrink-0 text-neutral-400" aria-hidden />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium leading-5 text-neutral-900">
                          {r.title}
                        </span>
                        <span className="block truncate text-caption text-neutral-500">{r.subtitle}</span>
                      </span>
                      <span
                        className={cn(
                          'shrink-0 rounded-sm px-1.5 py-px text-[11px] font-medium',
                          TYPE_TONE[r.type],
                        )}
                      >
                        {t(`search.type.${r.type}`)}
                      </span>
                      {i === active && (
                        <CornerDownLeft className="h-3 w-3 shrink-0 text-neutral-400" aria-hidden />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center gap-4 border-t border-neutral-200 px-4 py-2 text-caption text-neutral-400">
            <span>↑↓ {t('search.navigate')}</span>
            <span>⏎ {t('search.open')}</span>
            <span>
              {t('search.esc')} {t('search.close')}
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
