-- Round-result "Devam et" (continue) tracking: each player explicitly signals
-- readiness to move to the next round once results are shown; the game also
-- advances automatically after CONTINUE_WINDOW_S (lib/constants.ts) if nobody
-- acts, mirroring the pick/draft auto-advance philosophy used elsewhere.
alter table rounds add column continue_deadline_at timestamptz;
alter table rounds add column continue_ready_player_ids uuid[] not null default '{}';

-- CAS-guarded per-round opt-in, exactly like submit_draft_pick's style: only
-- appends if the round is actually resolved and this player hasn't already
-- marked ready.
create or replace function mark_continue_ready(p_round_id uuid, p_player_id uuid)
returns boolean
language plpgsql
as $$
declare v_updated int;
begin
  update rounds
  set continue_ready_player_ids = continue_ready_player_ids || p_player_id
  where id = p_round_id
    and status = 'resolved'
    and not (p_player_id = any(continue_ready_player_ids));
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;
