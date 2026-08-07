import * as React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Copy, Download, ExternalLink, MoreHorizontal, Receipt } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { FilterBar } from '@/components/common/FilterBar';
import { DateRangePicker } from '@/components/common/DateRangePicker';
import { StatusBadge, Chip } from '@/components/common/StatusBadge';
import { MoneyValue } from '@/components/common/MoneyValue';
import { Button } from '@/components/ui/button';
import { Avatar, ProgressBar } from '@/components/ui/misc';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useEvents } from '@/hooks/data';
import { eventColumns } from '@/lib/datasets';
import { ExportButton } from '@/components/common/ExportButton';
import { rangeLabel } from '@/lib/date-ranges';
import { useUrlState } from '@/hooks/useUrlState';
import { downloadDataset } from '@/lib/export';
import { daysUntil, formatDate, formatRelative } from '@/lib/format';
import type { RegalEvent } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Screen 03 — Events List (§03). */
export default function EventsList() {
  const { all } = useUrlState();
  const { toast } = useToast();
  const { rows: events, isLoading, error, refetch } = useEvents(all);

  const filtered = React.useMemo(() => {
    return events.filter((e) => {
      if (all.status && all.status !== 'all' && e.status !== all.status) return false;
      if (all.occasion && all.occasion !== 'all' && e.occasion !== all.occasion) return false;
      if (all.source && all.source !== 'all' && e.source !== all.source) return false;
      if (all.currency && all.currency !== 'all' && e.currency !== all.currency) return false;
      if (all.card === 'yes' && !e.cardSlug) return false;
      if (all.card === 'no' && e.cardSlug) return false;
      if (all.progress && all.progress !== 'all') {
        const pct = (e.raisedAmount / e.goalAmount) * 100;
        const ranges: Record<string, [number, number]> = {
          '0-25': [0, 25],
          '25-50': [25, 50],
          '50-75': [50, 75],
          '75-99': [75, 99.999],
          '100': [100, Infinity],
        };
        const [lo, hi] = ranges[all.progress] ?? [0, Infinity];
        if (pct < lo || pct >= hi) return false;
      }
      if (all.q) {
        const q = all.q.toLowerCase();
        const hay = `${e.name} ${e.organizer.name} ${e.beneficiaryName} ${e.id} ${e.shareSlug}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [all, events]);

  const columns: Column<RegalEvent>[] = [
    {
      id: 'event',
      header: 'Event',
      width: '260px',
      sortable: true,
      sortValue: (e) => e.name,
      cell: (e) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-neutral-900">{e.name}</span>
            <Chip>{e.occasion}</Chip>
          </div>
          <p className="truncate text-caption text-neutral-500">{e.organizer.name}</p>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (e) => e.status,
      cell: (e) => <StatusBadge status={e.status} />,
    },
    {
      id: 'organizer',
      header: 'Organizer',
      cell: (e) => (
        <Link
          to={`/users/${e.organizer.id}`}
          data-no-row-click
          onClick={(ev) => ev.stopPropagation()}
          className="flex items-center gap-2 rounded-sm transition-colors hover:text-brand-500"
        >
          <Avatar name={e.organizer.name} color={e.organizer.avatarColor} size="sm" />
          <span className="truncate">{e.organizer.name}</span>
        </Link>
      ),
    },
    {
      id: 'beneficiary',
      header: 'Beneficiary',
      cell: (e) => (
        <div className="flex items-center gap-2">
          <span className="truncate">{e.beneficiaryName}</span>
          {e.beneficiaryType === 'self' && <Chip tone="brand">self</Chip>}
        </div>
      ),
    },
    {
      id: 'goal',
      header: 'Goal',
      numeric: true,
      sortable: true,
      sortValue: (e) => e.goalAmount,
      cell: (e) => <MoneyValue amount={e.goalAmount} currency={e.currency} showCurrency={false} />,
    },
    {
      id: 'raised',
      header: 'Raised',
      numeric: true,
      sortable: true,
      sortValue: (e) => e.raisedAmount,
      cell: (e) => <MoneyValue amount={e.raisedAmount} currency={e.currency} showCurrency={false} />,
    },
    {
      id: 'progress',
      header: 'Progress',
      width: '140px',
      sortable: true,
      sortValue: (e) => e.raisedAmount / e.goalAmount,
      cell: (e) => {
        const pct = (e.raisedAmount / e.goalAmount) * 100;
        const daysLeft = daysUntil(e.endDate);
        // Bar turns amber when <50% with <48h remaining (§03)
        const urgent = pct < 50 && daysLeft > 0 && daysLeft < 2 && e.status === 'active';
        return (
          <div className="w-[124px]">
            <div className="flex items-center gap-2">
              <ProgressBar
                value={pct}
                tone={pct >= 100 ? 'success' : urgent ? 'warning' : 'brand'}
                label={`${e.name} goal progress`}
              />
              {pct >= 100 && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success-500" aria-hidden />}
            </div>
            <span className="tnum mt-1 block text-caption text-neutral-500">{pct.toFixed(0)}%</span>
          </div>
        );
      },
    },
    {
      id: 'contributors',
      header: 'Contributors',
      numeric: true,
      sortable: true,
      sortValue: (e) => e.contributorsCount,
      cell: (e) => (
        <span className="tnum">
          {e.contributorsCount} / {e.totalMembers}
        </span>
      ),
    },
    {
      id: 'created',
      header: 'Created',
      sortable: true,
      sortValue: (e) => e.createdAt,
      cell: (e) => (
        <div>
          <span className="tnum block whitespace-nowrap">{formatDate(e.createdAt)}</span>
          <span className="block text-caption text-neutral-400">{formatRelative(e.createdAt)}</span>
        </div>
      ),
    },
    {
      id: 'ends',
      header: 'Ends',
      sortable: true,
      sortValue: (e) => e.endDate,
      cell: (e) => {
        const left = daysUntil(e.endDate);
        const overdue = left < 0 && e.status === 'active';
        return (
          <div>
            <span className="tnum block whitespace-nowrap">{formatDate(e.endDate)}</span>
            <span className={cn('block text-caption', overdue ? 'text-danger-500' : 'text-neutral-400')}>
              {formatRelative(e.endDate)}
            </span>
          </div>
        );
      },
    },
    {
      id: 'card',
      header: 'Card',
      cell: (e) =>
        e.cardSlug ? (
          <span
            className="flex h-8 w-6 items-center justify-center rounded-sm bg-brand-100 text-[12px]"
            title={e.cardSlug}
          >
            🎁
          </span>
        ) : (
          <span className="text-neutral-400">—</span>
        ),
    },
    {
      id: 'actions',
      header: '',
      width: '48px',
      cell: (e) => (
        <div data-no-row-click onClick={(ev) => ev.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="rounded-sm p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
              aria-label={`Actions for ${e.name}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to={`/events/${e.id}`}>
                  <ExternalLink className="h-4 w-4 text-neutral-400" />
                  View event
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={`/contributions?event=${e.id}`}>
                  <Receipt className="h-4 w-4 text-neutral-400" />
                  Open contributions
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  const file = downloadDataset('event', eventColumns, [e], 'csv');
                  toast({ title: 'Download started', description: file, tone: 'success' });
                }}
              >
                <Download className="h-4 w-4 text-neutral-400" />
                Export this event
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  void navigator.clipboard?.writeText(e.id);
                  toast({ title: 'Event ID copied', description: e.id, tone: 'success' });
                }}
              >
                <Copy className="h-4 w-4 text-neutral-400" />
                Copy ID
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Events"
        subtitle={`${filtered.length.toLocaleString()} of ${events.length.toLocaleString()} events match the current filters.`}
        actions={
          <>
            <DateRangePicker />
            <ExportButton
              name="events"
              label="Events"
              columns={eventColumns}
              rows={filtered}
              filterSummary={`${rangeLabel(all.range ?? '30d')} · ${filtered.length} of ${events.length} events`}
            />
          </>
        }
      />

      <FilterBar
        className="mb-4"
        searchPlaceholder="Search name, organizer, ID, slug…"
        filters={[
          {
            id: 'status',
            label: 'Status',
            options: [
              { value: 'active', label: 'Active' },
              { value: 'published', label: 'Published' },
              { value: 'goal_reached', label: 'Goal reached' },
              { value: 'completed', label: 'Completed' },
              { value: 'delivered', label: 'Delivered' },
              { value: 'paused', label: 'Paused' },
              { value: 'draft', label: 'Draft' },
              { value: 'cancelled', label: 'Cancelled' },
            ],
          },
          {
            id: 'occasion',
            label: 'Occasion',
            options: [
              'birthday', 'wedding', 'farewell', 'graduation', 'baby', 'thanks', 'holiday', 'general',
            ].map((o) => ({ value: o, label: o[0].toUpperCase() + o.slice(1) })),
          },
          {
            id: 'source',
            label: 'Source',
            options: [
              { value: 'personal', label: 'Personal' },
              { value: 'group', label: 'Group' },
            ],
          },
          {
            id: 'progress',
            label: 'Progress',
            options: [
              { value: '0-25', label: '0–25%' },
              { value: '25-50', label: '25–50%' },
              { value: '50-75', label: '50–75%' },
              { value: '75-99', label: '75–99%' },
              { value: '100', label: '100%+' },
            ],
          },
          {
            id: 'currency',
            label: 'Currency',
            options: [{ value: 'MXN', label: 'MXN' }],
          },
          {
            id: 'card',
            label: 'Has card',
            options: [
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ],
          },
        ]}
      />

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(e) => e.id}
        loading={isLoading}
        error={error}
        onRetry={refetch}
        rowHref={(e) => `/events/${e.id}`}
        storageKey="events"
        initialSort={{ id: 'created', dir: 'desc' }}
        empty={{
          headline: 'No events match these filters',
          description:
            'Try widening the date range, clearing the status filter, or searching by organizer name.',
        }}
        bulkActions={(selected, clear) => (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const file = downloadDataset('events-selection', eventColumns, selected, 'csv');
              toast({
                title: 'Download started',
                description: `${file} · ${selected.length} events`,
                tone: 'success',
              });
              clear();
            }}
          >
            <Download className="h-4 w-4 text-neutral-400" />
            Export CSV
          </Button>
        )}
      />
    </>
  );
}
