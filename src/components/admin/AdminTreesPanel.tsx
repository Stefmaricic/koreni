import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { listAllTreesForAdmin, type AdminTreeSummary } from '@/services/treeService'
import { toastError } from '@/stores/toastStore'
import { formatRelativeDate } from '@/utils/formatDate'

/**
 * Only ever lists trees the app owner can see — enforced by the
 * family_trees_select_admin RLS policy, not by this component. Opening one
 * reuses the normal tree page: with no membership row for it, the owner
 * automatically gets a read-only view (see getMyRole in treeService.ts).
 */
export function AdminTreesPanel() {
  const { t, i18n } = useTranslation()
  const [items, setItems] = useState<AdminTreeSummary[] | null>(null)

  useEffect(() => {
    listAllTreesForAdmin()
      .then(setItems)
      .catch((err) => toastError(err))
  }, [])

  return (
    <Card className="p-5">
      <h2 className="mb-3 text-sm font-semibold text-ink-700">{t('settings.adminTreesTitle')}</h2>
      {items === null ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-500">{t('settings.adminTreesEmpty')}</p>
      ) : (
        <div className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
          {items.map((tree) => (
            <Link
              key={tree.id}
              to={`/tree/${tree.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-cream-200 p-3 hover:bg-cream-100"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-700">{tree.name}</p>
                <p className="mt-0.5 text-xs text-ink-500">
                  {t('settings.adminTreesOwner', { name: tree.ownerName ?? t('common.unknown') })}
                  {' · '}
                  {t('dashboard.peopleCount', { count: tree.memberCount })}
                </p>
              </div>
              <span className="shrink-0 text-xs text-ink-500">
                {formatRelativeDate(tree.updatedAt, i18n.resolvedLanguage ?? 'sr-Cyrl')}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}
