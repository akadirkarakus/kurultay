-- resolve_round: the single idempotent entry point for finishing a round.
-- Safe to call multiple times concurrently — only the first caller to see
-- status = 'picking' under the row lock does any work; everyone else is a
-- no-op. See Kurultay-steps.md plan §3.1 for the design rationale.
create or replace function resolve_round(p_round_id uuid)
returns void
language plpgsql
as $$
declare
  v_round rounds%rowtype;
  v_player game_players%rowtype;
  v_candidates uuid[];
  v_pick_id uuid;
  v_chosen_character uuid;
  v_max_average numeric;
begin
  select * into v_round from rounds where id = p_round_id for update;

  if not found or v_round.status <> 'picking' then
    return; -- already resolved (or resolving) by another caller — no-op
  end if;

  -- Auto-pick a random unused character for every player who hasn't picked yet.
  for v_player in
    select * from game_players where game_id = v_round.game_id for update
  loop
    if not exists (
      select 1 from round_picks where round_id = p_round_id and player_id = v_player.id
    ) then
      select array(
        select c
        from unnest(v_player.deck) as c
        where c <> all (v_player.used_characters)
      ) into v_candidates;

      if array_length(v_candidates, 1) > 0 then
        v_chosen_character := v_candidates[1 + floor(random() * array_length(v_candidates, 1))::int];
        insert into round_picks (round_id, player_id, character_id, is_auto_pick)
        values (p_round_id, v_player.id, v_chosen_character, true);
      end if;
    end if;
  end loop;

  -- Compute each pick's average across the round's key attributes.
  update round_picks rp
  set average = (
    select avg((c.attributes ->> attr)::numeric)
    from unnest(v_round.key_attributes) as attr
    join characters c on c.id = rp.character_id
  )
  where rp.round_id = p_round_id;

  select max(average) into v_max_average from round_picks where round_id = p_round_id;

  -- Award points to every pick tied for the highest average.
  update game_players gp
  set score = gp.score + 1
  from round_picks rp
  where rp.round_id = p_round_id
    and rp.player_id = gp.id
    and rp.average = v_max_average;

  -- Every played character becomes unavailable for the rest of the game, win or lose.
  update game_players gp
  set used_characters = gp.used_characters || rp.character_id
  from round_picks rp
  where rp.round_id = p_round_id
    and rp.player_id = gp.id;

  update rounds set status = 'resolved' where id = p_round_id;
  update games set status = 'round_result' where id = v_round.game_id;
end;
$$;

-- resolve_tiebreak_round: collapses start+resolve into one atomic step for the
-- 5th "tie-break" round (§3.4) — no picking phase, each tied player's single
-- remaining character is auto-played immediately.
create or replace function resolve_tiebreak_round(p_round_id uuid, p_tied_player_ids uuid[])
returns void
language plpgsql
as $$
declare
  v_round rounds%rowtype;
  v_player game_players%rowtype;
  v_candidates uuid[];
  v_max_average numeric;
begin
  select * into v_round from rounds where id = p_round_id for update;

  if not found or v_round.status <> 'picking' then
    return;
  end if;

  for v_player in
    select * from game_players
    where game_id = v_round.game_id and id = any(p_tied_player_ids)
    for update
  loop
    select array(
      select c
      from unnest(v_player.deck) as c
      where c <> all (v_player.used_characters)
    ) into v_candidates;

    if array_length(v_candidates, 1) > 0 then
      insert into round_picks (round_id, player_id, character_id, is_auto_pick)
      values (p_round_id, v_player.id, v_candidates[1], true);
    end if;
  end loop;

  update round_picks rp
  set average = (
    select avg((c.attributes ->> attr)::numeric)
    from unnest(v_round.key_attributes) as attr
    join characters c on c.id = rp.character_id
  )
  where rp.round_id = p_round_id;

  select max(average) into v_max_average from round_picks where round_id = p_round_id;

  update game_players gp
  set score = gp.score + 1
  from round_picks rp
  where rp.round_id = p_round_id
    and rp.player_id = gp.id
    and rp.average = v_max_average;

  update game_players gp
  set used_characters = gp.used_characters || rp.character_id
  from round_picks rp
  where rp.round_id = p_round_id
    and rp.player_id = gp.id;

  update rounds set status = 'resolved' where id = p_round_id;
  update games set status = 'round_result' where id = v_round.game_id;
end;
$$;
