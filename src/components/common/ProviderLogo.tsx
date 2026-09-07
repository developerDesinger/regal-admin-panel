import stripeLogo from '@/assets/stripe.png';
import openpayLogo from '@/assets/openpay.png';
import { cn } from '@/lib/utils';

/**
 * A payment processor's own wordmark, in place of its name.
 *
 * Sized per logo rather than to one shared box: the two files are not
 * comparable. Stripe's is a square canvas whose wordmark fills about 40% of
 * the height; Openpay's is a 2.6:1 strip filling about 55%. Constraining both
 * to the same height renders Stripe visibly smaller, so each carries the width
 * that puts its wordmark at the same optical size as the other.
 *
 * `wallet` has no logo — it is not a processor, it is the beneficiary's own
 * balance — so it falls back to the caller's text.
 */

const LOGOS: Record<string, { src: string; alt: string; className: string }> = {
  stripe: { src: stripeLogo, alt: 'Stripe', className: 'h-5 w-auto' },
  openpay: { src: openpayLogo, alt: 'Openpay', className: 'h-4 w-auto' },
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
