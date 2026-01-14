# Enhanced CV Integration Guide

This guide shows you how to integrate the enhanced CV strategy system into your MegaBonk app.

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Import Enhanced Modules

Add these imports to your main `script.ts`:

```typescript
// Add to src/script.ts
import { initEnhancedScanBuild, handleEnhancedHybridDetect, compareStrategiesOnImage } from './modules/scan-build-enhanced.ts';
import { setActiveStrategy } from './modules/cv-strategy.ts';
import './styles/scan-build-enhanced.css';
```

### Step 2: Initialize Enhanced CV

Replace or add to your initialization code:

```typescript
// In your init function (src/script.ts)
async function init() {
    // ... existing initialization ...

    // Initialize enhanced CV
    await initEnhancedScanBuild(allData);

    // Set default strategy
    setActiveStrategy('optimized'); // Recommended!

    console.log('✅ Enhanced CV initialized with optimized strategy');
}
```

### Step 3: Add UI Elements

Add these elements to `src/index.html` in the Build Scanner section:

```html
<!-- In the Build Scanner / Advisor tab -->
<div id="scan-auto-detect-area">

    <!-- Strategy Selector (NEW) -->
    <div id="scan-strategy-selector"></div>

    <!-- Existing buttons -->
    <button id="scan-auto-detect-btn">🔍 Auto-Detect (OCR)</button>
    <button id="scan-hybrid-detect-btn">🎯 Hybrid: OCR + CV</button>

    <!-- NEW: Compare Strategies Button -->
    <button id="scan-compare-strategies-btn" class="compare-strategies-btn">
        📊 Compare All Strategies
    </button>

    <!-- Metrics Display (NEW) -->
    <div id="scan-detection-metrics" style="display: none;"></div>

    <!-- Strategy Comparison (NEW) -->
    <div id="scan-strategy-comparison" style="display: none;"></div>

</div>
```

### Step 4: Update Event Listener

Update your hybrid detect button handler:

```typescript
// In src/modules/scan-build.ts or wherever you handle the button
const hybridDetectBtn = document.getElementById('scan-hybrid-detect-btn');
hybridDetectBtn?.addEventListener('click', async () => {
    if (!uploadedImage) {
        ToastManager.error('Please upload an image first');
        return;
    }

    try {
        // Use enhanced hybrid detect
        const results = await handleEnhancedHybridDetect(uploadedImage);

        // Apply results to UI
        applyDetectionResults(results);

    } catch (error) {
        console.error('Detection error:', error);
        ToastManager.error('Detection failed');
    }
});
```

### Step 5: Add Compare Strategies Handler (Optional)

```typescript
// Add event listener for comparison
const compareBtn = document.getElementById('scan-compare-strategies-btn');
compareBtn?.addEventListener('click', async () => {
    if (!uploadedImage) {
        ToastManager.error('Please upload an image first');
        return;
    }

    await compareStrategiesOnImage(uploadedImage);
});
```

---

## 📋 Complete Integration Example

Here's a complete example showing how to integrate into your existing code:

```typescript
// src/script.ts (main entry point)

import { initEnhancedScanBuild, handleEnhancedHybridDetect } from './modules/scan-build-enhanced.ts';
import { setActiveStrategy, STRATEGY_PRESETS } from './modules/cv-strategy.ts';
import { metricsTracker } from './modules/cv-metrics.ts';
import './styles/scan-build-enhanced.css';

// Your existing imports...
import { loadGameData } from './modules/data-loader.ts';
import { ToastManager } from './modules/toast.ts';

async function initializeApp() {
    try {
        // 1. Load game data
        const gameData = await loadGameData();

        // 2. Initialize enhanced CV
        await initEnhancedScanBuild(gameData);

        // 3. Set default strategy (optimized recommended)
        setActiveStrategy('optimized');

        // 4. Setup UI event listeners
        setupEnhancedScanBuildUI();

        console.log('✅ App initialized with enhanced CV');

    } catch (error) {
        console.error('Initialization error:', error);
        ToastManager.error('Failed to initialize app');
    }
}

function setupEnhancedScanBuildUI() {
    // Upload image
    const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
    fileInput?.addEventListener('change', handleFileUpload);

    // Hybrid detect (OCR + Enhanced CV)
    const hybridBtn = document.getElementById('scan-hybrid-detect-btn');
    hybridBtn?.addEventListener('click', async () => {
        const uploadedImage = getUploadedImageDataUrl(); // Your function

        if (!uploadedImage) {
            ToastManager.error('Please upload an image first');
            return;
        }

        try {
            const results = await handleEnhancedHybridDetect(uploadedImage);
            applyDetectionResults(results);

            // Show metrics
            if (results.metrics) {
                console.log('Detection Metrics:', results.metrics);
            }

        } catch (error) {
            console.error('Detection failed:', error);
            ToastManager.error('Detection failed');
        }
    });

    // Compare strategies
    const compareBtn = document.getElementById('scan-compare-strategies-btn');
    compareBtn?.addEventListener('click', async () => {
        const uploadedImage = getUploadedImageDataUrl();

        if (!uploadedImage) {
            ToastManager.error('Please upload an image first');
            return;
        }

        ToastManager.info('Comparing all 5 strategies...');
        await compareStrategiesOnImage(uploadedImage);
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initializeApp);
```

---

## 🎯 Strategy Selection Guide

### For Users: What Strategy Should I Use?

**Recommended for most users:**
```typescript
setActiveStrategy('optimized');
```

**All options:**

| Strategy | When to Use | Speed | Accuracy |
|----------|-------------|-------|----------|
| **optimized** ⭐ | Production, general use | Fast (2.5s) | High (84% F1) |
| **fast** | Quick scans, previews | Fastest (1.2s) | Good (70% F1) |
| **accurate** | Validation, benchmarking | Slower (3.4s) | Highest (86% F1) |
| **balanced** | Middle ground | Medium (2.4s) | Very Good (83% F1) |
| **current** | Baseline comparison | Slow (4s) | Baseline (72% F1) |

### Programmatic Strategy Selection

```typescript
// Set strategy based on user preference
const userPreference = localStorage.getItem('cv-strategy') || 'optimized';
setActiveStrategy(userPreference);

// Or detect based on device
const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
setActiveStrategy(isMobile ? 'fast' : 'optimized');

// Or based on screenshot complexity
const resolution = detectImageResolution(image);
const strategy = resolution.width > 2560 ? 'accurate' : 'optimized';
setActiveStrategy(strategy);
```

---

## 📊 Viewing Metrics

### In Browser Console

```typescript
// View metrics for current strategy
import { metricsTracker } from './modules/cv-metrics.ts';

const metrics = metricsTracker.getMetricsForStrategy('optimized');
console.table(metrics);

// Compare strategies
const comparison = metricsTracker.compareStrategies([
    'current',
    'optimized',
    'fast',
    'accurate'
]);

console.log('Best for accuracy:', comparison.recommendations.forAccuracy);
console.log('Best for speed:', comparison.recommendations.forSpeed);

// Export metrics
const json = metricsTracker.exportMetrics();
console.log(json);

// Generate report
const report = metricsTracker.generateReport();
console.log(report);
```

### In UI

The enhanced system automatically shows metrics after detection:
- Total detection time
- Number of detections
- Average confidence
- Match rate
- High confidence count
- Current strategy

---

## 🎨 Customizing Styles

The enhanced styles are in `src/styles/scan-build-enhanced.css`. You can customize:

```css
/* Change strategy selector colors */
.strategy-selector {
    background: rgba(74, 158, 255, 0.1); /* Your color */
    border-color: rgba(74, 158, 255, 0.3); /* Your color */
}

/* Change metrics display */
.detection-metrics {
    background: linear-gradient(135deg,
        rgba(74, 158, 255, 0.1),
        rgba(139, 92, 246, 0.1)
    );
}

/* Change progress bar colors */
.progress-fill {
    background: linear-gradient(90deg, #4a9eff, #8b5cf6);
}
```

---

## 🧪 Testing Integration

### Test 1: Basic Detection

```typescript
// 1. Upload a screenshot
// 2. Select "optimized" strategy
// 3. Click "Hybrid: OCR + CV"
// 4. Verify detection works
// 5. Check metrics are displayed
```

### Test 2: Strategy Comparison

```typescript
// 1. Upload a screenshot
// 2. Click "Compare All Strategies"
// 3. Wait for all 5 strategies to run
// 4. Review comparison table
// 5. Verify optimized is fastest + most accurate
```

### Test 3: Metrics Tracking

```typescript
// 1. Run detection with "optimized" strategy
// 2. Open browser console
// 3. Run: metricsTracker.getMetricsForStrategy('optimized')
// 4. Verify metrics are recorded
```

---

## 🔧 Troubleshooting

### Issue: "Strategy selector not showing"

**Solution:**
```html
<!-- Verify this element exists in your HTML -->
<div id="scan-strategy-selector"></div>
```

### Issue: "Metrics not displaying"

**Solution:**
```html
<!-- Add these elements -->
<div id="scan-detection-metrics" style="display: none;"></div>
<div id="scan-strategy-comparison" style="display: none;"></div>
```

### Issue: "TypeScript errors on import"

**Solution:**
```typescript
// Make sure you have the right paths
import { initEnhancedScanBuild } from './modules/scan-build-enhanced.ts';
import { setActiveStrategy } from './modules/cv-strategy.ts';
import { metricsTracker } from './modules/cv-metrics.ts';
```

### Issue: "Detection is slow"

**Solutions:**
1. Switch to 'fast' strategy: `setActiveStrategy('fast')`
2. Reduce screenshot resolution
3. Check if templates are loaded: `await loadEnhancedTemplates()`

### Issue: "Low accuracy"

**Solutions:**
1. Switch to 'accurate' strategy: `setActiveStrategy('accurate')`
2. Ensure screenshot is clear and well-lit
3. Check if it's a complex multi-row layout (harder to detect)

---

## 📈 Performance Optimization Tips

### 1. Preload Templates on App Start

```typescript
async function init() {
    // Preload during app initialization
    const loadPromise = loadEnhancedTemplates();

    // Continue with other init tasks
    await initOtherModules();

    // Ensure templates loaded before allowing detection
    await loadPromise;
}
```

### 2. Cache Strategy Selection

```typescript
// Save user's preferred strategy
function setUserStrategy(strategy: string) {
    setActiveStrategy(strategy);
    localStorage.setItem('cv-strategy', strategy);
}

// Restore on app load
function restoreUserStrategy() {
    const saved = localStorage.getItem('cv-strategy');
    if (saved && saved in STRATEGY_PRESETS) {
        setActiveStrategy(saved);
    }
}
```

### 3. Progressive Enhancement

```typescript
// Start with fast detection, then refine
async function progressiveDetection(image: string) {
    // Quick scan first
    setActiveStrategy('fast');
    const quickResults = await handleEnhancedHybridDetect(image);
    applyDetectionResults(quickResults);

    // Then refine in background
    setTimeout(async () => {
        setActiveStrategy('optimized');
        const refinedResults = await handleEnhancedHybridDetect(image);
        applyDetectionResults(refinedResults);
    }, 100);
}
```

---

## 🎯 Summary

### What You Get:

✅ **5 detection strategies** to choose from
✅ **37% faster detection** with optimized strategy
✅ **17% better accuracy** (72% → 84% F1)
✅ **Real-time metrics** tracking
✅ **Strategy comparison** tool
✅ **Browser UI integration** ready

### Recommended Setup:

1. Use **'optimized'** strategy by default
2. Show strategy selector for power users
3. Display metrics after detection
4. Optional: Add strategy comparison button

### Next Steps:

1. ✅ Follow integration steps above
2. ✅ Test with your game screenshots
3. ✅ Adjust strategy based on your needs
4. ✅ Monitor metrics and optimize

---

**Need help?** Check the documentation:
- [CV_STRATEGY_GUIDE.md](./CV_STRATEGY_GUIDE.md) - Full strategy guide
- [CV_QUICKSTART.md](./CV_QUICKSTART.md) - Quick start
- [DEMO_RESULTS.md](./DEMO_RESULTS.md) - Demo results

**Questions?** Open an issue on GitHub!
