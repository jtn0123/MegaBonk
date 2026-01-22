# CV Integration Guide

This document describes the Computer Vision (CV) integration between the MegaBonk main website and the CV Validator tool.

## Overview

The CV system enables automatic detection of game items from screenshots, allowing users to:
- Upload screenshots to auto-populate the Build Planner
- Process multiple screenshots in batch mode
- See detection confidence scores
- Contribute training feedback to improve accuracy

## Architecture

```
src/modules/cv/
├── index.ts                    # Barrel file with all exports
├── core.ts                     # CV initialization and cleanup
├── detection.ts                # Item detection algorithms
├── templates.ts                # Template loading and management
├── unified-template-manager.ts # Multi-scale template system
├── auto-grid-detection.ts      # Automatic grid discovery
├── aggregation.ts              # Duplicate detection handling
├── color.ts                    # Color/rarity analysis
├── regions.ts                  # UI region detection
├── state.ts                    # Shared state and presets
├── training.ts                 # Training data loading
├── training-feedback.ts        # User feedback collection
├── active-learning.ts          # Uncertain detection prompts
├── metrics-summary.ts          # Detection quality metrics
├── accuracy-tracker.ts         # Benchmark history tracking
└── debug.ts                    # Debug visualization
```

## Key Features

### 1. Screenshot Upload in Build Planner

Users can import game screenshots to auto-populate their builds.

**Usage:**
```typescript
import { initBuildPlannerScan } from './modules/build-planner-scan';

// Initialize when Build Planner tab loads
initBuildPlannerScan();
```

**UI Flow:**
1. User clicks "Import from Screenshot" button
2. Selects or drag-drops an image file
3. CV system detects grid and items
4. Preview modal shows detected items with confidence scores
5. User confirms or adjusts before applying to build

### 2. Batch Screenshot Processing

Process multiple screenshots simultaneously for comparison.

**Usage:**
```typescript
import { processBatch, getBatchResults, compareBatchResults } from './modules/batch-scan';

// Process multiple images
const results = await processBatch(imageFiles, {
    onProgress: (current, total, filename) => {
        console.log(`Processing ${current}/${total}: ${filename}`);
    }
});

// Get results
const batchResults = getBatchResults();

// Compare results
const comparison = compareBatchResults();
```

### 3. Detection Metrics Summary

Display aggregate detection quality metrics.

**Usage:**
```typescript
import { calculateMetricsSummary, renderMetricsSummary } from './modules/cv';

const detections = [...]; // Array of DetectionForMetrics
const metrics = calculateMetricsSummary(detections);

// Render full summary
const html = renderMetricsSummary(metrics);

// Or render compact version
const compactHtml = renderCompactMetrics(metrics);
```

**Metrics Include:**
- Total/unique item counts
- Average/min/max confidence
- Quality grade (A/B/C/D/F)
- Confidence distribution (high/medium/low)
- Breakdown by rarity

### 4. Active Learning Prompts

Prompt users to verify uncertain detections to improve accuracy.

**Usage:**
```typescript
import {
    findUncertainDetections,
    startActiveLearningSession,
    handleVerificationAction,
    renderActiveLearningPrompt,
} from './modules/cv';

// Find uncertain detections
const uncertain = findUncertainDetections(detections, 0.6);

// Start session if enough uncertain
if (uncertain.length >= 2) {
    const session = startActiveLearningSession(detections, imageDataUrl, width, height);

    // Render prompt for current uncertain detection
    const html = renderActiveLearningPrompt(session.uncertainDetections[0]);
}

// Handle user response
const result = await handleVerificationAction('correct'); // or 'wrong', 'skip'
```

### 5. Training Feedback Export

Collect user corrections for training pipeline.

**Usage:**
```typescript
import {
    startFeedbackSession,
    addCorrection,
    exportFeedback,
    downloadFeedback,
} from './modules/cv';

// Start session with current screenshot
startFeedbackSession(imageDataUrl, width, height);

// Add correction when user identifies wrong detection
await addCorrection(detection, correctItem);

// Export for download
downloadFeedback(); // Downloads JSON file
```

**Export Format:**
```json
{
    "version": "1.0",
    "timestamp": "2026-01-21T...",
    "sourceImage": {
        "width": 1920,
        "height": 1080,
        "dataUrl": "data:image/png;base64,..."
    },
    "corrections": [
        {
            "id": "correction_0",
            "originalDetection": {
                "itemId": "wrong_item",
                "itemName": "Wrong Item",
                "confidence": 0.45,
                "position": { "x": 100, "y": 200, "width": 64, "height": 64 }
            },
            "correctedItem": {
                "id": "correct_item",
                "name": "Correct Item"
            },
            "cropDataUrl": "data:image/png;base64,...",
            "timestamp": "2026-01-21T..."
        }
    ]
}
```

### 6. Unified Template Manager

Multi-scale template system with quality scoring.

**Configuration:**
```typescript
const CONFIG = {
    SOURCE_WEIGHTS: {
        ground_truth: 1.5,    // Manually verified templates
        corrected: 1.3,       // User corrections
        corrected_from_empty: 1.2,
        verified: 1.0,        // Auto-verified
        unreviewed: 0.8,
        default: 0.7,
    },
    COMMON_ICON_SIZES: [32, 40, 48, 56, 64, 72],
    MAX_CACHE_SIZE: 500,
    CACHE_TTL_MS: 5 * 60 * 1000, // 5 minutes
};
```

**Usage:**
```typescript
import {
    loadTemplate,
    selectBestTemplates,
    generateMultiScaleVariants,
    getTemplateAtSize,
} from './modules/cv';

// Load template with quality scoring
const template = await loadTemplate('health_potion');

// Select best templates for detection
const best = selectBestTemplates(allTemplates, {
    maxPerItem: 3,
    minQuality: 0.5,
    preferDiversity: true,
});

// Get scaled variant
const scaled = await getTemplateAtSize('health_potion', 48);
```

### 7. Auto-Grid Detection

Automatic discovery of grid parameters from any screenshot.

**Usage:**
```typescript
import {
    autoDetectGrid,
    detectHotbarBand,
    detectRarityBorders,
    validateGrid,
} from './modules/cv';

// Full auto-detection
const result = await autoDetectGrid(canvas, {
    maxRows: 4,
    minCellSize: 32,
    maxCellSize: 100,
    progressCallback: (phase, progress) => {
        console.log(`${phase}: ${Math.round(progress * 100)}%`);
    },
});

if (result.success) {
    console.log(`Found ${result.calibration.rows}x${result.calibration.cols} grid`);
}
```

## Data Flow

```
Screenshot Upload
       │
       ▼
┌──────────────────┐
│  Auto-Grid       │ ◄── Grid Presets (if resolution matches)
│  Detection       │
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  Item Detection  │ ◄── Training Data + Templates
│  (Template Match)│
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  Aggregation     │
│  (Dedupe/NMS)    │
└──────────────────┘
       │
       ▼
┌──────────────────┐     ┌──────────────────┐
│  Results Display │ ──► │  Active Learning │
│  + Metrics       │     │  (if uncertain)  │
└──────────────────┘     └──────────────────┘
       │                         │
       ▼                         ▼
┌──────────────────┐     ┌──────────────────┐
│  Apply to Build  │     │  Export Feedback │
│  Planner         │     │  (for training)  │
└──────────────────┘     └──────────────────┘
```

## Configuration

### Grid Presets

Presets are stored in `data/grid-presets.json`:

```json
{
    "1920x1080": {
        "startX": 732,
        "startY": 584,
        "iconSize": 76,
        "gapX": 8,
        "gapY": 8,
        "rows": 4,
        "cols": 6
    }
}
```

### Training Data

Training data index at `data/training-data/index.json`:

```json
{
    "version": "1.0.0",
    "generatedAt": "2026-01-21T...",
    "sources": {
        "ground_truth": { "count": 150, "weight": 1.5 },
        "corrected": { "count": 280, "weight": 1.3 },
        "verified": { "count": 120, "weight": 1.0 }
    },
    "totalSamples": 550,
    "items": {
        "health_potion": ["ground_truth/health_potion_001.png", ...]
    }
}
```

## CSS Classes

### Metrics Summary
- `.metrics-summary` - Container for metrics display
- `.metrics-grade` - Letter grade display (A/B/C/D/F)
- `.grade-a` through `.grade-f` - Grade color variations
- `.metrics-compact` - Compact inline metrics display

### Active Learning
- `.active-learning-prompt` - Main prompt container
- `.al-detection` - Detection preview area
- `.al-crop` - Image crop display
- `.al-alternatives` - Alternative item suggestions
- `.al-badge` - Uncertain count badge

### Batch Processing
- `.batch-scan-container` - Batch processing container
- `.batch-results-grid` - Grid of batch results
- `.batch-thumbnail` - Screenshot thumbnail
- `.batch-comparison` - Comparison view

## Performance Considerations

1. **Template Caching**: Templates are cached with LRU eviction (max 500 entries, 5-minute TTL)

2. **Lazy Loading**: CV module is dynamically imported only when needed

3. **Multi-Scale Pre-generation**: Templates are pre-scaled to common sizes to avoid runtime scaling

4. **Grid Preset Matching**: Known resolutions skip auto-detection for faster processing

## Error Handling

All CV functions include try-catch blocks and return meaningful error states:

```typescript
const result = await autoDetectGrid(canvas);
if (!result.success) {
    console.error('Detection failed:', result.failureReason);
    // Handle gracefully - show manual input UI
}
```

## Testing

Unit tests are located in `tests/unit/`:
- `cv-detection-comprehensive.test.ts` - Detection algorithm tests
- `unified-template-manager.test.ts` - Template system tests
- `batch-scan.test.ts` - Batch processing tests

Run tests:
```bash
npm run test:unit
npm run test:cv:real  # Real image tests (requires canvas)
```
