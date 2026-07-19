-- Postgres Changes requires the table to be part of the realtime
-- publication, in addition to having a permissive SELECT RLS policy.
-- `game_players` and `round_picks` are deliberately NOT added here — they're
-- never exposed via Postgres Changes at all (see §3.5); their live updates
-- travel exclusively through server-emitted Realtime Broadcast events.
alter publication supabase_realtime add table games;
