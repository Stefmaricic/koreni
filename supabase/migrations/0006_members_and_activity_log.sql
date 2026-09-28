-- Tree owners can remove a collaborator (but never the owner's own row —
-- ownership itself lives on family_trees.owner_id, this just guards the
-- membership row from being deleted out from under the tree).
create policy "tree_memberships_delete_owner" on tree_memberships
  for delete using (public.is_tree_member(tree_id, 'owner') and role <> 'owner');

-- ---------------------------------------------------------------------------
-- activity_log: who did what to which person, for the tree's "history" view.
-- Rows are written only by the triggers below (security definer), never by
-- direct client inserts, so the log can't be forged or tampered with by an
-- editor/viewer with normal table access.
-- ---------------------------------------------------------------------------

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references family_trees (id) on delete cascade,
  actor_id uuid references profiles (id) on delete set null,
  action text not null check (action in ('person_added', 'person_updated', 'person_removed')),
  person_name text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

create index activity_log_tree_id_idx on activity_log (tree_id, created_at desc);

alter table activity_log enable row level security;

create policy "activity_log_select_member" on activity_log
  for select using (public.is_tree_member(tree_id, 'viewer'));

-- Field-by-field diff of the columns we track on family_members, as
-- {"birth_date": {"old": "...", "new": "..."}, ...} — only keys that changed.
create or replace function public.jsonb_diff(old_row jsonb, new_row jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_object_agg(key, jsonb_build_object('old', old_row -> key, 'new', new_row -> key)),
    '{}'::jsonb
  )
  from jsonb_object_keys(new_row) as key
  where old_row -> key is distinct from new_row -> key;
$$;

create or replace function public.log_family_member_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tracked text[] := array['first_name', 'last_name', 'maiden_name', 'gender',
                             'birth_date', 'birth_place', 'death_date', 'death_place', 'bio'];
  v_diff jsonb;
begin
  if tg_op = 'INSERT' then
    insert into activity_log (tree_id, actor_id, action, person_name)
    values (new.tree_id, auth.uid(), 'person_added', trim(new.first_name || ' ' || coalesce(new.last_name, '')));
    return new;
  elsif tg_op = 'UPDATE' then
    v_diff := public.jsonb_diff(
      (select jsonb_object_agg(k, to_jsonb(old) -> k) from unnest(v_tracked) as k),
      (select jsonb_object_agg(k, to_jsonb(new) -> k) from unnest(v_tracked) as k)
    );
    if v_diff = '{}'::jsonb then
      return new;
    end if;
    insert into activity_log (tree_id, actor_id, action, person_name, details)
    values (new.tree_id, auth.uid(), 'person_updated', trim(new.first_name || ' ' || coalesce(new.last_name, '')), v_diff);
    return new;
  elsif tg_op = 'DELETE' then
    insert into activity_log (tree_id, actor_id, action, person_name)
    values (old.tree_id, auth.uid(), 'person_removed', trim(old.first_name || ' ' || coalesce(old.last_name, '')));
    return old;
  end if;
  return null;
end;
$$;

create trigger family_members_activity_log
  after insert or update or delete on family_members
  for each row execute function public.log_family_member_change();
