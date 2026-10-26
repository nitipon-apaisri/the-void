-- A closed portal stays on the map but nobody can cross through it.
alter table t_space_portals add column if not exists closed boolean not null default false;
