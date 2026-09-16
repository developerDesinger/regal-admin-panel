import stripeLogo from '@/assets/stripe.png';
import { cn } from '@/lib/utils';

/**
 * A payment processor's own wordmark, in place of its name.
 *
 * Sized per logo rather than to one shared box: Stripe's file is a square
 * canvas whose wordmark fills about 40% of the height, so it carries the
 * height that puts the wordmark at the intended optical size.
 *
 * `wallet` has no logo — it is not a processor, it is the beneficiary's own
 * balance — so it falls back to the caller's text.
 */

const LOGOS: Record<string, { src: string; alt: string; className: string }> = {
  stripe: { src: stripeLogo, alt: 'Stripe', className: 'h-5 w-auto' },
};

export function hasProviderLogo(provider: string): boolean {
  return provider in LOGOS;
}

export function ProviderLogo({
  provider,
  className,
}: {
  provider: string;
  className?: string;
}) {
  const logo = LOGOS[provider];
  if (!logo) return null;
  return (
    <img
      src={logo.src}
      alt={logo.alt}
      // The alt text carries the name, so a screen reader still reads
      // "Stripe" where the sighted user sees the mark.
      className={cn('inline-block object-contain', logo.className, className)}
    />
  );
}

export default ProviderLogo;
