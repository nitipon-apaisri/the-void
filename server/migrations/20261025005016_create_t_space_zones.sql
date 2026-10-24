-- Private rooms drawn by owners and admins, in tiles. The template's own meeting rooms live in the
-- map file, not here. A removed room keeps its row (deleted_at).
create table if not exists t_space_zones (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references t_spaces (id),
  name text not null,
  col integer not null,
  row integer not null,
  cols integer not null,
  rows integer not null,
  created_by uuid references t_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists t_space_zones_space_idx on t_space_zones (space_id) where deleted_at is null;
