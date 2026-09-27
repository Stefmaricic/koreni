import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { FeedbackModal } from '@/components/feedback/FeedbackModal'
import { useAuthStore } from '@/stores/authStore'

export function FeedbackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="shrink-0">
      <path
        d="M4 15.5V6a2 2 0 012-2h8a2 2 0 012 2v6a2 2 0 01-2 2H8l-3.2 2.7a.5.5 0 01-.8-.4z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Rendered once, globally, for the lifetime of the app, but only shown when
 * signed in AND not on a tree page — the tree page has its own feedback
 * trigger built into the canvas's zoom/style/theme button stack instead
 * (same bottom-right corner, so a second floating button there would
 * either overlap it or need fragile pixel-offset math to avoid it).
 */
export function FeedbackWidget() {
  const { t } = useTranslation()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const [open, setOpen] = useState(false)

  if (!user || location.pathname.startsWith('/tree/')) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('feedback.button')}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-cream-300 bg-surface px-3 py-2.5 text-sm font-medium text-ink-700 shadow-lg hover:bg-cream-100 sm:px-4"
      >
        <FeedbackIcon />
        <span className="hidden sm:inline">{t('feedback.button')}</span>
      </button>

      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
