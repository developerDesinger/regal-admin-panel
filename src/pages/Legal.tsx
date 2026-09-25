import { useTranslation } from 'react-i18next';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import en from '@/legal/en.json';
import es from '@/legal/es.json';

/**
 * Public Privacy Policy and Terms & Conditions.
 *
 * The text is the mobile app's own (`privacyPolicy` / `termsAndConditions` in
 * RegalMobileApp/src/locales), copied into `src/legal` so the store listings
 * can link to a public URL that says exactly what the app says. Update both
 * together.
 *
 * Unauthenticated and outside the shell, like the login screens.
 */

type Doc = 'privacy' | 'terms';
type Lang = 'en' | 'es';
type Node = string | string[] | { [key: string]: Node };

const DOCS: Record<Lang, Record<Doc, Record<string, Node>>> = { en, es };

/** Labelled in their own language, as in the app's terms screen. */
const VERSIONS: { code: Lang; label: string }[] = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
];

/** `{ "0": "…", "1": "…" }` — how the app's privacy policy stores its bullets. */
const isIndexed = (v: Node): v is Record<string, string> =>
  typeof v === 'object' && !Array.isArray(v) && Object.keys(v).every((k) => /^\d+$/.test(k));

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

/** Renders one section in key order; the key names carry the app's emphasis. */
function Section({ section, boxed }: { section: Record<string, Node>; boxed?: boolean }) {
  const { title, ...rest } = section;
  return (
    <section
      className={cn(
        'space-y-3 border-b border-neutral-200 pb-6',
        boxed && 'rounded-lg border border-brand-500/20 bg-brand-500/5 p-5',
      )}
    >
      {typeof title === 'string' && (
        <h2 className="text-[18px] font-semibold text-brand-600">{title}</h2>
      )}
      {Object.entries(rest).map(([key, value]) => {
        if (Array.isArray(value)) {
          // The terms' intro is two paragraphs; every other list is bullets.
          return key === 'content' ? (
            value.map((p, i) => <p key={`${key}${i}`}>{p}</p>)
          ) : (
            <Bullets key={key} items={value} />
          );
        }
        if (isIndexed(value)) return <Bullets key={key} items={Object.values(value)} />;
        if (typeof value !== 'string') return null;
        if (/^q\d+$/.test(key)) {
          return (
            <h3 key={key} className="pt-2 font-semibold text-brand-600">
              {value}
            </h3>
          );
        }
        if (/Title$/.test(key) || key === 'fee' || key === 'minorAge') {
          return (
            <p key={key} className="font-medium text-neutral-900">
              {value}
            </p>
          );
        }
        if (key === 'a2Disclaimer') {
          return (
            <p key={key} className="text-caption text-neutral-500">
              {value}
            </p>
          );
        }
        return <p key={key}>{value}</p>;
      })}
    </section>
  );
}

export default function Legal({ doc }: { doc: Doc }) {
  const { t, i18n } = useTranslation();
  const [lang, setLang] = React.useState<Lang>(i18n.language?.startsWith('es') ? 'es' : 'en');
  const { title, lastUpdated, ...sections } = DOCS[lang][doc];

  React.useEffect(() => {
    document.title = `${title as string} · RegalApp`;
  }, [title]);

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-10">
      <main className="mx-auto w-full max-w-[760px]">
        <Link
          to="/login"
          className="mb-6 inline-flex items-center gap-1.5 rounded-sm text-[13px] font-medium text-brand-500 transition-colors hover:text-brand-600"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t('auth.backToSignIn')}
        </Link>

        <div className="rounded-lg bg-neutral-0 p-6 shadow-e2 sm:p-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-page-title text-neutral-900">{title as string}</h1>
              <p className="mt-1 text-body text-neutral-500">{lastUpdated as string}</p>
            </div>
            <div role="radiogroup" className="flex gap-2">
              {VERSIONS.map((v) => (
                <button
                  key={v.code}
                  type="button"
                  role="radio"
                  aria-checked={v.code === lang}
                  lang={v.code}
                  onClick={() => setLang(v.code)}
                  className={cn(
                    'rounded-full border px-4 py-1.5 text-[13px] transition-colors',
                    v.code === lang
                      ? 'border-brand-500 bg-brand-500/10 font-semibold text-brand-600'
                      : 'border-neutral-300 text-neutral-500 hover:text-neutral-700',
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div lang={lang} className="mt-8 space-y-6 text-body leading-relaxed text-neutral-700">
            {Object.entries(sections).map(([key, section]) => (
              <Section
                key={key}
                section={section as Record<string, Node>}
                boxed={key === 'fees'}
              />
            ))}
          </div>
        </div>

        <nav className="mt-6 flex justify-center gap-6 text-caption">
          <Link to="/privacy" className="text-brand-500 hover:text-brand-600">
            {t('auth.privacyPolicy')}
          </Link>
          <Link to="/terms" className="text-brand-500 hover:text-brand-600">
            {t('auth.termsAndConditions')}
          </Link>
        </nav>
      </main>
    </div>
  );
}
