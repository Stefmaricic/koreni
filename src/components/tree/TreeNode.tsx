import { useRef } from 'react'
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
  arrangeMode?: boolean
  scale?: number
  hasOverride?: boolean
  onDragMove?: (personId: string, x: number, y: number) => void
  onDragEnd?: (personId: string, x: number, y: number) => void
  onResetPosition?: (personId: string) => void
}

/** Below this many client pixels of movement, a press-and-release still counts as a select click, not a drag. */
const DRAG_THRESHOLD = 4

export function TreeNode({
  person,
  x,
  y,
  selected,
  onSelect,
  arrangeMode = false,
  scale = 1,
  hasOverride = false,
  onDragMove,
  onDragEnd,
  onResetPosition,
}: TreeNodeProps) {
  const { t } = useTranslation()
  const year = birthYear(person)
  const deathYear = person.deathDate ? new Date(person.deathDate).getFullYear() : null

  const dragRef = useRef<{ startClientX: number; startClientY: number; startX: number; startY: number; moved: boolean } | null>(null)

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    dragRef.current = { startClientX: e.clientX, startClientY: e.clientY, startX: x, startY: y, moved: false }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    e.stopPropagation()
    const dx = (e.clientX - drag.startClientX) / scale
    const dy = (e.clientY - drag.startClientY) / scale
    if (!drag.moved && Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY) > DRAG_THRESHOLD) {
      drag.moved = true
    }
    if (drag.moved) onDragMove?.(person.id, drag.startX + dx, drag.startY + dy)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    e.stopPropagation()
    dragRef.current = null
    if (drag.moved) {
      const dx = (e.clientX - drag.startClientX) / scale
      const dy = (e.clientY - drag.startClientY) / scale
      onDragEnd?.(person.id, drag.startX + dx, drag.startY + dy)
    } else {
      onSelect(person.id)
    }
  }

  const dragHandlers = arrangeMode
    ? {
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        onPointerCancel: handlePointerUp,
      }
    : { onClick: () => onSelect(person.id) }

  return (
    <foreignObject x={x - NODE_WIDTH / 2} y={y} width={NODE_WIDTH} height={NODE_HEIGHT} style={{ overflow: 'visible' }}>
      <div className="relative h-full w-full">
        <button
          type="button"
          {...dragHandlers}
          className={`flex h-full w-full flex-col items-center gap-1.5 rounded-2xl border bg-surface px-2 py-3 text-center shadow-sm transition-transform ${
            arrangeMode ? 'cursor-grab active:cursor-grabbing' : 'hover:-translate-y-0.5 hover:shadow-md'
          } ${selected ? 'border-root-500 ring-2 ring-root-200' : 'border-cream-200'} ${
            arrangeMode && hasOverride ? 'border-earth-400' : ''
          }`}
        >
          <div className="shrink-0">
            <Avatar
              photoUrl={person.photoUrl}
              firstName={person.firstName}
              lastName={person.lastName}
              gender={person.gender}
              size="lg"
            />
          </div>
          <span className="line-clamp-2 shrink-0 text-sm font-semibold leading-tight text-ink-700">
            {personFullName(person) || t('tree.unknownName')}
          </span>
          {year && (
            <span className="text-xs text-ink-500">
              {deathYear ? t('tree.borndied', { birth: year, death: deathYear }) : t('tree.born', { year })}
            </span>
          )}
        </button>
        {arrangeMode && hasOverride && (
          <button
            type="button"
            title={t('tree.resetPosition')}
            aria-label={t('tree.resetPosition')}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onResetPosition?.(person.id)
            }}
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-earth-400 bg-surface text-earth-600 shadow-sm hover:bg-earth-100"
          >
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
    </foreignObject>
  )
}
