# Owen's Galaga — Feature Plan v1

**Date:** 2026-03-15

---

## Feature Overview

| # | Feature | Complexity | Dependencies |
|---|---------|-----------|--------------|
| 1 | Fullscreen Mode | 🟢 Small | None |
| 2 | Share Score Screenshot | 🟢 Small | None |
| 3 | Heat-Seeking Bullets Powerup | 🟡 Medium | None |
| 4 | Pokéball Summon Powerup | 🟡 Medium | None |
| 5 | Supabase Backend + Online Leaderboard | 🟡 Medium | Supabase project |
| 6 | Statistics Dashboard (Local + Online) | 🟡 Medium | #5 for online portion |
| 7 | Multiplayer (Co-op via Room Codes) | 🔴 Large | #5 (Supabase Realtime) |

---

## Phase 1 — Quick Wins (no backend needed)

### 1. Fullscreen Mode
**Effort:** ~30 min | **Files:** `MenuScene.js`, `GameScene.js`, `HUD.js`

- Add fullscreen toggle button on Menu screen (🔲 icon)
- Add keyboard shortcut `F` or `F11` to toggle fullscreen
- Use Phaser's built-in `this.scale.toggleFullscreen()` API
- Show a small fullscreen icon in the HUD during gameplay
- Persist preference in localStorage

### 2. Share Score Screenshot
**Effort:** ~1–2 hours | **Files:** `GameOverScene.js`, `BootScene.js`

- Add "SHARE SCORE" button on the Game Over screen
- Use `game.canvas.toDataURL('image/png')` to capture the canvas
- Compose a styled score card overlay first (player score, level, difficulty, stats) then screenshot
- Two share paths:
  - **Download**: Create a temporary `<a>` tag with the data URL and trigger download
  - **Native Share** (mobile/desktop with Web Share API): Use `navigator.share({ files: [blob] })` if available, with fallback to clipboard copy via `navigator.clipboard.write()`
- Show "Screenshot saved!" confirmation text

### 3. Heat-Seeking Bullets Powerup
**Effort:** ~2–3 hours | **Files:** `constants.js`, `PowerupManager.js`, `Player.js`, `GameScene.js`, `BootScene.js`

**Design:**
- New powerup: `HEAT_SEEKING` — weight: 8%, duration: 12s, color: `0xff3300`
- When active, **all** player projectiles (normal, dual, spread, ricochet, AND charged shot) gain homing behavior
- Each bullet acquires the nearest active enemy and gently steers toward it
- Turn rate: moderate (~0.04 rad/frame) — bullets curve visibly but don't make instant 180s
- Bullets that miss their target continue straight (no infinite orbiting)
- Max tracking lifetime per bullet: 2 seconds, then goes straight
- Visual: bullets glow orange-red with a small trail when heat-seeking is active
- Stacks with all existing firing modes:
  - Normal → single homing bullet
  - Dual Laser → two homing bullets
  - Spread Blast → 5 homing bullets (fan out then each seeks a target)
  - Ricochet → ricochet + homing (bounces off walls AND curves toward enemies)
  - Charged Shot → piercing beam still goes straight but gently curves toward enemy clusters
- Procedural sprite: recolor existing bullet with orange-red + small flame trail particle

**Implementation:**
1. Add `HEAT_SEEKING` to `POWERUP_TYPES` in constants.js
2. Generate `powerup_heat_seeking` sprite in BootScene
3. Add `heat_seeking` case in PowerupManager.activate()
4. In Player.js fire methods, after creating each bullet: if `scene.activePowerups.heat_seeking`, call `setupHoming(bullet)`
5. `setupHoming(bullet)` — per-frame update that finds nearest enemy and adjusts velocity angle
6. For charged shot: apply gentler homing (lower turn rate since it's already powerful)

### 4. Pokéball Summon Powerup
**Effort:** ~4–5 hours | **Files:** `constants.js`, `PowerupManager.js`, `GameScene.js`, `BootScene.js`, new `src/systems/PokemonSummon.js`

**Design:**
- New powerup type: `POKEBALL` — weight: 8%, duration: stored consumable (max 2), color: `0xff0000`/`0xffffff` (red/white pokéball colors)
- Separate from bombs — new launch key: `C` key / gamepad `Y` button
- When launched, pokéball flies to center of screen, opens with animation
- Random summon (equal 1/3 chance each):

| Pokémon | Attack | Visual | Duration |
|---------|--------|--------|----------|
| **Charmander** | Shoots fire projectiles at enemies (rapid, spreads) | Orange/red flame sprites, fire particles | 5 seconds |
| **Bulbasaur** | Shoots razor leaves at enemies (moderate speed, slight homing) | Green leaf sprites that spin | 5 seconds |
| **Squirtle** | Shoots water blasts at enemies (fast, straight lines) | Blue water drop/stream sprites | 5 seconds |

- Each Pokémon appears as a small sprite near top-center, auto-targets enemies
- Pokémon attacks deal 1 damage per hit, fire ~4 projectiles/second
- Pokémon is invulnerable (not a gameplay entity the player needs to protect)
- After duration, Pokémon fades out with a sparkle effect
- Pokéball count shown in HUD next to bomb count
- Procedural sprites needed: pokéball, charmander, bulbasaur, squirtle, fire/leaf/water projectiles

**Implementation:**
1. Add `POKEBALL` to `POWERUP_TYPES` in constants.js
2. Add pokéball + pokémon sprites to BootScene procedural generation
3. Create `PokemonSummon.js` system — handles throw animation, summon selection, pokémon AI, attack patterns, cleanup
4. Add `C` key binding + gamepad mapping in GameScene
5. Track `pokeballs` count alongside `bombs` in GameScene state
6. Add pokéball count to HUD display
7. Pokémon projectiles use a separate physics group, collide with enemies same as player bullets

---

## Phase 2 — Supabase Backend

### 5. Supabase Setup + Online Leaderboard
**Effort:** ~3–4 hours | **Files:** new `src/systems/SupabaseClient.js`, `GameScene.js`, `GameOverScene.js`, `MenuScene.js`, `constants.js`, `vite.config.js`

**Architecture:**
- Supabase project with anonymous/public access (no auth required for leaderboard)
- Row Level Security (RLS) policies: anyone can INSERT scores, anyone can SELECT, no UPDATE/DELETE
- Player identity: simple player name entry (stored in localStorage, prompted on first play)

**Database Schema:**
```sql
-- Leaderboard scores
CREATE TABLE scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_name TEXT NOT NULL CHECK (char_length(player_name) BETWEEN 1 AND 20),
  score BIGINT NOT NULL CHECK (score >= 0),
  level INTEGER NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'normal', 'hard')),
  kills INTEGER DEFAULT 0,
  accuracy INTEGER DEFAULT 0,
  max_combo INTEGER DEFAULT 0,
  survival_secs INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast leaderboard queries
CREATE INDEX idx_scores_difficulty_score ON scores (difficulty, score DESC);
CREATE INDEX idx_scores_created_at ON scores (created_at DESC);

-- RLS: public read, public insert, no update/delete
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read scores" ON scores FOR SELECT USING (true);
CREATE POLICY "Anyone can insert scores" ON scores FOR INSERT WITH CHECK (true);
```

**Client Integration:**
- `SupabaseClient.js` — thin wrapper using `@supabase/supabase-js`
- Env vars: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (safe to expose — anon key is public, RLS protects data)
- These get baked into the build at deploy time via Vite's `import.meta.env`
- Graceful degradation: if Supabase is unreachable, fall back to local-only scores

**Leaderboard UI:**
- Menu screen: "ONLINE LEADERBOARD" button → overlay showing top 50 per difficulty
- Game Over screen: auto-submit score if online, show rank position
- Tab between Local / Online views

### 6. Statistics Dashboard (Local + Online)
**Effort:** ~3–4 hours | **Files:** new `src/scenes/StatsScene.js`, `GameScene.js`, `MenuScene.js`, `SupabaseClient.js`

**Local Lifetime Stats (localStorage):**
```
{
  totalGamesPlayed: number,
  totalTimePlayed: number (ms),
  totalKills: number,
  totalShotsFired: number,
  totalShotsHit: number,
  totalDeaths: number,
  totalBossKills: number,
  totalPowerupsCollected: number,
  totalBombsUsed: number,
  totalPokemonSummoned: number,
  highestCombo: number,
  highestLevel: number,
  highestScore: number,
  perDifficulty: { easy/normal/hard → same stats },
  favoritePokemons: { charmander: n, bulbasaur: n, squirtle: n },
}
```

**Online Stats (Supabase, aggregated from scores table):**
- Global stats: total games played worldwide, total kills worldwide
- Player's rank per difficulty mode
- Player's percentile (top X%)

**Dashboard UI — new `StatsScene`:**
- Accessible from Menu: "STATS" button
- Tabbed view: LOCAL | ONLINE
- Local tab: lifetime stat cards with icons, animated counters
- Online tab: your rank, global aggregates
- Back button returns to menu

---

## Phase 3 — Multiplayer

### 7. Co-op Multiplayer via Room Codes
**Effort:** ~15–20 hours | **Files:** many new + significant refactors

**This is the largest feature by far.** Here's the realistic architecture:

**How It Works:**
1. Player A picks "ONLINE CO-OP" from menu → creates a room → gets a 6-character room code (e.g., `GALX7K`)
2. Player B picks "JOIN GAME" → enters the room code → joins the waiting room
3. Both players see each other's name in the lobby. Host picks difficulty and starts.
4. Both players play the **same level sequence simultaneously** on their own screen (synchronized waves, same enemy spawns)
5. Shared score — both players' kills contribute to one score
6. If one player dies, they spectate until the other finishes or also dies

**Architecture: Supabase Realtime + Shared State (NOT frame-synced)**

This is critical: we're **not** doing lockstep multiplayer (that's prohibitively complex for a web game). Instead:

- **Synchronized game seed**: both clients get the same wave seed, so enemy spawns/patterns are identical
- **Supabase Realtime Channels** for room management: create/join/start/end
- **Lightweight state broadcasts**: each player sends periodic updates (score contribution, alive/dead status, level progress)
- **Each client runs its own physics** — players don't see each other's ship on screen
- **Shared score**: both players' kills accumulate to one leaderboard entry tagged as "co-op"

This approach avoids the nightmare of real-time position sync, lag compensation, and client prediction. It's more of a "parallel play" co-op (like parallel Tetris) than a shared-screen co-op.

**Database Schema (additional):**
```sql
-- Multiplayer rooms
CREATE TABLE rooms (
  code TEXT PRIMARY KEY CHECK (char_length(code) = 6),
  host_name TEXT NOT NULL,
  guest_name TEXT,
  difficulty TEXT,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  game_seed BIGINT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-expire rooms after 1 hour (use Supabase cron or pg_cron)
-- RLS: public create, public join (update guest_name where guest_name IS NULL)
```

**Supabase Realtime Channel Messages:**
- `room:GALX7K` channel
- Message types: `player_joined`, `game_start { seed, difficulty }`, `score_update { player, score_delta }`, `player_died`, `level_cleared`, `game_over { final_score }`

**New Scenes:**
- `MultiplayerMenuScene` — Create / Join room
- `LobbyScene` — Waiting room with room code display, player names, difficulty selection, start button (host only)

**Game Changes:**
- `WaveGenerator` already uses deterministic generation per level — with a shared seed, both clients produce identical waves ✅
- `GameScene` gets a multiplayer mode flag: sends score updates via Realtime, receives partner status
- HUD shows partner's status (alive/dead, their score contribution)

---

## Implementation Order

```
Phase 1 (no backend, can ship immediately)
  ├── 1. Fullscreen Mode
  ├── 2. Share Score Screenshot
  ├── 3. Heat-Seeking Bullets Powerup
  └── 4. Pokéball Summon Powerup

Phase 2 (needs Supabase setup)
  ├── 5. Supabase + Online Leaderboard
  └── 6. Statistics Dashboard

Phase 3 (deferred — future project)
  └── 7. Full Co-op Multiplayer (shared screen, WebRTC)
```

**Estimated total (Phases 1–2): ~15–20 hours of implementation**
**Phase 3 (deferred): ~30–40 hours — full shared-screen co-op with WebRTC**

Phase 1 can be built and deployed incrementally — each feature is independent.
Phase 2 requires a one-time Supabase project setup, then both features share the client.

---

## Decisions

1. **Multiplayer scope**: Full shared-screen co-op (both ships visible, shared enemies). This requires WebRTC or a real-time game server and is significantly more complex. **Deferred to a later phase** after all other features ship.

2. **Player identity**: Simple name entry, stored in localStorage. No auth/accounts needed.

3. **Pokéball key binding**: `C` key + gamepad `Y` button confirmed.

4. **Heat-seeking + charged shot interaction**: Charged shot does NOT get heat-seeking behavior — it already pierces and does 3x damage. Heat-seeking applies to: normal, dual, spread, and ricochet shots only.
