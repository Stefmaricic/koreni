import type { ChildLinkCurveRow, FamilyMemberRow, RelationshipRow } from '@/types/database'
import type { ChildLinkCurve, Person, PersonFormInput, Relationship } from '@/types/models'

export function toPerson(row: FamilyMemberRow): Person {
  return {
    id: row.id,
    treeId: row.tree_id,
    firstName: row.first_name,
    lastName: row.last_name,
    maidenName: row.maiden_name,
    gender: row.gender,
    birthDate: row.birth_date,
    birthPlace: row.birth_place,
    deathDate: row.death_date,
    deathPlace: row.death_place,
    bio: row.bio,
    photoUrl: row.photo_url,
    positionX: row.position_x,
    positionY: row.position_y,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toRelationship(row: RelationshipRow): Relationship {
  return {
    id: row.id,
    treeId: row.tree_id,
    type: row.type,
    personAId: row.person_a_id,
    personBId: row.person_b_id,
    curveX: row.curve_x,
    curveY: row.curve_y,
  }
}

export function toChildLinkCurve(row: ChildLinkCurveRow): ChildLinkCurve {
  return {
    id: row.id,
    treeId: row.tree_id,
    childId: row.child_id,
    parentKey: row.parent_key,
    curveX: row.curve_x,
    curveY: row.curve_y,
  }
}

export function personFormToRow(input: PersonFormInput) {
  return {
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim() || null,
    maiden_name: input.maidenName.trim() || null,
    gender: input.gender,
    birth_date: input.birthDate || null,
    birth_place: input.birthPlace.trim() || null,
    death_date: input.deathDate || null,
    death_place: input.deathPlace.trim() || null,
    bio: input.bio.trim() || null,
  }
}

export function personFullName(p: Pick<Person, 'firstName' | 'lastName'>) {
  return [p.firstName, p.lastName].filter(Boolean).join(' ')
}

export function birthYear(p: Pick<Person, 'birthDate'>) {
  return p.birthDate ? new Date(p.birthDate).getFullYear() : null
}
