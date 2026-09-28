-- Scoped editor roles: an 'editor' member can "claim" which family_members
-- row they are, and their write access to family_members/relationships
-- narrows from "the whole tree" to a bounded region around that person:
-- themself + partner, their direct ancestor line up to 4 generations up
-- (each ancestor's partner included), and their direct descendant line up
-- to 2 generations down (each descendant's partner included). This is a
-- direction-locked walk, not a generation band -- siblings/aunts/uncles/
-- cousins are structurally excluded since the walk never reverses direction.
-- 'owner' is never scoped by any of this (always full tree access). 'viewer'
-- still never writes at all. Reading (select) is unchanged everywhere --
-- still tree-wide for every role.

-- ---------------------------------------------------------------------------
-- tree_memberships.claimed_person_id
-- ---------------------------------------------------------------------------

alter table tree_memberships
  add column claimed_person_id uuid references family_members (id) on delete set null;

-- a person can be claimed by at most one member of the tree
create unique index tree_memberships_claimed_person_unique
  on tree_memberships (tree_id, claimed_person_id)
  where claimed_person_id is not null;

-- ---------------------------------------------------------------------------
-- get_edit_scope: the set of family_members.id the caller may mutate
-- ---------------------------------------------------------------------------

-- Deliberately does NOT special-case 'owner' -- every call site below ORs
-- this with is_tree_member(tree_id, 'owner') so an owner's check never even
-- runs this function. Returns empty for viewers, for editors with no claim
-- yet, and for non-members.
--
-- Depth-capped recursion (4 up / 2 down) is what makes this cycle-safe --
-- a re-convergent lineage (e.g. a cousin marriage) just produces a
-- duplicate row that `union` (not `union all`) dedups; termination is
-- guaranteed by the depth bound alone, no visited-set needed. Postgres only
-- allows one self-reference per recursive CTE, so "up" and "down" have to be
-- two separate WITH RECURSIVE terms unioned afterward -- which also maps
-- naturally onto "these are two direction-locked walks, never one that
-- reverses direction."
create or replace function public.get_edit_scope(p_tree_id uuid)
returns table (person_id uuid)
language sql
security definer
set search_path = public
stable
as $$
  with recursive membership as (
    select tm.role, tm.claimed_person_id
    from tree_memberships tm
    where tm.tree_id = p_tree_id
      and tm.user_id = auth.uid()
  ),
  root as (
    select claimed_person_id as id
    from membership
    where role = 'editor' and claimed_person_id is not null
  ),
  -- direct ancestor chain: root, root's parents, ... up to 4 generations up.
  -- 'parent' rows: person_a_id is the parent, person_b_id is the child.
  ancestors as (
    select id as person_id, 0 as depth from root
    union all
    select r.person_a_id, a.depth + 1
    from ancestors a
    join relationships r
      on r.tree_id = p_tree_id
     and r.type = 'parent'
     and r.person_b_id = a.person_id
    where a.depth < 4
  ),
  -- direct descendant chain: root, root's children, root's grandchildren --
  -- max 2 generations down.
  descendants as (
    select id as person_id, 0 as depth from root
    union all
    select r.person_b_id, d.depth + 1
    from descendants d
    join relationships r
      on r.tree_id = p_tree_id
     and r.type = 'parent'
     and r.person_a_id = d.person_id
    where d.depth < 2
  ),
  line as (
    select person_id from ancestors
    union
    select person_id from descendants
  ),
  -- partner attachment at every node on the line (root + each ancestor +
  -- each descendant). A plain join over `line`, not a recursive term, so a
  -- spouse's own ancestry/descendants never enter the scope -- terminal by
  -- construction. 'partner' rows are undirected (one row per unordered
  -- pair, see relationships_partner_unique in 0001), so both sides are
  -- checked, matching the convention already used client-side in
  -- src/utils/familyGraph.ts.
  partners as (
    select distinct
      case when r.person_a_id = l.person_id then r.person_b_id else r.person_a_id end as person_id
    from line l
    join relationships r
      on r.tree_id = p_tree_id
     and r.type = 'partner'
     and (r.person_a_id = l.person_id or r.person_b_id = l.person_id)
  )
  select person_id from line
  union
  select person_id from partners
$$;

-- Thin single-row wrapper around get_edit_scope, for app-level/one-off
-- checks. Owner short-circuits to true here (unlike get_edit_scope itself).
create or replace function public.can_edit_person(p_person_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from family_members fm
    where fm.id = p_person_id
      and (
        public.is_tree_member(fm.tree_id, 'owner')
        or fm.id in (select person_id from public.get_edit_scope(fm.tree_id))
      )
  );
$$;

-- Lets any tree member (viewer+) see *which* people are already claimed, so
-- the claim-yourself picker can exclude them -- without exposing *who*
-- claimed them (tree_memberships itself stays own-row-or-owner only, see
-- 0001's tree_memberships_select_own_or_owner).
create or replace function public.list_claimed_person_ids(p_tree_id uuid)
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select claimed_person_id
  from tree_memberships
  where tree_id = p_tree_id
    and claimed_person_id is not null
    and public.is_tree_member(p_tree_id, 'viewer');
$$;

-- ---------------------------------------------------------------------------
-- claim_person / decline_identity_claim: self-service, own row only
-- ---------------------------------------------------------------------------

-- Caller must already be an 'editor' member of the tree; the person must
-- belong to that tree. The unique index guards a race claiming the same
-- person twice. Only ever touches the caller's own tree_memberships row, so
-- no new RLS UPDATE policy on tree_memberships is needed for this at all --
-- same shape as redeem_invite in 0005.
create or replace function public.claim_person(p_tree_id uuid, p_person_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to do this';
  end if;

  if not exists (
    select 1 from tree_memberships
    where tree_id = p_tree_id and user_id = auth.uid() and role = 'editor'
  ) then
    raise exception 'Only an editor can claim a person';
  end if;

  if not exists (select 1 from family_members where id = p_person_id and tree_id = p_tree_id) then
    raise exception 'That person is not in this tree';
  end if;

  if exists (
    select 1 from tree_memberships
    where tree_id = p_tree_id and claimed_person_id = p_person_id and user_id <> auth.uid()
  ) then
    raise exception 'That person has already been claimed by someone else';
  end if;

  update tree_memberships
  set claimed_person_id = p_person_id
  where tree_id = p_tree_id and user_id = auth.uid();
end;
$$;

-- Self-downgrade only ('editor' -> 'viewer', never the other direction) --
-- no privilege-escalation surface, since a caller can only ever lower their
-- own role.
create or replace function public.decline_identity_claim(p_tree_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to do this';
  end if;

  update tree_memberships
  set role = 'viewer'
  where tree_id = p_tree_id and user_id = auth.uid() and role = 'editor';
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: family_members / relationships mutation policies become scope-aware
-- ---------------------------------------------------------------------------

drop policy "family_members_update_editor" on family_members;
create policy "family_members_update_scoped" on family_members
  for update
  using (
    public.is_tree_member(tree_id, 'owner')
    or exists (select 1 from public.get_edit_scope(tree_id) s where s.person_id = id)
  )
  with check (
    public.is_tree_member(tree_id, 'owner')
    or exists (select 1 from public.get_edit_scope(tree_id) s where s.person_id = id)
  );

drop policy "family_members_delete_editor" on family_members;
create policy "family_members_delete_scoped" on family_members
  for delete using (
    public.is_tree_member(tree_id, 'owner')
    or exists (select 1 from public.get_edit_scope(tree_id) s where s.person_id = id)
  );

-- family_members_insert_editor is unchanged (still is_tree_member(tree_id,
-- 'editor')) -- a bare unconnected person can't violate anyone's scope by
-- itself, and the relationship that would connect them can't exist yet at
-- insert time (FK order). The real gate is the relationships insert policy
-- below.

drop policy "relationships_insert_editor" on relationships;
create policy "relationships_insert_scoped" on relationships
  for insert
  with check (
    public.is_tree_member(tree_id, 'owner')
    or exists (
      select 1 from public.get_edit_scope(tree_id) s
      where s.person_id in (person_a_id, person_b_id)
    )
  );

drop policy "relationships_update_editor" on relationships;
create policy "relationships_update_scoped" on relationships
  for update
  using (
    public.is_tree_member(tree_id, 'owner')
    or exists (select 1 from public.get_edit_scope(tree_id) s where s.person_id in (person_a_id, person_b_id))
  )
  with check (
    public.is_tree_member(tree_id, 'owner')
    or exists (select 1 from public.get_edit_scope(tree_id) s where s.person_id in (person_a_id, person_b_id))
  );

drop policy "relationships_delete_editor" on relationships;
create policy "relationships_delete_scoped" on relationships
  for delete using (
    public.is_tree_member(tree_id, 'owner')
    or exists (select 1 from public.get_edit_scope(tree_id) s where s.person_id in (person_a_id, person_b_id))
  );

-- child_link_curves (0008_line_curves.sql) is a separate table from
-- relationships (a branch line doesn't map 1:1 to one relationship row), so
-- its own editor-tier policies need the same scoping treatment, keyed on
-- child_id -- otherwise a scoped editor could still bend branch lines
-- anywhere in the tree.
drop policy "child_link_curves_insert_editor" on child_link_curves;
create policy "child_link_curves_insert_scoped" on child_link_curves
  for insert
  with check (
    public.is_tree_member(tree_id, 'owner')
    or exists (select 1 from public.get_edit_scope(tree_id) s where s.person_id = child_id)
  );

drop policy "child_link_curves_update_editor" on child_link_curves;
create policy "child_link_curves_update_scoped" on child_link_curves
  for update
  using (
    public.is_tree_member(tree_id, 'owner')
    or exists (select 1 from public.get_edit_scope(tree_id) s where s.person_id = child_id)
  )
  with check (
    public.is_tree_member(tree_id, 'owner')
    or exists (select 1 from public.get_edit_scope(tree_id) s where s.person_id = child_id)
  );

drop policy "child_link_curves_delete_editor" on child_link_curves;
create policy "child_link_curves_delete_scoped" on child_link_curves
  for delete using (
    public.is_tree_member(tree_id, 'owner')
    or exists (select 1 from public.get_edit_scope(tree_id) s where s.person_id = child_id)
  );

-- person-photos storage (0002_storage.sql) is keyed by
-- {tree_id}/{person_id}/{filename} in the object path, so it has the same
-- flat-editor gap: a scoped editor could otherwise replace/delete any
-- person's photo in the whole tree, not just their own scope.
drop policy "person_photos_insert_editor" on storage.objects;
create policy "person_photos_insert_scoped" on storage.objects
  for insert
  with check (
    bucket_id = 'person-photos'
    and (
      public.is_tree_member(((storage.foldername(name))[1])::uuid, 'owner')
      or exists (
        select 1 from public.get_edit_scope(((storage.foldername(name))[1])::uuid) s
        where s.person_id = ((storage.foldername(name))[2])::uuid
      )
    )
  );

drop policy "person_photos_update_editor" on storage.objects;
create policy "person_photos_update_scoped" on storage.objects
  for update using (
    bucket_id = 'person-photos'
    and (
      public.is_tree_member(((storage.foldername(name))[1])::uuid, 'owner')
      or exists (
        select 1 from public.get_edit_scope(((storage.foldername(name))[1])::uuid) s
        where s.person_id = ((storage.foldername(name))[2])::uuid
      )
    )
  );

drop policy "person_photos_delete_editor" on storage.objects;
create policy "person_photos_delete_scoped" on storage.objects
  for delete using (
    bucket_id = 'person-photos'
    and (
      public.is_tree_member(((storage.foldername(name))[1])::uuid, 'owner')
      or exists (
        select 1 from public.get_edit_scope(((storage.foldername(name))[1])::uuid) s
        where s.person_id = ((storage.foldername(name))[2])::uuid
      )
    )
  );
