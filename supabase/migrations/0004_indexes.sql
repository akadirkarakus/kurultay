create index game_players_game_id_idx on game_players (game_id);
create index game_players_session_token_idx on game_players (session_token);
create index rounds_game_id_idx on rounds (game_id);
create index round_picks_round_id_idx on round_picks (round_id);
create index characters_category_idx on characters (category);
