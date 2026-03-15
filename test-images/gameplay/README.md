# Gameplay Screenshots for Testing

This directory contains gameplay screenshots from MegaBonk for testing the image recognition system.

## Quick Start

### 1. Save the Screenshots

You have 4 screenshots that were provided in the chat. Save them to `pc-1080p/` folder with these names:

```
test-images/gameplay/pc-1080p/
├── level_33_early_game_english.png      (Screenshot 1 - Clean UI, 14 items)
├── level_803_late_game_russian.png      (Screenshot 2 - 70+ items, Cyrillic)
├── level_52_mid_game_spanish.png        (Screenshot 3 - 19 items, Spanish)
└── level_281_late_game_turkish_boss.png (Screenshot 4 - Boss fight, Turkish)
```

### 2. Run the App

```bash
cd /home/user/MegaBonk
bun run dev
```

Open http://localhost:5173 in your browser.

### 3. Test Detection

1. Navigate to **Advisor** tab
2. Scroll to **Build Scanner** section
3. Click **"Upload Screenshot"**
4. Select one of the saved screenshots
5. Click **"🎯 Hybrid: OCR + CV (Phase 3)"** button
6. Review detected items

### 4. Validate Accuracy

Open browser console (F12) and run:

```javascript
// Get detected items from the current scan
const detected = window.getCurrentScanResults(); // Returns DetectionResult[]

// Load ground truth for the screenshot
const groundTruth = [
  "First Aid Kit",
  "Wrench",
  "Feather",
  // ... add items from ground-truth.json
];

// Calculate accuracy
const metrics = window.testUtils.calculateAccuracyMetrics(detected, groundTruth);

console.log(`Accuracy: ${(metrics.accuracy * 100).toFixed(1)}%`);
console.log(`Precision: ${(metrics.precision * 100).toFixed(1)}%`);
console.log(`Recall: ${(metrics.recall * 100).toFixed(1)}%`);
console.log(`True Positives: ${metrics.truePositives}`);
console.log(`False Positives: ${metrics.falsePositives}`);
console.log(`False Negatives: ${metrics.falseNegatives}`);
```

## Screenshot Details

### Screenshot 1: Baseline Test (Level 33)
- **Difficulty**: ⭐ Easy
- **Items**: 14 items, single row
- **Language**: English
- **Visual Effects**: Minimal
- **Target Accuracy**: >80%
- **Best For**: Testing basic OCR and icon recognition

### Screenshot 2: Stress Test (Level 803)
- **Difficulty**: ⭐⭐⭐⭐⭐ Very Hard
- **Items**: 70+ items, 3 rows
- **Language**: Russian (Cyrillic characters)
- **Visual Effects**: Moderate
- **Target Accuracy**: >60%
- **Best For**: Testing detection limits, multi-row layouts, non-Latin characters

### Screenshot 3: Standard Test (Level 52)
- **Difficulty**: ⭐⭐ Medium
- **Items**: 19 items, single row
- **Language**: Spanish
- **Visual Effects**: Moderate combat effects
- **Target Accuracy**: >70%
- **Best For**: Testing real-world gameplay conditions

### Screenshot 4: Visual Chaos Test (Level 281)
- **Difficulty**: ⭐⭐⭐⭐ Hard
- **Items**: 23 items, 2 rows
- **Language**: Turkish
- **Visual Effects**: Heavy (boss fight)
- **Target Accuracy**: >70%
- **Best For**: Testing detection during intense visual effects

## Ground Truth Data

See `ground-truth.json` for complete item lists for each screenshot.

Each entry includes:
- Character level
- Resolution
- Language
- Complete item list with counts (e.g., "x3", "x5")
- Equipped weapons with levels
- Testing notes and expected difficulty

## Testing Workflow

### Basic Testing (Manual)
1. Upload screenshot
2. Run detection
3. Visually compare detected items with inventory
4. Note any missed items or false positives

### Advanced Testing (Automated)
```javascript
// Run automated test with ground truth validation
const result = await window.testUtils.runAutomatedTest(
    imageDataUrl,
    groundTruth,
    window.autoDetectFromImage,
    'hybrid'
);

console.log('Test Results:', result);
```

### Batch Testing (All Screenshots)
```javascript
// Test all 4 screenshots and generate report
const screenshots = [
    { name: 'level_33_early_game_english.png', path: '...' },
    { name: 'level_803_late_game_russian.png', path: '...' },
    // ... etc
];

for (const screenshot of screenshots) {
    const result = await window.testUtils.runAutomatedTest(
        screenshot.path,
        groundTruthData[screenshot.name].items,
        window.autoDetectFromImage,
        'hybrid'
    );

    console.log(`${screenshot.name}: ${(result.accuracy * 100).toFixed(1)}% accuracy`);
}
```

## Known Challenges

### Screenshot 1 (Easy)
✅ Clean UI
✅ English text
⚠️ Small icon size (may require CV template matching)

### Screenshot 2 (Very Hard)
⚠️ Cyrillic text (Tesseract may struggle)
⚠️ 3 rows of inventory (layout detection)
⚠️ 70+ items (performance impact)
⚠️ Many duplicates (count detection: x2, x3, x5)

### Screenshot 3 (Medium)
✅ Spanish text (Latin characters, should work)
⚠️ Combat visual effects
⚠️ Quest text may interfere with OCR

### Screenshot 4 (Hard)
⚠️ Heavy particle effects obscuring icons
⚠️ Turkish special characters (ğ, ı, ş, ü)
⚠️ Boss fight chaos
✅ FPS counter visible (good for resolution detection)

## Expected Results

### OCR Only Mode
- **Screenshot 1**: 60-70% accuracy (clean text)
- **Screenshot 2**: 40-50% accuracy (Cyrillic challenges)
- **Screenshot 3**: 55-65% accuracy (Spanish OK)
- **Screenshot 4**: 50-60% accuracy (visual effects)

### Hybrid Mode (OCR + CV)
- **Screenshot 1**: 75-85% accuracy
- **Screenshot 2**: 55-65% accuracy (stress test)
- **Screenshot 3**: 70-80% accuracy
- **Screenshot 4**: 65-75% accuracy

## Tuning Parameters Based on Results

If accuracy is **too low (<60%)**:
1. Lower OCR confidence threshold (currently 0.4)
2. Increase fuzzy match threshold
3. Add more CV color heuristics
4. Improve item icon templates

If **false positives are high**:
1. Increase OCR confidence threshold
2. Tighten fuzzy match scores
3. Add stricter CV validation

If **false negatives are high**:
1. Add more OCR preprocessing (contrast, sharpening)
2. Expand fuzzy match dictionary
3. Add more CV detection patterns

## Next Steps

After testing these 4 screenshots:

1. **Measure baseline accuracy** across all 4
2. **Identify problematic items** that are consistently missed
3. **Tune detection parameters** based on results
4. **Add pause menu screenshots** (shows full item grid)
5. **Test Steam Deck resolution** (1280x800)
6. **Test higher resolutions** (1440p, 4K)

## Related Documentation

- [SCREENSHOTS_ANALYSIS.md](./SCREENSHOTS_ANALYSIS.md) - Detailed visual analysis of each screenshot
- [ground-truth.json](./ground-truth.json) - Complete ground truth labels
- [../SCREENSHOT_SOURCES.md](../SCREENSHOT_SOURCES.md) - Where to find more test images
- [../../docs/TESTING.md](../../docs/TESTING.md) - Complete testing guide

## Contributing More Screenshots

To add more gameplay screenshots:

1. Save screenshot to appropriate resolution folder:
   - `pc-1080p/` for 1920x1080
   - `pc-1440p/` for 2560x1440
   - `steam-deck/` for 1280x800

2. Use descriptive filename:
   - Format: `level_<level>_<stage>_<language>.png`
   - Example: `level_150_mid_game_german.png`

3. Add ground truth entry to `ground-truth.json`:
```json
{
  "level_150_mid_game_german.png": {
    "character": "Character Name",
    "level": 150,
    "resolution": "1920x1080",
    "language": "German",
    "items": ["Item1", "Item2 (x3)", "Item3"],
    "notes": "Any special notes"
  }
}
```

4. Run tests and document accuracy

## Questions?

See the main [test-images README](../README.md) for general testing information.
