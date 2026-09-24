import { useTranslation } from 'react-i18next'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import type { FamilyGraph } from '@/utils/familyGraph'
import { personFullName } from '@/utils/mappers'
import type { Person } from '@/types/models'

interface PersonProfileModalProps {
  open: boolean
  person: Person | null
  graph: FamilyGraph
  canEdit: boolean
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onSelectPerson: (personId: string) => void
}

function RelativeChip({ person, onClick }: { person: Person; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-full border border-cream-200 bg-cream-50 py-1 pl-1 pr-3 text-sm text-ink-700 hover:bg-cream-100"
    >
      <Avatar photoUrl={person.photoUrl} firstName={person.firstName} lastName={person.lastName} gender={person.gender} size="sm" />
      {personFullName(person)}
    </button>
  )
}

function RelativeSection({ label, people, onSelect }: { label: string; people: Person[]; onSelect: (id: string) => void }) {
  if (people.length === 0) return null
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</h4>
      <div className="flex flex-wrap gap-2">
        {people.map((p) => (
          <RelativeChip key={p.id} person={p} onClick={() => onSelect(p.id)} />
        ))}
      </div>
    </div>
  )
}

export function PersonProfileModal({
  open,
  person,
  graph,
  canEdit,
  onClose,
  onEdit,
  onDelete,
  onSelectPerson,
}: PersonProfileModalProps) {
  const { t } = useTranslation()
  if (!person) return null

  const parents = graph.parents(person.id)
  const partners = graph.partners(person.id)
  const children = graph.children(person.id)
  const siblings = graph.siblings(person.id)
  const hasRelatives = parents.length + partners.length + children.length + siblings.length > 0

  return (
    <Modal open={open} onClose={onClose} title={t('person.profileTitle')} size="lg">
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <Avatar photoUrl={person.photoUrl} firstName={person.firstName} lastName={person.lastName} gender={person.gender} size="xl" />
          <div>
            <h3 className="font-display text-xl font-semibold text-ink-700">{personFullName(person)}</h3>
            {person.maidenName && <p className="text-sm text-ink-500">{t('person.maidenName')}: {person.maidenName}</p>}
            <p className="text-sm text-ink-500">
              {person.birthDate && new Date(person.birthDate).toLocaleDateString()}
              {person.birthPlace ? ` · ${person.birthPlace}` : ''}
            </p>
            {person.deathDate && (
              <p className="text-sm text-ink-500">
                {t('person.deceased')}: {new Date(person.deathDate).toLocaleDateString()}
                {person.deathPlace ? ` · ${person.deathPlace}` : ''}
              </p>
            )}
          </div>
        </div>

        {person.bio && <p className="whitespace-pre-line text-sm text-ink-600">{person.bio}</p>}

        <div>
          <h4 className="mb-2 text-sm font-semibold text-ink-700">{t('person.family')}</h4>
          {hasRelatives ? (
            <div className="flex flex-col gap-3">
              <RelativeSection label={t('person.parents')} people={parents} onSelect={onSelectPerson} />
              <RelativeSection label={t('person.partners')} people={partners} onSelect={onSelectPerson} />
              <RelativeSection label={t('person.children')} people={children} onSelect={onSelectPerson} />
              <RelativeSection label={t('person.siblings')} people={siblings} onSelect={onSelectPerson} />
            </div>
          ) : (
            <p className="text-sm text-ink-500">{t('person.noRelatives')}</p>
          )}
        </div>

        {canEdit && (
          <div className="flex justify-end gap-2 border-t border-cream-200 pt-4">
            <Button variant="danger" onClick={onDelete}>
              {t('common.delete')}
            </Button>
            <Button onClick={onEdit}>{t('common.edit')}</Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
