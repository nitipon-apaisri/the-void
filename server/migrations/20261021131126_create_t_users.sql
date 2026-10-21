create table if not exists t_users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  display_name text not null,
  avatar smallint not null default 0,
  last_x real,
  last_y real,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Emails are stored lowercased; a deleted account frees its address.
create unique index if not exists t_users_email_key on t_users (email) where deleted_at is null;
