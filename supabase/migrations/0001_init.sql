-- Koreni initial schema
-- Tables: profiles, family_trees, tree_memberships, family_members, relationships
-- Design notes:
--   * tree_memberships exists from day one (even though only single-owner trees are
--     supported in the UI right now) so collaborative trees can be added later without
--     a schema migration: just start inserting more rows with role 'editor'/'viewer'.
--   * siblings are NOT stored — they are derived in the app from shared 'parent' rows.
--   * RLS uses a security-definer helper (is_tree_member) to avoid recursive-policy
--     issues when tree_memberships' own policies need to query tree_memberships.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type membership_role as enum ('owner', 'editor', 'viewer');
create type member_gender as enum ('female', 'male', 'other', 'unknown');
create type relationship_type as enum ('parent', 'partner');

-- ---------------------------------------------------------------------------
-- profiles: one row per auth.users row
-- ---------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  preferred_language text not null default 'sr-Cyrl',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table profiles is 'Public profile data for an authenticated user, keyed by auth.users.id.';

-- ---------------------------------------------------------------------------
-- family_trees
-- ---------------------------------------------------------------------------

create table family_trees (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  description text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index family_trees_owner_id_idx on family_trees (owner_id);

-- ---------------------------------------------------------------------------
-- tree_memberships: who can access a tree, and at what role
-- ---------------------------------------------------------------------------

create table tree_memberships (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references family_trees (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role membership_role not null default 'viewer',
  created_at timestamptz not null default now(),
  unique (tree_id, user_id)
);

create index tree_memberships_user_id_idx on tree_memberships (user_id);
create index tree_memberships_tree_id_idx on tree_memberships (tree_id);

-- ---------------------------------------------------------------------------
-- family_members: a person inside a tree
-- ---------------------------------------------------------------------------

create table family_members (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references family_trees (id) on delete cascade,
  first_name text not null check (char_length(btrim(first_name)) > 0),
  last_name text,
  maiden_name text,
  gender member_gender not null default 'unknown',
  birth_date date,
  birth_place text,
  death_date date,
  death_place text,
  bio text,
  photo_url text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint death_after_birth check (death_date is null or birth_date is null or death_date >= birth_date)
);

create index family_members_tree_id_idx on family_members (tree_id);

-- ---------------------------------------------------------------------------
-- relationships: directed 'parent' edges + undirected 'partner' edges
-- ---------------------------------------------------------------------------

create table relationships (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references family_trees (id) on delete cascade,
  type relationship_type not null,
  -- for 'parent': person_a is the parent, person_b is the child
  -- for 'partner': unordered pair
  person_a_id uuid not null references family_members (id) on delete cascade,
  person_b_id uuid not null references family_members (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint no_self_relationship check (person_a_id <> person_b_id)
);

create index relationships_tree_id_idx on relationships (tree_id);
create index relationships_person_a_idx on relationships (person_a_id);
create index relationships_person_b_idx on relationships (person_b_id);

-- one parent->child edge per pair
create unique index relationships_parent_unique
  on relationships (tree_id, person_a_id, person_b_id)
  where type = 'parent';

-- one partner edge per unordered pair
create unique index relationships_partner_unique
  on relationships (tree_id, least(person_a_id, person_b_id), greatest(person_a_id, person_b_id))
  where type = 'partner';

-- ensure both people referenced by a relationship belong to the same tree
create or replace function public.check_relationship_same_tree()
returns trigger
language plpgsql
as $$
declare
  tree_a uuid;
  tree_b uuid;
begin
  select tree_id into tree_a from family_members where id = new.person_a_id;
  select tree_id into tree_b from family_members where id = new.person_b_id;

  if tree_a is null or tree_b is null then
    raise exception 'Both people in a relationship must exist';
  end if;

  if tree_a <> new.tree_id or tree_b <> new.tree_id then
    raise exception 'Both people in a relationship must belong to the relationship''s tree';
  end if;

  return new;
end;
$$;

create trigger relationships_same_tree
  before insert or update on relationships
  for each row execute function public.check_relationship_same_tree();

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function public.set_updated_at();

create trigger family_trees_set_updated_at
  before update on family_trees
  for each row execute function public.set_updated_at();

create trigger family_members_set_updated_at
  before update on family_members
  for each row execute function public.set_updated_at();

-- keep family_trees.updated_at fresh when people/relationships inside it change,
-- so "last updated" on the dashboard reflects real editing activity.
create or replace function public.touch_tree_updated_at()
returns trigger
language plpgsql
as $$
begin
  update family_trees
  set updated_at = now()
  where id = coalesce(new.tree_id, old.tree_id);
  return coalesce(new, old);
end;
$$;

create trigger family_members_touch_tree
  after insert or update or delete on family_members
  for each row execute function public.touch_tree_updated_at();

create trigger relationships_touch_tree
  after insert or update or delete on relationships
  for each row execute function public.touch_tree_updated_at();

-- ---------------------------------------------------------------------------
-- new-user bootstrap: create a profile row + auth trigger
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, preferred_language)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'preferred_language', 'sr-Cyrl')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- automatically add the creator of a tree as its 'owner' member
create or replace function public.handle_new_tree()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tree_memberships (tree_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger on_family_tree_created
  after insert on family_trees
  for each row execute function public.handle_new_tree();

-- ---------------------------------------------------------------------------
-- RLS helper: security-definer function to avoid recursive policies
-- ---------------------------------------------------------------------------

create or replace function public.is_tree_member(p_tree_id uuid, p_min_role membership_role default 'viewer')
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from tree_memberships tm
    where tm.tree_id = p_tree_id
      and tm.user_id = auth.uid()
      and (
        p_min_role = 'viewer'
        or (p_min_role = 'editor' and tm.role in ('editor', 'owner'))
        or (p_min_role = 'owner' and tm.role = 'owner')
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;
alter table family_trees enable row level security;
alter table tree_memberships enable row level security;
alter table family_members enable row level security;
alter table relationships enable row level security;

-- profiles: a user manages their own row. Members of a shared tree may read
-- each other's basic profile (needed once collaboration ships).
create policy "profiles_select_own_or_shared_tree" on profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1 from tree_memberships mine
      join tree_memberships theirs on theirs.tree_id = mine.tree_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );

create policy "profiles_update_own" on profiles
  for update using (id = auth.uid());

-- profiles insert happens via the handle_new_user trigger (security definer),
-- so no insert policy is needed for regular clients.

-- family_trees
-- NOTE: owner_id = auth.uid() is checked directly (not just is_tree_member)
-- because Postgres evaluates this SELECT policy against the RETURNING output
-- of the same INSERT statement whose AFTER-trigger creates the matching
-- tree_memberships row. That row isn't reliably visible to the RETURNING
-- check at that exact point, so an insert+representation call (as used by
-- `.insert().select()`) would otherwise intermittently fail RLS. Checking
-- owner_id directly sidesteps the dependency on that just-created row.
create policy "family_trees_select_member" on family_trees
  for select using (owner_id = auth.uid() or public.is_tree_member(id, 'viewer'));

create policy "family_trees_insert_owner" on family_trees
  for insert with check (owner_id = auth.uid());

create policy "family_trees_update_editor" on family_trees
  for update using (public.is_tree_member(id, 'editor'));

create policy "family_trees_delete_owner" on family_trees
  for delete using (public.is_tree_member(id, 'owner'));

-- tree_memberships
create policy "tree_memberships_select_own_or_owner" on tree_memberships
  for select using (
    user_id = auth.uid() or public.is_tree_member(tree_id, 'owner')
  );

create policy "tree_memberships_insert_owner" on tree_memberships
  for insert with check (public.is_tree_member(tree_id, 'owner'));

create policy "tree_memberships_update_owner" on tree_memberships
  for update using (public.is_tree_member(tree_id, 'owner'));

create policy "tree_memberships_delete_owner" on tree_memberships
  for delete using (public.is_tree_member(tree_id, 'owner'));

-- family_members
create policy "family_members_select_member" on family_members
  for select using (public.is_tree_member(tree_id, 'viewer'));

create policy "family_members_insert_editor" on family_members
  for insert with check (public.is_tree_member(tree_id, 'editor'));

create policy "family_members_update_editor" on family_members
  for update using (public.is_tree_member(tree_id, 'editor'));

create policy "family_members_delete_editor" on family_members
  for delete using (public.is_tree_member(tree_id, 'editor'));

-- relationships
create policy "relationships_select_member" on relationships
  for select using (public.is_tree_member(tree_id, 'viewer'));

create policy "relationships_insert_editor" on relationships
  for insert with check (public.is_tree_member(tree_id, 'editor'));

create policy "relationships_update_editor" on relationships
  for update using (public.is_tree_member(tree_id, 'editor'));

create policy "relationships_delete_editor" on relationships
  for delete using (public.is_tree_member(tree_id, 'editor'));
