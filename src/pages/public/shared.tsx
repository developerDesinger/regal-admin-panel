import * as React from 'react';

/**
 * Shared pieces of the public, unauthenticated event page (`/c/:slug`).
 *
 * The *download* side of a shared link is not here: `/download` and `/i/:code`
 * are answered by server.js before this bundle loads, which is deliberate —
 * that page is user-agent aware, already knows the TestFlight link from
 * `IOS_STORE_URL`, and is served on the same host as the two app association
 * files Apple and Google fetch. The event page links to it rather than
 * reimplementing it with a second copy of the store URLs.
 */

/** The download page server.js serves. */
export const DOWNLOAD_PATH = '/download';

/** Opens the app if it is installed. Harmless, and silent, when it is not. */
export const APP_SCHEME_URL = 'regal://';

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 py-10">
      <main className="w-full max-w-md">{children}</main>
      <p className="mt-8 text-center text-xs text-neutral-400">Regalapp</p>
    </div>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
      {children}
    </div>
  );
}

/** `$1,234.00 MXN` from MAJOR units — the guest API sends pesos, not centavos. */
export function formatMajor(amount: number, currency = 'MXN'): string {
  return `${new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).format(amount)} ${currency}`;
}
