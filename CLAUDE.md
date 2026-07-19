# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev              # dev server (Turbopack)
npm run build             # production build
npm run typecheck         # tsc --noEmit
npm run lint               # eslint
npm run test:unit          # vitest run tests/unit
npm run test:integration   # vitest run tests/integration
npm run test:e2e           # playwright test (auto-starts dev server on :3000)
npm run seed:scenarios     # upsert lib data into the live Supabase `scenarios` table
npm run import:characters  # import data/characters.xlsx into `characters` + upload images
```

Run a single test file: `npx vitest run tests/unit/resolveRound.test.ts`.

Standard regression check after any change: `npm run typecheck && npm run lint && npm run test:unit`.

Environment variables (see `.env.local.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DEEPSEEK_API_KEY`.

## What this is

Kurultay ("Character Battle") is a real-time multiplayer web game: 2-4 players each draft a deck of 5 character cards (real people — politicians, athletes, historical figures, etc.), then compete over `ROUND_COUNT` rounds. Each round shows a Turkish scenario; DeepSeek picks the `KEY_ATTRIBUTES_PER_ROUND` most relevant of 27 possible attributes; each player secretly plays one unused character; whoever's average across those attributes is highest wins the round. Ties replay a tie-break round with each tied player's last card auto-played. The original design spec is `Kurultay-steps.md` — the implementation has since diverged from it in specifics (see `lib/attributes.ts`, `lib/categories.ts`, and `to-do.md` for what actually shipped and why).

`to-do.md` tracks user-facing feedback/sprints in Turkish; treat it as the current backlog, not documentation of past behavior — check it before assuming a listed item is still outstanding.

## Architecture

**Server is the only source of truth; there is no client-side game logic.** The client (`GameClient.tsx` + `useGameStore` in `store/`) is a dumb renderer: it fetches `GET /api/games/[id]/state`, renders a screen based on `game.status`, and re-fetches on any Supabase Realtime signal. All state transitions happen through API routes under `app/api/games/[id]/*`, which call functions in `lib/server/*` using the service-role client.

**Two Supabase clients, never mixed:**
- `lib/supabase/admin.ts` (`supabaseAdmin()`) — service-role, bypasses RLS, server-only (`import "server-only"`). The *only* client allowed to mutate anything. Used from API routes and `lib/server/*`.
- `lib/supabase/browser.ts` (`supabaseBrowser()`) — anon-key, client-side, used only for Realtime subscriptions (Postgres Changes + Broadcast + Presence) and reading tables with permissive RLS (`characters`, `scenarios`, `games`, `rounds`, `game_players_public`). Never used for writes.

**Auth is a no-auth MVP**: an httpOnly session cookie per room (`lib/session.ts`, named `ku_session_<ROOMCODE>`) mapped to a `game_players.session_token` row. `lib/server/auth.ts`'s `requirePlayer(admin, gameId)` is the single authorization gate every mutating route calls first — there is no other access control.

**Realtime propagation pattern**: mutations write to Postgres, then explicitly broadcast a near-empty signal event (e.g. `pick_submitted`, `draft_pick_submitted`, `round_resolved`, `player_updated`) on the `game:${gameId}` channel. Every client just refetches full state (`GET /state`) on any signal or on `postgres_changes` for the `games` row — payloads intentionally don't carry game data, both to avoid leaking secret picks and to keep one code path (`/state`) as the sole builder of client-visible state. When adding a new state transition that doesn't touch the `games` table, you must add both the broadcast call *and* a listener for it in `GameClient.tsx`, or clients simply won't refresh.

**Concurrency pattern — CAS via conditional UPDATE, or row locks for multi-row ops**: routes that can race (multiple players submitting simultaneously, or step-advance logic) use either a compare-and-swap `UPDATE ... WHERE <still-old-value>` and check the affected row count (see `submit_draft_pick`, `advanceDraftStep` in `lib/server/draft.ts`), or an explicit `SELECT ... FOR UPDATE` inside a Postgres function when a true multi-row read-then-write is unavoidable (see `resolve_round` in `supabase/migrations/0002_functions.sql`). Unique constraints (e.g. `rounds (game_id, round_number)`) are also leaned on directly: a `23505` conflict on insert is treated as "another caller already did this," not an error — see `startNextRound` in `lib/server/rounds.ts`.

**Game logic lives in Postgres functions, mirrored in pure JS for reuse**: `resolve_round`/`resolve_tiebreak_round`/`submit_draft_pick` (in `supabase/migrations/0002_functions.sql` and `0008_category_draft.sql`) are the actual scoring authority. `lib/game-logic/resolveRound.ts`'s `computeRoundResult` is a *pure mirror* of the SQL averaging logic, used only to build AI winner-commentary input — if you change the SQL scoring, update this mirror too or the commentary and the real winner can disagree.

**Attributes and categories are fixed catalogs, not DB-driven**: `lib/attributes.ts` (`BATTLE_ATTRIBUTES`, 27 entries) and `lib/categories.ts` (`CHARACTER_CATEGORIES`, 9 entries) are the single source of truth for what attribute/category values are valid; they mirror the column headers / sheet names in `data/characters.xlsx` exactly (see `scripts/import-characters.ts`). Changing these requires re-running the relevant import/migration, not just editing a DB row.

**AI calls never block game flow**: `lib/ai.ts`'s `getKeyAttributes` and `getWinnerCommentary` each try DeepSeek via forced function-calling up to twice, then fall back to a deterministic value (`scenario.suggested_attributes`, or `fallbackCommentary`) — a round must never stall on the AI.

**Errors**: API routes wrap their handler in `withApiErrorHandling` (`lib/errors.ts`), throwing `ApiError(status, code, message)` for expected failure states (mirrors `ApiError` codes like `game_not_found`, `not_authenticated`, `invalid_state`) or letting Zod validation errors propagate — both get mapped to a consistent JSON error shape.

**Game screens are driven by `game.status`** (`GameClient.tsx`'s `GameScreen` switch): `lobby` → `LobbyScreen`, `deck_selection` → `CategoryDraftScreen` (keyed by draft step for a fresh countdown each step), `in_round` → `RoundScreen` (keyed by round number), `round_result` → `RoundResultScreen`, `finished` → `GameOverScreen`. Countdown UI (`components/shared/CountdownBar.tsx`) is driven by a server-set `deadline_at`/`draft_deadline_at` timestamp, not a client-side timer, so it stays correct across reconnects.

**Deck draft is category-sequential, not a single 10-from-pool choice**: `pickDraftCategories` picks 5 random categories game-wide; each step deals every player a disjoint pool of offers within that category (`allocateDisjointPools`) so no two players can be offered the same character.

## Testing

Unit tests (`tests/unit/`, Vitest + jsdom) cover pure logic — `lib/game-logic/*`, `lib/attributes.ts`, `lib/ai.ts` (with a mock `ChatCompletionsClient`), room code generation, and data-shape validation for `scripts/import-characters.ts`/`scripts/seed-scenarios.ts`. Integration tests (`tests/integration/`) and e2e tests (`tests/e2e/`, Playwright) are set up but sparse — check before assuming coverage exists for a given flow.

When manually verifying a live flow against the real Supabase project (multiple players via separate cookie jars, curl + browser), always delete the test game(s) afterward via a service-role script — no automatic cleanup exists.
