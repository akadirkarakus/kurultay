-- Core schema for Kurultay (see Kurultay-steps.md for the original spec).
-- Category values are derived from the sheet names in data/characters.xlsx
-- (see scripts/import-characters.ts): politician, historical, actor,
-- movie_character, tv_character, internet_celebrity, athlete, artist, celebrity.

create extension if not exists pgcrypto;

create table characters (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,        -- stable id derived from category+name, used for idempotent re-import
  name text not null,
  category text not null,
  image_url text,                   -- Supabase Storage public URL; nullable until images are supplied
  attributes jsonb not null,        -- { [BattleAttributeKey]: 0-100, height_cm?: number, age?: number }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table games (
  id uuid primary key default gen_random_uuid(),
  room_code text unique not null,
  status text not null default 'lobby'
    check (status in ('lobby', 'deck_selection', 'in_round', 'round_result', 'finished')),
  current_round int not null default 0,
  max_rounds int not null default 4,
  host_player_id uuid,
  created_at timestamptz not null default now()
);

create table game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  nickname text not null,
  session_token text not null,
  available_pool uuid[] not null default '{}',  -- this player's disjoint character pool for the current game (§3.7)
  deck uuid[] not null default '{}',             -- 5 selected character ids, subset of available_pool
  used_characters uuid[] not null default '{}',
  score int not null default 0,
  is_ready boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (game_id, nickname)
);

alter table games
  add constraint games_host_player_fk
  foreign key (host_player_id) references game_players(id) on delete set null;

create table rounds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  round_number int not null,
  scenario_text text not null,
  key_attributes text[] not null,
  deadline_at timestamptz,
  status text not null default 'picking' check (status in ('picking', 'resolving', 'resolved')),
  unique (game_id, round_number)
);

create table round_picks (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  player_id uuid not null references game_players(id) on delete cascade,
  character_id uuid not null references characters(id),
  average numeric,
  is_auto_pick boolean not null default false,
  unique (round_id, player_id)
);

create table scenarios (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  suggested_attributes text[] not null
);
