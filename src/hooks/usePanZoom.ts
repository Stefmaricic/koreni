import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'

const MIN_SCALE = 0.2
const MAX_SCALE = 2.5
const ZOOM_STEP = 1.25

export interface Transform {
  x: number
  y: number
  scale: number
}

function clampScale(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

/**
 * Pan/zoom for the SVG tree canvas: drag to pan, wheel to zoom (centered on
 * the cursor), two-finger touch to pinch-zoom. Assumes the SVG's viewBox is
 * kept equal to its rendered pixel size, so client-pixel deltas map 1:1 onto
 * transform units without extra scaling math.
 */
export function usePanZoom(containerRef: RefObject<HTMLElement | null>) {
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 })
  const transformRef = useRef(transform)
  transformRef.current = transform

  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const dragStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null)

  /** Rescales so the content point under (clientX, clientY) stays fixed on screen. */
  const zoomAt = useCallback(
    (clientX: number, clientY: number, rawScale: number) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const localX = clientX - rect.left
      const localY = clientY - rect.top
      const newScale = clampScale(rawScale)

      setTransform((prev) => {
        const contentX = (localX - prev.x) / prev.scale
        const contentY = (localY - prev.y) / prev.scale
        return {
          scale: newScale,
          x: localX - contentX * newScale,
          y: localY - contentY * newScale,
        }
      })
    },
    [containerRef],
  )

  const zoomByStep = useCallback(
    (direction: 1 | -1) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const factor = direction === 1 ? ZOOM_STEP : 1 / ZOOM_STEP
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, transformRef.current.scale * factor)
    },
    [containerRef, zoomAt],
  )

  const fitToScreen = useCallback(
    (contentWidth: number, contentHeight: number, padding = 0.92) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect || contentWidth === 0 || contentHeight === 0) return
      const scale = clampScale(
        Math.min(rect.width / contentWidth, rect.height / contentHeight) * padding,
      )
      setTransform({
        scale,
        x: (rect.width - contentWidth * scale) / 2,
        y: (rect.height - contentHeight * scale) / 2,
      })
    },
    [containerRef],
  )

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 1) {
      dragStart.current = { x: e.clientX, y: e.clientY, tx: transformRef.current.x, ty: transformRef.current.y }
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinchStart.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: transformRef.current.scale }
      dragStart.current = null
    }
  }, [])

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (pointers.current.size === 2 && pinchStart.current) {
        const [a, b] = [...pointers.current.values()]
        const dist = Math.hypot(a.x - b.x, a.y - b.y)
        const midX = (a.x + b.x) / 2
        const midY = (a.y + b.y) / 2
        const newScale = (pinchStart.current.scale * dist) / pinchStart.current.dist
        zoomAt(midX, midY, newScale)
        return
      }

      const drag = dragStart.current
      if (pointers.current.size === 1 && drag) {
        // Snapshot `drag` into this closure rather than re-reading
        // dragStart.current inside the updater below: with fast pointer
        // movement, React can batch several of these setTransform calls
        // before running them, and by the time a later one actually
        // executes, a pointerup in between may have already reset
        // dragStart.current to null — throwing here crashed the whole tree
        // view during quick drags.
        const dx = e.clientX - drag.x
        const dy = e.clientY - drag.y
        setTransform((prev) => ({ ...prev, x: drag.tx + dx, y: drag.ty + dy }))
      }
    },
    [zoomAt],
  )

  const endPointer = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size === 0) {
      dragStart.current = null
      pinchStart.current = null
    } else if (pointers.current.size === 1) {
      const [remaining] = [...pointers.current.values()]
      dragStart.current = { x: remaining.x, y: remaining.y, tx: transformRef.current.x, ty: transformRef.current.y }
      pinchStart.current = null
    }
  }, [])

  // Native (non-passive) wheel listener so preventDefault actually stops page scroll.
  const wheelTargetRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const el = wheelTargetRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08
      zoomAt(e.clientX, e.clientY, transformRef.current.scale * factor)
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [zoomAt])

  return {
    transform,
    setTransform,
    zoomIn: () => zoomByStep(1),
    zoomOut: () => zoomByStep(-1),
    fitToScreen,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
    },
    wheelTargetRef,
  }
}
