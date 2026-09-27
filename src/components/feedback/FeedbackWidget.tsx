import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { FeedbackModal } from '@/components/feedback/FeedbackModal'
import { useAuthStore } from '@/stores/authStore'

/**
 * Rendered once, globally, for the lifetime of the app. Only shown when
 * signed in. On a tree page it sits higher up than usual so it doesn't
 * overlap the tree canvas's own zoom/style/theme button stack, which lives
 * in that same bottom-right corner.
 */
export function FeedbackWidget() {
  const { t } = useTranslation()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const [open, setOpen] = useState(false)

  if (!user) return null

  const isTreePage = location.pathname.startsWith('/tree/')

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('feedback.button')}
        className={`fixed right-4 z-40 flex items-center gap-2 rounded-full border border-cream-300 bg-surface px-3 py-2.5 text-sm font-medium text-ink-700 shadow-lg hover:bg-cream-100 sm:px-4 ${
          isTreePage ? 'bottom-64' : 'bottom-4'
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="shrink-0">
          <path
            d="M4 15.5V6a2 2 0 012-2h8a2 2 0 012 2v6a2 2 0 01-2 2H8l-3.2 2.7a.5.5 0 01-.8-.4z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="hidden sm:inline">{t('feedback.button')}</span>
      </button>

      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
