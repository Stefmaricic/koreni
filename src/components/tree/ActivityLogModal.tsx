import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { listActivity, type ActivityEntry } from '@/services/activityService'
import { formatRelativeDate } from '@/utils/formatDate'
import { toastError } from '@/stores/toastStore'

interface ActivityLogModalProps {
  open: boolean
  onClose: () => void
  treeId: string
}

const TRACKED_FIELDS = [
  'first_name',
  'last_name',
  'maiden_name',
  'gender',
  'birth_date',
  'birth_place',
  'death_date',
  'death_place',
  'bio',
] as const

function fieldLabelKey(field: string): string {
  const camel = field.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
  return `activity.field.${camel}`
}

function ActivityLine({ entry }: { entry: ActivityEntry }) {
  const { t, i18n } = useTranslation()
  const actor = entry.actorName ?? t('activity.unknownActor')

  let text: string
  if (entry.action === 'person_added') {
    text = t('activity.personAdded', { actor, name: entry.personName })
  } else if (entry.action === 'person_removed') {
    text = t('activity.personRemoved', { actor, name: entry.personName })
  } else {
    const changedFields = TRACKED_FIELDS.filter((f) => entry.details?.[f]).map((f) => t(fieldLabelKey(f)))
    text = t('activity.personUpdated', {
      actor,
      name: entry.personName,
      fields: changedFields.join(', '),
    })
  }

  return (
    <div className="flex flex-col gap-0.5 border-b border-cream-200 py-2.5 last:border-0">
      <span className="text-sm text-ink-700">{text}</span>
      <span className="text-xs text-ink-500">{formatRelativeDate(entry.createdAt, i18n.resolvedLanguage ?? 'sr-Cyrl')}</span>
    </div>
  )
}

export function ActivityLogModal({ open, onClose, treeId }: ActivityLogModalProps) {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null)

  useEffect(() => {
    if (!open) return
    setEntries(null)
    listActivity(treeId)
      .then(setEntries)
      .catch((err) => {
        toastError(err, t('tree.historyLoadError'))
        setEntries([])
      })
  }, [open, treeId, t])

  return (
    <Modal open={open} onClose={onClose} title={t('tree.historyTitle')} size="md">
      {entries === null ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : entries.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-500">{t('tree.historyEmpty')}</p>
      ) : (
        <div className="flex max-h-[60vh] flex-col overflow-y-auto">
          {entries.map((entry) => (
            <ActivityLine key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </Modal>
  )
}
