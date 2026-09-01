import { useTranslation } from 'react-i18next';
import * as React from 'react';
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { StatusBadge } from '@/components/common/StatusBadge';
import { CategoryDialog } from './CategoryDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { useCardCategories } from '@/hooks/data';
import { categoriesService } from '@/lib/api/services';
import { ApiError } from '@/lib/api/client';
import { formatNumber } from '@/lib/format';
import type { CardCategoryRow } from '@/lib/api/types';
import { cn } from '@/lib/utils';

/**
 * Screen 09b — Category manager (§09).
 *
 * The catalog screen next door manages the designs; this one manages the
 * vocabulary they are filed under — the occasions the mobile app groups events
 * and cards by. Names, Spanish names, colours, emoji and artwork are all
 * editable here, which is what makes "rename a category" or "give it a new
 * image" an admin action rather than a release of three codebases.
 *
 * Two behaviours come straight from the API and are surfaced rather than
 * hidden:
 *  · A category still carried by designs or events cannot be deleted —
 *    deactivating is how one is retired, and the designs already tagged with it
 *    stay in the catalog.
 *  · Categories built into the mobile app (`isSystem`) can be edited and
 *    deactivated but never deleted, because the app references the key.
 */
export default function CardCategories() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { can } = useAuth();
  const { rows: categories, isLoading, error, refetch } = useCardCategories();

  const [search, setSearch] = React.useState('');
  const [state, setState] = React.useState<'all' | 'active' | 'inactive'>('all');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CardCategoryRow | null>(null);
  const [deleting, setDeleting] = React.useState<CardCategoryRow | null>(null);
  const [deactivating, setDeactivating] = React.useState<CardCategoryRow | null>(null);

  const [reordering, setReordering] = React.useState(false);
  const [order, setOrder] = React.useState<string[]>([]);
  const [dirty, setDirty] = React.useState(false);
  const [savingOrder, setSavingOrder] = React.useState(false);

  // Keep the local ordering in step as categories are added or removed. The
  // same array is returned when nothing moved, so this can't loop on itself.
  React.useEffect(() => {
    setOrder((prev) => {
      const ids = categories.map((c) => c.id);
      const kept = prev.filter((id) => ids.includes(id));
      const added = ids.filter((id) => !kept.includes(id));
      if (!added.length && kept.length === prev.length) return prev;
      return [...kept, ...added];
    });
  }, [categories]);

  const writable = can('cards:write');

  const ordered = React.useMemo(
    () => [...categories].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)),
    [categories, order],
  );

  const filtered = React.useMemo(
    () =>
      ordered.filter((c) => {
        if (state === 'active' && !c.isActive) return false;
        if (state === 'inactive' && c.isActive) return false;
        if (search) {
          const haystack = `${c.name} ${c.nameEs ?? ''} ${c.key}`.toLowerCase();
          if (!haystack.includes(search.toLowerCase())) return false;
        }
        return true;
      }),
    [ordered, state, search],
  );

  const move = (id: string, dir: -1 | 1) => {
    setOrder((prev) => {
      const idx = prev.indexOf(id);
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target]!, next[idx]!];
      return next;
    });
    setDirty(true);
  };

  const saveOrder = async () => {
    setSavingOrder(true);
    try {
      await categoriesService.reorder(order);
      setDirty(false);
      setReordering(false);
      refetch();
      toast({ title: t('cards.categories.orderSaved'), tone: 'success' });
    } catch (err) {
      toast({
        title: t('cards.categories.orderFailed'),
        description: (err as ApiError).message,
        tone: 'danger',
      });
    } finally {
      setSavingOrder(false);
    }
  };

  const setActive = async (category: CardCategoryRow, isActive: boolean, reason?: string) => {
    try {
      if (isActive) {
        await categoriesService.activate(category.id, reason);
        refetch();
        toast({
          title: t('cards.categories.activated', { name: category.name }),
          tone: 'success',
        });
        return;
      }
      const res = await categoriesService.deactivate(category.id, reason);
      refetch();
      toast({
        title: t('cards.categories.deactivated', { name: category.name }),
        // The API says outright whether designs keep the category once it is
        // hidden from the pickers, so the admin doesn't have to guess.
        description: res.data.retainedByExistingDesigns
          ? t('cards.categories.retained', { designs: category.designs })
          : undefined,
        tone: 'success',
      });
    } catch (err) {
      toast({
        title: t('cards.categories.stateFailed'),
        description: (err as ApiError).message,
        tone: 'danger',
      });
    }
  };

  const remove = async (category: CardCategoryRow, reason: string) => {
    try {
      await categoriesService.remove(category.id, reason);
      refetch();
      toast({ title: t('cards.categories.deleted', { name: category.name }), tone: 'success' });
    } catch (err) {
      toast({
        title: t('cards.categories.deleteFailed'),
        description: (err as ApiError).message,
        tone: 'danger',
      });
    }
  };

  const columns: Column<CardCategoryRow>[] = [
    ...(reordering
      ? [
          {
            id: 'reorder',
            header: t('cards.categories.table.order'),
            width: '96px',
            cell: (c: CardCategoryRow) => (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t('cards.categories.moveUp', { name: c.name })}
                  disabled={order.indexOf(c.id) === 0}
                  onClick={() => move(c.id, -1)}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t('cards.categories.moveDown', { name: c.name })}
                  disabled={order.indexOf(c.id) === order.length - 1}
                  onClick={() => move(c.id, 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
            ),
          } satisfies Column<CardCategoryRow>,
        ]
      : []),
    {
      id: 'category',
      header: t('cards.categories.table.category'),
      width: '260px',
      sortable: !reordering,
      sortValue: (c) => c.name,
      cell: (c) => (
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-sm text-[18px]',
              !c.isActive && 'opacity-50',
            )}
            style={{ backgroundColor: c.color }}
            aria-hidden
          >
            {c.images.icon ? (
              <img src={c.images.icon} alt="" className="h-full w-full object-contain" />
            ) : (
              (c.emoji ?? '🎁')
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-neutral-900">{c.name}</p>
            {c.nameEs && <p className="truncate text-caption text-neutral-500">{c.nameEs}</p>}
          </div>
        </div>
      ),
    },
    {
      id: 'key',
      header: t('cards.categories.table.key'),
      cell: (c) => <span className="font-mono text-caption text-neutral-500">{c.key}</span>,
    },
    {
      id: 'designs',
      header: t('cards.categories.table.designs'),
      numeric: true,
      sortable: !reordering,
      sortValue: (c) => c.designs,
      cell: (c) => <span className="tnum">{formatNumber(c.designs)}</span>,
    },
    {
      id: 'events',
      header: t('cards.categories.table.events'),
      numeric: true,
      sortable: !reordering,
      sortValue: (c) => c.events,
      cell: (c) => <span className="tnum">{formatNumber(c.events)}</span>,
    },
    {
      id: 'artwork',
      header: t('cards.categories.table.artwork'),
      cell: (c) => (
        <span className="text-caption text-neutral-500">
          {c.images.icon ? t('cards.categories.hasArtwork') : t('cards.categories.noArtwork')}
        </span>
      ),
    },
    {
      id: 'state',
      header: t('cards.categories.table.state'),
      cell: (c) => (
        <StatusBadge
          status={c.isActive ? 'active' : 'inactive'}
          label={c.isActive ? t('status.active') : t('status.inactive')}
        />
      ),
    },
    ...(writable
      ? [
          {
            id: 'actions',
            header: '',
            width: '56px',
            cell: (c: CardCategoryRow) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t('cards.categories.rowActions', { name: c.name })}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => {
                      setEditing(c);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    {t('cards.categories.edit')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      if (c.isActive) setDeactivating(c);
                      else void setActive(c, true);
                    }}
                  >
                    {c.isActive
                      ? t('cards.categories.deactivate')
                      : t('cards.categories.activate')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={!c.canDelete}
                    onSelect={() => c.canDelete && setDeleting(c)}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('cards.categories.delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          } satisfies Column<CardCategoryRow>,
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: t('nav.giftCards') }, { label: t('cards.categories.breadcrumb') }]}
        title={t('cards.categories.title')}
        subtitle={t('cards.categories.subtitle')}
        actions={
          writable && (
            <>
              {reordering && dirty && (
                <Button variant="secondary" disabled={savingOrder} onClick={() => void saveOrder()}>
                  {t('cards.categories.saveOrder')}
                </Button>
              )}
              <Button
                variant="secondary"
                aria-pressed={reordering}
                onClick={() => {
                  setReordering((v) => !v);
                  setDirty(false);
                }}
              >
                <GripVertical className="h-4 w-4 text-neutral-400" />
                {reordering ? t('cards.categories.exitReorder') : t('cards.categories.reorder')}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                {t('cards.categories.newCategory')}
              </Button>
            </>
          )
        }
      />

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:min-w-[200px] sm:max-w-[260px]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('cards.categories.searchPlaceholder')}
            className="pl-9"
            aria-label={t('cards.categories.searchLabel')}
          />
        </div>
        <Select value={state} onValueChange={(v) => setState(v as typeof state)}>
          <SelectTrigger
            className="w-full sm:w-auto sm:min-w-[140px]"
            aria-label={t('cards.categories.stateFilter')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('cards.categories.allStates')}</SelectItem>
            <SelectItem value="active">{t('status.active')}</SelectItem>
            <SelectItem value="inactive">{t('status.inactive')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {reordering && (
        <p className="mb-3 text-caption text-neutral-500">{t('cards.categories.reorderHint')}</p>
      )}

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(c) => c.id}
        loading={isLoading}
        error={error}
        onRetry={refetch}
        // Unpaginated: the API returns the whole vocabulary because it is
        // reordered by hand, and a page break would split a move.
        pageSize={200}
        storageKey="card-categories"
        empty={{
          headline: t('cards.categories.emptyHeadline'),
          description: t('cards.categories.emptyDescription'),
          ...(writable
            ? {
                action: {
                  label: t('cards.categories.newCategory'),
                  onClick: () => {
                    setEditing(null);
                    setDialogOpen(true);
                  },
                },
              }
            : {}),
        }}
      />

      <CategoryDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />

      <ConfirmDialog
        open={Boolean(deactivating)}
        onOpenChange={(o) => !o && setDeactivating(null)}
        title={t('cards.categories.deactivateTitle', { name: deactivating?.name ?? '' })}
        consequence={t('cards.categories.deactivateConsequence', {
          designs: deactivating?.designs ?? 0,
          events: deactivating?.events ?? 0,
        })}
        confirmLabel={t('cards.categories.deactivate')}
        tone="primary"
        requireReason
        onConfirm={(reason) => {
          const target = deactivating;
          setDeactivating(null);
          if (target) void setActive(target, false, reason);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t('cards.categories.deleteTitle', { name: deleting?.name ?? '' })}
        consequence={t('cards.categories.deleteConsequence')}
        confirmLabel={t('cards.categories.delete')}
        requireTypedConfirmation={deleting?.name}
        requireReason
        onConfirm={(reason) => {
          const target = deleting;
          setDeleting(null);
          if (target) void remove(target, reason);
        }}
      />
    </>
  );
}
