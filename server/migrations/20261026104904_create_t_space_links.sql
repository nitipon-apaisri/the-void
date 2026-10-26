-- Cross space. A connect code lets another owner find a space to ask for a link; only an
-- HMAC of it is kept (like join codes), and making a new one replaces the old.
alter table t_spaces add column if not exists connect_code_hash text;
create unique index if not exists t_spaces_connect_code_key
  on t_spaces (connect_code_hash) where connect_code_hash is not null;

-- A link between two spaces. requester_id asked, target_id's owner decides; once approved it
-- works both ways. One live link per pair, whichever side asked first. An ended link keeps its
-- row (deleted_at).
create table if not exists t_space_links (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references t_spaces (id),
  target_id uuid not null references t_spaces (id),
  status text not null default 'pending' check (status in ('pending', 'approved')),
  requested_by uuid not null references t_users (id),
  approved_by uuid references t_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (requester_id <> target_id)
);

create unique index if not exists t_space_links_pair_key
  on t_space_links (least(requester_id, target_id), greatest(requester_id, target_id))
  where deleted_at is null;
create index if not exists t_space_links_requester_idx
  on t_space_links (requester_id) where deleted_at is null;
create index if not exists t_space_links_target_idx
  on t_space_links (target_id) where deleted_at is null;

-- Doors on a space's map that lead to a linked space, in tiles.
create table if not exists t_space_portals (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references t_spaces (id),
  target_id uuid not null references t_spaces (id),
  col integer not null,
  row integer not null,
  placed_by uuid references t_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists t_space_portals_space_idx
  on t_space_portals (space_id) where deleted_at is null;
