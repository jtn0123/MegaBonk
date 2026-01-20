# MegaBonk Screenshot Sources for Testing

This document lists where to find MegaBonk screenshots for testing the image recognition system.

## Steam Community Screenshots

The Steam Community has an active screenshot gallery:
- **Main Gallery**: [Steam Community Screenshots](https://steamcommunity.com/app/3405340/screenshots/)

### High-Award Screenshots (Likely High Quality)

These screenshots have received many community awards, suggesting they show interesting builds:

1. **Screenshot by джеффри энштейн** (16 awards)
   - URL: `https://images.steamusercontent.com/ugc/13302485804566982940/7A3BF756CA031A0266921FF2C30DEE7C71F4ACCF/`

2. **Screenshot by Manvyr** (11 awards)
   - URL: `https://images.steamusercontent.com/ugc/15324188975914571822/ABC284744FC95DCD25603701F103DFB6881F8702/`

3. **Screenshot by Manvyr** (11 awards)
   - URL: `https://images.steamusercontent.com/ugc/18090689790623888638/90F794A84BB89236039B1419EB02F3774BE66E3B/`

4. **Screenshot by Manvyr** (10 awards)
   - URL: `https://images.steamusercontent.com/ugc/11847515003763789320/821E38F16A8D059FB0234B002FA4421C5014CAE9/`

5. **Screenshot by ♠ Kitsu ♠** (10 awards)
   - URL: `https://images.steamusercontent.com/ugc/16049154963040082762/CD00ED84FFD64EAB3674B7278393E9FDD233EB59/`

6. **"Todos los personajes" by Raxziel** (8 awards)
   - URL: `https://images.steamusercontent.com/ugc/18415854389953042110/B9246DB0581C9775C7042F4F448DE8F542DE693E/`

## Automated Scraping Tools

We provide automated scripts to scrape and analyze Steam Community screenshots.

### Quick Start

```bash
# Full pipeline: scrape, analyze, organize, and generate labels
npm run steam:pipeline:full

# Or run each step separately:
npm run steam:scrape          # Download screenshots from Steam
npm run steam:analyze         # Analyze downloaded screenshots
npm run steam:pipeline        # Run full pipeline with default options
```

### Available Scripts

#### 1. Steam Screenshot Scraper
Downloads screenshots from Steam Community automatically.

```bash
npx tsx scripts/steam-screenshot-scraper.ts [options]

Options:
  --limit <n>       Max screenshots to download (default: 50)
  --sort <type>     Sort: trending, mostrecent, toprated (default: trending)
  --output <dir>    Output directory (default: test-images/gameplay/steam-scraped)
  --skip-existing   Skip already downloaded files
  --dry-run         Show what would be downloaded
```

#### 2. Screenshot Analyzer
Analyzes screenshots and scores them for CV training usefulness.

```bash
npx tsx scripts/analyze-screenshots.ts [options]

Options:
  --input <dir>     Input directory (default: test-images/gameplay/steam-scraped)
  --threshold <n>   Usefulness threshold 0-100 (default: 50)
  --move-useful     Move useful images to steam-community folder
  --verbose         Show detailed analysis
```

Classification:
- **useful**: Score >= threshold, good for CV training
- **maybe**: Needs manual review (borderline score)
- **not_useful**: Not suitable for training

#### 3. Full Pipeline
Combines scraping, analysis, organization, and label generation.

```bash
npx tsx scripts/steam-screenshot-pipeline.ts [options]

Options:
  --limit <n>         Max screenshots (default: 30)
  --auto-organize     Move useful images automatically
  --generate-labels   Create ground truth template file
  --skip-scrape       Only analyze existing files
```

### Workflow

1. **Scrape**: `npm run steam:scrape -- --limit 30`
2. **Analyze**: `npm run steam:analyze -- --verbose`
3. **Review**: Check `steam-scraped/analysis-report.json`
4. **Organize**: Move useful images to `steam-community/`
5. **Label**: Add ground truth entries for useful images
6. **Test**: `npm run test:cv:offline`

### Output Directories

```
test-images/gameplay/
├── steam-scraped/           # Raw downloaded screenshots
│   ├── *.jpg                # Screenshot files
│   ├── analysis-report.json # Analysis results
│   └── ground-truth-template.json  # Template for labeling
├── steam-community/         # Curated useful screenshots
└── pc-1080p/               # Manually captured gameplay
```

---

## How to Download Screenshots Manually

### Method 1: Direct Download from URLs
1. Copy any URL above
2. Open in browser
3. Right-click → Save Image As
4. Save to appropriate folder in `test-images/`

### Method 2: Browse Steam Community
1. Visit [MegaBonk Screenshots Gallery](https://steamcommunity.com/app/3405340/screenshots/)
2. Filter by "Most Popular" or "Most Recent"
3. Look for screenshots showing:
   - Pause menu with items visible
   - Clear inventory display
   - Stats and character info
4. Click screenshot → Right-click → Save Image

### Method 3: Steam Community Search
1. Visit Steam Community page
2. Use search terms like:
   - "pause menu"
   - "inventory"
   - "build"
   - "items"
   - "late game"

## What to Look For

### Best Screenshots for Testing

✅ **Good for testing:**
- Pause menu open showing full inventory
- High contrast, clear text
- Item names and counts visible
- Character and weapon info displayed
- Minimal visual effects or motion blur
- Full screen capture (not cropped)

❌ **Avoid:**
- Heavy motion blur
- Low resolution or compressed
- Gameplay only (no pause menu)
- Partial UI elements
- Heavy visual effects obscuring text

## Organizing Downloads

When you download a screenshot:

1. **Identify the resolution:**
   - Right-click → Properties → Details → Dimensions

2. **Save to appropriate folder:**
   ```
   test-images/pause-menu/pc-1080p/     (1920x1080)
   test-images/pause-menu/pc-1440p/     (2560x1440)
   test-images/pause-menu/steam-deck/   (1280x800)
   test-images/gameplay/pc-1080p/       (gameplay shots)
   ```

3. **Use descriptive filename:**
   - Good: `clank_battery_crit_build.png`
   - Bad: `screenshot1.png`

4. **Create ground truth entry:**
   - Edit `ground-truth.json` in the category folder
   - List all visible items, tomes, character, weapon
   - Add notes about the build

## Alternative Sources

### Discord Communities
- Official MegaBonk Discord server
- Gaming communities discussing roguelikes
- Ask permission before using others' screenshots

### Reddit
- r/Megabonk (if exists)
- r/roguelikes
- Search for "megabonk build" or "megabonk screenshot"

### Your Own Gameplay
- Play MegaBonk on PC or Steam Deck
- Press F12 in Steam to take screenshot
- Screenshots saved to: `Steam/userdata/<id>/760/remote/3405340/screenshots/`
- Best for creating controlled test cases

## Steam Deck Specific

MegaBonk is officially Steam Deck Verified and runs at:
- **Native Resolution**: 1280x800
- **Performance**: 90 fps on Steam Deck OLED
- **Screenshot Location**: Same as PC (F12 in Steam)

When testing Steam Deck screenshots, note that:
- UI layout may be more compact
- Aspect ratio is 16:10 (vs 16:9 on PC)
- Text may be smaller due to screen size

## Current Test Coverage

To get comprehensive test coverage, try to collect:

- [ ] 3-5 PC screenshots at 1080p (pause menu)
- [ ] 2-3 PC screenshots at 1440p (pause menu)
- [ ] 2-3 Steam Deck screenshots at 800p (pause menu)
- [ ] 2-3 gameplay screenshots (various resolutions)
- [ ] Mix of early game (few items) and late game (many items)
- [ ] Different characters and weapons
- [ ] Various item rarities and types

## Copyright Notice

When using community screenshots:
- Always credit the original creator
- Get permission if possible
- Use only for testing purposes (not redistribution)
- Your own screenshots are best for this project

## Next Steps

1. Download 5-10 screenshots from sources above
2. Organize into appropriate resolution folders
3. Create ground truth entries for each
4. Run automated tests to measure accuracy
5. Tune OCR/CV parameters based on results

## Resources

- [Steam Community Hub](https://steamcommunity.com/app/3405340)
- [TESTING_IMAGE_RECOGNITION.md](../docs/TESTING_IMAGE_RECOGNITION.md) - Full testing guide
- [Steam Deck Verified Page](https://deckverified.games/app/3405340) - Performance info

## Questions?

See the main [test-images/README.md](./README.md) for more details on the test infrastructure.
