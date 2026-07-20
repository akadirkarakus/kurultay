-- Fix: use_joker's card_swap and value_debuff branches picked the target's
-- random card from their full deck, including characters already played
-- (v_target.used_characters). A used card can never be played again, so a
-- joker landing on one was a wasted/broken use. Mirrors the candidate
-- filtering resolve_round already does correctly.
create or replace function use_joker(
  p_round_id uuid,
  p_player_id uuid,
  p_joker_key text,
  p_own_character_id uuid,
  p_target_player_id uuid
) returns jsonb
language plpgsql
as $$
declare
  v_round rounds%rowtype;
  v_actor game_players%rowtype;
  v_target game_players%rowtype;
  v_candidates uuid[];
  v_target_character uuid;
  v_result jsonb;
begin
  select * into v_round from rounds where id = p_round_id for update;
  if not found or v_round.status <> 'joker_window' then
    return null;
  end if;

  select * into v_actor from game_players where id = p_player_id for update;
  if not found or v_actor.joker_used then
    return null;
  end if;

  if p_joker_key = 'card_swap' then
    if p_own_character_id is null or p_target_player_id is null
       or not (p_own_character_id = any(v_actor.deck)) then
      return null;
    end if;
    select * into v_target from game_players
      where id = p_target_player_id and game_id = v_actor.game_id for update;
    if not found then
      return null;
    end if;

    select array(
      select c from unnest(v_target.deck) as c
      where c <> all (v_target.used_characters)
    ) into v_candidates;
    if array_length(v_candidates, 1) is null then
      return null;
    end if;
    v_target_character := v_candidates[1 + floor(random() * array_length(v_candidates, 1))::int];

    update game_players set deck = array_replace(deck, p_own_character_id, v_target_character)
      where id = v_actor.id;
    update game_players set deck = array_replace(deck, v_target_character, p_own_character_id)
      where id = v_target.id;

    v_result := jsonb_build_object('jokerKey', p_joker_key, 'ownCharacterId', p_own_character_id,
      'targetPlayerId', p_target_player_id, 'targetCharacterId', v_target_character);

  elsif p_joker_key = 'value_boost' then
    if p_own_character_id is null or not (p_own_character_id = any(v_actor.deck)) then
      return null;
    end if;
    v_result := jsonb_build_object('jokerKey', p_joker_key, 'ownCharacterId', p_own_character_id);

  elsif p_joker_key = 'value_debuff' then
    if p_target_player_id is null then
      return null;
    end if;
    select * into v_target from game_players
      where id = p_target_player_id and game_id = v_actor.game_id for update;
    if not found then
      return null;
    end if;

    select array(
      select c from unnest(v_target.deck) as c
      where c <> all (v_target.used_characters)
    ) into v_candidates;
    if array_length(v_candidates, 1) is null then
      return null;
    end if;
    v_target_character := v_candidates[1 + floor(random() * array_length(v_candidates, 1))::int];
    update game_players set debuffed_character_ids = debuffed_character_ids || v_target_character
      where id = v_target.id;

    v_result := jsonb_build_object('jokerKey', p_joker_key, 'targetPlayerId', p_target_player_id,
      'targetCharacterId', v_target_character);
  else
    return null;
  end if;

  update game_players
  set joker_used = true, used_joker_key = p_joker_key,
      joker_own_character_id = p_own_character_id, joker_target_player_id = p_target_player_id
  where id = v_actor.id;

  return v_result;
end;
$$;
