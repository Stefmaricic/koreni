import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES } from '@/lib/i18n'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n } = useTranslation()
  const user = useAuthStore((s) => s.user)

  const changeLanguage = async (code: string) => {
    await i18n.changeLanguage(code)
    if (user) {
      await supabase.from('profiles').update({ preferred_language: code }).eq('id', user.id)
    }
  }

  return (
    <div className={className}>
      <label className="sr-only" htmlFor="language-switcher">
        Language
      </label>
      <select
        id="language-switcher"
        value={i18n.resolvedLanguage}
        onChange={(e) => changeLanguage(e.target.value)}
        className="rounded-full border border-cream-300 bg-cream-50 px-3 py-1.5 text-sm text-ink-600 focus:outline-none focus:ring-2 focus:ring-root-200"
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.label}
          </option>
        ))}
      </select>
    </div>
  )
}
