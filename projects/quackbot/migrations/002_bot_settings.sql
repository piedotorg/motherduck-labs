-- Runtime bot settings (DATA0-60): key/value knobs edited from the admin
-- dash, layered over env vars (row present wins; absent row falls back to
-- env). Known keys: prompt_addendum, model, thinking_level, allowed_users.
create table if not exists bot_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);
