# CV Module Architecture

## Overview

The Computer Vision (CV) module provides automated item detection from in-game screenshots of MegaBonk. It identifies items, counts, and grid positions using template matching, color analysis, and multi-strategy detection pipelines.

---

## Pipeline Flow

```text
Image Input (data URL)
  │
  ├─ loadImageToCanvas()                    [detection-processing.ts]
  │    → HTMLCanvasElement + CanvasRenderingContext2D
  │
  ├─ Cache Check (hashImageDataUrl)         [detection-utils.ts]
  │    → Return cached results if available
  │
  ├─ Adaptive Preprocessing                 [adaptive-preprocessing.ts]
  │    → analyzeScene() → getPreprocessConfig() → applyAdaptivePreprocessing()
  │    → Contrast enhancement, noise reduction, color normalization
  │
  ├─ Detection (two paths)
  │    │
  │    ├─ Two-Phase Detection (fast path)   [detection-pipeline/two-phase.ts]
  │    │    Phase 1: Detect grid structure (hotbar → edges → grid ROIs)
  │    │    Phase 2: Match templates only at grid positions
  │    │    ~100-200x faster than sliding window
  │    │
  │    └─ Sliding Window Detection (fallback) [detection-pipeline/sliding-window.ts]
  │         Scans image with multiple window sizes
  │         Color pre-filtering narrows candidate templates
  │         Used when two-phase grid detection fails
  │
  ├─ Post-Processing
  │    ├─ Non-Maximum Suppression (NMS)     [detection-utils.ts]
  │    ├─ Context-Based Confidence Boost    [detection-processing.ts]
  │    ├─ Border Rarity Validation          [detection-processing.ts]
  │    └─ Count Detection                   [count-detection.ts]
  │
  └─ Result Aggregation + Caching
       → CVDetectionResult[]
```

### scan-build.ts — Orchestrator

`scan-build.ts` is the main entry point for the scan-build UI feature. It:

- Initializes OCR and CV modules with game data (`initScanBuild`)
- Manages file upload, image display, and item selection state
- Preloads item templates via `loadItemTemplates()`
- Coordinates auto-detect (OCR-only with CV fallback) and hybrid detect (OCR + CV combined)
- Delegates detection to `scan-build-detection.ts` and result application to `scan-build-results.ts`
- Provides a mutex to prevent concurrent detection runs

### scan-build-enhanced.ts — Enhanced Strategy Support

`scan-build-enhanced.ts` extends the base scan-build with:

- Strategy selector UI (dropdown for current/optimized/fast/accurate/balanced)
- Enhanced hybrid detection using `detectItemsWithEnhancedCV` from `cv-enhanced/`
- Strategy comparison tool that benchmarks all strategies on the current image
- Metrics display showing detection time, confidence, and match rate

### scan-build-detection.ts — Detection Coordination

Handles the actual detection logic:

- `runAutoDetect`: OCR first, CV fallback if OCR finds nothing
- `runHybridDetect`: Sequential OCR then CV, results combined via `combineHybridResults`
- `combineHybridResults`: Merges OCR and CV results, deduplicates, aggregates counts
- Debug overlay rendering when debug mode is enabled

### Entry Barrel Files

- **computer-vision.ts**: Re-exports from `cv/index.ts`, assigns functions to `window` for browser compatibility
- **computer-vision-enhanced.ts**: Re-exports from `cv-enhanced/index.ts`, dynamic imports for window assignments

---

## Module Map

### Core Detection

| File | Responsibility |
|------|---------------|
| `detection-matching.ts` | Template matching (`matchTemplate`, `matchTemplateMulti`, `findBestTemplateMatch`). Integrates multi-scale templates, template ranking, and voting |
| `detection-processing.ts` | Image loading, result caching, confidence boosting, border rarity validation, result filtering |
| `detection-utils.ts` | IoU calculation, NMS, image resizing, icon/count region extraction, image hashing, template size lookup |
| `detection-config.ts` | Dynamic confidence thresholds, worker paths, detection state flags |
| `detection-core.ts` | Core detection logic shared across pipeline stages |
| `detection-grid.ts` | Hotbar detection, icon edge detection, grid inference, grid ROI generation |
| `detection.ts` | High-level detection barrel re-exporting pipeline + utilities |

### Grid System

| File | Responsibility |
|------|---------------|
| `grid-analysis.ts` | Core grid algorithms — hotbar band detection, border/edge detection, icon metrics, grid building |
| `grid-utils.ts` | Debug visualization and overlay drawing for detected grids |
| `grid-validation.ts` | Cell validation (empty/valid/suspicious), grid confidence scoring, preset comparison |
| `grid-types.ts` | Shared type definitions for grid system (non-grid/ version) |
| `grid/index.ts` | Barrel file for `grid/` subdirectory |
| `grid/grid-types.ts` | Type definitions (GridParameters, HotbarRegion, ScaleDetectionResult) |
| `grid/hotbar-detection.ts` | Hotbar region detection from screen bottom |
| `grid/edge-detection.ts` | Icon edge detection using brightness transitions |
| `grid/grid-inference.ts` | Infers grid layout from detected edges, generates ROIs |
| `grid/grid-verification.ts` | Grid pattern verification (mode finding, tolerance, clustering) |
| `grid/scale-detection.ts` | Adaptive icon sizing, dynamic scale detection, grid position detection |

### Color System

| File | Responsibility |
|------|---------------|
| `color.ts` | Barrel file re-exporting from color-utils, color-extraction, color-matching |
| `color-utils.ts` | RGB↔HSL conversion, rarity border color definitions, variance/saturation/histogram helpers, empty cell constants |
| `color-extraction.ts` | Dominant color extraction, detailed color categorization, border pixel sampling |
| `color-matching.ts` | Rarity color matching, empty cell detection, inventory background detection, border rarity classification |

### Templates

| File | Responsibility |
|------|---------------|
| `templates.ts` | Template loading from game data, multi-scale variant pre-generation, priority/standard loading phases |
| `template-ranking.ts` | Historical template performance tracking, skip lists, confusion matrices, optimal threshold calculation |
| `template-variants.ts` | Brightness/contrast/temperature variant generation for different lighting conditions |
| `unified-template-manager.ts` | Combined template loading + quality scoring + multi-scale generation used by both main site and CV validator |

### Detection Pipeline (`detection-pipeline/`)

| File | Responsibility |
|------|---------------|
| `orchestrator.ts` | Main detection entry point. Loads templates, selects strategies, runs two-phase or sliding window, applies post-processing |
| `two-phase.ts` | Fast two-phase detection: grid structure first, then template matching at grid positions only |
| `sliding-window.ts` | Sliding window scan with color pre-filtering and multi-scale matching |
| `ensemble-detection.ts` | Multi-strategy ensemble detection combining results from different strategies |
| `ocr-count.ts` | OCR-based item count extraction from cell corners using Tesseract |
| `worker-detection.ts` | Web Worker parallel template matching for UI responsiveness |
| `types.ts` | Shared types (ProgressCallback, TwoPhaseOptions, SlidingWindowOptions) |
| `index.ts` | Barrel file |

### Strategy System

| File | Responsibility |
|------|---------------|
| `cv-strategy.ts` (in `modules/`) | Strategy presets and runtime configuration, confidence thresholds, color profiles, HSV analysis, feedback correction loop |
| `ensemble-detector.ts` | Strategy definitions (DEFAULT, HIGH_PRECISION, HIGH_RECALL, EDGE_FOCUSED, COLOR_FOCUSED, FAST), ensemble configuration, strategy selection, result combination |

### Metrics & Debug

| File | Responsibility |
|------|---------------|
| `cv-metrics.ts` (in `modules/`) | Detection metrics tracking (timing, accuracy, per-strategy comparison) |
| `metrics.ts` | CV detection metrics collector (enable/disable, per-run tracking) |
| `metrics-summary.ts` | Aggregate metrics calculation, accuracy badges, compact display rendering |
| `debug.ts` | Debug overlay rendering with confidence-colored bounding boxes |
| `cv-config.ts` | Centralized configuration (detection thresholds, cache TTL, performance, image validation) |

### Training & Learning

| File | Responsibility |
|------|---------------|
| `training.ts` | Training data loader — loads validated samples for multi-template matching, session templates |
| `training-feedback.ts` | Feedback session management — crop extraction, corrections, export/download |
| `active-learning.ts` | Uncertain detection identification, verification prompts, real-time learning sessions |

### State & Configuration

| File | Responsibility |
|------|---------------|
| `state.ts` | Module-level state: game data, template maps, LRU caches, multi-scale templates, grid presets, cache cleanup |
| `cv-config.ts` | Runtime configuration API: detection, cache, performance, and image validation settings |

---

## Strategy System

### How Strategies Work

A `CVStrategy` (defined in `cv-strategy.ts`) is a configuration object controlling:

- **Color filtering**: `rarity-first` (filter by rarity border first), `color-first` (filter by dominant color), or `none`
- **Color analysis**: `single-dominant`, `multi-region` (5-region color profile), or `hsv-based`
- **Confidence thresholds**: `fixed`, `adaptive-rarity` (stricter for common, lenient for legendary), or `adaptive-gap`
- **Matching algorithm**: `ncc` (normalized cross-correlation), `ssd` (sum of squared differences), or `ssim` (structural similarity)
- **Toggles**: context boosting, border validation, feedback loop, empty cell detection, multi-pass matching

### Presets

| Preset | Speed | F1 Score | Key Tradeoffs |
|--------|-------|----------|--------------|
| `current` | Baseline | ~72% | Production default, color-first filtering |
| `optimized` | 37% faster | ~84% | Rarity-first + multi-region + feedback loop |
| `fast` | 70% faster | ~70% | Single-pass, no boosting/validation |
| `accurate` | 15% faster | ~86% | SSIM matching, adaptive-gap thresholds |
| `balanced` | 40% faster | ~83% | HSV-based color analysis |
| `tuned` | — | — | Fine-tuned thresholds for higher recall |

### Adding a New Strategy

1. Define the preset in `STRATEGY_PRESETS` in `src/modules/cv-strategy.ts`:

   ```typescript
   myStrategy: {
       colorFiltering: 'rarity-first',
       colorAnalysis: 'multi-region',
       confidenceThresholds: 'adaptive-rarity',
       matchingAlgorithm: 'ncc',
       useContextBoosting: true,
       useBorderValidation: true,
       useFeedbackLoop: false,
       useEmptyCellDetection: true,
       multiPassEnabled: true,
   },
   ```

2. Optionally add a matching `DetectionStrategy` in `ensemble-detector.ts` if it requires custom per-cell logic (similarity weights, sampling rates, etc.).
3. Update `scan-build-enhanced.ts` strategy descriptions to include the new option in the UI dropdown.

---

## How to Add a New Item Template

### Where Templates Live

- **Primary templates**: Loaded from game data images at runtime via `templates.ts` → `loadItemTemplates()`
- **Training templates**: JSON index at `data/training/index.json`, sample crops in `data/training/crops/`
- **Multi-scale variants**: Pre-generated at common icon sizes (32, 38, 40, 44, 48, 55, 64, 72 px) and cached in memory

### Template Format

A `TemplateData` object (from `types.ts`) contains:

```typescript
interface TemplateData {
    canvas: HTMLCanvasElement;   // Rendered template
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
    dominantColor?: string;     // For color pre-filtering
}
```

### Loading Flow

1. `loadItemTemplates()` in `templates.ts` iterates game data items
2. Each item's image is loaded into a canvas, creating a `TemplateData`
3. Dominant color is extracted and stored in `templatesByColor` map for fast lookup
4. Multi-scale variants are pre-generated at `COMMON_ICON_SIZES`
5. Priority items (common/uncommon) load first, then remaining items load in background

### How Templates Are Matched

1. Screenshot cell is extracted via `extractIconRegion()` (80% of cell to exclude count overlay)
2. Template is resized to match cell dimensions (multi-scale cache → resized cache → on-demand resize)
3. `calculateSimilarity()` computes enhanced multi-metric similarity (NCC + SSIM + histogram + edges)
4. If training templates exist, `matchTemplateMulti()` uses voting to combine scores
5. Template ranking system filters out known poor performers via skip lists

### Adding a New Item

No code changes needed — just add the item to the game data JSON with an `image` field pointing to the icon file. The template loading pipeline handles the rest automatically.

### Adding Manual Training Data

1. Place a cropped icon image in `data/training/crops/<item-id>/`
2. Add an entry to `data/training/index.json` with sample metadata
3. The training loader (`training.ts`) picks it up for multi-template matching
