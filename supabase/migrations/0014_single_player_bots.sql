-- Single-player mode: a human plays against 2 AI-controlled bot players
-- seated in the same room. Bots are ordinary game_players rows (is_bot =
-- true) with no real session cookie ever presented for them — all their
-- decisions are written server-side by lib/server/bots.ts, invoked from
-- inside the human's own requests (see lib/server/draft.ts, rounds.ts,
-- jokers.ts). games.is_single_player blocks other humans from joining.

alter table game_players add column is_bot boolean not null default false;
alter table games add column is_single_player boolean not null default false;

drop view if exists game_players_public;
create view game_players_public as
  select id, game_id, nickname, score, is_ready, joined_at,
    joker_used, used_joker_key, joker_target_player_id, is_bot
  from game_players;
grant select on game_players_public to anon, authenticated;
