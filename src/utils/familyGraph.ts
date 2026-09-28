import type { ChildLinkCurve, Person, Relationship } from '@/types/models'

/**
 * Derives lookups (parents/children/partners/siblings) from the flat
 * relationships list once, so the tree layout and profile views don't each
 * re-scan the whole relationship array.
 */
export class FamilyGraph {
  readonly people: Map<string, Person>
  private readonly parentsOf = new Map<string, Set<string>>()
  private readonly childrenOf = new Map<string, Set<string>>()
  private readonly partnersOf = new Map<string, Set<string>>()
  readonly relationships: Relationship[]
  private readonly childLinkCurveByKey = new Map<string, { x: number; y: number }>()

  constructor(people: Person[], relationships: Relationship[], childLinkCurves: ChildLinkCurve[] = []) {
    this.people = new Map(people.map((p) => [p.id, p]))
    this.relationships = relationships
    for (const curve of childLinkCurves) {
      this.childLinkCurveByKey.set(`${curve.childId}|${curve.parentKey}`, { x: curve.curveX, y: curve.curveY })
    }

    for (const rel of relationships) {
      if (rel.type === 'parent') {
        this.addToSet(this.childrenOf, rel.personAId, rel.personBId)
        this.addToSet(this.parentsOf, rel.personBId, rel.personAId)
      } else {
        this.addToSet(this.partnersOf, rel.personAId, rel.personBId)
        this.addToSet(this.partnersOf, rel.personBId, rel.personAId)
      }
    }
  }

  private addToSet(map: Map<string, Set<string>>, key: string, value: string) {
    if (!map.has(key)) map.set(key, new Set())
    map.get(key)!.add(value)
  }

  parentIds(personId: string): string[] {
    return [...(this.parentsOf.get(personId) ?? [])]
  }

  childIds(personId: string): string[] {
    return [...(this.childrenOf.get(personId) ?? [])]
  }

  partnerIds(personId: string): string[] {
    return [...(this.partnersOf.get(personId) ?? [])]
  }

  /** People who share at least one parent with personId (excluding personId itself). */
  siblingIds(personId: string): string[] {
    const siblings = new Set<string>()
    for (const parentId of this.parentIds(personId)) {
      for (const childId of this.childIds(parentId)) {
        if (childId !== personId) siblings.add(childId)
      }
    }
    return [...siblings]
  }

  parents(personId: string): Person[] {
    return this.resolve(this.parentIds(personId))
  }

  children(personId: string): Person[] {
    return this.resolve(this.childIds(personId))
  }

  partners(personId: string): Person[] {
    return this.resolve(this.partnerIds(personId))
  }

  siblings(personId: string): Person[] {
    return this.resolve(this.siblingIds(personId))
  }

  private resolve(ids: string[]): Person[] {
    return ids.map((id) => this.people.get(id)).filter((p): p is Person => Boolean(p))
  }

  parentRelationshipId(parentId: string, childId: string): string | undefined {
    return this.relationships.find(
      (r) => r.type === 'parent' && r.personAId === parentId && r.personBId === childId,
    )?.id
  }

  partnerRelationshipId(aId: string, bId: string): string | undefined {
    return this.relationships.find(
      (r) =>
        r.type === 'partner' &&
        ((r.personAId === aId && r.personBId === bId) || (r.personAId === bId && r.personBId === aId)),
    )?.id
  }

  /** A child branch's persisted manual curve control point, or null if it still uses the automatic bow. */
  childLinkCurve(childId: string, parentKey: string): { x: number; y: number } | null {
    return this.childLinkCurveByKey.get(`${childId}|${parentKey}`) ?? null
  }

  /**
   * A scoped editor's editable region: rootPersonId + partner, the direct
   * ancestor line up to 4 generations up (each ancestor's partner included),
   * and the direct descendant line up to 2 generations down (each
   * descendant's partner included). This is a direction-locked walk, not a
   * generation band -- siblings/aunts/uncles/cousins are excluded since the
   * walk never reverses direction. Mirrors the server-side
   * get_edit_scope() in supabase/migrations/0009_scoped_editor.sql; this
   * copy is for instant UI feedback only, not the security boundary.
   */
  editableScope(rootPersonId: string): Set<string> {
    const scope = new Set<string>()
    if (!this.people.has(rootPersonId)) return scope

    const addWithPartners = (personId: string) => {
      scope.add(personId)
      for (const partnerId of this.partnerIds(personId)) scope.add(partnerId)
    }

    addWithPartners(rootPersonId)
    this.walkChain(rootPersonId, (id) => this.parentIds(id), 4, addWithPartners)
    this.walkChain(rootPersonId, (id) => this.childIds(id), 2, addWithPartners)

    return scope
  }

  /**
   * Bounded-depth BFS along a single one-hop relation (parentIds or
   * childIds), visiting each newly-reached node at most once per depth. The
   * outer loop is bounded by maxDepth regardless of graph shape, so a
   * re-convergent lineage (e.g. a cousin marriage) can't cause unbounded
   * work -- same termination argument as the SQL recursive CTEs it mirrors.
   */
  private walkChain(rootId: string, step: (id: string) => string[], maxDepth: number, visit: (id: string) => void): void {
    let frontier = new Set<string>([rootId])
    for (let depth = 0; depth < maxDepth; depth++) {
      const next = new Set<string>()
      for (const personId of frontier) {
        for (const neighborId of step(personId)) next.add(neighborId)
      }
      if (next.size === 0) break
      for (const id of next) visit(id)
      frontier = next
    }
  }
}
