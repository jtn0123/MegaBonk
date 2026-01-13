# Accuracy Improvement Research & Recommendations

## Executive Summary

**Current Status:** Cannot accurately measure OCR performance due to ground truth mismatch
**Tested:** Fuzzy matching only (simulation) - NOT real OCR with Tesseract
**Fuzzy Matching Works:** 100% on exact names (Battery, Wrench)
**Critical Issue:** Ground truth uses visual descriptions, database uses game names
**Priority:** Fix ground truth → Test real OCR → Then optimize

---

## What I've Actually Tested ✅

### ✅ Tested: Fuzzy Matching (Fuse.js)
- **Method:** Node.js simulation with sample text
- **Results:**
  - "Battery" → Detected at 100% confidence ✅
  - "Wrench" → Detected at 100% confidence ✅
  - "First Aid Kit" → NOT detected (not in database as "First Aid Kit") ❌
  - "Banana" → NOT detected (not in database as "Banana") ❌
- **Conclusion:** Fuzzy matching works perfectly when item names match

### ❌ NOT Tested: Real OCR Extraction
- **Tesseract.js text extraction:** NOT tested (requires browser + screenshot)
- **OCR accuracy:** Unknown
- **OCR preprocessing:** Not evaluated
- **Real-world performance:** Cannot measure yet

### ❌ NOT Tested: Computer Vision
- **Template matching:** Not tested
- **Icon recognition:** Not tested
- **Hybrid detection:** Not tested

---

## Current Accuracy Metrics

### Fuzzy Matching Only
| Metric | Value | Notes |
|--------|-------|-------|
| Accuracy | 5.6% | Only because ground truth has wrong names |
| Battery detection | 100% | Perfect match ✅ |
| Wrench detection | 100% | Perfect match ✅ |
| Multi-word items | 0% | "First Aid Kit" not in database |
| Short items | 0% | "Banana" not in database |

**Real Accuracy (if names were correct):** Unknown - cannot test until ground truth is fixed

---

## Improvement Strategies - Prioritized

## 🔴 CRITICAL - Must Fix First

### 1. Fix Ground Truth Labels ⭐⭐⭐⭐⭐
**Priority:** HIGHEST
**Impact:** Makes testing possible
**Effort:** 30-60 minutes

**Problem:**
- Ground truth uses "First Aid Kit" but database has "Medkit"
- Ground truth uses "Banana" but database has "Oats" (maybe?)
- Ground truth uses "Burger" but database has "Borgar"

**Solution:**
```json
// Update test-images/gameplay/ground-truth.json
"level_38_boss_portal_clean.png": {
  "items": [
    "Medkit",        // was "First Aid Kit"
    "Battery",       // correct ✓
    "Wrench",        // was "Yellow Wrench"
    "Borgar",        // was "Burger"
    "Oats",          // was "Banana" (?)
    "Gym Sauce",     // was "Green Potion" (?)
    // ... etc
  ]
}
```

**Implementation:**
1. Open Screenshot 5 side-by-side with items database
2. Match each visual item to actual game name
3. Update ground-truth.json
4. Re-run simulation: `node scripts/simulate-screenshot-ocr.js`

**Expected Result:** 75-90% fuzzy matching accuracy on simulation

---

## 🟠 HIGH PRIORITY - Quick Wins

### 2. Add Item Name Aliases ⭐⭐⭐⭐
**Priority:** HIGH
**Impact:** Massive improvement for multi-word items
**Effort:** 2-3 hours

**Problem:**
- OCR might extract "First Aid" instead of "Medkit"
- Visual appearance doesn't match item name
- Casual players don't know internal names

**Solution:**
Add aliases to items.json:

```typescript
// src/types/index.ts
export interface Item {
    id: string;
    name: string;
    aliases?: string[];  // ADD THIS
    rarity: string;
    // ... rest
}
```

```json
// data/items.json
{
  "name": "Medkit",
  "aliases": ["First Aid Kit", "Health Kit", "Med Kit", "First Aid"],
  "rarity": "common"
},
{
  "name": "Borgar",
  "aliases": ["Burger", "Hamburger"],
  "rarity": "common"
},
{
  "name": "Oats",
  "aliases": ["Banana", "Yellow Food"],
  "rarity": "common"
}
```

**Update OCR fuzzy matching:**
```typescript
// src/modules/ocr.ts - line 36
const fuseOptions = {
    includeScore: true,
    threshold: 0.4,
    keys: ['name', 'aliases'],  // Search both name and aliases
    ignoreLocation: true,
};
```

**Expected Improvement:** +20-30% accuracy

---

### 3. Tune Fuzzy Match Threshold ⭐⭐⭐⭐
**Priority:** HIGH
**Impact:** Better balance between precision and recall
**Effort:** 30 minutes (testing different values)

**Current Setting:**
```typescript
threshold: 0.4  // 0 = perfect match, 1 = match anything
```

**Problem:**
- 0.4 might be too strict (missing near-matches)
- OR too lenient (accepting wrong matches)
- Need real data to tune properly

**Testing Strategy:**
```javascript
// Test different thresholds
const thresholds = [0.3, 0.4, 0.5, 0.6];
const testItems = ["First Aid Kit", "Battry", "WRENCH", "Gym Sauc"];

thresholds.forEach(threshold => {
    const fuse = new Fuse(items, { threshold, keys: ['name'] });
    testItems.forEach(item => {
        const result = fuse.search(item);
        console.log(`Threshold ${threshold}: "${item}" → ${result[0]?.item?.name || 'NO MATCH'}`);
    });
});
```

**Recommended Values:**
- **0.3** - Strict (fewer false positives, more false negatives)
- **0.4** - Current (balanced)
- **0.5** - Lenient (more detections, but more errors)
- **0.6** - Very lenient (use only if recall is too low)

**Expected Improvement:** +5-15% accuracy (depending on OCR quality)

---

### 4. Improve Tesseract OCR Configuration ⭐⭐⭐⭐
**Priority:** HIGH
**Impact:** Better text extraction = better matching
**Effort:** 2-4 hours

**Current Configuration:**
```typescript
// src/modules/ocr.ts - line 83
const result = await Tesseract.recognize(imageDataUrl, 'eng', {
    logger: info => { /* progress callback */ }
});
```

**Improvements:**

#### A. Add PSM (Page Segmentation Mode)
```typescript
const result = await Tesseract.recognize(imageDataUrl, 'eng', {
    tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,  // Better for game UIs
    logger: info => { /* progress callback */ }
});
```

**PSM Options:**
- `PSM.SINGLE_BLOCK` - Single uniform block of text
- `PSM.SINGLE_LINE` - Single line (for item names)
- `PSM.SINGLE_WORD` - Single word (for short items)
- `PSM.SPARSE_TEXT` - **RECOMMENDED for game UIs** (scattered text)

#### B. Add Whitelist Characters
```typescript
const result = await Tesseract.recognize(imageDataUrl, 'eng', {
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -\'',
    logger: info => { /* progress callback */ }
});
```

This prevents OCR from detecting random symbols as letters.

#### C. Image Preprocessing
```typescript
// Before OCR, preprocess the image
async function preprocessImage(imageDataUrl: string): Promise<string> {
    const img = await loadImageToCanvas(imageDataUrl);
    const ctx = img.ctx;
    const imageData = ctx.getImageData(0, 0, img.width, img.height);

    // 1. Convert to grayscale
    grayscaleFilter(imageData);

    // 2. Increase contrast
    contrastFilter(imageData, 1.5);

    // 3. Sharpen text
    sharpenFilter(imageData);

    // 4. Optional: Invert if text is light on dark
    // invertFilter(imageData);

    ctx.putImageData(imageData, 0, 0);
    return img.canvas.toDataURL();
}
```

**Expected Improvement:** +15-30% accuracy

---

### 5. Case-Insensitive Matching ⭐⭐⭐
**Priority:** MEDIUM-HIGH
**Impact:** Handles "WRENCH" vs "Wrench"
**Effort:** 15 minutes

**Problem:**
- OCR might extract "FIRST AID KIT" (uppercase)
- Fuse.js is case-sensitive by default

**Solution:**
```typescript
// src/modules/ocr.ts - line 36
const fuseOptions = {
    includeScore: true,
    threshold: 0.4,
    keys: ['name'],
    ignoreLocation: true,
    isCaseSensitive: false,  // ADD THIS
};
```

OR normalize before searching:
```typescript
export function detectItemsFromText(text: string): DetectionResult[] {
    if (!itemFuse) return [];

    // Normalize to lowercase
    const normalizedText = text.toLowerCase();
    const lines = normalizedText.split('\n').filter(line => line.trim().length > 2);

    // ... rest of function
}
```

**Expected Improvement:** +5-10% accuracy

---

## 🟡 MEDIUM PRIORITY - Good ROI

### 6. Multi-Pass OCR with Different Configurations ⭐⭐⭐
**Priority:** MEDIUM
**Impact:** Catches items missed on first pass
**Effort:** 3-4 hours

**Concept:**
Run Tesseract multiple times with different settings, merge results.

```typescript
export async function multiPassOCR(imageDataUrl: string): Promise<string> {
    const configs = [
        { tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT },
        { tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK },
        { tessedit_pageseg_mode: Tesseract.PSM.AUTO },
    ];

    const results: string[] = [];

    for (const config of configs) {
        const result = await Tesseract.recognize(imageDataUrl, 'eng', config);
        results.push(result.data.text);
    }

    // Merge unique lines from all passes
    const allLines = new Set<string>();
    results.forEach(text => {
        text.split('\n').forEach(line => {
            if (line.trim().length > 2) {
                allLines.add(line.trim());
            }
        });
    });

    return Array.from(allLines).join('\n');
}
```

**Expected Improvement:** +10-20% accuracy

---

### 7. Region-Based OCR (Inventory Only) ⭐⭐⭐
**Priority:** MEDIUM
**Impact:** Reduces noise, faster processing
**Effort:** 4-6 hours

**Problem:**
- OCR scans entire screenshot (boss, enemies, UI, chat, etc.)
- Most text is NOT item names
- Creates noise and false positives

**Solution:**
Detect inventory region and only OCR that area.

```typescript
export function detectInventoryRegion(width: number, height: number): ROI {
    // Typical MegaBonk inventory is bottom-left
    // Adjust based on resolution
    const resolution = detectResolution(width, height);

    if (resolution.category === '1080p') {
        return {
            x: 50,
            y: height - 300,
            width: 800,
            height: 250,
            label: 'inventory'
        };
    } else if (resolution.category === '720p') {
        return {
            x: 30,
            y: height - 200,
            width: 600,
            height: 180,
            label: 'inventory'
        };
    }

    // Fallback: bottom 20% of screen
    return {
        x: 0,
        y: Math.floor(height * 0.8),
        width: width,
        height: Math.floor(height * 0.2),
        label: 'inventory'
    };
}

export async function extractTextFromInventory(imageDataUrl: string): Promise<string> {
    const { canvas, ctx, width, height } = await loadImageToCanvas(imageDataUrl);

    // Get inventory region
    const roi = detectInventoryRegion(width, height);

    // Crop to inventory only
    const inventoryCanvas = document.createElement('canvas');
    inventoryCanvas.width = roi.width;
    inventoryCanvas.height = roi.height;
    const inventoryCtx = inventoryCanvas.getContext('2d')!;

    inventoryCtx.drawImage(
        canvas,
        roi.x, roi.y, roi.width, roi.height,
        0, 0, roi.width, roi.height
    );

    // OCR on cropped region only
    return await extractTextFromImage(inventoryCanvas.toDataURL());
}
```

**Expected Improvement:** +10-15% accuracy, 2-3x faster

---

### 8. N-gram Matching for Multi-Word Items ⭐⭐⭐
**Priority:** MEDIUM
**Impact:** Better detection of "First Aid Kit"
**Effort:** 2-3 hours

**Problem:**
- OCR might extract "First" on one line, "Aid Kit" on another
- Current line-by-line matching misses multi-line items

**Solution:**
```typescript
export function detectItemsFromTextNgrams(text: string): DetectionResult[] {
    if (!itemFuse) return [];

    const lines = text.split('\n').filter(line => line.trim().length > 2);
    const detections: DetectionResult[] = [];

    // Single-line matching (existing)
    for (const line of lines) {
        const results = itemFuse.search(line);
        if (results.length > 0 && results[0].score < 0.4) {
            detections.push({
                type: 'item',
                entity: results[0].item,
                confidence: 1 - results[0].score,
                rawText: line.trim(),
            });
        }
    }

    // Multi-line matching (new)
    for (let i = 0; i < lines.length - 1; i++) {
        const combined = `${lines[i]} ${lines[i + 1]}`;
        const results = itemFuse.search(combined);

        if (results.length > 0 && results[0].score < 0.4) {
            // Only add if not already detected
            const alreadyDetected = detections.some(d => d.entity.id === results[0].item.id);
            if (!alreadyDetected) {
                detections.push({
                    type: 'item',
                    entity: results[0].item,
                    confidence: (1 - results[0].score) * 0.9,  // Slightly lower confidence
                    rawText: combined.trim(),
                });
            }
        }
    }

    return detections;
}
```

**Expected Improvement:** +10-20% for multi-word items

---

## 🟢 LOW PRIORITY - Nice to Have

### 9. Item Count Detection (x2, x3, etc.) ⭐⭐
**Priority:** LOW
**Impact:** Accurate inventory counts
**Effort:** 2-3 hours

**Current:** Function exists but not tested
```typescript
export function extractItemCounts(text: string): Map<string, number>
```

**Improvement:**
Integrate with detection results:

```typescript
export function detectItemsWithCounts(text: string): DetectionResult[] {
    const items = detectItemsFromText(text);
    const counts = extractItemCounts(text);

    // Match counts to items
    items.forEach(item => {
        const itemName = item.entity.name.toLowerCase();
        const rawTextLower = item.rawText.toLowerCase();

        // Check if count exists for this item
        if (counts.has(itemName)) {
            (item as any).count = counts.get(itemName);
        } else if (counts.has(rawTextLower)) {
            (item as any).count = counts.get(rawTextLower);
        } else {
            (item as any).count = 1;
        }
    });

    return items;
}
```

**Expected Improvement:** Accurate counts (not just detection)

---

### 10. Computer Vision Template Matching ⭐⭐⭐
**Priority:** LOW (already implemented)
**Impact:** Independent validation
**Effort:** Already done

**Status:** CV module exists, combineDetections() merges OCR + CV

**Current Boost:**
```typescript
// When both OCR and CV detect same item:
existing.confidence = Math.min(0.98, existing.confidence * 1.2);  // +20% boost
```

**Potential Improvement:**
```typescript
// More sophisticated confidence calculation
if (ocrConfidence > 0.8 && cvConfidence > 0.7) {
    // Both methods very confident
    finalConfidence = 0.95;
} else if (ocrConfidence > 0.6 || cvConfidence > 0.6) {
    // At least one method confident
    finalConfidence = Math.max(ocrConfidence, cvConfidence) * 1.1;
} else {
    // Low confidence from both - don't include
    finalConfidence = 0;
}
```

---

## 📊 Expected Accuracy Improvements

### Current System (After Fixing Ground Truth)
| Component | Expected Accuracy |
|-----------|------------------|
| Fuzzy Matching | 70-80% |
| OCR Extraction | Unknown |
| Combined | 60-75% (baseline) |

### With Priority Improvements
| Priority | Improvements | Expected Accuracy |
|----------|-------------|------------------|
| Baseline | Fix ground truth + current system | 60-75% |
| + CRITICAL | Aliases, threshold tuning | 75-85% |
| + HIGH | OCR config, case-insensitive | 80-90% |
| + MEDIUM | Region-based, n-grams | 85-92% |
| + LOW | Counts, CV boost | 90-95% |

### Realistic Targets by Screenshot
| Screenshot | Difficulty | Target | With All Improvements |
|------------|-----------|--------|----------------------|
| Level 38 | Easy (clean UI) | 80-90% | **90-95%** |
| Level 86 | Medium (effects) | 70-80% | **80-88%** |
| Level 98 | Hard (chaos) | 60-70% | **70-80%** |

---

## 🚀 Implementation Roadmap

### Phase 1: Foundation (Week 1) ⭐⭐⭐⭐⭐
1. Fix ground truth labels (1 hour)
2. Add item aliases (3 hours)
3. Tune fuzzy threshold (1 hour)
4. Add case-insensitive matching (30 min)

**Expected Result:** 75-85% accuracy on clean screenshots

### Phase 2: OCR Optimization (Week 2) ⭐⭐⭐⭐
1. Configure Tesseract PSM modes (2 hours)
2. Add character whitelist (1 hour)
3. Implement image preprocessing (4 hours)
4. Test multi-pass OCR (3 hours)

**Expected Result:** 80-90% accuracy on clean screenshots

### Phase 3: Advanced Features (Week 3) ⭐⭐⭐
1. Region-based OCR (6 hours)
2. N-gram matching (3 hours)
3. Item count integration (3 hours)
4. Improve CV confidence boost (2 hours)

**Expected Result:** 85-95% accuracy on clean screenshots

---

## 🧪 Testing Strategy

### 1. Unit Tests
```bash
bun test tests/unit/ocr.test.ts
```

### 2. Simulation Test
```bash
node scripts/simulate-screenshot-ocr.js
```

### 3. Real Screenshot Test
```bash
bun run dev
# Browser: Upload screenshot → Run detection → Validate
```

### 4. Benchmark Test
```bash
bun test tests/performance/benchmark.test.ts
```

---

## ❓ Questions to Answer

Before implementing improvements, we need:

### Critical Questions:
1. **What are the actual item names?** (Fix ground truth)
2. **What does real OCR extract?** (Test with actual screenshot)
3. **What's the real accuracy baseline?** (Measure before optimizing)

### Secondary Questions:
4. What resolution do most players use? (1080p? 720p?)
5. What's the typical screenshot quality? (PNG? JPEG compression?)
6. How much visual noise is typical? (Effects, particles, etc.)

---

## 📝 Conclusion

**Current Status:**
- ✅ Fuzzy matching works (100% on exact names)
- ❌ Cannot test real OCR (no screenshots saved)
- ❌ Cannot measure accuracy (wrong ground truth labels)

**Critical Path:**
1. Fix ground truth labels
2. Test with real screenshot
3. Measure baseline accuracy
4. Apply improvements in priority order
5. Re-test and measure improvement

**Expected Final Accuracy:** 85-95% on clean screenshots, 70-80% on chaotic screenshots

**Next Steps:**
1. Update ground-truth.json with actual item names
2. Save Screenshot 5 to disk
3. Run real OCR test
4. Implement Phase 1 improvements
