import { useTranslation } from 'react-i18next'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { personFullName } from '@/utils/mappers'
import type { Person, QuickAddKind } from '@/types/models'

interface PersonActionSheetProps {
  open: boolean
  person: Person | null
  canEdit: boolean
  onClose: () => void
  onViewProfile: () => void
  onEdit: () => void
  onQuickAdd: (kind: QuickAddKind) => void
  onDelete: () => void
}

function ActionRow({ icon, label, onClick, danger }: { icon: string; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm hover:bg-cream-100 ${
        danger ? 'text-red-600' : 'text-ink-700'
      }`}
    >
      <span className="text-lg">{icon}</span>
      {label}
    </button>
  )
}

export function PersonActionSheet({
  open,
  person,
  canEdit,
  onClose,
  onViewProfile,
  onEdit,
  onQuickAdd,
  onDelete,
}: PersonActionSheetProps) {
  const { t } = useTranslation()
  if (!person) return null

  return (
    <Modal open={open} onClose={onClose} title={t('tree.actionsFor', { name: personFullName(person) })} size="sm">
      <div className="mb-3 flex items-center gap-3 border-b border-cream-200 pb-4">
        <Avatar photoUrl={person.photoUrl} firstName={person.firstName} lastName={person.lastName} gender={person.gender} size="lg" />
        <div>
          <p className="font-semibold text-ink-700">{personFullName(person)}</p>
        </div>
      </div>

      <div className="flex flex-col">
        <ActionRow icon="👤" label={t('tree.viewProfile')} onClick={onViewProfile} />
        {canEdit && (
          <>
            <ActionRow icon="✏️" label={t('common.edit')} onClick={onEdit} />
            <div className="my-1 border-t border-cream-200" />
            <ActionRow icon="⬆️" label={t('tree.addParent')} onClick={() => onQuickAdd('parent')} />
            <ActionRow icon="💍" label={t('tree.addPartner')} onClick={() => onQuickAdd('partner')} />
            <ActionRow icon="⬇️" label={t('tree.addChild')} onClick={() => onQuickAdd('child')} />
            <ActionRow icon="🧑‍🤝‍🧑" label={t('tree.addSibling')} onClick={() => onQuickAdd('sibling')} />
            <div className="my-1 border-t border-cream-200" />
            <ActionRow icon="🗑️" label={t('tree.deletePerson')} onClick={onDelete} danger />
          </>
        )}
      </div>
    </Modal>
  )
}
