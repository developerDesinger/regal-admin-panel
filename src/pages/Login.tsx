import * as React from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

/**
 * Screen 01 — Login (§01)
 *
 * Split screen: left 45% brand panel (hidden <1024px), right 55% centered form.
 *
 * Non-negotiables that belong to the server and are documented here so they are
 * not lost in handoff:
 *  · Session token in an httpOnly, Secure, SameSite=Strict cookie — never
 *    localStorage.
 *  · Every login attempt, success or failure, writes to the audit trail with IP
 *    and user-agent.
 *  · Rate limiting is enforced server-side; the countdown below is only its UI.
 *  · noindex, nofollow (set in index.html for all admin routes).
 */

/** 2FA is specified either way — build the screen, feature-flag it on (§01). */
const TWO_FACTOR_ENABLED = false;

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 15 * 60;

export default function Login() {
  const { admin, signIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [remember, setRemember] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(
    params.get('reason') === 'timeout' ? 'Your session expired after 30 minutes of inactivity.' : null,
  );
  const [attempts, setAttempts] = React.useState(0);
  const [lockoutLeft, setLockoutLeft] = React.useState(0);
  const [stage, setStage] = React.useState<'credentials' | '2fa'>('credentials');
  const [emailTouched, setEmailTouched] = React.useState(false);

  React.useEffect(() => {
    if (lockoutLeft <= 0) return;
    const t = setInterval(() => setLockoutLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [lockoutLeft]);

  if (admin) return <Navigate to="/" replace />;

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const emailError = emailTouched && email.length > 0 && !emailValid;
  const locked = lockoutLeft > 0;
  const canSubmit = email.trim().length > 0 && password.length > 0 && !pending && !locked;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setPending(true);
    setError(null);

    // UI-only build: any password is accepted. The real endpoint verifies
    // credentials server-side and sets the session cookie.
    setTimeout(() => {
      setPending(false);
      if (password.length < 4) {
        const next = attempts + 1;
        setAttempts(next);
        // Never disclose which field was wrong (§01 States).
        setError('Incorrect email or password.');
        if (next >= MAX_ATTEMPTS) setLockoutLeft(LOCKOUT_SECONDS);
        return;
      }
      if (TWO_FACTOR_ENABLED) {
        setStage('2fa');
        return;
      }
      signIn(email);
      navigate('/');
    }, 500);
  };

  return (
    <div className="flex min-h-screen bg-neutral-0">
      {/* Left 45% — solid brand panel, hidden below 1024px */}
      <div className="relative hidden w-[45%] shrink-0 overflow-hidden bg-brand-500 lg:block">
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
          <span className="select-none text-[420px] leading-none text-white/[0.06]">🍀</span>
        </div>
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/15">
              <ShieldCheck className="h-5 w-5 text-white" aria-hidden />
            </span>
            <span className="text-[18px] font-semibold text-white">Regal</span>
          </div>
          <p className="max-w-[320px] text-[30px] font-semibold leading-9 text-white">
            Regal Administration Panel
          </p>
          <p className="text-caption text-white/70">
            Group gifting operations &amp; analytics console
          </p>
        </div>
      </div>

      {/* Right 55% — centered form card */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 text-center">
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-500 lg:hidden">
              <ShieldCheck className="h-6 w-6 text-white" aria-hidden />
            </span>
            <h1 className="text-page-title text-neutral-900">
              {stage === '2fa' ? 'Two-factor authentication' : 'Sign in to continue'}
            </h1>
            {stage === '2fa' && (
              <p className="mt-1 text-body text-neutral-500">
                Enter the 6-digit code from your authenticator app.
              </p>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-md border border-danger-500/20 bg-danger-50 p-3"
            >
              <AlertCircle className="mt-px h-4 w-4 shrink-0 text-danger-500" aria-hidden />
              <p className="text-body text-danger-500">{error}</p>
            </div>
          )}

          {locked && (
            <div role="alert" className="mb-4 rounded-md border border-warning-500/20 bg-warning-50 p-3">
              <p className="text-body text-warning-500">
                Too many attempts. Try again in{' '}
                <span className="tnum font-semibold">
                  {Math.floor(lockoutLeft / 60)}:{String(lockoutLeft % 60).padStart(2, '0')}
                </span>
                .
              </p>
            </div>
          )}

          {stage === 'credentials' ? (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  placeholder="admin@regal.app"
                  invalid={emailError || Boolean(error)}
                  disabled={locked}
                  className="mt-1"
                  aria-describedby={emailError ? 'email-error' : undefined}
                />
                {emailError && (
                  <p id="email-error" className="mt-1 text-caption text-danger-500">
                    Enter a valid email address.
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative mt-1">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    invalid={Boolean(error)}
                    disabled={locked}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded-sm p-2 text-neutral-400 transition-colors hover:text-neutral-700"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember"
                    checked={remember}
                    onCheckedChange={(v) => setRemember(Boolean(v))}
                  />
                  <Label htmlFor="remember" className="cursor-pointer font-normal">
                    Remember me
                  </Label>
                </div>
                <a
                  href="/login/forgot"
                  className="rounded-sm text-[13px] font-medium text-brand-500 transition-colors hover:text-brand-600"
                >
                  Forgot password?
                </a>
              </div>

              <Button
                type="submit"
                variant="primary"
                className="h-11 w-full"
                disabled={!canSubmit}
                loading={pending}
              >
                {pending ? 'Signing in…' : 'Sign in'}
              </Button>

              <p className="text-caption text-neutral-500">
                {remember
                  ? 'Your session will stay active for 30 days on this device.'
                  : 'Your session ends when you close the browser.'}
              </p>
            </form>
          ) : (
            <TwoFactorForm
              onBack={() => setStage('credentials')}
              onVerified={() => {
                signIn(email);
                navigate('/');
              }}
            />
          )}

          <p className="mt-8 text-center text-caption text-neutral-500">
            Restricted access. All activity is logged.
          </p>
        </div>
      </div>
    </div>
  );
}

/** 6-digit code: separate boxes, auto-advance, paste-fills-all (§01 2FA). */
function TwoFactorForm({ onBack, onVerified }: { onBack: () => void; onVerified: () => void }) {
  const [digits, setDigits] = React.useState(['', '', '', '', '', '']);
  const [cooldown, setCooldown] = React.useState(0);
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const setDigit = (i: number, v: string) => {
    const clean = v.replace(/\D/g, '');
    if (!clean) {
      setDigits((prev) => prev.map((d, idx) => (idx === i ? '' : d)));
      return;
    }
    // Paste fills all boxes
    if (clean.length > 1) {
      const next = clean.slice(0, 6).split('');
      setDigits((prev) => prev.map((d, idx) => next[idx] ?? d));
      refs.current[Math.min(5, next.length - 1)]?.focus();
      return;
    }
    setDigits((prev) => prev.map((d, idx) => (idx === i ? clean : d)));
    if (i < 5) refs.current[i + 1]?.focus();
  };

  const complete = digits.every((d) => d !== '');

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (complete) onVerified();
      }}
    >
      <div className="flex justify-between gap-2" role="group" aria-label="6-digit verification code">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={d}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !d && i > 0) refs.current[i - 1]?.focus();
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            aria-label={`Digit ${i + 1}`}
            autoFocus={i === 0}
            className={cn(
              'tnum h-12 w-full rounded-sm border border-neutral-300 bg-neutral-0 text-center text-[18px] font-semibold text-neutral-900',
              'transition-colors hover:border-neutral-400',
            )}
          />
        ))}
      </div>

      <Button type="submit" variant="primary" className="h-11 w-full" disabled={!complete}>
        Verify
      </Button>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-sm text-[13px] font-medium text-brand-500 hover:text-brand-600"
        >
          Back to sign in
        </button>
        <button
          type="button"
          disabled={cooldown > 0}
          onClick={() => setCooldown(30)}
          className="rounded-sm text-[13px] font-medium text-brand-500 hover:text-brand-600 disabled:text-neutral-400"
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        </button>
      </div>
    </form>
  );
}
