# Test Images Directory

This directory contains test screenshots for validating the image recognition system.

## Directory Structure

```
test-images/
├── pause-menu/           # Pause menu screenshots (best for testing)
│   ├── pc-1080p/         # 1920x1080 PC screenshots
│   ├── pc-1440p/         # 2560x1440 PC screenshots
│   ├── steam-deck/       # 1280x800 Steam Deck screenshots
│   └── ground-truth.json # Ground truth labels for all pause menu images
├── gameplay/             # In-game screenshots (partial UI)
│   ├── pc-1080p/
│   ├── steam-deck/
│   └── ground-truth.json
└── README.md            # This file
```

## Adding Test Images

### 1. Get Screenshots

**Recommended Sources:**
- Steam Community: https://steamcommunity.com/app/3405340/screenshots/
- Reddit /r/Megabonk
- Your own gameplay (F12 in Steam)

**Best Practices:**
- ✅ Use pause menu (shows all items clearly)
- ✅ PNG format (uncompressed)
- ✅ Full screen
- ✅ High contrast/brightness
- ❌ Avoid JPEG compression
- ❌ Avoid motion blur
- ❌ Avoid heavy visual effects

### 2. Organize by Resolution

Save to appropriate folder:
- `pause-menu/pc-1080p/` - 1920x1080 screenshots
- `pause-menu/pc-1440p/` - 2560x1440 screenshots
- `pause-menu/steam-deck/` - 1280x800 screenshots
- `gameplay/pc-1080p/` - Gameplay screenshots

### 3. Create Ground Truth

Edit `ground-truth.json` in the category folder:

```json
{
  "your_screenshot.png": {
    "character": "CL4NK",
    "weapon": "Hammer",
    "items": [
      "Battery",
      "Battery",
      "Battery",
      "Gym Sauce",
      "Anvil"
    ],
    "tomes": [
      "Damage Tome",
      "Crit Tome"
    ],
    "notes": "Optional description of the build or screenshot"
  }
}
```

**Important:**
- List items with duplicates (e.g., "Battery" appears 3 times for x3)
- Use exact item names from the game
- Character/weapon are optional
- Add notes for context

### 4. Name Files Descriptively

Good naming:
- `clank_crit_build_lategame.png`
- `monke_early_game_3items.png`
- `sir_oofie_tank_build.png`

Bad naming:
- `screenshot1.png`
- `image.png`
- `IMG_20250113.png`

## Running Tests

### Manual Test

1. Start dev server: `bun run dev`
2. Go to Advisor tab
3. Upload screenshot
4. Try detection modes
5. Compare to ground truth

### Console Test

```javascript
// In browser console
const result = await window.testUtils.runAutomatedTest(
  imageDataUrl,
  groundTruth,
  window.autoDetectFromImage,
  'hybrid'
);
console.log(`Accuracy: ${(result.accuracy * 100).toFixed(2)}%`);
```

## Example Ground Truth

See `pause-menu/ground-truth.json` for examples.

## Contributing

Want to add test images?

1. Add high-quality screenshots
2. Create ground truth entries
3. Test locally first
4. Submit PR to GitHub

## License

Test images should be:
- Your own screenshots, OR
- Community screenshots with permission, OR
- Public domain/Creative Commons

Please respect copyright!

## Questions?

See [TESTING_IMAGE_RECOGNITION.md](../docs/TESTING_IMAGE_RECOGNITION.md) for full documentation.
