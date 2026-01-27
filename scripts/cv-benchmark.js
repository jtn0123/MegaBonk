#!/usr/bin/env node
/**
 * CV Benchmark Runner
 *
 * Runs CV detection on all ground-truth images and records metrics.
 * Results are stored in data/benchmark-history.json for tracking over time.
 *
 * Usage:
 *   node scripts/cv-benchmark.js                    # Run full benchmark
 *   node scripts/cv-benchmark.js --quick            # Run on subset (3 images)
 *   node scripts/cv-benchmark.js --image <path>     # Run on specific image
 *   node scripts/cv-benchmark.js --compare          # Compare to last run
 *   node scripts/cv-benchmark.js --history          # Show history summary
 */

const fs = require('fs');
const path = require('path');

// Optional canvas for image processing
let createCanvas, loadImage;
try {
    const canvas = require('canvas');
    createCanvas = canvas.createCanvas;
    loadImage = canvas.loadImage;
} catch (e) {
    console.error('Warning: canvas module not available. Install with: npm install canvas');
    process.exit(1);
}

// ========================================
// Configuration
// ========================================

const CONFIG = {
    GROUND_TRUTH_PATH: path.join(__dirname, '..', 'test-images', 'gameplay', 'ground-truth.json'),
    IMAGES_BASE_PATH: path.join(__dirname, '..', 'test-images', 'gameplay'),
    BENCHMARK_HISTORY_PATH: path.join(__dirname, '..', 'data', 'benchmark-history.json'),
    ITEMS_PATH: path.join(__dirname, '..', 'data', 'items.json'),
    TEMPLATES_PATH: path.join(__dirname, '..', 'src', 'images', 'items'),

    // Detection settings
    // Note: With current static templates, max similarity is ~25-30%
    // Training data crops would yield better results
    DEFAULT_THRESHOLD: 0.45, // Restored - need template replacement to improve
    BASE_RESOLUTION: 720,

    // Grid calibration presets
    // NOTE: These are tuned for the hotbar at the bottom of the screen
    // yOffset is distance from bottom of screen to bottom of icon grid
    CALIBRATION_PRESETS: {
        '1280x720': {
            xOffset: -115,
            yOffset: 30,
            iconWidth: 36,
            iconHeight: 36,
            xSpacing: 4,
            ySpacing: 4,
            iconsPerRow: 14,
        },
        '1280x800': {
            xOffset: -115,
            yOffset: 34,
            iconWidth: 40,
            iconHeight: 40,
            xSpacing: 5,
            ySpacing: 5,
            iconsPerRow: 14,
        },
        '1600x900': {
            xOffset: -115,
            yOffset: 38,
            iconWidth: 45,
            iconHeight: 45,
            xSpacing: 5,
            ySpacing: 5,
            iconsPerRow: 14,
        },
        '1920x1080': {
            xOffset: 10, // Positive offset - items are right of center
            yOffset: 35, // Items are lower in screen
            iconWidth: 58, // Icons appear larger than 48
            iconHeight: 58,
            xSpacing: 12, // More spacing between icons
            ySpacing: 6,
            iconsPerRow: 14,
        },
        '2560x1440': {
            xOffset: -130,
            yOffset: 60,
            iconWidth: 64,
            iconHeight: 64,
            xSpacing: 8,
            ySpacing: 8,
            iconsPerRow: 14,
        },
    },
};

// ========================================
// Utility Functions
// ========================================

function nameToId(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
}

function getCalibrationForResolution(width, height) {
    const key = `${width}x${height}`;
    if (CONFIG.CALIBRATION_PRESETS[key]) {
        return { ...CONFIG.CALIBRATION_PRESETS[key] };
    }
    // Scale from base
    const scale = height / CONFIG.BASE_RESOLUTION;
    return {
        xOffset: 0,
        yOffset: Math.round(92 * scale),
        iconWidth: Math.round(40 * scale),
        iconHeight: Math.round(40 * scale),
        xSpacing: Math.round(4 * scale),
        ySpacing: Math.round(4 * scale),
        iconsPerRow: 22,
    };
}

function calculateGridPositions(imageWidth, imageHeight, calibration, itemCount) {
    const positions = [];
    const cellWidth = calibration.iconWidth + calibration.xSpacing;
    const cellHeight = calibration.iconHeight + calibration.ySpacing;
    const totalGridWidth = calibration.iconsPerRow * cellWidth - calibration.xSpacing;
    const startX = Math.round((imageWidth - totalGridWidth) / 2) + calibration.xOffset;
    const numRows = Math.ceil(itemCount / calibration.iconsPerRow);
    const totalGridHeight = numRows * cellHeight - calibration.ySpacing;
    const startY = imageHeight - totalGridHeight - calibration.yOffset;

    for (let i = 0; i < itemCount; i++) {
        const row = Math.floor(i / calibration.iconsPerRow);
        const col = i % calibration.iconsPerRow;
        positions.push({
            index: i,
            x: Math.round(startX + col * cellWidth),
            y: Math.round(startY + row * cellHeight),
            width: calibration.iconWidth,
            height: calibration.iconHeight,
        });
    }
    return positions;
}

// Simple NCC (Normalized Cross-Correlation) for template matching
function calculateNCC(imgData1, imgData2) {
    if (imgData1.length !== imgData2.length) return 0;

    let sum1 = 0,
        sum2 = 0;
    const n = imgData1.length / 4; // RGBA

    // Calculate means
    for (let i = 0; i < imgData1.length; i += 4) {
        sum1 += (imgData1[i] + imgData1[i + 1] + imgData1[i + 2]) / 3;
        sum2 += (imgData2[i] + imgData2[i + 1] + imgData2[i + 2]) / 3;
    }
    const mean1 = sum1 / n;
    const mean2 = sum2 / n;

    // Calculate NCC
    let numerator = 0,
        denom1 = 0,
        denom2 = 0;
    for (let i = 0; i < imgData1.length; i += 4) {
        const v1 = (imgData1[i] + imgData1[i + 1] + imgData1[i + 2]) / 3 - mean1;
        const v2 = (imgData2[i] + imgData2[i + 1] + imgData2[i + 2]) / 3 - mean2;
        numerator += v1 * v2;
        denom1 += v1 * v1;
        denom2 += v2 * v2;
    }

    const denom = Math.sqrt(denom1 * denom2);
    return denom > 0 ? numerator / denom : 0;
}

// SSIM (Structural Similarity Index) - more robust than NCC
function calculateSSIM(imgData1, imgData2) {
    if (imgData1.length !== imgData2.length) return 0;
    const n = imgData1.length / 4;
    if (n === 0) return 0;

    // Convert to grayscale and calculate stats
    let mean1 = 0,
        mean2 = 0;
    const gray1 = [],
        gray2 = [];

    for (let i = 0; i < imgData1.length; i += 4) {
        const g1 = (imgData1[i] + imgData1[i + 1] + imgData1[i + 2]) / 3;
        const g2 = (imgData2[i] + imgData2[i + 1] + imgData2[i + 2]) / 3;
        gray1.push(g1);
        gray2.push(g2);
        mean1 += g1;
        mean2 += g2;
    }

    mean1 /= n;
    mean2 /= n;

    let var1 = 0,
        var2 = 0,
        covar = 0;
    for (let i = 0; i < n; i++) {
        const d1 = gray1[i] - mean1;
        const d2 = gray2[i] - mean2;
        var1 += d1 * d1;
        var2 += d2 * d2;
        covar += d1 * d2;
    }

    var1 /= n;
    var2 /= n;
    covar /= n;

    const C1 = (0.01 * 255) ** 2;
    const C2 = (0.03 * 255) ** 2;

    const ssim = ((2 * mean1 * mean2 + C1) * (2 * covar + C2)) / ((mean1 ** 2 + mean2 ** 2 + C1) * (var1 + var2 + C2));

    return Math.max(0, Math.min(1, ssim));
}

// Color histogram similarity
function calculateHistogramSimilarity(imgData1, imgData2) {
    if (imgData1.length !== imgData2.length) return 0;

    // Build RGB histograms with 16 bins per channel
    const bins = 16;
    const hist1 = { r: new Array(bins).fill(0), g: new Array(bins).fill(0), b: new Array(bins).fill(0) };
    const hist2 = { r: new Array(bins).fill(0), g: new Array(bins).fill(0), b: new Array(bins).fill(0) };

    for (let i = 0; i < imgData1.length; i += 4) {
        const bin1r = Math.min(bins - 1, Math.floor((imgData1[i] / 256) * bins));
        const bin1g = Math.min(bins - 1, Math.floor((imgData1[i + 1] / 256) * bins));
        const bin1b = Math.min(bins - 1, Math.floor((imgData1[i + 2] / 256) * bins));
        hist1.r[bin1r]++;
        hist1.g[bin1g]++;
        hist1.b[bin1b]++;

        const bin2r = Math.min(bins - 1, Math.floor((imgData2[i] / 256) * bins));
        const bin2g = Math.min(bins - 1, Math.floor((imgData2[i + 1] / 256) * bins));
        const bin2b = Math.min(bins - 1, Math.floor((imgData2[i + 2] / 256) * bins));
        hist2.r[bin2r]++;
        hist2.g[bin2g]++;
        hist2.b[bin2b]++;
    }

    // Calculate histogram intersection (normalized)
    const n = imgData1.length / 4;
    let intersection = 0;
    for (let i = 0; i < bins; i++) {
        intersection += Math.min(hist1.r[i], hist2.r[i]);
        intersection += Math.min(hist1.g[i], hist2.g[i]);
        intersection += Math.min(hist1.b[i], hist2.b[i]);
    }

    return intersection / (n * 3);
}

// Combined similarity score (weighted average of metrics)
function calculateCombinedScore(imgData1, imgData2) {
    const ncc = calculateNCC(imgData1, imgData2);
    const ssim = calculateSSIM(imgData1, imgData2);
    const hist = calculateHistogramSimilarity(imgData1, imgData2);

    // Weight: SSIM (most robust), Histogram (color), NCC (structure)
    // NCC can be negative, normalize it to [0, 1]
    const nccNorm = (ncc + 1) / 2;

    return 0.4 * ssim + 0.35 * hist + 0.25 * nccNorm;
}

// ========================================
// Detection Engine (Simplified)
// ========================================

class SimpleCVEngine {
    constructor() {
        this.templates = new Map();
        this.itemsData = null;
    }

    async loadTemplates() {
        // Load items data
        if (fs.existsSync(CONFIG.ITEMS_PATH)) {
            this.itemsData = JSON.parse(fs.readFileSync(CONFIG.ITEMS_PATH, 'utf8'));
        }

        if (!this.itemsData?.items) {
            console.error('Could not load items.json');
            return;
        }

        // Load template images
        for (const item of this.itemsData.items) {
            const templatePath = path.join(__dirname, '..', 'src', item.image);
            if (fs.existsSync(templatePath)) {
                try {
                    const img = await loadImage(templatePath);
                    const canvas = createCanvas(40, 40);
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, 40, 40);
                    const imageData = ctx.getImageData(0, 0, 40, 40);
                    this.templates.set(item.id, {
                        item,
                        imageData: imageData.data,
                    });
                } catch (e) {
                    // Template not found
                }
            }
        }

        console.log(`Loaded ${this.templates.size} templates`);
    }

    async detectItems(imagePath, groundTruthItems, threshold = CONFIG.DEFAULT_THRESHOLD, diagnosticMode = false) {
        const fullPath = path.join(CONFIG.IMAGES_BASE_PATH, imagePath);
        if (!fs.existsSync(fullPath)) {
            return { error: `Image not found: ${fullPath}` };
        }

        const image = await loadImage(fullPath);
        const width = image.width;
        const height = image.height;

        const calibration = getCalibrationForResolution(width, height);
        const positions = calculateGridPositions(width, height, calibration, groundTruthItems.length);

        // Create canvas for the image
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        const detections = [];
        const startTime = Date.now();
        const diagnosticData = [];

        for (let i = 0; i < positions.length && i < groundTruthItems.length; i++) {
            const pos = positions[i];

            // Extract crop
            const cropCanvas = createCanvas(40, 40);
            const cropCtx = cropCanvas.getContext('2d');
            cropCtx.drawImage(canvas, pos.x, pos.y, pos.width, pos.height, 0, 0, 40, 40);
            const cropData = cropCtx.getImageData(0, 0, 40, 40).data;

            // Match against templates
            let bestMatch = null;
            let bestScore = 0;
            const allScores = [];

            for (const [itemId, template] of this.templates) {
                const ncc = calculateNCC(cropData, template.imageData);
                const ssim = calculateSSIM(cropData, template.imageData);
                const hist = calculateHistogramSimilarity(cropData, template.imageData);
                const nccNorm = (ncc + 1) / 2;
                const score = 0.4 * ssim + 0.35 * hist + 0.25 * nccNorm;

                allScores.push({ itemId, name: template.item.name, ncc, nccNorm, ssim, hist, score });

                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = template.item;
                }
            }

            // Sort scores for diagnostic output
            allScores.sort((a, b) => b.score - a.score);

            if (diagnosticMode) {
                diagnosticData.push({
                    slot: i,
                    groundTruth: groundTruthItems[i],
                    position: pos,
                    topMatches: allScores.slice(0, 5),
                    bestScore,
                    threshold,
                    passesThreshold: bestScore >= threshold,
                });
            }

            if (bestMatch && bestScore >= threshold) {
                detections.push({
                    slot: i,
                    item: bestMatch.name,
                    itemId: bestMatch.id,
                    confidence: bestScore,
                    groundTruth: groundTruthItems[i],
                    correct: bestMatch.name === groundTruthItems[i],
                });
            } else {
                detections.push({
                    slot: i,
                    item: null,
                    confidence: bestScore,
                    groundTruth: groundTruthItems[i],
                    correct: false,
                    bestMatchedItem: bestMatch?.name,
                });
            }
        }

        const elapsed = Date.now() - startTime;

        // Calculate metrics
        const truePositives = detections.filter(d => d.correct).length;
        const falsePositives = detections.filter(d => d.item && !d.correct).length;
        const falseNegatives = detections.filter(d => !d.item || !d.correct).length;

        const precision = truePositives + falsePositives > 0 ? truePositives / (truePositives + falsePositives) : 0;
        const recall = truePositives + falseNegatives > 0 ? truePositives / (truePositives + falseNegatives) : 0;
        const f1 = precision + recall > 0 ? (2 * (precision * recall)) / (precision + recall) : 0;

        return {
            imagePath,
            resolution: `${width}x${height}`,
            itemCount: groundTruthItems.length,
            detections,
            metrics: {
                truePositives,
                falsePositives,
                falseNegatives,
                precision,
                recall,
                f1,
                accuracy: truePositives / groundTruthItems.length,
            },
            timing: {
                totalMs: elapsed,
                perItemMs: elapsed / groundTruthItems.length,
            },
            threshold,
            diagnosticData: diagnosticMode ? diagnosticData : undefined,
        };
    }
}

// ========================================
// Benchmark History Management
// ========================================

function loadBenchmarkHistory() {
    if (fs.existsSync(CONFIG.BENCHMARK_HISTORY_PATH)) {
        return JSON.parse(fs.readFileSync(CONFIG.BENCHMARK_HISTORY_PATH, 'utf8'));
    }
    return {
        version: 1,
        runs: [],
    };
}

function saveBenchmarkHistory(history) {
    const dir = path.dirname(CONFIG.BENCHMARK_HISTORY_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG.BENCHMARK_HISTORY_PATH, JSON.stringify(history, null, 2));
}

function addBenchmarkRun(history, runData) {
    history.runs.push(runData);
    // Keep last 100 runs
    if (history.runs.length > 100) {
        history.runs = history.runs.slice(-100);
    }
    saveBenchmarkHistory(history);
}

// ========================================
// Main Benchmark Runner
// ========================================

async function runBenchmark(options = {}) {
    const { quick, imagePath, verbose, diagnostic } = options;

    console.log('CV Benchmark Runner');
    console.log('===================');
    console.log('');

    // Load ground truth
    if (!fs.existsSync(CONFIG.GROUND_TRUTH_PATH)) {
        console.error(`Ground truth not found: ${CONFIG.GROUND_TRUTH_PATH}`);
        process.exit(1);
    }

    const groundTruth = JSON.parse(fs.readFileSync(CONFIG.GROUND_TRUTH_PATH, 'utf8'));
    const imageEntries = Object.entries(groundTruth).filter(([key]) => !key.startsWith('_'));

    // Filter images
    let imagesToRun;
    if (imagePath) {
        imagesToRun = imageEntries.filter(([path]) => path.includes(imagePath));
        if (imagesToRun.length === 0) {
            console.error(`No images matching: ${imagePath}`);
            process.exit(1);
        }
    } else if (quick) {
        // Pick 3 diverse images (different difficulties)
        imagesToRun = imageEntries.slice(0, 3);
    } else {
        imagesToRun = imageEntries;
    }

    console.log(`Running benchmark on ${imagesToRun.length} image(s)...`);
    console.log('');

    // Initialize CV engine
    const engine = new SimpleCVEngine();
    await engine.loadTemplates();

    // Run detection on each image
    const results = [];
    const startTime = Date.now();

    for (const [imgPath, data] of imagesToRun) {
        if (!data.items || data.items.length === 0) {
            console.log(`Skipping ${imgPath}: no ground truth items`);
            continue;
        }

        process.stdout.write(`Processing ${imgPath}... `);

        const result = await engine.detectItems(imgPath, data.items, CONFIG.DEFAULT_THRESHOLD, diagnostic);

        if (result.error) {
            console.log(`ERROR: ${result.error}`);
            continue;
        }

        results.push(result);

        const m = result.metrics;
        console.log(
            `F1=${(m.f1 * 100).toFixed(1)}% P=${(m.precision * 100).toFixed(1)}% R=${(m.recall * 100).toFixed(1)}% (${result.timing.totalMs}ms)`
        );

        if (verbose) {
            // Show incorrect detections
            const incorrect = result.detections.filter(d => !d.correct);
            for (const d of incorrect.slice(0, 5)) {
                console.log(
                    `  Slot ${d.slot}: detected "${d.item || d.bestMatchedItem}" but was "${d.groundTruth}" (${(d.confidence * 100).toFixed(0)}%)`
                );
            }
        }

        if (diagnostic && result.diagnosticData) {
            console.log('\n  === DIAGNOSTIC DATA ===');
            for (const slot of result.diagnosticData.slice(0, 3)) {
                console.log(`  Slot ${slot.slot}: Expected "${slot.groundTruth}"`);
                console.log(
                    `    Position: x=${slot.position.x}, y=${slot.position.y}, ${slot.position.width}x${slot.position.height}`
                );
                console.log(
                    `    Best score: ${(slot.bestScore * 100).toFixed(1)}% (threshold: ${(slot.threshold * 100).toFixed(0)}%)`
                );
                console.log(`    Top 5 matches:`);
                for (const match of slot.topMatches) {
                    const marker = match.name === slot.groundTruth ? ' ← EXPECTED' : '';
                    console.log(
                        `      ${match.name}: ${(match.score * 100).toFixed(1)}% (SSIM=${(match.ssim * 100).toFixed(0)}%, Hist=${(match.hist * 100).toFixed(0)}%, NCC=${(match.nccNorm * 100).toFixed(0)}%)${marker}`
                    );
                }
            }
            console.log('');
        }
    }

    const totalTime = Date.now() - startTime;

    // Calculate aggregate metrics
    const aggregate = {
        imageCount: results.length,
        totalItems: results.reduce((s, r) => s + r.itemCount, 0),
        totalTruePositives: results.reduce((s, r) => s + r.metrics.truePositives, 0),
        totalFalsePositives: results.reduce((s, r) => s + r.metrics.falsePositives, 0),
        totalFalseNegatives: results.reduce((s, r) => s + r.metrics.falseNegatives, 0),
    };

    aggregate.precision =
        aggregate.totalTruePositives + aggregate.totalFalsePositives > 0
            ? aggregate.totalTruePositives / (aggregate.totalTruePositives + aggregate.totalFalsePositives)
            : 0;
    aggregate.recall =
        aggregate.totalTruePositives + aggregate.totalFalseNegatives > 0
            ? aggregate.totalTruePositives / (aggregate.totalTruePositives + aggregate.totalFalseNegatives)
            : 0;
    aggregate.f1 =
        aggregate.precision + aggregate.recall > 0
            ? (2 * (aggregate.precision * aggregate.recall)) / (aggregate.precision + aggregate.recall)
            : 0;
    aggregate.accuracy = aggregate.totalItems > 0 ? aggregate.totalTruePositives / aggregate.totalItems : 0;

    // Per-image averages
    aggregate.avgF1 = results.length > 0 ? results.reduce((s, r) => s + r.metrics.f1, 0) / results.length : 0;
    aggregate.avgPrecision =
        results.length > 0 ? results.reduce((s, r) => s + r.metrics.precision, 0) / results.length : 0;
    aggregate.avgRecall = results.length > 0 ? results.reduce((s, r) => s + r.metrics.recall, 0) / results.length : 0;

    console.log('');
    console.log('Aggregate Results');
    console.log('-----------------');
    console.log(`Images:      ${aggregate.imageCount}`);
    console.log(`Total items: ${aggregate.totalItems}`);
    console.log(
        `TP/FP/FN:    ${aggregate.totalTruePositives}/${aggregate.totalFalsePositives}/${aggregate.totalFalseNegatives}`
    );
    console.log(`Accuracy:    ${(aggregate.accuracy * 100).toFixed(1)}%`);
    console.log(`Precision:   ${(aggregate.precision * 100).toFixed(1)}%`);
    console.log(`Recall:      ${(aggregate.recall * 100).toFixed(1)}%`);
    console.log(`F1 Score:    ${(aggregate.f1 * 100).toFixed(1)}%`);
    console.log(`Avg F1:      ${(aggregate.avgF1 * 100).toFixed(1)}%`);
    console.log(`Total time:  ${totalTime}ms`);

    // Create benchmark run record
    const runData = {
        id: `run_${Date.now()}`,
        timestamp: new Date().toISOString(),
        mode: quick ? 'quick' : imagePath ? 'single' : 'full',
        imageCount: aggregate.imageCount,
        totalItems: aggregate.totalItems,
        metrics: {
            accuracy: aggregate.accuracy,
            precision: aggregate.precision,
            recall: aggregate.recall,
            f1: aggregate.f1,
            avgF1: aggregate.avgF1,
        },
        timing: {
            totalMs: totalTime,
            avgPerImageMs: totalTime / results.length,
        },
        perImage: results.map(r => ({
            image: r.imagePath,
            resolution: r.resolution,
            itemCount: r.itemCount,
            metrics: r.metrics,
            timing: r.timing,
        })),
        config: {
            threshold: CONFIG.DEFAULT_THRESHOLD,
            templateCount: engine.templates.size,
        },
    };

    // Save to history
    const history = loadBenchmarkHistory();
    addBenchmarkRun(history, runData);

    console.log('');
    console.log(`Results saved to: ${CONFIG.BENCHMARK_HISTORY_PATH}`);

    return runData;
}

async function showHistory() {
    const history = loadBenchmarkHistory();

    if (history.runs.length === 0) {
        console.log('No benchmark history found. Run a benchmark first.');
        return;
    }

    console.log('Benchmark History');
    console.log('=================');
    console.log('');
    console.log('Date                 | Mode   | Images | F1     | Precision | Recall | Time');
    console.log('---------------------|--------|--------|--------|-----------|--------|------');

    for (const run of history.runs.slice(-20).reverse()) {
        const date = new Date(run.timestamp).toISOString().slice(0, 16).replace('T', ' ');
        const mode = run.mode.padEnd(6);
        const images = String(run.imageCount).padStart(6);
        const f1 = `${(run.metrics.f1 * 100).toFixed(1)}%`.padStart(6);
        const precision = `${(run.metrics.precision * 100).toFixed(1)}%`.padStart(9);
        const recall = `${(run.metrics.recall * 100).toFixed(1)}%`.padStart(6);
        const time = `${run.timing.totalMs}ms`.padStart(6);

        console.log(`${date} | ${mode} | ${images} | ${f1} | ${precision} | ${recall} | ${time}`);
    }

    // Show trend
    if (history.runs.length >= 2) {
        const recent = history.runs.slice(-5);
        const older = history.runs.slice(-10, -5);

        if (older.length > 0) {
            const recentAvgF1 = recent.reduce((s, r) => s + r.metrics.f1, 0) / recent.length;
            const olderAvgF1 = older.reduce((s, r) => s + r.metrics.f1, 0) / older.length;
            const delta = recentAvgF1 - olderAvgF1;

            console.log('');
            console.log(`Trend: ${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(2)}% F1 (last 5 vs previous 5)`);
        }
    }
}

async function compareToLast() {
    const history = loadBenchmarkHistory();

    if (history.runs.length < 2) {
        console.log('Need at least 2 runs to compare. Run more benchmarks first.');
        return;
    }

    const current = history.runs[history.runs.length - 1];
    const previous = history.runs[history.runs.length - 2];

    console.log('Comparison: Current vs Previous Run');
    console.log('====================================');
    console.log('');
    console.log(`Current:  ${current.timestamp}`);
    console.log(`Previous: ${previous.timestamp}`);
    console.log('');

    const metrics = ['accuracy', 'precision', 'recall', 'f1'];
    for (const m of metrics) {
        const curr = current.metrics[m] * 100;
        const prev = previous.metrics[m] * 100;
        const delta = curr - prev;
        const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '=';
        console.log(`${m.padEnd(10)}: ${curr.toFixed(1)}% ${arrow} (${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%)`);
    }

    // Per-image comparison
    if (current.perImage && previous.perImage) {
        console.log('');
        console.log('Per-Image Changes:');

        for (const currImg of current.perImage) {
            const prevImg = previous.perImage.find(p => p.image === currImg.image);
            if (prevImg) {
                const delta = currImg.metrics.f1 - prevImg.metrics.f1;
                if (Math.abs(delta) > 0.01) {
                    const arrow = delta > 0 ? '↑' : '↓';
                    console.log(`  ${currImg.image}: ${arrow} ${(delta * 100).toFixed(1)}%`);
                }
            }
        }
    }
}

// ========================================
// Main
// ========================================

async function extractCrops(imagePath) {
    console.log('Extracting crops for visual inspection...\n');

    // Load ground truth
    const groundTruth = JSON.parse(fs.readFileSync(CONFIG.GROUND_TRUTH_PATH, 'utf8'));
    const imageEntries = Object.entries(groundTruth).filter(([key]) => key.includes(imagePath));

    if (imageEntries.length === 0) {
        console.error(`No images matching: ${imagePath}`);
        process.exit(1);
    }

    const [imgPath, data] = imageEntries[0];
    const fullPath = path.join(CONFIG.IMAGES_BASE_PATH, imgPath);

    if (!fs.existsSync(fullPath)) {
        console.error(`Image not found: ${fullPath}`);
        process.exit(1);
    }

    const image = await loadImage(fullPath);
    const width = image.width;
    const height = image.height;

    console.log(`Image: ${imgPath}`);
    console.log(`Actual resolution: ${width}x${height}`);
    console.log(`Ground truth resolution: ${data.resolution}`);
    console.log(`Items: ${data.items.length}\n`);

    const calibration = getCalibrationForResolution(width, height);
    console.log(
        `Calibration: icon=${calibration.iconWidth}x${calibration.iconHeight}, spacing=${calibration.xSpacing}x${calibration.ySpacing}`
    );
    console.log(
        `Grid: xOffset=${calibration.xOffset}, yOffset=${calibration.yOffset}, iconsPerRow=${calibration.iconsPerRow}\n`
    );

    const positions = calculateGridPositions(width, height, calibration, data.items.length);

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    // Create output directory
    const outputDir = path.join(__dirname, '..', 'test-images', 'debug-crops');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Extract and save first 5 crops
    for (let i = 0; i < Math.min(5, positions.length); i++) {
        const pos = positions[i];
        const expectedItem = data.items[i];

        // Save crop at original size
        const cropCanvas = createCanvas(pos.width, pos.height);
        const cropCtx = cropCanvas.getContext('2d');
        cropCtx.drawImage(canvas, pos.x, pos.y, pos.width, pos.height, 0, 0, pos.width, pos.height);

        const cropFile = path.join(outputDir, `crop_${i}_${nameToId(expectedItem)}_${pos.x}_${pos.y}.png`);
        const buffer = cropCanvas.toBuffer('image/png');
        fs.writeFileSync(cropFile, buffer);

        console.log(`Slot ${i}: "${expectedItem}" at (${pos.x}, ${pos.y}) ${pos.width}x${pos.height} → ${cropFile}`);
    }

    // Save a strip of the bottom area for debugging
    console.log('\nSaving bottom strip for reference...');
    const stripHeight = 100;
    const stripCanvas = createCanvas(width, stripHeight);
    const stripCtx = stripCanvas.getContext('2d');
    stripCtx.drawImage(canvas, 0, height - stripHeight, width, stripHeight, 0, 0, width, stripHeight);
    const stripFile = path.join(outputDir, `bottom_strip_${width}x${height}.png`);
    fs.writeFileSync(stripFile, stripCanvas.toBuffer('image/png'));
    console.log(`Bottom strip: ${stripFile}`);

    // Also save a template for comparison
    console.log('\nSaving template comparison...');
    const engine = new SimpleCVEngine();
    await engine.loadTemplates();

    for (let i = 0; i < Math.min(3, data.items.length); i++) {
        const expectedItem = data.items[i];
        const expectedId = nameToId(expectedItem);

        // Find the template
        for (const [templateId, template] of engine.templates) {
            if (templateId === expectedId) {
                // Reconstruct template from stored imageData
                const templateCanvas = createCanvas(40, 40);
                const templateCtx = templateCanvas.getContext('2d');
                const imgData = templateCtx.createImageData(40, 40);
                imgData.data.set(template.imageData);
                templateCtx.putImageData(imgData, 0, 0);

                const templateFile = path.join(outputDir, `template_${templateId}.png`);
                fs.writeFileSync(templateFile, templateCanvas.toBuffer('image/png'));
                console.log(`Template "${expectedItem}": ${templateFile}`);
                break;
            }
        }
    }

    console.log(`\nCrops saved to: ${outputDir}`);
}

async function main() {
    const args = process.argv.slice(2);

    if (args.includes('--history')) {
        await showHistory();
    } else if (args.includes('--compare')) {
        await compareToLast();
    } else if (args.includes('--extract')) {
        const imageIdx = args.indexOf('--image');
        const imagePath = imageIdx !== -1 ? args[imageIdx + 1] : 'level_33';
        await extractCrops(imagePath);
    } else {
        const options = {
            quick: args.includes('--quick'),
            verbose: args.includes('--verbose') || args.includes('-v'),
            diagnostic: args.includes('--diagnostic') || args.includes('-d'),
        };

        const imageIdx = args.indexOf('--image');
        if (imageIdx !== -1 && args[imageIdx + 1]) {
            options.imagePath = args[imageIdx + 1];
        }

        await runBenchmark(options);
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
