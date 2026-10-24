-- A short code that works like the link: an HMAC of it is kept (never the code), because a code
-- has far fewer bits than a link token.
alter table t_space_invites add column if not exists code_hash text;

create unique index if not exists t_space_invites_code_key
  on t_space_invites (code_hash) where deleted_at is null and code_hash is not null;
