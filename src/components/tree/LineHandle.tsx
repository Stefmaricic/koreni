import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface LineHandleProps {
  lineId: string
  x: number
  y: number
  scale: number
  hasOverride: boolean
  onDragMove: (lineId: string, x: number, y: number) => void
  onDragEnd: (lineId: string, x: number, y: number) => void
  onReset: (lineId: string) => void
}

/** Below this many client pixels of movement, a press-and-release still counts as a no-op, not a drag. */
const DRAG_THRESHOLD = 4

/** A small draggable handle sitting on a connector line's curve, shown once that line has been double-clicked in arrange mode. Mirrors TreeNode's pointer-capture drag pattern. */
export function LineHandle({ lineId, x, y, scale, hasOverride, onDragMove, onDragEnd, onReset }: LineHandleProps) {
  const { t } = useTranslation()
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
    if (drag.moved) onDragMove(lineId, drag.startX + dx, drag.startY + dy)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    e.stopPropagation()
    dragRef.current = null
    if (drag.moved) {
      const dx = (e.clientX - drag.startClientX) / drag.startScale
      const dy = (e.clientY - drag.startClientY) / drag.startScale
      onDragEnd(lineId, drag.startX + dx, drag.startY + dy)
    }
  }

  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={7}
        fill="var(--color-surface)"
        stroke="var(--color-root-500)"
        strokeWidth={2}
        className="cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      {hasOverride && (
        <g
          role="button"
          aria-label={t('tree.resetCurve')}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onReset(lineId)
          }}
          className="cursor-pointer"
        >
          <circle cx={x + 13} cy={y - 13} r={7} fill="var(--color-surface)" stroke="var(--color-earth-400)" strokeWidth={1.5} />
          <path d={`M ${x + 10} ${y - 16} L ${x + 16} ${y - 10} M ${x + 16} ${y - 16} L ${x + 10} ${y - 10}`} stroke="var(--color-earth-600)" strokeWidth={1.5} strokeLinecap="round" />
        </g>
      )}
    </g>
  )
}
