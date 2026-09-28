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
  action text not null check (action in (
    'person_added', 'person_updated', 'person_removed',
    'relationship_added', 'relationship_removed'
  )),
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

-- Connecting/disconnecting two people (parent/child or partner). Note: when a
-- person is deleted, their relationships cascade-delete too and each fires
-- this trigger as well — the removed person's name may show as unavailable
-- there since their family_members row is already gone by that point, but
-- the paired person's name and the standalone person_removed entry still
-- make the event clear.
create or replace function public.log_relationship_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row relationships%rowtype;
  v_action text;
  v_a_name text;
  v_b_name text;
begin
  if tg_op = 'INSERT' then
    v_row := new;
    v_action := 'relationship_added';
  else
    v_row := old;
    v_action := 'relationship_removed';
  end if;

  select trim(first_name || ' ' || coalesce(last_name, '')) into v_a_name
  from family_members where id = v_row.person_a_id;
  select trim(first_name || ' ' || coalesce(last_name, '')) into v_b_name
  from family_members where id = v_row.person_b_id;

  insert into activity_log (tree_id, actor_id, action, person_name, details)
  values (
    v_row.tree_id,
    auth.uid(),
    v_action,
    coalesce(v_a_name, '?') || ' & ' || coalesce(v_b_name, '?'),
    jsonb_build_object('relationship_type', v_row.type, 'person_a_name', v_a_name, 'person_b_name', v_b_name)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger relationships_activity_log
  after insert or delete on relationships
  for each row execute function public.log_relationship_change();
