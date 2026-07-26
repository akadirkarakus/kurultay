-- Admin panel: internal-tool auth (admin_users/admin_sessions) plus a
-- character soft-delete flag. This is a separate identity system from the
-- per-room player session cookie (lib/session.ts) — global, not per-game,
-- and never exposed to anon/authenticated clients (deny-all RLS below;
-- only supabaseAdmin()/createAdminClient() service-role code ever touches
-- these two tables, from lib/server/adminAuth.ts and app/api/admin/**).

create table admin_users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,        -- "<salt_hex>:<derived_hex>" (scrypt, see lib/server/adminAuth.ts)
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table admin_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references admin_users(id) on delete cascade,
  token text unique not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table admin_users enable row level security;
alter table admin_sessions enable row level security;
-- No select/insert/update/delete policy for anon/authenticated on either
-- table (default deny), matching game_players/round_picks.

-- Characters must never be hard-deleted: round_picks.character_id has no
-- ON DELETE clause, so removing a character used in a past game would throw
-- a FK violation. Archiving instead keeps history intact and only affects
-- future draft pools (lib/server/draft.ts's dealCategoryOffers).
alter table characters add column is_active boolean not null default true;
alter table characters add column archived_at timestamptz;

create index characters_category_active_idx on characters (category, is_active);
