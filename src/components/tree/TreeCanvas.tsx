import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ThemeIcon } from '@/components/layout/ThemeToggle'
import { FeedbackIcon } from '@/components/feedback/FeedbackWidget'
import { TreeNode } from '@/components/tree/TreeNode'
import { Button } from '@/components/ui/Button'
import { usePanZoom } from '@/hooks/usePanZoom'
import { useThemeStore } from '@/stores/themeStore'
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
  graph,
  style,
  onStyleChange,
  selectedId,
  onSelectPerson,
  onAddFirstPerson,
  onOpenFeedback,
}: TreeCanvasProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const { transform, zoomIn, zoomOut, fitToScreen, handlers, wheelTargetRef } = usePanZoom(containerRef)
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggle)

  const layout = useMemo(() => computeTreeLayout(graph, style), [graph, style])
  const peopleById = graph.people

  const maxGeneration = useMemo(
    () => Math.max(0, ...layout.nodes.map((n) => n.generation)),
    [layout.nodes],
  )
  const genByPerson = useMemo(() => new Map(layout.nodes.map((n) => [n.personId, n.generation])), [layout.nodes])

  // In 'rooted' mode generation 0 (the oldest people) sits at the bottom of
  // the mirrored layout, so the trunk anchors under their average x position.
  const rootAnchor = useMemo(() => {
    if (style !== 'rooted') return null
    const rootNodes = layout.nodes.filter((n) => n.generation === 0)
    if (rootNodes.length === 0) return null
    const x = rootNodes.reduce((sum, n) => sum + n.x, 0) / rootNodes.length
    const edgeY = Math.min(...rootNodes.map((n) => n.y)) + NODE_HEIGHT
    return { x, edgeY }
  }, [layout.nodes, style])

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
          {/* decorative trunk/roots: faint behind the classic chart, solid anchor under the rooted chart */}
          {style === 'classic' && layout.nodes.length > 0 && (
            <RootsGraphic x={layout.width / 2} topY={layout.height - 150} bottomY={layout.height - 20} opacity={0.14} />
          )}
          {rootAnchor && (
            <RootsGraphic x={rootAnchor.x} topY={rootAnchor.edgeY} bottomY={layout.height - 20} />
          )}

          {layout.partnerLines.map((line) => (
            <line
              key={line.id}
              x1={line.x1}
              x2={line.x2}
              y1={line.y}
              y2={line.y}
              stroke="var(--color-earth-300)"
              strokeWidth={3}
            />
          ))}

          {style === 'classic'
            ? layout.childEdges.map((edge) => (
                <g key={edge.id} stroke="var(--color-root-300)" strokeWidth={2.5} fill="none">
                  <line x1={edge.parentX} y1={edge.parentY} x2={edge.parentX} y2={edge.busY} />
                  {edge.children.length > 1 && (
                    <line
                      x1={Math.min(edge.parentX, ...edge.children.map((c) => c.x))}
                      x2={Math.max(edge.parentX, ...edge.children.map((c) => c.x))}
                      y1={edge.busY}
                      y2={edge.busY}
                    />
                  )}
                  {edge.children.map((c) => (
                    <line key={c.personId} x1={c.x} y1={edge.busY} x2={c.x} y2={c.topY} />
                  ))}
                </g>
              ))
            : layout.childEdges.map((edge) =>
                edge.children.map((c) => {
                  const gen = genByPerson.get(c.personId) ?? 0
                  const color = lerpColor(ROOT_COLOR, CANOPY_COLOR, maxGeneration ? gen / maxGeneration : 0)
                  const midY = (edge.parentY + c.topY) / 2
                  const strokeWidth = Math.max(2, 6 - gen * 0.7)
                  return (
                    <path
                      key={c.personId}
                      d={`M ${edge.parentX} ${edge.parentY} C ${edge.parentX} ${midY}, ${c.x} ${midY}, ${c.x} ${c.topY}`}
                      stroke={color}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                      fill="none"
                    />
                  )
                }),
              )}

          {layout.nodes.map((node) => {
            const person = peopleById.get(node.personId)
            if (!person) return null
            return (
              <TreeNode
                key={node.personId}
                person={person}
                x={node.x}
                y={node.y}
                selected={node.personId === selectedId}
                onSelect={onSelectPerson}
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
