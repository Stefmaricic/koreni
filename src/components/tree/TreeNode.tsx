import { useTranslation } from 'react-i18next'
import { Avatar } from '@/components/ui/Avatar'
import { NODE_HEIGHT, NODE_WIDTH } from '@/utils/treeLayout'
import { birthYear, personFullName } from '@/utils/mappers'
import type { Person } from '@/types/models'

interface TreeNodeProps {
  person: Person
  x: number
  y: number
  selected: boolean
  onSelect: (personId: string) => void
}

export function TreeNode({ person, x, y, selected, onSelect }: TreeNodeProps) {
  const { t } = useTranslation()
  const year = birthYear(person)
  const deathYear = person.deathDate ? new Date(person.deathDate).getFullYear() : null

  return (
    <foreignObject x={x - NODE_WIDTH / 2} y={y} width={NODE_WIDTH} height={NODE_HEIGHT}>
      <button
        type="button"
        onClick={() => onSelect(person.id)}
        className={`flex h-full w-full flex-col items-center gap-1.5 rounded-2xl border bg-surface px-2 py-3 text-center shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md ${
          selected ? 'border-root-500 ring-2 ring-root-200' : 'border-cream-200'
        }`}
      >
        <Avatar
          photoUrl={person.photoUrl}
          firstName={person.firstName}
          lastName={person.lastName}
          gender={person.gender}
          size="lg"
        />
        <span className="line-clamp-2 text-sm font-semibold leading-tight text-ink-700">
          {personFullName(person) || t('tree.unknownName')}
        </span>
        {year && (
          <span className="text-xs text-ink-500">
            {deathYear ? t('tree.borndied', { birth: year, death: deathYear }) : t('tree.born', { year })}
          </span>
        )}
      </button>
    </foreignObject>
  )
}
