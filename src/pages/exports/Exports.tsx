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
import { rangeLabel } from '@/lib/date-ranges';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { actions, useStore, type AppState } from '@/lib/store';
import { useUrlState } from '@/hooks/useUrlState';
import { downloadDataset, type ExportColumn } from '@/lib/export';
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
import type { ExportJob } from '@/lib/types';

/** Screen 13 — Exports (§13). */

interface DatasetDef {
  id: string;
  label: string;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  columns: ExportColumn<any>[];
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  rows: (s: AppState) => any[];
}

const DATASETS: DatasetDef[] = [
  { id: 'events', label: 'Events', columns: eventColumns, rows: (s) => s.events },
  { id: 'contributions', label: 'Contributions', columns: contributionColumns, rows: (s) => s.contributions },
  { id: 'users', label: 'Users', columns: userColumns, rows: (s) => s.users },
  { id: 'cards', label: 'Cards', columns: cardColumns, rows: (s) => s.giftCards },
  { id: 'clover_ledger', label: 'Clover ledger', columns: cloverColumns, rows: (s) => s.cloverLedger },
  { id: 'withdrawals', label: 'Withdrawals', columns: withdrawalColumns, rows: (s) => s.withdrawals },
  { id: 'audit_log', label: 'Audit log', columns: auditColumns, rows: (s) => s.auditEntries },
];

export default function Exports() {
  const { toast } = useToast();
  const { admin, can } = useAuth();
  const store = useStore();
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

  const rows = dataset.rows(store);
  const piiColumns = selectedColumns.filter((c) => PII_COLUMNS.has(c));
  const filterLabel = `${rangeLabel(get('range', '30d'))} · ${selectedColumns.length} columns`;

  /** Build the file from the columns the admin actually ticked. */
  const buildAndDownload = (job: ExportJob) => {
    const def = DATASETS.find((d) => d.label === job.dataset) ?? dataset;
    const cols = def.columns.filter((c) => selectedColumns.includes(c.key));
    const useCols = cols.length ? cols : def.columns;
    const data = def.rows(store);
    const filename = downloadDataset(def.id, useCols, data, job.format);
    // Keep the job row honest: report what the file actually contains.
    if (job.rows !== data.length) actions.patchExportJob(job.id, { rows: data.length });
    toast({
      title: 'Download started',
      description: `${filename} · ${data.length.toLocaleString()} rows`,
      tone: 'success',
    });
  };

  /** Queue a job and run it through queued → running → ready. */
  const runExport = (reason = '') => {
    const rowCount = rows.length;
    const id = actions.createExportJob(admin, {
      dataset: dataset.label,
      format,
      filters: reason ? `${filterLabel} · ${reason}` : filterLabel,
      rows: null,
      status: 'queued',
      progress: 0,
      requestedBy: admin?.name ?? 'Admin',
      requestedAt: new Date().toISOString(),
      expiresAt: null,
      containsPii: piiColumns.length > 0,
    });

    toast({
      title: 'Export queued',
      description: `${dataset.label} · ${format.toUpperCase()} · ${rowCount.toLocaleString()} rows`,
      tone: 'info',
    });

    let progress = 0;
    const tick = setInterval(() => {
      progress += 25;
      if (progress >= 100) {
        clearInterval(tick);
        actions.patchExportJob(id, {
          status: 'ready',
          progress: 100,
          rows: rowCount,
          expiresAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
        });
        toast({
          title: 'Export ready',
          description: `${dataset.label} · press Download in the jobs table`,
          tone: 'success',
        });
      } else {
        actions.patchExportJob(id, { status: 'running', progress });
      }
    }, 450);
  };

  const generate = () => {
    if (piiColumns.length > 0) {
      setConfirmPii(true);
      return;
    }
    runExport();
  };

  const columns: Column<ExportJob>[] = [
    {
      id: 'dataset',
      header: 'Dataset',
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
    { id: 'format', header: 'Format', cell: (j) => <Chip>{j.format.toUpperCase()}</Chip> },
    {
      id: 'rows',
      header: 'Rows',
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
      header: 'Status',
      sortable: true,
      sortValue: (j) => j.status,
      cell: (j) => (
        <div className="min-w-[130px]">
          <StatusBadge status={j.status} />
          {(j.status === 'running' || j.status === 'queued') && (
            <ProgressBar value={j.progress} className="mt-2" label={`${j.dataset} export progress`} />
          )}
        </div>
      ),
    },
    { id: 'requestedBy', header: 'Requested by', defaultHidden: true, cell: (j) => j.requestedBy },
    {
      id: 'requestedAt',
      header: 'Requested',
      sortable: true,
      sortValue: (j) => j.requestedAt,
      cell: (j) => <span className="tnum whitespace-nowrap">{formatDateTime(j.requestedAt)}</span>,
    },
    {
      id: 'expires',
      header: 'Expires',
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
                setDownloading(j.id);
                buildAndDownload(j);
                setTimeout(() => setDownloading(null), 600);
              }}
            >
              <Download className="h-3 w-3 text-neutral-400" />
              Download
            </Button>
          ) : j.status === 'failed' ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                actions.patchExportJob(j.id, { status: 'running', progress: 40 });
                setTimeout(
                  () =>
                    actions.patchExportJob(j.id, {
                      status: 'ready',
                      progress: 100,
                      rows: store.auditEntries.length,
                      expiresAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
                    }),
                  1200,
                );
                toast({ title: 'Export re-queued', description: j.dataset, tone: 'info' });
              }}
            >
              <RefreshCw className="h-3 w-3 text-neutral-400" />
              Retry
            </Button>
          ) : j.status === 'expired' ? (
            <span className="text-caption text-neutral-400">Link expired</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-caption text-neutral-500">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              Preparing
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Exports"
        subtitle="Large exports run asynchronously. Download links are single-use and expire after 24 hours."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        {/* New export */}
        <Card className="h-fit">
          <div className="border-b border-neutral-200 p-4">
            <h2 className="text-card-title text-neutral-700">New export</h2>
          </div>
          <div className="space-y-4 p-4">
            <div>
              <Label htmlFor="dataset">Dataset</Label>
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
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-caption text-neutral-500">
                <span className="tnum font-medium text-neutral-700">
                  {rows.length.toLocaleString()}
                </span>{' '}
                rows available
              </p>
            </div>

            <div>
              <Label>Filters</Label>
              <div className="mt-1">
                <DateRangePicker className="w-full justify-start" />
              </div>
              <p className="mt-1 text-caption text-neutral-500">
                The same filter UI as the {dataset.label} list screen applies here.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Columns</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedColumns(dataset.columns.map((c) => c.key))}
                    className="rounded-sm text-caption font-medium text-brand-500 hover:underline"
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedColumns([])}
                    className="rounded-sm text-caption font-medium text-brand-500 hover:underline"
                  >
                    None
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
                {selectedColumns.length} of {dataset.columns.length} selected
              </p>
            </div>

            <div>
              <Label>Format</Label>
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
                Generate export
              </Button>
            ) : (
              <div className="flex items-start gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                <Lock className="mt-px h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                <p className="text-caption text-neutral-500">
                  Your role can’t run exports. This needs the{' '}
                  <code className="font-mono">exports:run</code> permission.
                </p>
              </div>
            )}

            <p className="text-caption text-neutral-400">
              Money columns export as decimal strings with an explicit currency column — never raw
              minor-unit integers.
            </p>
          </div>
        </Card>

        {/* Jobs */}
        <div className="min-w-0">
          <SectionHeading description="Every export is audited: who exported what, which filters, how many rows.">
            Export jobs
          </SectionHeading>
          <DataTable
            columns={columns}
            rows={store.exportJobs}
            rowKey={(j) => j.id}
            storageKey="exports"
            initialSort={{ id: 'requestedAt', dir: 'desc' }}
            empty={{
              headline: 'No exports yet',
              description: 'Pick a dataset on the left, choose your columns and format, then generate.',
            }}
          />
        </div>
      </div>

      <ConfirmDialog
        open={confirmPii}
        onOpenChange={setConfirmPii}
        title="This export contains personal data"
        tone="primary"
        requireReason
        consequence={
          <>
            The export includes these PII fields:{' '}
            <strong className="font-mono">{piiColumns.join(', ')}</strong>. It requires the{' '}
            <code className="font-mono">pii:export</code> permission, is written to the audit trail
            with your name and the exact filters, and the download link expires after 24 hours.
          </>
        }
        confirmLabel="Generate export"
        onConfirm={(reason) => runExport(reason)}
      />
    </>
  );
}
