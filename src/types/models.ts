// Domain models used throughout the app (as opposed to the raw DB row shapes
// in database.ts). Keeping these separate makes it easy to add computed /
// derived fields later without touching persistence code.

import type { MemberGender, MembershipRole, RelationshipType } from './database'

export type { MemberGender, MembershipRole, RelationshipType }

export interface Profile {
  id: string
  displayName: string | null
  avatarUrl: string | null
  preferredLanguage: string
}

export interface FamilyTreeSummary {
  id: string
  name: string
  description: string | null
  isDemo: boolean
  memberCount: number
  updatedAt: string
  myRole: MembershipRole
}

export interface Person {
  id: string
  treeId: string
  firstName: string
  lastName: string | null
  maidenName: string | null
  gender: MemberGender
  birthDate: string | null
  birthPlace: string | null
  deathDate: string | null
  deathPlace: string | null
  bio: string | null
  photoUrl: string | null
  positionX: number | null
  positionY: number | null
  createdAt: string
  updatedAt: string
}

export interface Relationship {
  id: string
  treeId: string
  type: RelationshipType
  /** For 'parent': the parent. For 'partner': one side of the pair. */
  personAId: string
  /** For 'parent': the child. For 'partner': the other side of the pair. */
  personBId: string
  /** Manual override for a 'partner' line's curve control point; null means "use the automatic bow." Unused for 'parent' relationships. */
  curveX: number | null
  curveY: number | null
}

/** Manual curve override for a child branch line. A branch doesn't map 1:1 to a single relationship row (two parent rows can collapse into one visual branch), so it's keyed by the child plus the sorted set of parent ids that make up that branch -- see ChildLink.parentKey. */
export interface ChildLinkCurve {
  id: string
  treeId: string
  childId: string
  parentKey: string
  curveX: number
  curveY: number
}

export interface PersonFormInput {
  firstName: string
  lastName: string
  maidenName: string
  gender: MemberGender
  birthDate: string
  birthPlace: string
  deathDate: string
  deathPlace: string
  bio: string
}

export type QuickAddKind = 'parent' | 'partner' | 'child' | 'sibling'
