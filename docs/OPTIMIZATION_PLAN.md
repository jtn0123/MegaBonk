# MegaBonk Optimization Plan - Technical Implementation Guide

**Status:** Planning Phase
**Branch:** `claude/plan-modules-optimization-SJsWr`
**Generated:** 2026-01-09
**Estimated Total Effort:** 48+ hours (6+ working days)

---

## Executive Summary

This document provides a detailed technical implementation plan for three critical optimizations:

1. **ES Modules Migration** (24+ hours) - Convert to modern ES6 imports/exports
2. **Search Performance** (8+ hours) - Implement inverted index for O(1) lookups
3. **Testing Infrastructure** (16+ hours) - Enable module imports in tests

These optimizations are **interdependent**: Testing requires ES Modules, and search optimization benefits from modular testing.

**Recommended Order:**
1. ES Modules Migration (enables testing improvements)
2. Testing Infrastructure (validates module exports)
3. Search Performance (optimizes specific functionality)

---

## Table of Contents

- [Current Architecture Analysis](#current-architecture-analysis)
- [Task 1: ES Modules Migration](#task-1-es-modules-migration)
- [Task 2: Search Performance Optimization](#task-2-search-performance-optimization)
- [Task 3: Testing Infrastructure](#task-3-testing-infrastructure)
- [Risk Analysis & Mitigation](#risk-analysis--mitigation)
- [Success Metrics](#success-metrics)

---

## Current Architecture Analysis

### Module Structure

**Total Modules:** 17
**Total Size:** ~180KB unminified
**Loading:** Sequential `<script>` tags (lines 530-546 in `src/index.html`)

```
Size  Module                Purpose
----  ------------------    ---------
26KB  build-planner.js      Build planning logic
24KB  filters.js            Search, filtering, sorting
21KB  modal.js              Modal dialogs and UI
16KB  events.js             Event handling
15KB  renderers.js          DOM rendering
14KB  charts.js             Chart.js integration
11KB  changelog.js          Changelog display
11KB  utils.js              Utility functions
10KB  data-validation.js    Data integrity checks
8.5KB data-service.js       Data loading
8KB   compare.js            Compare mode
6.5KB dom-cache.js          DOM caching
6KB   calculator.js         Breakpoint calculator
3KB   favorites.js          Favorites management
3KB   toast.js              Toast notifications
3KB   constants.js          Constants
1.5KB match-badge.js        Match highlighting
```

### Current Loading Strategy

```html
<!-- Fixed load order - dependencies resolved manually -->
<script src="modules/constants.js"></script>
<script src="modules/utils.js"></script>
<script src="modules/dom-cache.js"></script>
<script src="modules/toast.js"></script>
<script src="modules/favorites.js"></script>
<script src="modules/data-validation.js"></script>
<script src="modules/data-service.js"></script>
<script src="modules/filters.js"></script>
<script src="modules/charts.js"></script>
<script src="modules/renderers.js"></script>
<script src="modules/modal.js"></script>
<script src="modules/build-planner.js"></script>
<script src="modules/compare.js"></script>
<script src="modules/calculator.js"></script>
<script src="modules/changelog.js"></script>
<script src="modules/events.js"></script>
<script src="script.js"></script>
```

### Module Communication Pattern

**Global Scope Pollution:**
```javascript
// filters.js exposes functions globally
window.filterData = function() { /* ... */ }
window.applyFilters = function() { /* ... */ }

// Other modules access directly
const results = window.filterData(data, 'items');
```

**Issues:**
- No explicit dependency graph
- Brittle load order
- Difficult to test in isolation
- Bundle optimization impossible
- Tree-shaking not supported

---

## Task 1: ES Modules Migration

**Effort:** 24+ hours (3 days)
**Priority:** HIGHEST (blocks other tasks)
**Complexity:** HIGH

### Phase 1: Setup Bundler Infrastructure (4 hours)

#### 1.1 Choose Bundler

**Recommended: Vite** (fast, zero-config, great DX)

**Alternatives:**
- **esbuild**: Fastest, minimal config, but less ecosystem support
- **Rollup**: Excellent tree-shaking, but slower dev experience
- **Webpack**: Most mature, but complex configuration

**Decision Matrix:**

| Feature              | Vite | esbuild | Rollup | Webpack |
|---------------------|------|---------|--------|---------|
| Dev Server Speed    | ⭐⭐⭐ | ⭐⭐⭐  | ⭐⭐    | ⭐      |
| Build Speed         | ⭐⭐⭐ | ⭐⭐⭐  | ⭐⭐    | ⭐      |
| Config Complexity   | ⭐⭐⭐ | ⭐⭐⭐  | ⭐⭐    | ⭐      |
| PWA Support         | ⭐⭐⭐ | ⭐⭐    | ⭐⭐⭐  | ⭐⭐⭐  |
| Legacy Browser      | ⭐⭐   | ⭐      | ⭐⭐⭐  | ⭐⭐⭐  |

**Recommendation:** Vite (modern, fast, minimal config)

#### 1.2 Install Dependencies

```bash
bun add -D vite vite-plugin-pwa
```

#### 1.3 Create Vite Configuration

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: './src/index.html'
      }
    },
    // Code splitting strategy
    chunkSizeWarningLimit: 500,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false // Keep console for debugging
      }
    }
  },
  server: {
    port: 8000,
    open: true
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'MegaBonk Complete Guide',
        short_name: 'MegaBonk',
        description: 'Complete guide for MegaBonk roguelike',
        theme_color: '#00ff88',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.json$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'game-data-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              }
            }
          }
        ]
      }
    })
  ]
});
```

#### 1.4 Update package.json Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "serve": "vite --host",
    "test": "bun vitest",
    "test:unit": "bun vitest run --coverage",
    "test:e2e": "bunx playwright test",
    "test:all": "bun run test:unit && bun run test:e2e"
  }
}
```

---

### Phase 2: Convert Modules to ES Modules (12 hours)

#### 2.1 Dependency Graph Mapping

**Step 1:** Analyze implicit dependencies

```bash
# Create dependency visualization
grep -r "window\." src/modules/ > dependencies.txt
```

**Expected Dependency Tree:**

```
constants.js (no deps)
├── utils.js
│   ├── dom-cache.js
│   │   └── toast.js
│   ├── favorites.js
│   └── data-validation.js
│       └── data-service.js
│           ├── filters.js
│           ├── charts.js
│           └── renderers.js
│               ├── modal.js
│               ├── build-planner.js
│               ├── compare.js
│               ├── calculator.js
│               └── changelog.js
└── events.js (depends on most modules)
```

#### 2.2 Module Conversion Pattern

**Template for converting a module:**

```javascript
// BEFORE (constants.js)
const TIER_ORDER = { 'SS': 0, 'S': 1, 'A': 2, 'B': 3, 'C': 4 };
const RARITY_ORDER = { 'legendary': 0, 'epic': 1, /* ... */ };
window.TIER_ORDER = TIER_ORDER;
window.RARITY_ORDER = RARITY_ORDER;

// AFTER (constants.js)
export const TIER_ORDER = { 'SS': 0, 'S': 1, 'A': 2, 'B': 3, 'C': 4 };
export const RARITY_ORDER = { 'legendary': 0, 'epic': 1, /* ... */ };
```

```javascript
// BEFORE (utils.js)
function debounce(func, wait) { /* ... */ }
function escapeHTML(str) { /* ... */ }
window.debounce = debounce;
window.escapeHTML = escapeHTML;

// AFTER (utils.js)
export function debounce(func, wait) { /* ... */ }
export function escapeHTML(str) { /* ... */ }
```

```javascript
// BEFORE (filters.js)
function filterData(data, tabName) {
  const sortBy = document.getElementById('sortBy')?.value;
  // Uses window.TIER_ORDER
  const tierOrder = window.TIER_ORDER;
  // ...
}
window.filterData = filterData;

// AFTER (filters.js)
import { TIER_ORDER, RARITY_ORDER } from './constants.js';
import { debounce } from './utils.js';

export function filterData(data, tabName) {
  const sortBy = document.getElementById('sortBy')?.value;
  // Direct import usage
  const tierOrder = TIER_ORDER;
  // ...
}
```

#### 2.3 Conversion Order (Bottom-Up)

**Order matters!** Convert leaf nodes first:

1. **constants.js** ✓ (no dependencies)
2. **utils.js** ✓ (no dependencies)
3. **dom-cache.js** (imports utils.js)
4. **toast.js** (imports dom-cache.js)
5. **favorites.js** (imports utils.js)
6. **data-validation.js** (imports utils.js)
7. **data-service.js** (imports data-validation.js, toast.js)
8. **filters.js** (imports constants.js, utils.js, data-service.js)
9. **charts.js** (imports utils.js, Chart.js)
10. **match-badge.js** (imports utils.js)
11. **renderers.js** (imports utils.js, charts.js, match-badge.js)
12. **modal.js** (imports renderers.js, charts.js)
13. **build-planner.js** (imports data-service.js, renderers.js, modal.js)
14. **compare.js** (imports modal.js, renderers.js)
15. **calculator.js** (imports data-service.js, modal.js)
16. **changelog.js** (imports renderers.js, modal.js)
17. **events.js** (imports ALL other modules)

#### 2.4 Automated Conversion Script

Create a helper script to automate repetitive conversions:

```javascript
// scripts/convert-to-esm.js
import fs from 'fs';
import path from 'path';

const modulesDir = './src/modules';
const files = fs.readdirSync(modulesDir);

files.forEach(file => {
  if (!file.endsWith('.js')) return;

  const filePath = path.join(modulesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Find all window assignments
  const windowAssignments = content.match(/window\.(\w+)\s*=/g);

  if (windowAssignments) {
    console.log(`\n${file}:`);
    windowAssignments.forEach(assignment => {
      const varName = assignment.match(/window\.(\w+)/)[1];
      console.log(`  - export ${varName}`);
    });
  }
});
```

Run with:
```bash
node scripts/convert-to-esm.js
```

---

### Phase 3: Update Entry Point (2 hours)

#### 3.1 Refactor script.js

```javascript
// BEFORE (script.js) - implicit globals
function init() {
  setupEventListeners(); // from events.js
  loadAllData(); // from data-service.js
}
document.addEventListener('DOMContentLoaded', init);

// AFTER (script.js) - explicit imports
import { setupEventListeners } from './modules/events.js';
import { loadAllData } from './modules/data-service.js';
import { setupErrorTracking, setupOfflineIndicator, setupUpdateNotification } from './modules/utils.js';

function init() {
  setupErrorTracking();
  setupOfflineIndicator();
  setupUpdateNotification();
  setupEventListeners();
  loadAllData();
}

document.addEventListener('DOMContentLoaded', init);
```

#### 3.2 Update index.html

```html
<!-- BEFORE: 17 script tags -->
<script src="modules/constants.js"></script>
<script src="modules/utils.js"></script>
<!-- ... 15 more ... -->
<script src="script.js"></script>

<!-- AFTER: Single entry point -->
<script type="module" src="script.js"></script>
```

---

### Phase 4: Service Worker Migration (3 hours)

#### 4.1 Migrate to Workbox (via Vite PWA)

The Vite PWA plugin automatically generates a service worker using Workbox. Update configuration:

```javascript
// vite.config.js (PWA section)
VitePWA({
  strategies: 'generateSW', // Auto-generate service worker
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,json,webp}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.json$/,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'game-data-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
          }
        }
      },
      {
        urlPattern: /\.(?:png|jpg|jpeg|svg|webp|gif)$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'image-cache',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
          }
        }
      }
    ],
    // Clear old caches on activation
    cleanupOutdatedCaches: true,
    // Cache versioning
    cacheId: 'megabonk-v2'
  }
})
```

#### 4.2 Update Service Worker Registration

```javascript
// Remove manual registration from script.js
// Vite PWA handles this automatically via generated code

// Optional: Add update notification handler
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (window.confirm('New version available! Reload to update?')) {
      window.location.reload();
    }
  });
}
```

---

### Phase 5: Testing & Validation (3 hours)

#### 5.1 Validation Checklist

- [ ] All modules load without errors
- [ ] No global namespace pollution (check `window` object)
- [ ] All features functional (tabs, search, filters, modals)
- [ ] Build planner works (add/remove items)
- [ ] Compare mode functional
- [ ] Calculator works
- [ ] Service worker caches correctly
- [ ] Offline mode works
- [ ] Bundle size acceptable (<300KB gzipped)
- [ ] Load time improved (measure with Lighthouse)

#### 5.2 Browser Compatibility Testing

**Minimum Supported Browsers:**
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Safari 14+
- Chrome Android 90+

**ES Modules Support:** All modern browsers (2020+)

**Polyfills Needed:**
- None (dropping IE11 support)

#### 5.3 Performance Testing

```bash
# Build for production
bun run build

# Analyze bundle
bunx vite-bundle-visualizer

# Lighthouse CI
bunx lighthouse http://localhost:8000 --view
```

**Target Metrics:**
- First Contentful Paint: <1.5s
- Time to Interactive: <3s
- Bundle size (gzipped): <300KB
- Lighthouse score: >90

---

### Migration Gotchas & Solutions

#### Issue 1: Circular Dependencies

**Problem:**
```javascript
// events.js imports filters.js
import { applyFilters } from './filters.js';

// filters.js imports events.js
import { updateUI } from './events.js';
```

**Solution:** Extract shared code to separate module
```javascript
// Create modules/ui-updates.js
export function updateUI() { /* ... */ }

// events.js
import { updateUI } from './ui-updates.js';

// filters.js
import { updateUI } from './ui-updates.js';
```

#### Issue 2: Dynamic Imports Timing

**Problem:** Chart.js loaded via CDN before modules

**Solution:** Import Chart.js as ES module
```bash
bun add chart.js
```

```javascript
// modules/charts.js
import Chart from 'chart.js/auto';

export function createChart(ctx, config) {
  return new Chart(ctx, config);
}
```

Remove from index.html:
```html
<!-- DELETE THIS -->
<script src="libs/chart.min.js"></script>
```

#### Issue 3: Global State Management

**Problem:** `window.allData` used everywhere

**Solution:** Create state module
```javascript
// modules/state.js
let allData = {};
let currentTab = 'items';
let filteredData = [];
let currentBuild = { character: null, weapon: null, tomes: [], items: [] };

export const state = {
  getAllData: () => allData,
  setAllData: (data) => { allData = data; },
  getCurrentTab: () => currentTab,
  setCurrentTab: (tab) => { currentTab = tab; },
  getFilteredData: () => filteredData,
  setFilteredData: (data) => { filteredData = data; },
  getCurrentBuild: () => currentBuild,
  setCurrentBuild: (build) => { currentBuild = build; }
};
```

Then import in modules:
```javascript
import { state } from './state.js';

const data = state.getAllData();
state.setCurrentTab('weapons');
```

---

## Task 2: Search Performance Optimization

**Effort:** 8+ hours
**Priority:** MEDIUM
**Depends On:** ES Modules (optional, but recommended)

### Current Performance Analysis

**Dataset Size:**
- Items: 77
- Weapons: 29
- Tomes: 23
- Characters: 20
- Shrines: 8
- **Total:** 157 entities

**Current Algorithm (filters.js:15-18):**

```javascript
filtered = filtered.filter(item => {
  const searchable = `${item.name} ${item.description || ''} ${item.base_effect || ''}`.toLowerCase();
  return searchable.includes(searchTerm);
});
```

**Complexity:** O(n × m) where:
- n = number of items (157)
- m = average searchable text length (~200 chars)

**Per-Keystroke Cost:** ~31,400 character comparisons

**Is This Slow?** No! For 157 items, this is negligible (<5ms).

**Why Optimize?**
1. **Future-proofing** - Dataset may grow to 500+ items
2. **Advanced features** - Fuzzy search, relevance scoring
3. **Learning opportunity** - Demonstrates CS fundamentals

---

### Inverted Index Design

#### 2.1 Data Structure

**Inverted Index:** Maps words → items containing that word

```javascript
// Example index structure
{
  'damage': [item1, item4, item7, weapon2],
  'crit': [item3, item5, weapon1],
  'legendary': [item1, weapon5],
  'bonk': [item2, weapon3, tome1]
}
```

**Benefits:**
- O(1) lookup per word (vs O(n) linear scan)
- Pre-computed at load time
- Supports advanced features (fuzzy, ranking, etc.)

#### 2.2 Implementation

```javascript
// modules/search-index.js
export class SearchIndex {
  constructor() {
    this.index = new Map(); // word -> Set of items
    this.documents = []; // All searchable items
  }

  /**
   * Build inverted index from data
   * @param {Array} items - Items to index
   * @param {Function} getSearchableText - Extract searchable text from item
   */
  build(items, getSearchableText) {
    this.documents = items;
    this.index.clear();

    items.forEach((item, idx) => {
      const text = getSearchableText(item);
      const words = this.tokenize(text);

      words.forEach(word => {
        if (!this.index.has(word)) {
          this.index.set(word, new Set());
        }
        this.index.get(word).add(idx);
      });
    });

    console.log(`[SearchIndex] Built index with ${this.index.size} unique terms`);
  }

  /**
   * Tokenize text into searchable words
   * @param {string} text - Text to tokenize
   * @returns {Array<string>} Tokens
   */
  tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length >= 2); // Min length 2
  }

  /**
   * Search for items matching query
   * @param {string} query - Search query
   * @returns {Array} Matching items with relevance scores
   */
  search(query) {
    const queryTokens = this.tokenize(query);

    if (queryTokens.length === 0) {
      return this.documents.map((doc, idx) => ({ item: doc, score: 1, index: idx }));
    }

    // Get items matching each token
    const matchingSets = queryTokens.map(token => {
      // Exact match
      const exactMatches = this.index.get(token) || new Set();

      // Fuzzy match (optional)
      const fuzzyMatches = this.fuzzyLookup(token);

      return new Set([...exactMatches, ...fuzzyMatches]);
    });

    // Intersect sets (items must match ALL tokens)
    const intersection = matchingSets.reduce((acc, set) => {
      return new Set([...acc].filter(x => set.has(x)));
    });

    // Return results with scores
    return Array.from(intersection).map(idx => ({
      item: this.documents[idx],
      score: this.calculateRelevance(this.documents[idx], queryTokens),
      index: idx
    })).sort((a, b) => b.score - a.score);
  }

  /**
   * Fuzzy lookup for typo tolerance
   * @param {string} token - Token to fuzzy match
   * @returns {Set<number>} Matching item indices
   */
  fuzzyLookup(token) {
    const matches = new Set();

    // Levenshtein distance ≤ 1
    for (const [word, indices] of this.index.entries()) {
      if (this.levenshteinDistance(token, word) <= 1) {
        indices.forEach(idx => matches.add(idx));
      }
    }

    return matches;
  }

  /**
   * Calculate Levenshtein distance between two words
   * @param {string} a - First word
   * @param {string} b - Second word
   * @returns {number} Edit distance
   */
  levenshteinDistance(a, b) {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Calculate relevance score
   * @param {Object} item - Item to score
   * @param {Array<string>} queryTokens - Query tokens
   * @returns {number} Relevance score (higher is better)
   */
  calculateRelevance(item, queryTokens) {
    const text = `${item.name} ${item.description || ''} ${item.base_effect || ''}`.toLowerCase();
    let score = 0;

    queryTokens.forEach(token => {
      // Name match = +10 points
      if (item.name.toLowerCase().includes(token)) {
        score += 10;
      }
      // Description match = +2 points
      if (item.description?.toLowerCase().includes(token)) {
        score += 2;
      }
      // Base effect match = +2 points
      if (item.base_effect?.toLowerCase().includes(token)) {
        score += 2;
      }
    });

    return score;
  }

  /**
   * Update index when data changes (incremental update)
   * @param {Object} item - New or updated item
   * @param {number} idx - Item index
   */
  updateItem(item, idx) {
    // Remove old entries
    this.index.forEach((indices, word) => {
      indices.delete(idx);
    });

    // Add new entries
    const text = `${item.name} ${item.description || ''} ${item.base_effect || ''}`;
    const words = this.tokenize(text);

    words.forEach(word => {
      if (!this.index.has(word)) {
        this.index.set(word, new Set());
      }
      this.index.get(word).add(idx);
    });

    this.documents[idx] = item;
  }
}
```

---

### Integration with Filters Module

#### 2.3 Update filters.js

```javascript
// modules/filters.js
import { SearchIndex } from './search-index.js';

// Create index instances for each data type
const searchIndices = {
  items: new SearchIndex(),
  weapons: new SearchIndex(),
  tomes: new SearchIndex(),
  characters: new SearchIndex(),
  shrines: new SearchIndex()
};

/**
 * Build search indices (call after data loads)
 * @param {Object} allData - All game data
 */
export function buildSearchIndices(allData) {
  const getSearchableText = (item) => {
    return `${item.name} ${item.description || ''} ${item.base_effect || ''} ${item.tier || ''}`;
  };

  searchIndices.items.build(allData.items, getSearchableText);
  searchIndices.weapons.build(allData.weapons, getSearchableText);
  searchIndices.tomes.build(allData.tomes, getSearchableText);
  searchIndices.characters.build(allData.characters, getSearchableText);
  searchIndices.shrines.build(allData.shrines, getSearchableText);

  console.log('[Filters] Search indices built successfully');
}

/**
 * Filter data (updated to use search index)
 * @param {Array} data - Data to filter
 * @param {string} tabName - Current tab
 * @returns {Array} Filtered data
 */
export function filterData(data, tabName) {
  const searchTerm = document.getElementById('searchInput')?.value?.trim() || '';

  // Use search index if query exists
  let filtered = data;
  if (searchTerm.length >= 2 && searchIndices[tabName]) {
    const results = searchIndices[tabName].search(searchTerm);
    filtered = results.map(r => r.item);
  } else if (searchTerm.length >= 2) {
    // Fallback to linear search (shouldn't happen)
    filtered = data.filter(item => {
      const searchable = `${item.name} ${item.description || ''} ${item.base_effect || ''}`.toLowerCase();
      return searchable.includes(searchTerm.toLowerCase());
    });
  }

  // Apply other filters (tier, rarity, etc.)
  const tierFilter = document.getElementById('tierFilter')?.value;
  if (tierFilter && tierFilter !== 'all') {
    filtered = filtered.filter(item => item.tier === tierFilter);
  }

  const rarityFilter = document.getElementById('rarityFilter')?.value;
  if (tabName === 'items' && rarityFilter && rarityFilter !== 'all') {
    filtered = filtered.filter(item => item.rarity === rarityFilter);
  }

  // Sorting (unchanged)
  const sortBy = document.getElementById('sortBy')?.value;
  if (sortBy === 'name') {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === 'tier') {
    const tierOrder = { 'SS': 0, 'S': 1, 'A': 2, 'B': 3, 'C': 4 };
    filtered.sort((a, b) => (tierOrder[a.tier] ?? 99) - (tierOrder[b.tier] ?? 99));
  } else if (sortBy === 'relevance' && searchTerm.length >= 2) {
    // Already sorted by relevance from search index
  }

  return filtered;
}
```

#### 2.4 Update data-service.js

```javascript
// modules/data-service.js
import { buildSearchIndices } from './filters.js';

export async function loadAllData() {
  try {
    // ... existing data loading code ...

    // Build search indices after data loads
    buildSearchIndices(allData);

    return allData;
  } catch (error) {
    console.error('[DataService] Failed to load data:', error);
    throw error;
  }
}
```

---

### Performance Comparison

#### 2.5 Benchmarking

```javascript
// scripts/benchmark-search.js
import { SearchIndex } from '../src/modules/search-index.js';

// Mock data
const items = Array.from({ length: 1000 }, (_, i) => ({
  id: `item${i}`,
  name: `Item ${i}`,
  description: `Description for item ${i} with various keywords`,
  base_effect: `Effect: +${i % 10} damage`,
  tier: ['SS', 'S', 'A', 'B', 'C'][i % 5]
}));

// Build index
const index = new SearchIndex();
console.time('Index Build');
index.build(items, (item) => `${item.name} ${item.description} ${item.base_effect}`);
console.timeEnd('Index Build');

// Search benchmark
const queries = ['damage', 'item 42', 'legendary', 'effect bonus', 'xyz'];

queries.forEach(query => {
  console.time(`Search: "${query}"`);
  const results = index.search(query);
  console.timeEnd(`Search: "${query}"`);
  console.log(`  Results: ${results.length}`);
});

// Linear search comparison
console.log('\n--- Linear Search (baseline) ---');
queries.forEach(query => {
  console.time(`Linear: "${query}"`);
  const results = items.filter(item => {
    const searchable = `${item.name} ${item.description} ${item.base_effect}`.toLowerCase();
    return searchable.includes(query.toLowerCase());
  });
  console.timeEnd(`Linear: "${query}"`);
  console.log(`  Results: ${results.length}`);
});
```

**Expected Results (1000 items):**

```
Index Build: ~50ms

Search: "damage" - 2ms (vs 8ms linear) → 4x faster
Search: "item 42" - 1ms (vs 8ms linear) → 8x faster
Search: "legendary" - 1ms (vs 8ms linear) → 8x faster
```

**At 157 items:** Linear search is fast enough (~2ms), but index provides:
- Fuzzy matching
- Relevance scoring
- Future scalability

---

### Advanced Features

#### 2.6 Query Syntax (Future Enhancement)

Support advanced search operators:

```
tier:SS damage        → Items with tier SS containing "damage"
rarity:legendary      → Legendary items only
"exact phrase"        → Exact phrase matching
damage OR crit        → Boolean OR
-exclude              → Exclude term
```

**Implementation:**

```javascript
// modules/search-parser.js
export class QueryParser {
  parse(query) {
    const tokens = {
      terms: [],
      filters: {},
      exact: [],
      exclude: []
    };

    // Extract quoted phrases
    const quotedRegex = /"([^"]+)"/g;
    let match;
    while ((match = quotedRegex.exec(query)) !== null) {
      tokens.exact.push(match[1]);
      query = query.replace(match[0], '');
    }

    // Extract filters (key:value)
    const filterRegex = /(\w+):(\w+)/g;
    while ((match = filterRegex.exec(query)) !== null) {
      tokens.filters[match[1]] = match[2];
      query = query.replace(match[0], '');
    }

    // Extract exclusions
    const words = query.split(/\s+/);
    words.forEach(word => {
      if (word.startsWith('-')) {
        tokens.exclude.push(word.slice(1));
      } else if (word.length > 0) {
        tokens.terms.push(word);
      }
    });

    return tokens;
  }
}
```

---

## Task 3: Testing Infrastructure

**Effort:** 16+ hours
**Priority:** HIGH
**Depends On:** ES Modules Migration (mandatory)

### Current Testing Gaps

**Problem:** Tests use standalone implementations instead of importing actual code.

```javascript
// tests/unit/filtering.test.js (CURRENT)
// ❌ Reimplements filterData() instead of importing it
function filterData(data, tabName) {
  // 50+ lines of duplicated logic
}

// ✅ DESIRED
import { filterData } from '../../src/modules/filters.js';
```

**Why This Matters:**
1. **Code duplication** - Logic exists in 2 places
2. **Drift risk** - Tests may not match actual behavior
3. **False confidence** - Tests pass but production code differs
4. **Maintenance burden** - Changes require updating tests + code

---

### Phase 1: Enable Module Imports in Tests (4 hours)

#### 3.1 Update Vitest Configuration

```javascript
// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/unit/**/*.test.js', 'tests/integration/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: [
        'src/modules/**/*.js',
        'src/script.js'
      ],
      exclude: [
        'src/libs/**',
        'src/sw.js',
        '**/*.test.js',
        '**/*.config.js'
      ],
      // New thresholds (aggressive)
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80
      }
    }
  },
  resolve: {
    alias: {
      '@': './src',
      '@modules': './src/modules'
    }
  }
});
```

#### 3.2 Update Test Setup

```javascript
// tests/setup.js
import { vi } from 'vitest';

// Mock browser APIs
global.localStorage = {
  store: {},
  getItem(key) { return this.store[key] || null; },
  setItem(key, value) { this.store[key] = value.toString(); },
  removeItem(key) { delete this.store[key]; },
  clear() { this.store = {}; }
};

global.navigator = {
  onLine: true,
  serviceWorker: {
    register: vi.fn().mockResolvedValue({}),
    addEventListener: vi.fn()
  }
};

// Mock Chart.js
vi.mock('chart.js/auto', () => {
  return {
    default: class Chart {
      constructor() {}
      update() {}
      destroy() {}
    }
  };
});

// Reset mocks before each test
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
```

---

### Phase 2: Refactor Existing Tests (8 hours)

#### 3.3 Update Unit Tests to Use Imports

**Before:**
```javascript
// tests/unit/filtering.test.js
import { describe, it, expect, beforeEach } from 'vitest';

// ❌ Duplicated implementation
function filterData(data, tabName) {
  let filtered = [...data];
  // ... 50 lines ...
  return filtered;
}

describe('filterData()', () => {
  it('should filter by name', () => {
    const result = filterData(testItems, 'items');
    expect(result).toHaveLength(1);
  });
});
```

**After:**
```javascript
// tests/unit/filtering.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { filterData } from '@modules/filters.js';

describe('filterData()', () => {
  it('should filter by name', () => {
    const result = filterData(testItems, 'items');
    expect(result).toHaveLength(1);
  });
});
```

#### 3.4 Test Refactoring Checklist

**Files to update:**

- [ ] `tests/unit/filtering.test.js` - Import from filters.js
- [ ] `tests/unit/utils.test.js` - Import from utils.js
- [ ] `tests/unit/calculator.test.js` - Import from calculator.js
- [ ] `tests/unit/data-validation.test.js` - Import from data-validation.js
- [ ] `tests/unit/modal.test.js` - Import from modal.js
- [ ] `tests/unit/toast.test.js` - Import from toast.js
- [ ] `tests/unit/build-codes.test.js` - Import from build-planner.js
- [ ] `tests/unit/build-stats.test.js` - Import from build-planner.js
- [ ] `tests/unit/chart.test.js` - Import from charts.js
- [ ] `tests/unit/changelog.test.js` - Import from changelog.js
- [ ] `tests/unit/compare.test.js` - Import from compare.js
- [ ] `tests/unit/rendering.test.js` - Import from renderers.js
- [ ] `tests/integration/tab-switching.test.js` - Import from events.js
- [ ] `tests/integration/search-filter.test.js` - Import from filters.js + events.js
- [ ] `tests/integration/build-planner.test.js` - Import from build-planner.js

---

### Phase 3: Add Missing Tests (4 hours)

#### 3.5 Critical Untested Areas

**1. Event Delegation & Keyboard Shortcuts**

```javascript
// tests/unit/events.test.js (NEW)
import { describe, it, expect, vi } from 'vitest';
import { setupEventListeners, handleKeyboardShortcuts } from '@modules/events.js';

describe('Event Handling', () => {
  it('should handle tab navigation with arrow keys', () => {
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
    const spy = vi.spyOn(document, 'getElementById');

    handleKeyboardShortcuts(event);

    expect(spy).toHaveBeenCalled();
  });

  it('should close modal on Escape key', () => {
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    // Test modal closing logic
  });
});
```

**2. Modal Lifecycle**

```javascript
// tests/unit/modal.test.js (EXPAND)
import { openModal, closeModal, createModal } from '@modules/modal.js';

describe('Modal Lifecycle', () => {
  it('should trap focus within modal', () => {
    const modal = createModal({ title: 'Test' });
    openModal(modal);

    // Tab through modal elements
    const focusableElements = modal.querySelectorAll('[tabindex]');
    expect(focusableElements.length).toBeGreaterThan(0);

    closeModal(modal);
  });

  it('should restore focus after closing', () => {
    const button = document.createElement('button');
    button.focus();

    const modal = createModal({ title: 'Test' });
    openModal(modal);
    closeModal(modal);

    expect(document.activeElement).toBe(button);
  });
});
```

**3. Debounced Search Behavior**

```javascript
// tests/unit/debounce.test.js (NEW)
import { describe, it, expect, vi } from 'vitest';
import { debounce } from '@modules/utils.js';

describe('debounce()', () => {
  it('should delay execution', async () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced();
    debounced();
    debounced();

    expect(fn).not.toHaveBeenCalled();

    await new Promise(r => setTimeout(r, 350));

    expect(fn).toHaveBeenCalledTimes(1);
  });
});
```

**4. localStorage Quota Exceeded**

```javascript
// tests/unit/storage.test.js (NEW)
import { describe, it, expect } from 'vitest';
import { saveBuild } from '@modules/build-planner.js';

describe('Storage Edge Cases', () => {
  it('should handle localStorage quota exceeded', () => {
    // Mock quota exceeded error
    Storage.prototype.setItem = () => {
      throw new DOMException('QuotaExceededError');
    };

    expect(() => saveBuild(hugeBuild)).not.toThrow();
    // Should show user-friendly error
  });
});
```

**5. Memory Leak Tests (Charts)**

```javascript
// tests/unit/chart-memory.test.js (NEW)
import { describe, it, expect } from 'vitest';
import { createScalingChart, destroyChart } from '@modules/charts.js';

describe('Chart Memory Management', () => {
  it('should destroy chart instances on tab switch', () => {
    const canvas = document.createElement('canvas');
    const chart = createScalingChart(canvas, mockData);

    expect(chart).toBeDefined();

    destroyChart(chart);

    // Chart should be nullified
    expect(chart.ctx).toBeNull();
  });
});
```

---

### Phase 4: Integration & E2E Tests (2 hours)

#### 3.6 Add E2E Scenarios

```javascript
// tests/e2e/offline-online-transition.spec.js (NEW)
import { test, expect } from '@playwright/test';

test.describe('Offline/Online Transitions', () => {
  test('should show offline indicator when network lost', async ({ page, context }) => {
    await page.goto('http://localhost:8000');

    // Wait for initial load
    await page.waitForSelector('#items-list');

    // Simulate offline
    await context.setOffline(true);

    const indicator = await page.locator('#offline-indicator');
    await expect(indicator).toBeVisible();

    // Simulate back online
    await context.setOffline(false);

    await expect(indicator).not.toBeVisible();
  });

  test('should use cached data when offline', async ({ page, context }) => {
    await page.goto('http://localhost:8000');
    await page.waitForSelector('#items-list');

    // Go offline
    await context.setOffline(true);

    // Refresh page
    await page.reload();

    // Should still load from cache
    await expect(page.locator('#items-list')).toBeVisible();
  });
});
```

```javascript
// tests/e2e/keyboard-navigation.spec.js (NEW)
import { test, expect } from '@playwright/test';

test.describe('Keyboard Navigation', () => {
  test('should navigate tabs with arrow keys', async ({ page }) => {
    await page.goto('http://localhost:8000');

    // Focus on first tab
    await page.locator('.tab:first-child').focus();

    // Press ArrowRight
    await page.keyboard.press('ArrowRight');

    // Should move to next tab
    const activeTab = await page.locator('.tab.active');
    await expect(activeTab).toHaveText('Weapons');
  });

  test('should open modal with Enter key', async ({ page }) => {
    await page.goto('http://localhost:8000');

    // Focus on first item
    await page.locator('.item-card:first-child').focus();
    await page.keyboard.press('Enter');

    // Modal should open
    await expect(page.locator('.modal')).toBeVisible();
  });
});
```

---

### Coverage Goals

#### 3.7 Target Coverage by Module

| Module | Current | Target | Priority |
|--------|---------|--------|----------|
| filters.js | 75% | 90% | HIGH |
| build-planner.js | 65% | 85% | HIGH |
| data-service.js | 80% | 95% | HIGH |
| modal.js | 60% | 80% | MEDIUM |
| events.js | 50% | 75% | MEDIUM |
| charts.js | 70% | 80% | MEDIUM |
| utils.js | 85% | 95% | LOW (already good) |
| calculator.js | 90% | 95% | LOW (already good) |

**Overall Target:** 80% lines, 70% branches

---

## Risk Analysis & Mitigation

### Risk 1: Bundle Size Increase

**Risk:** ES modules + bundler may increase bundle size

**Mitigation:**
- Tree-shaking enabled by default in Vite
- Code splitting by route/tab
- Lazy load non-critical modules (changelog, calculator)
- Target: <300KB gzipped (currently ~180KB)

### Risk 2: Service Worker Breakage

**Risk:** Bundled files have different paths/names

**Mitigation:**
- Use Vite PWA plugin (handles versioning automatically)
- Test offline mode thoroughly
- Implement cache versioning
- Add manual cache clear button

### Risk 3: Breaking Changes

**Risk:** Module refactoring breaks existing functionality

**Mitigation:**
- Comprehensive testing before migration
- Feature flags for gradual rollout
- Keep old version as fallback
- Monitor error rates with Sentry (future)

### Risk 4: Browser Compatibility

**Risk:** ES modules not supported in older browsers

**Mitigation:**
- Target: Chrome 90+, Firefox 88+, Safari 14+ (2020+)
- Drop IE11 support (already unsupported)
- Use `<script type="module">` with `nomodule` fallback (optional)

### Risk 5: Developer Onboarding

**Risk:** New developers unfamiliar with ES modules

**Mitigation:**
- Update CLAUDE.md with new architecture
- Create migration guide (this document)
- Add inline comments explaining imports
- Update README with new dev commands

---

## Success Metrics

### Performance Metrics

**Before Migration:**
- First Load: ~800ms (HTTP/1.1, no bundler)
- Bundle Size: ~180KB unminified
- Search: ~2ms (linear scan)
- Test Coverage: 70%

**After Migration Targets:**
- First Load: <600ms (bundled + tree-shaken)
- Bundle Size: <300KB gzipped
- Search: <1ms (inverted index)
- Test Coverage: 80%

**Lighthouse Scores:**
- Performance: >90 (currently 85)
- Accessibility: >95 (currently 92)
- Best Practices: >95 (currently 90)
- SEO: >95 (currently 100)

### Code Quality Metrics

- **Maintainability:** Reduced global scope pollution (17 globals → 0)
- **Testability:** Direct imports (no mocking globals)
- **Scalability:** Code splitting enabled
- **Type Safety:** Ready for TypeScript migration (future)

### Developer Experience

- **Build Time:** <2s for production build
- **Dev Server:** <100ms hot reload
- **Test Speed:** <5s for full test suite
- **Debugging:** Source maps enabled

---

## Implementation Timeline

### Week 1: ES Modules Migration (24 hours)

**Day 1-2: Setup (8 hours)**
- Install Vite + dependencies
- Configure vite.config.js
- Update package.json scripts
- Create initial build

**Day 3-4: Module Conversion (12 hours)**
- Convert 17 modules to ES6 exports
- Update imports in all files
- Remove global window assignments
- Test each module individually

**Day 5: Service Worker + Testing (4 hours)**
- Migrate to Vite PWA
- Test offline mode
- Validate bundle size
- Run E2E tests

### Week 2: Testing Infrastructure (16 hours)

**Day 1-2: Test Refactoring (8 hours)**
- Update vitest.config.js
- Refactor unit tests to use imports
- Remove standalone implementations
- Fix failing tests

**Day 3: New Tests (4 hours)**
- Add event handling tests
- Add modal lifecycle tests
- Add storage edge case tests
- Add chart memory leak tests

**Day 4: Integration Tests (4 hours)**
- Add offline/online E2E tests
- Add keyboard navigation E2E tests
- Run full test suite
- Validate coverage thresholds

### Week 3: Search Optimization (8 hours)

**Day 1: Index Implementation (4 hours)**
- Create SearchIndex class
- Implement tokenization
- Implement fuzzy matching
- Add relevance scoring

**Day 2: Integration (2 hours)**
- Update filters.js
- Build indices on data load
- Add fallback to linear search
- Test with real data

**Day 3: Validation (2 hours)**
- Benchmark performance
- Test edge cases
- Update unit tests
- Document API

---

## Next Steps

1. **Get approval** for migration approach
2. **Create feature branch** from main
3. **Start with Phase 1** (ES Modules setup)
4. **Incremental commits** for each module conversion
5. **Continuous testing** to catch regressions early
6. **Code review** before merging
7. **Deploy to staging** for validation
8. **Monitor production** for errors

---

## Questions & Considerations

### Should we migrate everything at once?

**Option A: Big Bang Migration**
- ✅ Clean break, no dual maintenance
- ❌ Higher risk of breaking changes
- ❌ Difficult to roll back

**Option B: Gradual Migration (Recommended)**
- ✅ Lower risk, easier testing
- ✅ Can roll back individual modules
- ❌ Longer timeline, dual maintenance

**Recommendation:** Gradual migration, starting with leaf modules (constants, utils) and working up.

### Do we need ES Modules for testing?

**Strictly speaking:** No. Tests can continue using standalone implementations.

**However:** ES Modules enable:
- Direct imports (no duplication)
- Better type inference (for future TS migration)
- Easier mocking
- Higher confidence in tests

**Recommendation:** Yes, migrate to ES Modules first to enable proper testing.

### Is search optimization premature?

**Current dataset:** 157 items → Linear search is fast (<2ms)

**Reasons to optimize:**
1. **Future-proofing** - Dataset may grow 5-10x
2. **Advanced features** - Fuzzy search requires index
3. **Learning** - Demonstrates CS fundamentals
4. **User experience** - Relevance scoring improves results

**Recommendation:** Implement inverted index, but keep it simple. Avoid over-engineering.

---

## Appendix: Reference Materials

### Useful Links

- [Vite Documentation](https://vitejs.dev/)
- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/)
- [Vitest Documentation](https://vitest.dev/)
- [ES Modules on MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [Inverted Index (Wikipedia)](https://en.wikipedia.org/wiki/Inverted_index)

### Related Documents

- `IMPROVEMENT_IDEAS_PHASE2.md` - Broader improvement roadmap
- `CLAUDE.md` - Project overview and commands
- `docs/UPDATE_GUIDE.md` - Data update procedures
- `docs/DATA_FORMAT.md` - Data schema documentation

---

**Document Version:** 1.0
**Last Updated:** 2026-01-09
**Authors:** Claude (Planning), MegaBonk Team (Review)
