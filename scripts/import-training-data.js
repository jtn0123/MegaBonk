#!/usr/bin/env node
/**
 * Import Training Data Script
 *
 * Processes exported validation JSON files from CV Validator and extracts
 * crop images into a structured training data directory.
 *
 * Usage: node scripts/import-training-data.js [input-dir] [output-dir]
 *
 * Default:
 *   input-dir: ./validated-exports/
 *   output-dir: ./data/training-data/
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Default directories
const DEFAULT_INPUT_DIR = path.join(__dirname, '..', 'validated-exports');
const DEFAULT_OUTPUT_DIR = path.join(__dirname, '..', 'data', 'training-data');
const DOWNLOADS_DIR = path.join(os.homedir(), 'Downloads');
const TEST_IMAGES_DIR = path.join(__dirname, '..', 'test-images', 'gameplay');

// Configuration
const CONFIG = {
    // Minimum confidence for verified items to be included
    MIN_CONFIDENCE_VERIFIED: 0.5,
    // Always include corrected items (human-labeled)
    INCLUDE_ALL_CORRECTED: true,
    // Max samples per resolution per item
    MAX_SAMPLES_PER_RESOLUTION: 5,
    // Similarity threshold for deduplication (0-1, higher = more strict)
    SIMILARITY_THRESHOLD: 0.95,
};

// Generate a stable item ID from name
// Must match normalizeToItemId() in cv-validator/js/main.js
function nameToId(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '') // Remove special characters (apostrophes, etc)
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .replace(/_+/g, '_') // Collapse multiple underscores
        .replace(/^_|_$/g, ''); // Trim leading/trailing underscores
}

// Parse base64 data URL to buffer
function dataURLToBuffer(dataURL) {
    const matches = dataURL.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) return null;
    return Buffer.from(matches[2], 'base64');
}

// Simple pixel-based similarity check (very basic)
function calculateSimpleSimilarity(buffer1, buffer2) {
    if (buffer1.length !== buffer2.length) return 0;

    let matching = 0;
    for (let i = 0; i < buffer1.length; i++) {
        if (Math.abs(buffer1[i] - buffer2[i]) < 10) matching++;
    }
    return matching / buffer1.length;
}

// Load existing index or create new one
function loadOrCreateIndex(outputDir) {
    const indexPath = path.join(outputDir, 'index.json');
    if (fs.existsSync(indexPath)) {
        return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    }
    return {
        version: '1.0.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        total_samples: 0,
        items: {},
    };
}

// Save index
function saveIndex(outputDir, index) {
    const indexPath = path.join(outputDir, 'index.json');
    index.updated_at = new Date().toISOString();
    index.total_samples = Object.values(index.items).reduce((sum, item) => sum + item.sample_count, 0);
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
}

/**
 * Scan ~/Downloads for validated export files and copy them to validated-exports/
 * Also copies the corresponding source images from test-images/gameplay/
 */
function collectAndCopyFromDownloads(targetDir) {
    console.log('');
    console.log('Checking ~/Downloads for validated exports...');

    // Ensure Downloads directory exists
    if (!fs.existsSync(DOWNLOADS_DIR)) {
        console.log('  Downloads directory not found');
        return { copied: 0, skipped: 0 };
    }

    // Find validated_*.json files in Downloads
    const allFiles = fs.readdirSync(DOWNLOADS_DIR);
    const validatedFiles = allFiles.filter(f => /^validated_.*\.json$/.test(f));

    if (validatedFiles.length === 0) {
        console.log('  No validated_*.json files found in Downloads');
        return { copied: 0, skipped: 0 };
    }

    console.log(`Found ${validatedFiles.length} file(s) in Downloads:`);
    validatedFiles.forEach(f => console.log(`  - ${f}`));
    console.log('');
    console.log('Copying to validated-exports/...');

    // Ensure target directory exists
    fs.mkdirSync(targetDir, { recursive: true });

    let copied = 0;
    let skipped = 0;

    for (const filename of validatedFiles) {
        const sourcePath = path.join(DOWNLOADS_DIR, filename);
        const targetPath = path.join(targetDir, filename);

        try {
            // Read the JSON to get source image info
            const jsonContent = fs.readFileSync(sourcePath, 'utf8');
            const data = JSON.parse(jsonContent);

            // Check if JSON already exists in target
            if (fs.existsSync(targetPath)) {
                const existingContent = fs.readFileSync(targetPath, 'utf8');
                if (existingContent === jsonContent) {
                    console.log(`  ⏭ Skipped (identical): ${filename}`);
                    skipped++;
                    continue;
                } else {
                    console.log(`  ⚠ Skipped (different file exists): ${filename}`);
                    skipped++;
                    continue;
                }
            }

            // Copy JSON file
            fs.copyFileSync(sourcePath, targetPath);
            console.log(`  ✓ Copied: ${filename}`);
            copied++;

            // Try to copy source image
            if (data.image) {
                const sourceImagePath = path.join(TEST_IMAGES_DIR, data.image);
                // Generate image filename matching the JSON (replace .json with the source extension)
                const imageBasename = filename.replace('.json', '');
                const sourceExt = path.extname(data.image) || '.jpg';
                const targetImageFilename = imageBasename + sourceExt;
                const targetImagePath = path.join(targetDir, targetImageFilename);

                if (fs.existsSync(sourceImagePath)) {
                    if (!fs.existsSync(targetImagePath)) {
                        fs.copyFileSync(sourceImagePath, targetImagePath);
                        console.log(`  ✓ Copied image: ${data.image} → ${targetImageFilename}`);
                    } else {
                        console.log(`  ⏭ Image already exists: ${targetImageFilename}`);
                    }
                } else {
                    console.log(`  ⚠ Source image not found: ${data.image}`);
                }
            }
        } catch (error) {
            console.log(`  ✗ Error processing ${filename}: ${error.message}`);
        }
    }

    console.log('');
    return { copied, skipped };
}

// Main import function
async function importTrainingData(inputDir, outputDir) {
    console.log('CV Training Data Import');
    console.log('=======================');
    console.log(`Input:  ${inputDir}`);
    console.log(`Output: ${outputDir}`);

    // First, collect any validated exports from Downloads folder
    const downloadResults = collectAndCopyFromDownloads(inputDir);
    if (downloadResults.copied > 0) {
        console.log(`Copied ${downloadResults.copied} file(s) from Downloads to validated-exports/`);
    }

    // Ensure directories exist
    if (!fs.existsSync(inputDir)) {
        console.log(`Creating input directory: ${inputDir}`);
        fs.mkdirSync(inputDir, { recursive: true });
        console.log('Place validated export JSON files in this directory and run again.');
        return;
    }

    fs.mkdirSync(outputDir, { recursive: true });
    const cropsDir = path.join(outputDir, 'crops');
    fs.mkdirSync(cropsDir, { recursive: true });

    // Load or create index
    const index = loadOrCreateIndex(outputDir);

    // Find all JSON files in input directory
    const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.json'));
    console.log(`Found ${files.length} JSON file(s) to process`);
    console.log('');

    let totalCropsAdded = 0;
    let totalCropsSkipped = 0;

    for (const file of files) {
        const filePath = path.join(inputDir, file);
        console.log(`Processing: ${file}`);

        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

            // Check if this has training crops
            if (!data.training_crops || Object.keys(data.training_crops).length === 0) {
                console.log('  No training crops found, skipping');
                continue;
            }

            const cropsInFile = Object.entries(data.training_crops);
            console.log(`  Found ${cropsInFile.length} training crop(s)`);

            for (const [slotIndex, cropData] of cropsInFile) {
                const itemName = cropData.item_name;
                const itemId = nameToId(itemName);

                // Quality filtering
                if (cropData.validation_type === 'verified') {
                    if (cropData.confidence_original < CONFIG.MIN_CONFIDENCE_VERIFIED) {
                        console.log(`  Skipping ${itemName} (slot ${slotIndex}): confidence too low`);
                        totalCropsSkipped++;
                        continue;
                    }
                }

                // Skip unknown items for now (could be wrong)
                if (cropData.is_unknown) {
                    console.log(`  Skipping ${itemName} (slot ${slotIndex}): unknown item`);
                    totalCropsSkipped++;
                    continue;
                }

                // Ensure item directory exists
                const itemDir = path.join(cropsDir, itemId);
                fs.mkdirSync(itemDir, { recursive: true });

                // Initialize item in index if needed
                if (!index.items[itemId]) {
                    index.items[itemId] = {
                        name: itemName,
                        sample_count: 0,
                        samples: [],
                    };
                }

                // Check resolution limit
                const resolution = cropData.source_resolution || 'unknown';
                const samplesAtResolution = index.items[itemId].samples.filter(
                    s => s.source_resolution === resolution
                ).length;

                if (samplesAtResolution >= CONFIG.MAX_SAMPLES_PER_RESOLUTION) {
                    console.log(`  Skipping ${itemName} (slot ${slotIndex}): max samples for ${resolution}`);
                    totalCropsSkipped++;
                    continue;
                }

                // Extract buffer from data URL
                const buffer = dataURLToBuffer(cropData.crop_base64);
                if (!buffer) {
                    console.log(`  Skipping ${itemName} (slot ${slotIndex}): invalid data URL`);
                    totalCropsSkipped++;
                    continue;
                }

                // TODO: Deduplication by image similarity
                // For now, just check if identical file exists
                const existingFiles = fs.readdirSync(itemDir);
                let isDuplicate = false;

                for (const existingFile of existingFiles) {
                    const existingPath = path.join(itemDir, existingFile);
                    const existingBuffer = fs.readFileSync(existingPath);
                    if (buffer.equals(existingBuffer)) {
                        isDuplicate = true;
                        break;
                    }
                }

                if (isDuplicate) {
                    console.log(`  Skipping ${itemName} (slot ${slotIndex}): duplicate`);
                    totalCropsSkipped++;
                    continue;
                }

                // Generate unique filename
                const sampleId = `${itemId}_${String(index.items[itemId].sample_count + 1).padStart(3, '0')}`;
                const filename = `${sampleId}.png`;
                const filepath = path.join(itemDir, filename);

                // Write PNG file
                fs.writeFileSync(filepath, buffer);

                // Add to index
                index.items[itemId].samples.push({
                    id: sampleId,
                    file: `crops/${itemId}/${filename}`,
                    source_resolution: resolution,
                    source_image: cropData.source_image,
                    validation_type: cropData.validation_type,
                    original_confidence: cropData.confidence_original,
                    dimensions: cropData.crop_dimensions,
                    added_at: new Date().toISOString(),
                });
                index.items[itemId].sample_count++;
                totalCropsAdded++;

                console.log(`  Added: ${itemName} -> ${filename}`);
            }
        } catch (error) {
            console.error(`  Error processing ${file}: ${error.message}`);
        }
    }

    // Save updated index
    saveIndex(outputDir, index);

    console.log('');
    console.log('Summary');
    console.log('-------');
    console.log(`Crops added:   ${totalCropsAdded}`);
    console.log(`Crops skipped: ${totalCropsSkipped}`);
    console.log(`Total items:   ${Object.keys(index.items).length}`);
    console.log(`Total samples: ${index.total_samples}`);
    console.log('');
    console.log(`Index saved to: ${path.join(outputDir, 'index.json')}`);
}

// Parse command line arguments
const args = process.argv.slice(2);
const inputDir = args[0] || DEFAULT_INPUT_DIR;
const outputDir = args[1] || DEFAULT_OUTPUT_DIR;

// Run
importTrainingData(inputDir, outputDir).catch(console.error);
