import { Trans, useTranslation } from 'react-i18next';
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
import { useAlerts, useAdmins, useAlertTypes } from '@/hooks/data';
import { useUrlState } from '@/hooks/useUrlState';
import { formatDateTime, formatRelative } from '@/lib/format';
import type { Alert, AlertType } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Screen 12 — Alerts Center (§12).
 * Every threshold below is admin-configurable in Settings, never hardcoded.
 */

/** Icons are presentation, not data — everything else comes from /alerts/types. */
const ALERT_ICONS: Record<AlertType, LucideIcon> = {
  stagnant_event: Clock,
  at_risk_event: TrendingDown,
  inactive_event: Bell,
  payment_friction: CreditCard,
  unrevealed_card: Gift,
  premium_card_unused: Sparkles,
  withdrawal_pending: Wallet,
  clover_anomaly: AlertTriangle,
};

/**
 * Suggested next steps per type — UI copy the API doesn't model. Values are
 * translation keys under `alerts.action.*` so the buttons follow the language.
 */
const ALERT_ACTIONS: Record<AlertType, string[]> = {
  stagnant_event: ['reviewSetup', 'promptOrganizer'],
  at_risk_event: ['triggerReminder', 'notifyOrganizer'],
  inactive_event: ['nudgeOrganizer'],
  payment_friction: ['investigatePayment', 'openTicket'],
  unrevealed_card: ['reviewFulfillment'],
  premium_card_unused: ['reviewCardValue', 'messageUser'],
  withdrawal_pending: ['followUpBeneficiary', 'escalateOps'],
  clover_anomaly: ['operationalReview'],
};

/** Snooze presets — id is what the API takes, the label is translated. */
const SNOOZE_OPTIONS = [
  { id: '24h', key: 'alerts.snoozeOptions.24h' },
  { id: '7d', key: 'alerts.snoozeOptions.7d' },
  { id: 'custom', key: 'alerts.snoozeOptions.custom' },
] as const;

export default function Alerts() {
  const { t } = useTranslation();
  const { all, set } = useUrlState();
  const { toast } = useToast();
  const { can } = useAuth();
  const { admins: adminUsers } = useAdmins();
  const { rows: alerts } = useAlerts({});
  const alertTypes = useAlertTypes();
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

  const typeMeta = (type: AlertType) => alertTypes.find((x) => x.type === type);
  // The API's own label is the fallback when a type has no translation yet.
  const typeLabel = (type: AlertType) =>
    t(`alertType.${type}`, {
      defaultValue:
        typeMeta(type)?.label ??
        type.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '),
    });
  const countByType = (type: AlertType) => typeMeta(type)?.openCount ?? 0;
  const totalOpen = alerts.filter((a) => a.status === 'open').length;

  return (
    <>
      <PageHeader
        title={t('alerts.title')}
        subtitle={t('alerts.subtitle', { count: totalOpen })}
        actions={
          can('settings:write') && (
            <Button variant="secondary" asChild>
              <Link to="/settings">
                <Settings2 className="h-4 w-4 text-neutral-400" />
                {t('alerts.tuneThresholds')}
              </Link>
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Left rail — alert types with unread counts */}
        <nav aria-label={t('alerts.typesNav')}>
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
              {t('alerts.allAlerts')}
              <span className="tnum rounded-full bg-neutral-100 px-1.5 text-[11px] font-semibold text-neutral-700">
                {totalOpen}
              </span>
            </button>
            {alertTypes.map(({ type }) => {
              const count = countByType(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => set({ type })}
                  className={cn(
                    'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-2 text-[13px] font-medium transition-colors',
                    selectedType === type
                      ? 'border-brand-300 bg-brand-50 text-brand-500'
                      : 'border-neutral-200 bg-neutral-0 text-neutral-700',
                  )}
                >
                  {typeLabel(type)}
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
              <span className="text-body font-medium">{t('alerts.allAlerts')}</span>
              <span className="tnum rounded-full bg-neutral-100 px-2 py-px text-caption font-semibold text-neutral-700">
                {totalOpen}
              </span>
            </button>
            <ul>
              {alertTypes.map(({ type }) => {
                const Icon = ALERT_ICONS[type];
                const count = countByType(type);
                const active = selectedType === type;
                return (
                  <li key={type}>
                    <button
                      type="button"
                      onClick={() => set({ type })}
                      className={cn(
                        'flex w-full items-center gap-3 border-b border-neutral-200 px-4 py-3 text-left transition-colors last:border-0',
                        active ? 'bg-brand-50 text-brand-500' : 'text-neutral-700 hover:bg-neutral-100',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-body">{typeLabel(type)}</span>
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
              <h2 className="text-card-title text-neutral-700">{typeLabel(selectedType)}</h2>
              <p className="mt-1 text-caption text-neutral-500">
                <strong>{t('alerts.currentTrigger')}</strong>{' '}
                {typeMeta(selectedType)?.currentTrigger ??
                  typeMeta(selectedType)?.defaultTrigger ??
                  '—'}
              </p>
              <p className="mt-1 text-caption text-neutral-500">
                <strong>{t('alerts.actionsOffered')}</strong>{' '}
                {ALERT_ACTIONS[selectedType].map((a) => t(`alerts.action.${a}`)).join(' · ')}
              </p>
            </div>
          )}

          {rows.length === 0 ? (
            <Card>
              <EmptyState
                icon={Bell}
                headline={t('alerts.empty')}
                description={
                  selectedType
                    ? t('alerts.emptyFiltered', { type: typeLabel(selectedType).toLowerCase() })
                    : t('alerts.emptyAll')
                }
                action={{ label: t('alerts.reviewThresholds'), href: '/settings' }}
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
                      {t('alerts.severity')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-table-header uppercase text-neutral-500">
                      {t('alerts.subject')}
                    </th>
                    <th scope="col" className="hidden px-4 py-3 text-left text-table-header uppercase text-neutral-500 md:table-cell">
                      {t('alerts.triggered')}
                    </th>
                    <th scope="col" className="hidden px-4 py-3 text-left text-table-header uppercase text-neutral-500 lg:table-cell">
                      {t('alerts.assigned')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-table-header uppercase text-neutral-500">
                      {t('fields.status')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-table-header uppercase text-neutral-500">
                      {t('fields.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((alert, i) => {
                    const Icon = ALERT_ICONS[alert.type];
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
                              label={
                                alert.severity === 'danger'
                                  ? t('alerts.critical')
                                  : alert.severity === 'warning'
                                    ? t('alerts.warning')
                                    : t('alerts.info')
                              }
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
                              <Icon className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                              <span className="min-w-0">
                                <span className="block text-body font-medium text-neutral-900">
                                  {typeLabel(alert.type)}
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
                              <span className="text-body text-neutral-400">
                                {t('alerts.unassigned')}
                              </span>
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
                                    {t('fields.actions')}
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[220px]">
                                  <DropdownMenuItem
                                    disabled={alert.status === 'acknowledged'}
                                    onSelect={() => {
                                      void mutations.acknowledgeAlert(alert.id);
                                      toast({
                                        title: t('alerts.acknowledged'),
                                        description: alert.subject.label,
                                        tone: 'success',
                                      });
                                    }}
                                  >
                                    {t('alerts.acknowledge')}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel>{t('alerts.assignTo')}</DropdownMenuLabel>
                                  {adminUsers.slice(0, 3).map((a) => (
                                    <DropdownMenuItem
                                      key={a.id}
                                      onSelect={() => {
                                        void mutations.assignAlert(alert.id, a.id);
                                        toast({
                                          title: t('alerts.assignedTo', { name: a.name }),
                                          description: alert.subject.label,
                                          tone: 'success',
                                        });
                                      }}
                                    >
                                      {a.name}
                                    </DropdownMenuItem>
                                  ))}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel>{t('alerts.snooze')}</DropdownMenuLabel>
                                  {SNOOZE_OPTIONS.map((option) => (
                                    <DropdownMenuItem
                                      key={option.id}
                                      onSelect={() => {
                                        void mutations.snoozeAlert(
                                          alert.id,
                                          option.id as '1h' | '24h' | '7d',
                                        );
                                        toast({
                                          title: t('alerts.snoozedFor', {
                                            duration: t(option.key),
                                          }),
                                          description: alert.subject.label,
                                          tone: 'info',
                                        });
                                      }}
                                    >
                                      {t(option.key)}
                                    </DropdownMenuItem>
                                  ))}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onSelect={() => setResolving(alert)}>
                                    {t('alerts.resolveWithNote')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem destructive onSelect={() => setDismissing(alert)}>
                                    <XCircle className="h-4 w-4" />
                                    {t('alerts.dismissFalsePositive')}
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
                                  {t('alerts.evidenceIntro')}
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
                                    <Link to={alert.subject.href}>
                                      {t('alerts.openSubject', { label: alert.subject.label })}
                                    </Link>
                                  </Button>
                                  {ALERT_ACTIONS[alert.type].map((a: string) => (
                                    <Button
                                      key={a}
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        toast({
                                          title: t(`alerts.action.${a}`),
                                          description: alert.subject.label,
                                          tone: 'info',
                                        })
                                      }
                                    >
                                      {t(`alerts.action.${a}`)}
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
          title={t('alerts.resolveTitle')}
          tone="primary"
          requireReason
          consequence={
            <Trans
              i18nKey="alerts.resolveConsequence"
              values={{ type: typeLabel(resolving.type), subject: resolving.subject.label }}
              components={[<strong key="0" />, <span key="1" />, <strong key="2" />]}
            />
          }
          confirmLabel={t('alerts.resolveConfirm')}
          onConfirm={(reason) => {
            void mutations.resolveAlert(resolving.id, reason);
            toast({
              title: t('alerts.resolved'),
              description: resolving.subject.label,
              tone: 'success',
            });
          }}
        />
      )}

      {dismissing && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDismissing(null)}
          title={t('alerts.dismissTitle')}
          requireReason
          consequence={
            <Trans
              i18nKey="alerts.dismissConsequence"
              values={{ type: typeLabel(dismissing.type) }}
              components={[<span key="0" />, <strong key="1" />]}
            />
          }
          confirmLabel={t('alerts.dismissConfirm')}
          onConfirm={(reason) => {
            void mutations.dismissAlert(dismissing.id, reason);
            toast({
              title: t('alerts.dismissed'),
              description: t('alerts.dismissedBody'),
              tone: 'success',
            });
          }}
        />
      )}
    </>
  );
}
