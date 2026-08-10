import { Trans, useTranslation } from 'react-i18next';
import * as React from 'react';
import { Download, FileJson, FileSpreadsheet, Loader2, Lock, Plus, RefreshCw } from 'lucide-react';
import { PageHeader, SectionHeading } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusBadge, Chip } from '@/components/common/StatusBadge';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem, ProgressBar } from '@/components/ui/misc';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DateRangePicker } from '@/components/common/DateRangePicker';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useExportJobs } from '@/hooks/data';
import { exportsService } from '@/lib/api/services';
import { API_BASE_URL, ApiError } from '@/lib/api/client';
import { useUrlState } from '@/hooks/useUrlState';
import type { ExportColumn } from '@/lib/export';
import {
  auditColumns,
  cardColumns,
  cloverColumns,
  contributionColumns,
  eventColumns,
  userColumns,
  withdrawalColumns,
  PII_COLUMNS,
} from '@/lib/datasets';
import { formatDateTime, formatNumber, formatRelative } from '@/lib/format';
import type { ExportJobRow } from '@/lib/api/types';

/** Screen 13 — Exports (§13). */

interface DatasetDef {
  id: string;
  /** Key under `exports.dataset.*` — resolved at render, not at module load. */
  labelKey: string;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  columns: ExportColumn<any>[];
}

const DATASETS: DatasetDef[] = [
  { id: 'events', labelKey: 'exports.dataset.events', columns: eventColumns },
  { id: 'contributions', labelKey: 'exports.dataset.contributions', columns: contributionColumns },
  { id: 'users', labelKey: 'exports.dataset.users', columns: userColumns },
  { id: 'cards', labelKey: 'exports.dataset.cards', columns: cardColumns },
  { id: 'clover_ledger', labelKey: 'exports.dataset.clover_ledger', columns: cloverColumns },
  { id: 'withdrawals', labelKey: 'exports.dataset.withdrawals', columns: withdrawalColumns },
  { id: 'audit_log', labelKey: 'exports.dataset.audit_log', columns: auditColumns },
];

export default function Exports() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { can } = useAuth();
  const { jobs, refetch } = useExportJobs();
  const { get } = useUrlState();

  const [dataset, setDataset] = React.useState<DatasetDef>(DATASETS[0]);
  const [format, setFormat] = React.useState<'csv' | 'json'>('csv');
  const [selectedColumns, setSelectedColumns] = React.useState<string[]>(
    DATASETS[0].columns.map((c) => c.key),
  );
  const [confirmPii, setConfirmPii] = React.useState(false);
  const [downloading, setDownloading] = React.useState<string | null>(null);

  React.useEffect(() => {
    setSelectedColumns(dataset.columns.map((c) => c.key));
  }, [dataset]);

  const piiColumns = selectedColumns.filter((c) => PII_COLUMNS.has(c));

  /** Server-generated, single-use link — a second call is 410. */
  const download = async (job: ExportJobRow) => {
    setDownloading(job.id);
    try {
      const { blob, filename } = await exportsService.download(job.id, API_BASE_URL);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ title: t('common.downloadStarted'), description: filename, tone: 'success' });
      void refetch();
    } catch (err) {
      toast({
        title: t('exports.downloadFailed'),
        description: (err as Error).message,
        tone: 'danger',
      });
    } finally {
      setDownloading(null);
    }
  };

  /** 202 + a queued job; useExportJobs polls until it settles. */
  const runExport = (reason = '') => {
    exportsService
      .create({
        dataset: dataset.id,
        format,
        columns: selectedColumns,
        filters: { range: get('range', '30d') },
        reason: reason || t('exports.defaultReason', { dataset: t(dataset.labelKey) }),
      })
      .then((job) => {
        toast({
          title: t('exports.queued'),
          description: `${job.dataset} · ${job.format.toUpperCase()}`,
          tone: 'info',
        });
        void refetch();
      })
      .catch((err: ApiError) =>
        toast({ title: t('exports.queueFailed'), description: err.message, tone: 'danger' }),
      );
  };

  const generate = () => {
    if (piiColumns.length > 0) {
      setConfirmPii(true);
      return;
    }
    runExport();
  };

  const columns: Column<ExportJobRow>[] = [
    {
      id: 'dataset',
      header: t('exports.table.dataset'),
      width: '260px',
      sortable: true,
      sortValue: (j) => j.dataset,
      cell: (j) => (
        <div className="flex min-w-0 items-center gap-2">
          {j.format === 'csv' ? (
            <FileSpreadsheet className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
          ) : (
            <FileJson className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="truncate font-medium text-neutral-900">{j.dataset}</p>
            <p className="truncate text-caption text-neutral-500">{j.filters}</p>
          </div>
          {j.containsPii && <Chip tone="brand">PII</Chip>}
        </div>
      ),
    },
    { id: 'format', header: t('exports.table.format'), cell: (j) => <Chip>{j.format.toUpperCase()}</Chip> },
    {
      id: 'rows',
      header: t('exports.table.rows'),
      numeric: true,
      sortable: true,
      sortValue: (j) => j.rows ?? 0,
      cell: (j) =>
        j.rows != null ? (
          <span className="tnum">{formatNumber(j.rows)}</span>
        ) : (
          <span className="text-neutral-400">—</span>
        ),
    },
    {
      id: 'status',
      header: t('fields.status'),
      sortable: true,
      sortValue: (j) => j.status,
      cell: (j) => (
        <div className="min-w-[130px]">
          <StatusBadge status={j.status} />
          {(j.status === 'running' || j.status === 'queued') && (
            <ProgressBar
              value={j.progress}
              className="mt-2"
              label={t('exports.table.progressLabel', { dataset: j.dataset })}
            />
          )}
        </div>
      ),
    },
    {
      id: 'requestedBy',
      header: t('exports.table.requestedBy'),
      defaultHidden: true,
      cell: (j) => j.requestedBy,
    },
    {
      id: 'requestedAt',
      header: t('exports.table.requested'),
      sortable: true,
      sortValue: (j) => j.requestedAt,
      cell: (j) => <span className="tnum whitespace-nowrap">{formatDateTime(j.requestedAt)}</span>,
    },
    {
      id: 'expires',
      header: t('exports.table.expires'),
      cell: (j) =>
        j.expiresAt ? (
          <span className={j.status === 'expired' ? 'text-neutral-400' : 'text-neutral-700'}>
            {formatRelative(j.expiresAt)}
          </span>
        ) : (
          <span className="text-neutral-400">—</span>
        ),
    },
    {
      id: 'action',
      header: '',
      width: '150px',
      cell: (j) => (
        <div data-no-row-click>
          {j.status === 'ready' ? (
            <Button
              variant="secondary"
              size="sm"
              loading={downloading === j.id}
              onClick={() => {
                void download(j);
              }}
            >
              <Download className="h-3 w-3 text-neutral-400" />
              {t('common.download')}
            </Button>
          ) : j.status === 'failed' ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                exportsService
                  .retry(j.id)
                  .then(() => {
                    toast({ title: t('exports.table.requeued'), description: j.dataset, tone: 'info' });
                    void refetch();
                  })
                  .catch((err: ApiError) =>
                    toast({
                      title: t('exports.table.retryFailed'),
                      description: err.message,
                      tone: 'danger',
                    }),
                  );
              }}
            >
              <RefreshCw className="h-3 w-3 text-neutral-400" />
              {t('exports.table.retry')}
            </Button>
          ) : j.status === 'expired' ? (
            <span className="text-caption text-neutral-400">{t('exports.table.linkExpired')}</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-caption text-neutral-500">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              {t('exports.table.preparing')}
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('exports.title')}
        subtitle={t('exports.subtitle')}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        {/* New export */}
        <Card className="h-fit">
          <div className="border-b border-neutral-200 p-4">
            <h2 className="text-card-title text-neutral-700">{t('exports.newExport')}</h2>
          </div>
          <div className="space-y-4 p-4">
            <div>
              <Label htmlFor="dataset">{t('exports.datasetLabel')}</Label>
              <Select
                value={dataset.id}
                onValueChange={(v) => setDataset(DATASETS.find((d) => d.id === v) ?? DATASETS[0])}
              >
                <SelectTrigger id="dataset" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATASETS.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {t(d.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-caption text-neutral-500">
                <span className="tnum font-medium text-neutral-700">
                  —
                </span>{' '}
                {t('exports.rowsAvailable')}
              </p>
            </div>

            <div>
              <Label>{t('exports.filters')}</Label>
              <div className="mt-1">
                <DateRangePicker className="w-full justify-start" />
              </div>
              <p className="mt-1 text-caption text-neutral-500">
                {t('exports.filterNote', { dataset: t(dataset.labelKey) })}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>{t('exports.columns')}</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedColumns(dataset.columns.map((c) => c.key))}
                    className="rounded-sm text-caption font-medium text-brand-500 hover:underline"
                  >
                    {t('exports.selectAll')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedColumns([])}
                    className="rounded-sm text-caption font-medium text-brand-500 hover:underline"
                  >
                    {t('exports.selectNone')}
                  </button>
                </div>
              </div>
              <div className="mt-2 max-h-[240px] space-y-2 overflow-y-auto rounded-md border border-neutral-200 p-3">
                {dataset.columns.map((c) => (
                  <label key={c.key} className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={selectedColumns.includes(c.key)}
                      onCheckedChange={(checked) =>
                        setSelectedColumns((prev) =>
                          checked ? [...prev, c.key] : prev.filter((x) => x !== c.key),
                        )
                      }
                    />
                    <span className="min-w-0 flex-1 truncate font-mono text-caption text-neutral-700">
                      {c.key}
                    </span>
                    {PII_COLUMNS.has(c.key) && <Chip tone="brand">PII</Chip>}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-caption text-neutral-500">
                {t('exports.selectedCount', {
                  selected: selectedColumns.length,
                  total: dataset.columns.length,
                })}
              </p>
            </div>

            <div>
              <Label>{t('exports.format')}</Label>
              <RadioGroup
                value={format}
                onValueChange={(v) => setFormat(v as 'csv' | 'json')}
                className="mt-2 flex gap-4"
              >
                <label className="flex cursor-pointer items-center gap-2">
                  <RadioGroupItem value="csv" id="fmt-csv" />
                  <span className="text-body text-neutral-700">CSV</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <RadioGroupItem value="json" id="fmt-json" />
                  <span className="text-body text-neutral-700">JSON</span>
                </label>
              </RadioGroup>
            </div>

            {can('exports:run') ? (
              <Button
                variant="primary"
                className="w-full"
                onClick={generate}
                disabled={selectedColumns.length === 0}
              >
                <Plus className="h-4 w-4" />
                {t('exports.generate')}
              </Button>
            ) : (
              <div className="flex items-start gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                <Lock className="mt-px h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                <p className="text-caption text-neutral-500">
                  <Trans
                    i18nKey="exports.noPermission"
                    components={[<span key="0" />, <code key="1" className="font-mono" />]}
                  />
                </p>
              </div>
            )}

            <p className="text-caption text-neutral-400">{t('common.csvNote')}</p>
          </div>
        </Card>

        {/* Jobs */}
        <div className="min-w-0">
          <SectionHeading description={t('exports.jobsDescription')}>
            {t('exports.jobsHeading')}
          </SectionHeading>
          <DataTable
            columns={columns}
            rows={jobs}
            rowKey={(j) => j.id}
            storageKey="exports"
            initialSort={{ id: 'requestedAt', dir: 'desc' }}
            empty={{
              headline: t('exports.table.empty'),
              description: t('exports.table.emptyBody'),
            }}
          />
        </div>
      </div>

      <ConfirmDialog
        open={confirmPii}
        onOpenChange={setConfirmPii}
        title={t('exports.piiTitle')}
        tone="primary"
        requireReason
        consequence={
          <Trans
            i18nKey="exports.piiConsequence"
            values={{ fields: piiColumns.join(', ') }}
            components={[
              <span key="0" />,
              <strong key="1" className="font-mono" />,
              <span key="2" />,
              <code key="3" className="font-mono" />,
            ]}
          />
        }
        confirmLabel={t('exports.generate')}
        onConfirm={(reason) => runExport(reason)}
      />
    </>
  );
}
