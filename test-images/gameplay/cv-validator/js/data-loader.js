/* global Image */
/* ========================================
 * CV Validator - Data Loader
 * Ground truth, items, templates, training data loading
 * ======================================== */

import { CONFIG } from './config.js';
import { state } from './state.js';
import { log, LOG_LEVELS } from './utils.js';

// Training data loading state
let trainingDataLoaded = false;
let sharedLibrary = null;

// ========================================
// Ground Truth Loading
// ========================================

export async function loadGroundTruth() {
    try {
        const response = await fetch(CONFIG.PATHS.groundTruth);
        state.groundTruth = await response.json();
        const imageCount = Object.keys(state.groundTruth).filter(k => !k.startsWith('_')).length;
        log(`Loaded ground truth with ${imageCount} test images`, LOG_LEVELS.SUCCESS);
        return state.groundTruth;
    } catch (error) {
        log(`Failed to load ground-truth.json: ${error.message}`, LOG_LEVELS.ERROR);
        return null;
    }
}

// ========================================
// Items Data Loading
// ========================================

export async function loadItemsData() {
    try {
        const response = await fetch(CONFIG.PATHS.itemsData);
        state.itemsData = await response.json();

        // Build lookup maps
        state.itemLookup.clear();
        state.itemIdLookup.clear();

        for (const item of state.itemsData.items) {
            state.itemLookup.set(item.name.toLowerCase(), item);
            state.itemIdLookup.set(item.id, item);
        }

        log(`Loaded ${state.itemsData.items.length} items from items.json`, LOG_LEVELS.SUCCESS);
        return state.itemsData;
    } catch (error) {
        log(`Failed to load items.json: ${error.message}`, LOG_LEVELS.ERROR);
        return null;
    }
}

// ========================================
// Template Loading
// ========================================

export async function loadTemplate(item) {
    if (state.templateCache.has(item.id)) {
        return state.templateCache.get(item.id);
    }

    return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, img.width, img.height);
            state.templateCache.set(item.id, {
                imageData,
                width: img.width,
                height: img.height,
                canvas,
                ctx,
            });
            resolve(state.templateCache.get(item.id));
        };

        img.onerror = () => {
            resolve(null);
        };

        // Use relative path from test-images/gameplay to src/images
        const imagePath = CONFIG.PATHS.imagesBase + item.image;
        img.src = imagePath;
    });
}

export async function loadAllTemplates() {
    if (!state.itemsData) return;

    log('Loading item templates...');

    // Load templates in parallel for faster startup
    const itemsWithImages = state.itemsData.items.filter(item => item.image);
    await Promise.all(itemsWithImages.map(item => loadTemplate(item)));

    log(`Loaded ${itemsWithImages.length} item templates`, LOG_LEVELS.SUCCESS);
}

// ========================================
// Image Loading
// ========================================

export async function loadImage(imagePath) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve({ img, canvas, ctx, width: img.width, height: img.height });
        };

        img.onerror = () => reject(new Error(`Failed to load: ${imagePath}`));
        img.src = imagePath;
    });
}

// ========================================
// Populate Image Select
// ========================================

export function populateImageSelect(selectElement) {
    selectElement.innerHTML = '<option value="">-- Select a test image --</option>';

    for (const [imagePath, data] of Object.entries(state.groundTruth)) {
        if (imagePath.startsWith('_')) continue; // Skip metadata

        const itemCount = data.items?.length || 0;
        const option = document.createElement('option');
        option.value = imagePath;
        option.textContent = `${imagePath} (${itemCount} items)`;
        selectElement.appendChild(option);
    }
}

// ========================================
// Item Lookup Helpers
// ========================================

export function getItemByName(name) {
    return state.itemLookup.get(name.toLowerCase());
}

export function getItemById(id) {
    return state.itemIdLookup.get(id);
}

export function getAllItems() {
    return state.itemsData?.items || [];
}

export function getGroundTruthForImage(imagePath) {
    return state.groundTruth[imagePath];
}

// ========================================
// Training Data Loading
// ========================================

/**
 * Load training data from the shared CV library
 * Sets the base path for the CV Validator's relative location
 */
export async function loadTrainingDataIfAvailable() {
    if (trainingDataLoaded) {
        log('Training data already loaded', LOG_LEVELS.INFO);
        return true;
    }

    try {
        // Try to import the shared CV library
        sharedLibrary = await import('../../../../dist/cv-library/cv-library.js');

        // Set the base path relative to cv-validator directory
        // The training data is at data/training-data/ from project root
        // From cv-validator, that's ../../../../data/training-data/
        sharedLibrary.setTrainingDataBasePath('../../../../data/training-data/');

        // Load the training data
        const success = await sharedLibrary.loadTrainingData();

        if (success) {
            trainingDataLoaded = true;
            const stats = sharedLibrary.getTrainingStats();
            log(
                `Training data loaded: ${stats.totalItems} items, ${stats.totalTemplates} templates`,
                LOG_LEVELS.SUCCESS
            );

            // Log top items with most samples
            if (stats.itemsWithMostSamples.length > 0) {
                const topItems = stats.itemsWithMostSamples
                    .slice(0, 3)
                    .map(i => `${i.id}(${i.count})`)
                    .join(', ');
                log(`  Top trained items: ${topItems}`, LOG_LEVELS.INFO);
            }
            return true;
        } else {
            log('Training data index not found (this is normal for new setups)', LOG_LEVELS.INFO);
            return false;
        }
    } catch (err) {
        // This is expected if the library hasn't been built yet
        log(`Training data not available: ${err.message}`, LOG_LEVELS.INFO);
        log('  Run "npm run build:cv-library" to enable enhanced detection', LOG_LEVELS.INFO);
        return false;
    }
}

/**
 * Check if training data is loaded
 */
export function isTrainingDataLoaded() {
    return trainingDataLoaded && sharedLibrary?.isTrainingDataLoaded?.();
}

/**
 * Get training data statistics
 */
export function getTrainingStats() {
    if (!sharedLibrary?.getTrainingStats) {
        return null;
    }
    return sharedLibrary.getTrainingStats();
}

// ========================================
// Training Source Management
// ========================================

/**
 * Get available training data sources
 */
export function getAvailableSources() {
    if (!sharedLibrary?.getAvailableSources) {
        return [];
    }
    return sharedLibrary.getAvailableSources();
}

/**
 * Get currently enabled sources
 */
export function getEnabledSources() {
    if (!sharedLibrary?.getEnabledSources) {
        return [];
    }
    return sharedLibrary.getEnabledSources();
}

/**
 * Enable a specific source
 */
export function enableSource(source) {
    if (sharedLibrary?.enableSource) {
        sharedLibrary.enableSource(source);
    }
}

/**
 * Disable a specific source
 */
export function disableSource(source) {
    if (sharedLibrary?.disableSource) {
        sharedLibrary.disableSource(source);
    }
}

/**
 * Set which sources are enabled
 */
export function setEnabledSources(sources) {
    if (sharedLibrary?.setEnabledSources) {
        sharedLibrary.setEnabledSources(sources);
    }
}

/**
 * Enable all sources
 */
export function enableAllSources() {
    if (sharedLibrary?.enableAllSources) {
        sharedLibrary.enableAllSources();
    }
}

/**
 * Get source sample counts (for UI display)
 */
export function getSourceSampleCounts() {
    if (!sharedLibrary?.getTrainingIndex) {
        return new Map();
    }

    const index = sharedLibrary.getTrainingIndex();
    if (!index) return new Map();

    const counts = new Map();

    for (const itemData of Object.values(index.items)) {
        for (const sample of itemData.samples) {
            const source = sample.source_image;
            counts.set(source, (counts.get(source) || 0) + 1);
        }
    }

    return counts;
}
