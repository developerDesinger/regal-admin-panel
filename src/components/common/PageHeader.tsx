import { useTranslation } from 'react-i18next';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/format';

/**
 * Page header (§3) — title (24/600), optional subtitle, right-aligned actions
 * (date range, comparison toggle, Export, page primary action).
 */
export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
  /** "Data as of HH:MM" stamp — shown when values come from cached rollups (§21). */
  dataAsOf,
  className,
}: {
  title: string;
  subtitle?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
  dataAsOf?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className={cn('mb-6', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="text-page-title text-neutral-900">{title}</h1>
          {subtitle && <div className="mt-1 text-body text-neutral-500">{subtitle}</div>}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 [&>*]:min-w-0 [&_button]:flex-1 sm:[&_button]:flex-none">
            {actions}
          </div>
        )}
      </div>
      {dataAsOf && (
        <p className="mt-2 inline-flex items-center gap-1 text-caption text-neutral-400">
          <Clock className="h-3 w-3" aria-hidden />
          {t('common.dataAsOf')} <span className="tnum">{formatDateTime(dataAsOf)}</span>
        </p>
      )}
    </div>
  );
}

/** Breadcrumbs — required on all detail pages (§3). */
export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('nav.breadcrumb')} className="mb-2">
      <ol className="flex flex-wrap items-center gap-1 text-caption text-neutral-500">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-1">
            {item.href ? (
              <Link
                to={item.href}
                className="rounded-sm transition-colors hover:text-brand-500 hover:underline"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-neutral-700" aria-current="page">
                {item.label}
              </span>
            )}
            {i < items.length - 1 && (
              <ChevronRight className="h-3 w-3 text-neutral-300" aria-hidden />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Section heading inside a page — 18/600 (§2.3). */
export function SectionHeading({
  children,
  description,
  action,
  className,
}: {
  children: React.ReactNode;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 flex items-end justify-between gap-4', className)}>
      <div>
        <h2 className="text-section-heading text-neutral-900">{children}</h2>
        {description && <p className="mt-1 text-caption text-neutral-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Key/value row used in metadata rails and financial panels. */
export function DetailRow({
  label,
  children,
  tooltip,
  className,
}: {
  label: string;
  children: React.ReactNode;
  tooltip?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-2', className)} title={tooltip}>
      <dt className="shrink-0 text-caption text-neutral-500">{label}</dt>
      <dd className="min-w-0 text-right text-body text-neutral-900">{children}</dd>
    </div>
  );
}
