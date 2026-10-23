-- An invite link. Only a hash of the token is kept, so a database leak cannot be used to join.
create table if not exists t_space_invites (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references t_spaces (id),
  token_hash text not null,
  requires_approval boolean not null default false,
  expires_at timestamptz,
  created_by uuid not null references t_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists t_space_invites_token_key
  on t_space_invites (token_hash) where deleted_at is null;
create index if not exists t_space_invites_space_idx
  on t_space_invites (space_id) where deleted_at is null;

-- Someone who used an approval-only link and waits for an owner or admin to decide.
create table if not exists t_space_join_requests (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references t_spaces (id),
  user_id uuid not null references t_users (id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists t_space_join_requests_pending_key
  on t_space_join_requests (space_id, user_id) where status = 'pending' and deleted_at is null;
