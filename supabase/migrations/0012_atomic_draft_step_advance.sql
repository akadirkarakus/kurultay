-- Fix: advanceDraftStep (lib/server/draft.ts) used to CAS-update
-- games.current_draft_step first, then write each player's new draft_offer
-- in a separate loop of statements afterward. Clients refetch /state on any
-- change to the games row, so a request landing in that window saw the new
-- step number paired with the *previous* category's draft_offer — showing
-- stale cards, then rejecting the pick with "not offered" once the real
-- offer caught up. Folding both the offer writes and the step bump into one
-- locked transaction (mirrors resolve_round's SELECT ... FOR UPDATE style)
-- makes them atomically visible together: readers see either the old step
-- with the old offers, or the new step with the new offers, never a mix.
create or replace function advance_draft_step(
  p_game_id uuid,
  p_expected_current_step int,
  p_next_step int,
  p_deadline timestamptz,
  p_offers jsonb
) returns boolean
language plpgsql
as $$
declare
  v_game games%rowtype;
  v_player_id text;
  v_offer jsonb;
begin
  select * into v_game from games where id = p_game_id for update;
  if not found or v_game.current_draft_step <> p_expected_current_step then
    return false;
  end if;

  for v_player_id, v_offer in select * from jsonb_each(p_offers)
  loop
    update game_players
    set draft_offer = array(select jsonb_array_elements_text(v_offer))
    where id = v_player_id::uuid and game_id = p_game_id;
  end loop;

  update games set current_draft_step = p_next_step, draft_deadline_at = p_deadline
  where id = p_game_id;

  return true;
end;
$$;
