# CV Detection 0% Accuracy Investigation Report

**Date:** January 25, 2026
**Status:** Root causes identified

---

## Executive Summary

The CV detection system shows 0% accuracy due to **three compounding issues**:

1. **Grid calibration errors** - Crops were extracted from wrong screen positions
2. **Template/game visual mismatch** - Static templates look nothing like in-game icons
3. **Ground truth format mismatch** - Data format doesn't match game UI

---

## Root Cause Analysis

### Issue 1: Grid Calibration (Partially Fixed)

**Problem:** Calibration presets had incorrect `xOffset` values, causing crops to be extracted from the wrong screen locations (e.g., weapon slots instead of item slots).

**Evidence:**
- Crops at `x=463` showed background/weapon areas
- Actual item icons start at `x=486` for 1920x1080

**Partial Fix Applied:**
```javascript
// scripts/cv-benchmark.js - 1920x1080 preset
'1920x1080': {
    xOffset: 10,     // Was -122 (too far left)
    yOffset: 35,     // Was 57
    iconWidth: 58,   // Was 48
    iconHeight: 58,
    xSpacing: 12,    // Was 6
    // ...
}
```

**Remaining Work:**
- Other resolutions (1600x900, 2560x1440, etc.) need recalibration
- Auto-calibration would be more robust than manual presets

---

### Issue 2: Template/Game Visual Mismatch (Critical)

**Problem:** Static 64x64 PNG templates look completely different from in-game rendered icons.

| Aspect | Static Template | In-Game Icon |
|--------|----------------|--------------|
| Border | Cyan/teal | Rarity-colored (orange, purple, etc.) |
| Overlays | None | Stack count (x2, x3, etc.) |
| Rendering | Clean vector | Compressed, aliased |
| Similarity | ~25-30% max | (baseline) |

**Visual Comparison:**
- Template Wrench: Clean cyan-bordered tool icon
- Game Wrench: Orange-bordered with "x2" overlay, different rendering

**Evidence:**
Even with correct crop positions, best similarity scores were:
- SSIM: 5-9% (structural similarity near zero)
- Combined: 25-30% (far below 45% threshold)

**Recommended Fix:** Replace static templates with averaged training crops.

Training data exists at `data/training-data/crops/` with ~100+ validated samples from actual gameplay.

---

### Issue 3: Ground Truth Format Mismatch

**Problem:** Ground truth lists each item instance separately, but game UI stacks items.

**Ground Truth Format:**
```json
"items": ["Wrench", "Wrench", "Ice Crystal", ...]
```

**Actual Game UI:**
```
[Wrench x2] [Ice Crystal x1] ...
```

This causes slot position mismatches - expecting 2 Wrench slots but only 1 exists.

**Recommended Fix:** Update ground truth to list unique items per visible slot, not expanded instances.

---

## Metrics Before/After Partial Fix

| Stage | Correct Template in Top 5? | Best Score | Notes |
|-------|---------------------------|------------|-------|
| Original calibration | No | ~20% | Wrong crop positions |
| Fixed 1920x1080 calibration | Yes (#2) | 25% | Correct positions |
| Lower threshold (22%) | 1/12 TP | 8.3% F1 | Many false positives |

---

## Recommended Fix Priority

### Priority 1: Replace Templates with Training Data
Use existing training crops as templates instead of static PNGs:
```bash
# Existing training data
data/training-data/crops/wrench/wrench_001.png  # Actual game crop
data/training-data/crops/wrench/wrench_002.png
# vs
src/images/items/wrench.png  # Clean asset (doesn't match game)
```

**Implementation:**
1. For each item with 3+ training samples:
   - Load all validated crops
   - Resize to common size (64x64)
   - Average pixel values OR use best quality sample
2. Fall back to original templates for items without samples

### Priority 2: Fix Remaining Calibration Presets
- 1600x900 calibration is wrong
- 2560x1440 calibration needs verification
- Consider auto-calibration using hotbar border detection

### Priority 3: Fix Ground Truth Format
- Convert expanded format to unique slots
- Or modify benchmark to handle stacked items

---

## Files Modified

1. `scripts/cv-benchmark.js`
   - Added `--diagnostic` mode for detailed similarity breakdowns
   - Added `--extract` mode to save crops for visual inspection
   - Partially fixed 1920x1080 calibration preset
   - Added diagnostic comments

2. `test-images/debug-crops/` (created)
   - Contains extracted crops and templates for visual comparison

---

## Test Commands

```bash
# Run benchmark with diagnostic output
node scripts/cv-benchmark.js --quick --diagnostic

# Extract crops for visual inspection
node scripts/cv-benchmark.js --extract --image level_21

# View benchmark history
node scripts/cv-benchmark.js --history
```

---

## Conclusion

The 0% accuracy is not a subtle algorithmic issue - it's a fundamental data problem. The templates simply don't look like the game icons. No amount of threshold tuning or metric weighting can fix a visual mismatch this severe.

**Next Steps:**
1. Build script to generate templates from training data
2. Collect more training samples using CV Validator
3. Re-run benchmarks with new templates
