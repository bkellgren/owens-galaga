# Owen's Galaga

A browser-based arcade space shooter inspired by the classic 1981 Galaga. Built with Phaser 3 and rendered entirely with procedurally generated sprites and synthesized audio — no external assets required.

## Play

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Works in any modern desktop browser.

### Controls

| Action       | Keyboard           | Gamepad              |
|--------------|--------------------|-----------------------|
| Move         | Arrow keys / A, D  | Left stick / D-pad    |
| Fire         | Space / Z          | A / X button          |
| Bomb         | X / B              | B / Y button          |
| Pokéball     | C                  | Y button              |
| Pause        | P / Escape         | Start                 |
| Fullscreen   | F                  | —                     |
| Toggle audio | M                  | —                     |

Hold the fire button for ~1.5 seconds to charge a piercing beam that deals 3x damage.

## Features

- **Endless progression** — levels recycle and scale indefinitely across three difficulty modes (Easy, Normal, Hard)
- **6 enemy types** — Grunts, Swoopers, Tanks, Elites (with tractor beam capture), Bombers, and Carriers that spawn minions on death
- **8 powerups** — Dual Laser, Bombs, Force Field, Spread Blast, Ricochet Laser, Speed Boost, Multi-Ship formation, and Time Slow
- **2 new powerups** — Heat-Seeking Bullets (all shots home in on enemies) and Pokéball Summon (Charmander, Bulbasaur, or Squirtle fight for you)
- **Boss fights** every 3 levels with unique multi-phase attack patterns
- **Bonus rounds** after each boss for extra scoring
- **Combo multiplier** up to x10 with a 1.5-second kill window
- **Environmental hazards** — Nebula Zones (reduced visibility) and Gravity Wells (bent projectiles) starting at higher levels
- **Ship cosmetic evolution** — visual upgrades after each boss defeat
- **Gamepad support** alongside keyboard controls
- **Fullscreen mode** — press F or click the fullscreen button
- **Share score screenshots** — capture and share your results from the Game Over screen
- **Local high scores** per difficulty mode

## Tech Stack

- **[Phaser 3](https://phaser.io/)** — game framework with Arcade physics
- **[Vite](https://vite.dev/)** — dev server and bundler
- **Web Audio API** — synthesized sound effects and music
- **Zero external assets** — all sprites and audio are generated at runtime

## Build

```bash
npm run build     # Production build to dist/
npm run preview   # Preview the built version
```

## Project Structure

```
src/
├── main.js                  # Phaser config & entry point
├── constants.js             # Game-wide tuning values
├── entities/
│   └── Player.js            # Player ship movement, firing, multi-ship
├── scenes/
│   ├── BootScene.js         # Procedural asset generation & loading
│   ├── MenuScene.js         # Title screen & high scores
│   ├── DifficultySelectScene.js
│   ├── GameScene.js         # Core gameplay loop
│   ├── BonusRoundScene.js   # Post-boss bonus rounds
│   └── GameOverScene.js     # Results & stats
└── systems/
    ├── WaveGenerator.js     # Deterministic level & wave generation
    ├── EnemyFormation.js    # Formation AI & dive patterns
    ├── PowerupManager.js    # Drop logic & magnet effect
    ├── HUD.js               # Score, lives, level display
    ├── StarField.js         # Parallax starfield background
    ├── EnvironmentalHazards.js  # Nebula zones & gravity wells
    └── AudioManager.js      # Synthesized sound & music
```

## License

MIT — see [LICENSE](LICENSE) for details.
