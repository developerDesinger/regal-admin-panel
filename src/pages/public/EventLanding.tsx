import * as React from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { API_ORIGIN } from '@/lib/api/client';
import { Card, PublicShell, APP_SCHEME_URL, DOWNLOAD_PATH, formatMajor } from './shared';

/**
 * `/c/:slug` — where an event's share link lands.
 *
 * The slug is resolved through the PUBLIC guest endpoint, not the admin API:
 * whoever opens this was sent a link, has no account and no session, and the
 * admin client would send them to the login screen. `fetch` is used directly
 * for the same reason — the panel's axios instance carries credentials and an
 * admin base path that do not belong on a page for strangers.
 */

interface GuestEvent {
  id: string;
  occasion: string;
  name: string;
  beneficiaryName: string;
  goalAmount: number;
  raisedAmount: number;
  progress: number;
  currency: string;
  endDate: string;
  daysLeft: number;
  personalMessage: string;
  contributorsCount: number;
  shareSlug: string;
}

type State =
  | { status: 'loading' }
  | { status: 'ready'; event: GuestEvent }
  | { status: 'missing' };

export default function EventLanding() {
  const { slug = '' } = useParams();
  const { t } = useTranslation();
  const [state, setState] = React.useState<State>({ status: 'loading' });

  React.useEffect(() => {
    let cancelled = false;
    if (!slug) {
      setState({ status: 'missing' });
      return;
    }
    fetch(`${API_ORIGIN}/api/v1/guest/events/slug/${encodeURIComponent(slug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (cancelled) return;
        const event = body?.data as GuestEvent | undefined;
        // An expired or cancelled event resolves to nothing: the endpoint only
        // returns open ones, and saying so is better than an empty page.
        setState(event?.id ? { status: 'ready', event } : { status: 'missing' });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'missing' });
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (state.status === 'loading') {
    return (
      <PublicShell>
        <Card>
          <div className="space-y-3">
            <div className="h-5 w-2/3 animate-pulse rounded bg-neutral-200" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-neutral-100" />
            <div className="h-2 w-full animate-pulse rounded-full bg-neutral-100" />
          </div>
        </Card>
      </PublicShell>
    );
  }

  if (state.status === 'missing') {
    return (
      <PublicShell>
        <Card>
          <h1 className="text-xl font-semibold text-neutral-900">
            {t('publicShare.event.goneTitle')}
          </h1>
          <p className="mt-2 text-sm text-neutral-600">{t('publicShare.event.goneBody')}</p>
          <a
            href={DOWNLOAD_PATH}
            className="mt-6 flex w-full items-center justify-center rounded-xl bg-brand-500 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            {t('publicShare.getTheApp')}
          </a>
        </Card>
      </PublicShell>
    );
  }

  const { event } = state;
  const progress = Math.min(100, Math.max(0, event.progress));

  return (
    <PublicShell>
      <Card>
        <p className="text-xs font-medium uppercase tracking-wide text-brand-600">
          {event.occasion}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900">{event.name}</h1>
        {event.beneficiaryName && (
          <p className="mt-1 text-sm text-neutral-600">
            {t('publicShare.event.forPerson', { name: event.beneficiaryName })}
          </p>
        )}

        {event.personalMessage && (
          <p className="mt-4 rounded-lg bg-neutral-50 p-4 text-sm italic text-neutral-700">
            “{event.personalMessage}”
          </p>
        )}

        <div className="mt-6">
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-semibold text-neutral-900">
              {formatMajor(event.raisedAmount, event.currency)}
            </span>
            <span className="text-sm text-neutral-500">
              {t('publicShare.event.ofGoal', {
                goal: formatMajor(event.goalAmount, event.currency),
              })}
            </span>
          </div>
          <div
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-200"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            {t('publicShare.event.stats', {
              count: event.contributorsCount,
              days: event.daysLeft,
            })}
          </p>
        </div>

        {/* The bare scheme, not `regal://c/<slug>`: the navigator maps one path
            per screen and `OnBoarding` already answers to `i/:code`, so a `c/`
            path would arrive unhandled. This opens the app for someone who has
            it; the page above is what shows the event either way, which is also
            why `/c/` is deliberately NOT in the Android App Link filter — the
            app would swallow the link and show less than this page does. */}
        <a
          href={APP_SCHEME_URL}
          className="mt-6 flex w-full items-center justify-center rounded-xl bg-brand-500 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-600"
        >
          {t('publicShare.event.openInApp')}
        </a>

        {/* Straight to the download page server.js serves: it already picks the
            right store per device and says, in so many words, that iOS is a
            TestFlight beta. Duplicating those buttons here would mean a second
            copy of the store URLs to keep in step. */}
        <a
          href={DOWNLOAD_PATH}
          className="mt-3 block text-center text-sm font-medium text-brand-600 hover:underline"
        >
          {t('publicShare.event.dontHaveApp')}
        </a>
      </Card>
    </PublicShell>
  );
}
