import { supabase } from '@/lib/supabase'
import type { MembershipRole, TreeInviteRow } from '@/types/database'

export type InviteRole = Exclude<MembershipRole, 'owner'>

export interface TreeMemberSummary {
  userId: string
  displayName: string | null
  role: MembershipRole
}

export async function createInvite(treeId: string, role: InviteRole, createdBy: string): Promise<TreeInviteRow> {
  const token = crypto.randomUUID()
  const { data, error } = await supabase
    .from('tree_invites')
    .insert({ tree_id: treeId, role, token, created_by: createdBy })
    .select()
    .single()
  if (error) throw error
  return data as TreeInviteRow
}

export async function listInvites(treeId: string): Promise<TreeInviteRow[]> {
  const { data, error } = await supabase
    .from('tree_invites')
    .select('*')
    .eq('tree_id', treeId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as TreeInviteRow[]
}

export async function revokeInvite(id: string): Promise<void> {
  const { error } = await supabase.from('tree_invites').update({ revoked: true }).eq('id', id)
  if (error) throw error
}

export async function removeMember(treeId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('tree_memberships').delete().eq('tree_id', treeId).eq('user_id', userId)
  if (error) throw error
}

interface MemberRow {
  user_id: string
  role: MembershipRole
  profiles: { display_name: string | null } | null
}

export async function listTreeMembers(treeId: string): Promise<TreeMemberSummary[]> {
  const { data, error } = await supabase
    .from('tree_memberships')
    .select('user_id, role, profiles(display_name)')
    .eq('tree_id', treeId)
    .order('role')
  if (error) throw error
  return (data as unknown as MemberRow[]).map((row) => ({
    userId: row.user_id,
    displayName: row.profiles?.display_name ?? null,
    role: row.role,
  }))
}

export interface InviteInfo {
  treeName: string
  role: MembershipRole
  isValid: boolean
}

export async function getInviteInfo(token: string): Promise<InviteInfo | null> {
  const { data, error } = await supabase.rpc('get_invite_info', { p_token: token })
  if (error) throw error
  const row = data?.[0]
  if (!row) return null
  return { treeName: row.tree_name, role: row.role, isValid: row.is_valid }
}

/** Returns the tree id to redirect to on success. */
export async function redeemInvite(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('redeem_invite', { p_token: token })
  if (error) throw error
  return data
}
