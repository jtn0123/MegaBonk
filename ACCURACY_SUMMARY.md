# OCR Accuracy - Quick Summary

## What I've Tested ✅

**Tested:** Fuzzy matching only (simulation)
- Battery: 100% ✅
- Wrench: 100% ✅
- Multi-word items: 0% ❌ (not in database with those names)

**NOT Tested:** Real OCR with Tesseract
- Can't test without screenshots saved to disk
- Don't know what Tesseract actually extracts

## Current Accuracy

**Simulation:** 5.6% (because ground truth has wrong names)
**Real Accuracy:** Unknown (can't test yet)

## Why So Low?

Ground truth uses visual descriptions:
- "First Aid Kit" ❌ → Database has "Medkit"
- "Banana" ❌ → Database has "Oats" (?)
- "Burger" ❌ → Database has "Borgar"

## Top 5 Improvements (Prioritized)

### 1. Fix Ground Truth ⭐⭐⭐⭐⭐
**Impact:** Makes testing possible
**Time:** 1 hour
**Method:** Match screenshot items to actual database names

### 2. Add Item Aliases ⭐⭐⭐⭐
**Impact:** +20-30% accuracy
**Time:** 3 hours
```json
{
  "name": "Medkit",
  "aliases": ["First Aid Kit", "Health Kit"]
}
```

### 3. Tune Fuzzy Threshold ⭐⭐⭐⭐
**Impact:** +5-15% accuracy
**Time:** 30 minutes
**Current:** 0.4 → Try 0.5 or 0.6

### 4. Improve OCR Config ⭐⭐⭐⭐
**Impact:** +15-30% accuracy
**Time:** 4 hours
- Add PSM mode (page segmentation)
- Add preprocessing (contrast, grayscale)
- Add character whitelist

### 5. Case-Insensitive Matching ⭐⭐⭐
**Impact:** +5-10% accuracy
**Time:** 15 minutes
**Fix:** "WRENCH" → "Wrench"

## Expected Results

| After Fixes | Clean UI | Medium | Chaotic |
|-------------|----------|--------|---------|
| Baseline | 60-75% | 55-65% | 50-60% |
| + Top 5 | 80-90% | 70-80% | 65-75% |
| + All 10 | 90-95% | 80-88% | 70-80% |

## Next Steps

1. Fix ground truth (1 hour)
2. Test with real screenshot
3. Measure real baseline
4. Add aliases (3 hours)
5. Re-test

## Full Details

See: ACCURACY_IMPROVEMENT_RESEARCH.md
