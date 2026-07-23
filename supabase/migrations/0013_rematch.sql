-- Rematch: once every current player clicks "Yeniden Oyna" on the finished
-- game screen, the SAME room resets in place (same room code, same
-- game_players rows/session cookies — no new game or room is created) and
-- drafts a fresh deck straight into deck_selection.

alter table games add column rematch_ready_player_ids uuid[] not null default '{}';

-- Guards lib/server/rematch.ts's startRematch against running twice
-- concurrently (e.g. the last two "ready" clicks landing back-to-back):
-- only the caller whose UPDATE actually flips this from null wins the right
-- to run the reset. Cleared back to null at the end of startRematch so the
-- same room can rematch again after a future game.
alter table games add column rematch_started_at timestamptz;

-- CAS-guarded per-game opt-in, exactly like mark_continue_ready's style.
create or replace function mark_rematch_ready(p_game_id uuid, p_player_id uuid)
returns boolean
language plpgsql
as $$
declare v_updated int;
begin
  update games
  set rematch_ready_player_ids = rematch_ready_player_ids || p_player_id
  where id = p_game_id
    and status = 'finished'
    and not (p_player_id = any(rematch_ready_player_ids));
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;
