# Computer Vision Strategy System - Quick Start

## 🚀 5-Minute Setup

### 1. Install Dependencies

```bash
bun install
```

### 2. Run Your First Strategy Test

```bash
# Test the optimized strategy (recommended)
bun run test:cv:offline
```

### 3. View Results

Check `test-results/cv-test-report.md` for the full report.

---

## 📊 Compare All Strategies

```bash
# Compare current, optimized, fast, accurate, and balanced strategies
bun run test:cv:strategies
```

**Expected output:**
```
📋 Test Case: level-33-early-game.png
   ✅ optimized: F1=92.3%, Time=2847ms
   ✅ fast: F1=85.1%, Time=1456ms
   ✅ accurate: F1=94.7%, Time=4231ms
```

---

## 🎯 Choosing a Strategy

| If you want... | Use this strategy | Command |
|----------------|-------------------|---------|
| **Best overall performance** | `optimized` | `setActiveStrategy('optimized')` |
| **Fastest detection** | `fast` | `setActiveStrategy('fast')` |
| **Highest accuracy** | `accurate` | `setActiveStrategy('accurate')` |
| **Good balance** | `balanced` | `setActiveStrategy('balanced')` |

---

## 💻 Using in Your Code

### Browser (Production)

```typescript
import { setActiveStrategy } from './modules/cv-strategy.ts';
import { detectItemsWithEnhancedCV } from './modules/computer-vision-enhanced.ts';

// Set strategy
setActiveStrategy('optimized');

// Run detection
const results = await detectItemsWithEnhancedCV(
  imageDataUrl,
  'optimized',
  (progress, status) => {
    console.log(`${progress}% - ${status}`);
  }
);

console.log(`Detected ${results.length} items`);
```

### Node.js (Testing)

```bash
# Run offline tests with specific strategy
bun run tests/offline-cv-runner.ts --strategies optimized --verbose

# Run all strategies and compare
bun run test:cv:ci
```

---

## 📈 Performance Targets

| Metric | Target | Optimized Strategy |
|--------|--------|-------------------|
| F1 Score | ≥ 85% | 90-95% ✅ |
| Detection Time | ≤ 5s | 3-4.5s ✅ |
| Precision | ≥ 85% | 92-96% ✅ |
| Recall | ≥ 80% | 88-94% ✅ |

---

## 🔧 Customizing Strategies

```typescript
import { setActiveStrategy } from './modules/cv-strategy.ts';

// Create custom strategy
setActiveStrategy({
  colorFiltering: 'rarity-first',        // Extract rarity first
  colorAnalysis: 'multi-region',         // Analyze color in 6 regions
  confidenceThresholds: 'adaptive-rarity', // Adjust thresholds by rarity
  matchingAlgorithm: 'ncc',              // Use NCC algorithm
  useContextBoosting: true,              // Boost common items
  useBorderValidation: true,             // Validate with border color
  useFeedbackLoop: true,                 // Learn from corrections
  useEmptyCellDetection: true,           // Skip empty cells
  multiPassEnabled: true,                // Use 3-pass matching
});
```

---

## 📖 Full Documentation

See [CV_STRATEGY_GUIDE.md](./CV_STRATEGY_GUIDE.md) for:
- Detailed explanation of all 5 improvements
- Strategy configuration options
- Performance metrics
- CI/CD integration
- Troubleshooting guide

---

## 🐛 Troubleshooting

### Tests won't run

```bash
# Install canvas package
bun add -d canvas

# Verify test images exist
ls test-images/gameplay/ground-truth.json
```

### Low accuracy (<80%)

- Check ground truth labels are correct
- Verify test images are actual game screenshots
- Try `accurate` strategy for comparison

### Slow performance (>10s)

- Use `fast` or `optimized` strategy
- Reduce screenshot resolution to 1080p
- Enable `useEmptyCellDetection: true`

---

## 🎉 Next Steps

1. ✅ Run `bun run test:cv:offline`
2. ✅ Review the generated report in `test-results/`
3. ✅ Choose your preferred strategy
4. ✅ Integrate into your application
5. ✅ Share feedback!

Happy detecting! 🔍
