-- Category-based sequential draft, replacing the old single-pool deck
-- selection. See Kurultay-steps.md plan (Sprint 3) for the design rationale.

-- The 5 categories chosen for this game, in draft order (index i is
-- drafted during step i+1). Chosen once, uniformly at random from the 9
-- known categories, when the game leaves the lobby.
alter table games add column draft_categories text[] not null default '{}';

-- 0 while in lobby; 1..DECK_SIZE while status = 'deck_selection' (which
-- category step is currently active). Its change on `games` drives the
-- existing Postgres Changes -> client refetch pattern, exactly like
-- current_round already does — no new realtime plumbing needed.
alter table games add column current_draft_step int not null default 0;

-- Server-enforced deadline for the CURRENT draft step, mirroring
-- rounds.deadline_at. Auto-pick stragglers once this passes (see
-- submit_draft_pick below and the /draft-resolve route).
alter table games add column draft_deadline_at timestamptz;

-- This player's 5 offered character ids for the CURRENTLY active draft
-- step, disjoint from every other player's offer for that same step.
-- Overwritten at the start of every step. Replaces available_pool.
alter table game_players add column draft_offer uuid[] not null default '{}';
alter table game_players drop column available_pool;

-- Atomically appends a drafted pick to game_players.deck, but only if the
-- character was actually offered to this player AND they haven't already
-- picked for this step. deck's own length is the race-safe guard: deck[i]
-- is definitionally the pick made during draft_categories[i]'s step, so no
-- separate pick-history table is needed. Returns false (caller maps to a
-- 409) if either precondition fails.
create or replace function submit_draft_pick(p_player_id uuid, p_step_number int, p_character_id uuid)
returns boolean
language plpgsql
as $$
declare
  v_updated int;
begin
  update game_players
  set deck = deck || p_character_id
  where id = p_player_id
    and p_character_id = any(draft_offer)
    and coalesce(array_length(deck, 1), 0) = p_step_number - 1;
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;
