-- Bumped to sign an account out everywhere: tokens carry the version they were issued at.
alter table t_users add column if not exists token_version integer not null default 0;
