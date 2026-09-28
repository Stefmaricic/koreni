import type { FamilyGraph } from '@/utils/familyGraph'

export const NODE_WIDTH = 128
export const NODE_HEIGHT = 172
export const PARTNER_GAP = 20
export const UNIT_GAP = 44
export const GENERATION_GAP = 110
export const LAYOUT_PADDING = 80

export interface PositionedNode {
  personId: string
  x: number // center x
  y: number // top y
  generation: number
}

export interface PartnerLine {
  id: string
  aId: string
  bId: string
  x1: number
  x2: number
  y: number
}

export interface ChildEdgeGroup {
  id: string
  /** x of the vertical drop from the parent unit (its horizontal midpoint) */
  parentX: number
  parentY: number
  busY: number
  children: { personId: string; x: number; topY: number }[]
}

export interface TreeLayoutResult {
  nodes: PositionedNode[]
  partnerLines: PartnerLine[]
  childEdges: ChildEdgeGroup[]
  width: number
  height: number
}

/**
 * 'classic': oldest generation at the top, growing downward (the default org-chart look).
 * 'rooted': oldest generation at the bottom (the "root"), growing upward like a real tree.
 */
export type TreeStyle = 'classic' | 'rooted'

class UnionFind {
  private parent = new Map<string, string>()

  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x)
    const p = this.parent.get(x)!
    if (p === x) return x
    const root = this.find(p)
    this.parent.set(x, root)
    return root
  }

  union(a: string, b: string) {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent.set(ra, rb)
  }
}

interface Unit {
  id: string
  memberIds: string[] // stable order (by createdAt)
  generation: number
  leftX: number
  width: number
}

/**
 * Turns a FamilyGraph into absolute pixel positions for every person plus the
 * connector lines between them. Pure & deterministic: same data in, same
 * layout out, so re-running it after an edit is cheap and predictable.
 */
export function computeTreeLayout(graph: FamilyGraph, style: TreeStyle = 'classic'): TreeLayoutResult {
  const people = [...graph.people.values()]
  if (people.length === 0) {
    return { nodes: [], partnerLines: [], childEdges: [], width: 0, height: 0 }
  }

  // ---- 1. Group partners into "units" that must stay adjacent -----------
  const uf = new UnionFind()
  for (const p of people) uf.find(p.id)
  for (const rel of graph.relationships) {
    if (rel.type === 'partner') uf.union(rel.personAId, rel.personBId)
  }

  const byCreatedAt = (a: string, b: string) =>
    (graph.people.get(a)?.createdAt ?? '').localeCompare(graph.people.get(b)?.createdAt ?? '')

  const unitMembers = new Map<string, string[]>()
  for (const p of people) {
    const root = uf.find(p.id)
    if (!unitMembers.has(root)) unitMembers.set(root, [])
    unitMembers.get(root)!.push(p.id)
  }
  const unitOfPerson = new Map<string, string>()
  const units = new Map<string, Unit>()
  for (const [root, members] of unitMembers) {
    members.sort(byCreatedAt)
    const unit: Unit = { id: root, memberIds: members, generation: 0, leftX: 0, width: 0 }
    units.set(root, unit)
    for (const m of members) unitOfPerson.set(m, root)
  }

  // ---- 2. Assign a generation to every person via delta propagation -----
  // parent -> child edges have delta +1; partner edges have delta 0. We walk
  // each connected component once, assigning relative generations, then
  // normalize so each component's minimum generation is 0. Conflicting
  // edges (rare marriage loops) are ignored after the first assignment wins.
  type Edge = { to: string; delta: number }
  const adjacency = new Map<string, Edge[]>()
  const addEdge = (a: string, b: string, delta: number) => {
    if (!adjacency.has(a)) adjacency.set(a, [])
    adjacency.get(a)!.push({ to: b, delta })
  }
  for (const rel of graph.relationships) {
    const delta = rel.type === 'parent' ? 1 : 0
    addEdge(rel.personAId, rel.personBId, delta)
    addEdge(rel.personBId, rel.personAId, -delta)
  }

  const generation = new Map<string, number>()
  const componentOf = new Map<string, number>()
  let componentIndex = 0
  const sortedIds = [...graph.people.keys()].sort(byCreatedAt)

  for (const start of sortedIds) {
    if (generation.has(start)) continue
    generation.set(start, 0)
    componentOf.set(start, componentIndex)
    const queue = [start]
    while (queue.length) {
      const current = queue.shift()!
      for (const edge of adjacency.get(current) ?? []) {
        if (generation.has(edge.to)) continue
        generation.set(edge.to, generation.get(current)! + edge.delta)
        componentOf.set(edge.to, componentIndex)
        queue.push(edge.to)
      }
    }
    componentIndex++
  }

  // normalize each component so its shallowest generation is 0
  const minGenByComponent = new Map<number, number>()
  for (const id of sortedIds) {
    const c = componentOf.get(id)!
    const g = generation.get(id)!
    minGenByComponent.set(c, Math.min(minGenByComponent.get(c) ?? g, g))
  }
  for (const id of sortedIds) {
    const c = componentOf.get(id)!
    generation.set(id, generation.get(id)! - (minGenByComponent.get(c) ?? 0))
  }

  for (const unit of units.values()) {
    unit.generation = Math.max(...unit.memberIds.map((m) => generation.get(m) ?? 0))
  }

  // ---- 3. Order units within each generation (barycenter heuristic) -----
  const maxGeneration = Math.max(...[...units.values()].map((u) => u.generation))
  const generationRows: Unit[][] = Array.from({ length: maxGeneration + 1 }, () => [])
  for (const unit of units.values()) generationRows[unit.generation].push(unit)

  const unitParentUnits = (unit: Unit): string[] => {
    const parentUnitIds = new Set<string>()
    for (const memberId of unit.memberIds) {
      for (const parentId of graph.parentIds(memberId)) {
        parentUnitIds.add(unitOfPerson.get(parentId)!)
      }
    }
    return [...parentUnitIds]
  }

  const orderIndex = new Map<string, number>() // unitId -> index within its generation row

  generationRows[0].sort((a, b) => byCreatedAt(a.memberIds[0], b.memberIds[0]))
  generationRows[0].forEach((u, i) => orderIndex.set(u.id, i))

  for (let g = 1; g <= maxGeneration; g++) {
    const row = generationRows[g]
    row.sort((a, b) => {
      const aParents = unitParentUnits(a)
        .map((id) => orderIndex.get(id))
        .filter((v): v is number => v !== undefined)
      const bParents = unitParentUnits(b)
        .map((id) => orderIndex.get(id))
        .filter((v): v is number => v !== undefined)
      const aKey = aParents.length ? aParents.reduce((s, v) => s + v, 0) / aParents.length : Infinity
      const bKey = bParents.length ? bParents.reduce((s, v) => s + v, 0) / bParents.length : Infinity
      if (aKey !== bKey) return aKey - bKey
      return byCreatedAt(a.memberIds[0], b.memberIds[0])
    })
    row.forEach((u, i) => orderIndex.set(u.id, i))
  }

  // ---- 4. Initial left-to-right x placement per generation --------------
  for (const row of generationRows) {
    let cursor = 0
    for (const unit of row) {
      unit.width = unit.memberIds.length * NODE_WIDTH + (unit.memberIds.length - 1) * PARTNER_GAP
      unit.leftX = cursor
      cursor += unit.width + UNIT_GAP
    }
  }

  // ---- 5. Bottom-up centering pass: pull parents toward their children --
  const unitChildUnits = new Map<string, Set<string>>()
  for (const unit of units.values()) unitChildUnits.set(unit.id, new Set())
  for (const rel of graph.relationships) {
    if (rel.type !== 'parent') continue
    const parentUnit = unitOfPerson.get(rel.personAId)!
    const childUnit = unitOfPerson.get(rel.personBId)!
    if (parentUnit !== childUnit) unitChildUnits.get(parentUnit)!.add(childUnit)
  }

  const centerOf = (unit: Unit) => unit.leftX + unit.width / 2

  for (let g = maxGeneration - 1; g >= 0; g--) {
    const row = generationRows[g]
    for (const unit of row) {
      const childUnits = [...(unitChildUnits.get(unit.id) ?? [])].map((id) => units.get(id)!)
      if (childUnits.length === 0) continue
      const avgChildCenter =
        childUnits.reduce((sum, c) => sum + centerOf(c), 0) / childUnits.length
      unit.leftX = avgChildCenter - unit.width / 2
    }
    // resolve overlaps left-to-right, preserving the crossing-minimized order
    let minLeft = -Infinity
    for (const unit of row) {
      if (unit.leftX < minLeft) unit.leftX = minLeft
      minLeft = unit.leftX + unit.width + UNIT_GAP
    }
  }

  // shift everything so the leftmost node starts at x = 0
  const globalMinX = Math.min(...[...units.values()].map((u) => u.leftX))
  for (const unit of units.values()) unit.leftX -= globalMinX

  // ---- 6. Emit nodes + connector geometry --------------------------------
  const nodes: PositionedNode[] = []
  for (const unit of units.values()) {
    unit.memberIds.forEach((personId, i) => {
      const x = unit.leftX + i * (NODE_WIDTH + PARTNER_GAP) + NODE_WIDTH / 2
      const y = unit.generation * (NODE_HEIGHT + GENERATION_GAP)
      nodes.push({ personId, x, y, generation: unit.generation })
    })
  }

  const nodeX = new Map(nodes.map((n) => [n.personId, n.x]))
  const nodeY = new Map(nodes.map((n) => [n.personId, n.y]))

  const partnerLines: PartnerLine[] = []
  const seenPartnerPairs = new Set<string>()
  for (const rel of graph.relationships) {
    if (rel.type !== 'partner') continue
    const key = [rel.personAId, rel.personBId].sort().join('|')
    if (seenPartnerPairs.has(key)) continue
    seenPartnerPairs.add(key)
    const ax = nodeX.get(rel.personAId)
    const bx = nodeX.get(rel.personBId)
    const ay = nodeY.get(rel.personAId)
    if (ax === undefined || bx === undefined || ay === undefined) continue
    partnerLines.push({
      id: rel.id,
      aId: rel.personAId,
      bId: rel.personBId,
      x1: Math.min(ax, bx),
      x2: Math.max(ax, bx),
      y: ay + NODE_HEIGHT / 2,
    })
  }

  const childEdges: ChildEdgeGroup[] = []
  for (const unit of units.values()) {
    const childUnitIds = [...(unitChildUnits.get(unit.id) ?? [])]
    if (childUnitIds.length === 0) continue

    const childIds = childUnitIds
      .flatMap((id) => units.get(id)!.memberIds)
      .filter((personId) => graph.parentIds(personId).some((pid) => unit.memberIds.includes(pid)))

    if (childIds.length === 0) continue

    const parentX = centerOf(unit)
    const parentY = unit.generation * (NODE_HEIGHT + GENERATION_GAP) + NODE_HEIGHT
    const childTopY = (unit.generation + 1) * (NODE_HEIGHT + GENERATION_GAP)
    const busY = parentY + (childTopY - parentY) / 2

    childEdges.push({
      id: `children-${unit.id}`,
      parentX,
      parentY,
      busY,
      children: childIds.map((personId) => ({
        personId,
        x: nodeX.get(personId) ?? parentX,
        topY: childTopY,
      })),
    })
  }

  // shift everything by the padding so nodes never touch the SVG edge
  for (const n of nodes) {
    n.x += LAYOUT_PADDING
    n.y += LAYOUT_PADDING
  }
  for (const line of partnerLines) {
    line.x1 += LAYOUT_PADDING
    line.x2 += LAYOUT_PADDING
    line.y += LAYOUT_PADDING
  }
  for (const edge of childEdges) {
    edge.parentX += LAYOUT_PADDING
    edge.parentY += LAYOUT_PADDING
    edge.busY += LAYOUT_PADDING
    for (const c of edge.children) {
      c.x += LAYOUT_PADDING
      c.topY += LAYOUT_PADDING
    }
  }

  const maxX = Math.max(...nodes.map((n) => n.x)) + NODE_WIDTH / 2
  const maxY = Math.max(...nodes.map((n) => n.y)) + NODE_HEIGHT / 2
  const width = maxX + LAYOUT_PADDING
  const height = maxY + LAYOUT_PADDING

  if (style === 'rooted') {
    // Every generation/ordering/centering step above assumes "down" growth
    // (generation 0 on top). Rather than duplicate that math, flip the whole
    // canvas vertically here: order-reversing but otherwise coordinate-for-
    // coordinate identical, so the same connector-drawing code downstream
    // still produces a valid line between each mirrored pair of points.
    for (const n of nodes) n.y = height - n.y - NODE_HEIGHT
    for (const line of partnerLines) line.y = height - line.y
    for (const edge of childEdges) {
      edge.parentY = height - edge.parentY
      edge.busY = height - edge.busY
      for (const c of edge.children) c.topY = height - c.topY
    }
  }

  return { nodes, partnerLines, childEdges, width, height }
}
