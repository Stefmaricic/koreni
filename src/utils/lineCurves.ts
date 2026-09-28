export interface CurvePoint {
  x: number
  y: number
}

/** Deterministic -1..1 "personality" for a given id, used to bend each connector a little differently so the tree doesn't look mechanically uniform. */
export function jitter(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return ((h % 1000) / 1000) * 2 - 1
}

/** The unedited quadratic control point for a partner line's gentle bow. */
export function partnerDefaultPoint(x1: number, y1: number, x2: number, y2: number, id: string): CurvePoint {
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 + jitter(id) * 6 }
}

/** A short, gently bowed connector between two partners, passing through an explicit control point (either the default bow or a manually dragged one). */
export function partnerPath(x1: number, y1: number, x2: number, y2: number, cp: CurvePoint): string {
  return `M ${x1} ${y1} Q ${cp.x} ${cp.y}, ${x2} ${y2}`
}

function branchControlPoints(parentX: number, parentY: number, childX: number, childY: number, bend: number) {
  const dx = childX - parentX
  const midY = (parentY + childY) / 2
  return {
    c1: { x: parentX + dx * 0.15 + bend * 12, y: parentY + (midY - parentY) * 0.6 },
    c2: { x: childX - dx * 0.15 - bend * 6, y: childY - (childY - midY) * 0.6 },
  }
}

function cubicMidpoint(p0: CurvePoint, c1: CurvePoint, c2: CurvePoint, p3: CurvePoint): CurvePoint {
  return {
    x: 0.125 * p0.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * p3.x,
    y: 0.125 * p0.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * p3.y,
  }
}

/** A smooth branch from a parent card's bottom edge to a child card's top edge, leaving at a natural angle rather than a dead-straight vertical. */
export function branchPath(parentX: number, parentY: number, childX: number, childY: number, bend: number): string {
  const { c1, c2 } = branchControlPoints(parentX, parentY, childX, childY, bend)
  return `M ${parentX} ${parentY} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${childX} ${childY}`
}

/** The point a branch passes through at its midpoint (t=0.5) -- used to place/grab its drag handle. */
export function branchBellyPoint(parentX: number, parentY: number, childX: number, childY: number, bend: number): CurvePoint {
  const { c1, c2 } = branchControlPoints(parentX, parentY, childX, childY, bend)
  return cubicMidpoint({ x: parentX, y: parentY }, c1, c2, { x: childX, y: childY })
}

/**
 * A branch whose belly passes through an explicit, dragged point rather than
 * the fixed "personality" wobble. Endpoints and their tangent direction
 * into/out of the parent/child cards stay anchored; only the curve's
 * midsection shifts to reach the target point.
 */
export function branchPathThroughPoint(parentX: number, parentY: number, childX: number, childY: number, belly: CurvePoint): string {
  const base = branchBellyPoint(parentX, parentY, childX, childY, 0)
  const offsetX = (belly.x - base.x) / 0.75
  const offsetY = (belly.y - base.y) / 0.75
  const { c1, c2 } = branchControlPoints(parentX, parentY, childX, childY, 0)
  const c1s = { x: c1.x + offsetX, y: c1.y + offsetY }
  const c2s = { x: c2.x + offsetX, y: c2.y + offsetY }
  return `M ${parentX} ${parentY} C ${c1s.x} ${c1s.y}, ${c2s.x} ${c2s.y}, ${childX} ${childY}`
}
