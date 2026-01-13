# Testing Guide for 3 New English Screenshots

## Quick Start

```bash
# Check screenshot status
cd /home/user/MegaBonk/test-images/gameplay
./test-new-screenshots.sh

# Start app and test
cd /home/user/MegaBonk
bun run dev
# Open http://localhost:5173 → Advisor → Build Scanner
```

## Screenshots Overview

### Screenshot 5: Level 38 - Boss Portal ⭐ BASELINE TEST
- **Filename**: `level_38_boss_portal_clean.png`
- **Items**: 18 items (with some duplicates)
- **Difficulty**: Easy - Clean UI, excellent visibility
- **Target Accuracy**: 80-90%
- **Best For**: Establishing baseline accuracy, tuning OCR parameters

**Why This Is Important:**
- Cleanest UI of all screenshots
- Stats panel fully visible (can test OCR on quest text)
- No visual effects to obscure items
- Perfect for finding which items OCR can't recognize

### Screenshot 6: Level 86 - Roberto in Crypt ⭐⭐ INTERMEDIATE TEST
- **Filename**: `level_86_roberto_crypt.png`
- **Items**: 21 items with many duplicates (x2, x3, x4, x5)
- **Difficulty**: Medium - Indoor lighting, purple effects
- **Target Accuracy**: 70-80%
- **Best For**: Testing duplicate count detection

**Why This Is Important:**
- Character name "Roberto" visible (tests character detection)
- Many items with high counts: x4, x5
- Tests if system can read count numbers
- Indoor/dungeon lighting conditions

### Screenshot 7: Level 98 - Final Boss ⭐⭐⭐⭐⭐ STRESS TEST
- **Filename**: `level_98_final_boss.png`
- **Items**: 22 items with high counts (up to x6)
- **Difficulty**: Very Hard - Heavy visual effects, fire, particles
- **Target Accuracy**: 60-70%
- **Best For**: Validating detection under extreme conditions

**Why This Is Important:**
- Worst-case scenario for detection
- Heavy fire/particle effects
- Red/orange color bias
- Tests robustness of the system

## Testing Workflow

### Step 1: Save Screenshots

Right-click each screenshot from the chat and save to:
```
test-images/gameplay/pc-1080p/level_38_boss_portal_clean.png
test-images/gameplay/pc-1080p/level_86_roberto_crypt.png
test-images/gameplay/pc-1080p/level_98_final_boss.png
```

### Step 2: Start Testing

```bash
cd /home/user/MegaBonk
bun run dev
```

Open: http://localhost:5173

### Step 3: Test Each Screenshot

For each screenshot:
1. Go to **Advisor** tab → **Build Scanner**
2. Click **"📸 Upload Screenshot"**
3. Select the screenshot
4. Click **"🎯 Hybrid: OCR + CV (Phase 3)"**
5. Review detected items

### Step 4: Validate Accuracy

Open browser console (F12) and run:

#### For Screenshot 5 (Level 38):
```javascript
const groundTruth = [
    "Green Potion", "Banana", "Banana", "Banana",
    "Yellow Wrench", "Tomato", "Red Spiky Item",
    "Blue Portal", "Green Wrench", "Blue Penguin",
    "White Hand", "First Aid Kit", "First Aid Kit",
    "Blue Orb", "Blue Orb", "Green Plant", "Pink Item",
    "Yellow Item", "Yellow Gear", "Wrench",
    "First Aid Kit", "Yellow Puzzle"
];

const detected = window.getCurrentScanResults();
const metrics = window.testUtils.calculateAccuracyMetrics(detected, groundTruth);

console.log(`Screenshot 5 Results:`);
console.log(`  Accuracy: ${(metrics.accuracy * 100).toFixed(1)}%`);
console.log(`  Precision: ${(metrics.precision * 100).toFixed(1)}%`);
console.log(`  Recall: ${(metrics.recall * 100).toFixed(1)}%`);
console.log(`  Detected: ${detected.length} items`);
console.log(`  Expected: ${groundTruth.length} items`);
console.log(`  True Positives: ${metrics.truePositives}`);
console.log(`  False Positives: ${metrics.falsePositives}`);
console.log(`  False Negatives: ${metrics.falseNegatives}`);
```

#### For Screenshot 6 (Level 86):
```javascript
const groundTruth = [
    "Green Slime", "Green Slime", "Green Slime", "Green Slime", // x4
    "Blue Portal", "Blue Portal", "Blue Portal", "Blue Portal", "Blue Portal", // x5
    "Green Wrench", "Green Wrench", "Green Wrench", "Green Wrench", // x4
    "Pink Item", "Pink Item", // x2
    "Purple Potion", "Purple Potion", // x2
    "Pink Demon", "Pink Demon", // x2
    "Burger", "Burger", "Burger", "Burger", "Burger", // x5
    // ... continue for all items
];

const detected = window.getCurrentScanResults();
const metrics = window.testUtils.calculateAccuracyMetrics(detected, groundTruth);

console.log(`Screenshot 6 Results:`);
console.log(`  Accuracy: ${(metrics.accuracy * 100).toFixed(1)}%`);
console.log(`  Duplicate Detection: ${detected.filter(d => d.rawText.includes('x')).length} counts found`);
```

#### For Screenshot 7 (Level 98):
```javascript
const groundTruth = [
    "Green Slime",
    "Pink Item",
    "Orange Item",
    "Yellow Item",
    "Red Soda", "Red Soda", "Red Soda", "Red Soda", "Red Soda", // x5
    "Orange Item", "Orange Item", "Orange Item", "Orange Item", "Orange Item", "Orange Item", // x6
    // ... continue for all items
];

const detected = window.getCurrentScanResults();
const metrics = window.testUtils.calculateAccuracyMetrics(detected, groundTruth);

console.log(`Screenshot 7 Results (Stress Test):`);
console.log(`  Accuracy: ${(metrics.accuracy * 100).toFixed(1)}%`);
console.log(`  Visual Effects Impact: ${detected.length < groundTruth.length ? 'Missed some items' : 'Good detection!'}`);
```

## Expected Results Summary

| Screenshot | Items | Duplicates | Target | Notes |
|------------|-------|------------|--------|-------|
| Level 38   | 18    | Some x2    | 80-90% | Baseline - should be highest accuracy |
| Level 86   | 21    | Many x4,x5 | 70-80% | Tests duplicate detection |
| Level 98   | 22    | Up to x6   | 60-70% | Stress test - heavy effects |

## Using Results to Improve Detection

### If Screenshot 5 (Baseline) < 80%

**Problem**: Basic OCR not working well

**Solutions**:
1. Lower fuzzy match threshold (currently 0.4)
2. Add item name synonyms to database
3. Check if Tesseract is loading correctly
4. Verify game items.json has correct names

**Test**:
```javascript
// Check what OCR is extracting
const text = await window.extractTextFromImage(imageDataUrl);
console.log('Raw OCR text:', text);
```

### If Screenshot 6 Misses Duplicates

**Problem**: Not detecting x2, x3, x4, x5 counts

**Solutions**:
1. Add regex to detect count numbers: `x\d+`
2. Look for small text near item icons
3. Use CV to detect repeated icon patterns
4. Adjust OCR region to include count areas

**Test**:
```javascript
// Check if counts are being extracted
const detected = window.getCurrentScanResults();
detected.forEach(d => {
    console.log(`${d.entity.name}: confidence=${d.confidence}, text="${d.rawText}"`);
});
```

### If Screenshot 7 (Stress) < 60%

**Problem**: Visual effects overwhelming detection

**Solutions**:
1. Add preprocessing: increase contrast, reduce red/orange
2. Use CV more heavily (boost CV confidence)
3. Filter by region: ignore center of screen (boss area)
4. Add template matching for known item icons

**Test**:
```javascript
// Check CV contribution
const cvResults = await window.detectItemsWithCV(imageDataUrl);
const ocrResults = await window.autoDetectFromImage(imageDataUrl);

console.log('CV found:', cvResults.length);
console.log('OCR found:', ocrResults.length);
```

## Training with These Screenshots

### Use Screenshot 5 to Build OCR Dictionary

1. **Manually label every item** you see
2. **Run detection** and note which items are missed
3. **Add aliases** for missed items:
   ```typescript
   // In ocr.ts or items.json
   {
       "name": "First Aid Kit",
       "aliases": ["First Aid", "Aid Kit", "Health Pack", "Medkit"]
   }
   ```
4. **Re-test** until 80%+ accuracy

### Use Screenshot 6 for Count Detection

1. **Check OCR output** for count numbers
2. **Add count detection logic**:
   ```typescript
   const countMatch = rawText.match(/x(\d+)/);
   if (countMatch) {
       const count = parseInt(countMatch[1]);
       // Add item `count` times to results
   }
   ```
3. **Verify** counts match ground truth

### Use Screenshot 7 to Stress Test

1. **Don't tune specifically for this** - it's meant to be hard
2. **Use it to validate** that changes to Screenshot 5/6 don't break edge cases
3. **If accuracy drops below 50%**, add color filtering

## Next Steps After Testing

1. **Record Results**:
   ```
   Screenshot 5: XX% accuracy
   Screenshot 6: XX% accuracy
   Screenshot 7: XX% accuracy
   ```

2. **Identify Patterns**:
   - Which items are consistently missed?
   - Which items are false positives?
   - Are counts being detected?

3. **Prioritize Improvements**:
   - Fix Screenshot 5 first (baseline)
   - Then Screenshot 6 (duplicates)
   - Then Screenshot 7 (stress)

4. **Iterate**:
   - Make changes to OCR/CV code
   - Re-run tests
   - Measure improvement
   - Repeat until targets met

## Success Criteria

✅ **Screenshot 5**: 80%+ accuracy (baseline working)
✅ **Screenshot 6**: 70%+ accuracy (duplicates working)
✅ **Screenshot 7**: 60%+ accuracy (robust to effects)

Once all 3 meet targets, the system is ready for production!

## Files Reference

- Ground Truth: `test-images/gameplay/ground-truth.json`
- Test Script: `test-images/gameplay/test-new-screenshots.sh`
- Analysis: `test-images/gameplay/SCREENSHOTS_5_6_7_ANALYSIS.md`
- Main App: `src/modules/scan-build.ts`, `src/modules/ocr.ts`, `src/modules/computer-vision.ts`
