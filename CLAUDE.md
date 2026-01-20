# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MegaBonk Complete Guide is a web-based reference app for the roguelike game MegaBonk. It displays game data (items, weapons, tomes, characters, shrines) with filtering, search, build planning, and breakpoint calculation features. The app is a PWA with offline support.

## Common Commands

### Development Server
```bash
npm run dev               # Starts Vite dev server with hot reload (handles TypeScript)
npm run preview           # Preview production build locally
```

### Testing
```bash
npm test                  # Run unit tests with vitest (watch mode)
npm run test:unit         # Run unit tests once with coverage
npm run test:e2e          # Run Playwright e2e tests (requires: npx playwright install)
npm run test:all          # Run both unit and e2e tests
npx vitest run tests/unit/filtering.test.js  # Run single test file
```

**First-time setup:** Run `npx playwright install` to download browser binaries for E2E tests.

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
- `modules/` - TypeScript modules for data loading, filtering, search, build planner, breakpoint calculator, compare mode
- `styles.css` - Dark theme styling with rarity color system
- `manifest.json` - PWA manifest

### Key Global State
```javascript
allData = { items, weapons, tomes, characters, shrines, stats }  // Loaded JSON data
currentTab = 'items'                                              // Active tab
currentBuild = { character, weapon, tomes: [], items: [] }       // Build planner state
compareItems = []                                                 // Compare mode selections
```

### Testing (`tests/`)
- `tests/unit/` - Vitest unit tests with jsdom
- `tests/e2e/` - Playwright browser tests
- `tests/fixtures/` - Sample JSON data for tests
- `tests/helpers/` - DOM setup and mock utilities
- `test-images/gameplay/` - Real screenshots for CV testing with ground-truth.json

Coverage thresholds: 70% statements/functions/lines, 60% branches.

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
