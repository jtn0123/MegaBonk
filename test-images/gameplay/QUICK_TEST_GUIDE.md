# Quick OCR Testing Guide - Level 38 Screenshot

## Step 1: Save the Screenshot

Right-click on Screenshot 5 (Level 38 - Boss Portal) from the chat and save it as:
```
/home/user/MegaBonk/test-images/gameplay/pc-1080p/level_38_boss_portal_clean.png
```

## Step 2: Start the App

```bash
cd /home/user/MegaBonk
bun run dev
```

## Step 3: Open Browser and Test

1. Open http://localhost:5173
2. Click on the **Advisor** tab
3. Scroll to **Build Scanner** section
4. Click **"📸 Upload Screenshot"**
5. Select `level_38_boss_portal_clean.png`
6. Click **"🎯 Hybrid: OCR + CV (Phase 3)"**

## Step 4: Validate Results (Browser Console)

Press F12 to open developer console, then run:

```javascript
// Ground truth for Level 38
const groundTruth = [
    "Green Potion",
    "Banana", "Banana", "Banana",
    "Yellow Wrench",
    "Tomato",
    "Red Spiky Item",
    "Blue Portal",
    "Green Wrench",
    "Blue Penguin",
    "White Hand",
    "First Aid Kit", "First Aid Kit",
    "Blue Orb", "Blue Orb",
    "Green Plant",
    "Pink Item",
    "Yellow Item",
    "Yellow Gear",
    "Wrench",
    "First Aid Kit",
    "Yellow Puzzle"
];

// Get detected items (you'll need to expose this in your app)
const detected = window.lastScanResults || [];
const detectedNames = detected.map(d => d.entity?.name || d.name);

console.log("=== OCR Test Results ===");
console.log(`Expected: ${groundTruth.length} items`);
console.log(`Detected: ${detectedNames.length} items`);
console.log("");

// Find matches
const matches = groundTruth.filter(item => detectedNames.includes(item));
const missed = groundTruth.filter(item => !detectedNames.includes(item));
const falsePositives = detectedNames.filter(item => !groundTruth.includes(item));

console.log(`✅ Correctly Detected: ${matches.length}`);
console.log(`❌ Missed Items: ${missed.length}`);
console.log(`⚠️  False Positives: ${falsePositives.length}`);
console.log("");

const accuracy = (matches.length / groundTruth.length) * 100;
console.log(`📊 Accuracy: ${accuracy.toFixed(1)}%`);
console.log(`🎯 Target: 80-90%`);
console.log("");

if (missed.length > 0) {
    console.log("Missed items:");
    missed.forEach(item => console.log(`  - ${item}`));
}

if (falsePositives.length > 0) {
    console.log("\nFalse positives:");
    falsePositives.forEach(item => console.log(`  - ${item}`));
}
```

## Expected Results

**Target Accuracy**: 80-90% (since this is the cleanest screenshot)

**Why This Screenshot?**
- Level 38 - Boss Portal area
- Clean UI with no visual effects
- Stats panel fully visible
- 18 unique items (22 total with duplicates)
- Perfect baseline to validate OCR accuracy

**If Accuracy < 80%:**

1. **Check raw OCR text**: See what Tesseract actually extracted
   ```javascript
   console.log(window.lastOCRText);
   ```

2. **Check fuzzy matching threshold**: Currently set to 0.4 in ocr.ts
   - Lower threshold = more lenient matching
   - Consider 0.5 or 0.6 for better recall

3. **Check item names**: Ensure items.json has correct names
   ```bash
   cd /home/user/MegaBonk
   grep -i "first aid" data/items.json
   grep -i "banana" data/items.json
   ```

4. **Test individual items**: In browser console
   ```javascript
   import { detectItemsFromText } from './src/modules/ocr.ts';

   // Test specific items
   console.log(detectItemsFromText("First Aid Kit"));
   console.log(detectItemsFromText("Banana"));
   console.log(detectItemsFromText("Yellow Wrench"));
   ```

## Alternative: Quick Fuzzy Match Test

If you can't run the dev server, test fuzzy matching directly:

```bash
cd /home/user/MegaBonk
node scripts/test-ocr-simple.js
```

This tests the fuzzy matching logic with sample text, but not with actual OCR extraction.

## Next Steps After Testing

1. **Record accuracy**: Note the percentage for Level 38
2. **Identify patterns**: Which items are consistently missed?
3. **Test Screenshot 6**: Level 86 (intermediate difficulty)
4. **Test Screenshot 7**: Level 98 (stress test)
5. **Adjust parameters**: Based on results, tune OCR/CV settings

## Troubleshooting

**Issue**: Items not detected
- Check if item names in items.json match exactly
- Try lowering fuzzy match threshold
- Check if OCR is extracting text correctly

**Issue**: Too many false positives
- Raise confidence threshold
- Improve fuzzy matching (more strict)
- Filter by item location in screenshot

**Issue**: Duplicates not counted
- Implement regex for "x2", "x3", etc.
- Look for count numbers near item icons
- Use CV to detect repeated patterns
