import { useTranslation } from 'react-i18next';
import * as React from 'react';
import { Download, FileJson, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { downloadDataset, type ExportColumn } from '@/lib/export';
import { exportsService } from '@/lib/api/services';

/**
 * Export button for list screens. Downloads exactly the rows currently in view
 * (filters applied), records an audit entry, and drops a job on the Exports
 * screen so the export is traceable (§13).
 */
export function ExportButton<T>({
  name,
  label,
  columns,
  rows,
  filterSummary,
  containsPii,
  size = 'md',
  variant = 'secondary',
}: {
  /** Slug used in the filename, e.g. "events" → regal-events-<ts>.csv */
  name: string;
  label: string;
  columns: ExportColumn<T>[];
  rows: T[];
  filterSummary: string;
  containsPii?: boolean;
  size?: 'sm' | 'md';
  variant?: 'secondary' | 'ghost';
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { can } = useAuth();
  const [busy, setBusy] = React.useState(false);

  const run = (format: 'csv' | 'json') => {
    if (rows.length === 0) {
      toast({
        title: t('common.nothingToExport'),
        description: t('common.nothingToExportBody'),
        tone: 'warning',
      });
      return;
    }
    setBusy(true);
    const filename = downloadDataset(name, columns, rows, format);
    // Record it server-side so the Exports screen and the audit trail see it.
    void exportsService
      .create({
        dataset: name,
        format,
        filters: { summary: filterSummary },
        reason: `Downloaded ${label} from the ${label} screen`,
      })
      .catch(() => {
        /* the file already downloaded; a failed bookkeeping call must not block it */
      });
    toast({
      title: t('common.downloadStarted'),
      description: t('common.rowsWithCount', { filename, count: rows.length }),
      tone: 'success',
    });
    setTimeout(() => setBusy(false), 500);
  };

  if (!can('exports:run')) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} loading={busy}>
          <Download className="h-4 w-4 text-neutral-400" />
          {t('common.export')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('common.rowsInView', { count: rows.length })}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => run('csv')}>
          <FileSpreadsheet className="h-4 w-4 text-neutral-400" />
          {t('common.downloadCsv')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run('json')}>
          <FileJson className="h-4 w-4 text-neutral-400" />
          {t('common.downloadJson')}
        </DropdownMenuItem>
        {containsPii && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t('common.containsPii')}</DropdownMenuLabel>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
