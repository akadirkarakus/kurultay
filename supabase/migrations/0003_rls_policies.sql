-- RLS design (see Kurultay-steps.md plan §3.5 and §4).
-- All mutations go through API routes using the service-role client, which
-- bypasses RLS entirely — no anon/authenticated insert/update/delete policy
-- exists on any table, anywhere, by design.

alter table characters enable row level security;
alter table scenarios enable row level security;
alter table games enable row level security;
alter table game_players enable row level security;
alter table rounds enable row level security;
alter table round_picks enable row level security;

-- No secrets: globally readable. Per-player pool restriction (§3.7) is
-- enforced by the API via game_players.available_pool, not by hiding rows.
create policy characters_select_all on characters for select using (true);
create policy scenarios_select_all on scenarios for select using (true);

-- No secret columns: status/room_code/current_round are meant to be visible,
-- and scenario_text/key_attributes are meant to be simultaneously public.
create policy games_select_all on games for select using (true);
create policy rounds_select_all on rounds for select using (true);

-- game_players holds session_token: deny-all on the base table. Clients only
-- ever read game_players_public (defined below).
-- (No select policy is created here — default is deny.)

-- round_picks is never exposed to clients directly, at any phase. The
-- "picked ✓" indicator and the post-resolve reveal both travel through
-- server-emitted Realtime Broadcast events, not a table subscription.
-- (No select policy is created here — default is deny.)

create view game_players_public as
  select id, game_id, nickname, score, is_ready, joined_at
  from game_players;

grant select on game_players_public to anon, authenticated;
