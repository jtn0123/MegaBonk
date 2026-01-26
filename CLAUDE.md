# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MegaBonk Complete Guide is a web-based reference app for the roguelike game MegaBonk. It displays game data (items, weapons, tomes, characters, shrines) with filtering, search, build planning, and breakpoint calculation features. The app is a PWA with offline support.

## Prerequisites

### Required
- **Node.js 20+** or **Bun** (Bun recommended - used by CI)
- Git

### System Dependencies (for Canvas/CV features)

**Linux/WSL:**
```bash
sudo apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

**macOS:**
```bash
brew install pkg-config cairo pango libpng jpeg giflib librsvg
```

### First-Time Setup
```bash
bun install                    # Install dependencies (bun preferred over npm)
npx playwright install         # Only needed for E2E tests
```

**Note:** This project uses Bun as its primary package manager. The `bun.lock` file is the source of truth for dependencies. While npm may work, Bun is recommended for consistency with CI.

## Common Commands

### Development Server
```bash
bun run dev               # Starts Vite dev server with hot reload (handles TypeScript)
bun run preview           # Preview production build locally
```

### Testing
```bash
bun run test:unit             # Run unit tests (sharded, handles worker crashes)
bun run test:unit:coverage    # Run unit tests with coverage report
bun run test:watch            # Watch mode for development
bun run test:e2e              # Run Playwright e2e tests
bun run test:all              # Run both unit and e2e tests
npx vitest run tests/unit/filtering.test.js  # Run single test file
```

**Note:** `bun run test` runs a different test script (scripts/test.mjs) with different coverage thresholds. Use `test:unit` for the standard test suite.

### Mobile App Build
```bash
npm run sync              # Sync Capacitor plugins
npm run android           # Sync and open Android Studio
npm run ios               # Sync and open Xcode
```

### Image Optimization
```bash
npm run optimize:images   # Convert PNG/JPG to WebP format (requires sharp)
```

## Architecture

### Data Layer (`data/`)
All game content is stored in JSON files:
- `items.json` - 77 items with scaling formulas and graphs
- `weapons.json` - 29 weapons with upgrade paths
- `tomes.json` - 23 tomes with priority rankings
- `characters.json` - 20 characters with passives
- `shrines.json` - 8 shrine types
- `stats.json` - Game mechanics formulas and breakpoints

Each JSON file has a `version` and `last_updated` field at the root level. Items/weapons/etc are in arrays under their respective keys.

### Frontend (`src/`)
Single-page app with TypeScript (built via Vite):
- `index.html` - Main interface with tab navigation
- `script.ts` - Main entry point, imports modules
- `styles.css` - Dark theme styling with rarity color system
- `manifest.json` - PWA manifest
- `modules/` - 57+ TypeScript modules organized by feature:
  - **Core**: `data-service.ts`, `store.ts`, `events.ts`, `filters.ts`, `utils.ts`
  - **UI**: `renderers.ts`, `modal.ts`, `toast.ts`, `theme-manager.ts`, `skeleton-loader.ts`
  - **Features**: `build-planner.ts`, `calculator.ts`, `compare.ts`, `advisor.ts`, `synergy.ts`
  - **CV/OCR**: 29 modules in `cv/` subdirectory for screenshot recognition
  - **Infrastructure**: `logger.ts`, `error-boundary.ts`, `dom-cache.ts`, `web-vitals.ts`

### Key Global State
```javascript
allData = { items, weapons, tomes, characters, shrines, stats }  // Loaded JSON data
currentTab = 'items'                                              // Active tab
currentBuild = { character, weapon, tomes: [], items: [] }       // Build planner state
compareItems = []                                                 // Compare mode selections
```

### Testing (`tests/`)
- `tests/unit/` - 120+ Vitest unit tests with jsdom
- `tests/e2e/` - 20+ Playwright browser tests
- `tests/integration/` - Cross-module integration tests
- `tests/fixtures/` - Sample JSON data for tests
- `tests/helpers/` - DOM setup and mock utilities
- `tests/desktop-only/` - Heavy tests requiring canvas/native deps (skipped in CI)
- `test-images/gameplay/` - Real screenshots for CV testing with ground-truth.json

Coverage thresholds: 60% statements/functions/lines, 55% branches.

### CV/OCR Testing
```bash
npm run test:cv:real      # Run real image CV tests (requires canvas)
npm run test:cv:offline   # Run offline CV runner
npm run test:recognition  # Run all OCR/CV related tests
```

**Important:** The `canvas` module requires native bindings and may need additional setup on some platforms.

## Content Updates

When game data changes, edit the JSON files directly in `data/`. The web app reads these at runtime - no build step required. See `docs/UPDATE_GUIDE.md` for field documentation.

## Rarity/Tier System

Rarities: common, uncommon, rare, epic, legendary
Tiers: SS (game-breaking), S (excellent), A (strong), B (situational), C (weak)
