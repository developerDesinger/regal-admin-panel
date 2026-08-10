import { useTranslation } from 'react-i18next';
import * as React from 'react';
import { Check, Eye, EyeOff, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PASSWORD_RULES } from '@/lib/password-policy';
import { cn } from '@/lib/utils';

/** New-password + confirm, with the policy checklist. */
export function PasswordFields({
  password,
  confirm,
  onPassword,
  onConfirm,
  idPrefix = 'new',
  label,
  autoFocus,
}: {
  password: string;
  confirm: string;
  onPassword: (v: string) => void;
  onConfirm: (v: string) => void;
  idPrefix?: string;
  label?: string;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  const [show, setShow] = React.useState(false);
  const mismatch = confirm.length > 0 && confirm !== password;

  return (
    <>
      <div>
        <Label htmlFor={`${idPrefix}-password`} required>
          {label ?? t('auth.passwordRules.newPassword')}
        </Label>
        <div className="relative mt-1">
          <Input
            id={`${idPrefix}-password`}
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            autoFocus={autoFocus}
            value={password}
            onChange={(e) => onPassword(e.target.value)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? t('common.hidePassword') : t('common.showPassword')}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-sm p-2 text-neutral-400 transition-colors hover:text-neutral-700"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <ul className="space-y-1" aria-label={t('auth.passwordRules.aria')}>
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <li key={rule.id} className="flex items-center gap-2 text-caption">
              {ok ? (
                <Check className="h-3 w-3 shrink-0 text-success-500" aria-hidden />
              ) : (
                <X className="h-3 w-3 shrink-0 text-neutral-300" aria-hidden />
              )}
              <span className={cn(ok ? 'text-success-500' : 'text-neutral-500')}>
                {t(`auth.passwordRules.${rule.id}`)}
              </span>
              <span className="sr-only">
                {ok ? t('auth.passwordRules.met') : t('auth.passwordRules.notMet')}
              </span>
            </li>
          );
        })}
      </ul>

      <div>
        <Label htmlFor={`${idPrefix}-confirm`} required>
          {t('auth.passwordRules.confirmPassword')}
        </Label>
        <Input
          id={`${idPrefix}-confirm`}
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => onConfirm(e.target.value)}
          invalid={mismatch}
          className="mt-1"
        />
        {mismatch && (
          <p className="mt-1 text-caption text-danger-500" role="alert">
            {t('auth.passwordRules.mismatch')}
          </p>
        )}
      </div>
    </>
  );
}

/** Brand-field shell shared by the login, forgot, reset and change screens. */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-500 px-4 py-12">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 select-none text-[420px] leading-none text-white/[0.06]"
      >
        🍀
      </span>
      <main className="relative w-full max-w-[440px]">
        <div className="rounded-lg bg-neutral-0 p-6 shadow-e2 sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-page-title text-neutral-900">{title}</h1>
            {subtitle && <p className="mt-1 text-body text-neutral-500">{subtitle}</p>}
          </div>
          {children}
          <p className="mt-6 border-t border-neutral-200 pt-4 text-center text-caption text-neutral-500">
            {t('common.restrictedAccess')}
          </p>
        </div>
      </main>
    </div>
  );
}
