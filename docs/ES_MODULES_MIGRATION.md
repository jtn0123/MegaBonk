# ES Modules Migration Guide

**Status:** 🚧 In Progress (Phase 1 of 3 Complete)
**Branch:** `claude/plan-modules-optimization-SJsWr`
**Started:** 2026-01-09

---

## Overview

This document tracks the migration of MegaBonk from global script tags to ES6 modules. This migration enables:

✅ **Tree-shaking** - Remove unused code from bundle
✅ **Code splitting** - Load modules on-demand
✅ **Direct imports in tests** - No more standalone implementations
✅ **Better IDE support** - Autocomplete and type inference
✅ **Explicit dependencies** - Clear dependency graph

---

## Current Status

### ✅ Completed (3/17 modules)

| Module | Status | Notes |
|--------|--------|-------|
| `constants.js` | ✅ Converted | All exports frozen with Object.freeze() |
| `utils.js` | ✅ Converted | Imports TIER_ORDER/RARITY_ORDER from constants |
| `toast.js` | ✅ Converted | Singleton ToastManager object exported |

### 🔄 Infrastructure Setup Complete

- ✅ Vite installed and configured (`vite.config.js`)
- ✅ Package.json scripts added (`dev`, `build`, `preview`)
- ✅ Vitest configuration updated with module aliases
- ✅ Test setup enhanced with better mocks (localStorage, serviceWorker)
- ✅ Example test refactored (`tests/unit/utils.test.js`)
- ✅ Entry point (`script.js`) updated with example imports

### 🚧 Pending (14/17 modules)

| Module | Dependencies | Priority |
|--------|--------------|----------|
| `dom-cache.js` | utils | HIGH |
| `favorites.js` | utils | MEDIUM |
| `data-validation.js` | utils | HIGH |
| `data-service.js` | data-validation, toast | HIGH |
| `filters.js` | constants, utils, data-service | HIGH |
| `charts.js` | utils, Chart.js | MEDIUM |
| `match-badge.js` | utils | LOW |
| `renderers.js` | utils, charts, match-badge | HIGH |
| `modal.js` | renderers, charts | HIGH |
| `build-planner.js` | data-service, renderers, modal | HIGH |
| `compare.js` | modal, renderers | MEDIUM |
| `calculator.js` | data-service, modal | MEDIUM |
| `changelog.js` | renderers, modal | LOW |
| `events.js` | ALL modules | HIGH (last) |

---

## What Was Done

### 1. Vite Setup

Created `vite.config.js` with:
- Build configuration for production
- Vite PWA plugin for service worker generation
- Path aliases (`@modules` → `/src/modules`)
- Code splitting and minification settings

```javascript
// New npm scripts
npm run dev      // Start Vite dev server
npm run build    // Build for production
npm run preview  // Preview production build
```

### 2. Module Conversions

#### constants.js

**Before:**
```javascript
const TIER_ORDER = { SS: 0, S: 1, A: 2, B: 3, C: 4 };
window.TIER_ORDER = Object.freeze(TIER_ORDER);
```

**After:**
```javascript
export const TIER_ORDER = Object.freeze({
    SS: 0, S: 1, A: 2, B: 3, C: 4
});
```

#### utils.js

**Before:**
```javascript
function debounce(fn, delay) { /* ... */ }
window.debounce = debounce;
```

**After:**
```javascript
import { TIER_ORDER, RARITY_ORDER } from './constants.js';

export function debounce(fn, delay) { /* ... */ }
```

#### toast.js

**Before:**
```javascript
const ToastManager = { /* ... */ };
window.ToastManager = ToastManager;
```

**After:**
```javascript
export const ToastManager = { /* ... */ };
```

### 3. Test Infrastructure

#### Updated vitest.config.js

- Added module aliases for easier imports
- Updated coverage to include `src/modules/**/*.js`
- Increased coverage thresholds (75% statements/lines/functions)

#### Updated tests/setup.js

Added comprehensive mocks:
- localStorage with full API implementation
- serviceWorker with register/ready promises
- Better console mock control

#### Refactored tests/unit/utils.test.js

**Before: Standalone implementations**
```javascript
function escapeHtml(text) {
  // 10 lines of duplicated code
}

function debounce(fn, delay) {
  // 5 lines of duplicated code
}
```

**After: Direct imports**
```javascript
import {
  escapeHtml,
  debounce,
  truncateText,
  generateExpandableText
  // ... 13 more functions
} from '../../src/modules/utils.js';

// ✅ All standalone implementations removed
```

**Benefits:**
- **54 lines of code removed** (no duplication)
- **Tests verify actual production code** (not reimplementations)
- **Changes to utils.js automatically reflected in tests**

### 4. Entry Point (script.js)

Updated to demonstrate ES module import pattern:

```javascript
// Import from converted modules
import { ToastManager } from './modules/toast.js';
import { debounce, escapeHtml } from './modules/utils.js';
import { TIER_ORDER, RARITY_ORDER } from './modules/constants.js';

// Backwards compatibility during migration
window.ToastManager = ToastManager;
```

---

## How to Continue the Migration

### Step 1: Convert Next Module (dom-cache.js)

1. **Read the module:**
   ```bash
   cat src/modules/dom-cache.js
   ```

2. **Identify dependencies:**
   - Look for `window.` references
   - Note which other modules it uses

3. **Convert to ES module:**
   ```javascript
   // Add imports at top
   import { safeGetElementById } from './utils.js';

   // Change functions to exports
   export function getCachedElement(id) { /* ... */ }

   // Remove window assignments
   // DELETE: window.getCachedElement = getCachedElement;
   ```

4. **Update script.js:**
   ```javascript
   import { getCachedElement, clearCache } from './modules/dom-cache.js';
   ```

5. **Test the conversion:**
   ```bash
   bun run dev  # Should work without errors
   ```

### Step 2: Update Tests

Find tests that use the module:
```bash
grep -r "getCachedElement\|clearCache" tests/
```

Refactor to use imports:
```javascript
import { getCachedElement } from '../../src/modules/dom-cache.js';
// Remove standalone implementation
```

### Step 3: Repeat for Remaining Modules

Follow this order (respects dependencies):

1. `dom-cache.js` → imports utils
2. `favorites.js` → imports utils
3. `data-validation.js` → imports utils
4. `data-service.js` → imports data-validation, toast
5. `filters.js` → imports constants, utils, data-service
6. `charts.js` → imports utils (+ install Chart.js as dependency)
7. `match-badge.js` → imports utils
8. `renderers.js` → imports utils, charts, match-badge
9. `modal.js` → imports renderers, charts
10. `build-planner.js` → imports data-service, renderers, modal
11. `compare.js` → imports modal, renderers
12. `calculator.js` → imports data-service, modal
13. `changelog.js` → imports renderers, modal
14. `events.js` → imports ALL modules (last to convert)

---

## Special Cases

### Chart.js (External Library)

Current: Loaded via CDN in index.html
```html
<script src="libs/chart.min.js"></script>
```

**Action:** Install as npm dependency
```bash
bun add chart.js
```

**Update charts.js:**
```javascript
import Chart from 'chart.js/auto';

export function createChart(ctx, config) {
  return new Chart(ctx, config);
}
```

**Remove from index.html:**
```html
<!-- DELETE THIS LINE -->
<script src="libs/chart.min.js"></script>
```

### Circular Dependencies

If you encounter:
```
Error: Cannot access 'X' before initialization
```

**Solution:** Extract shared code into separate module

**Example:**
```javascript
// events.js needs filters.js
// filters.js needs events.js
// ❌ Circular dependency!

// ✅ Solution: Create state.js
export const state = {
  filteredData: [],
  currentTab: 'items'
};

// Both can import from state.js
```

### Global State

Current state variables spread across files:
- `window.allData`
- `window.currentTab`
- `window.filteredData`
- `window.currentBuild`
- `window.compareItems`

**Recommendation:** Create `modules/state.js`

```javascript
// modules/state.js
const state = {
  allData: null,
  currentTab: 'items',
  filteredData: [],
  currentBuild: { character: null, weapon: null, tomes: [], items: [] },
  compareItems: []
};

export const getState = () => state;
export const setState = (updates) => Object.assign(state, updates);
```

---

## Testing Your Changes

### Run Tests

```bash
# Unit tests only
bun run test:unit

# Watch mode for development
bun run test:watch

# Full test suite
bun run test:all
```

### Dev Server

```bash
# Start Vite dev server (hot reload enabled)
bun run dev
```

Open http://localhost:8000 and test:
- ✅ Tabs switch correctly
- ✅ Search/filters work
- ✅ Modals open/close
- ✅ Build planner functions
- ✅ No console errors

### Build for Production

```bash
# Create production build
bun run build

# Preview the build
bun run preview
```

Check:
- Bundle size < 300KB gzipped
- All features work
- Service worker caches correctly

---

## Common Issues & Solutions

### Issue: Module not found

```
Error: Cannot find module './modules/utils.js'
```

**Solution:** Check the import path
- Use relative paths: `'./utils.js'` (same directory)
- Or absolute paths: `'/src/modules/utils.js'`
- Always include `.js` extension

### Issue: Function is undefined

```
TypeError: debounce is not a function
```

**Cause:** Not imported correctly

**Solution:**
```javascript
// ❌ Wrong
import utils from './utils.js';
utils.debounce(...);  // undefined

// ✅ Correct
import { debounce } from './utils.js';
debounce(...);
```

### Issue: Tests fail after refactoring

```
ReferenceError: escapeHtml is not defined
```

**Cause:** Test still using standalone implementation

**Solution:** Add import
```javascript
import { escapeHtml } from '../../src/modules/utils.js';
```

### Issue: Vite build fails

```
[vite]: Rollup failed to resolve import
```

**Cause:** Missing dependency or incorrect path

**Solution:**
1. Check package.json for missing dependencies
2. Verify import paths are correct
3. Run `bun install` if dependencies were added

---

## Validation Checklist

Before marking a module as "complete":

- [ ] All `window.X = X` assignments removed
- [ ] Functions/constants exported with `export`
- [ ] Dependencies imported at top of file
- [ ] script.js updated with new import
- [ ] Tests refactored to use imports (if applicable)
- [ ] `bun run test:unit` passes
- [ ] `bun run dev` works without errors
- [ ] Module shows up in Vite build output

---

## Performance Expectations

### Before Migration
- **Bundle:** ~180KB unminified
- **Load time:** ~800ms (17 sequential script tags)
- **Tree-shaking:** None
- **Code splitting:** None

### After Migration (Target)
- **Bundle:** <300KB gzipped
- **Load time:** <600ms (single bundled entry)
- **Tree-shaking:** Automatic (Vite/Rollup)
- **Code splitting:** Enabled (lazy load changelog, calculator)

---

## Next Steps

1. **Complete module conversions** (14 remaining)
2. **Refactor tests** to use imports (remove standalone implementations)
3. **Create state.js** for centralized state management
4. **Remove window assignments** after all modules converted
5. **Update index.html** to use single `<script type="module">` tag
6. **Test production build** and validate performance
7. **Update CLAUDE.md** with new architecture

---

## Resources

- **Optimization Plan:** `docs/OPTIMIZATION_PLAN.md`
- **Vite Docs:** https://vitejs.dev/
- **ES Modules Guide:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules
- **Vitest Configuration:** https://vitest.dev/config/

---

## Questions?

If you're unsure about any step:

1. Check `docs/OPTIMIZATION_PLAN.md` for detailed examples
2. Look at already-converted modules (constants.js, utils.js, toast.js)
3. Review the refactored test file (`tests/unit/utils.test.js`)
4. Test incrementally with `bun run dev`

---

**Last Updated:** 2026-01-09
**Progress:** 3/17 modules (18%)
**Next Milestone:** Convert 5 core modules (dom-cache, favorites, data-validation, data-service, filters)
