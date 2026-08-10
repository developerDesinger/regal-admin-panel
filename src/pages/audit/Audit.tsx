import { Trans, useTranslation } from 'react-i18next';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Lock } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { FilterBar } from '@/components/common/FilterBar';
import { DateRangePicker } from '@/components/common/DateRangePicker';
import { Card } from '@/components/ui/card';
import { Avatar, CopyableId } from '@/components/ui/misc';
import { Tooltip } from '@/components/ui/tooltip';
import { useAuditTrail, useAuditFacets } from '@/hooks/data';
import { auditColumns } from '@/lib/datasets';
import { ExportButton } from '@/components/common/ExportButton';
import { rangeLabel } from '@/lib/date-ranges';
import { useUrlState } from '@/hooks/useUrlState';
import { formatDateTime, formatRelative } from '@/lib/format';
import type { AuditEntry } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Screen 14 — Audit Trail (§14).
 * Entries are append-only and immutable: no edit, no delete, in the UI or the
 * API. Retained 24 months minimum.
 */
export default function Audit() {
  const { t } = useTranslation();
  const { all } = useUrlState();
  const [expanded, setExpanded] = React.useState<string | null>(null);
  // Distinct admins actually present in the trail, for the filter dropdown.
  const { admins: adminUsers } = useAuditFacets();
  const { rows: auditEntries, isLoading, error, refetch } = useAuditTrail(all);

  const filtered = React.useMemo(
    () =>
      auditEntries.filter((e) => {
        if (all.admin && all.admin !== 'all' && e.admin.id !== all.admin) return false;
        if (all.action && all.action !== 'all' && e.action !== all.action) return false;
        if (all.resource && all.resource !== 'all' && e.resourceType !== all.resource) return false;
        if (all.q) {
          const q = all.q.toLowerCase();
          if (!`${e.action} ${e.admin.name} ${e.resource.label} ${e.id} ${e.ip}`.toLowerCase().includes(q))
            return false;
        }
        return true;
      }),
    [all, auditEntries],
  );

  const actionTypes = [...new Set(auditEntries.map((e) => e.action))].sort();
  const resourceTypes = [...new Set(auditEntries.map((e) => e.resourceType))].sort();

  const columns: Column<AuditEntry>[] = [
    {
      id: 'timestamp',
      header: t('audit.timestamp'),
      width: '190px',
      sortable: true,
      sortValue: (e) => e.timestamp,
      cell: (e) => (
        <div>
          <span className="tnum block whitespace-nowrap text-body text-neutral-900">
            {formatDateTime(e.timestamp)}
          </span>
          <span className="block text-caption text-neutral-400">{formatRelative(e.timestamp)}</span>
        </div>
      ),
    },
    {
      id: 'admin',
      header: t('audit.admin'),
      sortable: true,
      sortValue: (e) => e.admin.name,
      cell: (e) => (
        <div className="flex min-w-0 items-center gap-2">
          <Avatar name={e.admin.name} color={e.admin.avatarColor} size="sm" />
          <span className="truncate">{e.admin.name}</span>
        </div>
      ),
    },
    {
      id: 'action',
      header: t('audit.action'),
      sortable: true,
      sortValue: (e) => e.action,
      cell: (e) => <code className="font-mono text-[13px] text-neutral-900">{e.action}</code>,
    },
    { id: 'resourceType', header: t('audit.resourceType'), cell: (e) => e.resourceType },
    {
      id: 'resource',
      header: t('audit.resource'),
      cell: (e) => (
        <Link
          to={e.resource.href}
          data-no-row-click
          onClick={(ev) => ev.stopPropagation()}
          className="truncate rounded-sm text-brand-500 transition-colors hover:underline"
        >
          {e.resource.label}
        </Link>
      ),
    },
    {
      id: 'diff',
      header: t('audit.diff'),
      width: '220px',
      cell: (e) =>
        e.before && e.after ? (
          <button
            type="button"
            data-no-row-click
            onClick={(ev) => {
              ev.stopPropagation();
              setExpanded(expanded === e.id ? null : e.id);
            }}
            aria-expanded={expanded === e.id}
            className="inline-flex items-center gap-1 rounded-sm text-caption font-medium text-brand-500 hover:underline"
          >
            <ChevronRight
              className={cn('h-3 w-3 transition-transform duration-micro', expanded === e.id && 'rotate-90')}
              aria-hidden
            />
            {t('audit.viewDiff')}
          </button>
        ) : (
          <span className="text-neutral-400">—</span>
        ),
    },
    {
      id: 'reason',
      header: t('audit.reason'),
      cell: (e) => <span className="text-neutral-500">{e.reason}</span>,
    },
    {
      id: 'ip',
      header: t('audit.ipAddress'),
      defaultHidden: true,
      cell: (e) => <CopyableId value={e.ip} label={t('audit.ipAddress')} />,
    },
    {
      id: 'userAgent',
      header: t('audit.userAgent'),
      defaultHidden: true,
      cell: (e) => (
        <Tooltip content={e.userAgent}>
          <span className="block max-w-[160px] cursor-help truncate text-caption text-neutral-500">
            {e.userAgent}
          </span>
        </Tooltip>
      ),
    },
  ];

  const expandedEntry = auditEntries.find((e) => e.id === expanded);

  return (
    <>
      <PageHeader
        title={t('audit.title')}
        subtitle={t('audit.subtitle')}
        actions={
          <>
            <DateRangePicker />
            <ExportButton
              name="audit-log"
              label={t('audit.exportLabel')}
              columns={auditColumns}
              rows={filtered}
              filterSummary={t('audit.filterSummary', {
                range: t(rangeLabel(all.range ?? '30d')),
                shown: filtered.length,
                total: auditEntries.length,
              })}
            />
          </>
        }
      />

      <div className="mb-4 flex items-start gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
        <Lock className="mt-px h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
        <p className="text-caption text-neutral-500">
          <Trans
            i18nKey="audit.immutableNote"
            components={[<span key="0" />, <strong key="1" />]}
          />
        </p>
      </div>

      <FilterBar
        className="mb-4"
        searchPlaceholder={t('audit.searchPlaceholder')}
        filters={[
          {
            id: 'admin',
            label: t('audit.admin'),
            options: adminUsers.map((a) => ({ value: a.id, label: a.name })),
          },
          {
            id: 'action',
            label: t('audit.action'),
            options: actionTypes.map((a) => ({ value: a, label: a })),
          },
          {
            id: 'resource',
            label: t('audit.resource'),
            options: resourceTypes.map((r) => ({ value: r, label: r })),
          },
        ]}
      />

      {expandedEntry && (
        <Card className="mb-4 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-card-title text-neutral-700">
                <code className="font-mono">{expandedEntry.action}</code> —{' '}
                {expandedEntry.resource.label}
              </h2>
              <p className="mt-1 text-caption text-neutral-500">
                {expandedEntry.admin.name} · {formatDateTime(expandedEntry.timestamp)} ·{' '}
                {expandedEntry.ip}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(null)}
              className="rounded-sm text-caption font-medium text-brand-500 hover:underline"
            >
              {t('common.close')}
            </button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="mb-1 text-caption font-medium text-danger-500">{t('audit.before')}</p>
              <pre className="overflow-x-auto rounded-md border border-danger-500/20 bg-danger-50 p-3 font-mono text-[13px] leading-5 text-neutral-700">
                {JSON.stringify(expandedEntry.before, null, 2)}
              </pre>
            </div>
            <div>
              <p className="mb-1 text-caption font-medium text-success-500">{t('audit.after')}</p>
              <pre className="overflow-x-auto rounded-md border border-success-500/20 bg-success-50 p-3 font-mono text-[13px] leading-5 text-neutral-700">
                {JSON.stringify(expandedEntry.after, null, 2)}
              </pre>
            </div>
          </div>
        </Card>
      )}

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(e) => e.id}
        loading={isLoading}
        error={error}
        onRetry={refetch}
        storageKey="audit"
        initialSort={{ id: 'timestamp', dir: 'desc' }}
        pageSize={30}
        empty={{
          headline: t('audit.empty'),
          description: t('audit.emptyBody'),
        }}
      />
    </>
  );
}
