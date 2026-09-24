import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { formatRelativeDate } from '@/utils/formatDate'
import type { FamilyTreeSummary } from '@/types/models'

interface TreeCardProps {
  tree: FamilyTreeSummary
  onRename: () => void
  onDelete: () => void
}

/** A small decorative row of dots hinting at generations, without the cost of rendering a real tree preview. */
function TreeGlyph({ memberCount }: { memberCount: number }) {
  const rows = memberCount === 0 ? 0 : memberCount < 4 ? 1 : memberCount < 10 ? 2 : 3
  return (
    <div className="flex h-14 flex-col items-center justify-center gap-1.5">
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex gap-1.5">
          {Array.from({ length: row + 2 }).map((_, i) => (
            <span key={i} className="h-2 w-2 rounded-full bg-root-300" />
          ))}
        </div>
      ))}
      {rows === 0 && <span className="text-2xl">🌱</span>}
    </div>
  )
}

export function TreeCard({ tree, onRename, onDelete }: TreeCardProps) {
  const { t, i18n } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <Card className="relative flex flex-col gap-3 p-5">
      <div className="absolute right-3 top-3">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={t('common.edit')}
          className="rounded-full p-1.5 text-ink-500 hover:bg-cream-100"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
            <circle cx="10" cy="4" r="1.6" />
            <circle cx="10" cy="10" r="1.6" />
            <circle cx="10" cy="16" r="1.6" />
          </svg>
        </button>
        {menuOpen && (
          <>
            <button className="fixed inset-0 z-10 cursor-default" aria-hidden onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 z-20 mt-1 w-40 rounded-xl border border-cream-200 bg-white py-1 shadow-lg">
              <button
                onClick={() => {
                  setMenuOpen(false)
                  onRename()
                }}
                className="block w-full px-4 py-2 text-left text-sm text-ink-600 hover:bg-cream-100"
              >
                {t('dashboard.rename')}
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false)
                  onDelete()
                }}
                className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-cream-100"
              >
                {t('common.delete')}
              </button>
            </div>
          </>
        )}
      </div>

      <TreeGlyph memberCount={tree.memberCount} />

      <div>
        <h3 className="font-display text-lg font-semibold text-ink-700">{tree.name}</h3>
        {tree.description && <p className="mt-0.5 line-clamp-2 text-sm text-ink-500">{tree.description}</p>}
      </div>

      <div className="flex items-center justify-between text-xs text-ink-500">
        <span>{t('dashboard.peopleCount', { count: tree.memberCount })}</span>
        <span>{t('dashboard.updatedAt', { date: formatRelativeDate(tree.updatedAt, i18n.resolvedLanguage ?? 'sr-Cyrl') })}</span>
      </div>

      <Link
        to={`/tree/${tree.id}`}
        className="mt-1 inline-flex items-center justify-center rounded-full bg-root-50 px-4 py-2 text-sm font-medium text-root-700 hover:bg-root-100"
      >
        {t('dashboard.open')}
      </Link>
    </Card>
  )
}
