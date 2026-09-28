-- Any tree member (not just the owner) can see who else is on the tree and
-- what role they have -- previously only the owner (or your own row) could
-- read tree_memberships at all, which hid the member list from editors and
-- observers even though "who's here and what can they do" isn't sensitive
-- in a shared family tree. Changing a role, inviting, or removing a member
-- is still owner-only -- that's enforced by tree_memberships_update_owner /
-- _insert_owner / _delete_owner (untouched here) and the tree_invites
-- policies (also untouched) -- this migration only widens who can *read*
-- the list.
drop policy "tree_memberships_select_own_or_owner" on tree_memberships;
create policy "tree_memberships_select_member" on tree_memberships
  for select using (public.is_tree_member(tree_id, 'viewer'));
