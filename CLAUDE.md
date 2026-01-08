# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MegaBonk Complete Guide is a web-based reference app for the roguelike game MegaBonk. It displays game data (items, weapons, tomes, characters, shrines) with filtering, search, build planning, and breakpoint calculation features. The app is a PWA with offline support.

## Common Commands

### Development Server
```bash
python3 serve.py          # Starts local server at http://localhost:8000 with QR code for mobile
```

### Testing
```bash
bun test                  # Run unit tests with vitest (watch mode)
bun run test:unit         # Run unit tests once with coverage
bun run test:e2e          # Run Playwright e2e tests
bun run test:all          # Run both unit and e2e tests
bunx vitest run tests/unit/filtering.test.js  # Run single test file
```

### Mobile App Build
```bash
bun run sync              # Sync Capacitor plugins
bun run android           # Sync and open Android Studio
bun run ios               # Sync and open Xcode
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
Single-page app with vanilla JavaScript:
- `index.html` - Main interface with tab navigation
- `script.js` - All app logic (~1000+ lines): data loading, filtering, search, build planner, breakpoint calculator, compare mode
- `styles.css` - Dark theme styling with rarity color system
- `sw.js` - Service worker for offline caching
- `manifest.json` - PWA manifest
- `libs/chart.min.js` - Chart.js for scaling graphs (bundled locally)

### Key Global State in script.js
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

Coverage thresholds: 70% statements/functions/lines, 60% branches.

## Content Updates

When game data changes, edit the JSON files directly in `data/`. The web app reads these at runtime - no build step required. See `docs/UPDATE_GUIDE.md` for field documentation.

## Rarity/Tier System

Rarities: common, uncommon, rare, epic, legendary
Tiers: SS (game-breaking), S (excellent), A (strong), B (situational), C (weak)
