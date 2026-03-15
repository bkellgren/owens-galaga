# Owen's Galaga — Game Design Specification (v0.2)

*Web-based arcade shooter inspired by the original Galaga with modern mechanics.*

---

## 1. Core Concept

A browser-based fixed-shooter in the spirit of the original 1981 Galaga. The player controls a ship at the bottom of the screen, shooting upward at waves of alien enemies that fly in formation patterns. The game preserves the feel of the original — tight controls, escalating difficulty, wave-based enemy formations, tractor beam ship capture — while layering on a powerup system, boss fights every 3 levels, bonus rounds, a charged shot mechanic, environmental hazards, and a multi-ship powerup.

The game is **endless** — there is no final level. Levels recycle and escalate indefinitely, with difficulty continuing to ramp. The player's goal is to survive as long as possible and chase high scores.

**Difficulty modes**: Easy, Normal, and Hard are available from the main menu. These affect baseline enemy speed, dive frequency, projectile density, and HP scaling. The core level structure and powerup economy remain the same across modes.

Tech target: HTML5 Canvas or WebGL, desktop-first, playable in modern browsers. Keyboard + gamepad input. No server dependency — client-side only, local high scores.

---

## 2. Player Ship

### 2.1 Base Ship
- Fixed to the bottom ~10% of the screen, moves left/right only
- Single forward-firing laser (one or two shots on screen at a time by default, tunable)
- Smooth, responsive movement with slight acceleration/deceleration curve (not instant stop — gives it weight without feeling sluggish)
- **3 lives, no continues**. All lives lost = game over, start from Level 1. Classic arcade rules.
- Brief invulnerability window on respawn (~2 seconds, ship blinks)

### 2.2 Charged Shot
- **Mechanic**: Holding the fire button charges a more powerful single shot. Charge time ~1.5 seconds for full charge.
- **Full charge shot**: Wider beam, pierces through enemies (hits everything in its path), and deals 3x damage
- **Partial charge**: Releasing early fires a normal shot. The charge must reach full to get the powered-up version.
- **Risk/reward**: Player cannot fire regular shots while charging. They are voluntarily reducing their DPS and must survive without shooting during the charge window.
- **Visual**: Ship glows increasingly bright during charge; full charge has a distinct audio + visual "ready" cue
- **Multi-ship interaction**: All ships in formation charge simultaneously and fire the charged shot together
- **Note**: This is a base mechanic available at all times, not a powerup. It coexists with bombs — bombs are a stored consumable, charged shot is a skill-based tool.

### 2.3 Multi-Ship Mode (Powerup)
- When the multi-ship powerup is collected, the player controls **3 ships in parallel** arranged in a tight horizontal formation (center ship at original position, flanking ships offset ~1.5 ship-widths to each side)
- All 3 ships mirror the player's input simultaneously (move together, fire together)
- Each ship has independent health — destroying one removes it from formation, remaining ships close ranks slightly
- **The player does not lose a life until all 3 ships in the formation are destroyed**
- If the player already has multi-ship active and collects another multi-ship powerup, destroyed ships in the formation are restored (effectively a repair)
- All other powerups apply to every ship in the active formation (e.g., dual laser applies to all surviving ships)

### 2.4 Ship Cosmetic Evolution
- The player's ship visually upgrades after each boss defeat — the silhouette stays recognizable but gains additional detail, color accents, engine glow, and visual complexity
- This is purely cosmetic — no stat changes
- Creates a visible sense of progression through a run (a player on Level 15 looks noticeably more advanced than one on Level 3)
- In multi-ship mode, all ships in the formation share the current cosmetic tier
- Approximate tiers: Base → Tier 2 (after Boss 1) → Tier 3 (after Boss 2) → Tier 4 (after Boss 3) → Tier 5 (after Boss 4) → beyond Tier 5, subtle additive effects (exhaust trails, particle auras) continue to layer on

---

## 3. Enemy System

### 3.1 Enemy Types

| Type | HP | Behavior | Powerup Drop Chance | Point Value |
|---|---|---|---|---|
| **Grunt** | 1 | Standard formation flyer, occasional dive attack | 5% | 100 |
| **Swooper** | 1 | Faster dive attacks, more erratic flight paths | 8% | 150 |
| **Tank** | 3 | Slow-moving, absorbs hits, fires back | 20% | 300 |
| **Elite** | 2 | Leads formation columns, can capture ship via tractor beam (see §3.4) | 15% | 250 |
| **Bomber** | 2 | Drops area-denial projectiles that linger briefly | 18% | 250 |
| **Carrier** | 4 | Large enemy, spawns 2 Grunts when destroyed | 30% | 400 |

### 3.2 Formation & Wave Behavior
- Each level begins with enemies flying onto screen in choreographed entry patterns (arcs, spirals, figure-eights) before settling into a grid formation at the top
- Once in formation, enemies periodically peel off solo or in small groups to dive-attack the player
- Dive frequency and speed increase with level number
- Enemies in formation sway/drift slightly (classic Galaga idle movement)
- A level is cleared when all enemies in that wave are destroyed
- **Wave patterns are deterministic per level number**

### 3.3 Difficulty Scaling (Per Level)
- Enemy count per wave increases
- Higher-HP enemy types mixed in more frequently
- Dive attack frequency increases
- Enemy projectile speed increases
- New enemy types introduced at specific level thresholds (e.g., Bombers first appear at Level 4, Carriers at Level 7)
- Enemy entry patterns become more complex
- **Difficulty mode multiplier**: Easy/Normal/Hard applies a global modifier

### 3.4 Tractor Beam / Ship Capture (Classic Mechanic)
- **Elite** enemies can deploy a tractor beam during a dive attack
- If the beam hits the player's ship, the ship is captured and pulled up to join the enemy formation
- The player loses that ship (costs a life if it's the only ship; in multi-ship mode, one ship from the formation is captured)
- The captured ship sits alongside the Elite in formation, now fighting for the enemy
- **Rescue**: If the player destroys the Elite that captured their ship (without hitting the captured ship itself), the captured ship is freed and rejoins the player as a dual-ship formation
- If the player accidentally destroys their own captured ship, it's gone — no rescue

---

## 4. Powerup System

### 4.1 Drop Mechanics
- Powerups drop from destroyed enemies based on per-type drop chance (see §3.1)
- Powerup magnet effect: gentle pull toward player (~25% screen width radius)
- Drop rate cooldown: ~8-12 seconds between drops
- Escalation modifier: +2-3% every 5 levels

### 4.2 Powerup Types

| Powerup | Weight | Duration | Effect |
|---|---|---|---|
| Dual Laser | 22% | 15s | 2 parallel lasers |
| Bomb | 18% | Stored (max 3) | Screen-clearing blast (~50% screen width) |
| Force Field | 15% | 8s | Invulnerability |
| Spread Blast | 10% | 10s | 5-6 laser fan pattern |
| Ricochet Laser | 10% | 12s | Lasers bounce off walls (3x max) |
| Speed Boost | 10% | 10s | +50% movement speed |
| Multi-Ship | 5% | Persistent | 3-ship formation |
| Time Slow | 5% | 5s | Enemies at 50% speed |

---

## 5. Boss Fights

- Boss every 3 levels (after 3, 6, 9, 12, etc.)
- Each boss mechanically distinct with multiple attack phases
- HP bar at top of screen
- Boss kill replay (slow-mo ~2-3s)
- Guaranteed powerup drop (pick 1 of 2)
- Ship cosmetic upgrade on kill
- Triggers bonus round

| Boss | After Level | HP | Key Mechanic |
|---|---|---|---|
| Boss 1 | 3 | 30 | Sweeping beam + spawns Grunts |
| Boss 2 | 6 | 50 | Rotating shield, homing projectiles |
| Boss 3 | 9 | 75 | Splits into 2 at 50% HP |
| Boss 4 | 12 | 100 | Teleports, mines, charge attack |
| Boss 5+ | 15+ | 100+25/tier | Recycled mechanics, harder combos |

---

## 6. Bonus Rounds
- After each boss defeat
- Enemies fly in scripted patterns, don't shoot back
- ~20-30 seconds duration
- Perfect bonus for 100% kills

---

## 7. Environmental Hazards

- **Nebula Zones** (Level 10+): Reduced visibility, ~30% of levels
- **Gravity Wells** (Level 13+): Bend projectile trajectories, ~25% of levels
- Both can appear simultaneously at Level 20+

---

## 8. Scoring & Progression
- Combo multiplier (up to x10, ~1.5s window)
- Extra lives every 50,000 points (max 5 stored)
- 3 lives, no continues
- Local high scores per difficulty mode (top 10)

---

## 9-14. Controls, Audio, HUD, Technical
- See full spec sections above
- Keyboard + gamepad input
- HTML5 Canvas, 60fps target, fixed timestep
- Dynamic soundtrack layering
- localStorage high scores
