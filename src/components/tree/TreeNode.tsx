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
  /** True when the current viewer is a scoped editor who can edit this specific person. Never set for an owner/admin — they see every card the same, no tint (per spec). */
  editable?: boolean
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
  editable = false,
}: TreeNodeProps) {
  const { t } = useTranslation()
  const year = birthYear(person)
  const deathYear = person.deathDate ? new Date(person.deathDate).getFullYear() : null

  const dragRef = useRef<{
    startClientX: number
    startClientY: number
    startX: number
    startY: number
    startScale: number
    moved: boolean
  } | null>(null)

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    // Freeze the zoom level for this whole gesture: if it changed mid-drag
    // (a trackpad pinch or wheel-zoom firing alongside the drag), computing
    // deltas against the *current* scale each frame threw the position wildly
    // off since the drag's start position was captured at the old scale.
    dragRef.current = { startClientX: e.clientX, startClientY: e.clientY, startX: x, startY: y, startScale: scale, moved: false }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    e.stopPropagation()
    const dx = (e.clientX - drag.startClientX) / drag.startScale
    const dy = (e.clientY - drag.startClientY) / drag.startScale
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
      const dx = (e.clientX - drag.startClientX) / drag.startScale
      const dy = (e.clientY - drag.startClientY) / drag.startScale
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
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          {...dragHandlers}
          className={`flex h-full w-full flex-col items-center gap-1.5 rounded-2xl border bg-surface px-2 py-3 text-center shadow-sm transition-transform ${
            arrangeMode ? 'cursor-grab active:cursor-grabbing' : 'hover:-translate-y-0.5 hover:shadow-md'
          } ${selected ? 'border-root-500 ring-2 ring-root-200' : 'border-cream-200'} ${
            arrangeMode && hasOverride ? 'border-earth-400' : ''
          } ${editable && !selected ? 'ring-2 ring-green-400 shadow-[0_0_12px_2px_rgba(34,197,94,0.55)]' : ''}`}
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
          {(year || deathYear) && (
            <span className="text-xs text-ink-500">
              {year && deathYear
                ? t('tree.borndied', { birth: year, death: deathYear })
                : year
                  ? t('tree.born', { year })
                  : t('tree.diedOnly', { year: deathYear })}
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
