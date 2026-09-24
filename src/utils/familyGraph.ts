import type { Person, Relationship } from '@/types/models'

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

  constructor(people: Person[], relationships: Relationship[]) {
    this.people = new Map(people.map((p) => [p.id, p]))
    this.relationships = relationships

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
}
