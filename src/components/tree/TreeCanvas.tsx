import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ThemeIcon } from '@/components/layout/ThemeToggle'
import { FeedbackIcon } from '@/components/feedback/FeedbackWidget'
import { TreeNode } from '@/components/tree/TreeNode'
import { Button } from '@/components/ui/Button'
import { usePanZoom } from '@/hooks/usePanZoom'
import { setPersonPosition } from '@/services/personService'
import { useThemeStore } from '@/stores/themeStore'
import { toastError } from '@/stores/toastStore'
import type { FamilyGraph } from '@/utils/familyGraph'
import { computeTreeLayout, NODE_HEIGHT, type TreeStyle } from '@/utils/treeLayout'

interface TreeCanvasProps {
  graph: FamilyGraph
  style: TreeStyle
  onStyleChange: (style: TreeStyle) => void
  selectedId: string | null
  onSelectPerson: (personId: string) => void
  onAddFirstPerson: () => void
  onOpenFeedback: () => void
  canEdit: boolean
}

function IconButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-10 w-10 items-center justify-center rounded-full border shadow-sm ${
        active ? 'border-root-500 bg-root-600 text-white' : 'border-cream-200 bg-surface text-ink-600 hover:bg-cream-100'
      }`}
    >
      {children}
    </button>
  )
}

/** Hex-to-hex linear interpolation, used to grade branch color from root (earth tone) to canopy (leaf green). */
function lerpColor(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  const mix = pa.map((v, i) => Math.round(v + (pb[i] - v) * t))
  return `#${mix.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

const ROOT_COLOR = '#8f4f30' // earth-600
const CANOPY_COLOR = '#3f7548' // root-500

/** Deterministic -1..1 "personality" for a given id, used to bend each branch a little differently so the tree doesn't look mechanically uniform. */
function jitter(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return ((h % 1000) / 1000) * 2 - 1
}

/** A smooth branch from a parent card's bottom edge to a child card's top edge, leaving at a natural angle rather than a dead-straight vertical. */
function branchPath(parentX: number, parentY: number, childX: number, childY: number, bend: number) {
  const dx = childX - parentX
  const midY = (parentY + childY) / 2
  const c1x = parentX + dx * 0.15 + bend * 12
  const c1y = parentY + (midY - parentY) * 0.6
  const c2x = childX - dx * 0.15 - bend * 6
  const c2y = childY - (childY - midY) * 0.6
  return `M ${parentX} ${parentY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${childX} ${childY}`
}

/** A short, gently bowed connector between two partners, thinner and lighter than a bloodline branch. */
function partnerPath(x1: number, y1: number, x2: number, y2: number, bend: number) {
  const midX = (x1 + x2) / 2
  const midY = (y1 + y2) / 2
  return `M ${x1} ${y1} Q ${midX} ${midY + bend * 6}, ${x2} ${y2}`
}

/** A small illustrated trunk + spreading roots, anchored at (x, bottomY) and reaching up to topY. */
function RootsGraphic({ x, topY, bottomY, opacity = 1 }: { x: number; topY: number; bottomY: number; opacity?: number }) {
  return (
    <g opacity={opacity} stroke={ROOT_COLOR} fill="none" strokeLinecap="round">
      <path d={`M ${x} ${bottomY} V ${topY}`} strokeWidth={14} />
      <path d={`M ${x} ${bottomY} C ${x - 40} ${bottomY - 6}, ${x - 74} ${bottomY - 2}, ${x - 104} ${bottomY - 10}`} strokeWidth={6} />
      <path d={`M ${x} ${bottomY} C ${x + 40} ${bottomY - 6}, ${x + 74} ${bottomY - 2}, ${x + 104} ${bottomY - 10}`} strokeWidth={6} />
      <path d={`M ${x} ${bottomY} C ${x - 18} ${bottomY + 4}, ${x - 32} ${bottomY + 10}, ${x - 46} ${bottomY + 16}`} strokeWidth={4} />
      <path d={`M ${x} ${bottomY} C ${x + 18} ${bottomY + 4}, ${x + 32} ${bottomY + 10}, ${x + 46} ${bottomY + 16}`} strokeWidth={4} />
    </g>
  )
}

export function TreeCanvas({
  graph,
  style,
  onStyleChange,
  selectedId,
  onSelectPerson,
  onAddFirstPerson,
  onOpenFeedback,
  canEdit,
}: TreeCanvasProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const { transform, zoomIn, zoomOut, fitToScreen, handlers, wheelTargetRef } = usePanZoom(containerRef)
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggle)

  const [arrangeMode, setArrangeMode] = useState(false)
  // null means "explicitly reset to the automatic position" (overrides a
  // still-stale, non-null position_x/position_y on the fetched person until
  // the next full refresh catches up); absent means "defer to the person's
  // saved position, if any."
  const [liveOverrides, setLiveOverrides] = useState<Map<string, { x: number; y: number } | null>>(new Map())

  const layout = useMemo(() => computeTreeLayout(graph, style), [graph, style])
  const peopleById = graph.people
  const nodesById = useMemo(() => new Map(layout.nodes.map((n) => [n.personId, n])), [layout.nodes])

  const effectiveXY = useCallback(
    (personId: string, fallbackX: number, fallbackY: number) => {
      if (liveOverrides.has(personId)) {
        const v = liveOverrides.get(personId)
        return v ?? { x: fallbackX, y: fallbackY }
      }
      const person = peopleById.get(personId)
      if (person?.positionX != null && person?.positionY != null) {
        return { x: person.positionX, y: person.positionY }
      }
      return { x: fallbackX, y: fallbackY }
    },
    [liveOverrides, peopleById],
  )

  const hasOverride = useCallback(
    (personId: string) => {
      if (liveOverrides.has(personId)) return liveOverrides.get(personId) !== null
      const person = peopleById.get(personId)
      return person?.positionX != null && person?.positionY != null
    },
    [liveOverrides, peopleById],
  )

  const handleDragMove = useCallback((personId: string, x: number, y: number) => {
    setLiveOverrides((prev) => new Map(prev).set(personId, { x, y }))
  }, [])

  const handleDragEnd = useCallback((personId: string, x: number, y: number) => {
    setLiveOverrides((prev) => new Map(prev).set(personId, { x, y }))
    setPersonPosition(personId, { x, y }).catch((err) => toastError(err))
  }, [])

  const handleResetPosition = useCallback((personId: string) => {
    setLiveOverrides((prev) => new Map(prev).set(personId, null))
    setPersonPosition(personId, null).catch((err) => toastError(err))
  }, [])

  /**
   * A specific person's card-edge anchor point -- the side facing whoever
   * they're connected to below/above (top in 'rooted', bottom in 'classic'),
   * override-aware. Used for both the partner line and child branches, so a
   * couple's connecting line and the branch(es) leaving from them always
   * land on the exact same point, however far apart they've been dragged.
   */
  const parentAnchor = useCallback(
    (personId: string) => {
      const raw = nodesById.get(personId)
      const top = effectiveXY(personId, raw?.x ?? 0, raw?.y ?? 0)
      return { x: top.x, y: style === 'classic' ? top.y + NODE_HEIGHT : top.y }
    },
    [nodesById, effectiveXY, style],
  )

  const maxGeneration = useMemo(
    () => Math.max(0, ...layout.nodes.map((n) => n.generation)),
    [layout.nodes],
  )

  const fitted = useRef<string | null>(null)
  useEffect(() => {
    const key = `${layout.width}x${layout.height}`
    if (fitted.current !== key && layout.width > 0) {
      fitToScreen(layout.width, layout.height)
      fitted.current = key
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.width, layout.height])

  return (
    <div
      ref={(el) => {
        containerRef.current = el
        wheelTargetRef.current = el
      }}
      className="relative h-full w-full touch-none select-none overflow-hidden bg-cream-100"
      style={{
        backgroundImage: 'radial-gradient(circle, var(--color-cream-300) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
      {...handlers}
    >
      <svg width="100%" height="100%" className="cursor-grab active:cursor-grabbing">
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {/* decorative trunk/roots graphic under each founding lineage */}
          {style === 'classic' && layout.nodes.length > 0 && (
            <RootsGraphic x={layout.width / 2} topY={layout.height - 150} bottomY={layout.height - 20} opacity={0.14} />
          )}
          {style === 'rooted' &&
            layout.rootAnchors.map((anchor, i) => (
              <RootsGraphic key={i} x={anchor.x} topY={anchor.edgeY} bottomY={layout.height - 20} />
            ))}

          {layout.partnerLines.map((line) => {
            const a = parentAnchor(line.aId)
            const b = parentAnchor(line.bId)
            return (
              <path
                key={line.id}
                d={partnerPath(a.x, a.y, b.x, b.y, jitter(line.id))}
                stroke="var(--color-earth-300)"
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
              />
            )
          })}

          {layout.childLinks.map((link) => {
            const color = lerpColor(
              ROOT_COLOR,
              CANOPY_COLOR,
              maxGeneration ? link.childGeneration / maxGeneration : 0,
            )
            const strokeWidth = link.primary ? Math.max(2, 6 - link.childGeneration * 0.7) : 1.5
            // Average both parents' anchor points when the child has two
            // (a couple), so the branch leaves from the line between them
            // instead of fanning toward whichever one the layout favored.
            const parentPoints = link.parentIds.map(parentAnchor)
            const parent = {
              x: parentPoints.reduce((sum, p) => sum + p.x, 0) / parentPoints.length,
              y: parentPoints.reduce((sum, p) => sum + p.y, 0) / parentPoints.length,
            }
            const childTopFallback = link.childY - (style === 'classic' ? 0 : NODE_HEIGHT)
            const childTop = effectiveXY(link.childId, link.childX, childTopFallback)
            const child = { x: childTop.x, y: style === 'classic' ? childTop.y : childTop.y + NODE_HEIGHT }
            return (
              <path
                key={link.id}
                d={branchPath(parent.x, parent.y, child.x, child.y, jitter(link.id))}
                stroke={link.primary ? color : 'var(--color-earth-300)'}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={link.primary ? undefined : '2 5'}
                opacity={link.primary ? 1 : 0.6}
                fill="none"
              />
            )
          })}

          {layout.nodes.map((node) => {
            const person = peopleById.get(node.personId)
            if (!person) return null
            const pos = effectiveXY(node.personId, node.x, node.y)
            return (
              <TreeNode
                key={node.personId}
                person={person}
                x={pos.x}
                y={pos.y}
                selected={node.personId === selectedId}
                onSelect={onSelectPerson}
                arrangeMode={arrangeMode}
                scale={transform.scale}
                hasOverride={hasOverride(node.personId)}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
                onResetPosition={handleResetPosition}
              />
            )
          })}
        </g>
      </svg>

      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <IconButton label={t('tree.zoomIn')} onClick={zoomIn}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M10 4v12M4 10h12" strokeLinecap="round" />
          </svg>
        </IconButton>
        <IconButton label={t('tree.zoomOut')} onClick={zoomOut}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M4 10h12" strokeLinecap="round" />
          </svg>
        </IconButton>
        <IconButton label={t('tree.fitToScreen')} onClick={() => fitToScreen(layout.width, layout.height)}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
            <path
              d="M7 3H4a1 1 0 00-1 1v3M13 3h3a1 1 0 011 1v3M7 17H4a1 1 0 01-1-1v-3M13 17h3a1 1 0 001-1v-3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </IconButton>
        {canEdit && (
          <IconButton
            label={arrangeMode ? t('tree.arrangeDone') : t('tree.arrange')}
            active={arrangeMode}
            onClick={() => setArrangeMode((v) => !v)}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
              <path
                d="M10 2.5v15M2.5 10h15M10 2.5l-2.5 2.5M10 2.5l2.5 2.5M10 17.5l-2.5-2.5M10 17.5l2.5-2.5M2.5 10l2.5-2.5M2.5 10l2.5 2.5M17.5 10l-2.5-2.5M17.5 10l-2.5 2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </IconButton>
        )}
        <div className="my-0.5 h-px bg-cream-300" />
        <IconButton
          label={style === 'classic' ? t('tree.switchToRooted') : t('tree.switchToClassic')}
          active={style === 'rooted'}
          onClick={() => onStyleChange(style === 'classic' ? 'rooted' : 'classic')}
        >
          <span className="text-base leading-none">🌳</span>
        </IconButton>
        <IconButton
          label={theme === 'dark' ? t('common.switchToLight') : t('common.switchToDark')}
          onClick={toggleTheme}
        >
          <ThemeIcon theme={theme} />
        </IconButton>
        <IconButton label={t('feedback.button')} onClick={onOpenFeedback}>
          <FeedbackIcon />
        </IconButton>
      </div>

      {layout.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Button onClick={onAddFirstPerson}>{t('tree.addFirstPerson')}</Button>
        </div>
      )}
    </div>
  )
}
