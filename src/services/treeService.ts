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

export async function getMyRole(treeId: string, userId: string) {
  const { data, error } = await supabase
    .from('tree_memberships')
    .select('role')
    .eq('tree_id', treeId)
    .eq('user_id', userId)
    .single()
  if (error) throw error
  return data.role
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
