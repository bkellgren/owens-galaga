# Technology Stack

**Analysis Date:** 2026-03-15

## Languages

**Primary:**
- JavaScript (ES6+) - Game logic, scenes, systems, entities, all application code

## Runtime

**Environment:**
- Node.js 20+ (used in CI/CD; development can run on v24.13.0)

**Package Manager:**
- npm 11.6.2
- Lockfile: Present (`package-lock.json`)

## Frameworks

**Core:**
- Phaser 3.90.0 - 2D game framework for game logic, physics, rendering, input handling, and audio

**Build/Dev:**
- Vite 8.0.0 - Build tool and development server for bundling and hot reload

## Key Dependencies

**Critical:**
- Phaser 3.90.0 - The entire game engine. Handles scene management, sprite rendering, physics simulation (arcade), input devices (keyboard, gamepad), audio playback, animations, and collision detection. Located at `src/main.js` configuration and imported throughout `src/scenes/` and `src/systems/`.

**Build Dependencies:**
- Vite 8.0.0 - Provides development server via `npm run dev`, production builds via `npm run build`, and preview via `npm run preview`

## Configuration

**Environment:**
- No environment variables required
- Configuration is code-driven in `src/main.js` and `vite.config.js`

**Build:**
- `vite.config.js` - Minimal Vite config with relative base path (`base: './'`) for GitHub Pages deployment

**Entry Points:**
- `index.html` - HTML entry point that loads `/src/main.js` as ES module
- `src/main.js` - Creates Phaser Game instance with config and scene definitions

## Platform Requirements

**Development:**
- Node.js 20+
- npm 11.6.2+
- Modern web browser supporting ES6 modules
- Gamepad support for optional controller input (via Phaser's gamepad plugin)

**Production:**
- GitHub Pages (deployed to `gh-pages` branch)
- Builds to `dist/` directory
- Static hosting only (no backend required)

## Scripts

**Development:**
- `npm run dev` - Start Vite dev server with hot reload

**Build:**
- `npm run build` - Create optimized production build in `dist/`
- `npm run preview` - Preview built assets locally

**Deployment:**
- GitHub Actions CI/CD (`.github/workflows/deploy.yml`) automatically builds on push to main and deploys to GitHub Pages

## Browser APIs Used

**From main game config (`src/main.js`):**
- WebGL/Canvas rendering (via Phaser.AUTO)
- Gamepad API (keyboard and gamepad input)
- Web Audio API (via Phaser's audio system)
- RequestAnimationFrame (frame-based game loop)

---

*Stack analysis: 2026-03-15*
