import { supabase } from '@/lib/supabase'
import type { ChildLinkCurveRow } from '@/types/database'
import type { ChildLinkCurve } from '@/types/models'
import { toChildLinkCurve } from '@/utils/mappers'

export async function listChildLinkCurves(treeId: string): Promise<ChildLinkCurve[]> {
  const { data, error } = await supabase.from('child_link_curves').select('*').eq('tree_id', treeId)
  if (error) throw error
  return (data as ChildLinkCurveRow[]).map(toChildLinkCurve)
}

/** Sets or clears (pass null) a child branch's manual curve control point on the tree canvas. */
export async function setChildLinkCurve(
  treeId: string,
  childId: string,
  parentKey: string,
  point: { x: number; y: number } | null,
): Promise<void> {
  if (point === null) {
    const { error } = await supabase
      .from('child_link_curves')
      .delete()
      .eq('tree_id', treeId)
      .eq('child_id', childId)
      .eq('parent_key', parentKey)
    if (error) throw error
    return
  }
  const { error } = await supabase
    .from('child_link_curves')
    .upsert(
      { tree_id: treeId, child_id: childId, parent_key: parentKey, curve_x: point.x, curve_y: point.y },
      { onConflict: 'child_id,parent_key' },
    )
  if (error) throw error
}
