-- Furniture placed in a space. item_id names a piece of the catalogue in @void/shared, so it is
-- text rather than a foreign key. A removed piece keeps its row (deleted_at).
create table if not exists t_furniture (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references t_spaces (id),
  item_id text not null,
  col integer not null,
  row integer not null,
  placed_by uuid references t_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists t_furniture_space_idx on t_furniture (space_id) where deleted_at is null;
