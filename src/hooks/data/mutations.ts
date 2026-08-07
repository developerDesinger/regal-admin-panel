/**
 * Mutations, resolved the same way as the reads: the API when
 * VITE_DATA_SOURCE=api, otherwise the in-browser store.
 *
 * Screens call these instead of `actions.*` directly, so a confirm dialog does
 * the right thing on either path without knowing which is active.
 */

import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { usingMockData } from '@/lib/api/client';
import {
  alertsService,
  catalogService,
  cloversService,
  eventsService,
  usersService,
  withdrawalsService,
} from '@/lib/api/services';
import { actions } from '@/lib/store';
import { useAuth } from '@/hooks/use-auth';
import type { AdminUser, GiftCardDesign, RegalEvent } from '@/lib/types';

/** Stable id per user-initiated retry, so a resend can't double-pay. */
function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export function useAdminMutations() {
  const qc = useQueryClient();
  const { admin } = useAuth();

  const invalidate = React.useCallback(
    (...keys: string[]) => {
      if (usingMockData) return;
      keys.forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
    },
    [qc],
  );

  return React.useMemo(
    () => ({
      /* ---- events ---- */
      async overrideEventStatus(event: RegalEvent, status: string, reason: string) {
        if (usingMockData) {
          actions.updateEvent(
            admin,
            event.id,
            { status: status as RegalEvent['status'], closedAt: new Date().toISOString() },
            { action: 'event.status_override', reason },
          );
          return;
        }
        await eventsService.statusOverride(event.id, status, reason);
        invalidate('events', 'event', 'audit');
      },

      async forceCloseEvent(event: RegalEvent, reason: string) {
        if (usingMockData) {
          actions.updateEvent(
            admin,
            event.id,
            { status: 'completed', closedAt: new Date().toISOString() },
            { action: 'event.force_close', reason },
          );
          return;
        }
        await eventsService.forceClose(event.id, reason);
        invalidate('events', 'event', 'audit');
      },

      async resendReminders(event: RegalEvent, reason: string) {
        if (usingMockData) return { queued: event.totalMembers };
        const res = await eventsService.resendReminders(event.id, reason);
        invalidate('event', 'audit');
        return res.data;
      },

      async flagEvent(event: RegalEvent, reason: string) {
        if (usingMockData) {
          actions.updateEvent(admin, event.id, { status: 'paused' }, { action: 'event.flag_for_review', reason });
          return;
        }
        await eventsService.flag(event.id, reason);
        invalidate('events', 'event', 'audit');
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
      async setUserActive(userId: string, name: string, isActive: boolean, reason: string) {
        if (usingMockData) {
          actions.setUserActive(admin, userId, isActive, reason);
          return;
        }
        await (isActive
          ? usersService.reactivate(userId, reason)
          : usersService.suspend(userId, reason));
        invalidate('users', 'user', 'audit');
        void name;
      },

      /** `amount` is signed; the server rejects 0 and non-integers with a 422. */
      async adjustClovers(userId: string, amount: number, reason: string) {
        if (usingMockData) {
          actions.adjustClovers(admin, userId, amount, reason);
          return null;
        }
        const res = await usersService.adjustClovers(userId, amount, reason);
        invalidate('users', 'user', 'clover-ledger', 'clover-kpis', 'audit');
        return res.data;
      },

      async unmaskPii(userId: string, reason: string) {
        if (usingMockData) return null;
        const res = await usersService.unmaskPii(userId, reason);
        invalidate('user', 'audit');
        return res.data;
      },

      /* ---- catalog ---- */
      async setCardActive(card: GiftCardDesign, isActive: boolean, reason: string) {
        if (usingMockData) {
          actions.setCardActive(admin, card.id, isActive, reason);
          return;
        }
        await (isActive
          ? catalogService.activate(card.id, reason)
          : catalogService.deactivate(card.id, reason));
        invalidate('catalog', 'audit');
      },

      async setCardPrice(card: GiftCardDesign, cloverCost: number, reason: string) {
        if (usingMockData) {
          actions.setCardPrice(admin, card.id, cloverCost, reason);
          return;
        }
        await catalogService.setPrice(card.id, cloverCost, reason);
        invalidate('catalog', 'audit');
      },

      async duplicateCard(card: GiftCardDesign) {
        if (usingMockData) return actions.duplicateCard(admin, card.id);
        const copy = await catalogService.duplicate(card.id);
        invalidate('catalog', 'audit');
        return copy;
      },

      /** 409 when unlocks exist — the caller offers Deactivate instead. */
      async deleteCard(card: GiftCardDesign, reason: string) {
        if (usingMockData) {
          actions.deleteCard(admin, card.id, reason);
          return;
        }
        await catalogService.remove(card.id, reason);
        invalidate('catalog', 'audit');
      },

      async reorderCards(orderedIds: string[]) {
        if (usingMockData) {
          actions.saveCardOrder(admin, orderedIds);
          return;
        }
        await catalogService.reorder(orderedIds);
        invalidate('catalog', 'audit');
      },

      /* ---- alerts ---- */
      async acknowledgeAlert(id: string) {
        if (usingMockData) {
          actions.updateAlert(admin, id, { status: 'acknowledged' }, { action: 'alert.acknowledge' });
          return;
        }
        await alertsService.acknowledge(id);
        invalidate('alerts', 'audit');
      },

      async assignAlert(id: string, adminId: string, adminName: string) {
        if (usingMockData) {
          actions.updateAlert(admin, id, { assignedTo: adminName }, { action: 'alert.assign' });
          return;
        }
        await alertsService.assign(id, adminId);
        invalidate('alerts', 'audit');
      },

      async snoozeAlert(id: string, duration: '1h' | '24h' | '7d') {
        if (usingMockData) {
          actions.updateAlert(admin, id, { status: 'snoozed' }, { action: 'alert.snooze', reason: duration });
          return;
        }
        await alertsService.snooze(id, duration);
        invalidate('alerts', 'audit');
      },

      async resolveAlert(id: string, reason: string) {
        if (usingMockData) {
          actions.updateAlert(admin, id, { status: 'resolved' }, { action: 'alert.resolve', reason });
          return;
        }
        await alertsService.resolve(id, reason);
        invalidate('alerts', 'audit');
      },

      async dismissAlert(id: string, reason: string) {
        if (usingMockData) {
          actions.updateAlert(admin, id, { status: 'dismissed' }, { action: 'alert.dismiss', reason });
          return;
        }
        await alertsService.dismiss(id, reason);
        invalidate('alerts', 'audit');
      },

      /* ---- withdrawals ---- */
      async retryPayout(id: string, reason: string) {
        if (usingMockData) {
          actions.updateWithdrawal(
            admin,
            id,
            { status: 'processing', failureReason: null },
            { action: 'withdrawal.retry', reason },
          );
          return;
        }
        // 422 without the header; the key must be stable across transport retries.
        await withdrawalsService.retry(id, reason, newIdempotencyKey());
        invalidate('withdrawals', 'withdrawal-kpis', 'audit');
      },

      async markPayoutResolved(id: string, reason: string) {
        if (usingMockData) {
          actions.updateWithdrawal(
            admin,
            id,
            { status: 'completed', completedAt: new Date().toISOString(), failureReason: null },
            { action: 'withdrawal.mark_resolved', reason },
          );
          return;
        }
        await withdrawalsService.markResolved(id, reason);
        invalidate('withdrawals', 'withdrawal-kpis', 'audit');
      },

      /* ---- clovers ---- */
      async freezeAnomaly(anomalyId: string, userId: string, reason: string) {
        if (usingMockData) {
          actions.adjustClovers(admin, userId, 0, reason);
          return;
        }
        await cloversService.freezeAnomaly(anomalyId, reason);
        invalidate('clover-ledger', 'users', 'audit');
      },
    }),
    [admin, invalidate],
  );
}

export type AdminMutations = ReturnType<typeof useAdminMutations>;
export type { AdminUser };
