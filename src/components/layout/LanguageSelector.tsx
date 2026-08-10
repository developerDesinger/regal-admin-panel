import { useTranslation } from 'react-i18next';
import { Check, Languages } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * Language switcher.
 *
 * Changing the language re-renders every component through react-i18next, so
 * the UI updates in place with no reload. The detector persists the choice to
 * localStorage, which is why nothing is written here by hand.
 */
export function LanguageSelector({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const current = i18n.resolvedLanguage ?? 'en';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700',
          className,
        )}
        aria-label={t('language.label')}
      >
        <Languages className="h-[18px] w-[18px]" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[180px]">
        <DropdownMenuLabel>{t('language.label')}</DropdownMenuLabel>
        {SUPPORTED_LANGUAGES.map((lng) => (
          <DropdownMenuItem
            key={lng.code}
            onSelect={() => void i18n.changeLanguage(lng.code)}
            aria-current={current === lng.code}
          >
            {lng.label}
            {current === lng.code && <Check className="ml-auto h-4 w-4 text-brand-500" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
