-- A person an owner or admin has banned from a space: they cannot use a link or code to get back
-- in, and cannot ask to join, until someone lifts the ban (deleted_at).
create table if not exists t_space_bans (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references t_spaces (id),
  user_id uuid not null references t_users (id),
  banned_by uuid not null references t_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists t_space_bans_key
  on t_space_bans (space_id, user_id) where deleted_at is null;
