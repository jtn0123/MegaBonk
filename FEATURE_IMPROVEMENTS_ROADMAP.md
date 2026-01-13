# Feature Improvements & Fixes Roadmap

## Current Status ✅

**What's Working:**
- Template matching implementation complete
- Icon recognition system functional
- Count number OCR implemented
- Integration with scan-build complete

**What to Improve:** Many things we can enhance!

---

## 🔴 CRITICAL FIXES (Do First)

### 1. Grid Detection Accuracy ⭐⭐⭐⭐⭐
**Problem:** Fixed 64px grid may not match actual game UI
**Impact:** May miss items or detect empty cells
**Effort:** 2-3 hours

**Solution:**
```typescript
// Dynamic grid detection based on actual UI
function detectInventoryGrid(ctx: CanvasRenderingContext2D, width: number, height: number): ROI[] {
    // 1. Detect bottom inventory bar region (darker background)
    // 2. Find icon edges using edge detection
    // 3. Calculate actual cell size from spacing
    // 4. Generate grid positions based on detected layout
}
```

**Expected Improvement:** +10-15% accuracy

---

### 2. Adaptive Similarity Threshold ⭐⭐⭐⭐⭐
**Problem:** Fixed 0.75 threshold may not work for all scenarios
**Impact:** Too strict = missed items, too lenient = false positives
**Effort:** 1-2 hours

**Solution:**
```typescript
// Adaptive threshold based on best matches
function detectWithAdaptiveThreshold(matches: Match[]): Match[] {
    // Sort by similarity
    matches.sort((a, b) => b.similarity - a.similarity);

    // Find natural gap in similarities
    const gap = findLargestGap(matches.map(m => m.similarity));

    // Set threshold just above gap
    const threshold = gap - 0.05;

    return matches.filter(m => m.similarity > threshold);
}
```

**Expected Improvement:** +5-10% accuracy

---

### 3. Handle Empty Cells ⭐⭐⭐⭐
**Problem:** Background/UI might match as items at low confidence
**Impact:** False positives
**Effort:** 1 hour

**Solution:**
```typescript
// Detect if cell is empty (mostly uniform color)
function isEmptyCell(imageData: ImageData): boolean {
    const variance = calculateColorVariance(imageData);
    return variance < EMPTY_THRESHOLD; // e.g., < 20
}

// Skip template matching for empty cells
if (isEmptyCell(cellData)) {
    continue; // Skip this cell
}
```

**Expected Improvement:** -90% false positives

---

### 4. Duplicate Item Aggregation ⭐⭐⭐⭐
**Problem:** Detects same item multiple times, doesn't aggregate counts
**Impact:** Confusing results (shows "Wrench" 3 times instead of "Wrench x3")
**Effort:** 1 hour

**Solution:**
```typescript
// After detection, aggregate duplicates
function aggregateDuplicates(detections: Detection[]): Detection[] {
    const grouped = new Map<string, Detection[]>();

    detections.forEach(d => {
        const key = d.entity.id;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(d);
    });

    return Array.from(grouped.entries()).map(([id, dets]) => ({
        entity: dets[0].entity,
        count: dets.reduce((sum, d) => sum + (d.count || 1), 0),
        confidence: Math.max(...dets.map(d => d.confidence))
    }));
}
```

**Expected Improvement:** Better UX, clearer results

---

## 🟠 HIGH PRIORITY (Next)

### 5. Resolution-Specific Grid Sizing ⭐⭐⭐⭐
**Problem:** 64px grid doesn't scale to all resolutions
**Impact:** Misaligned detection
**Effort:** 2 hours

**Solution:**
```typescript
function getGridSizeForResolution(width: number, height: number): number {
    const resolution = detectResolution(width, height);

    const gridSizes = {
        '720p': 48,
        '1080p': 64,
        '1440p': 80,
        '4K': 96,
        'steam_deck': 52,
    };

    return gridSizes[resolution.category] || 64;
}
```

**Expected Improvement:** +5-10% accuracy across resolutions

---

### 6. Multi-Pass Matching for Uncertain Items ⭐⭐⭐⭐
**Problem:** Single pass may miss items just below threshold
**Impact:** Lower recall
**Effort:** 2-3 hours

**Solution:**
```typescript
// First pass: High confidence (>0.85)
const highConfidence = match(cells, templates, 0.85);

// Second pass: Medium confidence (>0.70) for unmatched cells
const unmatched = cells.filter(c => !isMatched(c, highConfidence));
const mediumConfidence = match(unmatched, templates, 0.70);

// Third pass: Low confidence (>0.60) with stricter validation
const stillUnmatched = unmatched.filter(c => !isMatched(c, mediumConfidence));
const lowConfidence = match(stillUnmatched, templates, 0.60).filter(validateWithContext);
```

**Expected Improvement:** +10-15% recall

---

### 7. Color-Based Pre-filtering ⭐⭐⭐⭐
**Problem:** Comparing against all 78 templates is slow
**Impact:** 3-6 second detection time
**Effort:** 3-4 hours

**Solution:**
```typescript
// Group templates by dominant color
const templatesByColor = {
    red: [Dragonfire, DemonicBlood, ...],
    blue: [ForbiddenJuice, IceCrystal, ...],
    yellow: [Wrench, Key, ...],
    // ...
};

// Pre-filter candidates by color
function matchWithColorFilter(cell: ImageData): Match[] {
    const dominantColor = getDominantColor(cell);
    const candidates = templatesByColor[dominantColor] || allTemplates;

    // Only compare against ~10-15 templates instead of 78
    return match(cell, candidates);
}
```

**Expected Improvement:** 3-5x faster (1-2s instead of 3-6s)

---

### 8. Template Rotation Invariance ⭐⭐⭐
**Problem:** Some items might be rotated in UI
**Impact:** Missed detections
**Effort:** 2-3 hours

**Solution:**
```typescript
// Try matching at multiple rotations
function matchWithRotation(cell: ImageData, template: TemplateData): number {
    const rotations = [0, 90, 180, 270]; // Degrees
    const similarities = rotations.map(angle => {
        const rotated = rotateImage(template, angle);
        return calculateSimilarity(cell, rotated);
    });

    return Math.max(...similarities);
}
```

**Expected Improvement:** +5% accuracy (if game rotates items)

---

## 🟡 MEDIUM PRIORITY (Nice to Have)

### 9. Machine Learning Model ⭐⭐⭐
**Problem:** Template matching is slow and brittle
**Impact:** Lower accuracy and speed
**Effort:** 8-12 hours

**Solution:**
```typescript
// Train TensorFlow.js model on item images
// Use MobileNet or custom CNN

async function detectWithML(imageDataUrl: string): Promise<Detection[]> {
    const model = await tf.loadLayersModel('/models/item-classifier/model.json');

    // Detect cells
    const cells = detectGridPositions(width, height);

    // Classify each cell
    const predictions = await Promise.all(
        cells.map(cell => model.predict(preprocessCell(cell)))
    );

    return predictions.filter(p => p.confidence > 0.8);
}
```

**Expected Improvement:** 2-3x faster, +5-10% accuracy

---

### 10. Parallel Processing with Web Workers ⭐⭐⭐
**Problem:** Template matching blocks main thread
**Impact:** UI freezes during detection
**Effort:** 4-5 hours

**Solution:**
```typescript
// Offload matching to Web Workers
const worker = new Worker('/workers/template-matcher.js');

worker.postMessage({
    cells: gridPositions,
    templates: itemTemplates,
});

worker.onmessage = (e) => {
    const detections = e.data.detections;
    displayResults(detections);
};
```

**Expected Improvement:** Non-blocking UI, same detection time

---

### 11. Confidence Boosting with Context ⭐⭐⭐
**Problem:** Similar items hard to distinguish
**Impact:** Confusion between similar items
**Effort:** 2-3 hours

**Solution:**
```typescript
// Use game context to boost likely items
function boostWithContext(detections: Detection[], level: number): Detection[] {
    return detections.map(d => {
        let boost = 0;

        // Boost common items at this level range
        if (isCommonAtLevel(d.entity, level)) boost += 0.05;

        // Boost items that commonly appear together
        if (hasSynergy(d.entity, detections)) boost += 0.05;

        // Boost by rarity (legendary less likely than common)
        if (d.entity.rarity === 'common') boost += 0.03;

        return { ...d, confidence: d.confidence + boost };
    });
}
```

**Expected Improvement:** +5% accuracy for ambiguous items

---

### 12. Progressive Image Loading ⭐⭐⭐
**Problem:** All 78 templates load at once
**Impact:** Initial load time
**Effort:** 2 hours

**Solution:**
```typescript
// Load templates progressively
async function loadTemplatesProgressive(): Promise<void> {
    // 1. Load most common items first (20 items)
    await loadTemplatesBatch(commonItems);

    // 2. Load rest in background
    setTimeout(() => loadTemplatesBatch(rareItems), 1000);
}
```

**Expected Improvement:** Faster initial load, better UX

---

### 13. Visual Debugging Overlay ⭐⭐⭐
**Problem:** Hard to debug why detection failed
**Impact:** Difficult to improve system
**Effort:** 3-4 hours

**Solution:**
```typescript
// Show detection visualization
function renderDebugOverlay(canvas: HTMLCanvasElement, detections: Detection[]): void {
    const ctx = canvas.getContext('2d')!;

    // Draw grid positions
    gridPositions.forEach(cell => {
        ctx.strokeStyle = 'yellow';
        ctx.strokeRect(cell.x, cell.y, cell.width, cell.height);
    });

    // Draw detections with confidence
    detections.forEach(d => {
        const color = d.confidence > 0.85 ? 'green' : d.confidence > 0.75 ? 'orange' : 'red';
        ctx.strokeStyle = color;
        ctx.strokeRect(d.position.x, d.position.y, d.position.width, d.position.height);
        ctx.fillText(`${d.entity.name} (${(d.confidence * 100).toFixed(0)}%)`,
                     d.position.x, d.position.y - 5);
    });
}
```

**Expected Improvement:** Easier debugging and tuning

---

### 14. Item Rarity Border Detection ⭐⭐⭐
**Problem:** Could use border color to validate rarity
**Impact:** Additional validation
**Effort:** 2-3 hours

**Solution:**
```typescript
// Detect border color to confirm rarity
function detectBorderRarity(cell: ImageData): string | null {
    const borderPixels = extractBorderPixels(cell);
    const avgColor = averageColor(borderPixels);

    const rarityColors = {
        common: { r: 128, g: 128, b: 128 },
        uncommon: { r: 0, g: 255, b: 0 },
        rare: { r: 0, g: 128, b: 255 },
        epic: { r: 128, g: 0, b: 255 },
        legendary: { r: 255, g: 165, b: 0 },
    };

    // Find closest match
    return findClosestColor(avgColor, rarityColors);
}

// Validate detection
if (detected.entity.rarity !== detectBorderRarity(cell)) {
    // Reduce confidence or reject
    detected.confidence *= 0.7;
}
```

**Expected Improvement:** +5% accuracy, fewer wrong rarities

---

## 🟢 LOW PRIORITY (Future)

### 15. Cache Detection Results ⭐⭐
**Problem:** Re-detecting same screenshot is redundant
**Impact:** Wasted time
**Effort:** 1 hour

**Solution:**
```typescript
// Cache based on image hash
const detectionCache = new Map<string, Detection[]>();

async function detectWithCache(imageDataUrl: string): Promise<Detection[]> {
    const hash = await hashImage(imageDataUrl);

    if (detectionCache.has(hash)) {
        return detectionCache.get(hash)!;
    }

    const results = await detectItemsWithCV(imageDataUrl);
    detectionCache.set(hash, results);

    return results;
}
```

**Expected Improvement:** Instant re-detection

---

### 16. Multi-Language OCR Support ⭐⭐
**Problem:** Count OCR only works for English numbers
**Impact:** Fails for other languages
**Effort:** 2 hours

**Solution:**
```typescript
// Detect language from screenshot UI
function detectLanguage(imageDataUrl: string): string {
    // Look for text patterns in quest/UI elements
    // Return 'eng', 'spa', 'fra', etc.
}

// Use appropriate OCR language
const result = await Tesseract.recognize(countRegion, detectLanguage(screenshot));
```

**Expected Improvement:** Works for all languages

---

### 17. Export Detection Report ⭐⭐
**Problem:** Can't share or save detection results
**Impact:** No record of results
**Effort:** 2 hours

**Solution:**
```typescript
// Export as JSON or image
function exportDetectionReport(detections: Detection[], screenshot: string): void {
    const report = {
        timestamp: new Date().toISOString(),
        screenshot: screenshot,
        items: detections.map(d => ({
            name: d.entity.name,
            count: d.count,
            confidence: d.confidence,
            position: d.position,
        })),
        accuracy: calculateAccuracy(detections),
    };

    downloadJSON(report, 'detection-report.json');
}
```

**Expected Improvement:** Better testing and sharing

---

### 18. Incremental Detection ⭐⭐
**Problem:** Re-scans entire screenshot even if only one item changed
**Impact:** Slow for live detection
**Effort:** 3-4 hours

**Solution:**
```typescript
// Detect only changed cells
function detectIncremental(newScreenshot: string, prevScreenshot: string): Detection[] {
    const changedCells = detectChangedRegions(newScreenshot, prevScreenshot);

    // Only re-scan changed cells
    return matchCells(changedCells, templates);
}
```

**Expected Improvement:** 5-10x faster for minor changes

---

## 📊 Priority Matrix

| Feature | Impact | Effort | ROI | Priority |
|---------|--------|--------|-----|----------|
| Grid Detection Accuracy | High | Low | ⭐⭐⭐⭐⭐ | CRITICAL |
| Adaptive Threshold | High | Low | ⭐⭐⭐⭐⭐ | CRITICAL |
| Empty Cell Detection | Medium | Low | ⭐⭐⭐⭐ | CRITICAL |
| Duplicate Aggregation | High | Low | ⭐⭐⭐⭐ | CRITICAL |
| Resolution Scaling | Medium | Low | ⭐⭐⭐⭐ | HIGH |
| Color Pre-filtering | High | Medium | ⭐⭐⭐⭐ | HIGH |
| Multi-Pass Matching | High | Medium | ⭐⭐⭐⭐ | HIGH |
| ML Model | High | High | ⭐⭐⭐ | MEDIUM |
| Web Workers | Medium | Medium | ⭐⭐⭐ | MEDIUM |
| Debug Overlay | Low | Medium | ⭐⭐⭐ | MEDIUM |
| Border Detection | Low | Medium | ⭐⭐ | LOW |
| Caching | Low | Low | ⭐⭐ | LOW |

---

## 🎯 Recommended Implementation Order

### Phase 1: Quick Wins (Week 1)
1. Empty cell detection (1h)
2. Duplicate aggregation (1h)
3. Adaptive threshold (2h)
4. Resolution scaling (2h)

**Total: 6 hours**
**Expected Improvement: +20-30% accuracy**

### Phase 2: Core Improvements (Week 2)
1. Dynamic grid detection (3h)
2. Multi-pass matching (3h)
3. Color pre-filtering (4h)

**Total: 10 hours**
**Expected Improvement: +15-25% accuracy, 3x speed**

### Phase 3: Advanced Features (Week 3)
1. Confidence boosting (3h)
2. Debug overlay (4h)
3. Border detection (3h)

**Total: 10 hours**
**Expected Improvement: +10-15% accuracy, better debugging**

### Phase 4: Future (Later)
1. ML model (12h)
2. Web Workers (5h)
3. Progressive loading (2h)
4. Caching (1h)

**Total: 20 hours**
**Expected Improvement: 2-3x speed, +10% accuracy**

---

## 🚀 Quick Fix Priority

**If you can only do 5 things, do these:**

1. **Empty cell detection** - Kills false positives (1h)
2. **Duplicate aggregation** - Better UX (1h)
3. **Adaptive threshold** - Better accuracy (2h)
4. **Dynamic grid detection** - Handles all UIs (3h)
5. **Color pre-filtering** - 3x faster (4h)

**Total: 11 hours, massive improvement**

---

## Testing Each Feature

Each feature should be tested with:
1. Level 52 Spanish screenshot (your test)
2. Level 38 clean screenshot (baseline)
3. Level 86 intermediate (duplicates)
4. Level 98 chaos (stress test)

Target: 90%+ accuracy on all tests

---

## What to Do Next?

Pick a priority level and I'll implement it:
- **Quick wins:** Empty cells + duplicates (2 hours)
- **Core fix:** Dynamic grid detection (3 hours)
- **Speed boost:** Color pre-filtering (4 hours)
- **All of Phase 1:** Complete quick wins (6 hours)

Your choice! 🚀
