#!/usr/bin/env node
/**
 * Extract Ground Truth Crops Script
 *
 * Automatically extracts item icon crops from ground-truth labeled images.
 * These crops become the highest-quality training data (human-verified labels).
 *
 * Usage: node scripts/extract-ground-truth-crops.js [options]
 *
 * Options:
 *   --output-dir <path>  Output directory (default: ./data/training-data)
 *   --dry-run            Preview what would be extracted without writing
 *   --verbose            Show detailed progress
 */

const fs = require('fs');
const path = require('path');

// Canvas is optional - graceful fallback if not available
let createCanvas, loadImage;
try {
    const canvas = require('canvas');
    createCanvas = canvas.createCanvas;
    loadImage = canvas.loadImage;
} catch (e) {
    console.error('Warning: canvas module not available. Install with: npm install canvas');
    console.error('This script requires the canvas module to process images.');
    process.exit(1);
}

// ========================================
// Configuration
// ========================================

const CONFIG = {
    // Base resolution for calibration
    BASE_RESOLUTION: 720,

    // Default grid parameters (at 720p base)
    DEFAULT_CALIBRATION: {
        xOffset: 0,
        yOffset: 0,
        iconWidth: 40,
        iconHeight: 40,
        xSpacing: 4,
        ySpacing: 4,
        iconsPerRow: 22,
        numRows: 3,
    },

    // Resolution-specific calibration presets
    // These override defaults for specific resolutions
    CALIBRATION_PRESETS: {
        '1280x720': {
            xOffset: 0,
            yOffset: 92,
            iconWidth: 40,
            iconHeight: 40,
            xSpacing: 4,
            ySpacing: 4,
            iconsPerRow: 22,
            numRows: 3,
        },
        '1280x800': {
            xOffset: 0,
            yOffset: 102,
            iconWidth: 44,
            iconHeight: 44,
            xSpacing: 5,
            ySpacing: 5,
            iconsPerRow: 22,
            numRows: 3,
        },
        '1456x816': {
            xOffset: 0,
            yOffset: 105,
            iconWidth: 45,
            iconHeight: 45,
            xSpacing: 5,
            ySpacing: 5,
            iconsPerRow: 22,
            numRows: 3,
        },
        '1920x1080': {
            xOffset: 0,
            yOffset: 138,
            iconWidth: 60,
            iconHeight: 60,
            xSpacing: 6,
            ySpacing: 6,
            iconsPerRow: 22,
            numRows: 3,
        },
        '2560x1440': {
            xOffset: -3,
            yOffset: 184,
            iconWidth: 78,
            iconHeight: 80,
            xSpacing: 11,
            ySpacing: 4,
            iconsPerRow: 22,
            numRows: 3,
        },
    },

    // Paths
    GROUND_TRUTH_PATH: path.join(__dirname, '..', 'test-images', 'gameplay', 'ground-truth.json'),
    IMAGES_BASE_PATH: path.join(__dirname, '..', 'test-images', 'gameplay'),
    DEFAULT_OUTPUT_DIR: path.join(__dirname, '..', 'data', 'training-data'),

    // Crop quality settings
    MIN_CROP_SIZE: 20,
    MAX_CROPS_PER_ITEM_PER_RESOLUTION: 10,
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

function parseResolution(resStr) {
    if (!resStr) return null;
    const match = resStr.match(/(\d+)x(\d+)/);
    if (!match) return null;
    return { width: parseInt(match[1]), height: parseInt(match[2]) };
}

function getCalibrationForResolution(width, height) {
    const key = `${width}x${height}`;
    if (CONFIG.CALIBRATION_PRESETS[key]) {
        return { ...CONFIG.CALIBRATION_PRESETS[key] };
    }

    // Scale from base resolution
    const scale = height / CONFIG.BASE_RESOLUTION;
    return {
        xOffset: Math.round(CONFIG.DEFAULT_CALIBRATION.xOffset * scale),
        yOffset: Math.round(CONFIG.DEFAULT_CALIBRATION.yOffset * scale),
        iconWidth: Math.round(CONFIG.DEFAULT_CALIBRATION.iconWidth * scale),
        iconHeight: Math.round(CONFIG.DEFAULT_CALIBRATION.iconHeight * scale),
        xSpacing: Math.round(CONFIG.DEFAULT_CALIBRATION.xSpacing * scale),
        ySpacing: Math.round(CONFIG.DEFAULT_CALIBRATION.ySpacing * scale),
        iconsPerRow: CONFIG.DEFAULT_CALIBRATION.iconsPerRow,
        numRows: CONFIG.DEFAULT_CALIBRATION.numRows,
    };
}

function calculateGridPositions(imageWidth, imageHeight, calibration, itemCount) {
    const positions = [];
    const cellWidth = calibration.iconWidth + calibration.xSpacing;
    const cellHeight = calibration.iconHeight + calibration.ySpacing;

    // Calculate starting position (bottom of screen, centered horizontally)
    const totalGridWidth = calibration.iconsPerRow * cellWidth - calibration.xSpacing;
    const startX = Math.round((imageWidth - totalGridWidth) / 2) + calibration.xOffset;

    // Y position from bottom
    const totalGridHeight = calibration.numRows * cellHeight - calibration.ySpacing;
    const startY = imageHeight - totalGridHeight - calibration.yOffset;

    for (let i = 0; i < itemCount; i++) {
        const row = Math.floor(i / calibration.iconsPerRow);
        const col = i % calibration.iconsPerRow;

        if (row >= calibration.numRows) break;

        const x = startX + col * cellWidth;
        const y = startY + row * cellHeight;

        positions.push({
            index: i,
            x: Math.round(x),
            y: Math.round(y),
            width: calibration.iconWidth,
            height: calibration.iconHeight,
        });
    }

    return positions;
}

// ========================================
// Training Index Management
// ========================================

function loadOrCreateIndex(outputDir) {
    const indexPath = path.join(outputDir, 'index.json');
    if (fs.existsSync(indexPath)) {
        return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    }
    return {
        version: '2.0.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        schema_version: 2,
        total_samples: 0,
        sources: {
            ground_truth: {
                description: 'Extracted from ground-truth labeled test images',
                weight: 1.5,
                sample_count: 0,
            },
            validated_exports: {
                description: 'Human-corrected detections from validator tool',
                weight: 1.2,
                sample_count: 0,
            },
            verified: {
                description: 'Auto-detected items confirmed as correct',
                weight: 1.0,
                sample_count: 0,
            },
        },
        items: {},
        metadata: {
            extraction_runs: [],
        },
    };
}

function saveIndex(outputDir, index) {
    const indexPath = path.join(outputDir, 'index.json');
    index.updated_at = new Date().toISOString();
    index.total_samples = Object.values(index.items).reduce((sum, item) => sum + item.sample_count, 0);
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
}

// ========================================
// Crop Extraction
// ========================================

async function extractCropsFromImage(imagePath, groundTruthData, outputDir, index, options) {
    const { verbose, dryRun } = options;

    // Load image
    const fullImagePath = path.join(CONFIG.IMAGES_BASE_PATH, imagePath);
    if (!fs.existsSync(fullImagePath)) {
        console.error(`  Image not found: ${fullImagePath}`);
        return { added: 0, skipped: 0, errors: 1 };
    }

    const image = await loadImage(fullImagePath);
    const width = image.width;
    const height = image.height;

    if (verbose) {
        console.log(`  Image size: ${width}x${height}`);
    }

    // Get calibration for this resolution
    const calibration = getCalibrationForResolution(width, height);

    if (verbose) {
        console.log(
            `  Calibration: iconSize=${calibration.iconWidth}x${calibration.iconHeight}, yOffset=${calibration.yOffset}`
        );
    }

    // Get ground truth items
    const items = groundTruthData.items || [];
    if (items.length === 0) {
        console.log(`  No items in ground truth`);
        return { added: 0, skipped: 0, errors: 0 };
    }

    // Calculate grid positions
    const positions = calculateGridPositions(width, height, calibration, items.length);

    if (verbose) {
        console.log(`  Grid positions: ${positions.length} for ${items.length} items`);
    }

    // Create canvas for extraction
    const canvas = createCanvas(calibration.iconWidth, calibration.iconHeight);
    const ctx = canvas.getContext('2d');

    // Ensure crops directory exists
    const cropsDir = path.join(outputDir, 'crops');
    if (!dryRun) {
        fs.mkdirSync(cropsDir, { recursive: true });
    }

    let added = 0;
    let skipped = 0;
    const resolution = `${width}x${height}`;

    // Extract each item
    for (let i = 0; i < items.length && i < positions.length; i++) {
        const itemName = items[i];
        const itemId = nameToId(itemName);
        const position = positions[i];

        // Initialize item in index if needed
        if (!index.items[itemId]) {
            index.items[itemId] = {
                name: itemName,
                sample_count: 0,
                samples: [],
                resolutions: {},
            };
        }

        // Check resolution limit
        const resolutionKey = resolution;
        if (!index.items[itemId].resolutions[resolutionKey]) {
            index.items[itemId].resolutions[resolutionKey] = 0;
        }

        if (index.items[itemId].resolutions[resolutionKey] >= CONFIG.MAX_CROPS_PER_ITEM_PER_RESOLUTION) {
            if (verbose) {
                console.log(`    Skip ${itemName} (slot ${i}): max samples for ${resolutionKey}`);
            }
            skipped++;
            continue;
        }

        // Check for duplicates from same source image
        const existingSample = index.items[itemId].samples.find(
            s => s.source_image === imagePath && s.slot_index === i
        );
        if (existingSample) {
            if (verbose) {
                console.log(`    Skip ${itemName} (slot ${i}): already extracted`);
            }
            skipped++;
            continue;
        }

        // Validate position is within image bounds
        if (
            position.x < 0 ||
            position.y < 0 ||
            position.x + position.width > width ||
            position.y + position.height > height
        ) {
            if (verbose) {
                console.log(`    Skip ${itemName} (slot ${i}): position out of bounds`);
            }
            skipped++;
            continue;
        }

        if (dryRun) {
            console.log(`    Would extract: ${itemName} at (${position.x}, ${position.y})`);
            added++;
            continue;
        }

        // Extract crop
        ctx.clearRect(0, 0, calibration.iconWidth, calibration.iconHeight);
        ctx.drawImage(
            image,
            position.x,
            position.y,
            position.width,
            position.height,
            0,
            0,
            calibration.iconWidth,
            calibration.iconHeight
        );

        // Ensure item directory exists
        const itemDir = path.join(cropsDir, itemId);
        fs.mkdirSync(itemDir, { recursive: true });

        // Generate unique filename
        const sampleNum = String(index.items[itemId].sample_count + 1).padStart(3, '0');
        const sampleId = `${itemId}_gt_${sampleNum}`;
        const filename = `${sampleId}.png`;
        const filepath = path.join(itemDir, filename);

        // Save PNG
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(filepath, buffer);

        // Update index
        index.items[itemId].samples.push({
            id: sampleId,
            file: `crops/${itemId}/${filename}`,
            source: 'ground_truth',
            source_image: imagePath,
            source_resolution: resolution,
            slot_index: i,
            validation_type: 'ground_truth',
            confidence: 1.0,
            dimensions: { w: position.width, h: position.height },
            position: { x: position.x, y: position.y },
            added_at: new Date().toISOString(),
        });
        index.items[itemId].sample_count++;
        index.items[itemId].resolutions[resolutionKey]++;

        if (!index.sources.ground_truth) {
            index.sources.ground_truth = { sample_count: 0 };
        }
        index.sources.ground_truth.sample_count++;

        added++;

        if (verbose) {
            console.log(`    Extracted: ${itemName} -> ${filename}`);
        }
    }

    return { added, skipped, errors: 0 };
}

// ========================================
// Main
// ========================================

async function main() {
    // Parse arguments
    const args = process.argv.slice(2);
    const options = {
        outputDir: CONFIG.DEFAULT_OUTPUT_DIR,
        dryRun: args.includes('--dry-run'),
        verbose: args.includes('--verbose'),
    };

    const outputDirIdx = args.indexOf('--output-dir');
    if (outputDirIdx !== -1 && args[outputDirIdx + 1]) {
        options.outputDir = args[outputDirIdx + 1];
    }

    console.log('Ground Truth Crop Extraction');
    console.log('============================');
    console.log(`Output: ${options.outputDir}`);
    console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log('');

    // Load ground truth
    if (!fs.existsSync(CONFIG.GROUND_TRUTH_PATH)) {
        console.error(`Ground truth not found: ${CONFIG.GROUND_TRUTH_PATH}`);
        process.exit(1);
    }

    const groundTruth = JSON.parse(fs.readFileSync(CONFIG.GROUND_TRUTH_PATH, 'utf8'));

    // Filter to actual image entries (skip metadata keys starting with _)
    const imageEntries = Object.entries(groundTruth).filter(([key]) => !key.startsWith('_'));
    console.log(`Found ${imageEntries.length} ground truth images`);
    console.log('');

    // Create output directory
    if (!options.dryRun) {
        fs.mkdirSync(options.outputDir, { recursive: true });
    }

    // Load or create index
    const index = loadOrCreateIndex(options.outputDir);

    // Track stats
    let totalAdded = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    const processedImages = [];

    // Process each image
    for (const [imagePath, data] of imageEntries) {
        console.log(`Processing: ${imagePath}`);

        if (!data.items || data.items.length === 0) {
            console.log('  No items defined, skipping');
            continue;
        }

        console.log(`  Ground truth: ${data.items.length} items`);

        try {
            const result = await extractCropsFromImage(imagePath, data, options.outputDir, index, options);
            totalAdded += result.added;
            totalSkipped += result.skipped;
            totalErrors += result.errors;

            if (result.added > 0 || result.skipped > 0) {
                processedImages.push({
                    image: imagePath,
                    added: result.added,
                    skipped: result.skipped,
                });
            }

            console.log(`  Added: ${result.added}, Skipped: ${result.skipped}`);
        } catch (error) {
            console.error(`  Error: ${error.message}`);
            totalErrors++;
        }

        console.log('');
    }

    // Record extraction run
    if (!options.dryRun) {
        if (!index.metadata) index.metadata = {};
        if (!index.metadata.extraction_runs) index.metadata.extraction_runs = [];

        index.metadata.extraction_runs.push({
            timestamp: new Date().toISOString(),
            source: 'ground_truth',
            images_processed: processedImages.length,
            crops_added: totalAdded,
            crops_skipped: totalSkipped,
        });

        // Save updated index
        saveIndex(options.outputDir, index);
    }

    // Summary
    console.log('Summary');
    console.log('-------');
    console.log(`Images processed: ${processedImages.length}`);
    console.log(`Crops added:      ${totalAdded}`);
    console.log(`Crops skipped:    ${totalSkipped}`);
    console.log(`Errors:           ${totalErrors}`);
    console.log(`Total items:      ${Object.keys(index.items).length}`);
    console.log(`Total samples:    ${index.total_samples}`);

    if (!options.dryRun) {
        console.log('');
        console.log(`Index saved to: ${path.join(options.outputDir, 'index.json')}`);
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
