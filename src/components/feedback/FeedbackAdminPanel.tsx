import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { listFeedback } from '@/services/feedbackService'
import { toastError } from '@/stores/toastStore'
import type { FeedbackRow } from '@/types/database'

/**
 * Only ever shows rows for the app owner's account — enforced by the
 * `feedback_select_owner` RLS policy, not by this component. Anyone else
 * simply gets an empty list back from Supabase.
 */
export function FeedbackAdminPanel() {
  const { t, i18n } = useTranslation()
  const [items, setItems] = useState<FeedbackRow[] | null>(null)

  useEffect(() => {
    listFeedback()
      .then(setItems)
      .catch((err) => toastError(err))
  }, [])

  return (
    <Card className="p-5">
      <h2 className="mb-3 text-sm font-semibold text-ink-700">{t('feedback.adminTitle')}</h2>
      {items === null ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-500">{t('feedback.adminEmpty')}</p>
      ) : (
        <div className="flex max-h-96 flex-col gap-3 overflow-y-auto pr-1">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-cream-200 p-3">
              <p className="whitespace-pre-line text-sm text-ink-700">{item.message}</p>
              <p className="mt-2 text-xs text-ink-500">
                {t('feedback.adminFrom', { email: item.user_email ?? '—', page: item.page_path ?? '—' })}
                {' · '}
                {new Date(item.created_at).toLocaleString(i18n.resolvedLanguage)}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
