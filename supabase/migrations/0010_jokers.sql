-- Sprint 10: joker mechanic (3 of ~10 planned jokers). Each player gets
-- exactly one joker use for the whole game. When a round starts and any
-- player still has an unused joker, a 10s "joker window" opens before the
-- normal picking phase (see lib/constants.ts JOKER_WINDOW_DURATION_S).
-- Tie-break rounds never show this window (lib/server/rounds.ts startTiebreakRound
-- is intentionally untouched).

create table jokers (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  description text not null,
  needs_own_character boolean not null,
  needs_target_player boolean not null,
  sort_order int not null default 0
);
alter table jokers enable row level security;
create policy jokers_select_all on jokers for select using (true);

alter table game_players add column joker_used boolean not null default false;
alter table game_players add column used_joker_key text;
alter table game_players add column joker_own_character_id uuid references characters(id);
alter table game_players add column joker_target_player_id uuid references game_players(id);
alter table game_players add column debuffed_character_ids uuid[] not null default '{}';

alter table rounds add column joker_deadline_at timestamptz;
alter table rounds add column joker_skipped_player_ids uuid[] not null default '{}';

-- Widen the rounds.status CHECK constraint to allow 'joker_window'. The
-- original constraint (0001_schema.sql) was an unnamed inline CHECK, so its
-- actual name depends on Postgres's auto-naming — looked up dynamically here
-- instead of hardcoding a guessed name.
do $$
declare
  v_constraint_name text;
begin
  select conname into v_constraint_name
  from pg_constraint
  where conrelid = 'rounds'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%status%';

  if v_constraint_name is not null then
    execute format('alter table rounds drop constraint %I', v_constraint_name);
  end if;
end $$;

alter table rounds add constraint rounds_status_check
  check (status in ('joker_window', 'picking', 'resolving', 'resolved'));

-- Public transparency: who used which joker, against whom (never which
-- exact card — that's only visible once actually played, same as any other
-- deck info).
drop view if exists game_players_public;
create view game_players_public as
  select id, game_id, nickname, score, is_ready, joined_at,
    joker_used, used_joker_key, joker_target_player_id
  from game_players;
grant select on game_players_public to anon, authenticated;

-- use_joker: atomic, race-safe via explicit row locks (like resolve_round),
-- not submit_draft_pick's single-statement CAS — card_swap needs a genuine
-- multi-row read-then-write (reading the target's current deck to pick a
-- random card, then writing both rows). Returns a jsonb summary of what
-- happened, or null if it couldn't be used (already used, window closed,
-- invalid card/target) — the caller maps null to a 409.
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
    if not found or array_length(v_target.deck, 1) is null then
      return null;
    end if;

    v_target_character := v_target.deck[1 + floor(random() * array_length(v_target.deck, 1))::int];

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
    if not found or array_length(v_target.deck, 1) is null then
      return null;
    end if;

    v_target_character := v_target.deck[1 + floor(random() * array_length(v_target.deck, 1))::int];
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

-- skip_joker: CAS-guarded per-round opt-out, exactly like submit_draft_pick's style.
create or replace function skip_joker(p_round_id uuid, p_player_id uuid)
returns boolean
language plpgsql
as $$
declare v_updated int;
begin
  update rounds
  set joker_skipped_player_ids = joker_skipped_player_ids || p_player_id
  where id = p_round_id
    and status = 'joker_window'
    and not (p_player_id = any(joker_skipped_player_ids));
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

-- resolve_round / resolve_tiebreak_round: joker-modifier-aware averaging.
-- value_boost gives +8% on the boosted card's attributes when it's played;
-- value_debuff gives -8% on a debuffed card. 1.08/0.92 mirror
-- JOKER_VALUE_MODIFIER (lib/constants.ts) — SQL can't share the JS constant,
-- so keep the two in sync by hand if it ever changes.
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
    return;
  end if;

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

  update round_picks rp
  set average = (
      select avg((c.attributes ->> attr)::numeric)
      from unnest(v_round.key_attributes) as attr
      join characters c on c.id = rp.character_id
    )
    * (case when gp.used_joker_key = 'value_boost' and gp.joker_own_character_id = rp.character_id
        then 1.08 else 1 end)
    * (case when rp.character_id = any(gp.debuffed_character_ids)
        then 0.92 else 1 end)
  from game_players gp
  where rp.round_id = p_round_id
    and gp.id = rp.player_id;

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
    * (case when gp.used_joker_key = 'value_boost' and gp.joker_own_character_id = rp.character_id
        then 1.08 else 1 end)
    * (case when rp.character_id = any(gp.debuffed_character_ids)
        then 0.92 else 1 end)
  from game_players gp
  where rp.round_id = p_round_id
    and gp.id = rp.player_id;

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
