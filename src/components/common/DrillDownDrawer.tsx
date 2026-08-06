import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Link } from 'react-router-dom';
import { ArrowUpRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * DrillDownDrawer (§4) — right-side drawer, 640px (full width <768px), e2.
 * Opens the record list behind any KPI without losing page context.
 * Header: title + record count + "Open full page" + ✕. Esc closes; focus trapped
 * (Radix Dialog handles the trap and focus return to trigger).
 */
export function DrillDownDrawer({
  open,
  onOpenChange,
  title,
  subtitle,
  recordCount,
  fullPageHref,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  recordCount?: number;
  fullPageHref?: string;
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-neutral-900/40 data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          className={cn(
            'fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-neutral-0 shadow-e2 md:w-[640px]',
            'data-[state=open]:animate-slide-in-right',
          )}
          aria-describedby={subtitle ? 'drawer-subtitle' : undefined}
        >
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-200 p-6">
            <div className="min-w-0">
              <DialogPrimitive.Title className="truncate text-section-heading text-neutral-900">
                {title}
              </DialogPrimitive.Title>
              <p id="drawer-subtitle" className="mt-1 text-caption text-neutral-500">
                {recordCount !== undefined && (
                  <span className="tnum">
                    {recordCount.toLocaleString()} record{recordCount === 1 ? '' : 's'}
                  </span>
                )}
                {recordCount !== undefined && subtitle ? ' · ' : ''}
                {subtitle}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {fullPageHref && (
                <Link
                  to={fullPageHref}
                  onClick={() => onOpenChange(false)}
                  className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-[13px] font-medium text-brand-500 transition-colors hover:bg-brand-50"
                >
                  Open full page
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              )}
              <DialogPrimitive.Close
                className="rounded-sm p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                aria-label="Close drawer"
              >
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
