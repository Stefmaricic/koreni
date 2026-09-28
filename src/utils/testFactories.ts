import type { MemberGender, Person, Relationship } from '@/types/models'

let counter = 0

export function makePerson(overrides: Partial<Person> = {}): Person {
  counter += 1
  return {
    id: overrides.id ?? `person-${counter}`,
    treeId: 'tree-1',
    firstName: `First${counter}`,
    lastName: null,
    maidenName: null,
    gender: 'unknown' as MemberGender,
    birthDate: null,
    birthPlace: null,
    deathDate: null,
    deathPlace: null,
    bio: null,
    photoUrl: null,
    positionX: null,
    positionY: null,
    createdAt: new Date(2020, 0, counter).toISOString(),
    updatedAt: new Date(2020, 0, counter).toISOString(),
    ...overrides,
  }
}

let relCounter = 0

export function makeRelationship(overrides: Partial<Relationship> & Pick<Relationship, 'type' | 'personAId' | 'personBId'>): Relationship {
  relCounter += 1
  return {
    id: overrides.id ?? `rel-${relCounter}`,
    treeId: 'tree-1',
    ...overrides,
  }
}
