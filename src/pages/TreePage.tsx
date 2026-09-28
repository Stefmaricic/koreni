import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ActivityLogModal } from '@/components/tree/ActivityLogModal'
import { ExportTreeModal } from '@/components/tree/ExportTreeModal'
import { ShareTreeModal } from '@/components/tree/ShareTreeModal'
import { FeedbackModal } from '@/components/feedback/FeedbackModal'
import { PersonActionSheet } from '@/components/tree/PersonActionSheet'
import { TreeCanvas } from '@/components/tree/TreeCanvas'
import { PersonFormModal } from '@/components/person/PersonFormModal'
import { PersonProfileModal } from '@/components/person/PersonProfileModal'
import { QuickAddPersonModal } from '@/components/person/QuickAddPersonModal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { useTreeData } from '@/hooks/useTreeData'
import { useTreeStyle } from '@/hooks/useTreeStyle'
import { deletePersonPhoto } from '@/services/storageService'
import { createPerson, deletePerson } from '@/services/personService'
import { addParentChild, addPartner } from '@/services/relationshipService'
import { toastError } from '@/stores/toastStore'
import { useAuthStore } from '@/stores/authStore'
import { personFullName } from '@/utils/mappers'
import type { MemberGender, Person, QuickAddKind } from '@/types/models'

type SheetState =
  | { mode: 'actions'; personId: string }
  | { mode: 'profile'; personId: string }
  | { mode: 'edit'; personId: string }
  | { mode: 'create' }
  | { mode: 'quickAdd'; personId: string; kind: QuickAddKind }
  | { mode: 'delete'; personId: string }
  | null

export function TreePage() {
  const { treeId } = useParams<{ treeId: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id)
  const { tree, graph, role, canEdit, loading, error, refresh } = useTreeData(treeId)

  const [sheet, setSheet] = useState<SheetState>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [treeStyle, setTreeStyle] = useTreeStyle(treeId)
  const [exportOpen, setExportOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const searchResults = useMemo(() => {
    if (!search.trim()) return []
    const q = search.trim().toLowerCase()
    return [...graph.people.values()]
      .filter((p) => personFullName(p).toLowerCase().includes(q))
      .slice(0, 8)
  }, [search, graph])

  if (loading) return <FullPageSpinner />

  if (error || !tree) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-50 px-4">
        <EmptyState
          title={t('errors.unauthorized')}
          action={
            <Link to="/dashboard" className="text-sm font-medium text-root-600 hover:underline">
              {t('errors.goToDashboard')}
            </Link>
          }
        />
      </div>
    )
  }

  const openActions = (personId: string) => {
    setSelectedId(personId)
    setSheet({ mode: 'actions', personId })
  }

  const handleQuickAdd = async (kind: QuickAddKind, values: { firstName: string; lastName: string; gender: MemberGender }) => {
    if (!treeId || !userId || sheet?.mode !== 'quickAdd') return
    const targetId = sheet.personId
    setBusy(true)
    let created: Person | null = null
    try {
      created = await createPerson(
        treeId,
        {
          firstName: values.firstName,
          lastName: values.lastName,
          maidenName: '',
          gender: values.gender,
          birthDate: '',
          birthPlace: '',
          deathDate: '',
          deathPlace: '',
          bio: '',
        },
        userId,
      )

      if (kind === 'parent') {
        await addParentChild(treeId, created.id, targetId)
      } else if (kind === 'partner') {
        await addPartner(treeId, targetId, created.id)
      } else if (kind === 'child') {
        await addParentChild(treeId, targetId, created.id)
      } else if (kind === 'sibling') {
        const parentIds = graph.parentIds(targetId)
        if (parentIds.length === 0) {
          toastError(new Error(t('person.noRelatives')))
        } else {
          for (const parentId of parentIds) {
            await addParentChild(treeId, parentId, created.id)
          }
        }
      }

      await refresh()
      setSelectedId(created.id)
      setSheet(null)
    } catch (err) {
      if (created) await deletePerson(created.id).catch(() => {})
      toastError(err)
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (personId: string) => {
    setBusy(true)
    try {
      const person = graph.people.get(personId)
      await deletePerson(personId)
      if (person?.photoUrl) await deletePersonPhoto(person.photoUrl).catch(() => {})
      await refresh()
      setSheet(null)
      setSelectedId(null)
    } catch (err) {
      toastError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-screen flex-col bg-cream-50">
      <header className="flex items-center gap-3 border-b border-cream-200 bg-cream-50 px-3 py-2.5">
        <button
          onClick={() => navigate('/dashboard')}
          className="rounded-full p-2 text-ink-600 hover:bg-cream-100"
          aria-label={t('common.back')}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M12 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <h1 className="flex min-w-0 flex-1 items-center gap-2 truncate font-display text-base font-semibold text-ink-700 sm:text-lg">
          <span className="truncate">{tree.name}</span>
          {role === null && (
            <span className="shrink-0 rounded-full bg-earth-100 px-2 py-0.5 text-xs font-medium text-earth-600 dark:bg-earth-600/30 dark:text-earth-200">
              {t('tree.adminPreview')}
            </span>
          )}
        </h1>

        <div className="relative w-40 sm:w-64">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('tree.searchPlaceholder')}
            className="w-full rounded-full border border-cream-300 bg-surface px-3.5 py-1.5 text-sm focus:border-root-400 focus:outline-none focus:ring-2 focus:ring-root-200"
          />
          {searchResults.length > 0 && (
            <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-xl border border-cream-200 bg-surface py-1 shadow-lg">
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSearch('')
                    openActions(p.id)
                  }}
                  className="block w-full px-3.5 py-2 text-left text-sm text-ink-700 hover:bg-cream-100"
                >
                  {personFullName(p)}
                </button>
              ))}
            </div>
          )}
        </div>

        {graph.people.size > 0 && (
          <button
            onClick={() => setExportOpen(true)}
            aria-label={t('tree.export')}
            title={t('tree.export')}
            className="rounded-full p-2 text-ink-600 hover:bg-cream-100"
          >
            <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M10 2.5v10M10 12.5l-3.5-3.5M10 12.5l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3.5 14v1.5a2 2 0 002 2h9a2 2 0 002-2V14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        {role !== null && (
          <button
            onClick={() => setHistoryOpen(true)}
            aria-label={t('tree.history')}
            title={t('tree.history')}
            className="rounded-full p-2 text-ink-600 hover:bg-cream-100"
          >
            <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M4 10a6 6 0 106-6" strokeLinecap="round" />
              <path d="M4 4v4h4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 7v3.5l2.5 1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        {role === 'owner' && (
          <button
            onClick={() => setShareOpen(true)}
            aria-label={t('tree.share')}
            title={t('tree.share')}
            className="rounded-full p-2 text-ink-600 hover:bg-cream-100"
          >
            <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <circle cx="15" cy="4.5" r="2" />
              <circle cx="5" cy="10" r="2" />
              <circle cx="15" cy="15.5" r="2" />
              <path d="M6.7 8.9l6.6-3.3M6.7 11.1l6.6 3.3" strokeLinecap="round" />
            </svg>
          </button>
        )}

        {canEdit && (
          <button
            onClick={() => setSheet({ mode: 'create' })}
            className="rounded-full bg-root-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-root-700"
          >
            + {t('tree.addPerson')}
          </button>
        )}
      </header>

      <div className="relative flex-1">
        <TreeCanvas
          graph={graph}
          style={treeStyle}
          onStyleChange={setTreeStyle}
          selectedId={selectedId}
          onSelectPerson={openActions}
          onAddFirstPerson={() => setSheet({ mode: 'create' })}
          onOpenFeedback={() => setFeedbackOpen(true)}
          canEdit={canEdit}
        />
      </div>

      <PersonActionSheet
        open={sheet?.mode === 'actions'}
        person={sheet?.mode === 'actions' ? graph.people.get(sheet.personId) ?? null : null}
        canEdit={canEdit}
        onClose={() => setSheet(null)}
        onViewProfile={() => sheet?.mode === 'actions' && setSheet({ mode: 'profile', personId: sheet.personId })}
        onEdit={() => sheet?.mode === 'actions' && setSheet({ mode: 'edit', personId: sheet.personId })}
        onQuickAdd={(kind) => sheet?.mode === 'actions' && setSheet({ mode: 'quickAdd', personId: sheet.personId, kind })}
        onDelete={() => sheet?.mode === 'actions' && setSheet({ mode: 'delete', personId: sheet.personId })}
      />

      <PersonProfileModal
        open={sheet?.mode === 'profile'}
        person={sheet?.mode === 'profile' ? graph.people.get(sheet.personId) ?? null : null}
        graph={graph}
        canEdit={canEdit}
        onClose={() => setSheet(null)}
        onEdit={() => sheet?.mode === 'profile' && setSheet({ mode: 'edit', personId: sheet.personId })}
        onDelete={() => sheet?.mode === 'profile' && setSheet({ mode: 'delete', personId: sheet.personId })}
        onSelectPerson={(id) => {
          setSelectedId(id)
          setSheet({ mode: 'profile', personId: id })
        }}
      />

      {treeId && (
        <PersonFormModal
          open={sheet?.mode === 'edit' || sheet?.mode === 'create'}
          mode={sheet?.mode === 'edit' ? 'edit' : 'create'}
          treeId={treeId}
          person={sheet?.mode === 'edit' ? graph.people.get(sheet.personId) ?? null : null}
          onClose={() => setSheet(null)}
          onSaved={async (person) => {
            await refresh()
            setSelectedId(person.id)
            setSheet(null)
          }}
        />
      )}

      <QuickAddPersonModal
        open={sheet?.mode === 'quickAdd'}
        kind={sheet?.mode === 'quickAdd' ? sheet.kind : null}
        loading={busy}
        onSubmit={(values) => sheet?.mode === 'quickAdd' && handleQuickAdd(sheet.kind, values)}
        onClose={() => setSheet(null)}
      />

      <ExportTreeModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        graph={graph}
        style={treeStyle}
        treeName={tree.name}
      />

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />

      {treeId && <ShareTreeModal open={shareOpen} onClose={() => setShareOpen(false)} treeId={treeId} />}

      {treeId && <ActivityLogModal open={historyOpen} onClose={() => setHistoryOpen(false)} treeId={treeId} />}

      <ConfirmDialog
        open={sheet?.mode === 'delete'}
        title={t('tree.deletePerson')}
        body={t('tree.deletePersonBody', {
          name: sheet?.mode === 'delete' ? personFullName(graph.people.get(sheet.personId) ?? ({} as Person)) : '',
        })}
        confirmLabel={t('common.delete')}
        danger
        loading={busy}
        onConfirm={() => sheet?.mode === 'delete' && handleDelete(sheet.personId)}
        onCancel={() => setSheet(null)}
      />
    </div>
  )
}
