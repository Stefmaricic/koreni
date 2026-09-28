import { supabase } from '@/lib/supabase'
import type { RelationshipRow } from '@/types/database'
import type { Relationship } from '@/types/models'
import { toRelationship } from '@/utils/mappers'

export async function listRelationships(treeId: string): Promise<Relationship[]> {
  const { data, error } = await supabase.from('relationships').select('*').eq('tree_id', treeId)
  if (error) throw error
  return (data as RelationshipRow[]).map(toRelationship)
}

/** parentId is the parent, childId is the child. */
export async function addParentChild(
  treeId: string,
  parentId: string,
  childId: string,
): Promise<Relationship> {
  if (parentId === childId) throw new Error('A person cannot be their own parent.')
  const { data, error } = await supabase
    .from('relationships')
    .insert({ tree_id: treeId, type: 'parent', person_a_id: parentId, person_b_id: childId })
    .select()
    .single()
  if (error) throw error
  return toRelationship(data as RelationshipRow)
}

export async function addPartner(
  treeId: string,
  personAId: string,
  personBId: string,
): Promise<Relationship> {
  if (personAId === personBId) throw new Error('A person cannot be their own partner.')
  const { data, error } = await supabase
    .from('relationships')
    .insert({ tree_id: treeId, type: 'partner', person_a_id: personAId, person_b_id: personBId })
    .select()
    .single()
  if (error) throw error
  return toRelationship(data as RelationshipRow)
}

export async function removeRelationship(id: string): Promise<void> {
  const { error } = await supabase.from('relationships').delete().eq('id', id)
  if (error) throw error
}

/** Sets or clears (pass null) a partner line's manual curve control point on the tree canvas. */
export async function setPartnerLineCurve(relationshipId: string, point: { x: number; y: number } | null): Promise<void> {
  const { error } = await supabase
    .from('relationships')
    .update({ curve_x: point?.x ?? null, curve_y: point?.y ?? null })
    .eq('id', relationshipId)
  if (error) throw error
}
