create table if not exists t_spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Which map a space starts from. Only "office" exists so far.
  template text not null default 'office',
  owner_id uuid not null references t_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists t_spaces_owner_idx on t_spaces (owner_id) where deleted_at is null;

-- Who belongs to a space, and what they may do there. The last position is per space.
create table if not exists t_space_members (
  space_id uuid not null references t_spaces (id),
  user_id uuid not null references t_users (id),
  role text not null check (role in ('owner', 'admin', 'member')),
  last_x real,
  last_y real,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists t_space_members_key
  on t_space_members (space_id, user_id) where deleted_at is null;
create index if not exists t_space_members_user_idx
  on t_space_members (user_id) where deleted_at is null;

-- Accounts made before spaces existed all meet in one space, owned by the oldest account.
-- Runs only while no space exists, so applying the migration again changes nothing.
do $$
declare
  first_user uuid;
  first_space uuid;
begin
  if exists (select 1 from t_spaces) then
    return;
  end if;
  select id into first_user from t_users where deleted_at is null order by created_at limit 1;
  if first_user is null then
    return;
  end if;
  insert into t_spaces (name, owner_id) values ('The Void', first_user) returning id into first_space;
  insert into t_space_members (space_id, user_id, role, last_x, last_y)
    select first_space, id, case when id = first_user then 'owner' else 'member' end, last_x, last_y
    from t_users where deleted_at is null;
end $$;
