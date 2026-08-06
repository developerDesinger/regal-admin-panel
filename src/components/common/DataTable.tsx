import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Inbox,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState, ErrorState, TableSkeleton } from './EmptyState';
import { cn } from '@/lib/utils';
import { readLocal, writeLocal } from '@/hooks/useUrlState';

/**
 * DataTable (§4)
 * Sticky header · zebra neutral-50 · row hover neutral-100 · 52px rows ·
 * column visibility menu · multi-select with a bulk-action bar that slides in
 * from the bottom · sticky first column on horizontal scroll · empty, loading
 * and error states all required · row click → detail, ⌘-click → new tab.
 *
 * Sorting/paging is driven by props so the real implementation stays
 * server-side (§21 Performance). The mock adapter sorts in memory.
 */

export interface Column<T> {
  id: string;
  header: string;
  /** Right-align + tabular figures for money and counts (§2.3). */
  numeric?: boolean;
  sortable?: boolean;
  width?: string;
  /** Hidden by default but available in the column-visibility menu. */
  defaultHidden?: boolean;
  cell: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Row click destination — also opens in a new tab on ⌘/Ctrl-click. */
  rowHref?: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  empty?: { headline: string; description: string; action?: { label: string; onClick: () => void } };
  /** Enables checkboxes + the bulk-action bar. */
  bulkActions?: (selected: T[], clear: () => void) => React.ReactNode;
  pageSize?: number;
  /** Persist column visibility per table. */
  storageKey?: string;
  stickyFirstColumn?: boolean;
  initialSort?: { id: string; dir: 'asc' | 'desc' };
  /** Row-level tint, e.g. failed payouts pinned with a danger-50 row (§11). */
  rowClassName?: (row: T) => string | undefined;
  toolbar?: React.ReactNode;
  dense?: boolean;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  onRowClick,
  loading,
  error,
  onRetry,
  empty,
  bulkActions,
  pageSize = 25,
  storageKey,
  stickyFirstColumn = true,
  initialSort,
  rowClassName,
  toolbar,
  dense,
}: DataTableProps<T>) {
  const navigate = useNavigate();
  const [page, setPage] = React.useState(0);
  const [sort, setSort] = React.useState(initialSort ?? null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [hidden, setHidden] = React.useState<Set<string>>(() => {
    const stored = storageKey ? readLocal<string[] | null>(`table:${storageKey}`, null) : null;
    return new Set(stored ?? columns.filter((c) => c.defaultHidden).map((c) => c.id));
  });

  React.useEffect(() => {
    if (storageKey) writeLocal(`table:${storageKey}`, [...hidden]);
  }, [hidden, storageKey]);

  React.useEffect(() => {
    setPage(0);
  }, [rows.length]);

  const visibleColumns = columns.filter((c) => !hidden.has(c.id));
  const sortableColumns = visibleColumns.filter((c) => c.sortable);

  const sorted = React.useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.id === sort.id);
    if (!col?.sortValue) return rows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av === bv) return 0;
      return av > bv ? dir : -dir;
    });
  }, [rows, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const selectedRows = sorted.filter((r) => selected.has(rowKey(r)));
  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(rowKey(r)));
  const someOnPageSelected = pageRows.some((r) => selected.has(rowKey(r)));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageRows.forEach((r) => next.delete(rowKey(r)));
      else pageRows.forEach((r) => next.add(rowKey(r)));
      return next;
    });
  };

  const toggleSort = (col: Column<T>) => {
    if (!col.sortable) return;
    setSort((prev) =>
      prev?.id === col.id
        ? prev.dir === 'desc'
          ? { id: col.id, dir: 'asc' }
          : null
        : { id: col.id, dir: 'desc' },
    );
  };

  const handleRowActivate = (row: T, e: React.MouseEvent | React.KeyboardEvent) => {
    const href = rowHref?.(row);
    if (onRowClick) return onRowClick(row);
    if (!href) return;
    // ⌘/Ctrl-click opens in a new tab (§4 DataTable)
    if ('metaKey' in e && (e.metaKey || e.ctrlKey)) {
      window.open(href, '_blank', 'noopener');
      return;
    }
    navigate(href);
  };

  const interactive = Boolean(rowHref || onRowClick);
  const rowHeight = dense ? 'h-[44px]' : 'h-[52px]';

  return (
    <div className="relative">
      {(toolbar || storageKey || sortableColumns.length > 0) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 flex-1">{toolbar}</div>

          {/* Sorting lives in the column headers, which are hidden on mobile —
              this is the equivalent control for the card layout. */}
          {sortableColumns.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="md:hidden">
                  <ArrowUpDown className="h-4 w-4" />
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                {sortableColumns.map((c) => (
                  <DropdownMenuItem key={c.id} onSelect={() => toggleSort(c)}>
                    {c.header}
                    {sort?.id === c.id && (
                      <span className="ml-auto text-caption text-brand-500">
                        {sort.dir === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {storageKey && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="hidden md:inline-flex">
                  <Columns3 className="h-4 w-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
                {columns.map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.id}
                    checked={!hidden.has(c.id)}
                    onCheckedChange={(checked) =>
                      setHidden((prev) => {
                        const next = new Set(prev);
                        if (checked) next.delete(c.id);
                        else next.add(c.id);
                        return next;
                      })
                    }
                    onSelect={(e) => e.preventDefault()}
                  >
                    {c.header}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-0">
        {/* Below md a 12-column table is unreadable even with sideways scroll, so
            each row becomes a stacked card: primary column as the heading, the
            rest as label/value pairs. */}
        {!loading && !error && pageRows.length > 0 && (
          <ul className="divide-y divide-neutral-200 md:hidden">
            {pageRows.map((row) => {
              const key = rowKey(row);
              const isSelected = selected.has(key);
              const [primary, ...rest] = visibleColumns;
              const detailCols = rest.filter((c) => c.header);
              const actionCols = rest.filter((c) => !c.header);
              return (
                <li
                  key={key}
                  className={cn('p-4', isSelected && 'bg-brand-50', rowClassName?.(row))}
                >
                  <div className="flex items-start gap-3">
                    {bulkActions && (
                      <Checkbox
                        className="mt-1"
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (checked) next.add(key);
                            else next.delete(key);
                            return next;
                          })
                        }
                        aria-label="Select row"
                      />
                    )}
                    <button
                      type="button"
                      onClick={(e) => interactive && handleRowActivate(row, e)}
                      className={cn(
                        'min-w-0 flex-1 text-left',
                        interactive && 'rounded-sm hover:text-brand-500',
                      )}
                    >
                      {primary?.cell(row)}
                    </button>
                    {actionCols.map((c) => (
                      <span key={c.id} className="shrink-0">
                        {c.cell(row)}
                      </span>
                    ))}
                  </div>
                  {detailCols.length > 0 && (
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                      {detailCols.map((c) => (
                        <div key={c.id} className="min-w-0">
                          <dt className="text-caption text-neutral-500">{c.header}</dt>
                          <dd
                            className={cn(
                              'mt-0.5 truncate text-body text-neutral-700',
                              c.numeric && 'tnum font-medium text-neutral-900',
                            )}
                          >
                            {c.cell(row)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* The table scrolls sideways inside its container; the page body never does (§2.5) */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-neutral-50">
              <tr className="border-b border-neutral-200">
                {bulkActions && (
                  <th scope="col" className="w-10 px-4 py-3">
                    <Checkbox
                      checked={
                        allOnPageSelected ? true : someOnPageSelected ? 'indeterminate' : false
                      }
                      onCheckedChange={toggleAll}
                      aria-label="Select all rows on this page"
                    />
                  </th>
                )}
                {visibleColumns.map((col, i) => (
                  <th
                    key={col.id}
                    scope="col"
                    style={{ width: col.width }}
                    aria-sort={
                      sort?.id === col.id
                        ? sort.dir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : col.sortable
                          ? 'none'
                          : undefined
                    }
                    className={cn(
                      'whitespace-nowrap px-4 py-3 text-table-header uppercase text-neutral-500',
                      col.numeric ? 'text-right' : 'text-left',
                      stickyFirstColumn && i === 0 && !bulkActions && 'sticky left-0 bg-neutral-50',
                    )}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-sm transition-colors hover:text-neutral-700',
                          col.numeric && 'flex-row-reverse',
                        )}
                      >
                        {col.header}
                        {sort?.id === col.id ? (
                          sort.dir === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowDown className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-40" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                ))}
              </tr>
            </thead>

            {!loading && !error && pageRows.length > 0 && (
              <tbody>
                {pageRows.map((row, idx) => {
                  const key = rowKey(row);
                  const isSelected = selected.has(key);
                  return (
                    <tr
                      key={key}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('[data-no-row-click]')) return;
                        handleRowActivate(row, e);
                      }}
                      onKeyDown={(e) => {
                        if (interactive && e.key === 'Enter' && e.currentTarget === e.target) {
                          handleRowActivate(row, e);
                        }
                      }}
                      tabIndex={interactive ? 0 : undefined}
                      className={cn(
                        'border-b border-neutral-200 transition-colors duration-micro last:border-0',
                        rowHeight,
                        idx % 2 === 1 && 'bg-neutral-50',
                        isSelected && 'bg-brand-50',
                        interactive && 'cursor-pointer hover:bg-neutral-100',
                        rowClassName?.(row),
                      )}
                    >
                      {bulkActions && (
                        <td className="px-4" data-no-row-click>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) =>
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (checked) next.add(key);
                                else next.delete(key);
                                return next;
                              })
                            }
                            aria-label={`Select row ${idx + 1}`}
                          />
                        </td>
                      )}
                      {visibleColumns.map((col, i) => (
                        <td
                          key={col.id}
                          className={cn(
                            'px-4 text-body text-neutral-700',
                            col.numeric && 'tnum text-right font-medium text-neutral-900',
                            stickyFirstColumn &&
                              i === 0 &&
                              !bulkActions &&
                              'sticky left-0 bg-inherit',
                          )}
                        >
                          {col.cell(row)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>
        </div>

        {loading && <TableSkeleton columns={Math.min(visibleColumns.length, 7)} />}
        {!loading && error && <ErrorState message={error} onRetry={onRetry} />}
        {!loading && !error && pageRows.length === 0 && (
          <EmptyState
            icon={Inbox}
            headline={empty?.headline ?? 'No records match these filters'}
            description={
              empty?.description ??
              'Try widening the date range or clearing a filter to see more results.'
            }
            action={empty?.action}
          />
        )}

        {!loading && !error && sorted.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3">
            <p className="tnum text-caption text-neutral-500">
              {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, sorted.length)} of{' '}
              {sorted.length.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="icon-sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="tnum text-caption text-neutral-500">
                Page {safePage + 1} of {pageCount}
              </span>
              <Button
                variant="secondary"
                size="icon-sm"
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={safePage >= pageCount - 1}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk-action bar slides in from the bottom (§4) */}
      {bulkActions && selectedRows.length > 0 && (
        <div
          className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-lg border border-neutral-200 bg-neutral-0 px-4 py-3 shadow-e2 animate-slide-up"
          role="region"
          aria-label="Bulk actions"
        >
          <span className="tnum text-[14px] font-medium text-neutral-900">
            {selectedRows.length} selected
          </span>
          <div className="h-4 w-px bg-neutral-200" />
          {bulkActions(selectedRows, () => setSelected(new Set()))}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="rounded-sm p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
