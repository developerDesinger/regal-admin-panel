import { Trans, useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { can } = useAuth();
  const { rows: giftCards } = useCatalog();
  const mutations = useAdminMutations();
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
      header: t('cards.catalog.table.design'),
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
      header: t('cards.catalog.table.categories'),
      cell: (c) => (
        <div className="flex flex-wrap gap-1">
          {c.categories.map((cat) => (
            <Chip key={cat}>{t(`occasion.${cat}`, { defaultValue: cat })}</Chip>
          ))}
        </div>
      ),
    },
    {
      id: 'cost',
      header: t('cards.catalog.table.cloverCost'),
      numeric: true,
      sortable: true,
      sortValue: (c) => c.cloverCost,
      cell: (c) =>
        c.cloverCost > 0 ? (
          <CloverValue amount={c.cloverCost} className="justify-end" />
        ) : (
          <Chip tone="neutral">{t('cards.freeUpper')}</Chip>
        ),
    },
    {
      id: 'usage',
      header: t('cards.catalog.table.timesUsed'),
      numeric: true,
      sortable: true,
      sortValue: (c) => c.timesSelected,
      cell: (c) => <span className="tnum">{formatNumber(c.timesSelected)}</span>,
    },
    {
      id: 'unlocks',
      header: t('cards.catalog.table.unlocks'),
      numeric: true,
      sortable: true,
      sortValue: (c) => c.unlocks,
      cell: (c) => <span className="tnum">{formatNumber(c.unlocks)}</span>,
    },
    {
      id: 'version',
      header: t('cards.catalog.table.version'),
      numeric: true,
      cell: (c) => <span className="tnum">v{c.version}</span>,
    },
    {
      id: 'sortOrder',
      header: t('cards.catalog.table.order'),
      numeric: true,
      sortable: true,
      sortValue: (c) => c.sortOrder,
      cell: (c) => <span className="tnum">{c.sortOrder}</span>,
    },
    {
      id: 'state',
      header: t('cards.catalog.table.state'),
      cell: (c) => (
        <StatusBadge
          status={c.isActive ? 'active' : 'inactive'}
          label={c.isActive ? t('status.active') : t('status.inactive')}
        />
      ),
    },
    {
      id: 'created',
      header: t('cards.catalog.table.created'),
      sortable: true,
      defaultHidden: true,
      sortValue: (c) => c.createdAt,
      cell: (c) => <span className="tnum">{formatDate(c.createdAt)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: t('nav.giftCards') },
          { label: t('cards.catalog.breadcrumb') },
        ]}
        title={t('cards.catalog.title')}
        subtitle={t('cards.catalog.subtitle')}
        actions={
          <>
            <div
              className="flex rounded-md border border-neutral-300 p-0.5"
              role="group"
              aria-label={t('cards.catalog.viewMode')}
            >
              {(
                [
                  ['grid', LayoutGrid, t('cards.catalog.gridView')],
                  ['table', Table2, t('cards.catalog.tableView')],
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
              label={t('cards.analytics.exportLabel')}
              columns={cardColumns}
              rows={filtered}
              filterSummary={t('cards.catalog.filterSummary', {
                shown: filtered.length,
                total: giftCards.length,
              })}
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
                  {reordering ? t('cards.catalog.exitReorder') : t('cards.catalog.reorder')}
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setEditing(null);
                    setUploadOpen(true);
                  }}
                >
                  <Upload className="h-4 w-4" />
                  {t('cards.catalog.uploadCard')}
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
            placeholder={t('cards.catalog.searchPlaceholder')}
            className="pl-9"
            aria-label={t('cards.catalog.searchLabel')}
          />
        </div>
        <Select value={all.category ?? 'all'} onValueChange={(v) => set({ category: v })}>
          <SelectTrigger
            className="w-full sm:w-auto sm:min-w-[140px]"
            aria-label={t('cards.catalog.category')}
          >
            <SelectValue placeholder={t('cards.catalog.category')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('cards.catalog.allCategories')}</SelectItem>
            {[
              'birthday',
              'wedding',
              'farewell',
              'graduation',
              'baby',
              'thanks',
              'holiday',
              'general',
            ].map((c) => (
              <SelectItem key={c} value={c}>
                {t(`occasion.${c}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={all.tier ?? 'all'} onValueChange={(v) => set({ tier: v })}>
          <SelectTrigger
            className="w-full sm:w-auto sm:min-w-[130px]"
            aria-label={t('cards.catalog.tier')}
          >
            <SelectValue placeholder={t('cards.catalog.tier')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('cards.catalog.allTiers')}</SelectItem>
            <SelectItem value="free">{t('cards.free')}</SelectItem>
            <SelectItem value="premium">{t('cards.premium')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={all.state ?? 'all'} onValueChange={(v) => set({ state: v })}>
          <SelectTrigger
            className="w-full sm:w-auto sm:min-w-[130px]"
            aria-label={t('cards.catalog.state')}
          >
            <SelectValue placeholder={t('cards.catalog.state')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('cards.catalog.allStates')}</SelectItem>
            <SelectItem value="active">{t('status.active')}</SelectItem>
            <SelectItem value="inactive">{t('status.inactive')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={all.sort ?? 'sort_order'} onValueChange={(v) => set({ sort: v })}>
          <SelectTrigger
            className="w-full sm:w-auto sm:min-w-[150px]"
            aria-label={t('cards.catalog.sortBy')}
          >
            <SelectValue placeholder={t('cards.catalog.sort')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sort_order">{t('cards.catalog.sortOrder')}</SelectItem>
            <SelectItem value="newest">{t('cards.catalog.newest')}</SelectItem>
            <SelectItem value="most_used">{t('cards.catalog.mostUsed')}</SelectItem>
            <SelectItem value="cost">{t('cards.catalog.highestCost')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {reordering && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-brand-300 bg-brand-50 p-3">
          <p className="text-body text-brand-900">{t('cards.catalog.reorderNote')}</p>
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
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!dirty}
              onClick={() => {
                void mutations.reorderCards(order);
                toast({
                  title: t('cards.catalog.orderSaved'),
                  description: t('cards.catalog.orderSavedBody'),
                  tone: 'success',
                });
                setDirty(false);
                setReordering(false);
              }}
            >
              {t('cards.catalog.saveOrder')}
            </Button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          headline={t('cards.catalog.emptyHeadline')}
          description={t('cards.catalog.emptyBody')}
          action={
            can('cards:write')
              ? { label: t('cards.catalog.uploadAction'), onClick: () => setUploadOpen(true) }
              : undefined
          }
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
                    {t('cards.inactive')}
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
                        {t('cards.freeUpper')}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 truncate text-body font-medium text-neutral-900">{card.name}</p>
                </Link>

                <div className="mt-1 flex items-center justify-between gap-2">
                  <Chip>
                    {t(`occasion.${card.categories[0]}`, { defaultValue: card.categories[0] })}
                  </Chip>
                  <span className="tnum text-caption text-neutral-500">
                    {t('cards.catalog.uses', { count: formatNumber(card.timesSelected) })}
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
                        aria-label={t('cards.catalog.moveEarlier', { name: card.name })}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon-sm"
                        onClick={() => move(card.id, 1)}
                        disabled={i === filtered.length - 1}
                        aria-label={t('cards.catalog.moveLater', { name: card.name })}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <StatusBadge
                      status={card.isActive ? 'active' : 'inactive'}
                      label={card.isActive ? t('status.active') : t('status.inactive')}
                    />
                  )}

                  {can('cards:write') && !reordering && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="rounded-sm p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                        aria-label={t('cards.catalog.actionsFor', { name: card.name })}
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
                          {t('cards.catalog.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => {
                            setPriceChange(card);
                            setNewPrice(String(card.cloverCost));
                          }}>
                          <CloverValue amount={0} showIcon className="!gap-0" />
                          {t('cards.catalog.changePrice')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={async () => {
                            const copy = await mutations.duplicateCard(card);
                            toast({
                              title: t('cards.catalog.duplicated'),
                              description: t('cards.catalog.duplicatedBody', { name: copy?.name }),
                              tone: 'success',
                            });
                          }}
                        >
                          <Copy className="h-4 w-4 text-neutral-400" />
                          {t('cards.catalog.duplicate')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() =>
                            toast({
                              title: t('cards.catalog.devicePreview'),
                              description: card.name,
                              tone: 'info',
                            })
                          }
                        >
                          <Smartphone className="h-4 w-4 text-neutral-400" />
                          {t('cards.catalog.previewOnDevice')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() => {
                            void mutations.setCardActive(card, !card.isActive, '');
                            toast({
                              title: card.isActive
                                ? t('cards.catalog.deactivated')
                                : t('cards.catalog.activated'),
                              description: t('cards.catalog.auditedBody', { name: card.name }),
                              tone: 'success',
                            });
                          }}
                        >
                          {card.isActive ? t('cards.catalog.deactivate') : t('cards.catalog.activate')}
                        </DropdownMenuItem>
                        <DropdownMenuItem destructive onSelect={() => setDeleting(card)}>
                          <Trash2 className="h-4 w-4" />
                          {t('cards.catalog.delete')}
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
            headline: t('cards.catalog.emptyHeadline'),
            description: t('cards.catalog.emptyBody'),
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
            title={t('cards.catalog.cannotDelete')}
            tone="primary"
            confirmLabel={t('cards.catalog.deactivateInstead')}
            consequence={
              <Trans
                i18nKey="cards.catalog.cannotDeleteBody"
                values={{
                  name: deleting.name,
                  unlocks: deleting.unlocks.toLocaleString(),
                  events: deleting.timesSelected.toLocaleString(),
                }}
                components={[
                  <strong key="0" />,
                  <span key="1" />,
                  <strong key="2" />,
                  <span key="3" />,
                  <strong key="4" />,
                ]}
              />
            }
            onConfirm={(reason) => {
              void mutations.setCardActive(deleting, false, reason);
              toast({
                title: t('cards.catalog.deactivated'),
                description: t('cards.catalog.unlocksPreserved', { name: deleting.name }),
                tone: 'success',
              });
            }}
          />
        ) : (
          <ConfirmDialog
            open
            onOpenChange={(o) => !o && setDeleting(null)}
            title={t('cards.catalog.deleteTitle')}
            requireTypedConfirmation={deleting.name}
            requireReason
            consequence={
              <Trans
                i18nKey="cards.catalog.deleteBody"
                values={{ name: deleting.name }}
                components={[<strong key="0" />]}
              />
            }
            confirmLabel={t('cards.catalog.deleteConfirm')}
            onConfirm={(reason) => {
              void mutations.deleteCard(deleting, reason);
              toast({ title: t('cards.catalog.deleted'), description: deleting.name, tone: 'success' });
            }}
          />
        ))}

      {priceChange && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setPriceChange(null)}
          title={t('cards.catalog.priceTitle')}
          tone="primary"
          requireReason
          consequence={
            <Trans
              i18nKey="cards.catalog.priceBody"
              values={{
                name: priceChange.name,
                unlocks: priceChange.unlocks.toLocaleString(),
                cost: priceChange.cloverCost,
              }}
              components={[
                <span key="0" />,
                <strong key="1" />,
                <span key="2" />,
                <strong key="3" />,
              ]}
            />
          }
          confirmLabel={t('cards.catalog.priceConfirm')}
          onConfirm={(reason) => {
            const next = Number(newPrice);
            if (!Number.isFinite(next) || next < 0) return;
            void mutations.setCardPrice(priceChange, Math.round(next), reason);
            toast({
              title: t('cards.catalog.priceUpdated'),
              description: t('cards.catalog.priceUpdatedBody', {
                name: priceChange.name,
                from: priceChange.cloverCost,
                to: Math.round(next),
              }),
              tone: 'success',
            });
          }}
        >
          <div>
            <Label htmlFor="new-price" required>
              {t('cards.catalog.newCost')}
            </Label>
            <Input
              id="new-price"
              type="number"
              min={0}
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              className="tnum mt-1"
            />
            <p className="mt-1 text-caption text-neutral-500">{t('cards.catalog.newCostHelp')}</p>
          </div>
        </ConfirmDialog>
      )}

      <p className="mt-6 text-caption text-neutral-500">
        {t('cards.catalog.cdnNote')}{' '}
        <button
          type="button"
          onClick={() => navigate('/cards/analytics')}
          className="rounded-sm text-brand-500 hover:underline"
        >
          {t('cards.catalog.seePerformance')}
        </button>
        .
      </p>
    </>
  );
}
