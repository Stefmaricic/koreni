import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { AppHeader } from '@/components/layout/AppHeader'
import { TreeCard } from '@/components/dashboard/TreeCard'
import { TreeFormDialog } from '@/components/dashboard/TreeFormDialog'
import { WhatsNewPanel } from '@/components/dashboard/WhatsNewPanel'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { useMyTrees } from '@/hooks/useMyTrees'
import { seedDemoTree } from '@/services/demoService'
import { createTree, deleteTree, renameTree } from '@/services/treeService'
import { useAuthStore } from '@/stores/authStore'
import { toastError } from '@/stores/toastStore'
import type { FamilyTreeSummary } from '@/types/models'

const TRELLO_BOARD_URL = 'https://trello.com/b/kIq0hOO2/my-trello-board'

export function DashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id)
  const { trees, loading, refresh } = useMyTrees()

  const [createOpen, setCreateOpen] = useState(false)
  const [renaming, setRenaming] = useState<FamilyTreeSummary | null>(null)
  const [deleting, setDeleting] = useState<FamilyTreeSummary | null>(null)
  const [saving, setSaving] = useState(false)
  const [seedingDemo, setSeedingDemo] = useState(false)

  const handleCreate = async ({ name, description }: { name: string; description: string }) => {
    if (!userId) return
    setSaving(true)
    try {
      const tree = await createTree(userId, name, description)
      setCreateOpen(false)
      navigate(`/tree/${tree.id}`)
    } catch (err) {
      toastError(err)
    } finally {
      setSaving(false)
    }
  }

  const handleRename = async ({ name }: { name: string }) => {
    if (!renaming) return
    setSaving(true)
    try {
      await renameTree(renaming.id, name)
      setRenaming(null)
      await refresh()
    } catch (err) {
      toastError(err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setSaving(true)
    try {
      await deleteTree(deleting.id)
      setDeleting(null)
      await refresh()
    } catch (err) {
      toastError(err)
    } finally {
      setSaving(false)
    }
  }

  const handleTryDemo = async () => {
    if (!userId) return
    setSeedingDemo(true)
    try {
      const treeId = await seedDemoTree(userId, t('dashboard.demoTreeName'))
      navigate(`/tree/${treeId}`)
    } catch (err) {
      toastError(err)
    } finally {
      setSeedingDemo(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream-50">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink-700">{t('dashboard.title')}</h1>
            <p className="mt-1 text-sm text-ink-500">{t('dashboard.subtitle')}</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>+ {t('dashboard.newTree')}</Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:items-start">
          <div className="flex flex-col gap-2">
            <WhatsNewPanel />
            <a
              href={TRELLO_BOARD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-1 text-xs text-ink-500 hover:text-root-600 hover:underline"
            >
              <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="shrink-0">
                <path d="M7 13l6-6M13 4h3v3M9 4H6a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t('dashboard.trackerLink')}
            </a>
          </div>

          <div>
            {loading ? (
              <div className="flex justify-center py-20">
                <Spinner />
              </div>
            ) : trees.length === 0 ? (
              <EmptyState
                icon={<span className="text-4xl">🌳</span>}
                title={t('dashboard.empty')}
                body={t('dashboard.emptyCta')}
                action={
                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    <Button onClick={() => setCreateOpen(true)}>+ {t('dashboard.newTree')}</Button>
                    <Button variant="secondary" loading={seedingDemo} onClick={handleTryDemo}>
                      {t('dashboard.tryDemo')}
                    </Button>
                  </div>
                }
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {trees.map((tree) => (
                  <TreeCard
                    key={tree.id}
                    tree={tree}
                    onRename={() => setRenaming(tree)}
                    onDelete={() => setDeleting(tree)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <TreeFormDialog
        open={createOpen}
        mode="create"
        loading={saving}
        onSubmit={handleCreate}
        onClose={() => setCreateOpen(false)}
      />

      <TreeFormDialog
        open={Boolean(renaming)}
        mode="rename"
        initialName={renaming?.name}
        loading={saving}
        onSubmit={handleRename}
        onClose={() => setRenaming(null)}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title={t('dashboard.deleteTitle')}
        body={t('dashboard.deleteBody', { name: deleting?.name ?? '' })}
        confirmLabel={t('common.delete')}
        danger
        loading={saving}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
