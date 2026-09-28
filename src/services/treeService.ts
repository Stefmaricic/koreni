import { supabase } from '@/lib/supabase'
import type { FamilyTreeSummary } from '@/types/models'

interface TreeRowWithCounts {
  id: string
  name: string
  description: string | null
  is_demo: boolean
  updated_at: string
  family_members: { count: number }[]
  tree_memberships: { role: FamilyTreeSummary['myRole'] }[]
}

export async function listMyTrees(userId: string): Promise<FamilyTreeSummary[]> {
  const { data, error } = await supabase
    .from('family_trees')
    .select(
      'id, name, description, is_demo, updated_at, family_members(count), tree_memberships!inner(role)',
    )
    .eq('tree_memberships.user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw error

  return (data as TreeRowWithCounts[]).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    isDemo: row.is_demo,
    updatedAt: row.updated_at,
    memberCount: row.family_members[0]?.count ?? 0,
    myRole: row.tree_memberships[0]?.role ?? 'viewer',
  }))
}

export async function getTree(treeId: string) {
  const { data, error } = await supabase.from('family_trees').select('*').eq('id', treeId).single()
  if (error) throw error
  return data
}

export interface MyMembership {
  role: FamilyTreeSummary['myRole']
  claimedPersonId: string | null
}

/**
 * Null means "not a member" rather than an error — this also covers the app
 * owner opening someone else's tree from the admin panel: RLS still lets
 * them read it (see is_app_admin() in the feedback/admin migration), but
 * with no membership row they correctly fall back to a read-only view
 * instead of the page erroring out.
 */
export async function getMyMembership(treeId: string, userId: string): Promise<MyMembership | null> {
  const { data, error } = await supabase
    .from('tree_memberships')
    .select('role, claimed_person_id')
    .eq('tree_id', treeId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { role: data.role, claimedPersonId: data.claimed_person_id }
}

export interface AdminTreeSummary {
  id: string
  name: string
  isDemo: boolean
  updatedAt: string
  memberCount: number
  ownerName: string | null
}

interface AdminTreeRow {
  id: string
  name: string
  is_demo: boolean
  updated_at: string
  family_members: { count: number }[]
  owner: { display_name: string | null } | null
}

/** Every tree on the platform. Only ever returns rows for the app owner's account — enforced by RLS, not this function. */
export async function listAllTreesForAdmin(): Promise<AdminTreeSummary[]> {
  const { data, error } = await supabase
    .from('family_trees')
    .select('id, name, is_demo, updated_at, family_members(count), owner:profiles(display_name)')
    .order('updated_at', { ascending: false })

  if (error) throw error

  return (data as unknown as AdminTreeRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    isDemo: row.is_demo,
    updatedAt: row.updated_at,
    memberCount: row.family_members[0]?.count ?? 0,
    ownerName: row.owner?.display_name ?? null,
  }))
}

export async function createTree(ownerId: string, name: string, description?: string) {
  const { data, error } = await supabase
    .from('family_trees')
    .insert({ owner_id: ownerId, name, description: description || null })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function renameTree(treeId: string, name: string) {
  const { error } = await supabase.from('family_trees').update({ name }).eq('id', treeId)
  if (error) throw error
}

export async function deleteTree(treeId: string) {
  const { error } = await supabase.from('family_trees').delete().eq('id', treeId)
  if (error) throw error
}
