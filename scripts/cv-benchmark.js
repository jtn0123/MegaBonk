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
 *   node scripts/cv-benchmark.js --mode <mode>      # Run one template mode
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
    TRAINING_INDEX_PATH: path.join(__dirname, '..', 'data', 'training-data', 'index.json'),
    TRAINING_BASE_PATH: path.join(__dirname, '..', 'data', 'training-data'),

    // Detection settings
    // Note: With current static templates, max similarity is ~25-30%
    // Training data crops would yield better results
    DEFAULT_THRESHOLD: 0.45, // Restored - need template replacement to improve
    BASE_RESOLUTION: 720,
    DEFAULT_TEMPLATE_MODES: ['primary_only', 'primary_plus_training', 'training_preferred'],
    MIN_TRAINING_SAMPLES: 3,
    MAX_TRAINING_TEMPLATES_PER_ITEM: 4,

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
    constructor(options = {}) {
        this.templateMode = options.templateMode || 'primary_only';
        this.minTrainingSamples = options.minTrainingSamples || CONFIG.MIN_TRAINING_SAMPLES;
        this.templates = new Map();
        this.trainingTemplates = new Map();
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

        let trainingIndex = null;
        if (this.templateMode !== 'primary_only' && fs.existsSync(CONFIG.TRAINING_INDEX_PATH)) {
            trainingIndex = JSON.parse(fs.readFileSync(CONFIG.TRAINING_INDEX_PATH, 'utf8'));
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

            const trainingItem = trainingIndex?.items?.[item.id];
            if (trainingItem?.sample_count >= this.minTrainingSamples) {
                const trainingVariants = [];
                for (const sample of trainingItem.samples.slice(0, CONFIG.MAX_TRAINING_TEMPLATES_PER_ITEM)) {
                    const samplePath = path.join(CONFIG.TRAINING_BASE_PATH, sample.file);
                    if (!fs.existsSync(samplePath)) continue;

                    try {
                        const img = await loadImage(samplePath);
                        const canvas = createCanvas(40, 40);
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, 40, 40);
                        const imageData = ctx.getImageData(0, 0, 40, 40);
                        trainingVariants.push({
                            imageData: imageData.data,
                            validationType: sample.validation_type,
                        });
                    } catch (e) {
                        // Skip individual training sample failures
                    }
                }

                if (trainingVariants.length >= this.minTrainingSamples) {
                    this.trainingTemplates.set(item.id, trainingVariants);
                }
            }
        }

        console.log(
            `Loaded ${this.templates.size} templates (${this.trainingTemplates.size} items with training data) for ${this.templateMode}`
        );
    }

    getWeightedTrainingScore(scores, variants) {
        if (scores.length === 0) return 0;

        let weightedTotal = 0;
        let totalWeight = 0;
        for (let i = 0; i < scores.length; i++) {
            const validationType = variants[i]?.validationType;
            const weight = validationType === 'corrected' ? 1.15 : validationType === 'verified' ? 1.05 : 1;
            weightedTotal += scores[i] * weight;
            totalWeight += weight;
        }

        return totalWeight > 0 ? weightedTotal / totalWeight : 0;
    }

    getScoreForItem(cropData, itemId) {
        const primaryTemplate = this.templates.get(itemId);
        if (!primaryTemplate) return { score: 0, templateSource: 'missing' };

        const primaryScore = calculateCombinedScore(cropData, primaryTemplate.imageData);
        if (this.templateMode === 'primary_only') {
            return { score: primaryScore, templateSource: 'primary' };
        }

        const trainingVariants = this.trainingTemplates.get(itemId) || [];
        if (trainingVariants.length < this.minTrainingSamples) {
            return { score: primaryScore, templateSource: 'primary' };
        }

        const trainingScores = trainingVariants.map(variant => calculateCombinedScore(cropData, variant.imageData));
        const bestTrainingScore = Math.max(...trainingScores);
        const weightedTrainingScore = this.getWeightedTrainingScore(trainingScores, trainingVariants);

        if (this.templateMode === 'primary_plus_training') {
            return {
                score: Math.max(primaryScore, 0.55 * primaryScore + 0.45 * weightedTrainingScore),
                templateSource: bestTrainingScore >= primaryScore ? 'training' : 'primary',
            };
        }

        return {
            score: Math.max(0.2 * primaryScore + 0.8 * bestTrainingScore, weightedTrainingScore),
            templateSource: 'training_preferred',
        };
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
                const { score, templateSource } = this.getScoreForItem(cropData, itemId);

                allScores.push({ itemId, name: template.item.name, ncc, nccNorm, ssim, hist, score, templateSource });

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
                averageConfidence:
                    detections.length > 0
                        ? detections.reduce((sum, detection) => sum + detection.confidence, 0) / detections.length
                        : 0,
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

function summarizeConfusions(results) {
    const confusionMap = new Map();

    for (const result of results) {
        for (const detection of result.detections) {
            if (detection.correct) continue;
            const predicted = detection.item || detection.bestMatchedItem;
            if (!predicted) continue;
            if (predicted === detection.groundTruth) continue;

            const key = `${detection.groundTruth} -> ${predicted}`;
            confusionMap.set(key, (confusionMap.get(key) || 0) + 1);
        }
    }

    return Array.from(confusionMap.entries())
        .map(([pair, count]) => ({ pair, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
}

function shouldPromoteTrainingPreferred(modeRuns) {
    const baseline =
        modeRuns.find(run => run.config.templateMode === 'primary_plus_training') ||
        modeRuns.find(run => run.config.templateMode === 'primary_only');
    const candidate = modeRuns.find(run => run.config.templateMode === 'training_preferred');

    if (!baseline || !candidate) {
        return { promote: false, reason: 'Missing baseline or training_preferred results' };
    }

    const baselineFpRate = baseline.totalItems > 0 ? baseline.metrics.falsePositives / baseline.totalItems : 0;
    const candidateFpRate = candidate.totalItems > 0 ? candidate.metrics.falsePositives / candidate.totalItems : 0;
    const latencyRatio =
        baseline.timing.avgPerImageMs > 0 ? candidate.timing.avgPerImageMs / baseline.timing.avgPerImageMs : Infinity;
    const f1Gain = candidate.metrics.f1 - baseline.metrics.f1;
    const fpDelta = candidateFpRate - baselineFpRate;

    const promote = f1Gain >= 0.05 && fpDelta <= 0.02 && latencyRatio <= 1.35;

    return {
        promote,
        reason: promote
            ? 'training_preferred clears the F1, false-positive, and latency gates'
            : 'training_preferred did not clear the promotion thresholds',
        baselineMode: baseline.config.templateMode,
        f1Gain,
        fpDelta,
        latencyRatio,
    };
}

async function runBenchmarkMode(options, templateMode, imagesToRun) {
    const { quick, imagePath, verbose, diagnostic, minTrainingSamples } = options;

    console.log(`Template mode: ${templateMode}`);
    console.log('------------------------------');

    const engine = new SimpleCVEngine({
        templateMode,
        minTrainingSamples: minTrainingSamples || CONFIG.MIN_TRAINING_SAMPLES,
    });
    await engine.loadTemplates();

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
                console.log('    Top 5 matches:');
                for (const match of slot.topMatches) {
                    const marker = match.name === slot.groundTruth ? ' ← EXPECTED' : '';
                    console.log(
                        `      ${match.name}: ${(match.score * 100).toFixed(1)}% (SSIM=${(match.ssim * 100).toFixed(0)}%, Hist=${(match.hist * 100).toFixed(0)}%, NCC=${(match.nccNorm * 100).toFixed(0)}%) [${match.templateSource}]${marker}`
                    );
                }
            }
            console.log('');
        }
    }

    const totalTime = Date.now() - startTime;
    const totalItems = results.reduce((s, r) => s + r.itemCount, 0);
    const totalTruePositives = results.reduce((s, r) => s + r.metrics.truePositives, 0);
    const totalFalsePositives = results.reduce((s, r) => s + r.metrics.falsePositives, 0);
    const totalFalseNegatives = results.reduce((s, r) => s + r.metrics.falseNegatives, 0);
    const precision =
        totalTruePositives + totalFalsePositives > 0
            ? totalTruePositives / (totalTruePositives + totalFalsePositives)
            : 0;
    const recall =
        totalTruePositives + totalFalseNegatives > 0
            ? totalTruePositives / (totalTruePositives + totalFalseNegatives)
            : 0;
    const f1 = precision + recall > 0 ? (2 * (precision * recall)) / (precision + recall) : 0;
    const avgConfidence =
        results.length > 0
            ? results.reduce((sum, result) => sum + result.metrics.averageConfidence, 0) / results.length
            : 0;
    const confusionPairs = summarizeConfusions(results);

    console.log('');
    console.log(`Aggregate Results (${templateMode})`);
    console.log('-----------------');
    console.log(`Images:      ${results.length}`);
    console.log(`Total items: ${totalItems}`);
    console.log(`TP/FP/FN:    ${totalTruePositives}/${totalFalsePositives}/${totalFalseNegatives}`);
    console.log(`Precision:   ${(precision * 100).toFixed(1)}%`);
    console.log(`Recall:      ${(recall * 100).toFixed(1)}%`);
    console.log(`F1 Score:    ${(f1 * 100).toFixed(1)}%`);
    console.log(`Avg conf.:   ${(avgConfidence * 100).toFixed(1)}%`);
    console.log(`Mean latency:${results.length > 0 ? (totalTime / results.length).toFixed(1) : '0.0'}ms/image`);
    if (confusionPairs.length > 0) {
        console.log('Top confusions:');
        confusionPairs.forEach(entry => {
            console.log(`  ${entry.pair} (${entry.count})`);
        });
    }

    return {
        id: `run_${Date.now()}_${templateMode}`,
        groupId: `group_${Date.now()}`,
        timestamp: new Date().toISOString(),
        mode: quick ? 'quick' : imagePath ? 'single' : 'full',
        imageCount: results.length,
        totalItems,
        metrics: {
            accuracy: totalItems > 0 ? totalTruePositives / totalItems : 0,
            precision,
            recall,
            f1,
            avgF1:
                results.length > 0 ? results.reduce((sum, result) => sum + result.metrics.f1, 0) / results.length : 0,
            falsePositives: totalFalsePositives,
            falseNegatives: totalFalseNegatives,
            averageConfidence: avgConfidence,
        },
        timing: {
            totalMs: totalTime,
            avgPerImageMs: results.length > 0 ? totalTime / results.length : 0,
        },
        confusionPairs,
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
            templateMode,
            trainingTemplateItems: engine.trainingTemplates.size,
            minTrainingSamples: engine.minTrainingSamples,
        },
    };
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
    const templateModes = options.templateMode ? [options.templateMode] : CONFIG.DEFAULT_TEMPLATE_MODES;
    const history = loadBenchmarkHistory();
    const modeRuns = [];

    for (const templateMode of templateModes) {
        const runData = await runBenchmarkMode(options, templateMode, imagesToRun);
        modeRuns.push(runData);
        addBenchmarkRun(history, runData);
        console.log('');
    }

    if (modeRuns.length > 1) {
        console.log('Mode Comparison');
        console.log('---------------');
        console.log('Template mode          | F1     | Precision | Recall | Avg conf. | Mean latency');
        console.log('-----------------------|--------|-----------|--------|-----------|-------------');
        modeRuns.forEach(run => {
            console.log(
                `${run.config.templateMode.padEnd(22)} | ${`${(run.metrics.f1 * 100).toFixed(1)}%`.padStart(6)} | ${`${(run.metrics.precision * 100).toFixed(1)}%`.padStart(9)} | ${`${(run.metrics.recall * 100).toFixed(1)}%`.padStart(6)} | ${`${(run.metrics.averageConfidence * 100).toFixed(1)}%`.padStart(9)} | ${`${run.timing.avgPerImageMs.toFixed(1)}ms`.padStart(11)}`
            );
        });

        const promotion = shouldPromoteTrainingPreferred(modeRuns);
        console.log('');
        console.log('Promotion Gate');
        console.log('--------------');
        console.log(`${promotion.promote ? 'PROMOTE' : 'HOLD'}: ${promotion.reason}`);
        if (promotion.baselineMode) {
            console.log(`Baseline mode: ${promotion.baselineMode}`);
            console.log(`F1 gain: ${(promotion.f1Gain * 100).toFixed(2)}%`);
            console.log(`False-positive delta: ${(promotion.fpDelta * 100).toFixed(2)}%`);
            console.log(`Latency ratio: ${promotion.latencyRatio.toFixed(2)}x`);
        }
    }

    console.log(`Results saved to: ${CONFIG.BENCHMARK_HISTORY_PATH}`);
    return modeRuns;
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
    console.log('Date                 | Run    | Template mode          | Images | F1     | Precision | Recall | Time');
    console.log(
        '---------------------|--------|------------------------|--------|--------|-----------|--------|------'
    );

    for (const run of history.runs.slice(-20).reverse()) {
        const date = new Date(run.timestamp).toISOString().slice(0, 16).replace('T', ' ');
        const mode = run.mode.padEnd(6);
        const templateMode = (run.config?.templateMode || 'legacy').padEnd(22);
        const images = String(run.imageCount).padStart(6);
        const f1 = `${(run.metrics.f1 * 100).toFixed(1)}%`.padStart(6);
        const precision = `${(run.metrics.precision * 100).toFixed(1)}%`.padStart(9);
        const recall = `${(run.metrics.recall * 100).toFixed(1)}%`.padStart(6);
        const time = `${run.timing.totalMs}ms`.padStart(6);

        console.log(`${date} | ${mode} | ${templateMode} | ${images} | ${f1} | ${precision} | ${recall} | ${time}`);
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
    console.log(`Current mode:  ${current.config?.templateMode || 'legacy'}`);
    console.log(`Previous: ${previous.timestamp}`);
    console.log(`Previous mode: ${previous.config?.templateMode || 'legacy'}`);
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

        const modeIdx = args.indexOf('--mode');
        if (modeIdx !== -1 && args[modeIdx + 1]) {
            options.templateMode = args[modeIdx + 1];
        }

        const minTrainingIdx = args.indexOf('--min-training-samples');
        if (minTrainingIdx !== -1 && args[minTrainingIdx + 1]) {
            options.minTrainingSamples = Number(args[minTrainingIdx + 1]);
        }

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
