import { supabase } from '@/lib/supabase'
import type { ActivityAction, ActivityFieldDiff } from '@/types/database'

export interface ActivityEntry {
  id: string
  action: ActivityAction
  personName: string
  actorName: string | null
  details: ActivityFieldDiff | null
  createdAt: string
}

interface ActivityRow {
  id: string
  action: ActivityAction
  person_name: string
  details: ActivityFieldDiff | null
  created_at: string
  actor: { display_name: string | null } | null
}

export async function listActivity(treeId: string, limit = 100): Promise<ActivityEntry[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('id, action, person_name, details, created_at, actor:profiles(display_name)')
    .eq('tree_id', treeId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error

  return (data as unknown as ActivityRow[]).map((row) => ({
    id: row.id,
    action: row.action,
    personName: row.person_name,
    actorName: row.actor?.display_name ?? null,
    details: row.details,
    createdAt: row.created_at,
  }))
}
