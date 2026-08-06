import * as React from 'react';
import { CalendarDays, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger, Separator } from '@/components/ui/misc';
import { useUrlState } from '@/hooks/useUrlState';
import { TZ_LABEL } from '@/lib/format';
import { RANGE_PRESETS, rangeLabel } from '@/lib/date-ranges';
import { cn } from '@/lib/utils';

/**
 * DateRangePicker (§4) — presets + a "Compare to previous period" toggle that
 * drives every delta on the page. Selection lives in the URL query string so
 * any view is shareable. Ranges are inclusive of both endpoints and state the
 * timezone used for bucketing (§21).
 */


export function DateRangePicker({ className }: { className?: string }) {
  const { get, set } = useUrlState();
  const range = get('range', '30d');
  const compare = get('compare') === '1';
  const from = get('from');
  const to = get('to');
  const [open, setOpen] = React.useState(false);

  const label =
    range === 'custom' && from && to ? `${from} → ${to}` : rangeLabel(range);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="md" className={cn('gap-2', className)}>
          <CalendarDays className="h-4 w-4 text-neutral-400" />
          {label}
          {compare && (
            <span className="rounded-sm bg-brand-50 px-1.5 py-px text-[11px] font-medium text-brand-500">
              vs prev
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[280px] p-0">
        <ul className="max-h-[280px] overflow-y-auto p-1" role="listbox" aria-label="Date range presets">
          {RANGE_PRESETS.map((preset) => (
            <li key={preset.id}>
              <button
                type="button"
                role="option"
                aria-selected={range === preset.id}
                onClick={() => {
                  set({ range: preset.id });
                  if (preset.id !== 'custom') setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-[14px] leading-5 transition-colors',
                  range === preset.id
                    ? 'bg-brand-50 font-medium text-brand-500'
                    : 'text-neutral-700 hover:bg-neutral-100',
                )}
              >
                {preset.label}
                {range === preset.id && <Check className="h-4 w-4" />}
              </button>
            </li>
          ))}
        </ul>

        {range === 'custom' && (
          <>
            <Separator />
            <div className="grid grid-cols-2 gap-3 p-3">
              <div>
                <Label htmlFor="range-from">From</Label>
                <Input
                  id="range-from"
                  type="date"
                  value={from}
                  onChange={(e) => set({ from: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="range-to">To</Label>
                <Input
                  id="range-to"
                  type="date"
                  value={to}
                  onChange={(e) => set({ to: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
          </>
        )}

        <Separator />
        <div className="flex items-center justify-between gap-3 p-3">
          <Label htmlFor="compare-toggle" className="cursor-pointer">
            Compare to previous period
          </Label>
          <Switch
            id="compare-toggle"
            checked={compare}
            onCheckedChange={(v) => set({ compare: v ? '1' : null })}
          />
        </div>
        <p className="border-t border-neutral-200 px-3 py-2 text-caption text-neutral-400">
          Inclusive of both endpoints · bucketed in {TZ_LABEL}
        </p>
      </PopoverContent>
    </Popover>
  );
}
