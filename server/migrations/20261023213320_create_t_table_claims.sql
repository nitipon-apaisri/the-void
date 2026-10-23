-- Who sits at which desk, per space. Table ids come from the map's "tables" layer, so they are
-- text rather than a foreign key. A released desk keeps its row (deleted_at), like other data.
create table if not exists t_table_claims (
  space_id uuid not null references t_spaces (id),
  table_id text not null,
  user_id uuid not null references t_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- One claim per desk and one desk per person: the database settles two people racing for a desk.
create unique index if not exists t_table_claims_table_key
  on t_table_claims (space_id, table_id) where deleted_at is null;
create unique index if not exists t_table_claims_user_key
  on t_table_claims (space_id, user_id) where deleted_at is null;
