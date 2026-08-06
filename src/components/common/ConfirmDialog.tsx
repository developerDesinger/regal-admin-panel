import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldHelp } from '@/components/ui/label';
import { Textarea } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * ConfirmDialog (§4) — required before every destructive or financial action.
 * States exactly what will happen and is dismissible. High-risk actions
 * (clover adjustment, card deletion, manual status override) require typing the
 * record name to confirm.
 *
 * Every confirmed action is expected to write an audit entry (§14).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  /** Spell out exactly what will happen — no vague "Are you sure?". */
  consequence,
  confirmLabel = 'Confirm',
  tone = 'danger',
  /** Typing this exact string is required before the action unlocks. */
  requireTypedConfirmation,
  /** A mandatory reason is recorded in the audit trail. */
  requireReason,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  consequence: React.ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  requireTypedConfirmation?: string;
  requireReason?: boolean;
  onConfirm: (reason: string) => void;
  children?: React.ReactNode;
}) {
  const [typed, setTyped] = React.useState('');
  const [reason, setReason] = React.useState('');

  React.useEffect(() => {
    if (!open) {
      setTyped('');
      setReason('');
    }
  }, [open]);

  const typedOk = !requireTypedConfirmation || typed.trim() === requireTypedConfirmation;
  const reasonOk = !requireReason || reason.trim().length >= 4;
  const canConfirm = typedOk && reasonOk;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent width={520}>
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                tone === 'danger' ? 'bg-danger-50' : 'bg-brand-50',
              )}
            >
              <AlertTriangle
                className={cn('h-4 w-4', tone === 'danger' ? 'text-danger-500' : 'text-brand-500')}
                aria-hidden
              />
            </span>
            <div className="min-w-0">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription asChild>
                <div>{consequence}</div>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-4 py-4">
          {children}

          {requireReason && (
            <div>
              <Label htmlFor="confirm-reason" required>
                Reason
              </Label>
              <Textarea
                id="confirm-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this change being made?"
                className="mt-1"
              />
              <FieldHelp>This reason is written to the audit trail and cannot be edited later.</FieldHelp>
            </div>
          )}

          {requireTypedConfirmation && (
            <div>
              <Label htmlFor="confirm-typed" required>
                Type <span className="font-mono text-neutral-900">{requireTypedConfirmation}</span> to
                confirm
              </Label>
              <Input
                id="confirm-typed"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                className="mt-1 font-mono"
                invalid={typed.length > 0 && !typedOk}
              />
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            disabled={!canConfirm}
            onClick={() => {
              onConfirm(reason);
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
