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
  position_x: number | null
  position_y: number | null
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

export type TreeInviteRow = {
  id: string
  tree_id: string
  role: MembershipRole
  token: string
  created_by: string
  created_at: string
  expires_at: string
  used_by: string | null
  used_at: string | null
  revoked: boolean
}

export type ActivityAction =
  | 'person_added'
  | 'person_updated'
  | 'person_removed'
  | 'relationship_added'
  | 'relationship_removed'

/** Shape depends on `action`: a field-diff object for person_updated, or
 *  { relationship_type, person_a_name, person_b_name } for relationship events. */
export type ActivityDetails = Record<string, unknown>

export type ActivityLogRow = {
  id: string
  tree_id: string
  actor_id: string | null
  action: ActivityAction
  person_name: string
  details: ActivityDetails | null
  created_at: string
}

// Real foreign-key metadata, not just `[]` placeholders: supabase-js's typed
// query builder uses these to resolve embeds like `family_members(count)` or
// `profiles(display_name)` inside a .select() string. Leaving this empty
// works fine for plain column selects, but silently turns any embed into a
// `SelectQueryError` type — which then makes the *whole* query result type
// `never`, the same class of bug documented above for Row/Insert/Update.
type FkTo<Table extends string, Columns extends readonly string[]> = {
  foreignKeyName: string
  columns: Columns
  isOneToOne: false
  referencedRelation: Table
  referencedColumns: ['id']
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
        Relationships: [FkTo<'profiles', ['owner_id']>]
      }
      tree_memberships: {
        Row: TreeMembershipRow
        Insert: Partial<TreeMembershipRow> & { tree_id: string; user_id: string }
        Update: Partial<TreeMembershipRow>
        Relationships: [FkTo<'family_trees', ['tree_id']>, FkTo<'profiles', ['user_id']>]
      }
      family_members: {
        Row: FamilyMemberRow
        Insert: Partial<FamilyMemberRow> & { tree_id: string; first_name: string }
        Update: Partial<FamilyMemberRow>
        Relationships: [FkTo<'family_trees', ['tree_id']>, FkTo<'profiles', ['created_by']>]
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
        Relationships: [
          FkTo<'family_trees', ['tree_id']>,
          FkTo<'family_members', ['person_a_id']>,
          FkTo<'family_members', ['person_b_id']>,
        ]
      }
      feedback: {
        Row: FeedbackRow
        Insert: Partial<FeedbackRow> & { user_id: string; message: string }
        Update: Partial<FeedbackRow>
        Relationships: [FkTo<'profiles', ['user_id']>]
      }
      tree_invites: {
        Row: TreeInviteRow
        Insert: Partial<TreeInviteRow> & { tree_id: string; role: MembershipRole; token: string; created_by: string }
        Update: Partial<TreeInviteRow>
        Relationships: [FkTo<'family_trees', ['tree_id']>, FkTo<'profiles', ['created_by']>]
      }
      activity_log: {
        Row: ActivityLogRow
        Insert: Partial<ActivityLogRow> & { tree_id: string; action: ActivityAction; person_name: string }
        Update: Partial<ActivityLogRow>
        Relationships: [FkTo<'family_trees', ['tree_id']>, FkTo<'profiles', ['actor_id']>]
      }
    }
    Views: Record<string, never>
    Functions: {
      get_invite_info: {
        Args: { p_token: string }
        Returns: { tree_name: string; role: MembershipRole; is_valid: boolean }[]
      }
      redeem_invite: {
        Args: { p_token: string }
        Returns: string
      }
    }
  }
}
