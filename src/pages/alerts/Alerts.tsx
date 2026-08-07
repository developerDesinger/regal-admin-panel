import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  Clock,
  CreditCard,
  Gift,
  Settings2,
  Sparkles,
  TrendingDown,
  Wallet,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { useAdminMutations } from '@/hooks/data/mutations';
import { useAlerts, useAdmins } from '@/hooks/data';
import { useUrlState } from '@/hooks/useUrlState';
import { formatDateTime, formatRelative } from '@/lib/format';
import type { Alert, AlertType } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Screen 12 — Alerts Center (§12).
 * Every threshold below is admin-configurable in Settings, never hardcoded.
 */

const ALERT_META: Record<
  AlertType,
  { label: string; icon: LucideIcon; trigger: string; actions: string[] }
> = {
  stagnant_event: {
    label: 'Stagnant Event',
    icon: Clock,
    trigger: 'No confirmed contribution 72h after publication',
    actions: ['Review setup', 'Prompt organizer to send reminders'],
  },
  at_risk_event: {
    label: 'At-Risk Event',
    icon: TrendingDown,
    trigger: 'Goal progress < 40% with < 48h remaining',
    actions: ['Trigger reminder', 'Notify organizer'],
  },
  inactive_event: {
    label: 'Inactive Event',
    icon: Bell,
    trigger: 'No contribution activity for 7 days',
    actions: ['Nudge organizer'],
  },
  payment_friction: {
    label: 'Payment Friction',
    icon: CreditCard,
    trigger: 'Failed + pending rate > 15% on an event, or > 10% platform-wide in 24h',
    actions: ['Investigate payment flow', 'Open support ticket'],
  },
  unrevealed_card: {
    label: 'Unrevealed Card',
    icon: Gift,
    trigger: 'Event closed/due but card not revealed after 48h',
    actions: ['Review fulfillment flow'],
  },
  premium_card_unused: {
    label: 'Premium Card Not Used',
    icon: Sparkles,
    trigger: 'Premium card redeemed but not revealed/downloaded after 7 days',
    actions: ['Review card value', 'Message user'],
  },
  withdrawal_pending: {
    label: 'Withdrawal Pending',
    icon: Wallet,
    trigger: 'Funds available but withdrawal not started/completed after 72h',
    actions: ['Follow up with beneficiary', 'Escalate to ops'],
  },
  clover_anomaly: {
    label: 'Clover Anomaly',
    icon: AlertTriangle,
    trigger: 'Earn/adjust/redeem volume > 3× the user’s 30-day baseline',
    actions: ['Authorized operational/security review'],
  },
};

const ALERT_TYPES = Object.keys(ALERT_META) as AlertType[];

export default function Alerts() {
  const { all, set } = useUrlState();
  const { toast } = useToast();
  const { can } = useAuth();
  const { admins: adminUsers } = useAdmins();
  const { rows: alerts } = useAlerts({});
  const mutations = useAdminMutations();
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [resolving, setResolving] = React.useState<Alert | null>(null);
  const [dismissing, setDismissing] = React.useState<Alert | null>(null);

  const selectedType = all.type as AlertType | undefined;
  const rows = alerts.filter((a) => {
    if (selectedType && a.type !== selectedType) return false;
    if (all.state && all.state !== 'all' && a.status !== all.state) return false;
    return true;
  });

  const countByType = (t: AlertType) =>
    alerts.filter((a) => a.type === t && a.status === 'open').length;
  const totalOpen = alerts.filter((a) => a.status === 'open').length;

  return (
    <>
      <PageHeader
        title="Alerts Center"
        subtitle={`${totalOpen} open alerts. Every threshold here is configurable in Settings — nothing is hardcoded.`}
        actions={
          can('settings:write') && (
            <Button variant="secondary" asChild>
              <Link to="/settings">
                <Settings2 className="h-4 w-4 text-neutral-400" />
                Tune thresholds
              </Link>
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Left rail — alert types with unread counts */}
        <nav aria-label="Alert types">
          {/* Below lg the rail would be a very tall list — scroll it sideways instead */}
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:hidden">
            <button
              type="button"
              onClick={() => set({ type: null })}
              className={cn(
                'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-2 text-[13px] font-medium transition-colors',
                !selectedType
                  ? 'border-brand-300 bg-brand-50 text-brand-500'
                  : 'border-neutral-200 bg-neutral-0 text-neutral-700',
              )}
            >
              All alerts
              <span className="tnum rounded-full bg-neutral-100 px-1.5 text-[11px] font-semibold text-neutral-700">
                {totalOpen}
              </span>
            </button>
            {ALERT_TYPES.map((t) => {
              const count = countByType(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => set({ type: t })}
                  className={cn(
                    'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-2 text-[13px] font-medium transition-colors',
                    selectedType === t
                      ? 'border-brand-300 bg-brand-50 text-brand-500'
                      : 'border-neutral-200 bg-neutral-0 text-neutral-700',
                  )}
                >
                  {ALERT_META[t].label}
                  {count > 0 && (
                    <span className="tnum rounded-full bg-danger-500 px-1.5 text-[11px] font-semibold text-white">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <Card className="hidden overflow-hidden lg:block">
            <button
              type="button"
              onClick={() => set({ type: null })}
              className={cn(
                'flex w-full items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3 text-left transition-colors',
                !selectedType ? 'bg-brand-50 text-brand-500' : 'text-neutral-700 hover:bg-neutral-100',
              )}
            >
              <span className="text-body font-medium">All alerts</span>
              <span className="tnum rounded-full bg-neutral-100 px-2 py-px text-caption font-semibold text-neutral-700">
                {totalOpen}
              </span>
            </button>
            <ul>
              {ALERT_TYPES.map((t) => {
                const meta = ALERT_META[t];
                const Icon = meta.icon;
                const count = countByType(t);
                const active = selectedType === t;
                return (
                  <li key={t}>
                    <button
                      type="button"
                      onClick={() => set({ type: t })}
                      className={cn(
                        'flex w-full items-center gap-3 border-b border-neutral-200 px-4 py-3 text-left transition-colors last:border-0',
                        active ? 'bg-brand-50 text-brand-500' : 'text-neutral-700 hover:bg-neutral-100',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-body">{meta.label}</span>
                      {count > 0 && (
                        <span className="tnum shrink-0 rounded-full bg-danger-500 px-1.5 py-px text-[11px] font-semibold text-white">
                          {count}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </nav>

        {/* Main area — individual alert instances */}
        <div>
          {selectedType && (
            <div className="mb-4 rounded-md border border-neutral-200 bg-neutral-0 p-4">
              <h2 className="text-card-title text-neutral-700">{ALERT_META[selectedType].label}</h2>
              <p className="mt-1 text-caption text-neutral-500">
                <strong>Default trigger:</strong> {ALERT_META[selectedType].trigger}
              </p>
              <p className="mt-1 text-caption text-neutral-500">
                <strong>Actions offered:</strong> {ALERT_META[selectedType].actions.join(' · ')}
              </p>
            </div>
          )}

          {rows.length === 0 ? (
            <Card>
              <EmptyState
                icon={Bell}
                headline="Nothing needs attention here"
                description={
                  selectedType
                    ? `No ${ALERT_META[selectedType].label.toLowerCase()} alerts are currently firing. Thresholds can be tuned in Settings.`
                    : 'No alerts are firing across the platform right now.'
                }
                action={{ label: 'Review thresholds', href: '/settings' }}
              />
            </Card>
          ) : (
            <Card className="overflow-hidden">
              {/* scrolls inside its own container, never the page body (§2.5) */}
              <div className="scroll-x">
              <table className="w-full border-collapse">
                <thead className="bg-neutral-50">
                  <tr className="border-b border-neutral-200">
                    <th scope="col" className="hidden px-4 py-3 text-left text-table-header uppercase text-neutral-500 sm:table-cell">
                      Severity
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-table-header uppercase text-neutral-500">
                      Subject
                    </th>
                    <th scope="col" className="hidden px-4 py-3 text-left text-table-header uppercase text-neutral-500 md:table-cell">
                      Triggered
                    </th>
                    <th scope="col" className="hidden px-4 py-3 text-left text-table-header uppercase text-neutral-500 lg:table-cell">
                      Assigned
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-table-header uppercase text-neutral-500">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-table-header uppercase text-neutral-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((alert, i) => {
                    const meta = ALERT_META[alert.type];
                    const isOpen = expanded === alert.id;
                    return (
                      <React.Fragment key={alert.id}>
                        <tr
                          className={cn(
                            'border-b border-neutral-200 transition-colors',
                            i % 2 === 1 && !isOpen && 'bg-neutral-50',
                            isOpen && 'bg-brand-50',
                          )}
                        >
                          <td className="hidden px-4 py-3 sm:table-cell">
                            <StatusBadge
                              status={alert.severity === 'danger' ? 'failed' : alert.severity === 'warning' ? 'pending' : 'active'}
                              label={alert.severity === 'danger' ? 'Critical' : alert.severity === 'warning' ? 'Warning' : 'Info'}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setExpanded(isOpen ? null : alert.id)}
                              aria-expanded={isOpen}
                              className="flex w-full items-center gap-2 rounded-sm text-left"
                            >
                              <ChevronRight
                                className={cn(
                                  'h-3 w-3 shrink-0 text-neutral-400 transition-transform duration-micro',
                                  isOpen && 'rotate-90',
                                )}
                                aria-hidden
                              />
                              <span className="min-w-0">
                                <span className="block text-body font-medium text-neutral-900">
                                  {meta.label}
                                </span>
                                <span className="block truncate text-caption text-neutral-500">
                                  {alert.subject.label}
                                </span>
                              </span>
                            </button>
                          </td>
                          <td className="hidden px-4 py-3 md:table-cell">
                            <span className="tnum block whitespace-nowrap text-body text-neutral-700">
                              {formatRelative(alert.triggeredAt)}
                            </span>
                            <span className="tnum block text-caption text-neutral-400">
                              {formatDateTime(alert.triggeredAt)}
                            </span>
                          </td>
                          <td className="hidden px-4 py-3 lg:table-cell">
                            {alert.assignedTo ? (
                              <span className="text-body text-neutral-700">{alert.assignedTo}</span>
                            ) : (
                              <span className="text-body text-neutral-400">Unassigned</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={alert.status} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            {can('alerts:manage') && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="secondary" size="sm">
                                    Actions
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[220px]">
                                  <DropdownMenuItem
                                    disabled={alert.status === 'acknowledged'}
                                    onSelect={() => {
                                      void mutations.acknowledgeAlert(alert.id);
                                      toast({ title: 'Alert acknowledged', description: alert.subject.label, tone: 'success' });
                                    }}
                                  >
                                    Acknowledge
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel>Assign to</DropdownMenuLabel>
                                  {adminUsers.slice(0, 3).map((a) => (
                                    <DropdownMenuItem
                                      key={a.id}
                                      onSelect={() => {
                                        void mutations.assignAlert(alert.id, a.id);
                                        toast({ title: `Assigned to ${a.name}`, description: alert.subject.label, tone: 'success' });
                                      }}
                                    >
                                      {a.name}
                                    </DropdownMenuItem>
                                  ))}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel>Snooze</DropdownMenuLabel>
                                  {['24 hours', '7 days', 'Custom…'].map((s) => (
                                    <DropdownMenuItem
                                      key={s}
                                      onSelect={() => {
                                        void mutations.snoozeAlert(alert.id, s as '1h' | '24h' | '7d');
                                        toast({ title: `Snoozed for ${s}`, description: alert.subject.label, tone: 'info' });
                                      }}
                                    >
                                      {s}
                                    </DropdownMenuItem>
                                  ))}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onSelect={() => setResolving(alert)}>
                                    Resolve with note
                                  </DropdownMenuItem>
                                  <DropdownMenuItem destructive onSelect={() => setDismissing(alert)}>
                                    <XCircle className="h-4 w-4" />
                                    Dismiss as false positive
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </td>
                        </tr>

                        {/* Expanded row shows the triggering evidence (§12) */}
                        {isOpen && (
                          <tr className="border-b border-neutral-200 bg-brand-50">
                            <td colSpan={6} className="px-4 pb-4 pt-0">
                              <div className="rounded-md border border-neutral-200 bg-neutral-0 p-4">
                                <p className="mb-3 text-caption text-neutral-500">
                                  Evidence that fired this rule — no need to go verify it manually.
                                </p>
                                <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                  {alert.evidence.map((ev) => (
                                    <div key={ev.label} className="flex items-baseline justify-between gap-4">
                                      <dt className="text-caption text-neutral-500">{ev.label}</dt>
                                      <dd className="tnum text-body font-medium text-neutral-900">
                                        {ev.value}
                                      </dd>
                                    </div>
                                  ))}
                                </dl>
                                <div className="mt-4 flex flex-wrap gap-2">
                                  <Button variant="secondary" size="sm" asChild>
                                    <Link to={alert.subject.href}>Open {alert.subject.label}</Link>
                                  </Button>
                                  {meta.actions.map((a) => (
                                    <Button
                                      key={a}
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => toast({ title: a, description: alert.subject.label, tone: 'info' })}
                                    >
                                      {a}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </Card>
          )}
        </div>
      </div>

      {resolving && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setResolving(null)}
          title="Resolve this alert"
          tone="primary"
          requireReason
          consequence={
            <>
              <strong>{ALERT_META[resolving.type].label}</strong> for{' '}
              <strong>{resolving.subject.label}</strong> will be closed. If the underlying condition
              still holds, the rule will fire again on the next evaluation.
            </>
          }
          confirmLabel="Resolve"
          onConfirm={(reason) => {
            void mutations.resolveAlert(resolving.id, reason);
            toast({ title: 'Alert resolved', description: resolving.subject.label, tone: 'success' });
          }}
        />
      )}

      {dismissing && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDismissing(null)}
          title="Dismiss as false positive"
          requireReason
          consequence={
            <>
              This closes the alert and feeds threshold tuning — repeated false positives on{' '}
              <strong>{ALERT_META[dismissing.type].label}</strong> are a signal that its threshold is
              set too tightly in Settings.
            </>
          }
          confirmLabel="Dismiss"
          onConfirm={(reason) => {
            void mutations.dismissAlert(dismissing.id, reason);
            toast({
              title: 'Dismissed as false positive',
              description: 'Feeds threshold tuning in Settings.',
              tone: 'success',
            });
          }}
        />
      )}
    </>
  );
}
