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
