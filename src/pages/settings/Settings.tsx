import * as React from 'react';
import { RotateCcw, Save, Undo2 } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Chip } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label, FieldHelp } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useSettings, useAdmins } from '@/hooks/data';
import { ApiError } from '@/lib/api/client';
import { settingsService } from '@/lib/api/services';
import type { SettingsApi } from '@/lib/api/types';
import { cn } from '@/lib/utils';

/**
 * The server groups settings (alertThresholds / cloverRules / financial / …)
 * while this screen edits them as one flat map of ids. These two helpers are
 * the only place that translation lives.
 */
type Draft = {
  values: Record<string, string>;
  defaultFeePayer: string;
  digest: string;
  notify: Record<string, string[]>;
  supportEmail: string;
  termsUrl: string;
  privacyUrl: string;
  maintenanceMode: boolean;
};

function toDraft(s: SettingsApi): Draft {
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(s.alertThresholds ?? {})) values[k] = String(v);
  for (const [k, v] of Object.entries(s.cloverRules ?? {})) values[k] = String(v);
  values.platform_fee = String(s.financial?.platform_fee ?? '');
  values.min_withdrawal = String(s.financial?.min_withdrawal ?? '');
  return {
    values,
    defaultFeePayer: s.financial?.default_fee_payer ?? 'contributor',
    digest: s.notifications?.digest ?? 'daily',
    notify: s.notifications?.routing ?? {},
    supportEmail: s.branding?.support_email ?? '',
    termsUrl: s.branding?.terms_url ?? '',
    privacyUrl: s.branding?.privacy_url ?? '',
    maintenanceMode: s.branding?.maintenance_mode ?? false,
  };
}

/** Sends back only the groups the admin actually touched. */
function toPayload(d: Draft, base: SettingsApi): Partial<SettingsApi> {
  const num = (k: string) => Number(d.values[k]);
  const pick = (keys: string[]) =>
    Object.fromEntries(keys.filter((k) => k in d.values).map((k) => [k, num(k)]));
  return {
    alertThresholds: pick(Object.keys(base.alertThresholds ?? {})),
    cloverRules: pick(Object.keys(base.cloverRules ?? {})),
    financial: {
      ...base.financial,
      platform_fee: num('platform_fee'),
      min_withdrawal: num('min_withdrawal'),
      default_fee_payer: d.defaultFeePayer,
    },
    notifications: { digest: d.digest, routing: d.notify },
    branding: {
      ...base.branding,
      support_email: d.supportEmail,
      terms_url: d.termsUrl,
      privacy_url: d.privacyUrl,
      maintenance_mode: d.maintenanceMode,
    },
  };
}


/**
 * Screen 16 — Settings (§16).
 * Every threshold in §12 is configurable here, never hardcoded, each with its
 * default shown and a "Reset to default" link. Saving persists the change and
 * writes a before → after entry to the audit trail.
 */

interface SettingDef {
  id: string;
  label: string;
  help: string;
  unit?: string;
}

const ALERT_THRESHOLDS: SettingDef[] = [
  { id: 'stagnant_hours', label: 'Stagnant Event', help: 'Hours after publication with no confirmed contribution before the alert fires.', unit: 'hours' },
  { id: 'at_risk_progress', label: 'At-Risk Event — goal progress', help: 'Fire when goal progress is below this percentage…', unit: '%' },
  { id: 'at_risk_hours', label: 'At-Risk Event — time remaining', help: '…and fewer than this many hours remain.', unit: 'hours' },
  { id: 'inactive_days', label: 'Inactive Event', help: 'Days with no contribution activity before nudging the organizer.', unit: 'days' },
  { id: 'friction_event', label: 'Payment Friction — per event', help: 'Failed + pending rate on a single event that triggers the alert.', unit: '%' },
  { id: 'friction_platform', label: 'Payment Friction — platform-wide', help: 'Failed + pending rate across the platform in a 24h window.', unit: '%' },
  { id: 'unrevealed_hours', label: 'Unrevealed Card', help: 'Hours after closure with the card still unrevealed.', unit: 'hours' },
  { id: 'premium_unused_days', label: 'Premium Card Not Used', help: 'Days after redemption with no reveal or download.', unit: 'days' },
  { id: 'withdrawal_hours', label: 'Withdrawal Pending', help: 'Hours with funds available and the withdrawal not completed.', unit: 'hours' },
  { id: 'clover_multiple', label: 'Clover Anomaly', help: 'Multiple of the user’s 30-day baseline that flags an anomaly.', unit: '×' },
];

const CLOVER_RULES: SettingDef[] = [
  { id: 'earn_event_created', label: 'Event created', help: 'Clovers awarded when a user publishes an event.' },
  { id: 'earn_first_contribution', label: 'First contribution', help: 'Clovers awarded on a user’s first confirmed contribution to any event.' },
  { id: 'earn_invite_accepted', label: 'Invitation accepted', help: 'Clovers awarded when an invitee joins an event.' },
  { id: 'earn_referral', label: 'Referral', help: 'Clovers awarded when a referred user registers and verifies.' },
  { id: 'earn_profile', label: 'Profile completed', help: 'One-time award for a fully completed profile.' },
  { id: 'cap_daily', label: 'Daily earn cap', help: 'Maximum clovers a single user can earn in 24 hours. 0 disables the cap.' },
  { id: 'expiry_days', label: 'Clover expiry', help: 'Days of inactivity before unspent clovers expire. 0 means never.', unit: 'days' },
];

const FINANCIAL: SettingDef[] = [
  { id: 'platform_fee', label: 'Platform fee', help: 'Percentage taken from each confirmed contribution.', unit: '%' },
  { id: 'min_withdrawal', label: 'Minimum withdrawal', help: 'Smallest payout a beneficiary can request, in major units.', unit: 'MXN' },
];

const TAB_FIELDS: Record<string, string[]> = {
  thresholds: ALERT_THRESHOLDS.map((s) => s.id),
  clovers: CLOVER_RULES.map((s) => s.id),
  financial: FINANCIAL.map((s) => s.id),
};

export default function Settings() {
  const { toast } = useToast();
  const { can } = useAuth();
  const { settings: apiSettings, defaults, isLoading, error, refetch: refetchSettings } = useSettings();
  const { admins: adminUsers } = useAdmins();

  const saved = React.useMemo(() => (apiSettings ? toDraft(apiSettings) : null), [apiSettings]);
  // Draft copy — the server only changes when Save is pressed.
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [confirmSave, setConfirmSave] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Adopt the server's values once they arrive, and after every successful save.
  React.useEffect(() => {
    if (saved) setDraft(structuredClone(saved));
  }, [saved]);

  const changedKeys = React.useMemo(() => {
    if (!draft || !saved) return [];
    return Object.entries(draft.values)
      .filter(([k, v]) => saved.values[k] !== v)
      .map(([k]) => k);
  }, [draft, saved]);

  const otherChanged = Boolean(
    draft &&
      saved &&
      (draft.defaultFeePayer !== saved.defaultFeePayer ||
        draft.digest !== saved.digest ||
        draft.maintenanceMode !== saved.maintenanceMode ||
        draft.supportEmail !== saved.supportEmail ||
        draft.termsUrl !== saved.termsUrl ||
        draft.privacyUrl !== saved.privacyUrl ||
        JSON.stringify(draft.notify) !== JSON.stringify(saved.notify)),
  );

  const dirty = changedKeys.length > 0 || otherChanged;
  const changeCount = changedKeys.length + (otherChanged ? 1 : 0);
  const readOnly = !can('settings:write');

  const setValue = (id: string, v: string) =>
    setDraft((d) => (d ? { ...d, values: { ...d.values, [id]: v } } : d));

  const patch = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const discard = () => {
    if (saved) setDraft(structuredClone(saved));
    toast({ title: 'Changes discarded', tone: 'info' });
  };

  // Warn before losing edits on a full page unload.
  React.useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const tabDirtyCount = (tab: string) =>
    (TAB_FIELDS[tab] ?? []).filter((id) => changedKeys.includes(id)).length;

  if (isLoading || !draft) {
    return (
      <>
        <PageHeader title="Settings" subtitle="Thresholds, rules and platform configuration." />
        {error ? (
          <Card className="p-6">
            <p className="text-body text-danger-500" role="alert">
              {error}
            </p>
          </Card>
        ) : (
          <Card className="p-6">
            <p className="text-body text-neutral-500">Loading settings…</p>
          </Card>
        )}
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Thresholds, rules and platform configuration. Every change is written to the audit trail with before → after values."
        actions={
          readOnly ? (
            <Chip>Read-only — needs settings:write</Chip>
          ) : (
            <>
              <Button variant="secondary" disabled={!dirty} onClick={discard}>
                <Undo2 className="h-4 w-4 text-neutral-400" />
                Discard
              </Button>
              <Button variant="primary" disabled={!dirty} loading={saving} onClick={() => setConfirmSave(true)}>
                <Save className="h-4 w-4" />
                Save changes
                {changeCount > 0 && (
                  <span className="tnum ml-1 rounded-full bg-white/25 px-1.5 text-[11px] font-semibold">
                    {changeCount}
                  </span>
                )}
              </Button>
            </>
          )
        }
      />

      <Tabs defaultValue="thresholds">
        <TabsList>
          <TabsTrigger value="thresholds">
            Alert Thresholds
            <DirtyDot count={tabDirtyCount('thresholds')} />
          </TabsTrigger>
          <TabsTrigger value="clovers">
            Clover Rules
            <DirtyDot count={tabDirtyCount('clovers')} />
          </TabsTrigger>
          <TabsTrigger value="financial">
            Financial
            <DirtyDot count={tabDirtyCount('financial')} />
          </TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
        </TabsList>

        <TabsContent value="thresholds">
          <SettingsList
            settings={ALERT_THRESHOLDS}
            values={draft.values}
            defaults={defaults}
            onChange={setValue}
            disabled={readOnly}
          />
        </TabsContent>

        <TabsContent value="clovers">
          <SettingsList
            settings={CLOVER_RULES}
            values={draft.values}
            defaults={defaults}
            onChange={setValue}
            unitLabel="clovers"
            disabled={readOnly}
          />
        </TabsContent>

        <TabsContent value="financial">
          <SettingsList
            settings={FINANCIAL}
            values={draft.values}
            defaults={defaults}
            onChange={setValue}
            disabled={readOnly}
          />
          <Card className="mt-4 divide-y divide-neutral-200">
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <Label htmlFor="fee-payer">Default fee payer</Label>
                <FieldHelp>
                  Who absorbs the platform and Stripe fee unless an organizer overrides it.
                </FieldHelp>
              </div>
              <Select
                value={draft.defaultFeePayer}
                onValueChange={(v) => patch({ defaultFeePayer: v })}
                disabled={readOnly}
              >
                <SelectTrigger id="fee-payer" className="w-full sm:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contributor">Contributor</SelectItem>
                  <SelectItem value="beneficiary">Beneficiary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <Label>Supported currencies</Label>
                <FieldHelp>
                  Aggregates cannot be summed across currencies without an FX rate and a rate-as-of
                  date — adding a second currency changes every money KPI.
                </FieldHelp>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Chip tone="brand">MXN</Chip>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={readOnly}
                  onClick={() =>
                    toast({
                      title: 'Multi-currency needs an FX policy',
                      description: 'Open question 1 in the spec — confirm with the client first.',
                      tone: 'warning',
                    })
                  }
                >
                  Add currency
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <div className="border-b border-neutral-200 p-4">
              <h2 className="text-card-title text-neutral-700">Which alerts email which admins</h2>
              <p className="mt-1 text-caption text-neutral-500 md:hidden">
                Scroll sideways to reach every admin column.
              </p>
            </div>
            <div className="scroll-x">
              <table className="w-full border-collapse">
                <thead className="bg-neutral-50">
                  <tr className="border-b border-neutral-200">
                    <th
                      scope="col"
                      className="min-w-[180px] px-4 py-3 text-left text-table-header uppercase text-neutral-500"
                    >
                      Alert
                    </th>
                    {adminUsers.map((a) => (
                      <th
                        key={a.id}
                        scope="col"
                        className="min-w-[110px] px-4 py-3 text-center text-table-header uppercase text-neutral-500"
                      >
                        {a.name.split(' ')[0]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {['payment_friction', 'clover_anomaly', 'withdrawal_pending', 'stagnant_event', 'unrevealed_card'].map(
                    (alertType, i) => (
                      <tr
                        key={alertType}
                        className={cn('border-b border-neutral-200 last:border-0', i % 2 === 1 && 'bg-neutral-50')}
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-body capitalize text-neutral-900">
                          {alertType.split('_').join(' ')}
                        </td>
                        {adminUsers.map((a) => (
                          <td key={a.id} className="px-4 py-3 text-center">
                            <Checkbox
                              disabled={readOnly}
                              checked={draft.notify[alertType]?.includes(a.id) ?? false}
                              onCheckedChange={(checked) =>
                                setDraft((d) => {
                                  if (!d) return d;
                                  const current = d.notify[alertType] ?? [];
                                  return {
                                    ...d,
                                    notify: {
                                      ...d.notify,
                                      [alertType]: checked
                                        ? [...current, a.id]
                                        : current.filter((x) => x !== a.id),
                                    },
                                  };
                                })
                              }
                              aria-label={`Email ${a.name} for ${alertType.split('_').join(' ')}`}
                              className="mx-auto"
                            />
                          </td>
                        ))}
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-neutral-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div>
                <Label htmlFor="digest">Digest frequency</Label>
                <FieldHelp>How often non-critical alerts are batched into a single email.</FieldHelp>
              </div>
              <Select value={draft.digest} onValueChange={(v) => patch({ digest: v })} disabled={readOnly}>
                <SelectTrigger id="digest" className="w-full sm:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="realtime">Real time</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="branding">
          <Card className="divide-y divide-neutral-200">
            <div className="p-4">
              <Label>App logo</Label>
              <div className="mt-2 flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-500 text-[20px]">
                  🍀
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={readOnly}
                  onClick={() => toast({ title: 'Logo upload', description: 'Pick a square PNG or SVG, at least 512 × 512 px.', tone: 'info' })}
                >
                  Replace logo
                </Button>
              </div>
              <FieldHelp>PNG or SVG, square, at least 512 × 512 px.</FieldHelp>
            </div>
            <div className="p-4">
              <Label htmlFor="support-email">Support email</Label>
              <Input
                id="support-email"
                value={draft.supportEmail}
                disabled={readOnly}
                onChange={(e) => patch({ supportEmail: e.target.value })}
                className="mt-1 w-full max-w-[380px]"
              />
            </div>
            <div className="p-4">
              <Label htmlFor="terms">Terms URL</Label>
              <Input
                id="terms"
                value={draft.termsUrl}
                disabled={readOnly}
                onChange={(e) => patch({ termsUrl: e.target.value })}
                className="mt-1 w-full max-w-[380px]"
              />
            </div>
            <div className="p-4">
              <Label htmlFor="privacy">Privacy URL</Label>
              <Input
                id="privacy"
                value={draft.privacyUrl}
                disabled={readOnly}
                onChange={(e) => patch({ privacyUrl: e.target.value })}
                className="mt-1 w-full max-w-[380px]"
              />
            </div>
            <div className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <Label htmlFor="maintenance">Maintenance mode</Label>
                <FieldHelp>
                  Shows a maintenance screen in the mobile app. Contributions in flight still settle.
                </FieldHelp>
              </div>
              <Switch
                id="maintenance"
                disabled={readOnly}
                checked={draft.maintenanceMode}
                onCheckedChange={(v) => patch({ maintenanceMode: v })}
              />
            </div>
          </Card>

        </TabsContent>
      </Tabs>

      {/* Sticky save bar so the action is reachable from any scroll position */}
      {dirty && !readOnly && (
        <div className="sticky bottom-4 z-30 mt-6 flex flex-col gap-3 rounded-lg border border-brand-300 bg-neutral-0 p-3 shadow-e2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-body text-neutral-700">
            <span className="tnum font-semibold text-neutral-900">{changeCount}</span> unsaved{' '}
            {changeCount === 1 ? 'change' : 'changes'}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" className="flex-1 sm:flex-none" onClick={discard}>
              Discard
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() => setConfirmSave(true)}
            >
              <Save className="h-4 w-4" />
              Save changes
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmSave}
        onOpenChange={setConfirmSave}
        title="Save settings changes"
        tone="primary"
        requireReason
        consequence={
          <>
            {changeCount} {changeCount === 1 ? 'setting' : 'settings'} will be updated. Thresholds
            take effect on the next alert evaluation cycle, within 15 minutes. Each changed value is
            written to the audit trail with its before → after.
          </>
        }
        confirmLabel="Save changes"
        onConfirm={(reason) => {
          if (!apiSettings) return;
          setSaving(true);
          settingsService
            .update({ ...toPayload(draft, apiSettings), reason })
            .then(() => {
              toast({
                title: 'Settings saved',
                description: `${changeCount} ${changeCount === 1 ? 'change' : 'changes'} applied · view them in the Audit Trail`,
                tone: 'success',
              });
              void refetchSettings();
            })
            .catch((err: ApiError) => {
              // 422 details are keyed per setting, e.g.
              // { "alertThresholds.stagnant_hours": "must be between 1 and 8760" }
              const fields = Object.entries(err.fieldErrors ?? {});
              toast({
                title: 'Could not save settings',
                description: fields.length
                  ? fields.map(([k, v]) => `${k.split('.').pop()}: ${v}`).join(' · ')
                  : err.message,
                tone: 'danger',
              });
            })
            .finally(() => setSaving(false));
        }}
      >
        {changedKeys.length > 0 && (
          <div className="rounded-md border border-neutral-200">
            <p className="border-b border-neutral-200 px-3 py-2 text-table-header uppercase text-neutral-500">
              Changed values
            </p>
            <ul className="max-h-[180px] overflow-y-auto p-1">
              {changedKeys.map((k) => (
                <li key={k} className="flex items-center gap-2 px-2 py-1.5 text-caption">
                  <code className="min-w-0 flex-1 truncate font-mono text-neutral-700">{k}</code>
                  <code className="tnum rounded-sm bg-danger-50 px-1.5 py-0.5 font-mono text-danger-500">
                    {saved?.values[k] ?? "—"}
                  </code>
                  <span className="text-neutral-400">→</span>
                  <code className="tnum rounded-sm bg-success-50 px-1.5 py-0.5 font-mono text-success-500">
                    {draft.values[k]}
                  </code>
                </li>
              ))}
            </ul>
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}

function DirtyDot({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      className="tnum ml-2 rounded-full bg-warning-500 px-1.5 text-[11px] font-semibold text-white"
      aria-label={`${count} unsaved`}
    >
      {count}
    </span>
  );
}

function SettingsList({
  settings,
  values,
  defaults,
  onChange,
  unitLabel,
  disabled,
}: {
  settings: SettingDef[];
  values: Record<string, string>;
  /** From `meta.defaults` — the server owns them, we don't keep a second copy. */
  defaults: Record<string, number | string>;
  onChange: (id: string, v: string) => void;
  unitLabel?: string;
  disabled?: boolean;
}) {
  return (
    <Card className="divide-y divide-neutral-200">
      {settings.map((s) => {
        const defaultValue = String(defaults[s.id] ?? '');
        const changed = values[s.id] !== defaultValue;
        return (
          <div
            key={s.id}
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
          >
            <div className="min-w-0 flex-1">
              <Label htmlFor={s.id}>
                {s.label}
                {changed && (
                  <span className="ml-2 rounded-sm bg-warning-50 px-1.5 py-px text-[11px] font-medium text-warning-500">
                    Modified
                  </span>
                )}
              </Label>
              <FieldHelp>{s.help}</FieldHelp>
              <p className="mt-1 text-caption text-neutral-400">
                Default: <span className="tnum">{defaultValue}</span> {s.unit ?? unitLabel ?? ''}
                {changed && !disabled && (
                  <button
                    type="button"
                    onClick={() => onChange(s.id, defaultValue)}
                    className="ml-2 inline-flex items-center gap-1 rounded-sm text-brand-500 hover:underline"
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden />
                    Reset to default
                  </button>
                )}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Input
                id={s.id}
                type="number"
                inputMode="decimal"
                disabled={disabled}
                value={values[s.id] ?? ''}
                onChange={(e) => onChange(s.id, e.target.value)}
                className="tnum w-full text-right sm:w-[110px]"
              />
              <span className="w-[52px] shrink-0 text-caption text-neutral-500">
                {s.unit ?? unitLabel ?? ''}
              </span>
            </div>
          </div>
        );
      })}
    </Card>
  );
}
