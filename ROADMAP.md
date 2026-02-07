# MegaBonk Roadmap

This document tracks planned improvements and known issues for future development.

---

## 🚧 Blocking Issues

### Template Replacement (Critical Priority)

**Status:** Blocking all CV detection accuracy improvements  
**Related:** [CV_INVESTIGATION_REPORT.md](./CV_INVESTIGATION_REPORT.md), [DETECTION_ACCURACY_REPORT.md](./DETECTION_ACCURACY_REPORT.md)

#### The Problem

Current templates are **static PNG assets** that look completely different from in-game rendered icons:

| Aspect | Current Templates | In-Game Icons |
|--------|------------------|---------------|
| Border | Cyan/teal | Rarity-colored (orange, purple, gold, etc.) |
| Overlays | None | Stack count overlays (x2, x3, etc.) |
| Rendering | Clean vector graphics | Compressed, aliased game rendering |
| **Max Similarity** | — | **25-30%** achievable |

The CV detection system requires **45%+ similarity** to match items. With templates maxing out at 25-30% similarity, **no amount of threshold tuning can fix this**.

#### Current Benchmark Results

- **Accuracy:** 0% across all test images
- **F1 Score:** 0
- **Root Cause:** Templates don't visually match what the game actually renders

#### Recommended Solution

Replace static templates with templates generated from actual game screenshot crops:

1. **Use existing training data** at `data/training-data/crops/`
   - ~100+ validated samples from actual gameplay
   - Already has item labels and quality ratings

2. **Template generation approach:**
   - For each item with 3+ training samples:
     - Load all validated crops
     - Resize to common size (64x64)
     - Average pixel values OR use best quality sample
   - Fall back to original templates for items without samples

3. **Alternative:** Capture new templates directly from game with correct rendering

#### Files Affected

- `src/images/items/*.png` — Current static templates
- `data/training-data/crops/` — Source for new templates
- `scripts/cv-benchmark.js` — Validation after fix

---

## 📋 Planned Improvements

### Grid Calibration Verification

**Priority:** High (after template fix)

Verified calibrations:
- ✅ 1920x1080 — Hand-checked and fixed
- ✅ 2560x1440 — Verified

Needs verification:
- ⚠️ 1280x720 (720p)
- ⚠️ 1280x800 (Steam Deck)
- ⚠️ 1600x900 (900p)

Consider implementing auto-calibration using hotbar border detection.

### Ground Truth Format

**Priority:** Medium

Current format lists each item instance separately, but game UI stacks items:

```json
// Current (expanded)
"items": ["Wrench", "Wrench", "Ice Crystal", ...]

// Game UI (stacked)
[Wrench x2] [Ice Crystal x1] ...
```

This causes slot position mismatches in benchmarks.

### Low-Risk Tuning (Post-Template Fix)

Once templates are fixed, apply these improvements:

1. **Enable experimental empty detection methods**
   - `useHistogram` — Few colors = empty
   - `useCenterEdge` — Uniform center = empty

2. **Correct rarity threshold logic**
   - Common items should be more lenient (many look similar)
   - Legendary items should be stricter (unique visuals)

3. **Add similarity floor check**
   - Reject matches below absolute minimum (0.35)

4. **OCR accuracy improvements**
   - Add character whitelist for stack counts (`0123456789x`)

---

## 📊 Target Metrics

After template replacement is complete:

| Metric | Current | Target |
|--------|---------|--------|
| F1 Score | 0% | >85% |
| Precision | 0% | >85% |
| Recall | 0% | >80% |
| False Positives | N/A | <2% |
| Match Rate | 0% | >85% |

---

## 📚 Related Documentation

- [CV_INVESTIGATION_REPORT.md](./CV_INVESTIGATION_REPORT.md) — Initial root cause analysis (Jan 25, 2026)
- [DETECTION_ACCURACY_REPORT.md](./DETECTION_ACCURACY_REPORT.md) — Detailed investigation with tuning recommendations (Jan 31, 2026)

---

*Last updated: January 31, 2026*
