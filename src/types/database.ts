// Hand-written mirror of the Supabase schema (supabase/migrations/0001_init.sql).
// If the schema changes, update this alongside the migration. To regenerate
// from a live project instead, see README.md ("Generating types").

export type MembershipRole = 'owner' | 'editor' | 'viewer'
export type MemberGender = 'female' | 'male' | 'other' | 'unknown'
export type RelationshipType = 'parent' | 'partner'

// These are `type` aliases rather than `interface`s on purpose: an `interface`
// has no implicit index signature, so it fails the `Record<string, unknown>`
// structural check that supabase-js's GenericTable constraint relies on,
// which silently collapses every query's inferred type to `never`.

export type ProfileRow = {
  id: string
  display_name: string | null
  avatar_url: string | null
  preferred_language: string
  created_at: string
  updated_at: string
}

export type FamilyTreeRow = {
  id: string
  owner_id: string
  name: string
  description: string | null
  is_demo: boolean
  created_at: string
  updated_at: string
}

export type TreeMembershipRow = {
  id: string
  tree_id: string
  user_id: string
  role: MembershipRole
  created_at: string
}

export type FamilyMemberRow = {
  id: string
  tree_id: string
  first_name: string
  last_name: string | null
  maiden_name: string | null
  gender: MemberGender
  birth_date: string | null
  birth_place: string | null
  death_date: string | null
  death_place: string | null
  bio: string | null
  photo_url: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type RelationshipRow = {
  id: string
  tree_id: string
  type: RelationshipType
  person_a_id: string
  person_b_id: string
  created_at: string
}

export type FeedbackRow = {
  id: string
  user_id: string
  user_email: string | null
  message: string
  page_path: string | null
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: Partial<ProfileRow> & { id: string }
        Update: Partial<ProfileRow>
        Relationships: []
      }
      family_trees: {
        Row: FamilyTreeRow
        Insert: Partial<FamilyTreeRow> & { name: string; owner_id: string }
        Update: Partial<FamilyTreeRow>
        Relationships: []
      }
      tree_memberships: {
        Row: TreeMembershipRow
        Insert: Partial<TreeMembershipRow> & { tree_id: string; user_id: string }
        Update: Partial<TreeMembershipRow>
        Relationships: []
      }
      family_members: {
        Row: FamilyMemberRow
        Insert: Partial<FamilyMemberRow> & { tree_id: string; first_name: string }
        Update: Partial<FamilyMemberRow>
        Relationships: []
      }
      relationships: {
        Row: RelationshipRow
        Insert: Partial<RelationshipRow> & {
          tree_id: string
          type: RelationshipType
          person_a_id: string
          person_b_id: string
        }
        Update: Partial<RelationshipRow>
        Relationships: []
      }
      feedback: {
        Row: FeedbackRow
        Insert: Partial<FeedbackRow> & { user_id: string; message: string }
        Update: Partial<FeedbackRow>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
