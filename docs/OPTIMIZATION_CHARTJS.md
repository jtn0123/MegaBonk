# Chart.js Optimization and Code Splitting

## Summary

Successfully optimized Chart.js usage in MegaBonk Complete Guide by implementing tree-shaking and dynamic imports, resulting in a **76% reduction** in initial JavaScript bundle size.

## Results

### Bundle Size Comparison

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Initial JS Bundle** | 219.75 KB (69.19 KB gzipped) | 65.11 KB (15.97 KB gzipped) | **76% smaller** |
| **Chart.js Module** | Bundled in main | 156.89 KB (54.18 KB gzipped) | Loaded on demand |
| **Total Size** | 219.75 KB | 222.00 KB | Negligible change |
| **Initial Page Load** | 69.19 KB | 15.97 KB | **⚡ 76% faster** |

### Key Achievements

1. ✅ **Converted Chart.js from local bundle to npm package** (chart.js@4.5.1)
2. ✅ **Implemented tree-shaking** to remove unused Chart.js components
3. ✅ **Dynamic imports** for charts module - loaded only when needed
4. ✅ **Fixed module imports** in renderers.js to eliminate global scope pollution
5. ✅ **Removed 201 KB chart.min.js** from initial page load

## Implementation Details

### 1. Tree-Shakeable Chart.js Wrapper

Created `src/modules/chart-loader.js` that imports only the Chart.js components actually used:

```javascript
import {
    Chart,
    LineController,    // Only line charts
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Title,
    Tooltip,
    Legend,
    Filler            // For area fill
} from 'chart.js';

Chart.register(
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Title,
    Tooltip,
    Legend,
    Filler
);

export { Chart };
```

**Result**: Removed unused chart types (Bar, Radar, Pie, etc.) and plugins

### 2. Dynamic Imports for Code Splitting

Converted static imports to dynamic imports in three key locations:

#### A. Modal Charts (`src/modules/modal.js`)

```javascript
// Before
import { createScalingChart, calculateTomeProgression } from './charts.js';

// After - dynamic import
const { createScalingChart, calculateTomeProgression } = await import('./charts.js');
```

Charts are loaded only when:
- User opens an item detail modal
- User opens a tome detail modal
- User switches between scaling track tabs

#### B. Comparison Charts (`src/modules/compare.js`)

```javascript
// Before
import { createCompareChart } from './charts.js';

// After - dynamic import
const { createCompareChart } = await import('./charts.js');
```

Charts loaded only when user opens the comparison modal (2+ items selected)

#### C. Grid View Charts (`src/modules/renderers.js`)

```javascript
// Before
import { initializeItemCharts, initializeTomeCharts } from './charts.js';

// After - dynamic import
requestAnimationFrame(async () => {
    const { initializeItemCharts } = await import('./charts.js');
    initializeItemCharts();
});
```

Charts loaded asynchronously after DOM renders, improving perceived performance

### 3. Module Dependency Cleanup

Fixed `src/modules/renderers.js` to use proper ES6 imports instead of relying on global scope:

```javascript
// Added proper imports
import { getDataForTab } from './data-service.js';
import { filterData } from './filters.js';
import { calculateBreakpoint, populateCalculatorItems } from './calculator.js';
import { getCompareItems } from './compare.js';
import { updateChangelogStats, renderChangelog } from './changelog.js';
import { renderBuildPlanner } from './build-planner.js';
```

**Result**: Eliminated all global scope dependencies and window object pollution

### 4. Build Configuration

Vite automatically handles code splitting when it detects dynamic imports:

```javascript
// vite.config.js - existing configuration
build: {
    chunkSizeWarningLimit: 500,
    minify: 'terser',
    rollupOptions: {
        // ... automatic code splitting
    }
}
```

No manual configuration needed - Vite's rollup integration handles everything

## Performance Impact

### Initial Page Load

**Before**: Browser downloads 69.19 KB of gzipped JavaScript before rendering
**After**: Browser downloads only 15.97 KB of gzipped JavaScript

**Impact on users**:
- **Mobile 3G (750 Kbps)**: ~700ms faster initial load
- **Mobile 4G (4 Mbps)**: ~130ms faster initial load
- **Desktop (10+ Mbps)**: ~40ms faster initial load + parsing time savings

### Chart Loading Performance

Charts now load asynchronously:
1. Page renders immediately with all content
2. Chart module (54.18 KB gzipped) loads in background
3. Charts render when module is ready (typically <100ms on fast connections)

**User Experience**: Page is interactive faster, charts appear shortly after

## Browser Caching Strategy

Updated service worker cache list (`src/sw.js`):

```javascript
// Removed old bundle
- './libs/chart.min.js',

// Added new module
+ './modules/chart-loader.js',
```

VitePWA plugin automatically handles caching of code-split chunks

## Usage Patterns

### Where Charts Are Used

| Location | Chart Type | Loading Strategy |
|----------|-----------|------------------|
| Items Grid | Line (scaling) | Dynamic import (deferred) |
| Tomes Grid | Line (progression) | Dynamic import (deferred) |
| Item Detail Modal | Line (scaling) | Dynamic import (on modal open) |
| Tome Detail Modal | Line (progression) | Dynamic import (on modal open) |
| Comparison Modal | Multi-line | Dynamic import (on modal open) |

All chart types use the same Line chart implementation with different configurations

## Future Optimization Opportunities

### Further Optimizations (Optional)

1. **Custom SVG Chart Library** (~20-30 KB)
   - Current Chart.js bundle: 156 KB
   - Potential savings: ~130 KB
   - Trade-off: Need to implement custom chart rendering

2. **Chart.js Lite Alternative**
   - Explore lightweight alternatives like Lightweight Charts
   - May reduce chart bundle by 50-70%

3. **Canvas Pooling**
   - Reuse canvas elements instead of destroy/recreate
   - Minor memory optimization

4. **Lazy Load Grid Charts**
   - Only load charts when they scroll into viewport
   - Use IntersectionObserver API
   - Further defer chart loading for better initial render

## Testing Checklist

All chart functionality verified:

- ✅ Item grid charts render correctly
- ✅ Tome grid charts render correctly
- ✅ Item detail modal charts work
- ✅ Tome detail modal charts work
- ✅ Comparison modal charts work
- ✅ Scaling track tabs switch charts properly
- ✅ Chart cleanup on modal close (no memory leaks)
- ✅ Build succeeds without errors
- ✅ Service worker caching works

## Dependencies

### NPM Packages

```json
{
  "dependencies": {
    "chart.js": "^4.5.1"
  }
}
```

### Module Files

- `src/modules/chart-loader.js` - Tree-shakeable Chart.js wrapper (NEW)
- `src/modules/charts.js` - Chart creation and management functions
- `src/modules/modal.js` - Modal charts with dynamic imports
- `src/modules/compare.js` - Comparison charts with dynamic imports
- `src/modules/renderers.js` - Grid charts with dynamic imports

## Migration Notes

### Breaking Changes

None - all changes are internal optimizations

### API Changes

- `openDetailModal()` is now async (returns Promise)
- `openCompareModal()` is now async (returns Promise)
- `closeCompareModal()` is now async (returns Promise)
- `renderTomeModal()` is now async (returns Promise)

Event handlers automatically handle the async nature - no code changes needed in callers

## Maintenance

### Updating Chart.js

To update Chart.js version:

```bash
bun update chart.js
```

Verify that tree-shaking still works after updates:

```bash
bun run build
# Check that charts-*.js is separate from main-*.js
```

### Adding New Chart Types

If adding Bar/Pie/Radar charts in the future:

1. Update `src/modules/chart-loader.js` to import and register new controllers
2. Test bundle size impact
3. Consider creating separate chart modules for different types

## Conclusion

The Chart.js optimization successfully achieved:

- 📦 **76% smaller initial bundle** (69 KB → 16 KB gzipped)
- ⚡ **Faster time to interactive** - page renders before charts load
- 🧹 **Cleaner code** - no more global scope pollution
- 🎯 **Better UX** - users see content faster
- 🔮 **Future-proof** - proper ES6 modules enable further optimizations

Total implementation time: ~2 hours
Performance gain: Significant improvement in perceived and actual page load speed
