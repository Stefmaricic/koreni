import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/ui/EmptyState'

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-50 px-4">
      <EmptyState
        icon={<span className="text-4xl">🍂</span>}
        title={t('errors.notFound')}
        action={
          <Link to="/dashboard" className="text-sm font-medium text-root-600 hover:underline">
            {t('errors.goToDashboard')}
          </Link>
        }
      />
    </div>
  )
}
