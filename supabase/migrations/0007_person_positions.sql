-- Optional manual override for a person's position on the tree canvas. When
-- both are null (the default), the person renders at the position the
-- automatic layout algorithm computes; once someone drags a card in "arrange"
-- mode, these are set and take precedence over the computed position from
-- then on. Column-only change -- no new RLS policy needed, since the
-- existing family_members update policy (editors+) already covers every
-- column on the row.
alter table family_members add column if not exists position_x double precision;
alter table family_members add column if not exists position_y double precision;
