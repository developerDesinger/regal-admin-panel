import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  GripVertical,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Search,
  Smartphone,
  Table2,
  Trash2,
  Upload,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { Chip, StatusBadge } from '@/components/common/StatusBadge';
import { CloverValue } from '@/components/common/MoneyValue';
import { CardUploadDialog } from './CardUploadDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useStore } from '@/lib/store';
import { useAdminMutations } from '@/hooks/data/mutations';
import { useCatalog } from '@/hooks/data';
import { cardColumns } from '@/lib/datasets';
import { ExportButton } from '@/components/common/ExportButton';
import { useUrlState } from '@/hooks/useUrlState';
import { formatDate, formatNumber } from '@/lib/format';
import type { GiftCardDesign } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Screen 09 — Card Catalog Manager (§09).
 * The client's explicitly requested new capability: admins upload new card
 * designs and set the clover price at which users unlock them.
 */
export default function CardCatalog() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { can } = useAuth();
  const { giftCards: storeCards } = useStore();
  const { rows: apiCards, isMock } = useCatalog();
  const mutations = useAdminMutations();
  const giftCards = isMock ? storeCards : apiCards;
  const { get, set, all } = useUrlState();

  const [view, setView] = React.useState<'grid' | 'table'>(
    (get('view', 'grid') as 'grid' | 'table') ?? 'grid',
  );
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<GiftCardDesign | null>(null);
  const [deleting, setDeleting] = React.useState<GiftCardDesign | null>(null);
  const [priceChange, setPriceChange] = React.useState<GiftCardDesign | null>(null);
  const [newPrice, setNewPrice] = React.useState('');
  const [reordering, setReordering] = React.useState(false);
  const [order, setOrder] = React.useState<string[]>(() => giftCards.map((c) => c.id));

  // Keep the local ordering in step when cards are added or removed.
  React.useEffect(() => {
    setOrder((prev) => {
      const ids = giftCards.map((c) => c.id);
      const kept = prev.filter((id) => ids.includes(id));
      const added = ids.filter((id) => !kept.includes(id));
      return [...kept, ...added];
    });
  }, [giftCards]);
  const [dirty, setDirty] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const filtered = React.useMemo(() => {
    const bySort = [...giftCards].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    return bySort
      .filter((c) => {
        if (all.category && all.category !== 'all' && !c.categories.includes(all.category as never))
          return false;
        if (all.tier === 'free' && c.cloverCost > 0) return false;
        if (all.tier === 'premium' && c.cloverCost === 0) return false;
        if (all.state === 'active' && !c.isActive) return false;
        if (all.state === 'inactive' && c.isActive) return false;
        if (search && !`${c.name} ${c.slug}`.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        if (reordering) return 0;
        switch (all.sort) {
          case 'newest':
            return +new Date(b.createdAt) - +new Date(a.createdAt);
          case 'most_used':
            return b.timesSelected - a.timesSelected;
          case 'cost':
            return b.cloverCost - a.cloverCost;
          default:
            return 0;
        }
      });
  }, [all, order, search, reordering, giftCards]);

  const move = (id: string, dir: -1 | 1) => {
    setOrder((prev) => {
      const idx = prev.indexOf(id);
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    setDirty(true);
  };

  const columns: Column<GiftCardDesign>[] = [
    {
      id: 'design',
      header: 'Design',
      width: '240px',
      sortable: true,
      sortValue: (c) => c.name,
      cell: (c) => (
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              'flex h-10 w-8 shrink-0 items-center justify-center rounded-sm text-[16px]',
              !c.isActive && 'opacity-50',
            )}
            style={{ backgroundColor: c.bg }}
            aria-hidden
          >
            {c.emojiKey}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-neutral-900">{c.name}</p>
            <p className="truncate font-mono text-caption text-neutral-500">{c.slug}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'categories',
      header: 'Categories',
      cell: (c) => (
        <div className="flex flex-wrap gap-1">
          {c.categories.map((cat) => (
            <Chip key={cat}>{cat}</Chip>
          ))}
        </div>
      ),
    },
    {
      id: 'cost',
      header: 'Clover cost',
      numeric: true,
      sortable: true,
      sortValue: (c) => c.cloverCost,
      cell: (c) =>
        c.cloverCost > 0 ? (
          <CloverValue amount={c.cloverCost} className="justify-end" />
        ) : (
          <Chip tone="neutral">FREE</Chip>
        ),
    },
    {
      id: 'usage',
      header: 'Times used',
      numeric: true,
      sortable: true,
      sortValue: (c) => c.timesSelected,
      cell: (c) => <span className="tnum">{formatNumber(c.timesSelected)}</span>,
    },
    {
      id: 'unlocks',
      header: 'Unlocks',
      numeric: true,
      sortable: true,
      sortValue: (c) => c.unlocks,
      cell: (c) => <span className="tnum">{formatNumber(c.unlocks)}</span>,
    },
    {
      id: 'version',
      header: 'Version',
      numeric: true,
      cell: (c) => <span className="tnum">v{c.version}</span>,
    },
    {
      id: 'sortOrder',
      header: 'Order',
      numeric: true,
      sortable: true,
      sortValue: (c) => c.sortOrder,
      cell: (c) => <span className="tnum">{c.sortOrder}</span>,
    },
    {
      id: 'state',
      header: 'State',
      cell: (c) => (
        <StatusBadge status={c.isActive ? 'active' : 'inactive'} label={c.isActive ? 'Active' : 'Inactive'} />
      ),
    },
    {
      id: 'created',
      header: 'Created',
      sortable: true,
      defaultHidden: true,
      sortValue: (c) => c.createdAt,
      cell: (c) => <span className="tnum">{formatDate(c.createdAt)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Gift Cards' }, { label: 'Catalog' }]}
        title="Card Catalog"
        subtitle="Upload designs, set the clover price users pay to unlock them, and control what the app shows."
        actions={
          <>
            <div className="flex rounded-md border border-neutral-300 p-0.5" role="group" aria-label="View mode">
              {(
                [
                  ['grid', LayoutGrid, 'Grid view'],
                  ['table', Table2, 'Table view'],
                ] as const
              ).map(([mode, Icon, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setView(mode);
                    set({ view: mode });
                  }}
                  aria-label={label}
                  aria-pressed={view === mode}
                  className={cn(
                    'rounded-sm p-1.5 transition-colors',
                    view === mode ? 'bg-brand-50 text-brand-500' : 'text-neutral-400 hover:text-neutral-700',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
            <ExportButton
              name="card-catalog"
              label="Cards"
              columns={cardColumns}
              rows={filtered}
              filterSummary={`${filtered.length} of ${giftCards.length} designs`}
            />
            {can('cards:write') && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setReordering((v) => !v);
                    setDirty(false);
                  }}
                  aria-pressed={reordering}
                >
                  <GripVertical className="h-4 w-4 text-neutral-400" />
                  {reordering ? 'Exit reorder' : 'Reorder'}
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setEditing(null);
                    setUploadOpen(true);
                  }}
                >
                  <Upload className="h-4 w-4" />
                  Upload Card
                </Button>
              </>
            )}
          </>
        }
      />

      {/* Toolbar */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <div className="relative col-span-2 min-w-0 sm:min-w-[200px] sm:flex-1 md:max-w-[260px]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search designs…"
            className="pl-9"
            aria-label="Search designs"
          />
        </div>
        <Select value={all.category ?? 'all'} onValueChange={(v) => set({ category: v })}>
          <SelectTrigger className="w-full sm:w-auto sm:min-w-[140px]" aria-label="Category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {['birthday', 'wedding', 'farewell', 'graduation', 'baby', 'thanks', 'holiday', 'general'].map(
              (c) => (
                <SelectItem key={c} value={c} className="capitalize">
                  {c}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        <Select value={all.tier ?? 'all'} onValueChange={(v) => set({ tier: v })}>
          <SelectTrigger className="w-full sm:w-auto sm:min-w-[130px]" aria-label="Tier">
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tiers</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="premium">Premium</SelectItem>
          </SelectContent>
        </Select>
        <Select value={all.state ?? 'all'} onValueChange={(v) => set({ state: v })}>
          <SelectTrigger className="w-full sm:w-auto sm:min-w-[130px]" aria-label="State">
            <SelectValue placeholder="State" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All states</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={all.sort ?? 'sort_order'} onValueChange={(v) => set({ sort: v })}>
          <SelectTrigger className="w-full sm:w-auto sm:min-w-[150px]" aria-label="Sort by">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sort_order">Sort order</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="most_used">Most used</SelectItem>
            <SelectItem value="cost">Highest clover cost</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {reordering && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-brand-300 bg-brand-50 p-3">
          <p className="text-body text-brand-900">
            Reorder mode — drag tiles, or use the ↑ ↓ buttons on a focused tile. This controls the
            order users see in the mobile app.
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setOrder([...giftCards].sort((a, b) => a.sortOrder - b.sortOrder).map((c) => c.id));
                setDirty(false);
                setReordering(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!dirty}
              onClick={() => {
                void mutations.reorderCards(order);
                toast({
                  title: 'Order saved',
                  description: 'New sortOrder written to the audit trail.',
                  tone: 'success',
                });
                setDirty(false);
                setReordering(false);
              }}
            >
              Save order
            </Button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          headline="No designs match these filters"
          description="Clear a filter, or upload the first design in this category."
          action={can('cards:write') ? { label: 'Upload card', onClick: () => setUploadOpen(true) } : undefined}
        />
      ) : view === 'grid' ? (
        <ul className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {filtered.map((card, i) => (
            <li key={card.id}>
              <div
                className={cn(
                  'group relative rounded-lg border border-neutral-200 bg-neutral-0 p-3 transition-colors hover:border-brand-300',
                  !card.isActive && 'opacity-50',
                )}
              >
                {!card.isActive && (
                  <span className="absolute left-3 top-3 z-10 rounded-sm bg-neutral-900/80 px-2 py-1 text-[11px] font-semibold uppercase text-white">
                    Inactive
                  </span>
                )}

                <Link to={`/cards/catalog/${card.id}`} className="block">
                  <div
                    className="relative flex aspect-[3/4] items-center justify-center rounded-md text-[44px]"
                    style={{ backgroundColor: card.bg }}
                  >
                    <span aria-hidden>{card.emojiKey}</span>
                    {card.cloverCost > 0 ? (
                      <span className="tnum absolute right-2 top-2 rounded-full bg-neutral-900/70 px-2 py-1 text-[11px] font-semibold text-white">
                        🍀 {card.cloverCost}
                      </span>
                    ) : (
                      <span className="absolute right-2 top-2 rounded-full bg-success-500 px-2 py-1 text-[11px] font-semibold text-white">
                        FREE
                      </span>
                    )}
                  </div>
                  <p className="mt-2 truncate text-body font-medium text-neutral-900">{card.name}</p>
                </Link>

                <div className="mt-1 flex items-center justify-between gap-2">
                  <Chip>{card.categories[0]}</Chip>
                  <span className="tnum text-caption text-neutral-500">
                    {formatNumber(card.timesSelected)} uses
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  {reordering ? (
                    <div className="flex gap-1">
                      <Button
                        variant="secondary"
                        size="icon-sm"
                        onClick={() => move(card.id, -1)}
                        disabled={i === 0}
                        aria-label={`Move ${card.name} earlier`}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon-sm"
                        onClick={() => move(card.id, 1)}
                        disabled={i === filtered.length - 1}
                        aria-label={`Move ${card.name} later`}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <StatusBadge
                      status={card.isActive ? 'active' : 'inactive'}
                      label={card.isActive ? 'Active' : 'Inactive'}
                    />
                  )}

                  {can('cards:write') && !reordering && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="rounded-sm p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                        aria-label={`Actions for ${card.name}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => {
                            setEditing(card);
                            setUploadOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4 text-neutral-400" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => {
                            setPriceChange(card);
                            setNewPrice(String(card.cloverCost));
                          }}>
                          <CloverValue amount={0} showIcon className="!gap-0" />
                          Change clover price
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={async () => {
                            const copy = await mutations.duplicateCard(card);
                            toast({
                              title: 'Design duplicated',
                              description: `${copy?.name} · created inactive so you can edit it first`,
                              tone: 'success',
                            });
                          }}
                        >
                          <Copy className="h-4 w-4 text-neutral-400" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => toast({ title: 'Device preview', description: card.name, tone: 'info' })}
                        >
                          <Smartphone className="h-4 w-4 text-neutral-400" />
                          Preview on device
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() => {
                            void mutations.setCardActive(card, !card.isActive, '');
                            toast({
                              title: card.isActive ? 'Design deactivated' : 'Design activated',
                              description: `${card.name} · written to the audit trail`,
                              tone: 'success',
                            });
                          }}
                        >
                          {card.isActive ? 'Deactivate' : 'Activate'}
                        </DropdownMenuItem>
                        <DropdownMenuItem destructive onSelect={() => setDeleting(card)}>
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(c) => c.id}
          rowHref={(c) => `/cards/catalog/${c.id}`}
          storageKey="card-catalog"
          empty={{
            headline: 'No designs match these filters',
            description: 'Clear a filter, or upload the first design in this category.',
          }}
        />
      )}

      <CardUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} editing={editing} />

      {/* Deleting a card with unlocks is blocked — offer Deactivate instead (§09) */}
      {deleting &&
        (deleting.unlocks > 0 || deleting.timesSelected > 0 ? (
          <ConfirmDialog
            open
            onOpenChange={(o) => !o && setDeleting(null)}
            title="This design can’t be deleted"
            tone="primary"
            confirmLabel="Deactivate instead"
            consequence={
              <>
                <strong>{deleting.name}</strong> has{' '}
                <strong>{deleting.unlocks.toLocaleString()} unlocks</strong> and has been used on{' '}
                <strong>{deleting.timesSelected.toLocaleString()} events</strong>. Deleting it would
                strip a design users paid clovers for. Deactivating hides it from new selection while
                everyone who unlocked it keeps it.
              </>
            }
            onConfirm={(reason) => {
              void mutations.setCardActive(deleting, false, reason);
              toast({
                title: 'Design deactivated',
                description: `${deleting.name} · unlocks preserved`,
                tone: 'success',
              });
            }}
          />
        ) : (
          <ConfirmDialog
            open
            onOpenChange={(o) => !o && setDeleting(null)}
            title="Delete this design"
            requireTypedConfirmation={deleting.name}
            requireReason
            consequence={
              <>
                <strong>{deleting.name}</strong> has zero unlocks and zero usage, so it can be hard
                deleted. The artwork is removed from object storage and the slug is released. This
                cannot be undone.
              </>
            }
            confirmLabel="Delete permanently"
            onConfirm={(reason) => {
              void mutations.deleteCard(deleting, reason);
              toast({ title: 'Design deleted', description: deleting.name, tone: 'success' });
            }}
          />
        ))}

      {priceChange && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setPriceChange(null)}
          title="Change clover price"
          tone="primary"
          requireReason
          consequence={
            <>
              Changing the price of <strong>{priceChange.name}</strong> does{' '}
              <strong>not</strong> retroactively charge or refund anyone. The{' '}
              {priceChange.unlocks.toLocaleString()} users who already unlocked it at 🍀{' '}
              {priceChange.cloverCost} keep it at no further cost.
            </>
          }
          confirmLabel="Change price"
          onConfirm={(reason) => {
            const next = Number(newPrice);
            if (!Number.isFinite(next) || next < 0) return;
            void mutations.setCardPrice(priceChange, Math.round(next), reason);
            toast({
              title: 'Clover price updated',
              description: `${priceChange.name} · 🍀 ${priceChange.cloverCost} → 🍀 ${Math.round(next)}`,
              tone: 'success',
            });
          }}
        >
          <div>
            <Label htmlFor="new-price" required>
              New clover cost
            </Label>
            <Input
              id="new-price"
              type="number"
              min={0}
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              className="tnum mt-1"
            />
            <p className="mt-1 text-caption text-neutral-500">
              0 makes the design free for everyone.
            </p>
          </div>
        </ConfirmDialog>
      )}

      <p className="mt-6 text-caption text-neutral-500">
        Images are served from object storage behind a CDN and resized server-side into thumb (400w),
        preview (800w) and full (1600w) variants —{' '}
        <button
          type="button"
          onClick={() => navigate('/cards/analytics')}
          className="rounded-sm text-brand-500 hover:underline"
        >
          see how each design performs
        </button>
        .
      </p>
    </>
  );
}
