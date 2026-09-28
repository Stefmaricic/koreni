import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Input'
import { claimPerson, declineIdentityClaim, listClaimedPersonIds } from '@/services/inviteService'
import { toastError } from '@/stores/toastStore'
import { personFullName } from '@/utils/mappers'
import type { Person } from '@/types/models'

interface ClaimIdentityModalProps {
  open: boolean
  onClose: () => void
  treeId: string
  people: Person[]
  onResolved: () => void
}

/**
 * Shown to an 'editor' member who hasn't said which person on the tree they
 * are yet (gate: role === 'editor' && claimedPersonId === null, see
 * useTreeData). Non-blocking on purpose -- closable without deciding, and
 * re-offered next visit by that same gate, rather than trapping the app.
 */
export function ClaimIdentityModal({ open, onClose, treeId, people, onResolved }: ClaimIdentityModalProps) {
  const { t } = useTranslation()
  const [claimedIds, setClaimedIds] = useState<Set<string> | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [notOnList, setNotOnList] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setSelectedId('')
    setNotOnList(false)
    listClaimedPersonIds(treeId)
      .then((ids) => setClaimedIds(new Set(ids)))
      .catch((err) => toastError(err))
  }, [open, treeId])

  const available = claimedIds
    ? [...people].filter((p) => !claimedIds.has(p.id)).sort((a, b) => personFullName(a).localeCompare(personFullName(b)))
    : []

  const canConfirm = notOnList || selectedId !== ''

  const handleConfirm = async () => {
    setBusy(true)
    try {
      if (notOnList) {
        await declineIdentityClaim(treeId)
      } else {
        await claimPerson(treeId, selectedId)
      }
      onResolved()
    } catch (err) {
      toastError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('tree.claimTitle')} size="sm">
      <p className="mb-4 text-sm text-ink-500">{t('tree.claimBody')}</p>

      <div className="flex flex-col gap-3">
        <Select
          label={t('tree.claimWhoAmI')}
          value={selectedId}
          onChange={setSelectedId}
          disabled={notOnList || claimedIds === null}
          options={[
            { value: '', label: t('tree.claimSelectPlaceholder') },
            ...available.map((p) => ({ value: p.id, label: personFullName(p) })),
          ]}
        />

        <label className="flex items-center gap-2 text-sm text-ink-600">
          <input
            type="checkbox"
            checked={notOnList}
            onChange={(e) => setNotOnList(e.target.checked)}
            className="h-4 w-4 rounded border-cream-300 text-root-600 focus:ring-root-400"
          />
          {t('tree.claimNotOnList')}
        </label>

        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t('tree.claimLater')}
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm} loading={busy}>
            {t('common.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
