/**
 * Every admin action, routed to the API.
 *
 * Screens call these from their confirm dialogs. Each one invalidates the
 * queries its change affects, so the table the admin is looking at refreshes
 * without a manual reload — and the audit trail picks up the new entry.
 */

import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import {
  alertsService,
  catalogService,
  cloversService,
  eventsService,
  usersService,
  withdrawalsService,
} from '@/lib/api/services';
import type { GiftCardDesign, RegalEvent } from '@/lib/types';

/** Stable id per user-initiated retry, so a resend can't pay twice. */
function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export function useAdminMutations() {
  const qc = useQueryClient();

  const invalidate = React.useCallback(
    (...keys: string[]) => {
      keys.forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
    },
    [qc],
  );

  return React.useMemo(
    () => ({
      /* ---- events ---- */
      async overrideEventStatus(event: RegalEvent, status: string, reason: string) {
        await eventsService.statusOverride(event.id, status, reason);
        invalidate('events', 'event', 'event-activity', 'audit');
      },

      async forceCloseEvent(event: RegalEvent, reason: string) {
        await eventsService.forceClose(event.id, reason);
        invalidate('events', 'event', 'event-activity', 'audit');
      },

      async resendReminders(event: RegalEvent, reason: string) {
        const res = await eventsService.resendReminders(event.id, reason);
        invalidate('event', 'event-activity', 'audit');
        return res.data;
      },

      async flagEvent(event: RegalEvent, reason: string) {
        await eventsService.flag(event.id, reason);
        invalidate('events', 'event', 'event-activity', 'audit');
      },

      /**
       * Dispatches the four Event Detail admin actions by their audit action
       * name, so the confirm dialog stays declarative.
       */
      async runEventAction(
        event: RegalEvent,
        action: string,
        patch: Partial<RegalEvent> | undefined,
        reason: string,
      ) {
        switch (action) {
          case 'event.status_override':
            return this.overrideEventStatus(event, String(patch?.status ?? 'completed'), reason);
          case 'event.force_close':
            return this.forceCloseEvent(event, reason);
          case 'event.resend_reminders':
            await this.resendReminders(event, reason);
            return;
          case 'event.flag_for_review':
            return this.flagEvent(event, reason);
          default:
            return;
        }
      },

      /* ---- users ---- */
      async setUserActive(userId: string, isActive: boolean, reason: string) {
        await (isActive
          ? usersService.reactivate(userId, reason)
          : usersService.suspend(userId, reason));
        invalidate('users', 'user', 'user-activity', 'audit');
      },

      /** `amount` is signed; the server rejects 0, non-integers and overdrafts. */
      async adjustClovers(userId: string, amount: number, reason: string) {
        const res = await usersService.adjustClovers(userId, amount, reason);
        invalidate('users', 'user', 'user-clovers', 'clover-ledger', 'clover-kpis', 'audit');
        return res.data;
      },

      async resetUserPassword(userId: string) {
        const res = await usersService.passwordReset(userId);
        invalidate('user-activity', 'audit');
        return res.data;
      },

      /** Returns the unmasked contact details; the call itself is audited. */
      async unmaskPii(userId: string, reason: string) {
        const res = await usersService.unmaskPii(userId, reason);
        invalidate('user', 'audit');
        return res.data;
      },

      /* ---- catalog ---- */
      async setCardActive(card: GiftCardDesign, isActive: boolean, reason: string) {
        await (isActive
          ? catalogService.activate(card.id, reason)
          : catalogService.deactivate(card.id, reason));
        invalidate('catalog', 'catalog-card', 'audit');
      },

      /** Never retroactive — nobody is charged or refunded for a price change. */
      async setCardPrice(card: GiftCardDesign, cloverCost: number, reason: string) {
        const res = await catalogService.setPrice(card.id, cloverCost, reason);
        invalidate('catalog', 'catalog-card', 'audit');
        return res;
      },

      async duplicateCard(card: GiftCardDesign) {
        const copy = await catalogService.duplicate(card.id);
        invalidate('catalog', 'audit');
        return copy;
      },

      /** 409 when unlocks exist — the caller offers Deactivate instead. */
      async deleteCard(card: GiftCardDesign, reason: string) {
        await catalogService.remove(card.id, reason);
        invalidate('catalog', 'audit');
      },

      async reorderCards(orderedIds: string[]) {
        await catalogService.reorder(orderedIds);
        invalidate('catalog', 'audit');
      },

      /* ---- alerts ---- */
      async acknowledgeAlert(id: string) {
        await alertsService.acknowledge(id);
        invalidate('alerts', 'alert-types', 'audit');
      },

      async assignAlert(id: string, adminId: string) {
        await alertsService.assign(id, adminId);
        invalidate('alerts', 'audit');
      },

      async snoozeAlert(id: string, duration: '1h' | '24h' | '7d') {
        await alertsService.snooze(id, duration);
        invalidate('alerts', 'alert-types', 'audit');
      },

      async resolveAlert(id: string, reason: string) {
        await alertsService.resolve(id, reason);
        invalidate('alerts', 'alert-types', 'audit');
      },

      /** Dismiss means "the rule was wrong" — it feeds threshold tuning. */
      async dismissAlert(id: string, reason: string) {
        await alertsService.dismiss(id, reason);
        invalidate('alerts', 'alert-types', 'audit');
      },

      /* ---- withdrawals ---- */
      async retryPayout(id: string, reason: string) {
        // 422 without the header; the key must be stable across transport retries.
        await withdrawalsService.retry(id, reason, newIdempotencyKey());
        invalidate('withdrawals', 'withdrawal-kpis', 'audit');
      },

      /** Records that someone dealt with it out of band — moves no money. */
      async markPayoutResolved(id: string, reason: string) {
        await withdrawalsService.markResolved(id, reason);
        invalidate('withdrawals', 'withdrawal-kpis', 'audit');
      },

      async contactBeneficiary(
        id: string,
        reason: string,
        template: 'payout_failed' | 'payout_delayed' = 'payout_failed',
      ) {
        await withdrawalsService.contact(id, reason, template);
        invalidate('withdrawals', 'audit');
      },

      /* ---- clovers ---- */
      /** Freeze suspends the account — there is no separate "can't earn" flag. */
      async freezeAnomaly(anomalyId: string, reason: string) {
        await cloversService.freezeAnomaly(anomalyId, reason);
        invalidate('clover-anomalies', 'clover-ledger', 'users', 'audit');
      },

      async dismissAnomaly(anomalyId: string, reason: string) {
        await cloversService.dismissAnomaly(anomalyId, reason);
        invalidate('clover-anomalies', 'audit');
      },
    }),
    [invalidate],
  );
}

export type AdminMutations = ReturnType<typeof useAdminMutations>;
