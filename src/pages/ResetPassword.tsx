import { useTranslation } from 'react-i18next';
import * as React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthCard, PasswordFields } from '@/components/common/PasswordFields';
import { passwordMeetsPolicy } from '@/lib/password-policy';
import { authService } from '@/lib/api/services';
import { ApiError } from '@/lib/api/client';

/**
 * Screen 01b — Set / reset password (§01).
 *
 * The landing page for both the forgot-password email and the activation link
 * a newly invited admin receives. The token is single-use and expires after an
 * hour; using it ends every other session for that account.
 */
export default function ResetPassword() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';

  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const valid = passwordMeetsPolicy(password) && password === confirm;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || pending) return;
    setPending(true);
    setError(null);
    try {
      await authService.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setPending(false);
    }
  };

  if (!token) {
    return (
      <AuthCard title={t('auth.reset.invalidTitle')} subtitle={t('auth.reset.invalidBody')}>
        <p className="text-body text-neutral-500">{t('auth.reset.invalidHelp')}</p>
        <Button variant="primary" className="mt-6 w-full" asChild>
          <Link to="/login/forgot">{t('auth.reset.requestNew')}</Link>
        </Button>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title={t('auth.reset.doneTitle')}>
        <div className="text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-50">
            <CheckCircle2 className="h-6 w-6 text-success-500" aria-hidden />
          </span>
          <p className="text-body text-neutral-500">{t('auth.reset.doneBody')}</p>
          <Button variant="primary" className="mt-6 w-full" onClick={() => navigate('/login')}>
            {t('auth.reset.goToSignIn')}
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t('auth.reset.title')} subtitle={t('auth.reset.subtitle')}>
      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-md border border-danger-500/20 bg-danger-50 p-3"
        >
          <AlertCircle className="mt-px h-4 w-4 shrink-0 text-danger-500" aria-hidden />
          <p className="text-body text-danger-500">{error}</p>
        </div>
      )}

      <form onSubmit={submit} noValidate className="space-y-4">
        <PasswordFields
          autoFocus
          password={password}
          confirm={confirm}
          onPassword={setPassword}
          onConfirm={setConfirm}
          idPrefix="reset"
          label={t('auth.reset.password')}
        />
        <Button
          type="submit"
          variant="primary"
          className="h-11 w-full"
          disabled={!valid}
          loading={pending}
        >
          {pending ? t('auth.reset.saving') : t('auth.reset.submit')}
        </Button>
      </form>
    </AuthCard>
  );
}
