import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateTime, formatRelative } from '@/lib/format';
import type { TimelineEntry } from '@/lib/types';

/**
 * Timeline (§4) — vertical event feed. Each entry: colored dot by category ·
 * timestamp (absolute + relative) · actor · description · optional expandable
 * JSON payload.
 */

const CATEGORY_DOT: Record<TimelineEntry['category'], string> = {
  event: 'bg-brand-500',
  invitation: 'bg-info-500',
  contribution: 'bg-success-500',
  reminder: 'bg-warning-500',
  card: 'bg-accent-500',
  withdrawal: 'bg-chart-6',
  admin: 'bg-neutral-400',
};

const CATEGORY_LABEL: Record<TimelineEntry['category'], string> = {
  event: 'Event',
  invitation: 'Invitation',
  contribution: 'Contribution',
  reminder: 'Reminder',
  card: 'Gift card',
  withdrawal: 'Withdrawal',
  admin: 'Admin',
};

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <ol className="relative space-y-0">
      {entries.map((entry, i) => (
        <TimelineRow key={entry.id} entry={entry} isLast={i === entries.length - 1} />
      ))}
    </ol>
  );
}

function TimelineRow({ entry, isLast }: { entry: TimelineEntry; isLast: boolean }) {
  const [expanded, setExpanded] = React.useState(false);
  const hasPayload = entry.payload && Object.keys(entry.payload).length > 0;

  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {/* rail */}
      <div className="relative flex w-3 shrink-0 justify-center">
        <span
          className={cn('z-10 mt-[6px] h-3 w-3 shrink-0 rounded-full ring-4 ring-neutral-0', CATEGORY_DOT[entry.category])}
          aria-hidden
        />
        {!isLast && <span className="absolute top-[18px] h-full w-px bg-neutral-200" aria-hidden />}
      </div>

      <div className="min-w-0 flex-1 pb-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-[14px] font-semibold leading-5 text-neutral-900">{entry.title}</span>
          <span className="rounded-sm bg-neutral-100 px-1.5 py-px text-[11px] font-medium text-neutral-500">
            {CATEGORY_LABEL[entry.category]}
          </span>
        </div>

        <p className="mt-1 text-body text-neutral-500">
          {entry.description}
          {entry.actor && <span className="text-neutral-400"> · by {entry.actor}</span>}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-neutral-400">
          <span className="tnum">{formatDateTime(entry.timestamp)}</span>
          <span>{formatRelative(entry.timestamp)}</span>
          {entry.elapsedFromPublication && (
            <span className="tnum text-brand-500">{entry.elapsedFromPublication}</span>
          )}
        </div>

        {hasPayload && (
          <>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="mt-2 inline-flex items-center gap-1 rounded-sm text-caption font-medium text-brand-500 transition-colors hover:text-brand-600"
            >
              <ChevronRight
                className={cn('h-3 w-3 transition-transform duration-micro', expanded && 'rotate-90')}
                aria-hidden
              />
              {expanded ? 'Hide' : 'Show'} payload
            </button>
            {expanded && (
              <pre className="mt-2 overflow-x-auto rounded-sm border border-neutral-200 bg-neutral-50 p-3 font-mono text-[13px] leading-5 text-neutral-700">
                {JSON.stringify(entry.payload, null, 2)}
              </pre>
            )}
          </>
        )}
      </div>
    </li>
  );
}
