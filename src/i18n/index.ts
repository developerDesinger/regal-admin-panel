import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en/translation.json';
import es from './locales/es/translation.json';

/**
 * Localization (i18next + react-i18next).
 *
 * English is the default and the fallback: a key missing from Spanish renders
 * the English string rather than the raw key, so a gap degrades to readable
 * text instead of `settings.thresholds.title` leaking into the UI.
 *
 * The chosen language is persisted to localStorage under `regal:language`,
 * which is why the detector runs before navigator sniffing — an explicit
 * choice must survive a refresh and outrank the browser's preference.
 */

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

export const LANGUAGE_STORAGE_KEY = 'regal:language';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
    },
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    // `es-MX` and `es-419` should both resolve to `es` rather than falling
    // through to English.
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
    interpolation: {
      // React escapes for us; double-escaping would render &amp; literally.
      escapeValue: false,
    },
    returnNull: false,
  });

/** Keeps <html lang> in step so screen readers announce in the right language. */
export function syncDocumentLanguage(lng: string) {
  document.documentElement.lang = lng;
}

i18n.on('languageChanged', syncDocumentLanguage);
syncDocumentLanguage(i18n.resolvedLanguage ?? 'en');

export default i18n;
