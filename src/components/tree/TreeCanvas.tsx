import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ThemeIcon } from '@/components/layout/ThemeToggle'
import { FeedbackIcon } from '@/components/feedback/FeedbackWidget'
import { LineHandle } from '@/components/tree/LineHandle'
import { TreeNode } from '@/components/tree/TreeNode'
import { Button } from '@/components/ui/Button'
import { usePanZoom } from '@/hooks/usePanZoom'
import { setChildLinkCurve } from '@/services/childLinkCurveService'
import { setPersonPosition } from '@/services/personService'
import { setPartnerLineCurve } from '@/services/relationshipService'
import { useThemeStore } from '@/stores/themeStore'
import { toastError } from '@/stores/toastStore'
import type { FamilyGraph } from '@/utils/familyGraph'
import {
  branchBellyPoint,
  branchPath,
  branchPathThroughPoint,
  jitter,
  partnerDefaultPoint,
  partnerPath,
  type CurvePoint,
} from '@/utils/lineCurves'
import { computeTreeLayout, NODE_HEIGHT, type TreeStyle } from '@/utils/treeLayout'

interface TreeCanvasProps {
  treeId: string
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
  treeId,
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

  // Same null/absent convention as liveOverrides, but for a connector line's
  // curve control point. Keyed by `partner:<relationshipId>` or
  // `child:<childId>|<parentKey>` so both kinds of line share one map.
  const [lineOverrides, setLineOverrides] = useState<Map<string, CurvePoint | null>>(new Map())
  // Which line currently shows its drag handle -- revealed by double-clicking
  // the line in arrange mode, one at a time.
  const [activeLineId, setActiveLineId] = useState<string | null>(null)

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

  const effectiveControlPoint = useCallback(
    (lineKey: string, persisted: CurvePoint | null, fallback: CurvePoint) => {
      if (lineOverrides.has(lineKey)) {
        const v = lineOverrides.get(lineKey)
        return v ?? fallback
      }
      return persisted ?? fallback
    },
    [lineOverrides],
  )

  const hasLineOverride = useCallback(
    (lineKey: string, persisted: CurvePoint | null) => {
      if (lineOverrides.has(lineKey)) return lineOverrides.get(lineKey) !== null
      return persisted != null
    },
    [lineOverrides],
  )

  const handleLineDragMove = useCallback((lineKey: string, x: number, y: number) => {
    setLineOverrides((prev) => new Map(prev).set(lineKey, { x, y }))
  }, [])

  const handlePartnerLineDragEnd = useCallback((lineKey: string, relationshipId: string, x: number, y: number) => {
    setLineOverrides((prev) => new Map(prev).set(lineKey, { x, y }))
    setPartnerLineCurve(relationshipId, { x, y }).catch((err) => toastError(err))
  }, [])

  const handlePartnerLineReset = useCallback((lineKey: string, relationshipId: string) => {
    setLineOverrides((prev) => new Map(prev).set(lineKey, null))
    setPartnerLineCurve(relationshipId, null).catch((err) => toastError(err))
  }, [])

  const handleChildLinkDragEnd = useCallback(
    (lineKey: string, childId: string, parentKey: string, x: number, y: number) => {
      setLineOverrides((prev) => new Map(prev).set(lineKey, { x, y }))
      setChildLinkCurve(treeId, childId, parentKey, { x, y }).catch((err) => toastError(err))
    },
    [treeId],
  )

  const handleChildLinkReset = useCallback(
    (lineKey: string, childId: string, parentKey: string) => {
      setLineOverrides((prev) => new Map(prev).set(lineKey, null))
      setChildLinkCurve(treeId, childId, parentKey, null).catch((err) => toastError(err))
    },
    [treeId],
  )

  const partnerCurveById = useMemo(() => {
    const m = new Map<string, CurvePoint | null>()
    for (const rel of graph.relationships) {
      if (rel.type !== 'partner') continue
      m.set(rel.id, rel.curveX != null && rel.curveY != null ? { x: rel.curveX, y: rel.curveY } : null)
    }
    return m
  }, [graph])

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
      onClick={() => setActiveLineId(null)}
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
            const lineKey = `partner:${line.id}`
            const defaultCp = partnerDefaultPoint(a.x, a.y, b.x, b.y, line.id)
            const persisted = partnerCurveById.get(line.id) ?? null
            const cp = effectiveControlPoint(lineKey, persisted, defaultCp)
            const overridden = hasLineOverride(lineKey, persisted)
            const d = partnerPath(a.x, a.y, b.x, b.y, cp)
            return (
              <g key={line.id}>
                <path d={d} stroke="var(--color-earth-300)" strokeWidth={2} fill="none" strokeLinecap="round" />
                {arrangeMode && canEdit && (
                  <path
                    d={d}
                    stroke="black"
                    strokeOpacity={0}
                    strokeWidth={16}
                    fill="none"
                    className="cursor-pointer"
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      setActiveLineId(lineKey)
                    }}
                  />
                )}
                {activeLineId === lineKey && (
                  <LineHandle
                    lineId={lineKey}
                    x={cp.x}
                    y={cp.y}
                    scale={transform.scale}
                    hasOverride={overridden}
                    onDragMove={handleLineDragMove}
                    onDragEnd={(id, x, y) => handlePartnerLineDragEnd(id, line.id, x, y)}
                    onReset={(id) => handlePartnerLineReset(id, line.id)}
                  />
                )}
              </g>
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
            const bend = jitter(link.id)
            const lineKey = `child:${link.childId}|${link.parentKey}`
            const persisted = graph.childLinkCurve(link.childId, link.parentKey)
            const defaultBelly = branchBellyPoint(parent.x, parent.y, child.x, child.y, bend)
            const belly = effectiveControlPoint(lineKey, persisted, defaultBelly)
            const overridden = hasLineOverride(lineKey, persisted)
            const d = overridden
              ? branchPathThroughPoint(parent.x, parent.y, child.x, child.y, belly)
              : branchPath(parent.x, parent.y, child.x, child.y, bend)
            return (
              <g key={link.id}>
                <path
                  d={d}
                  stroke={link.primary ? color : 'var(--color-earth-300)'}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={link.primary ? undefined : '2 5'}
                  opacity={link.primary ? 1 : 0.6}
                  fill="none"
                />
                {arrangeMode && canEdit && (
                  <path
                    d={d}
                    stroke="black"
                    strokeOpacity={0}
                    strokeWidth={16}
                    fill="none"
                    className="cursor-pointer"
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      setActiveLineId(lineKey)
                    }}
                  />
                )}
                {activeLineId === lineKey && (
                  <LineHandle
                    lineId={lineKey}
                    x={belly.x}
                    y={belly.y}
                    scale={transform.scale}
                    hasOverride={overridden}
                    onDragMove={handleLineDragMove}
                    onDragEnd={(id, x, y) => handleChildLinkDragEnd(id, link.childId, link.parentKey, x, y)}
                    onReset={(id) => handleChildLinkReset(id, link.childId, link.parentKey)}
                  />
                )}
              </g>
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

      {arrangeMode && canEdit && (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-ink-700/90 px-3 py-1.5 text-xs text-white shadow-sm">
          {t('tree.arrangeHint')}
        </div>
      )}

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
            onClick={() => {
              setArrangeMode((v) => !v)
              setActiveLineId(null)
            }}
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
