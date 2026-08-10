import { useTranslation } from 'react-i18next';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthCard, PasswordFields } from '@/components/common/PasswordFields';
import { passwordMeetsPolicy } from '@/lib/password-policy';
import { useAuth } from '@/hooks/use-auth';
import { ApiError } from '@/lib/api/client';

/**
 * Forced password change (§4 Session rules).
 *
 * Shown when the session reports `mustChangePassword` — a backend-issued
 * credential, so the admin cannot reach the rest of the panel until they set
 * their own. Changing it re-mints the session and its CSRF token.
 */
export default function ChangePassword() {
  const { t } = useTranslation();
  const { admin, changePassword, signOut } = useAuth();
  const navigate = useNavigate();

  const [current, setCurrent] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const valid = current.length > 0 && passwordMeetsPolicy(password) && password === confirm;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || pending) return;
    setPending(true);
    setError(null);
    try {
      await changePassword(current, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthCard
      title={t('auth.change.title')}
      subtitle={
        admin
          ? t('auth.change.subtitleNamed', { name: admin.name.split(' ')[0] })
          : t('auth.change.subtitle')
      }
    >
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
        <div>
          <Label htmlFor="current-password" required>
            {t('auth.change.currentPassword')}
          </Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="mt-1"
          />
        </div>

        <PasswordFields
          password={password}
          confirm={confirm}
          onPassword={setPassword}
          onConfirm={setConfirm}
        />

        <Button
          type="submit"
          variant="primary"
          className="h-11 w-full"
          disabled={!valid}
          loading={pending}
        >
          {pending ? t('auth.change.saving') : t('auth.change.submit')}
        </Button>

        <button
          type="button"
          onClick={signOut}
          className="block w-full rounded-sm text-center text-[13px] font-medium text-brand-500 transition-colors hover:text-brand-600"
        >
          {t('auth.change.signOutInstead')}
        </button>
      </form>
    </AuthCard>
  );
}
