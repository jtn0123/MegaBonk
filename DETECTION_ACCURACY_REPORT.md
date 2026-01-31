# Detection Accuracy Investigation Report

**Date:** January 31, 2026  
**Investigator:** Subagent (investigate-detection)  
**Status:** Investigation complete, recommendations ready

---

## Executive Summary

The CV detection system currently shows **0% accuracy** across all benchmark runs. This is not a tuning problem—it's a fundamental **data mismatch** between static templates and in-game rendered icons. However, there are several low-risk improvements that can be made while the template problem is addressed.

---

## 1. Test Results & Accuracy Metrics

### Benchmark History (`data/benchmark-history.json`)

| Run | Images | Total Items | Accuracy | F1 Score | Avg Time/Image |
|-----|--------|-------------|----------|----------|----------------|
| run_1769013351259 | 24 | 792 | **0%** | 0 | 82ms |

**Per-image breakdown:**
- All test images show 0 true positives
- False positives range from 0-2 per image
- False negatives = 100% of expected items (total miss)

### Root Cause (from CV_INVESTIGATION_REPORT.md)

The templates (static 64x64 PNGs) look **completely different** from in-game icons:

| Aspect | Static Template | In-Game Icon |
|--------|----------------|--------------|
| Border | Cyan/teal | Rarity-colored (orange, purple, etc.) |
| Overlays | None | Stack count (x2, x3, etc.) |
| Rendering | Clean vector | Compressed, aliased |
| **Max Similarity** | — | **25-30%** (below 45% threshold) |

---

## 2. CV Strategy Configurations & Reported Accuracy

### Available Presets (`src/modules/cv-strategy.ts`)

| Strategy | Color Filtering | Confidence | Multi-Pass | Expected F1 |
|----------|-----------------|------------|------------|-------------|
| `current` | color-first | adaptive-rarity | ✓ | 80-85% (theoretical) |
| `optimized` | rarity-first | adaptive-rarity | ✓ | 90-95% (theoretical) |
| `fast` | rarity-first | fixed | ✗ | 82-88% (theoretical) |
| `accurate` | rarity-first | adaptive-gap | ✓ | 92-97% (theoretical) |
| `balanced` | rarity-first | adaptive-rarity | ✓ | 88-92% (theoretical) |

**Reality:** All strategies achieve 0% due to template mismatch.

### Confidence Thresholds (Adaptive-Rarity)

```typescript
// Current configuration - thresholds by rarity
common:    { pass1: 0.88, pass2: 0.75, pass3: 0.65 }  // Strictest
uncommon:  { pass1: 0.85, pass2: 0.72, pass3: 0.62 }
rare:      { pass1: 0.82, pass2: 0.68, pass3: 0.58 }
epic:      { pass1: 0.78, pass2: 0.65, pass3: 0.55 }
legendary: { pass1: 0.75, pass2: 0.62, pass3: 0.52 }  // Most lenient
```

**Issue:** Even the most lenient threshold (0.52) is 2x higher than max achievable similarity (0.25-0.30).

---

## 3. TODO Comments & Known Issues

### From Codebase Grep

| File | Line | Issue |
|------|------|-------|
| `cv/detection-pipeline/ocr-count.ts` | 48 | "TODO: For better OCR accuracy, use createWorker with setParameters" |

### Disabled Experimental Features (`cv/color-utils.ts`)

```typescript
EMPTY_DETECTION_CONFIG = {
  methods: {
    useVariance: true,           // ✓ Active
    useConfidenceThreshold: true, // ✓ Active
    useSaturation: true,          // ✓ Active
    useHistogram: false,          // ✗ Disabled (experimental)
    useCenterEdge: false,         // ✗ Disabled (experimental)
  },
}
```

### Known Issues from Investigation Report

1. **Template/Game Visual Mismatch** - Critical, blocking
2. **Grid Calibration** - Partial fix applied for 1920x1080
3. **Ground Truth Format** - Lists expanded items, not unique slots

---

## 4. Recent Commits Related to Detection

| Commit | Description | Impact |
|--------|-------------|--------|
| `93ad817` | refactor(cv): split detection-pipeline.ts | Code organization |
| `0a076a4` | refactor(cv): split detection-grid.ts | Code organization |
| `0e7c7d6` | refactor(cv): split detection-core.ts | Code organization |
| `3823857` | refactor(cv): split color.ts | Code organization |
| `04cf460` | refactor(cv): split auto-grid-detection.ts | Code organization |
| `e50f753` | refactor: split detection.ts (2600 lines) | Code organization |
| `8439e89` | fix(memory): memory leak in cv/state | Bug fix |
| `f80f2ed` | fix(modules): 6 logic bugs in cv modules | Bug fix |
| `3086635` | fix(cv): improve error handling | Bug fix |

**Observation:** Recent work focused on refactoring and bug fixes, not accuracy improvements.

---

## 5. Edge Cases & Failure Modes

### From Ground Truth Analysis

| Resolution | Status | Notes |
|------------|--------|-------|
| 1920x1080 | ✓ Verified | Grid calibration hand-checked |
| 2560x1440 | ✓ Verified | Smaller icons than 1080p (counter-intuitive) |
| 1280x720 | ⚠ Default | Needs verification |
| 1280x800 | ⚠ Calculated | Needs verification |
| 1600x900 | ⚠ Calculated | Needs verification |

### Documented Failure Modes

1. **Multi-language screenshots** - Spanish, Russian, Turkish screenshots in test set
2. **High item counts** - level_803 has 43 items (stress test)
3. **Various biomes** - Desert, Forest, Ocean, Snow, Hell, Crypt
4. **Stack count overlays** - Items display "x2", "x3" which templates don't have

---

## 6. Confidence Threshold Tuning Analysis

### Current State

With max similarity at 25-30%, no threshold tuning will help significantly.

### If Templates Were Fixed (Theoretical Tuning)

| Change | Rationale | Risk |
|--------|-----------|------|
| Lower `pass3` thresholds by 0.05 | Increase recall for edge cases | Low - only affects low-confidence matches |
| Swap common/legendary thresholds | Common items are similar; legendaries are unique | Medium - logic inversion |
| Enable `useHistogram` | Additional empty cell detection | Low - experimental but isolated |
| Enable `useCenterEdge` | Better icon vs background discrimination | Low - experimental but isolated |

---

## 7. Low-Risk Improvements

### Immediate (No Code Changes Required)

1. **Run benchmark with `--diagnostic` flag** to capture current similarity distributions
   ```bash
   node scripts/cv-benchmark.js --quick --diagnostic
   ```

2. **Extract crops for visual inspection**
   ```bash
   node scripts/cv-benchmark.js --extract --image level_21
   ```

### Code Changes (Low Risk)

#### 7.1 Enable Experimental Empty Detection Methods

**File:** `src/modules/cv/color-utils.ts`  
**Change:** Enable `useHistogram` and `useCenterEdge`

```typescript
// BEFORE
methods: {
  useHistogram: false,     // #3: Few colors = empty (experimental)
  useCenterEdge: false,    // #7: Uniform = empty (experimental)
}

// AFTER
methods: {
  useHistogram: true,      // Enable for better empty detection
  useCenterEdge: true,     // Enable for better icon discrimination
}
```

**Risk:** Low - these only affect empty cell detection, not template matching.

#### 7.2 Adjust Rarity Threshold Logic

**File:** `src/modules/cv-strategy.ts`  
**Rationale:** Current thresholds are backwards—common items should be more lenient (they look similar), legendaries should be stricter (unique visuals).

```typescript
// CURRENT (backwards logic)
common:    { pass1: 0.88, pass2: 0.75, pass3: 0.65 }  // Strictest
legendary: { pass1: 0.75, pass2: 0.62, pass3: 0.52 }  // Most lenient

// SUGGESTED (corrected logic)
common:    { pass1: 0.75, pass2: 0.62, pass3: 0.52 }  // Most lenient (many similar items)
uncommon:  { pass1: 0.78, pass2: 0.65, pass3: 0.55 }
rare:      { pass1: 0.82, pass2: 0.68, pass3: 0.58 }
epic:      { pass1: 0.85, pass2: 0.72, pass3: 0.62 }
legendary: { pass1: 0.88, pass2: 0.75, pass3: 0.65 }  // Strictest (unique visuals)
```

**Risk:** Medium - changes detection behavior, but follows correct logic.

#### 7.3 Add Similarity Floor Check

**File:** `src/modules/cv-enhanced/matching.ts`  
**Rationale:** Reject matches below a minimum floor regardless of thresholds.

```typescript
// In matchCell function, after calculating similarity:
const SIMILARITY_FLOOR = 0.35;  // Absolute minimum for any match
if (similarity < SIMILARITY_FLOOR) {
  return null;  // Reject obviously bad matches
}
```

**Risk:** Low - prevents clearly wrong matches.

#### 7.4 OCR Accuracy Improvement

**File:** `src/modules/cv/detection-pipeline/ocr-count.ts`  
**Address TODO at line 48:**

```typescript
// TODO: For better OCR accuracy, use createWorker with setParameters
// Implement: Add character whitelist for stack counts
const worker = await createWorker();
await worker.setParameters({
  tessedit_char_whitelist: '0123456789x',  // Only numbers and 'x' for counts
});
```

**Risk:** Low - isolated to OCR functionality.

---

## 8. Recommended Priority Actions

### Priority 1: Template Replacement (NOT a tuning fix)

This is the **blocking issue**. Without templates that match in-game icons, no amount of tuning will help.

**Options:**
1. Extract crops from real screenshots and average them
2. Use training data (if available) to generate templates
3. Capture new templates directly from game with correct rendering

### Priority 2: Grid Calibration Verification

Test and verify calibration presets for:
- 1280x720 (720p)
- 1280x800 (Steam Deck)
- 1600x900 (900p)

### Priority 3: Apply Low-Risk Tuning (Section 7)

After template fix is in place, apply the tuning changes to improve accuracy further.

---

## 9. Metrics to Track

Once templates are fixed, track these metrics to measure improvement:

| Metric | Current | Target |
|--------|---------|--------|
| F1 Score | 0% | >85% |
| Precision | 0% | >85% |
| Recall | 0% | >80% |
| False Positives | N/A | <2% |
| Match Rate | 0% | >85% |
| Avg Confidence | N/A | >0.75 |

---

## Appendix: File Locations

| Purpose | Path |
|---------|------|
| Strategy config | `src/modules/cv-strategy.ts` |
| Matching logic | `src/modules/cv-enhanced/matching.ts` |
| Similarity algorithms | `src/modules/cv-enhanced/similarity.ts` |
| Color detection | `src/modules/cv/color-matching.ts` |
| Color utilities | `src/modules/cv/color-utils.ts` |
| Empty cell detection | `src/modules/cv/color-matching.ts` |
| Grid presets | `data/grid-presets.json` |
| Benchmark script | `scripts/cv-benchmark.js` |
| Test images | `test-images/gameplay/` |
| Ground truth | `test-images/gameplay/ground-truth.json` |
| Previous investigation | `CV_INVESTIGATION_REPORT.md` |

---

**Report generated by investigate-detection subagent**
