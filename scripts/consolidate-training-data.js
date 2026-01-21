#!/usr/bin/env node
/**
 * Consolidate Training Data Script
 *
 * Merges training data from multiple sources into a unified index:
 * 1. Ground truth crops (from extract-ground-truth-crops.js)
 * 2. Validated exports (from CV validator corrections)
 * 3. Existing training data
 *
 * Usage: node scripts/consolidate-training-data.js [options]
 *
 * Options:
 *   --output-dir <path>      Output directory (default: ./data/training-data)
 *   --validated-dir <path>   Validated exports dir (default: ./validated-exports)
 *   --dry-run                Preview without writing
 *   --verbose                Show detailed progress
 *   --rebuild                Rebuild index from scratch (re-scan all crops)
 */

const fs = require('fs');
const path = require('path');

// ========================================
// Configuration
// ========================================

const CONFIG = {
    DEFAULT_OUTPUT_DIR: path.join(__dirname, '..', 'data', 'training-data'),
    DEFAULT_VALIDATED_DIR: path.join(__dirname, '..', 'validated-exports'),

    // Source weights for quality scoring
    SOURCE_WEIGHTS: {
        ground_truth: 1.5,      // Human-labeled from ground truth images
        corrected: 1.3,         // Human-corrected in validator
        corrected_from_empty: 1.2, // Filled in empty slot
        verified: 1.0,          // Confirmed correct detection
        unreviewed: 0.8,        // Auto-detected but not reviewed
    },

    // Quality thresholds
    MIN_CONFIDENCE_VERIFIED: 0.5,
    MAX_SAMPLES_PER_ITEM_PER_RESOLUTION: 10,

    // Deduplication
    SIMILARITY_THRESHOLD: 0.95,
};

// ========================================
// Utility Functions
// ========================================

function nameToId(name) {
    if (!name) return null;
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
}

function dataURLToBuffer(dataURL) {
    if (!dataURL) return null;
    const matches = dataURL.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) return null;
    return Buffer.from(matches[2], 'base64');
}

// Simple buffer comparison for deduplication
function buffersAreSimilar(buf1, buf2) {
    if (!buf1 || !buf2) return false;
    if (buf1.length !== buf2.length) return false;
    if (buf1.equals(buf2)) return true;

    // Quick similarity check - count matching bytes
    let matching = 0;
    const sampleSize = Math.min(buf1.length, 1000);
    const step = Math.max(1, Math.floor(buf1.length / sampleSize));

    for (let i = 0; i < buf1.length; i += step) {
        if (Math.abs(buf1[i] - buf2[i]) < 10) matching++;
    }

    return (matching / (buf1.length / step)) > CONFIG.SIMILARITY_THRESHOLD;
}

// ========================================
// Index Management
// ========================================

function createEmptyIndex() {
    return {
        version: '2.0.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        schema_version: 2,
        total_samples: 0,
        sources: {
            ground_truth: {
                description: 'Extracted from ground-truth labeled test images',
                weight: CONFIG.SOURCE_WEIGHTS.ground_truth,
                sample_count: 0,
            },
            corrected: {
                description: 'Human-corrected detections from validator tool',
                weight: CONFIG.SOURCE_WEIGHTS.corrected,
                sample_count: 0,
            },
            verified: {
                description: 'Auto-detected items confirmed as correct',
                weight: CONFIG.SOURCE_WEIGHTS.verified,
                sample_count: 0,
            },
        },
        items: {},
        metadata: {
            consolidation_runs: [],
            source_files: [],
        },
    };
}

function loadIndex(outputDir) {
    const indexPath = path.join(outputDir, 'index.json');
    if (fs.existsSync(indexPath)) {
        return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    }
    return createEmptyIndex();
}

function saveIndex(outputDir, index) {
    const indexPath = path.join(outputDir, 'index.json');
    index.updated_at = new Date().toISOString();

    // Recalculate totals
    index.total_samples = 0;
    for (const sourceKey of Object.keys(index.sources)) {
        index.sources[sourceKey].sample_count = 0;
    }

    for (const item of Object.values(index.items)) {
        index.total_samples += item.sample_count;
        for (const sample of item.samples) {
            const source = sample.source || sample.validation_type || 'unreviewed';
            if (index.sources[source]) {
                index.sources[source].sample_count++;
            }
        }
    }

    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
}

// ========================================
// Import from Validated Exports
// ========================================

function processValidatedExport(filePath, outputDir, index, options) {
    const { verbose, dryRun } = options;
    const filename = path.basename(filePath);

    if (verbose) {
        console.log(`  Reading: ${filename}`);
    }

    let data;
    try {
        data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        console.error(`  Error reading ${filename}: ${e.message}`);
        return { added: 0, skipped: 0, errors: 1 };
    }

    if (!data.training_crops || Object.keys(data.training_crops).length === 0) {
        if (verbose) {
            console.log(`  No training crops in ${filename}`);
        }
        return { added: 0, skipped: 0, errors: 0 };
    }

    // Track this source file
    if (!index.metadata.source_files.includes(filename)) {
        index.metadata.source_files.push(filename);
    }

    const cropsDir = path.join(outputDir, 'crops');
    if (!dryRun) {
        fs.mkdirSync(cropsDir, { recursive: true });
    }

    let added = 0;
    let skipped = 0;

    for (const [slotIndex, cropData] of Object.entries(data.training_crops)) {
        const itemName = cropData.item_name;
        const itemId = nameToId(itemName);

        if (!itemId) {
            skipped++;
            continue;
        }

        // Quality filtering
        const validationType = cropData.validation_type || 'unreviewed';

        if (validationType === 'verified' && cropData.confidence_original < CONFIG.MIN_CONFIDENCE_VERIFIED) {
            if (verbose) {
                console.log(`    Skip ${itemName}: low confidence verified (${cropData.confidence_original})`);
            }
            skipped++;
            continue;
        }

        if (cropData.is_unknown) {
            if (verbose) {
                console.log(`    Skip ${itemName}: marked as unknown`);
            }
            skipped++;
            continue;
        }

        // Initialize item in index
        if (!index.items[itemId]) {
            index.items[itemId] = {
                name: itemName,
                sample_count: 0,
                samples: [],
                resolutions: {},
            };
        }

        const resolution = cropData.source_resolution || 'unknown';

        // Check resolution limit
        if (!index.items[itemId].resolutions[resolution]) {
            index.items[itemId].resolutions[resolution] = 0;
        }

        if (index.items[itemId].resolutions[resolution] >= CONFIG.MAX_SAMPLES_PER_ITEM_PER_RESOLUTION) {
            if (verbose) {
                console.log(`    Skip ${itemName}: max samples for ${resolution}`);
            }
            skipped++;
            continue;
        }

        // Check for duplicate from same source
        const sourceImage = cropData.source_image || data.image;
        const existingSample = index.items[itemId].samples.find(
            s => s.source_image === sourceImage && s.slot_index === parseInt(slotIndex)
        );

        if (existingSample) {
            if (verbose) {
                console.log(`    Skip ${itemName}: already imported from ${sourceImage}`);
            }
            skipped++;
            continue;
        }

        // Extract buffer from base64
        const buffer = dataURLToBuffer(cropData.crop_base64);
        if (!buffer) {
            if (verbose) {
                console.log(`    Skip ${itemName}: invalid crop data`);
            }
            skipped++;
            continue;
        }

        if (dryRun) {
            console.log(`    Would import: ${itemName} from ${sourceImage}`);
            added++;
            continue;
        }

        // Ensure item directory exists
        const itemDir = path.join(cropsDir, itemId);
        fs.mkdirSync(itemDir, { recursive: true });

        // Check for duplicate by content
        const existingFiles = fs.existsSync(itemDir) ? fs.readdirSync(itemDir) : [];
        let isDuplicate = false;

        for (const existingFile of existingFiles) {
            const existingPath = path.join(itemDir, existingFile);
            const existingBuffer = fs.readFileSync(existingPath);
            if (buffersAreSimilar(buffer, existingBuffer)) {
                isDuplicate = true;
                break;
            }
        }

        if (isDuplicate) {
            if (verbose) {
                console.log(`    Skip ${itemName}: duplicate content`);
            }
            skipped++;
            continue;
        }

        // Generate filename
        const sampleNum = String(index.items[itemId].sample_count + 1).padStart(3, '0');
        const sourcePrefix = validationType === 'corrected' ? 'cor' : validationType === 'verified' ? 'ver' : 'exp';
        const sampleId = `${itemId}_${sourcePrefix}_${sampleNum}`;
        const cropFilename = `${sampleId}.png`;
        const filepath = path.join(itemDir, cropFilename);

        // Write file
        fs.writeFileSync(filepath, buffer);

        // Add to index
        index.items[itemId].samples.push({
            id: sampleId,
            file: `crops/${itemId}/${cropFilename}`,
            source: validationType,
            source_image: sourceImage,
            source_resolution: resolution,
            slot_index: parseInt(slotIndex),
            validation_type: validationType,
            confidence: cropData.confidence_original || 0,
            dimensions: cropData.crop_dimensions,
            added_at: new Date().toISOString(),
            import_source: filename,
        });

        index.items[itemId].sample_count++;
        index.items[itemId].resolutions[resolution]++;
        added++;

        if (verbose) {
            console.log(`    Imported: ${itemName} -> ${cropFilename}`);
        }
    }

    return { added, skipped, errors: 0 };
}

// ========================================
// Rebuild Index from Existing Crops
// ========================================

function rebuildIndexFromCrops(outputDir, options) {
    const { verbose } = options;
    const cropsDir = path.join(outputDir, 'crops');

    if (!fs.existsSync(cropsDir)) {
        console.log('No crops directory found, nothing to rebuild');
        return createEmptyIndex();
    }

    console.log('Rebuilding index from existing crops...');
    const index = createEmptyIndex();

    const itemDirs = fs.readdirSync(cropsDir).filter(f =>
        fs.statSync(path.join(cropsDir, f)).isDirectory()
    );

    for (const itemId of itemDirs) {
        const itemDir = path.join(cropsDir, itemId);
        const files = fs.readdirSync(itemDir).filter(f => f.endsWith('.png'));

        if (files.length === 0) continue;

        // Infer item name from ID (capitalize words)
        const itemName = itemId
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

        index.items[itemId] = {
            name: itemName,
            sample_count: files.length,
            samples: [],
            resolutions: {},
        };

        for (const file of files) {
            // Parse info from filename if possible
            // Format: itemid_source_num.png (e.g., wrench_gt_001.png)
            const match = file.match(/^(.+?)_(gt|cor|ver|exp)_(\d+)\.png$/);
            const source = match ? {
                gt: 'ground_truth',
                cor: 'corrected',
                ver: 'verified',
                exp: 'validated_export',
            }[match[2]] : 'unknown';

            index.items[itemId].samples.push({
                id: file.replace('.png', ''),
                file: `crops/${itemId}/${file}`,
                source: source,
                added_at: new Date().toISOString(),
            });
        }

        if (verbose) {
            console.log(`  ${itemId}: ${files.length} samples`);
        }
    }

    return index;
}

// ========================================
// Calculate Quality Scores
// ========================================

function calculateQualityScores(index) {
    for (const item of Object.values(index.items)) {
        for (const sample of item.samples) {
            const sourceWeight = CONFIG.SOURCE_WEIGHTS[sample.source] || 0.8;
            const confidenceBonus = sample.confidence ? sample.confidence * 0.2 : 0;

            sample.quality_score = Math.min(1.0, sourceWeight * 0.7 + confidenceBonus + 0.1);
        }

        // Sort samples by quality score
        item.samples.sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0));
    }
}

// ========================================
// Generate Statistics Report
// ========================================

function generateStatistics(index) {
    const stats = {
        total_items: Object.keys(index.items).length,
        total_samples: index.total_samples,
        by_source: {},
        by_resolution: {},
        items_with_samples: 0,
        items_without_samples: 0,
        avg_samples_per_item: 0,
        coverage: {
            single_sample: 0,
            low: 0,      // 2-3 samples
            medium: 0,   // 4-6 samples
            high: 0,     // 7+ samples
        },
    };

    for (const item of Object.values(index.items)) {
        if (item.sample_count > 0) {
            stats.items_with_samples++;

            if (item.sample_count === 1) stats.coverage.single_sample++;
            else if (item.sample_count <= 3) stats.coverage.low++;
            else if (item.sample_count <= 6) stats.coverage.medium++;
            else stats.coverage.high++;
        } else {
            stats.items_without_samples++;
        }

        for (const sample of item.samples) {
            const source = sample.source || 'unknown';
            stats.by_source[source] = (stats.by_source[source] || 0) + 1;

            const resolution = sample.source_resolution || 'unknown';
            stats.by_resolution[resolution] = (stats.by_resolution[resolution] || 0) + 1;
        }
    }

    stats.avg_samples_per_item = stats.items_with_samples > 0
        ? (stats.total_samples / stats.items_with_samples).toFixed(2)
        : 0;

    return stats;
}

// ========================================
// Main
// ========================================

async function main() {
    const args = process.argv.slice(2);
    const options = {
        outputDir: CONFIG.DEFAULT_OUTPUT_DIR,
        validatedDir: CONFIG.DEFAULT_VALIDATED_DIR,
        dryRun: args.includes('--dry-run'),
        verbose: args.includes('--verbose'),
        rebuild: args.includes('--rebuild'),
    };

    // Parse directory arguments
    const outputIdx = args.indexOf('--output-dir');
    if (outputIdx !== -1 && args[outputIdx + 1]) {
        options.outputDir = args[outputIdx + 1];
    }

    const validatedIdx = args.indexOf('--validated-dir');
    if (validatedIdx !== -1 && args[validatedIdx + 1]) {
        options.validatedDir = args[validatedIdx + 1];
    }

    console.log('Training Data Consolidation');
    console.log('===========================');
    console.log(`Output:     ${options.outputDir}`);
    console.log(`Validated:  ${options.validatedDir}`);
    console.log(`Mode:       ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log(`Rebuild:    ${options.rebuild ? 'YES' : 'NO'}`);
    console.log('');

    // Create output directory
    if (!options.dryRun) {
        fs.mkdirSync(options.outputDir, { recursive: true });
    }

    // Load or rebuild index
    let index;
    if (options.rebuild) {
        index = rebuildIndexFromCrops(options.outputDir, options);
    } else {
        index = loadIndex(options.outputDir);
    }

    // Process validated exports
    console.log('Importing validated exports...');
    let totalAdded = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    if (fs.existsSync(options.validatedDir)) {
        const files = fs.readdirSync(options.validatedDir).filter(f => f.endsWith('.json'));
        console.log(`Found ${files.length} validated export file(s)`);
        console.log('');

        for (const file of files) {
            console.log(`Processing: ${file}`);
            const result = processValidatedExport(
                path.join(options.validatedDir, file),
                options.outputDir,
                index,
                options
            );

            totalAdded += result.added;
            totalSkipped += result.skipped;
            totalErrors += result.errors;

            console.log(`  Added: ${result.added}, Skipped: ${result.skipped}`);
        }
    } else {
        console.log('Validated exports directory not found');
    }

    console.log('');

    // Calculate quality scores
    console.log('Calculating quality scores...');
    calculateQualityScores(index);

    // Record consolidation run
    if (!options.dryRun) {
        if (!index.metadata) index.metadata = {};
        if (!index.metadata.consolidation_runs) index.metadata.consolidation_runs = [];

        index.metadata.consolidation_runs.push({
            timestamp: new Date().toISOString(),
            samples_added: totalAdded,
            samples_skipped: totalSkipped,
            errors: totalErrors,
            rebuild: options.rebuild,
        });

        // Save index
        saveIndex(options.outputDir, index);
    }

    // Generate and display statistics
    const stats = generateStatistics(index);

    console.log('');
    console.log('Summary');
    console.log('-------');
    console.log(`Samples added:   ${totalAdded}`);
    console.log(`Samples skipped: ${totalSkipped}`);
    console.log(`Errors:          ${totalErrors}`);
    console.log('');
    console.log('Dataset Statistics');
    console.log('------------------');
    console.log(`Total items:     ${stats.total_items}`);
    console.log(`Total samples:   ${stats.total_samples}`);
    console.log(`Avg per item:    ${stats.avg_samples_per_item}`);
    console.log('');
    console.log('Coverage:');
    console.log(`  Single sample: ${stats.coverage.single_sample} items`);
    console.log(`  Low (2-3):     ${stats.coverage.low} items`);
    console.log(`  Medium (4-6):  ${stats.coverage.medium} items`);
    console.log(`  High (7+):     ${stats.coverage.high} items`);
    console.log('');
    console.log('By source:');
    for (const [source, count] of Object.entries(stats.by_source)) {
        console.log(`  ${source}: ${count}`);
    }

    if (!options.dryRun) {
        console.log('');
        console.log(`Index saved to: ${path.join(options.outputDir, 'index.json')}`);
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
