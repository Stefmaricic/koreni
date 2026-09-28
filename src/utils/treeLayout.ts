import type { FamilyGraph } from '@/utils/familyGraph'

export const NODE_WIDTH = 128
export const NODE_HEIGHT = 172
export const PARTNER_GAP = 20
export const UNIT_GAP = 44
/** Extra breathing room between two unrelated founding lineages (root units with no parent of their own). */
export const TREE_GAP = 96
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
  aX: number
  aY: number
  bX: number
  bY: number
}

/**
 * One parent -> child relationship, drawn as its own curve. `primary` marks
 * whether this edge lies along the child's chosen bloodline (the one that
 * determined their position in the tree) or is a secondary/reconvergent
 * link (e.g. a second recorded parent-unit, or a cousin-marriage loop) that
 * should render as a subtle, thinner, dashed connector instead of steering
 * the layout.
 */
export interface ChildLink {
  id: string
  parentId: string
  childId: string
  parentX: number
  parentY: number
  childX: number
  childY: number
  primary: boolean
  childGeneration: number
}

export interface RootAnchor {
  x: number
  edgeY: number
}

export interface TreeLayoutResult {
  nodes: PositionedNode[]
  partnerLines: PartnerLine[]
  childLinks: ChildLink[]
  rootAnchors: RootAnchor[]
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
  width: number // this unit's own card-row width (partners side by side)
  subtreeWidth: number // width this unit + its primary descendants need to reserve
  primaryParentUnitId: string | null
  secondaryParentUnitIds: string[]
  primaryChildUnitIds: string[]
}

/**
 * Turns a FamilyGraph into absolute pixel positions for every person plus the
 * connector geometry between them. Pure & deterministic: same data in, same
 * layout out, so re-running it after an edit is cheap and predictable.
 *
 * Unlike a classic layered/org-chart algorithm (one shared horizontal row
 * per generation), this recursively sizes each family's own descendant
 * subtree and nests it under its actual parent unit, so unrelated branches
 * never fight for space in a shared row and the tree naturally narrows at
 * its root(s) and widens toward its most recent generations.
 */
export function computeTreeLayout(graph: FamilyGraph, style: TreeStyle = 'classic'): TreeLayoutResult {
  const people = [...graph.people.values()]
  if (people.length === 0) {
    return { nodes: [], partnerLines: [], childLinks: [], rootAnchors: [], width: 0, height: 0 }
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
    units.set(root, {
      id: root,
      memberIds: members,
      generation: 0,
      leftX: 0,
      width: 0,
      subtreeWidth: 0,
      primaryParentUnitId: null,
      secondaryParentUnitIds: [],
      primaryChildUnitIds: [],
    })
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
    unit.width = unit.memberIds.length * NODE_WIDTH + (unit.memberIds.length - 1) * PARTNER_GAP
  }

  // ---- 3. Turn the parent/child DAG into a forest for layout purposes ---
  // A unit can have more than one "parent unit" (e.g. a married-in spouse's
  // own parents are also recorded). Exactly one becomes this unit's primary
  // parent -- the one whose linking parent was added to the tree earliest,
  // which in practice is almost always "whoever's bloodline was already in
  // the tree before this marriage" -- and that primary link is what the
  // recursive width/position pass below follows. Any other parent-unit
  // becomes a secondary cross-link: still drawn, but rendered as a subtle
  // dashed connector that doesn't affect anyone's position.
  interface ParentCandidate {
    parentUnitId: string
    parentPersonId: string
    parentCreatedAt: string
  }
  const parentCandidatesByUnit = new Map<string, ParentCandidate[]>()
  for (const unit of units.values()) {
    const seen = new Map<string, ParentCandidate>()
    for (const memberId of unit.memberIds) {
      for (const parentId of graph.parentIds(memberId)) {
        const parentUnitId = unitOfPerson.get(parentId)
        if (!parentUnitId || parentUnitId === unit.id || seen.has(parentUnitId)) continue
        seen.set(parentUnitId, {
          parentUnitId,
          parentPersonId: parentId,
          parentCreatedAt: graph.people.get(parentId)?.createdAt ?? '',
        })
      }
    }
    parentCandidatesByUnit.set(unit.id, [...seen.values()])
  }

  for (const unit of units.values()) {
    const candidates = parentCandidatesByUnit.get(unit.id) ?? []
    if (candidates.length === 0) continue
    candidates.sort((a, b) => a.parentCreatedAt.localeCompare(b.parentCreatedAt) || a.parentUnitId.localeCompare(b.parentUnitId))
    unit.primaryParentUnitId = candidates[0].parentUnitId
    unit.secondaryParentUnitIds = candidates.slice(1).map((c) => c.parentUnitId)
  }

  for (const unit of units.values()) {
    if (unit.primaryParentUnitId) {
      units.get(unit.primaryParentUnitId)!.primaryChildUnitIds.push(unit.id)
    }
  }

  const rootUnits = [...units.values()]
    .filter((u) => !u.primaryParentUnitId)
    .sort((a, b) => byCreatedAt(a.memberIds[0], b.memberIds[0]))

  for (const unit of units.values()) {
    unit.primaryChildUnitIds.sort((a, b) => byCreatedAt(units.get(a)!.memberIds[0], units.get(b)!.memberIds[0]))
  }

  // ---- 4. Recursive subtree width, bottom-up ----------------------------
  function computeSubtreeWidth(unit: Unit): number {
    const kids = unit.primaryChildUnitIds.map((id) => units.get(id)!)
    if (kids.length === 0) {
      unit.subtreeWidth = unit.width
      return unit.subtreeWidth
    }
    const kidsWidth = kids.reduce((sum, k) => sum + computeSubtreeWidth(k), 0) + (kids.length - 1) * UNIT_GAP
    unit.subtreeWidth = Math.max(unit.width, kidsWidth)
    return unit.subtreeWidth
  }
  for (const root of rootUnits) computeSubtreeWidth(root)

  // ---- 5. Recursive position, top-down ----------------------------------
  function place(unit: Unit, bandLeft: number) {
    const kids = unit.primaryChildUnitIds.map((id) => units.get(id)!)
    if (kids.length === 0) {
      unit.leftX = bandLeft + (unit.subtreeWidth - unit.width) / 2
      return
    }
    const kidsWidth = kids.reduce((sum, k) => sum + k.subtreeWidth, 0) + (kids.length - 1) * UNIT_GAP
    let cursor = bandLeft + (unit.subtreeWidth - kidsWidth) / 2
    for (const kid of kids) {
      place(kid, cursor)
      cursor += kid.subtreeWidth + UNIT_GAP
    }
    const firstCenter = kids[0].leftX + kids[0].width / 2
    const lastCenter = kids[kids.length - 1].leftX + kids[kids.length - 1].width / 2
    unit.leftX = (firstCenter + lastCenter) / 2 - unit.width / 2
  }

  let rootCursor = 0
  for (const root of rootUnits) {
    place(root, rootCursor)
    rootCursor += root.subtreeWidth + TREE_GAP
  }

  // shift everything so the leftmost node starts at x = 0
  const globalMinX = Math.min(...[...units.values()].map((u) => u.leftX))
  for (const unit of units.values()) unit.leftX -= globalMinX

  // ---- 6. Emit nodes ------------------------------------------------------
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

  // ---- 7. Partner lines ---------------------------------------------------
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
    const by = nodeY.get(rel.personBId)
    if (ax === undefined || bx === undefined || ay === undefined || by === undefined) continue
    partnerLines.push({
      id: rel.id,
      aId: rel.personAId,
      bId: rel.personBId,
      aX: ax,
      aY: ay + NODE_HEIGHT / 2,
      bX: bx,
      bY: by + NODE_HEIGHT / 2,
    })
  }

  // ---- 8. Child links: one curve per parent -> child relationship --------
  // Distribute a unit's outgoing links across the unit's own width (instead
  // of always leaving from dead-center) so several children fan out from
  // slightly different points, the way real branches leave a trunk.
  const childLinks: ChildLink[] = []
  for (const rel of graph.relationships) {
    if (rel.type !== 'parent') continue
    const parentId = rel.personAId
    const childId = rel.personBId
    const parentUnitId = unitOfPerson.get(parentId)
    const childUnitId = unitOfPerson.get(childId)
    if (!parentUnitId || !childUnitId) continue
    const parentUnit = units.get(parentUnitId)!
    const childUnit = units.get(childUnitId)!
    const childX = nodeX.get(childId)
    const childY = nodeY.get(childId)
    if (childX === undefined || childY === undefined) continue

    const siblingSlots = parentUnit.primaryChildUnitIds.length || 1
    const slotIndex = Math.max(0, parentUnit.primaryChildUnitIds.indexOf(childUnitId))
    const spread = Math.min(parentUnit.width * 0.7, siblingSlots > 1 ? parentUnit.width * 0.7 : 0)
    const parentX =
      parentUnit.leftX +
      parentUnit.width / 2 +
      (siblingSlots > 1 ? (slotIndex / (siblingSlots - 1) - 0.5) * spread : 0)
    const parentY = parentUnit.generation * (NODE_HEIGHT + GENERATION_GAP) + NODE_HEIGHT

    childLinks.push({
      id: rel.id,
      parentId,
      childId,
      parentX,
      parentY,
      childX,
      childY,
      primary: childUnit.primaryParentUnitId === parentUnitId,
      childGeneration: childUnit.generation,
    })
  }

  // ---- 9. Root anchors (one small trunk graphic per founding lineage) ---
  const rootAnchors: RootAnchor[] = rootUnits.map((unit) => ({
    x: unit.leftX + unit.width / 2,
    edgeY: unit.generation * (NODE_HEIGHT + GENERATION_GAP) + NODE_HEIGHT,
  }))

  // shift everything by the padding so nodes never touch the SVG edge
  for (const n of nodes) {
    n.x += LAYOUT_PADDING
    n.y += LAYOUT_PADDING
  }
  for (const line of partnerLines) {
    line.aX += LAYOUT_PADDING
    line.aY += LAYOUT_PADDING
    line.bX += LAYOUT_PADDING
    line.bY += LAYOUT_PADDING
  }
  for (const link of childLinks) {
    link.parentX += LAYOUT_PADDING
    link.parentY += LAYOUT_PADDING
    link.childX += LAYOUT_PADDING
    link.childY += LAYOUT_PADDING
  }
  for (const anchor of rootAnchors) {
    anchor.x += LAYOUT_PADDING
    anchor.edgeY += LAYOUT_PADDING
  }

  const maxX = Math.max(...nodes.map((n) => n.x)) + NODE_WIDTH / 2
  const maxY = Math.max(...nodes.map((n) => n.y)) + NODE_HEIGHT
  const width = maxX + LAYOUT_PADDING
  const height = maxY + LAYOUT_PADDING

  if (style === 'rooted') {
    // Every generation/ordering/centering step above assumes "down" growth
    // (generation 0 on top). Rather than duplicate that math, flip the whole
    // canvas vertically here: order-reversing but otherwise coordinate-for-
    // coordinate identical, so the same connector-drawing code downstream
    // still produces a valid line between each mirrored pair of points.
    for (const n of nodes) n.y = height - n.y - NODE_HEIGHT
    for (const line of partnerLines) {
      line.aY = height - line.aY
      line.bY = height - line.bY
    }
    for (const link of childLinks) {
      link.parentY = height - link.parentY
      link.childY = height - link.childY
    }
    for (const anchor of rootAnchors) anchor.edgeY = height - anchor.edgeY
  }

  return { nodes, partnerLines, childLinks, rootAnchors, width, height }
}
