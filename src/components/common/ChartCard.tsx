import * as React from 'react';
import { Download, FileDown, MoreHorizontal, Table2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { chartCsv, downloadText, timestampSlug } from '@/lib/export';
import { cn } from '@/lib/utils';

/**
 * ChartCard (§4) — title + subtitle + optional legend + ⋯ menu
 * (Download PNG · Download CSV · View underlying records). Min height 280px.
 *
 * Every chart ships an accessible text alternative: the "View as table" toggle
 * is mandatory, not optional (§21 Accessibility).
 */

export interface LegendItem {
  label: string;
  color: string;
  dashed?: boolean;
}

export function ChartCard({
  title,
  subtitle,
  legend,
  children,
  /** Rows rendered by the "View as table" toggle — the text alternative. */
  tableData,
  onViewRecords,
  className,
  minHeight = 280,
  actions,
}: {
  title: string;
  subtitle?: string;
  legend?: LegendItem[];
  children: React.ReactNode;
  tableData?: { columns: string[]; rows: (string | number)[][] };
  onViewRecords?: () => void;
  className?: string;
  minHeight?: number;
  actions?: React.ReactNode;
}) {
  const [asTable, setAsTable] = React.useState(false);
  const { toast } = useToast();
  const bodyRef = React.useRef<HTMLDivElement>(null);

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const downloadCsv = () => {
    if (!tableData) {
      toast({ title: 'No tabular data for this chart', tone: 'warning' });
      return;
    }
    downloadText(
      `regal-${slug}-${timestampSlug()}.csv`,
      chartCsv(tableData.columns, tableData.rows),
    );
    toast({ title: 'Chart CSV downloaded', description: title, tone: 'success' });
  };

  /** Rasterises the chart's SVG to PNG entirely client-side. */
  const downloadPng = async () => {
    const svg = bodyRef.current?.querySelector('svg');
    if (!svg) {
      toast({ title: 'Switch back to chart view to export a PNG', tone: 'warning' });
      return;
    }
    try {
      const clone = svg.cloneNode(true) as SVGSVGElement;
      const { width, height } = svg.getBoundingClientRect();
      clone.setAttribute('width', String(width));
      clone.setAttribute('height', String(height));
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      // Inline the resolved colours — CSS variables don't survive serialization.
      const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      style.textContent = `text{font-family:Inter,sans-serif;font-size:12px;fill:${getComputedStyle(
        document.body,
      ).getPropertyValue('color')}}`;
      clone.prepend(style);

      const svgText = new XMLSerializer().serializeToString(clone);
      const img = new Image();
      const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('render failed'));
        img.src = url;
      });

      const scale = 2; // retina
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.fillStyle = getComputedStyle(document.body).backgroundColor || '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `regal-${slug}-${timestampSlug()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        toast({ title: 'Chart PNG downloaded', description: title, tone: 'success' });
      }, 'image/png');
    } catch {
      toast({
        title: 'Couldn’t render this chart as PNG',
        description: 'Download the CSV instead.',
        tone: 'danger',
      });
    }
  };

  return (
    <section
      className={cn('flex flex-col rounded-lg border border-neutral-200 bg-neutral-0', className)}
      aria-label={title}
    >
      <header className="flex items-start justify-between gap-4 p-4">
        <div className="min-w-0">
          <h3 className="text-card-title text-neutral-700">{title}</h3>
          {subtitle && <p className="mt-1 text-caption text-neutral-500">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          {tableData && (
            <button
              type="button"
              onClick={() => setAsTable((v) => !v)}
              aria-pressed={asTable}
              className={cn(
                'inline-flex items-center gap-1 rounded-sm px-2 py-1 text-caption font-medium transition-colors',
                asTable
                  ? 'bg-brand-50 text-brand-500'
                  : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700',
              )}
            >
              <Table2 className="h-3 w-3" aria-hidden />
              {asTable ? 'View as chart' : 'View as table'}
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="rounded-sm p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
              aria-label={`${title} chart options`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => void downloadPng()}>
                <Download className="h-4 w-4 text-neutral-400" />
                Download PNG
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={downloadCsv}>
                <FileDown className="h-4 w-4 text-neutral-400" />
                Download CSV
              </DropdownMenuItem>
              {onViewRecords && (
                <DropdownMenuItem onSelect={onViewRecords}>
                  <Table2 className="h-4 w-4 text-neutral-400" />
                  View underlying records
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {legend && legend.length > 0 && !asTable && (
        <ul className="flex flex-wrap items-center gap-4 px-4 pb-3">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-2 text-caption text-neutral-500">
              {l.dashed ? (
                <span
                  className="h-0 w-3 border-t-2 border-dashed"
                  style={{ borderColor: l.color }}
                  aria-hidden
                />
              ) : (
                <span
                  className="h-2 w-2 rounded-sm"
                  style={{ backgroundColor: l.color }}
                  aria-hidden
                />
              )}
              {l.label}
            </li>
          ))}
        </ul>
      )}

      <div ref={bodyRef} className="min-w-0 flex-1 px-4 pb-4" style={{ minHeight }}>
        {asTable && tableData ? (
          <div className="max-h-[320px] overflow-auto rounded-md border border-neutral-200">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-neutral-50">
                <tr>
                  {tableData.columns.map((c, i) => (
                    <th
                      key={c}
                      scope="col"
                      className={cn(
                        'whitespace-nowrap px-3 py-2 text-table-header uppercase text-neutral-500',
                        i === 0 ? 'text-left' : 'text-right',
                      )}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.rows.map((row, ri) => (
                  <tr key={ri} className="border-t border-neutral-200">
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className={cn(
                          'whitespace-nowrap px-3 py-2 text-body',
                          ci === 0
                            ? 'text-left text-neutral-700'
                            : 'tnum text-right font-medium text-neutral-900',
                        )}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

/** Shared Recharts tooltip — bold value, metric name, date (§4). */
export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: { name?: string; dataKey?: string | number; value?: number; color?: string }[];
  label?: string | number;
  formatter?: (value: number, key: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-sm border border-neutral-200 bg-neutral-0 px-3 py-2 shadow-e1">
      {label !== undefined && (
        <p className="mb-1 text-caption text-neutral-500">{String(label)}</p>
      )}
      <ul className="space-y-1">
        {payload.map((p, i) => (
          <li key={i} className="flex items-center gap-2 text-caption">
            <span
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ backgroundColor: p.color }}
              aria-hidden
            />
            <span className="text-neutral-500">{p.name ?? p.dataKey}</span>
            <span className="tnum ml-auto font-semibold text-neutral-900">
              {formatter && p.value !== undefined
                ? formatter(p.value, String(p.dataKey))
                : p.value?.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
