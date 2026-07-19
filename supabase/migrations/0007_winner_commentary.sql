-- Short AI-generated Turkish commentary on why the round's winner(s) won,
-- persisted so it survives reconnects/refreshes (not just an ephemeral
-- Broadcast payload). Null until the round is resolved and the commentary
-- has actually been generated.
alter table rounds add column winner_commentary text;
