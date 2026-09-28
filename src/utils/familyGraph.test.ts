import { describe, expect, it } from 'vitest'
import { FamilyGraph } from '@/utils/familyGraph'
import { makePerson, makeRelationship } from '@/utils/testFactories'

describe('FamilyGraph', () => {
  it('derives parents, children and partners from relationships', () => {
    const mom = makePerson({ id: 'mom' })
    const dad = makePerson({ id: 'dad' })
    const kid = makePerson({ id: 'kid' })

    const graph = new FamilyGraph(
      [mom, dad, kid],
      [
        makeRelationship({ type: 'partner', personAId: 'mom', personBId: 'dad' }),
        makeRelationship({ type: 'parent', personAId: 'mom', personBId: 'kid' }),
        makeRelationship({ type: 'parent', personAId: 'dad', personBId: 'kid' }),
      ],
    )

    expect(graph.parentIds('kid').sort()).toEqual(['dad', 'mom'])
    expect(graph.childIds('mom')).toEqual(['kid'])
    expect(graph.partnerIds('mom')).toEqual(['dad'])
    expect(graph.partnerIds('dad')).toEqual(['mom'])
  })

  it('derives siblings from shared parents without storing them directly', () => {
    const mom = makePerson({ id: 'mom' })
    const kid1 = makePerson({ id: 'kid1' })
    const kid2 = makePerson({ id: 'kid2' })
    const unrelated = makePerson({ id: 'unrelated' })

    const graph = new FamilyGraph(
      [mom, kid1, kid2, unrelated],
      [
        makeRelationship({ type: 'parent', personAId: 'mom', personBId: 'kid1' }),
        makeRelationship({ type: 'parent', personAId: 'mom', personBId: 'kid2' }),
      ],
    )

    expect(graph.siblingIds('kid1')).toEqual(['kid2'])
    expect(graph.siblingIds('kid2')).toEqual(['kid1'])
    expect(graph.siblingIds('unrelated')).toEqual([])
  })

  it('finds the relationship id for a parent/child or partner pair regardless of lookup order', () => {
    const a = makePerson({ id: 'a' })
    const b = makePerson({ id: 'b' })
    const graph = new FamilyGraph(
      [a, b],
      [makeRelationship({ id: 'partner-rel', type: 'partner', personAId: 'a', personBId: 'b' })],
    )

    expect(graph.partnerRelationshipId('a', 'b')).toBe('partner-rel')
    expect(graph.partnerRelationshipId('b', 'a')).toBe('partner-rel')
  })

  it('handles an empty graph without throwing', () => {
    const graph = new FamilyGraph([], [])
    expect(graph.parents('anyone')).toEqual([])
    expect(graph.siblings('anyone')).toEqual([])
  })
})

describe('FamilyGraph.editableScope', () => {
  it('includes the root, their partner, ancestors up to 4 generations (with partners), and descendants up to 2 generations (with partners)', () => {
    // A 7-generation straight chain: gp4 -> gp3 -> gp2 -> gp1 -> me -> child -> grandchild -> greatGrandchild
    // Every person on the chain has a partner attached.
    const chain = ['gp4', 'gp3', 'gp2', 'gp1', 'me', 'child', 'grandchild', 'greatGrandchild']
    const people = chain.flatMap((id) => [makePerson({ id }), makePerson({ id: `${id}-partner` })])
    const relationships = [
      ...chain.map((id) => makeRelationship({ type: 'partner', personAId: id, personBId: `${id}-partner` })),
      ...chain.slice(0, -1).map((id, i) => makeRelationship({ type: 'parent', personAId: id, personBId: chain[i + 1] })),
    ]
    const graph = new FamilyGraph(people, relationships)

    const scope = graph.editableScope('me')

    // root + partner
    expect(scope.has('me')).toBe(true)
    expect(scope.has('me-partner')).toBe(true)
    // ancestors up to 4 generations up, with their partners
    expect(scope.has('gp1')).toBe(true)
    expect(scope.has('gp1-partner')).toBe(true)
    expect(scope.has('gp2')).toBe(true)
    expect(scope.has('gp3')).toBe(true)
    expect(scope.has('gp4')).toBe(true)
    expect(scope.has('gp4-partner')).toBe(true)
    // descendants up to 2 generations down, with their partners
    expect(scope.has('child')).toBe(true)
    expect(scope.has('child-partner')).toBe(true)
    expect(scope.has('grandchild')).toBe(true)
    expect(scope.has('grandchild-partner')).toBe(true)
    // beyond the 2-down boundary must be excluded
    expect(scope.has('greatGrandchild')).toBe(false)
    expect(scope.has('greatGrandchild-partner')).toBe(false)
  })

  it('excludes siblings, aunts/uncles, and cousins -- the walk never reverses direction', () => {
    const grandparent = makePerson({ id: 'grandparent' })
    const parent = makePerson({ id: 'parent' })
    const auntUncle = makePerson({ id: 'auntUncle' })
    const me = makePerson({ id: 'me' })
    const sibling = makePerson({ id: 'sibling' })
    const cousin = makePerson({ id: 'cousin' })

    const graph = new FamilyGraph(
      [grandparent, parent, auntUncle, me, sibling, cousin],
      [
        makeRelationship({ type: 'parent', personAId: 'grandparent', personBId: 'parent' }),
        makeRelationship({ type: 'parent', personAId: 'grandparent', personBId: 'auntUncle' }),
        makeRelationship({ type: 'parent', personAId: 'parent', personBId: 'me' }),
        makeRelationship({ type: 'parent', personAId: 'parent', personBId: 'sibling' }),
        makeRelationship({ type: 'parent', personAId: 'auntUncle', personBId: 'cousin' }),
      ],
    )

    const scope = graph.editableScope('me')

    expect(scope.has('me')).toBe(true)
    expect(scope.has('parent')).toBe(true)
    expect(scope.has('grandparent')).toBe(true)
    expect(scope.has('sibling')).toBe(false)
    expect(scope.has('auntUncle')).toBe(false)
    expect(scope.has('cousin')).toBe(false)
  })

  it('does not include a spouse-by-marriage own ancestors/descendants (partners are a terminal addition)', () => {
    const me = makePerson({ id: 'me' })
    const spouse = makePerson({ id: 'spouse' })
    const spousesParent = makePerson({ id: 'spousesParent' })
    const spousesOtherChild = makePerson({ id: 'spousesOtherChild' })

    const graph = new FamilyGraph(
      [me, spouse, spousesParent, spousesOtherChild],
      [
        makeRelationship({ type: 'partner', personAId: 'me', personBId: 'spouse' }),
        makeRelationship({ type: 'parent', personAId: 'spousesParent', personBId: 'spouse' }),
        makeRelationship({ type: 'parent', personAId: 'spousesParent', personBId: 'spousesOtherChild' }),
      ],
    )

    const scope = graph.editableScope('me')

    expect(scope.has('spouse')).toBe(true)
    expect(scope.has('spousesParent')).toBe(false)
    expect(scope.has('spousesOtherChild')).toBe(false)
  })

  it('stays bounded and terminates on a re-convergent lineage (cousin marriage loop)', () => {
    // grandparent -> two children (parentA, parentB) who marry each other's
    // lines back together via a cousin-marriage: me (child of parentA) is
    // partnered with cousin (child of parentB), both descend from the same
    // grandparent two generations up -- a diamond, not a simple tree.
    const grandparent = makePerson({ id: 'grandparent' })
    const parentA = makePerson({ id: 'parentA' })
    const parentB = makePerson({ id: 'parentB' })
    const me = makePerson({ id: 'me' })
    const cousin = makePerson({ id: 'cousin' })

    const graph = new FamilyGraph(
      [grandparent, parentA, parentB, me, cousin],
      [
        makeRelationship({ type: 'parent', personAId: 'grandparent', personBId: 'parentA' }),
        makeRelationship({ type: 'parent', personAId: 'grandparent', personBId: 'parentB' }),
        makeRelationship({ type: 'parent', personAId: 'parentA', personBId: 'me' }),
        makeRelationship({ type: 'parent', personAId: 'parentB', personBId: 'cousin' }),
        makeRelationship({ type: 'partner', personAId: 'me', personBId: 'cousin' }),
      ],
    )

    expect(() => graph.editableScope('me')).not.toThrow()
    const scope = graph.editableScope('me')
    expect(scope.has('me')).toBe(true)
    expect(scope.has('cousin')).toBe(true) // included as me's partner, not via the aunt/uncle line
    expect(scope.has('parentA')).toBe(true)
    expect(scope.has('grandparent')).toBe(true)
  })

  it('returns an empty set for an unknown root person', () => {
    const graph = new FamilyGraph([], [])
    expect(graph.editableScope('nobody')).toEqual(new Set())
  })
})
