# English-Only Testing - Quick Start

## What You Need

**Only test Screenshot 1:** Level 33, English, 14 items (the first screenshot you provided)

Save it as: `level_33_early_game_english.png`

## Ground Truth for Screenshot 1

```json
{
  "character": "Unknown (blue character)",
  "level": 33,
  "items": [
    "First Aid Kit",
    "Wrench",
    "Feather",
    "Banana",
    "Cheese",
    "Portal",
    "Portal",
    "Portal",
    "Portal",
    "Burger",
    "Blue Orb",
    "Blue Orb",
    "Blue Orb",
    "Green Plant",
    "Boomerang",
    "Yellow Wrench",
    "Teal Wrench",
    "Chili Pepper",
    "Hoodie"
  ],
  "item_counts": {
    "Portal": 4,
    "Blue Orb": 3,
    "Others": 1
  }
}
```

## Quick Test Steps

### 1. Save Screenshot 1
- Right-click the first screenshot (Level 33, English)
- Save to: `/home/user/MegaBonk/test-images/gameplay/pc-1080p/level_33_early_game_english.png`

### 2. Start the App
```bash
cd /home/user/MegaBonk
bun run dev
```

### 3. Test Detection
1. Open http://localhost:5173
2. Go to **Advisor** tab → **Build Scanner**
3. Upload `level_33_early_game_english.png`
4. Click **"🎯 Hybrid: OCR + CV (Phase 3)"**

### 4. Validate Results (Browser Console)
```javascript
// Ground truth
const groundTruth = [
    "First Aid Kit", "Wrench", "Feather", "Banana", "Cheese",
    "Portal", "Portal", "Portal", "Portal",
    "Burger", "Blue Orb", "Blue Orb", "Blue Orb",
    "Green Plant", "Boomerang", "Yellow Wrench", "Teal Wrench",
    "Chili Pepper", "Hoodie"
];

// Get detected items
const detected = window.getCurrentScanResults();

// Calculate accuracy
const metrics = window.testUtils.calculateAccuracyMetrics(detected, groundTruth);
console.log(`Accuracy: ${(metrics.accuracy * 100).toFixed(1)}%`);
console.log(`Precision: ${(metrics.precision * 100).toFixed(1)}%`);
console.log(`Recall: ${(metrics.recall * 100).toFixed(1)}%`);
console.log(`True Positives: ${metrics.truePositives} / ${groundTruth.length}`);
console.log(`False Positives: ${metrics.falsePositives}`);
console.log(`False Negatives: ${metrics.falseNegatives}`);
```

## Expected Results

**Target Accuracy:** 75-85%

- Clean UI with minimal visual effects
- English text only (Tesseract handles English very well)
- 14 items total (including 4x Portal, 3x Blue Orb)
- Good lighting and contrast

## If Accuracy is Low

### Common Issues:

1. **OCR can't read item names**
   - Items are shown as icons, not text
   - Need to rely on CV (Computer Vision) color/shape detection

2. **Icons are too small**
   - Bottom inventory bar has small icons
   - May need to improve template matching

3. **Duplicate counts not detected**
   - "x4" and "x3" counters on Portal and Blue Orb
   - Need to detect these numbers

## What to Focus On

Since you only need English:
- Optimize OCR for English language only
- Focus on icon recognition (CV) rather than text
- Detect item count numbers (x2, x3, x4, etc.)
- Test with your own English gameplay screenshots

## Next Steps

1. Save Screenshot 1
2. Test detection
3. Report results (what was detected, what was missed)
4. I'll tune the parameters to improve accuracy
5. Add more of your own English screenshots for testing
