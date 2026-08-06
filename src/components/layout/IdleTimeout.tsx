import * as React from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useAuth } from '@/hooks/use-auth';

/**
 * Idle timeout — 30 minutes with a 2-minute warning modal offering
 * "Stay signed in" (§01 Non-negotiables).
 */
const IDLE_MS = 30 * 60 * 1000;
const WARN_MS = 2 * 60 * 1000;

export function IdleTimeout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [warning, setWarning] = React.useState(false);
  const [secondsLeft, setSecondsLeft] = React.useState(WARN_MS / 1000);
  // Seeded in an effect, not during render — reading the clock while rendering
  // is impure and makes the component non-idempotent.
  const lastActivity = React.useRef(0);

  const reset = React.useCallback(() => {
    lastActivity.current = Date.now();
    setWarning(false);
  }, []);

  React.useEffect(() => {
    lastActivity.current = Date.now();
  }, []);

  React.useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const onActivity = () => {
      if (!warning) lastActivity.current = Date.now();
    };
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, onActivity));
  }, [warning]);

  React.useEffect(() => {
    const tick = setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= IDLE_MS) {
        signOut();
        navigate('/login?reason=timeout');
      } else if (idle >= IDLE_MS - WARN_MS) {
        setWarning(true);
        setSecondsLeft(Math.ceil((IDLE_MS - idle) / 1000));
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [signOut, navigate]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <Dialog open={warning} onOpenChange={(o) => !o && reset()}>
      <DialogContent width={440}>
        <DialogHeader>
          <DialogTitle>You’ll be signed out soon</DialogTitle>
          <DialogDescription>
            For security, your session ends after 30 minutes of inactivity. All activity in this panel
            is logged.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <p className="tnum text-center text-kpi-value text-neutral-900" role="timer" aria-live="off">
            {mins}:{String(secs).padStart(2, '0')}
          </p>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => {
              signOut();
              navigate('/login');
            }}
          >
            Sign out now
          </Button>
          <Button variant="primary" onClick={reset}>
            Stay signed in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
