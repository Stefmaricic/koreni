import { DEMO_EDGES, DEMO_PEOPLE } from '@/demo/demoData'
import { supabase } from '@/lib/supabase'
import type { FamilyMemberRow } from '@/types/database'

/** Creates a demo family tree (is_demo = true) with ~18 fictional people so the tree view can be tried without manual data entry. */
export async function seedDemoTree(ownerId: string, treeName: string): Promise<string> {
  const { data: tree, error: treeError } = await supabase
    .from('family_trees')
    .insert({ owner_id: ownerId, name: treeName, is_demo: true })
    .select()
    .single()
  if (treeError) throw treeError

  const peopleToInsert = DEMO_PEOPLE.map((p) => ({
    tree_id: tree.id,
    created_by: ownerId,
    first_name: p.firstName,
    last_name: p.lastName ?? null,
    maiden_name: p.maidenName ?? null,
    gender: p.gender,
    birth_date: p.birthDate ?? null,
    birth_place: p.birthPlace ?? null,
    death_date: p.deathDate ?? null,
    death_place: p.deathPlace ?? null,
    bio: p.bio ?? null,
  }))

  // Supabase/PostgREST preserves row order between a multi-row INSERT and its
  // RETURNING clause, so we can zip the inserted rows back to demo keys by index.
  const { data: insertedPeople, error: peopleError } = await supabase
    .from('family_members')
    .insert(peopleToInsert)
    .select()
  if (peopleError) throw peopleError

  const idByKey = new Map<string, string>()
  ;(insertedPeople as FamilyMemberRow[]).forEach((row, i) => {
    idByKey.set(DEMO_PEOPLE[i].key, row.id)
  })

  const relationshipsToInsert = DEMO_EDGES.map((edge) => ({
    tree_id: tree.id,
    type: edge.type,
    person_a_id: idByKey.get(edge.a)!,
    person_b_id: idByKey.get(edge.b)!,
  }))

  const { error: relError } = await supabase.from('relationships').insert(relationshipsToInsert)
  if (relError) throw relError

  return tree.id
}
