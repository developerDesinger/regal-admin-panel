import { useTranslation } from 'react-i18next';
import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { History, Pencil, ShieldAlert } from 'lucide-react';
import { PageHeader, DetailRow, SectionHeading } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge, Chip } from '@/components/common/StatusBadge';
import { CloverValue } from '@/components/common/MoneyValue';
import { CardUploadDialog } from './CardUploadDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CopyableId } from '@/components/ui/misc';
import { useAuth } from '@/hooks/use-auth';
import { useCatalogCard, useCardVersions, useAuditTrail } from '@/hooks/data';
import { formatDate, formatDateTime, formatNumber, formatPercent } from '@/lib/format';

/** Card catalog detail (§09) — includes the version history strip. */
export default function CardDetail() {
  const { t } = useTranslation();
  const { cardId } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { rows: auditEntries } = useAuditTrail({ resourceType: 'Gift card' });
  const { card } = useCatalogCard(cardId);
  const versions = useCardVersions(cardId);
  const [editOpen, setEditOpen] = React.useState(false);


  if (!card) {
    return (
      <EmptyState
        icon={ShieldAlert}
        headline={t('cards.detail.notFound')}
        description={t('cards.detail.notFoundBody')}
        action={{ label: t('cards.detail.backToCatalog'), onClick: () => navigate('/cards/catalog') }}
      />
    );
  }

  const cardAudit = auditEntries
    .filter((a) => a.resourceType === 'Gift card' && a.resource.href.endsWith(card.id))
    .slice(0, 8);
  const revenue = card.cloverCost * card.unlocks;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: t('nav.giftCards') },
          { label: t('cards.catalog.breadcrumb'), href: '/cards/catalog' },
          { label: card.name },
        ]}
        title={card.name}
        subtitle={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <StatusBadge
              status={card.isActive ? 'active' : 'inactive'}
              label={card.isActive ? t('status.active') : t('status.inactive')}
            />
            <Chip tone={card.cloverCost > 0 ? 'secondary' : 'neutral'}>
              {card.cloverCost > 0 ? t('cards.premium') : t('cards.standard')}
            </Chip>
            {card.categories.map((c) => (
              <Chip key={c}>{t(`occasion.${c}`, { defaultValue: c })}</Chip>
            ))}
            <CopyableId value={card.slug} label={t('cards.detail.slug')} />
            <span className="text-neutral-400">v{card.version}</span>
          </div>
        }
        actions={
          can('cards:write') && (
            <Button variant="primary" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              {t('cards.detail.editDesign')}
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <div
            className="relative flex aspect-[3/4] w-full items-center justify-center rounded-md text-[72px]"
            style={{ backgroundColor: card.bg }}
          >
            <span aria-hidden>{card.emojiKey}</span>
            {card.cloverCost > 0 ? (
              <span className="tnum absolute right-3 top-3 rounded-full bg-neutral-900/70 px-2 py-1 text-[12px] font-semibold text-white">
                🍀 {card.cloverCost}
              </span>
            ) : (
              <span className="absolute right-3 top-3 rounded-full bg-success-500 px-2 py-1 text-[12px] font-semibold text-white">
                {t('cards.freeUpper')}
              </span>
            )}
          </div>
          <p className="mt-3 text-caption text-neutral-500">
            {t('cards.detail.background')} <code className="font-mono">{card.bg}</code>
          </p>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <div className="border-b border-neutral-200 p-4">
              <h2 className="text-card-title text-neutral-700">{t('cards.detail.performance')}</h2>
            </div>
            <dl className="divide-y divide-neutral-200 p-4 pt-0">
              <DetailRow label={t('cards.detail.timesSelected')}>
                <span className="tnum">{formatNumber(card.timesSelected)}</span>
              </DetailRow>
              <DetailRow label={t('cards.detail.unlocks')}>
                <span className="tnum">{formatNumber(card.unlocks)}</span>
              </DetailRow>
              <DetailRow label={t('cards.detail.revealRate')}>
                <span className="tnum">{formatPercent(card.revealRate)}</span>
              </DetailRow>
              <DetailRow label={t('cards.detail.uniqueDownloads')}>
                <span className="tnum">{formatNumber(card.uniqueDownloads)}</span>
              </DetailRow>
              <DetailRow label={t('cards.detail.totalDownloads')}>
                <span className="tnum">{formatNumber(card.totalDownloads)}</span>
              </DetailRow>
              <DetailRow label={t('cards.detail.revenue')}>
                {revenue > 0 ? <CloverValue amount={revenue} /> : <span className="text-neutral-400">—</span>}
              </DetailRow>
            </dl>
          </Card>

          <Card>
            <div className="border-b border-neutral-200 p-4">
              <h2 className="text-card-title text-neutral-700">
                {t('cards.detail.configuration')}
              </h2>
            </div>
            <dl className="divide-y divide-neutral-200 p-4 pt-0">
              <DetailRow label={t('cards.detail.slugImmutable')}>
                <code className="font-mono text-[13px]">{card.slug}</code>
              </DetailRow>
              <DetailRow label={t('cards.detail.cloverCost')}>
                {card.cloverCost > 0 ? <CloverValue amount={card.cloverCost} /> : t('cards.free')}
              </DetailRow>
              <DetailRow label={t('cards.detail.sortOrder')}>
                <span className="tnum">{card.sortOrder}</span>
              </DetailRow>
              <DetailRow label={t('cards.detail.availableFrom')}>
                {card.availableFrom ? formatDate(card.availableFrom) : '—'}
              </DetailRow>
              <DetailRow label={t('cards.detail.availableUntil')}>
                {card.availableUntil ? formatDate(card.availableUntil) : '—'}
              </DetailRow>
              <DetailRow label={t('cards.detail.created')}>{formatDate(card.createdAt)}</DetailRow>
            </dl>
          </Card>
        </div>
      </div>

      {/* Version history — artwork is never mutated in place (§09) */}
      <SectionHeading
        className="mt-6"
        description={t('cards.detail.versionDescription')}
      >
        {t('cards.detail.versionHeading')}
      </SectionHeading>
      <Card>
        <ul className="divide-y divide-neutral-200">
          {versions.map((v) => (
            <li key={v.version} className="flex items-center gap-4 p-4">
              {v.images?.thumb ? (
                <img
                  src={v.images.thumb}
                  alt=""
                  loading="lazy"
                  className="h-10 w-8 shrink-0 rounded-sm object-cover"
                  style={{ opacity: v.isCurrent ? 1 : 0.5 }}
                />
              ) : (
                <span
                  className="flex h-10 w-8 shrink-0 items-center justify-center rounded-sm bg-neutral-100"
                  aria-hidden
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-body font-medium text-neutral-900">
                  {t('cards.detail.version', { n: v.version })}
                  {v.isCurrent && (
                    <span className="ml-2 rounded-sm bg-success-50 px-1.5 py-px text-[11px] font-medium text-success-500">
                      {t('cards.detail.current')}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-caption text-neutral-500">
                  {v.isCurrent ? t('cards.detail.liveNow') : t('cards.detail.retained')}
                  {v.createdBy ? t('cards.detail.createdBy', { name: v.createdBy }) : ''}
                </p>
              </div>
              <span className="tnum shrink-0 text-caption text-neutral-400">
                {formatDate(v.createdAt)}
              </span>
            </li>
          ))}
          {versions.length === 0 && (
            <li className="p-4 text-body text-neutral-500">{t('cards.detail.noVersions')}</li>
          )}
        </ul>
      </Card>

      <SectionHeading className="mt-6" description={t('cards.detail.changeDescription')}>
        {t('cards.detail.changeHeading')}
      </SectionHeading>
      <Card>
        {cardAudit.length === 0 ? (
          <EmptyState
            icon={History}
            headline={t('cards.detail.noChanges')}
            description={t('cards.detail.noChangesBody')}
          />
        ) : (
          <ul className="divide-y divide-neutral-200">
            {cardAudit.map((entry) => (
              <li key={entry.id} className="flex items-start gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-body text-neutral-900">
                    <span className="font-medium">{entry.admin.name}</span>{' '}
                    <code className="font-mono text-[13px] text-neutral-700">{entry.action}</code>
                  </p>
                  <p className="mt-1 text-caption text-neutral-500">{entry.reason}</p>
                  {entry.before && entry.after && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-caption">
                      <code className="rounded-sm bg-danger-50 px-2 py-1 font-mono text-danger-500">
                        {JSON.stringify(entry.before)}
                      </code>
                      <span className="text-neutral-400">→</span>
                      <code className="rounded-sm bg-success-50 px-2 py-1 font-mono text-success-500">
                        {JSON.stringify(entry.after)}
                      </code>
                    </div>
                  )}
                </div>
                <span className="tnum shrink-0 text-caption text-neutral-400">
                  {formatDateTime(entry.timestamp)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <CardUploadDialog open={editOpen} onOpenChange={setEditOpen} editing={card} />
    </>
  );
}
