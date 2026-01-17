# Image Recognition Testing Guide

This document describes the comprehensive testing infrastructure for MegaBonk's image recognition (OCR + CV) system.

## Overview

The image recognition testing suite includes:
- **Ground truth data** for 9 real gameplay screenshots
- **Automated accuracy tests** with precision/recall/F1 metrics
- **Visual regression tests** for debug overlays
- **Performance benchmarks** across resolutions and strategies
- **Error analysis** with detailed diagnostics

## Quick Start

```bash
# Run all CV tests
npm run test:cv:full

# Or run individually:
npm run test:cv:accuracy      # Accuracy against ground truth
npm run test:cv:visual        # Visual regression tests
npm run test:cv:benchmark     # Performance benchmarks

# Run unit tests
npm run test:unit             # All unit tests
npm run test:recognition      # OCR/CV specific tests
```

## Test Suite Components

### 1. Ground Truth Data

**Location**: `test-images/gameplay/ground-truth.json`

Contains annotated data for 9 gameplay screenshots across difficulty levels:

| Screenshot | Level | Items | Language | Difficulty | Resolution |
|------------|-------|-------|----------|------------|------------|
| level_33_english_forest_early.jpg | 33 | 19 | English | ⭐ Easy | 1280x720 |
| level_21_english_desert_scorpion.jpg | 21 | 14 | English | ⭐ Easy | 1280x800 |
| level_52_spanish_ocean.jpg | 52 | 20 | Spanish | ⭐⭐ Medium | 1280x720 |
| level_66_russian_desert.jpg | 66 | 24 | Russian | ⭐⭐ Medium | 1280x720 |
| level_75_portuguese_hell_final.jpg | 75 | 33 | Portuguese | ⭐⭐⭐ Hard | 1280x720 |
| level_108_english_snow_boss.jpg | 108 | 19 | English | ⭐⭐ Medium | 1280x720 |
| level_112_russian_crypt_boss.jpg | 112 | 29 | Russian | ⭐⭐⭐ Hard | 1280x800 |
| level_281_turkish_hell.jpg | 281 | 20 | Turkish | ⭐⭐⭐⭐ Very Hard | 1280x800 |
| level_803_russian_stress_test.jpg | 803 | 49 | Russian | ⭐⭐⭐⭐⭐ Extreme | 1280x800 |

Each entry includes:
- Character name (if identifiable)
- Level number
- Resolution
- Language
- Complete list of items in inventory
- Equipped weapons with levels
- Testing notes and difficulty rating

### 2. Accuracy Tests

**File**: `tests/e2e/cv-accuracy.spec.js`

Tests detection accuracy against ground truth for all screenshots.

**Metrics Reported**:
- **Precision**: % of detected items that are correct
- **Recall**: % of expected items that were detected
- **F1 Score**: Harmonic mean of precision and recall
- **Accuracy**: Overall correctness rate
- **True Positives**: Correctly detected items
- **False Positives**: Incorrectly detected items
- **False Negatives**: Missed items

**Accuracy Targets**:
- Easy tests (clean UI): >80% accuracy
- Medium tests (standard gameplay): >70% accuracy
- Hard tests (heavy effects): >65% accuracy
- Very hard tests (visual chaos): >60% accuracy
- Extreme stress test (50+ items): >55% accuracy

**Example Output**:
```
Testing level_33_english_forest_early.jpg:
Expected 19 items
Detected 18 items
Detection time: 2341ms

Metrics for level_33_english_forest_early.jpg:
  Accuracy: 85.7%
  Precision: 89.5%
  Recall: 82.4%
  F1 Score: 85.8%
  True Positives: 17
  False Positives: 1
  False Negatives: 2
  Missed items: Tent, Shovel
```

### 3. Visual Regression Tests

**File**: `tests/e2e/cv-visual-regression.spec.js`

Validates that debug visualizations render correctly.

**Tests**:
- Debug overlay generation with grid visualization
- Slot grid rendering with correct cell counts
- Detection boxes with confidence labels
- Statistics overlay display
- Debug data JSON export

**Example**:
```bash
npm run test:cv:visual

# Output:
✓ should render debug overlay with grid visualization
  Debug overlay generated: 1280x720
✓ should render slot grid with correct cell count
  Grid detection: 19 cells for 1280x720 image
✓ should render detection boxes with confidence labels
  Detections: 18, Debug logs: 156
```

### 4. Performance Benchmarks

**File**: `tests/e2e/cv-benchmark.spec.js`

Measures detection speed and resource usage.

**Benchmark Types**:

#### A. Resolution Scaling
Tests detection time across different resolutions:
- 720p (1280x720): Expected <5000ms
- 800p (1280x800): Expected <5000ms
- 1080p (1920x1080): Expected <6000ms

#### B. Strategy Comparison
Compares performance of all 5 detection strategies:
```
Strategy      | Time (ms) | Items | Confidence
---------------------------------------------------
current       |      2341 |    18 |       0.82
optimized     |      3127 |    19 |       0.85
fast          |      1843 |    17 |       0.78
accurate      |      4562 |    19 |       0.87
balanced      |      2654 |    18 |       0.83
```

#### C. Item Count Scaling
Measures how detection time scales with item count:
```
Category | Expected | Detected | Time (ms) | Time/Item (ms)
----------------------------------------------------------------
Small    |       19 |       18 |      2341 |            130
Medium   |       24 |       23 |      2856 |            124
Large    |       29 |       27 |      3421 |            127
Extreme  |       49 |       45 |      6234 |            139
```

#### D. Memory Usage
Tracks memory consumption during detection (if supported):
```
Memory Usage:
  Memory Increase: 12.3 MB
  Total Heap Size: 87 MB
```

### 5. Error Analysis

**Module**: `src/modules/cv-error-analysis.ts`

Provides detailed diagnostics for failed detections.

**Features**:
- Categorizes errors as false positives or false negatives
- Diagnoses probable causes for each error
- Identifies common error patterns
- Generates actionable recommendations
- Exports detailed JSON reports

**Example Usage**:
```typescript
import { analyzeDetectionErrors, formatErrorAnalysis } from './modules/cv-error-analysis';

const detected = [{ name: 'Wrench', confidence: 0.85 }, ...];
const expected = ['Wrench', 'Medkit', 'Tent', ...];

const analysis = analyzeDetectionErrors(detected, expected);
console.log(formatErrorAnalysis(analysis));
```

**Example Output**:
```
======================================================================
ERROR ANALYSIS REPORT
======================================================================

SUMMARY:
  Total Errors: 5
  False Positives: 2
  False Negatives: 3
  Error Rate: 26.3%

MOST PROBLEMATIC ITEMS:
  1. Tent
  2. Shovel
  3. Ice Cube

COMMON PATTERNS:
  - Low confidence threshold - consider adjusting confidence settings
  - Many items completely missed - check template quality

FALSE POSITIVES (Over-detected or Spurious):
  - Ice Crystal: Expected 1, Got 2 (+1) [conf: 0.68]
      → Duplicate detection - same item matched multiple times
      → Some detections have low confidence - may be false matches

FALSE NEGATIVES (Missed):
  - Tent: Expected 1, Got 0 (-1)
      → Item completely missed - template may be missing or incorrect
      → Item may be obscured by visual effects or particles
  - Shovel: Expected 1, Got 0 (-1)
      → Item completely missed - template may be missing or incorrect

RECOMMENDATIONS:
  1. HIGH PRIORITY: Many items completely missed - audit template library
  2. Review templates for: Tent, Shovel, Ice Cube
  3. High false negative rate - try "accurate" or "optimized" strategy
======================================================================
```

## Running Tests

### Unit Tests

```bash
# All unit tests with coverage
npm run test:unit

# OCR tests only
npm run test:ocr

# CV tests only
npm run test:cv

# Real image tests (requires node-canvas)
npm run test:cv:real
```

### E2E Tests

**Prerequisites**:
1. Start the dev server:
   ```bash
   npm run dev
   ```
2. In another terminal, run tests:
   ```bash
   npm run test:cv:accuracy
   ```

**Individual Test Suites**:
```bash
# Accuracy tests
npm run test:cv:accuracy

# Visual regression tests
npm run test:cv:visual

# Performance benchmarks
npm run test:cv:benchmark

# All CV E2E tests
npm run test:cv:full
```

## Adding New Test Images

1. **Capture Screenshot**:
   - Take a gameplay screenshot at a supported resolution
   - Save to `test-images/gameplay/pc-1080p/`
   - Naming convention: `level_<LVL>_<LANG>_<BIOME>.jpg`

2. **Create Ground Truth Entry**:
   Edit `test-images/gameplay/ground-truth.json`:
   ```json
   "pc-1080p/level_123_english_forest.jpg": {
     "character": "Unknown",
     "level": 123,
     "resolution": "1920x1080",
     "language": "English",
     "items": [
       "Wrench",
       "Medkit",
       "Tent",
       ...
     ],
     "equipped_weapons": [
       "Sword LVL 10",
       "Fire Staff LVL 8"
     ],
     "notes": "Description of test case"
   }
   ```

3. **Add to Test Suite**:
   Update `tests/e2e/cv-accuracy.spec.js`:
   ```javascript
   {
     filename: 'level_123_english_forest.jpg',
     expectedAccuracy: 75,
     difficulty: 'Medium',
     key: 'pc-1080p/level_123_english_forest.jpg'
   }
   ```

4. **Run Tests**:
   ```bash
   npm run test:cv:accuracy
   ```

## Test Coverage

Current test coverage for CV/OCR modules:

- **cv/core.ts**: 85% (initialization, cache management)
- **cv/detection.ts**: 78% (template matching, detection logic)
- **cv/color.ts**: 82% (color analysis, rarity detection)
- **cv/regions.ts**: 90% (grid detection, layout analysis)
- **ocr.ts**: 88% (text extraction, fuzzy matching)
- **cv-strategy.ts**: 92% (strategy management)
- **cv-error-analysis.ts**: NEW - not yet covered

## Continuous Integration

### GitHub Actions

Add to `.github/workflows/test.yml`:
```yaml
- name: Run CV Accuracy Tests
  run: |
    npm run dev &
    sleep 5
    npm run test:cv:accuracy
    npm run test:cv:benchmark
```

### Test Reports

Test results are saved to:
- `test-results/cv-accuracy/` - Accuracy reports
- `test-results/cv-benchmark/` - Performance reports
- `test-results/cv-visual/` - Visual regression snapshots

## Troubleshooting

### Tests Fail with "Image Not Found"

Check that test images exist:
```bash
ls test-images/gameplay/pc-1080p/
```

If missing, the images were not committed. Contact the maintainer.

### Tests Fail with "Dev Server Not Running"

Start the dev server:
```bash
npm run dev
```

Then run tests in another terminal.

### Low Accuracy on All Tests

Possible causes:
1. **Template library outdated**: Check if item icons have changed
2. **Game version mismatch**: Screenshots may be from newer version
3. **Detection thresholds too strict**: Try `optimized` strategy
4. **Canvas rendering issues**: Check browser console for errors

Debug steps:
```bash
# Enable debug mode
npm run dev

# In browser console:
window.cvDebug.enable()

# Upload a test image and check logs:
window.cvDebug.getLogs()
```

### Canvas Module Not Available

The `canvas` module is optional and only needed for Node.js-based tests:
```bash
npm install canvas
```

If installation fails, E2E tests in a real browser will still work.

## Performance Baselines

**Expected Detection Times** (on modern hardware):

| Resolution | Items | Expected Time | Max Acceptable |
|------------|-------|---------------|----------------|
| 720p       | <20   | 1.5-3s        | 5s             |
| 720p       | 20-30 | 2-4s          | 6s             |
| 800p       | 30-50 | 3-6s          | 10s            |
| 1080p      | <20   | 2-4s          | 6s             |
| 1080p      | 20-30 | 3-5s          | 8s             |

If significantly slower:
- Check browser performance profiler
- Review number of template comparisons
- Consider caching optimizations
- Use "fast" strategy for real-time detection

## Future Improvements

- [ ] Add test images for 1440p and 4K resolutions
- [ ] Create synthetic test cases for edge conditions
- [ ] Implement ML-based template generation
- [ ] Add automated template quality scoring
- [ ] Create visual diff tool for failed detections
- [ ] Add support for video stream testing
- [ ] Benchmark against YOLO/ML-based detection

## Contributing

When adding new CV features:
1. Add unit tests to appropriate `tests/unit/*.test.ts`
2. Add E2E test case to `tests/e2e/cv-*.spec.js`
3. Update ground truth if detection format changes
4. Run full test suite: `npm run test:cv:full`
5. Update this README with any new testing procedures

## Support

For issues with tests:
- Check existing issues: https://github.com/anthropics/MegaBonk/issues
- Review test logs in `test-results/`
- Enable debug mode: `window.cvDebug.enable()`
- Ask in Discord: #testing channel
