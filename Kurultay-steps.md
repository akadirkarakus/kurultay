# MASTER PROMPT — "Character Battle" Multiplayer Web Game

> Give this prompt as-is to an AI coding assistant (Claude Code, Cursor, etc.). The project must be built end-to-end according to this document.

---

## ROLE

You are a senior full-stack developer. You will build the multiplayer web game described below from scratch using **Next.js (App Router) + Supabase + DeepSeek API**, deployable on **Vercel**. All game logic runs server-side; the client is never trusted.

---

## 1. GAME DEFINITION

**Concept:** Players build decks of characters based on real people (politicians, celebrities, athletes, historical figures, etc.). Each round presents a scenario; the AI determines the critical attributes for that scenario; each player plays one character from their deck; the character with the highest average across those attributes wins the round.

**Rules:**
- Player count: minimum 2, maximum 4.
- Players join a lobby via a room code. The lobby host starts the game.
- At game start, each player picks **5 characters** from the character pool to form their deck.
- Every character has **29 attributes** (leadership, creativity, physical strength, intelligence, humor, etc.), each scored 0–100.
- The game lasts **4 rounds**. Each round:
  1. The server publishes a scenario (e.g., "Aliens have invaded Earth; one human is needed to save the world").
  2. The AI determines the **3 most critical attributes** for the scenario (e.g., intelligence, physical endurance, mental endurance). The attributes are shown to all players simultaneously.
  3. Each player selects one of their **not-yet-used** characters within a time limit (60 s).
  4. The server computes the average of the 3 key attributes for each selected character. The highest average wins the round and scores round points (winner: 1 point; on a tie, every tied player gets 1 point).
  5. The round result is revealed to everyone: who played which character, the attribute values, the averages, and the winner.
- **Every character is single-use**; a played character becomes inactive in the deck.
- After 4 rounds, the player with the highest total score wins. On an overall tie, a 5th "tie-break" round is played (each tied player's last remaining character is auto-played).
- If a player fails to pick within the time limit, the server auto-plays a random unused character from their deck.

---

## 2. TECH STACK

| Layer | Technology | Notes |
|---|---|---|
| Frontend + API | Next.js 14+ (App Router, TypeScript) | Deployed on Vercel |
| Database | Supabase (PostgreSQL) | JSONB attributes column |
| Realtime | Supabase Realtime | Postgres Changes + Presence; do NOT build a separate WebSocket server |
| AI | DeepSeek API (`deepseek-chat`) | OpenAI-compatible SDK; enforce JSON via function calling / JSON mode |
| Styling | Tailwind CSS | |
| State | Zustand or React context | Keep it simple |
| Validation | Zod | All API inputs/outputs |

**Vercel constraint:** Serverless functions cannot hold persistent connections. All realtime traffic goes through Supabase Realtime. Postgres is the single source of truth for game state.

---

## 3. DATABASE SCHEMA

Create the following schema as Supabase migrations:

```sql
-- Character pool (imported from Excel)
create table characters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,           -- 'politician' | 'celebrity' | 'athlete' | 'historical' | ...
  image_url text,
  attributes jsonb not null         -- {"leadership": 99, "humor": 20, ... 29 attributes}
);

-- Games
create table games (
  id uuid primary key default gen_random_uuid(),
  room_code text unique not null,   -- 6 chars, uppercase letters/digits
  status text not null default 'lobby',
    -- 'lobby' | 'deck_selection' | 'in_round' | 'round_result' | 'finished'
  current_round int not null default 0,
  max_rounds int not null default 4,
  host_player_id uuid,
  created_at timestamptz default now()
);

-- Players
create table game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  nickname text not null,
  session_token text not null,      -- secret token matching an httpOnly cookie
  deck uuid[] default '{}',         -- the 5 selected character ids
  used_characters uuid[] default '{}',
  score int not null default 0,
  is_ready boolean default false,
  joined_at timestamptz default now(),
  unique (game_id, nickname)
);

-- Rounds
create table rounds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  round_number int not null,
  scenario_text text not null,
  key_attributes text[] not null,   -- the 3 attributes chosen by the AI
  deadline_at timestamptz,          -- pick deadline
  status text not null default 'picking',  -- 'picking' | 'resolved'
  unique (game_id, round_number)
);

-- Round picks
create table round_picks (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references rounds(id) on delete cascade,
  player_id uuid references game_players(id) on delete cascade,
  character_id uuid references characters(id),
  average numeric,                  -- computed by the server at resolve time
  is_auto_pick boolean default false,
  unique (round_id, player_id)
);

-- Scenario pool (hand-written base scenarios)
create table scenarios (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  suggested_attributes text[]       -- optional; AI fallback
);
```

**RLS (Row Level Security):** Enable RLS on all tables. Clients may only `select` (to read rows of their own game); all `insert/update` operations go through **API routes using the service role key**. `game_players.session_token` must never be returned to clients (use a view or column-level policy).

**29-attribute list:** Define as a constant array in `lib/attributes.ts` (keys, e.g., `leadership`, `intelligence`, `charisma`, `physical_strength`, `physical_endurance`, `mental_endurance`, `creativity`, `humor`, `public_speaking`, `strategy`, `courage`, `empathy`, `patience`, `ambition`, `trustworthiness`, `technical_knowledge`, `artistic_talent`, `athletic_ability`, `sociability`, `composure`, `persuasion`, `problem_solving`, `adaptability`, `teamwork`, `honesty`, `cunning`, `wisdom`, `luck`, `popularity`). Map these one-to-one to the actual column names in the Excel file.

**Excel import:** Write `scripts/import-characters.ts`: reads `characters.xlsx` (via SheetJS), converts each row to `{name, category, attributes: {...29 attributes}}`, and upserts into Supabase with the service role key. Throw on any value outside the 0–100 range.

---

## 4. API ROUTES

All under `app/api/`, validated with Zod, using a service-role Supabase client:

| Route | Method | Job |
|---|---|---|
| `/api/games` | POST | Create game: generate unique room code, add creator as host, generate session_token and set it as an httpOnly cookie |
| `/api/games/join` | POST | Join by room code: add player if game is in `lobby` and has <4 players |
| `/api/games/[id]/start` | POST | Host only, requires ≥2 players: status → `deck_selection` |
| `/api/games/[id]/deck` | POST | Accept 5 unique character ids, save, set `is_ready=true`. When all players are ready, start round 1 (see "round start" flow) |
| `/api/games/[id]/pick` | POST | Round pick: validate character is in the player's deck, unused, round is `picking`, and deadline not passed. If all players have picked, resolve the round |
| `/api/games/[id]/resolve` | POST | Called when the deadline expires (client timer triggers it; server verifies the deadline): auto-fill missing picks, resolve the round |
| `/api/games/[id]/state` | GET | The full game state the player is authorized to see (for reconnect) |

**Round start flow (internal server function):**
1. Fetch a random scenario from `scenarios` not yet used in this game (track usage via `rounds`).
2. Send the scenario to the DeepSeek API and get the 3 key attributes (Section 5).
3. Create a `rounds` row (`deadline_at = now() + 60s`), set `games.status='in_round'`, increment `current_round`.

**Round resolve flow:**
1. Assign a random unused character to any player who has not picked (`is_auto_pick=true`).
2. For each pick, compute the average of the 3 key attributes and write it to `round_picks.average`.
3. The highest average(s) get 1 point → `game_players.score`.
4. Add played characters to `used_characters`. Set `rounds.status='resolved'`, `games.status='round_result'`.
5. After 8 s (via a client "continue" request or host trigger), start the next round; if `current_round == max_rounds`, check for an overall tie: if tied, increment `max_rounds` for a tie-break round; otherwise `games.status='finished'`.

**Idempotency:** Resolve may be triggered multiple times (multiple client timers). Guarantee it runs exactly once with a conditional update on `rounds.status='picking'` (optimistic lock).

---

## 5. AI INTEGRATION (DEEPSEEK)

Single function in `lib/ai.ts`: `getKeyAttributes(scenarioText: string): Promise<string[]>`

- Use the **OpenAI SDK** with `baseURL: "https://api.deepseek.com"`, model: `deepseek-chat`.
- **Enforce JSON via function calling** (or JSON mode with a strict schema); never parse free text:

```
System: You are a game referee. Given a scenario, select EXACTLY the 3
most critical attributes needed to overcome it, from the following list
of 29 attributes. Use only the exact keys from the list.
Attribute list: [the 29 attribute keys]

Function/tool schema: { "key_attributes": string[3] (enum: the 29 attributes) }
```

- Validate the returned 3 attributes against the 29-key list; on invalid output retry once, then fall back to the scenario's `suggested_attributes`.
- The AI call is made **exactly once per round, server-side**; the result is written to `rounds.key_attributes` and broadcast identically to everyone.
- `DEEPSEEK_API_KEY` is a server-only environment variable; it must never leak into the client bundle.
- Set a request timeout (e.g., 10 s); on timeout use the fallback attributes so the round is never blocked by the AI.

**Scenario pool:** Seed at least 20 hand-written scenarios in Turkish via `scripts/seed-scenarios.ts` (alien invasion, zombie outbreak, managing an economic crisis, surviving on a desert island, judging a talent show, selecting an astronaut for a space mission, hostage negotiation, world peace summit, disaster-relief coordination, treasure hunt, etc. — balance physical, mental, social, and comedic scenarios).

---

## 6. REALTIME FLOW

- Each client subscribes to the `game:{gameId}` Supabase Realtime channel.
- **Postgres Changes:** listen to changes on `games`, `game_players`, `rounds`, `round_picks` filtered by the relevant `game_id` → update UI state.
- **Presence:** show who is connected in the lobby.
- **Secrecy rule:** While a round is in `picking` status, other players' character choices are NOT visible (only a "picked / not picked" indicator). Block `character_id` from client selects on `round_picks`; reveal after resolve via `/api/games/[id]/state`.
- Reconnect: on page refresh, call `/api/games/[id]/state` with the session_token cookie; the player resumes where they left off.

---

## 7. SCREENS (UI)

1. **Home:** Enter nickname + "Create Room" / "Join with Room Code".
2. **Lobby:** Room code (copyable), connected players (presence), "Start Game" for the host (requires ≥2 players).
3. **Deck selection:** Character pool grid (name, category, image, attribute-preview modal); pick 5 characters, "Ready". Other players' ready states are visible.
4. **Round screen:** Scenario text + the AI's 3 key attributes + countdown (60 s) + the player's available cards (used ones dimmed/locked, the key attributes highlighted on each card). "Picked ✓" indicator for other players.
5. **Round result:** Everyone's played character, the 3 attribute values, averages, and the round winner revealed with animation; scoreboard.
6. **Game over:** Final scoreboard, winner, "Play Again" (new game with the same lobby).

Mobile-first responsive design. Simple but polished "trading card" look for the cards.

---

## 8. SECURITY / ANTI-CHEAT RULES

- All computation (attribute averages, winners, scores) happens server-side only.
- Every mutation request validates the session_token; a player can only act on their own behalf.
- Deck and pick validation is server-side: is the character in the deck, is it unused, is the round open, is the deadline respected.
- `deadline_at` is enforced with server time; the client countdown is visual only.
- RLS + service-role separation as described in Section 3.

---

## 9. ENVIRONMENT VARIABLES

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # server-only
DEEPSEEK_API_KEY=            # server-only
```

---

## 10. DEVELOPMENT ORDER

1. Next.js + TypeScript + Tailwind + Supabase client setup; schema migrations.
2. Import scripts: characters (Excel) + scenarios (seed).
3. Lobby flow: create / join / start + Realtime presence.
4. Deck selection screen and API.
5. Round loop: round start (including AI integration), pick, resolve, result screen.
6. Game over + play again.
7. Reconnect, auto-pick, idempotent resolve, tie scenarios.
8. UI polish and mobile testing.
9. Vercel deployment (env variables, Supabase production project).

## 11. ACCEPTANCE CRITERIA

- [ ] Full game flow completes without errors with 2, 3, and 4 players.
- [ ] The same character cannot be played twice (rejected at the API level).
- [ ] A player who misses the deadline gets an auto-assigned character.
- [ ] Resolve is idempotent: on double trigger, scores are applied exactly once.
- [ ] Round ties and overall ties (tie-break round) work correctly.
- [ ] Page refresh resumes the player where they left off.
- [ ] Opponent picks do not leak to the client during the picking phase (verify via the network tab).
- [ ] If the AI returns invalid attributes, the fallback kicks in.
- [ ] No API keys in the client bundle.
- [ ] Production build runs cleanly on Vercel.

---

## NOTES

- Code in English; UI copy in Turkish.
- No auth (MVP): nickname + httpOnly session cookie is sufficient.
- Character images may be placeholders for the MVP (initial-letter avatar when `image_url` is empty).
- Tests: at minimum, unit tests for the round-resolve logic (averages, ties, auto-pick).
