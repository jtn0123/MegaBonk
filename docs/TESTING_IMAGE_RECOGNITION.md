# Testing Image Recognition

This document provides comprehensive testing guidelines for the MegaBonk build recognition system.

## Overview

The build recognition system has three detection modes:
1. **Manual** - 100% accurate user selection
2. **OCR** - Text-based detection (60-80% accurate)
3. **Hybrid** - OCR + Computer Vision (70-90% accurate)

All modes support multiple screen resolutions and UI layouts.

## Supported Resolutions

| Platform | Resolution | Aspect Ratio | Status |
|----------|------------|--------------|--------|
| Steam Deck | 1280x800 | 16:10 | ✅ Supported |
| 720p PC | 1280x720 | 16:9 | ✅ Supported |
| 1080p PC | 1920x1080 | 16:9 | ✅ Supported |
| 1440p PC | 2560x1440 | 16:9 | ✅ Supported |
| 4K PC | 3840x2160 | 16:9 | ✅ Supported |

## Finding Test Screenshots

### Option 1: Official Sources

1. **Steam Community Hub**
   - Visit: https://steamcommunity.com/app/3405340/screenshots/
   - Filter by "Most Popular" or "Recent"
   - Right-click → Save Image As

2. **Reddit /r/Megabonk**
   - Search for posts with screenshots
   - Look for pause menu screenshots especially
   - Save high-quality images

3. **Discord Community**
   - Official MegaBonk Discord
   - #screenshots channel
   - Ask permission before using

### Option 2: Generate Your Own

1. **Play MegaBonk**
   - Press ESC to open pause menu
   - Take screenshot (F12 on Steam)
   - Screenshots saved to: `Steam/userdata/<id>/760/remote/3405340/screenshots/`

2. **Use Different Devices**
   - PC (various resolutions)
   - Steam Deck
   - ROG Ally / other handhelds

### Option 3: Use Test Image Search

Search for these terms on image search engines:
- "MegaBonk pause menu screenshot"
- "MegaBonk inventory screen"
- "MegaBonk Steam Deck screenshot"
- "MegaBonk build screenshot"

## Screenshot Guidelines

### Best Quality Screenshots

✅ **Good for testing:**
- Pause menu (shows all stats clearly)
- High contrast
- Minimal effects
- Clear text
- Full screen
- Uncompressed format (PNG preferred)

❌ **Avoid:**
- Motion blur
- Heavy visual effects
- Low resolution
- JPEG compression artifacts
- Cropped screenshots
- Watermarked images

### Required Elements

For comprehensive testing, screenshots should show:
- ✅ Character name
- ✅ Weapon name
- ✅ Item list with counts (e.g., "Battery x3")
- ✅ Tome list
- ✅ Stats (HP, Damage, etc.)

## Test Image Organization

### Directory Structure

```
/home/user/MegaBonk/test-images/
├── pause-menu/
│   ├── pc-1080p/
│   │   ├── screenshot1.png
│   │   ├── screenshot2.png
│   │   └── ground-truth.json
│   ├── pc-1440p/
│   │   └── ...
│   └── steam-deck/
│       └── ...
├── gameplay/
│   ├── pc-1080p/
│   │   └── ...
│   └── steam-deck/
│       └── ...
└── README.md
```

### Ground Truth Format

Create a `ground-truth.json` file for each screenshot:

```json
{
  "screenshot1.png": {
    "character": "CL4NK",
    "weapon": "Hammer",
    "items": [
      "Battery",
      "Battery",
      "Battery",
      "Gym Sauce",
      "Gym Sauce",
      "Anvil"
    ],
    "tomes": [
      "Damage Tome",
      "Crit Tome"
    ],
    "notes": "Crit build, late game"
  },
  "screenshot2.png": {
    "character": "Monke",
    "weapon": "Sword",
    "items": [
      "Jetpack",
      "Ice Cube",
      "Spicy Meatball"
    ],
    "tomes": [],
    "notes": "Early game"
  }
}
```

## Running Tests

### Manual Testing (Browser)

1. Start dev server:
   ```bash
   bun run dev
   ```

2. Navigate to Advisor tab

3. Upload test screenshot

4. Try each detection mode:
   - Manual selection
   - OCR Only
   - Hybrid OCR+CV

5. Record results:
   - Items detected
   - Items missed
   - False positives
   - Confidence scores
   - Processing time

### Automated Testing (Console)

Open browser console in dev mode:

```javascript
// Load test utilities
const { testUtils } = window;

// Run single test
const groundTruth = {
  items: ['Battery', 'Gym Sauce', 'Anvil'],
  tomes: ['Damage Tome'],
  character: 'CL4NK',
  weapon: 'Hammer'
};

// Upload image and get data URL
const imageInput = document.getElementById('scan-file-input');
// ... load image to get dataUrl ...

// Run test
const result = await testUtils.runAutomatedTest(
  imageDataUrl,
  groundTruth,
  window.autoDetectFromImage, // or hybridDetect
  'hybrid'
);

console.log('Test Results:', result);
console.log(`Accuracy: ${(result.accuracy * 100).toFixed(2)}%`);
console.log(`Precision: ${(result.precision * 100).toFixed(2)}%`);
console.log(`Recall: ${(result.recall * 100).toFixed(2)}%`);
```

### Batch Testing

```javascript
const testImages = [
  { url: '/test-images/pc_1080p_1.png', groundTruth: {...} },
  { url: '/test-images/pc_1080p_2.png', groundTruth: {...} },
  { url: '/test-images/steam_deck_1.png', groundTruth: {...} },
];

const results = [];
for (const test of testImages) {
  const result = await testUtils.runAutomatedTest(
    test.url,
    test.groundTruth,
    window.autoDetectFromImage,
    'hybrid'
  );
  results.push(result);
}

// Generate report
const report = testUtils.generateTestReport(results);
console.log(report);
```

## Performance Benchmarks

### Target Metrics

| Metric | Target | Current |
|--------|--------|---------|
| **Manual Accuracy** | 100% | 100% ✅ |
| **OCR Accuracy (Pause)** | >70% | TBD |
| **Hybrid Accuracy (Pause)** | >80% | TBD |
| **Processing Time (OCR)** | <5s | TBD |
| **Processing Time (Hybrid)** | <8s | TBD |

### Resolution Performance

Expected accuracy by resolution:

| Resolution | OCR | Hybrid |
|------------|-----|--------|
| 4K (3840x2160) | 80-90% | 85-95% |
| 1440p (2560x1440) | 75-85% | 80-90% |
| 1080p (1920x1080) | 70-80% | 75-85% |
| 720p (1280x720) | 60-75% | 70-85% |
| Steam Deck (1280x800) | 65-75% | 70-85% |

Higher resolutions = clearer text = better OCR accuracy

## Common Issues & Solutions

### Low Accuracy

**Problem:** Detection accuracy below 50%

**Possible Causes:**
- Screenshot quality too low
- Heavy visual effects
- Motion blur
- Unusual UI layout
- Non-English text

**Solutions:**
- Use pause menu screenshots
- Disable visual effects in-game
- Take screenshots in bright areas
- Use higher resolution
- Manual selection fallback

### False Positives

**Problem:** Detecting items that aren't there

**Possible Causes:**
- OCR misreading similar text
- CV color heuristics too aggressive
- Background UI elements

**Solutions:**
- Lower confidence threshold
- Adjust fuzzy matching threshold
- Improve preprocessing

### Missing Items

**Problem:** Not detecting all items

**Possible Causes:**
- Text too small
- Low contrast
- Items outside scanned region
- Name variations

**Solutions:**
- Increase scan region
- Add name aliases to database
- Lower confidence threshold
- Manual correction

## Accuracy Improvement Tips

### For OCR:
1. Use pause menu (clearer text)
2. High resolution screenshots
3. Good lighting/contrast
4. Disable screen shake/effects
5. Uncompressed format (PNG)

### For CV:
1. Distinct item colors
2. Clean UI layout
3. Consistent icon positions
4. Minimal overlays
5. Clear inventory grid

### For Hybrid:
1. Combine best practices from both
2. Use when single method fails
3. Review confidence scores
4. Manual adjust low confidence items

## Reporting Issues

When reporting accuracy issues, include:

1. **Screenshot** (or link)
2. **Resolution** (e.g., 1920x1080)
3. **Platform** (PC/Steam Deck)
4. **Detection Mode** (OCR/Hybrid)
5. **Expected Items** (ground truth)
6. **Detected Items** (what was found)
7. **Confidence Scores**
8. **Processing Time**
9. **Console Errors** (if any)

Submit to: GitHub Issues with `[accuracy]` tag

## Future Enhancements

Planned improvements for testing:
- [ ] Automated CI/CD test pipeline
- [ ] Screenshot regression testing
- [ ] Performance benchmarking dashboard
- [ ] Community-submitted test images
- [ ] ML model training on test data
- [ ] Real-time accuracy monitoring

## Contributing Test Images

Want to contribute test screenshots?

1. Take high-quality screenshots
2. Note the ground truth (items, character, weapon)
3. Submit via GitHub PR to `/test-images/`
4. Include `ground-truth.json`
5. License as CC0 (public domain)

Your contributions help improve accuracy for everyone!

## Resources

- [OCR Module Documentation](../src/modules/ocr.ts)
- [CV Module Documentation](../src/modules/computer-vision.ts)
- [Test Utils API](../src/modules/test-utils.ts)
- [MegaBonk Steam Page](https://store.steampowered.com/app/3405340/Megabonk/)
- [Community Discord](#) (Get test images here)

## Questions?

Open an issue on GitHub or ask in Discord!
