import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import srCyrl from '@/locales/sr-Cyrl.json'
import srLatn from '@/locales/sr-Latn.json'

export const SUPPORTED_LANGUAGES = [
  { code: 'sr-Cyrl', label: 'Српски (ћирилица)', flag: '🇷🇸' },
  { code: 'sr-Latn', label: 'Srpski (latinica)', flag: '🇷🇸' },
] as const

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code']

const DEFAULT_LANGUAGE: LanguageCode = 'sr-Cyrl'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'sr-Cyrl': { translation: srCyrl },
      'sr-Latn': { translation: srLatn },
    },
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    interpolation: { escapeValue: false },
    detection: {
      // Only ever trust a language the person explicitly picked before.
      // Otherwise always start on the configured default (Serbian Cyrillic)
      // rather than guessing from the browser's locale.
      order: ['localStorage'],
      caches: ['localStorage'],
      lookupLocalStorage: 'koreni.language',
    },
  })

// Keep <html lang="..."> in sync for accessibility/screen readers.
const syncHtmlLang = (lng: string) => {
  document.documentElement.lang = lng
}
i18n.on('languageChanged', syncHtmlLang)
if (i18n.resolvedLanguage) syncHtmlLang(i18n.resolvedLanguage)

export default i18n
