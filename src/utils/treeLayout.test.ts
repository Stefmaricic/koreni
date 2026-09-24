import { describe, expect, it } from 'vitest'
import { FamilyGraph } from '@/utils/familyGraph'
import { makePerson, makeRelationship } from '@/utils/testFactories'
import { computeTreeLayout, NODE_WIDTH } from '@/utils/treeLayout'

describe('computeTreeLayout', () => {
  it('returns an empty layout for an empty graph', () => {
    const layout = computeTreeLayout(new FamilyGraph([], []))
    expect(layout.nodes).toEqual([])
    expect(layout.width).toBe(0)
    expect(layout.height).toBe(0)
  })

  it('assigns increasing generations down parent -> child edges, and equal generations across partners', () => {
    const grandpa = makePerson({ id: 'grandpa', createdAt: '2020-01-01' })
    const grandma = makePerson({ id: 'grandma', createdAt: '2020-01-02' })
    const dad = makePerson({ id: 'dad', createdAt: '2020-01-03' })
    const momInLaw = makePerson({ id: 'mom-in-law', createdAt: '2020-01-04' })
    const kid = makePerson({ id: 'kid', createdAt: '2020-01-05' })

    const graph = new FamilyGraph(
      [grandpa, grandma, dad, momInLaw, kid],
      [
        makeRelationship({ type: 'partner', personAId: 'grandpa', personBId: 'grandma' }),
        makeRelationship({ type: 'parent', personAId: 'grandpa', personBId: 'dad' }),
        makeRelationship({ type: 'parent', personAId: 'grandma', personBId: 'dad' }),
        // momInLaw married in: no parent edges of her own, but shares a generation via the partner edge
        makeRelationship({ type: 'partner', personAId: 'dad', personBId: 'mom-in-law' }),
        makeRelationship({ type: 'parent', personAId: 'dad', personBId: 'kid' }),
        makeRelationship({ type: 'parent', personAId: 'mom-in-law', personBId: 'kid' }),
      ],
    )

    const layout = computeTreeLayout(graph)
    const genOf = (id: string) => layout.nodes.find((n) => n.personId === id)?.generation

    expect(genOf('grandpa')).toBe(0)
    expect(genOf('grandma')).toBe(0)
    expect(genOf('dad')).toBe(1)
    expect(genOf('mom-in-law')).toBe(1)
    expect(genOf('kid')).toBe(2)
  })

  it('keeps partners adjacent and never overlaps siblings in the same generation', () => {
    const mom = makePerson({ id: 'mom', createdAt: '2020-01-01' })
    const dad = makePerson({ id: 'dad', createdAt: '2020-01-02' })
    const kid1 = makePerson({ id: 'kid1', createdAt: '2020-01-03' })
    const kid2 = makePerson({ id: 'kid2', createdAt: '2020-01-04' })
    const kid3 = makePerson({ id: 'kid3', createdAt: '2020-01-05' })

    const graph = new FamilyGraph(
      [mom, dad, kid1, kid2, kid3],
      [
        makeRelationship({ type: 'partner', personAId: 'mom', personBId: 'dad' }),
        makeRelationship({ type: 'parent', personAId: 'mom', personBId: 'kid1' }),
        makeRelationship({ type: 'parent', personAId: 'dad', personBId: 'kid1' }),
        makeRelationship({ type: 'parent', personAId: 'mom', personBId: 'kid2' }),
        makeRelationship({ type: 'parent', personAId: 'dad', personBId: 'kid2' }),
        makeRelationship({ type: 'parent', personAId: 'mom', personBId: 'kid3' }),
        makeRelationship({ type: 'parent', personAId: 'dad', personBId: 'kid3' }),
      ],
    )

    const layout = computeTreeLayout(graph)
    const xOf = (id: string) => layout.nodes.find((n) => n.personId === id)!.x

    const siblingXs = [xOf('kid1'), xOf('kid2'), xOf('kid3')].sort((a, b) => a - b)
    for (let i = 1; i < siblingXs.length; i++) {
      expect(siblingXs[i] - siblingXs[i - 1]).toBeGreaterThanOrEqual(NODE_WIDTH)
    }

    // partners sit right next to each other
    expect(Math.abs(xOf('mom') - xOf('dad'))).toBeLessThan(NODE_WIDTH * 2)
  })

  it('lays out disconnected people (no relationships at all) without throwing or overlapping', () => {
    const a = makePerson({ id: 'a', createdAt: '2020-01-01' })
    const b = makePerson({ id: 'b', createdAt: '2020-01-02' })
    const graph = new FamilyGraph([a, b], [])

    const layout = computeTreeLayout(graph)
    expect(layout.nodes).toHaveLength(2)
    const [xa, xb] = layout.nodes.map((n) => n.x)
    expect(Math.abs(xa - xb)).toBeGreaterThanOrEqual(NODE_WIDTH)
  })

  it("'rooted' style mirrors the chart so generation 0 (oldest) sits at the bottom", () => {
    const grandparent = makePerson({ id: 'gp', createdAt: '2020-01-01' })
    const parent = makePerson({ id: 'p', createdAt: '2020-01-02' })
    const child = makePerson({ id: 'c', createdAt: '2020-01-03' })

    const graph = new FamilyGraph(
      [grandparent, parent, child],
      [
        makeRelationship({ type: 'parent', personAId: 'gp', personBId: 'p' }),
        makeRelationship({ type: 'parent', personAId: 'p', personBId: 'c' }),
      ],
    )

    const classic = computeTreeLayout(graph, 'classic')
    const yOfClassic = (id: string) => classic.nodes.find((n) => n.personId === id)!.y
    expect(yOfClassic('gp')).toBeLessThan(yOfClassic('p'))
    expect(yOfClassic('p')).toBeLessThan(yOfClassic('c'))

    const rooted = computeTreeLayout(graph, 'rooted')
    const yOfRooted = (id: string) => rooted.nodes.find((n) => n.personId === id)!.y
    expect(yOfRooted('gp')).toBeGreaterThan(yOfRooted('p'))
    expect(yOfRooted('p')).toBeGreaterThan(yOfRooted('c'))

    // mirroring changes vertical order and coordinates only, never who's related to whom
    expect(rooted.nodes).toHaveLength(classic.nodes.length)
    expect(rooted.width).toBeCloseTo(classic.width)
    expect(rooted.height).toBeCloseTo(classic.height)
  })
})
