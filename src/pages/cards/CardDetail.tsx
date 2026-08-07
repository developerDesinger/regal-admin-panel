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
import { useStore } from '@/lib/store';
import { useCatalog } from '@/hooks/data';
import { formatDate, formatDateTime, formatNumber, formatPercent } from '@/lib/format';

/** Card catalog detail (§09) — includes the version history strip. */
export default function CardDetail() {
  const { cardId } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { giftCards: storeCards, auditEntries } = useStore();
  const { rows: apiCards, isMock } = useCatalog();
  const giftCards = isMock ? storeCards : apiCards;
  const [editOpen, setEditOpen] = React.useState(false);

  const card = giftCards.find((c) => c.id === cardId);

  if (!card) {
    return (
      <EmptyState
        icon={ShieldAlert}
        headline="Design not found"
        description="This design may have been deleted, or the ID in the URL is incorrect."
        action={{ label: 'Back to catalog', onClick: () => navigate('/cards/catalog') }}
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
          { label: 'Gift Cards' },
          { label: 'Catalog', href: '/cards/catalog' },
          { label: card.name },
        ]}
        title={card.name}
        subtitle={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <StatusBadge
              status={card.isActive ? 'active' : 'inactive'}
              label={card.isActive ? 'Active' : 'Inactive'}
            />
            <Chip tone={card.cloverCost > 0 ? 'secondary' : 'neutral'}>
              {card.cloverCost > 0 ? 'Premium' : 'Standard'}
            </Chip>
            {card.categories.map((c) => (
              <Chip key={c}>{c}</Chip>
            ))}
            <CopyableId value={card.slug} label="Slug" />
            <span className="text-neutral-400">v{card.version}</span>
          </div>
        }
        actions={
          can('cards:write') && (
            <Button variant="primary" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              Edit design
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
                FREE
              </span>
            )}
          </div>
          <p className="mt-3 text-caption text-neutral-500">
            Background <code className="font-mono">{card.bg}</code>
          </p>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <div className="border-b border-neutral-200 p-4">
              <h2 className="text-card-title text-neutral-700">Performance</h2>
            </div>
            <dl className="divide-y divide-neutral-200 p-4 pt-0">
              <DetailRow label="Times selected">
                <span className="tnum">{formatNumber(card.timesSelected)}</span>
              </DetailRow>
              <DetailRow label="Unlocks">
                <span className="tnum">{formatNumber(card.unlocks)}</span>
              </DetailRow>
              <DetailRow label="Reveal rate">
                <span className="tnum">{formatPercent(card.revealRate)}</span>
              </DetailRow>
              <DetailRow label="Unique downloads">
                <span className="tnum">{formatNumber(card.uniqueDownloads)}</span>
              </DetailRow>
              <DetailRow label="Total downloads">
                <span className="tnum">{formatNumber(card.totalDownloads)}</span>
              </DetailRow>
              <DetailRow label="Revenue in clovers">
                {revenue > 0 ? <CloverValue amount={revenue} /> : <span className="text-neutral-400">—</span>}
              </DetailRow>
            </dl>
          </Card>

          <Card>
            <div className="border-b border-neutral-200 p-4">
              <h2 className="text-card-title text-neutral-700">Configuration</h2>
            </div>
            <dl className="divide-y divide-neutral-200 p-4 pt-0">
              <DetailRow label="Slug (immutable)">
                <code className="font-mono text-[13px]">{card.slug}</code>
              </DetailRow>
              <DetailRow label="Clover cost">
                {card.cloverCost > 0 ? <CloverValue amount={card.cloverCost} /> : 'Free'}
              </DetailRow>
              <DetailRow label="Sort order">
                <span className="tnum">{card.sortOrder}</span>
              </DetailRow>
              <DetailRow label="Available from">
                {card.availableFrom ? formatDate(card.availableFrom) : '—'}
              </DetailRow>
              <DetailRow label="Available until">
                {card.availableUntil ? formatDate(card.availableUntil) : '—'}
              </DetailRow>
              <DetailRow label="Created">{formatDate(card.createdAt)}</DetailRow>
            </dl>
          </Card>
        </div>
      </div>

      {/* Version history — artwork is never mutated in place (§09) */}
      <SectionHeading
        className="mt-6"
        description="Editing artwork creates a new version. Users who unlocked v1 keep exactly what they paid for."
      >
        Version history
      </SectionHeading>
      <Card>
        <ul className="divide-y divide-neutral-200">
          {Array.from({ length: card.version }, (_, i) => card.version - i).map((v) => (
            <li key={v} className="flex items-center gap-4 p-4">
              <span
                className="flex h-10 w-8 shrink-0 items-center justify-center rounded-sm text-[16px]"
                style={{ backgroundColor: card.bg, opacity: v === card.version ? 1 : 0.5 }}
                aria-hidden
              >
                {card.emojiKey}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-body font-medium text-neutral-900">
                  Version {v}
                  {v === card.version && (
                    <span className="ml-2 rounded-sm bg-success-50 px-1.5 py-px text-[11px] font-medium text-success-500">
                      Current
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-caption text-neutral-500">
                  {v === card.version
                    ? 'Live in the app now'
                    : 'Retained for users who unlocked this version'}
                </p>
              </div>
              <span className="tnum shrink-0 text-caption text-neutral-400">
                {formatDate(card.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <SectionHeading className="mt-6" description="Every create, edit, price change, activation and deletion.">
        Change history
      </SectionHeading>
      <Card>
        {cardAudit.length === 0 ? (
          <EmptyState
            icon={History}
            headline="No changes recorded"
            description="Catalog changes are written to the audit trail with before → after values."
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
