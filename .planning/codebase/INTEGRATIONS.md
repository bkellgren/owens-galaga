# External Integrations

**Analysis Date:** 2026-03-15

## APIs & External Services

**None detected** - This is a self-contained game with no external API integrations. All game logic, assets, and functionality are bundled locally.

## Data Storage

**Databases:**
- None - Game does not persist data to a database

**File Storage:**
- Local browser storage only - No external file storage service used

**Caching:**
- Browser cache via standard HTTP caching headers (Vite handles this in development)

## Authentication & Identity

**Auth Provider:**
- None - No authentication system. Game is publicly accessible without login.

## Monitoring & Observability

**Error Tracking:**
- None - No error tracking service integrated

**Logs:**
- Browser console only (via `console` object in JavaScript)

## CI/CD & Deployment

**Hosting:**
- GitHub Pages (gh-pages branch)
- Repository: Configured in `.github/workflows/deploy.yml`

**CI Pipeline:**
- GitHub Actions workflow (`.github/workflows/deploy.yml`)
- Triggers: On push to `main` branch
- Steps:
  1. Checkout code (`actions/checkout@v4`)
  2. Setup Node.js 20 with npm cache (`actions/setup-node@v4`)
  3. Install dependencies (`npm ci`)
  4. Build project (`npm run build`)
  5. Configure GitHub Pages (`actions/configure-pages@v5`)
  6. Upload build artifacts to pages (`actions/upload-pages-artifact@v3`)
  7. Deploy to GitHub Pages (`actions/deploy-pages@v4`)

## Environment Configuration

**Required env vars:**
- None

**Secrets location:**
- No secrets are used in this project

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Browser APIs Utilized

**From game engine (Phaser):**
- Web Audio API - Audio playback (via AudioManager in `src/systems/AudioManager.js`)
- Gamepad API - Controller input support (enabled in game config)
- Canvas/WebGL - Rendering graphics

**No third-party SDKs or services are called from the application.**

---

*Integration audit: 2026-03-15*
