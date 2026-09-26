import { useTranslation } from 'react-i18next'
import { useThemeStore, type Theme } from '@/stores/themeStore'

export function ThemeIcon({ theme }: { theme: Theme }) {
  return theme === 'dark' ? (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="10" cy="10" r="4" />
      <path
        d="M10 1.5v2M10 16.5v2M18.5 10h-2M3.5 10h-2M15.6 4.4l-1.4 1.4M5.8 14.2l-1.4 1.4M15.6 15.6l-1.4-1.4M5.8 5.8L4.4 4.4"
        strokeLinecap="round"
      />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
      <path d="M17.3 13.6A7.8 7.8 0 018 4.3c0-.7.1-1.3.2-1.9a.6.6 0 00-.8-.7A8.5 8.5 0 1018 14.1a.6.6 0 00-.7-.5z" />
    </svg>
  )
}

export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useTranslation()
  const theme = useThemeStore((s) => s.theme)
  const toggle = useThemeStore((s) => s.toggle)
  const label = theme === 'dark' ? t('common.switchToLight') : t('common.switchToDark')

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-full border border-cream-300 bg-cream-50 text-ink-600 hover:bg-cream-100 ${className ?? ''}`}
    >
      <ThemeIcon theme={theme} />
    </button>
  )
}
