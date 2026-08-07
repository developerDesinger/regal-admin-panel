import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ExternalLink, MapPin, ShieldAlert } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { DetailRow } from '@/components/common/PageHeader';
import { Timeline } from '@/components/common/Timeline';
import { StatusBadge, Chip } from '@/components/common/StatusBadge';
import { MoneyValue } from '@/components/common/MoneyValue';
import { ChartCard, ChartTooltip } from '@/components/common/ChartCard';
import { CHART_COLORS } from '@/lib/chart-tokens';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DataTable, type Column } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { ContributionsTable } from '@/pages/contributions/ContributionsTable';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, CopyableId, ProgressBar } from '@/components/ui/misc';
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
import {
  useEvent,
  useEventParticipants,
  useEventTimeline,
  useContributions,
  useCatalog,
  useEventActivity,
  useEventFinancials,
  useEventCard,
} from '@/hooks/data';

import { useAdminMutations } from '@/hooks/data/mutations';
import { contributionColumns, eventColumns } from '@/lib/datasets';
import { ExportButton } from '@/components/common/ExportButton';
import {
  formatDate,
  formatDateTime,
  formatDuration,
  formatMoney,
  formatMoneyCompact,
  formatPercent,
  formatRelative,
} from '@/lib/format';
import type { AuditEntry, Contribution, Participant, RegalEvent } from '@/lib/types';
import { cn } from '@/lib/utils';

const TABS = ['overview', 'timeline', 'contributions', 'participants', 'card', 'activity'] as const;
type TabId = (typeof TABS)[number];

/** Daily confirmed volume + count, with reminder-send markers. */
function buildDailySeries(rows: Contribution[]) {
  const map = new Map<string, { date: string; amount: number; count: number }>();
  rows
    .filter((c) => c.status === 'succeeded')
    .forEach((c) => {
      const date = c.createdAt.slice(0, 10);
      const prev = map.get(date) ?? { date, amount: 0, count: 0 };
      map.set(date, { date, amount: prev.amount + c.amount, count: prev.count + 1 });
    });
  const buckets = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  // reminders land every 4th bucket in the fixture
  return buckets.map((b, i) => ({ ...b, reminder: i > 0 && i % 4 === 0 }));
}

/**
 * Screen 04 — Event Detail (§04). The single most important screen in the panel.
 * Tabs: Overview · Timeline · Contributions · Participants · Card · Activity Log.
 */
export default function EventDetail() {
  const { eventId, tab } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { can } = useAuth();
  const { rows: giftCards } = useCatalog();
  const { rows: auditEntries } = useEventActivity(eventId);
  const { financials } = useEventFinancials(eventId);
  // Reveal/download stats and card errors live on their own endpoint.
  const { card: eventCard } = useEventCard(eventId);
  const mutations = useAdminMutations();
  const { event: resolvedEvent } = useEvent(eventId);
  const { rows: eventContributions } = useContributions({ eventId: eventId ?? '' });
  const participants = useEventParticipants(eventId);
  const timeline = useEventTimeline(eventId);
  const [confirm, setConfirm] = React.useState<null | {
    title: string;
    consequence: React.ReactNode;
    typed?: string;
    label: string;
    action: string;
    patch?: Partial<RegalEvent>;
  }>(null);

  const event = resolvedEvent;

  if (!event) {
    return (
      <EmptyState
        icon={ShieldAlert}
        headline="Event not found"
        description="This event may have been deleted, or the ID in the URL is incorrect."
        action={{ label: 'Back to events', onClick: () => navigate('/events') }}
      />
    );
  }

  const activeTab: TabId = (TABS.includes(tab as TabId) ? tab : 'overview') as TabId;
  const card = giftCards.find((c) => c.slug === event.cardSlug);
  const progress = (event.raisedAmount / event.goalAmount) * 100;

  // Every figure here comes from /events/:id/financials — deriving it from the
  // contributions table would only ever see the current page.
  const byStatus = (s: string) => ({ count: financials?.byStatus?.[s as 'succeeded']?.count ?? 0 });
  const sumOf = (s: string) => financials?.byStatus?.[s as 'succeeded']?.amount ?? 0;

  const uniqueContributors = financials?.uniqueContributors ?? 0;
  const platformFees = financials?.platformFees ?? 0;
  const stripeFees = financials?.stripeFees ?? 0;
  const confirmedTotal = financials?.byStatus?.succeeded?.amount ?? 0;
  const medianContribution = financials?.medianContribution ?? 0;

  const openedCount = participants.filter((p) => p.openedAt).length;
  // Participation counts CONFIRMED contributions only — a failed attempt is not
  // participation (§02 Participation Rate).
  const contributedCount = participants.filter((p) => p.paymentStatus === 'succeeded').length;

  const dailySeries = buildDailySeries(eventContributions);

  const eventAudit = auditEntries.filter((a) => a.resource.href === `/events/${event.id}`);

  const runAdminAction = (reason: string) => {
    if (!confirm) return;
    if (confirm.patch) {
      void mutations.runEventAction(event, confirm.action, confirm.patch, reason);
    }
    toast({
      title: `${confirm.label} recorded`,
      description: 'Written to the audit trail · see the Activity Log tab',
      tone: 'success',
    });
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Events', href: '/events' },
          { label: event.name },
        ]}
        title={event.name}
        subtitle={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <StatusBadge status={event.status} />
            <Chip>{event.occasion}</Chip>
            <Link
              to={`/users/${event.organizer.id}`}
              className="inline-flex items-center gap-2 rounded-sm transition-colors hover:text-brand-500"
            >
              <Avatar name={event.organizer.name} color={event.organizer.avatarColor} size="xs" />
              {event.organizer.name}
            </Link>
            <span className="text-neutral-400">
              {formatDate(event.createdAt)} → {formatDate(event.endDate)}
            </span>
            <CopyableId value={event.id} label="Event ID" />
            <CopyableId value={`regal.app/e/${event.shareSlug}`} label="Share link" />
          </div>
        }
        actions={
          <>
            <ExportButton
              name={`event-${event.shareSlug}`}
              label="Event"
              columns={eventColumns}
              rows={[event]}
              filterSummary={event.name}
            />
            {can('events:write') && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="primary">Admin actions</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[240px]">
                  <DropdownMenuLabel>All actions are audited</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() =>
                      setConfirm({
                        title: 'Override event status',
                        label: 'Status override',
                        action: 'event.status_override',
                        patch: { status: 'completed', closedAt: new Date().toISOString() },
                        typed: event.name,
                        consequence: (
                          <>
                            This forces <strong>{event.name}</strong> from{' '}
                            <strong>{event.status}</strong> to <strong>completed</strong>. Contributors
                            are not notified, and the collection window closes immediately. The change
                            is written to the audit trail with before → after values.
                          </>
                        ),
                      })
                    }
                  >
                    Override status
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      setConfirm({
                        title: 'Force close this event',
                        label: 'Force close',
                        action: 'event.force_close',
                        patch: { status: 'completed', closedAt: new Date().toISOString() },
                        typed: event.name,
                        consequence: (
                          <>
                            No further contributions will be accepted for <strong>{event.name}</strong>.
                            Funds already confirmed remain available for withdrawal by the beneficiary.
                          </>
                        ),
                      })
                    }
                  >
                    Force close
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      setConfirm({
                        title: 'Resend reminders',
                        label: 'Reminders resent',
                        action: 'event.resend_reminders',
                        consequence: (
                          <>
                            A reminder push and email will be sent to the{' '}
                            <strong>{participants.length - contributedCount} invitees</strong> who
                            haven’t contributed yet. They were last reminded 2 days ago.
                          </>
                        ),
                      })
                    }
                  >
                    Resend reminders
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    destructive
                    onSelect={() =>
                      setConfirm({
                        title: 'Flag event for review',
                        label: 'Flagged for review',
                        action: 'event.flag_for_review',
                        patch: { status: 'paused' },
                        consequence: (
                          <>
                            <strong>{event.name}</strong> will be added to the operations review queue
                            and surfaced in the Alerts Center. The organizer is not notified.
                          </>
                        ),
                      })
                    }
                  >
                    Flag for review
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />

      <Tabs value={activeTab} onValueChange={(v) => navigate(`/events/${event.id}/${v}`)}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="contributions">
            Contributions
            <span className="tnum ml-2 text-caption text-neutral-400">{eventContributions.length}</span>
          </TabsTrigger>
          <TabsTrigger value="participants">
            Participants
            <span className="tnum ml-2 text-caption text-neutral-400">{participants.length}</span>
          </TabsTrigger>
          <TabsTrigger value="card">Card</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------- Overview -- */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="space-y-4 xl:col-span-2">
              {/* Financial panel — one aggregate total is not enough (§04) */}
              <Card>
                <div className="border-b border-neutral-200 p-4">
                  <h2 className="text-card-title text-neutral-700">Financials</h2>
                </div>
                <div className="p-4">
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="text-caption text-neutral-500">Goal</p>
                      <MoneyValue
                        amount={event.goalAmount}
                        currency={event.currency}
                        align="left"
                        className="text-[20px] leading-7"
                        emphasis="strong"
                      />
                    </div>
                    <div className="text-right">
                      <p className="text-caption text-neutral-500">Confirmed</p>
                      <MoneyValue
                        amount={confirmedTotal}
                        currency={event.currency}
                        className="text-[20px] leading-7"
                        emphasis="strong"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <ProgressBar
                      value={progress}
                      tone={progress >= 100 ? 'success' : 'brand'}
                      label="Goal progress"
                    />
                    <span className="tnum shrink-0 text-body font-semibold text-neutral-900">
                      {formatPercent(progress)}
                    </span>
                  </div>

                  {/* Four-state breakdown — designed for cancelled even though the
                      backend enum lacks it today (§05 backend gap). */}
                  <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-neutral-200 bg-neutral-200 md:grid-cols-4">
                    {(
                      [
                        ['Confirmed', 'succeeded'],
                        ['Pending', 'pending'],
                        ['Failed', 'failed'],
                        ['Cancelled', 'cancelled'],
                      ] as const
                    ).map(([label, status]) => {
                      const txns = byStatus(status);
                      // The backend now models cancelled/refunded, so a zero is
                      // a real zero rather than a missing enum value.
                      const unsupported = false;
                      return (
                        <div key={status} className="bg-neutral-0 p-3">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={status} label={label} dot />
                          </div>
                          <p className="tnum mt-2 text-[16px] font-semibold leading-6 text-neutral-900">
                            {unsupported ? '—' : formatMoney(sumOf(status), event.currency, { showCurrency: false })}
                          </p>
                          <p className="tnum mt-0.5 text-caption text-neutral-500">
                            {`${txns.count} txns`}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <dl className="mt-4 divide-y divide-neutral-200">
                    <DetailRow label="Unique contributors">
                      <span className="tnum">{uniqueContributors}</span>
                    </DetailRow>
                    <DetailRow label="Contribution count">
                      <span className="tnum">{financials?.contributionCount ?? 0}</span>
                    </DetailRow>
                    <DetailRow label="Average contribution">
                      <MoneyValue
                        amount={financials?.averageContribution ?? 0}
                        currency={event.currency}
                      />
                    </DetailRow>
                    <DetailRow label="Median contribution">
                      <MoneyValue amount={medianContribution} currency={event.currency} />
                    </DetailRow>
                    <DetailRow label="Platform fees">
                      <MoneyValue amount={platformFees} currency={event.currency} />
                    </DetailRow>
                    <DetailRow label="Stripe fees">
                      <MoneyValue amount={stripeFees} currency={event.currency} />
                    </DetailRow>
                    <DetailRow label="Net to beneficiary">
                      <MoneyValue
                        amount={confirmedTotal - platformFees - stripeFees}
                        currency={event.currency}
                        emphasis="strong"
                      />
                    </DetailRow>
                  </dl>
                </div>
              </Card>

              <ChartCard
                title="Contribution timeline"
                subtitle="Daily confirmed amount with contribution count · reminder sends marked"
                legend={[
                  { label: 'Amount', color: CHART_COLORS[0] },
                  { label: 'Contribution count', color: CHART_COLORS[2] },
                  { label: 'Reminder sent', color: CHART_COLORS[3] },
                ]}
                tableData={{
                  columns: ['Date', 'Amount', 'Count'],
                  rows: dailySeries.map((d) => [d.date, formatMoney(d.amount, event.currency), d.count]),
                }}
                minHeight={240}
              >
                {dailySeries.length === 0 ? (
                  <EmptyState
                    compact
                    headline="No confirmed contributions yet"
                    description="Once the first payment succeeds, daily volume and count appear here."
                  />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={dailySeries} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => String(v).slice(5)}
                        minTickGap={20}
                      />
                      <YAxis
                        yAxisId="amount"
                        tickLine={false}
                        axisLine={false}
                        width={64}
                        tickFormatter={(v) => formatMoneyCompact(Number(v), event.currency)}
                      />
                      <YAxis yAxisId="count" orientation="right" tickLine={false} axisLine={false} width={28} />
                      <RTooltip
                        content={
                          <ChartTooltip
                            formatter={(v, key) =>
                              key === 'amount' ? formatMoney(v, event.currency) : String(v)
                            }
                          />
                        }
                        cursor={{ fill: 'rgb(var(--neutral-100))' }}
                      />
                      <Bar
                        yAxisId="amount"
                        dataKey="amount"
                        name="Amount"
                        fill={CHART_COLORS[0]}
                        radius={[2, 2, 0, 0]}
                        isAnimationActive={false}
                      />
                      <Line
                        yAxisId="count"
                        type="monotone"
                        dataKey="count"
                        name="Contribution count"
                        stroke={CHART_COLORS[2]}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                      {dailySeries
                        .filter((d) => d.reminder)
                        .map((d) => (
                          <ReferenceDot
                            key={d.date}
                            yAxisId="amount"
                            x={d.date}
                            y={d.amount}
                            r={4}
                            fill={CHART_COLORS[3]}
                            stroke="rgb(var(--neutral-0))"
                            strokeWidth={2}
                          />
                        ))}
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              {/* Participation mini funnel */}
              <Card>
                <div className="border-b border-neutral-200 p-4">
                  <h2 className="text-card-title text-neutral-700">Participation</h2>
                </div>
                <div className="space-y-3 p-4">
                  {[
                    { label: 'Invited', value: participants.length },
                    { label: 'Opened', value: openedCount },
                    { label: 'Contributed', value: contributedCount },
                  ].map((row, i, arr) => (
                    <div key={row.label}>
                      <div className="flex items-center gap-3">
                        <span className="w-[90px] shrink-0 text-body text-neutral-700">{row.label}</span>
                        <div className="relative h-7 flex-1 overflow-hidden rounded-sm bg-neutral-100">
                          <div
                            className="h-full rounded-sm"
                            style={{
                              width: `${(row.value / Math.max(1, arr[0].value)) * 100}%`,
                              backgroundColor: CHART_COLORS[i],
                            }}
                          />
                        </div>
                        <span className="tnum w-[44px] shrink-0 text-right text-body font-medium text-neutral-900">
                          {row.value}
                        </span>
                        <span className="tnum w-[56px] shrink-0 text-right text-caption text-neutral-500">
                          {i === 0
                            ? '100%'
                            : formatPercent((row.value / Math.max(1, arr[i - 1].value)) * 100, 0)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Right rail */}
            <div className="space-y-4">
              <Card>
                <div className="border-b border-neutral-200 p-4">
                  <h2 className="text-card-title text-neutral-700">Withdrawal status</h2>
                </div>
                <dl className="divide-y divide-neutral-200 p-4 pt-0">
                  <DetailRow label="Available balance">
                    <MoneyValue
                      amount={confirmedTotal - platformFees - stripeFees}
                      currency={event.currency}
                    />
                  </DetailRow>
                  <DetailRow label="Requested amount">
                    {event.withdrawalStatus === 'none' ? (
                      <span className="text-neutral-400">—</span>
                    ) : (
                      <MoneyValue amount={Math.round(confirmedTotal * 0.94)} currency={event.currency} />
                    )}
                  </DetailRow>
                  <DetailRow label="State">
                    <StatusBadge status={event.withdrawalStatus} />
                  </DetailRow>
                  <DetailRow label="Stripe Connect">
                    <StatusBadge status={event.stripeAccountStatus} />
                  </DetailRow>
                  <DetailRow label="Payout completed">
                    <span className="tnum">
                      {event.withdrawalStatus === 'completed' && event.closedAt
                        ? formatDateTime(event.closedAt)
                        : '—'}
                    </span>
                  </DetailRow>
                  {event.withdrawalStatus === 'failed' && (
                    <div className="pt-3">
                      <p className="text-caption text-neutral-500">Failure reason (verbatim from Stripe)</p>
                      <p className="mt-1 rounded-sm bg-danger-50 p-2 font-mono text-[13px] leading-5 text-danger-500">
                        account_closed — The bank account has been closed.
                      </p>
                    </div>
                  )}
                </dl>
              </Card>

              <Card>
                <div className="border-b border-neutral-200 p-4">
                  <h2 className="text-card-title text-neutral-700">Event metadata</h2>
                </div>
                <dl className="divide-y divide-neutral-200 p-4 pt-0">
                  <DetailRow label="Currency">{event.currency}</DetailRow>
                  <DetailRow label="Source">
                    <Chip>{event.source}</Chip>
                  </DetailRow>
                  <DetailRow label="Group">{event.groupName ?? '—'}</DetailRow>
                  <DetailRow label="Location">
                    <a
                      href={event.locationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-brand-500 hover:underline"
                    >
                      <MapPin className="h-3 w-3" aria-hidden />
                      {event.location}
                    </a>
                  </DetailRow>
                  <DetailRow label="Fee payer">
                    <Chip>{event.feePayer}</Chip>
                  </DetailRow>
                  <DetailRow label="Share slug">
                    <code className="font-mono text-[13px]">{event.shareSlug}</code>
                  </DetailRow>
                  <div className="pt-3">
                    <p className="text-caption text-neutral-500">Personal message</p>
                    <p className="mt-1 text-body text-neutral-700">{event.personalMessage}</p>
                  </div>
                </dl>
              </Card>

              <Card>
                <div className="border-b border-neutral-200 p-4">
                  <h2 className="text-card-title text-neutral-700">Gift card</h2>
                </div>
                <div className="p-4">
                  {card ? (
                    <>
                      <div
                        className="flex aspect-[3/4] w-full items-center justify-center rounded-md text-[48px]"
                        style={{ backgroundColor: card.bg }}
                      >
                        {card.emojiKey}
                      </div>
                      <p className="mt-3 text-body font-medium text-neutral-900">{card.name}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Chip tone={card.cloverCost > 0 ? 'secondary' : 'neutral'}>
                          {card.cloverCost > 0 ? `🍀 ${card.cloverCost}` : 'FREE'}
                        </Chip>
                        <StatusBadge
                          status={event.cardRevealed ? 'completed' : 'pending'}
                          label={event.cardRevealed ? 'Revealed' : 'Not revealed'}
                        />
                      </div>
                      <Link
                        to={`/cards/catalog/${card.id}`}
                        className="mt-3 inline-flex items-center gap-1 text-caption font-medium text-brand-500 hover:underline"
                      >
                        Open in catalog
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </>
                  ) : (
                    <EmptyState
                      compact
                      headline="No card attached"
                      description="The organizer hasn’t selected a gift-card design for this event yet."
                    />
                  )}
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ------------------------------------------------------- Timeline -- */}
        <TabsContent value="timeline">
          <Card className="p-6">
            <p className="mb-6 text-body text-neutral-500">
              The event’s whole life. Each milestone shows its elapsed time from publication — this is
              where the lifecycle timing metrics come from.
            </p>
            {timeline.length > 0 ? (
              <Timeline entries={timeline} />
            ) : (
              <EmptyState
                headline="No timeline events yet"
                description="Milestones appear as the event is published, invited and funded."
              />
            )}
          </Card>
        </TabsContent>

        {/* -------------------------------------------------- Contributions -- */}
        <TabsContent value="contributions">
          <ContributionsTable
            rows={eventContributions}
            storageKey="event-contributions"
            hideEventColumn
            toolbar={
              <ExportButton
                name={`contributions-${event.shareSlug}`}
                label="Contributions"
                columns={contributionColumns}
                rows={eventContributions}
                containsPii
                size="sm"
                filterSummary={`Event ${event.name} · ${eventContributions.length} contributions`}
              />
            }
          />
        </TabsContent>

        {/* --------------------------------------------------- Participants -- */}
        <TabsContent value="participants">
          <ParticipantsTable participants={participants} />
        </TabsContent>

        {/* ----------------------------------------------------------- Card -- */}
        <TabsContent value="card">
          {card ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="p-4">
                <div
                  className="flex aspect-[3/4] w-full items-center justify-center rounded-md text-[72px]"
                  style={{ backgroundColor: card.bg }}
                >
                  {card.emojiKey}
                </div>
              </Card>
              <Card className="lg:col-span-2">
                <div className="border-b border-neutral-200 p-4">
                  <h2 className="text-card-title text-neutral-700">Card performance for this event</h2>
                </div>
                <dl className="divide-y divide-neutral-200 p-4 pt-0">
                  <DetailRow label="Template name">{card.name}</DetailRow>
                  <DetailRow label="Type">
                    <Chip tone={card.cloverCost > 0 ? 'secondary' : 'neutral'}>
                      {card.cloverCost > 0 ? 'Premium' : 'Standard'}
                    </Chip>
                  </DetailRow>
                  <DetailRow label="Clover cost paid">
                    {eventCard?.cloverCostPaid ? `🍀 ${eventCard.cloverCostPaid}` : '—'}
                  </DetailRow>
                  <DetailRow label="Revealed">
                    {eventCard?.revealed ? (
                      <span className="tnum">{formatDateTime(eventCard.revealedAt)}</span>
                    ) : (
                      <StatusBadge status="pending" label="Not revealed" />
                    )}
                  </DetailRow>
                  <DetailRow label="Unique downloads">
                    <span className="tnum">{eventCard?.uniqueDownloads ?? 0}</span>
                  </DetailRow>
                  <DetailRow label="Total downloads">
                    <span className="tnum">{eventCard?.totalDownloads ?? 0}</span>
                  </DetailRow>
                  <DetailRow label="Unique downloaders">
                    <span className="tnum">{eventCard?.uniqueDownloaders ?? 0}</span>
                  </DetailRow>
                  <DetailRow label="Time to first view">
                    <span className="tnum">
                      {eventCard?.timeToFirstViewHours != null
                        ? formatDuration(eventCard.timeToFirstViewHours)
                        : '—'}
                    </span>
                  </DetailRow>
                  <DetailRow label="Time to first download">
                    <span className="tnum">
                      {eventCard?.timeToFirstDownloadHours != null
                        ? formatDuration(eventCard.timeToFirstDownloadHours)
                        : '—'}
                    </span>
                  </DetailRow>
                  <DetailRow label="Card error events">
                    {eventCard?.errors?.length ? (
                      <span className="text-danger-500">
                        {eventCard.errors.length} — {eventCard.errors[0].type}
                      </span>
                    ) : (
                      <span className="text-neutral-400">None</span>
                    )}
                  </DetailRow>
                </dl>
              </Card>
            </div>
          ) : (
            <EmptyState
              headline="No card attached to this event"
              description="The organizer hasn’t selected a gift-card design. Card metrics appear once one is chosen."
              action={{ label: 'Browse catalog', href: '/cards/catalog' }}
            />
          )}
        </TabsContent>

        {/* ------------------------------------------------------- Activity -- */}
        <TabsContent value="activity">
          <ActivityLog entries={eventAudit} />
        </TabsContent>
      </Tabs>

      {confirm && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirm(null)}
          title={confirm.title}
          consequence={confirm.consequence}
          confirmLabel={confirm.title}
          requireReason
          requireTypedConfirmation={confirm.typed}
          onConfirm={runAdminAction}
        />
      )}
    </>
  );
}

function ParticipantsTable({ participants }: { participants: Participant[] }) {
  const [filter, setFilter] = React.useState<'all' | 'contributed' | 'not' | 'opened_not'>('all');

  const rows = participants.filter((p) => {
    if (filter === 'contributed') return p.contributed;
    if (filter === 'not') return !p.contributed;
    if (filter === 'opened_not') return Boolean(p.openedAt) && !p.contributed;
    return true;
  });

  const columns: Column<Participant>[] = [
    {
      id: 'user',
      header: 'User',
      cell: (p) => (
        <Link
          to={`/users/${p.user.id}`}
          data-no-row-click
          className="flex items-center gap-2 rounded-sm transition-colors hover:text-brand-500"
        >
          <Avatar name={p.user.name} color={p.user.avatarColor} size="sm" />
          <span className="truncate">{p.user.name}</span>
        </Link>
      ),
    },
    {
      id: 'invitedAt',
      header: 'Invited at',
      sortable: true,
      sortValue: (p) => p.invitedAt,
      cell: (p) => <span className="tnum">{formatDate(p.invitedAt)}</span>,
    },
    {
      id: 'openedAt',
      header: 'Opened at',
      sortable: true,
      sortValue: (p) => p.openedAt ?? '',
      cell: (p) =>
        p.openedAt ? <span className="tnum">{formatDate(p.openedAt)}</span> : <span className="text-neutral-400">Not opened</span>,
    },
    {
      id: 'contributed',
      header: 'Contributed',
      cell: (p) => (
        <StatusBadge
          status={p.contributed ? 'completed' : 'inactive'}
          label={p.contributed ? 'Yes' : 'No'}
        />
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      numeric: true,
      sortable: true,
      sortValue: (p) => p.amount ?? 0,
      cell: (p) => (p.amount ? <MoneyValue amount={p.amount} showCurrency={false} /> : <span className="text-neutral-400">—</span>),
    },
    {
      id: 'decision',
      header: 'Decision time',
      numeric: true,
      sortable: true,
      sortValue: (p) => p.decisionTimeHours ?? Infinity,
      cell: (p) =>
        p.decisionTimeHours != null ? (
          <span className="tnum">{formatDuration(p.decisionTimeHours)}</span>
        ) : (
          <span className="text-neutral-400">—</span>
        ),
    },
    {
      id: 'payment',
      header: 'Payment status',
      cell: (p) => (p.paymentStatus ? <StatusBadge status={p.paymentStatus} /> : <span className="text-neutral-400">—</span>),
    },
    {
      id: 'reminders',
      header: 'Reminders',
      numeric: true,
      sortable: true,
      sortValue: (p) => p.remindersReceived,
      cell: (p) => <span className="tnum">{p.remindersReceived}</span>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(p) => p.id}
      storageKey="participants"
      toolbar={
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter participants">
          {(
            [
              ['all', 'All'],
              ['contributed', 'Contributed'],
              ['not', 'Not contributed'],
              ['opened_not', 'Opened, not contributed'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              aria-pressed={filter === id}
              className={cn(
                'rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                filter === id
                  ? 'bg-brand-50 text-brand-500'
                  : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      }
      empty={{
        headline: 'No participants in this view',
        description: 'Switch the filter above, or invite more people from the mobile app.',
      }}
    />
  );
}

/** Every admin action taken on this event: who, what, when, before → after. */
export function ActivityLog({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return (
      <Card>
        <EmptyState
          headline="No admin actions on this record"
          description="Status overrides, manual interventions and financial adjustments will appear here with before → after values."
        />
      </Card>
    );
  }

  return (
    <Card>
      <ul className="divide-y divide-neutral-200">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-start gap-4 p-4">
            <Avatar name={entry.admin.name} color={entry.admin.avatarColor} size="sm" />
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
            <div className="shrink-0 text-right">
              <p className="tnum text-caption text-neutral-500">{formatDateTime(entry.timestamp)}</p>
              <p className="text-caption text-neutral-400">{formatRelative(entry.timestamp)}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
