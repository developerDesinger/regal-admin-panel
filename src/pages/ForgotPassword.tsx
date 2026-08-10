import { Trans, useTranslation } from 'react-i18next';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authService } from '@/lib/api/services';
import { ApiError } from '@/lib/api/client';

/**
 * Screen 01a — Forgot password (§01).
 *
 * The endpoint always returns 204 whether or not the address exists, so this
 * screen must not reveal it either: the confirmation is identical in both
 * cases. Anything else turns the form into an account-enumeration oracle.
 */
export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || pending) return;
    setPending(true);
    setError(null);
    try {
      await authService.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      const api = err as ApiError;
      // A rate limit is the one failure worth surfacing; everything else would
      // leak whether the address exists.
      setError(
        api.code === 'RATE_LIMITED' ? api.message : t('auth.forgot.failed'),
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-500 px-4 py-12">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 select-none text-[420px] leading-none text-white/[0.06]"
      >
        🍀
      </span>

      <main className="relative w-full max-w-[440px]">
        <div className="mb-6 flex items-center justify-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white/15">
            <ShieldCheck className="h-5 w-5 text-white" aria-hidden />
          </span>
          <span className="text-[20px] font-semibold text-white">{t('auth.brand')}</span>
        </div>

        <div className="rounded-lg bg-neutral-0 p-6 shadow-e2 sm:p-8">
          {sent ? (
            <div className="text-center">
              <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-50">
                <CheckCircle2 className="h-6 w-6 text-success-500" aria-hidden />
              </span>
              <h1 className="text-page-title text-neutral-900">{t('auth.forgot.sentTitle')}</h1>
              <p className="mt-2 text-body text-neutral-500">
                <Trans
                  i18nKey="auth.forgot.sentBody"
                  values={{ email }}
                  components={[<strong key="0" className="text-neutral-700" />]}
                />
              </p>
              <Button variant="secondary" className="mt-6 w-full" asChild>
                <Link to="/login">
                  <ArrowLeft className="h-4 w-4 text-neutral-400" />
                  {t('auth.backToSignIn')}
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-6 text-center">
                <h1 className="text-page-title text-neutral-900">{t('auth.forgot.title')}</h1>
                <p className="mt-1 text-body text-neutral-500">{t('auth.forgot.subtitle')}</p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mb-4 rounded-md border border-danger-500/20 bg-danger-50 p-3"
                >
                  <p className="text-body text-danger-500">{error}</p>
                </div>
              )}

              <form onSubmit={submit} noValidate className="space-y-4">
                <div>
                  <Label htmlFor="email">{t('auth.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('auth.emailPlaceholder')}
                    className="mt-1"
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="h-11 w-full"
                  disabled={!email.trim() || pending}
                  loading={pending}
                >
                  {pending ? t('auth.forgot.sending') : t('auth.forgot.send')}
                </Button>

                <Link
                  to="/login"
                  className="block rounded-sm text-center text-[13px] font-medium text-brand-500 transition-colors hover:text-brand-600"
                >
                  {t('auth.backToSignIn')}
                </Link>
              </form>
            </>
          )}

          <p className="mt-6 border-t border-neutral-200 pt-4 text-center text-caption text-neutral-500">
            {t('common.restrictedAccess')}
          </p>
        </div>
      </main>
    </div>
  );
}
