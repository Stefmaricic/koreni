import { supabase } from '@/lib/supabase'
import type { FamilyMemberRow } from '@/types/database'
import type { Person, PersonFormInput } from '@/types/models'
import { personFormToRow, toPerson } from '@/utils/mappers'

export async function listPeople(treeId: string): Promise<Person[]> {
  const { data, error } = await supabase
    .from('family_members')
    .select('*')
    .eq('tree_id', treeId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as FamilyMemberRow[]).map(toPerson)
}

export async function createPerson(
  treeId: string,
  input: PersonFormInput,
  createdBy: string,
): Promise<Person> {
  const { data, error } = await supabase
    .from('family_members')
    .insert({ tree_id: treeId, created_by: createdBy, ...personFormToRow(input) })
    .select()
    .single()
  if (error) throw error
  return toPerson(data as FamilyMemberRow)
}

export async function updatePerson(personId: string, input: PersonFormInput): Promise<Person> {
  const { data, error } = await supabase
    .from('family_members')
    .update(personFormToRow(input))
    .eq('id', personId)
    .select()
    .single()
  if (error) throw error
  return toPerson(data as FamilyMemberRow)
}

export async function updatePersonPhoto(personId: string, photoUrl: string | null): Promise<void> {
  const { error } = await supabase
    .from('family_members')
    .update({ photo_url: photoUrl })
    .eq('id', personId)
  if (error) throw error
}

/** Sets or clears (pass null) a person's manual override position on the tree canvas. */
export async function setPersonPosition(personId: string, position: { x: number; y: number } | null): Promise<void> {
  const { error } = await supabase
    .from('family_members')
    .update({ position_x: position?.x ?? null, position_y: position?.y ?? null })
    .eq('id', personId)
  if (error) throw error
}

export async function deletePerson(personId: string): Promise<void> {
  const { error } = await supabase.from('family_members').delete().eq('id', personId)
  if (error) throw error
}
