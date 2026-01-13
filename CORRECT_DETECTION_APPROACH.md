# Correct Detection Approach - Icon Matching, Not Text OCR

## Critical Clarification ⚠️

**I was implementing the WRONG approach!**

### What I Was Doing (WRONG ❌)
- Using OCR to extract item **names** from screenshots
- Trying to fuzzy match text like "First Aid Kit", "Banana", etc.
- Ground truth had text descriptions

### What Should Actually Happen (CORRECT ✅)
- Items are displayed as **ICONS/IMAGES**, not text
- All item images already exist in `src/images/items/`
- **OCR should ONLY be used for count numbers** (the small numbers in bottom-right corner)
- **Computer Vision template matching** should be the PRIMARY detection method

---

## How the Game Actually Works

### Item Display
```
┌──────────────────┐
│                  │
│   [ICON IMAGE]   │  ← The item icon (burger.png, wrench.png, etc.)
│                  │
│              x5  │  ← Small count number (OCR this!)
└──────────────────┘
```

- **Icon**: 90% of the item cell, displays the actual item image
- **Count**: Small number in bottom-right, ranging from nothing (x1 implied) to x20

### What Exists Already
```
src/images/items/
├── anvil.png / anvil.webp
├── battery.png / battery.webp
├── borgar.png / borgar.webp
├── medkit.png / medkit.webp (NOT "first_aid_kit.png"!)
├── wrench.png / wrench.webp
└── ... 78 items total
```

**All item images are already in the project!**

---

## Correct Implementation Strategy

### Phase 1: Template Matching (PRIMARY) ⭐⭐⭐⭐⭐

**Goal:** Match screenshot item icons to stored item images

```typescript
async function detectItemsWithTemplateMatching(screenshotDataUrl: string): Promise<Detection[]> {
    // 1. Load screenshot
    const screenshot = await loadImageToCanvas(screenshotDataUrl);

    // 2. Detect item grid positions (already implemented!)
    const itemCells = detectGridPositions(screenshot.width, screenshot.height);

    // 3. For each cell, extract the icon region (ignore bottom-right corner where count is)
    const detections: Detection[] = [];

    for (const cell of itemCells) {
        // Extract just the icon (e.g., top-left 80% of cell, avoid count number area)
        const iconRegion = extractIconRegion(cell);

        // 4. Compare against all item templates
        let bestMatch = null;
        let bestScore = 0;

        for (const item of allItems) {
            const template = await loadItemImage(item.image); // e.g., "images/items/borgar.png"
            const similarity = calculateImageSimilarity(iconRegion, template);

            if (similarity > bestScore && similarity > THRESHOLD) {
                bestScore = similarity;
                bestMatch = item;
            }
        }

        if (bestMatch) {
            detections.push({
                item: bestMatch,
                confidence: bestScore,
                position: cell
            });
        }
    }

    return detections;
}
```

**Expected Accuracy:** 85-95% (icons are consistent, lighting may vary)

### Phase 2: OCR for Counts (SECONDARY) ⭐⭐⭐

**Goal:** Read count numbers from bottom-right corner

```typescript
async function detectItemCounts(screenshotDataUrl: string, itemPositions: ROI[]): Promise<Map<string, number>> {
    const counts = new Map();

    for (const itemPos of itemPositions) {
        // Extract ONLY the bottom-right corner (e.g., last 20x20 pixels)
        const countRegion = {
            x: itemPos.x + itemPos.width - 25,
            y: itemPos.y + itemPos.height - 25,
            width: 20,
            height: 20
        };

        // OCR just this tiny region
        const text = await extractTextFromImage(countRegion);

        // Parse count (look for patterns like "x5", "5", "×3")
        const countMatch = text.match(/[x×]?(\d+)/);
        if (countMatch) {
            counts.set(itemPos.label, parseInt(countMatch[1]));
        } else {
            counts.set(itemPos.label, 1); // Default to 1 if no count visible
        }
    }

    return counts;
}
```

**Expected Accuracy:** 90-95% (numbers are clear, small text is easier for OCR than full words)

### Phase 3: Combined Detection

```typescript
async function detectBuildFromScreenshot(imageDataUrl: string) {
    // 1. Detect items via template matching
    const items = await detectItemsWithTemplateMatching(imageDataUrl);

    // 2. Detect counts via OCR on specific regions
    const counts = await detectItemCounts(imageDataUrl, items.map(i => i.position));

    // 3. Combine results
    return items.map(item => ({
        ...item,
        count: counts.get(item.position.label) || 1
    }));
}
```

---

## Why Template Matching Will Work Better

### Advantages of Icon Matching
1. **Icons are consistent** - Same image every time
2. **No language issues** - Works for all localizations
3. **No font variations** - Images don't change
4. **Already have templates** - All 78 item images exist
5. **Lighting/effects less impactful** - Icons have distinctive shapes/colors

### Why OCR Was Wrong
1. ❌ Game doesn't display item names as text
2. ❌ Would require multi-language OCR
3. ❌ Font rendering varies
4. ❌ Names can be long ("Grandma's Secret Tonic")
5. ❌ OCR is slow and error-prone

---

## Current State Analysis

### What's Already Implemented ✅
1. `detectGridPositions()` - Finds item cells in screenshot
2. `calculateSimilarity()` - Image comparison function
3. `loadImageToCanvas()` - Load and process images
4. Item images in `src/images/items/` (78 items, PNG + WebP)
5. `extractItemCounts()` - Parse count numbers from text (regex)

### What's Missing ❌
1. **Load item template images** - Need function to load stored images
2. **Template matching implementation** - Compare screenshot regions to templates
3. **Icon region extraction** - Extract just the icon (exclude count number area)
4. **Region-specific OCR** - OCR only the count number area, not entire cell
5. **Similarity threshold tuning** - Determine confidence threshold

### What's a Placeholder 📝
Current `detectItemsWithCV()` uses color heuristics (green = HP items, red = damage items). This is just a demo - says "Simplified version" in comments.

---

## Implementation Plan

### Step 1: Load Item Templates (2 hours)
```typescript
// Create template cache
const itemTemplates = new Map<string, ImageData>();

async function loadItemTemplates(): Promise<void> {
    for (const item of allData.items.items) {
        const imagePath = item.image; // e.g., "images/items/borgar.png"
        const imageData = await loadImageToCanvas(imagePath);
        itemTemplates.set(item.id, imageData);
    }
}
```

### Step 2: Implement Template Matching (4-6 hours)
```typescript
function matchTemplate(
    screenshot: ImageData,
    template: ImageData,
    position: ROI
): number {
    // Extract icon region from screenshot (80% of cell, avoid bottom-right)
    const iconRegion = extractIconRegion(screenshot, position);

    // Resize template to match icon region size
    const resizedTemplate = resizeImage(template, iconRegion.width, iconRegion.height);

    // Calculate similarity (already implemented: calculateSimilarity())
    return calculateSimilarity(iconRegion, resizedTemplate);
}
```

### Step 3: Region-Specific OCR (2-3 hours)
```typescript
async function extractCountFromCell(
    imageDataUrl: string,
    cellPosition: ROI
): Promise<number> {
    // Crop to bottom-right corner only
    const countRegion = {
        x: cellPosition.x + cellPosition.width - 25,
        y: cellPosition.y + cellPosition.height - 25,
        width: 20,
        height: 20
    };

    // OCR just this region
    const croppedImage = cropImage(imageDataUrl, countRegion);
    const text = await extractTextFromImage(croppedImage);

    // Parse number
    const match = text.match(/\d+/);
    return match ? parseInt(match[0]) : 1;
}
```

### Step 4: Confidence Tuning (2 hours)
- Test with actual screenshots
- Determine similarity threshold (0.7? 0.8? 0.9?)
- Handle edge cases (similar-looking icons)

**Total Effort:** 10-13 hours for full implementation

---

## Expected Accuracy After Correct Implementation

| Method | Clean UI | Medium Effects | Heavy Effects |
|--------|----------|----------------|---------------|
| **Template Matching** | 90-95% | 85-90% | 75-85% |
| **Count OCR** | 90-95% | 85-90% | 80-85% |
| **Combined** | 85-92% | 80-88% | 70-80% |

Much better than text OCR because:
- Icons are consistent across all screenshots
- Template matching is robust to lighting/effects
- Small count numbers are easier for OCR than full words

---

## What About Ground Truth?

### Current Ground Truth (WRONG Format)
```json
{
  "items": [
    "Gym Sauce",
    "Oats",
    "Wrench",
    // ...
  ]
}
```

This is actually **PERFECT** for template matching! We just need:
1. Item names match the database ✅ (fixed!)
2. No need for visual descriptions anymore
3. Template matching will find these items by their icons

### Updated Testing Approach
1. Save screenshots to disk
2. Run template matching detection
3. Compare detected item names to ground truth list
4. Calculate accuracy

**No changes needed to ground truth!** It's already in the correct format now.

---

## Action Items

### Immediate (Next Steps)
1. ✅ Ground truth fixed (already done!)
2. ❌ Implement `loadItemTemplates()` function
3. ❌ Implement real template matching (replace color heuristics)
4. ❌ Implement region-specific OCR for counts
5. ❌ Test with actual screenshots

### Future Enhancements
- ML-based icon recognition (TensorFlow.js)
- Handle rotated/scaled icons
- Detect item rarity by border color
- Detect equipped items vs inventory

---

## Summary

**What I Learned:**
- Game shows ICONS, not text names ✅
- OCR is only for count numbers (x2, x3, etc.) ✅
- Template matching should be PRIMARY method ✅
- All item images already exist in project ✅

**What Needs to Change:**
- Stop trying to OCR item names ❌
- Implement real template matching ✅
- Use OCR only for count numbers ✅
- Test with actual icon matching, not text matching ✅

**Expected Timeline:**
- 10-13 hours to implement correctly
- 85-92% accuracy on clean screenshots
- Works across all languages (icon-based)

---

**Status:** Ready to implement correctly! 🎯
