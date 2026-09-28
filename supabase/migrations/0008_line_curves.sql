-- Manual curve override for the two kinds of connector line drawn between
-- family members, mirroring the position_x/position_y pattern from
-- 0007_person_positions.sql: when absent, a line renders with its automatic
-- "personality" bow; once someone drags its handle in "arrange" mode, an
-- explicit control point is stored and takes precedence from then on.

-- Partner (spouse) lines map 1:1 to a relationships row, so the control
-- point lives right on it. Column-only change -- no new RLS policy needed,
-- the existing relationships update policy (editors+) already covers it.
alter table relationships add column if not exists curve_x double precision;
alter table relationships add column if not exists curve_y double precision;

-- Child branch lines don't map 1:1 to a relationships row (two parent rows --
-- mom->child, dad->child -- collapse into a single visual branch whenever
-- both parents are partnered), so their curve override needs its own table,
-- keyed by the child plus the sorted set of parent ids that make up that
-- specific branch.
create table child_link_curves (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references family_trees (id) on delete cascade,
  child_id uuid not null references family_members (id) on delete cascade,
  parent_key text not null,
  curve_x double precision not null,
  curve_y double precision not null,
  unique (child_id, parent_key)
);

create index child_link_curves_tree_id_idx on child_link_curves (tree_id);

alter table child_link_curves enable row level security;

create policy "child_link_curves_select_member" on child_link_curves
  for select using (public.is_tree_member(tree_id, 'viewer'));

create policy "child_link_curves_insert_editor" on child_link_curves
  for insert with check (public.is_tree_member(tree_id, 'editor'));

create policy "child_link_curves_update_editor" on child_link_curves
  for update using (public.is_tree_member(tree_id, 'editor'));

create policy "child_link_curves_delete_editor" on child_link_curves
  for delete using (public.is_tree_member(tree_id, 'editor'));
