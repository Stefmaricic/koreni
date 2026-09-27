-- Tree invites: the owner generates a single-use link (a random token) that
-- grants a chosen role (editor/viewer) to whoever redeems it. No need to
-- know the invitee's account or email ahead of time.

create table tree_invites (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references family_trees (id) on delete cascade,
  role membership_role not null check (role in ('editor', 'viewer')),
  token text not null unique,
  created_by uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_by uuid references profiles (id) on delete set null,
  used_at timestamptz,
  revoked boolean not null default false
);

create index tree_invites_tree_id_idx on tree_invites (tree_id);

alter table tree_invites enable row level security;

-- Only the tree owner creates/manages invites (kept stricter than general
-- editing rights, so an editor can't hand out access without the owner's say).
create policy "tree_invites_insert_owner" on tree_invites
  for insert with check (is_tree_member(tree_id, 'owner') and created_by = auth.uid());

create policy "tree_invites_select_owner" on tree_invites
  for select using (is_tree_member(tree_id, 'owner'));

create policy "tree_invites_update_owner" on tree_invites
  for update using (is_tree_member(tree_id, 'owner'));

-- The invitee isn't a tree member yet, so they can't read tree_invites
-- directly under the policies above. These two functions are the only way
-- in: one lets anyone with the token preview what they're accepting, the
-- other actually redeems it, and both run with elevated rights scoped
-- tightly to just that job.

create or replace function public.get_invite_info(p_token text)
returns table(tree_name text, role membership_role, is_valid boolean)
language sql
security definer
set search_path = public
stable
as $$
  select
    ft.name,
    ti.role,
    (not ti.revoked and ti.used_by is null and ti.expires_at > now())
  from tree_invites ti
  join family_trees ft on ft.id = ti.tree_id
  where ti.token = p_token;
$$;

create or replace function public.redeem_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite tree_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to accept an invite';
  end if;

  select * into v_invite from tree_invites where token = p_token for update;

  if not found then
    raise exception 'This invite link is not valid';
  end if;
  if v_invite.revoked then
    raise exception 'This invite has been cancelled';
  end if;
  if v_invite.used_by is not null then
    raise exception 'This invite has already been used';
  end if;
  if v_invite.expires_at <= now() then
    raise exception 'This invite has expired';
  end if;

  -- do nothing on conflict rather than upgrading/downgrading: someone who
  -- already has access (e.g. the owner opening their own link by mistake)
  -- keeps whatever role they already had.
  insert into tree_memberships (tree_id, user_id, role)
  values (v_invite.tree_id, auth.uid(), v_invite.role)
  on conflict (tree_id, user_id) do nothing;

  update tree_invites
    set used_by = auth.uid(), used_at = now()
    where id = v_invite.id;

  return v_invite.tree_id;
end;
$$;
