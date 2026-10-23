-- A character is five layered parts, stored as "body.eyes.outfit.hair.accessory" (see encodeLook
-- in @void/shared). The old premade `avatar` column stays, unused, so no data is dropped.
alter table t_users add column if not exists look text;

-- Give each existing account a distinct look derived from its premade avatar.
update t_users
set look = (avatar % 9) || '.' || (avatar % 7) || '.' || ((avatar * 13) % 132) || '.' || ((avatar * 17) % 200) || '.-1'
where look is null;

alter table t_users alter column look set default '0.0.0.0.-1';
alter table t_users alter column look set not null;
