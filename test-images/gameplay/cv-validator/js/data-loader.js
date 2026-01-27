/* global Image, setTimeout, clearTimeout */
/* ========================================
 * CV Validator - Data Loader
 * Ground truth, items, templates, training data loading
 * ======================================== */

import { CONFIG } from './config.js';
import { state, presetManager } from './state.js';
import { log, LOG_LEVELS } from './utils.js';

// ========================================
// Timeout Utility
// ========================================

const IMAGE_LOAD_TIMEOUT_MS = 10000;

/**
 * Wrap a promise with a timeout to prevent infinite hangs
 * @param {Promise} promise - The promise to wrap
 * @param {number} ms - Timeout in milliseconds
 * @param {string} context - Description for error message
 * @returns {Promise} - The wrapped promise
 */
function withTimeout(promise, ms, context) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${context} timed out after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

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

    const loadPromise = new Promise(resolve => {
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

    try {
        return await withTimeout(loadPromise, IMAGE_LOAD_TIMEOUT_MS, `Loading template ${item.id}`);
    } catch (error) {
        log(`Template load failed for ${item.id}: ${error.message}`, LOG_LEVELS.WARNING);
        return null;
    }
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
    const loadPromise = new Promise((resolve, reject) => {
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

    return withTimeout(loadPromise, IMAGE_LOAD_TIMEOUT_MS, `Loading image ${imagePath}`);
}

// ========================================
// Resolution Scanning
// ========================================

/**
 * Scan all images in ground-truth to get their resolutions
 * @param {function} onProgress - Optional callback for progress updates (current, total)
 * @returns {Promise<Object>} - Map of imagePath -> { width, height }
 */
export async function scanImageResolutions(onProgress) {
    const imagePaths = Object.keys(state.groundTruth).filter(k => !k.startsWith('_'));
    const total = imagePaths.length;
    let completed = 0;

    log(`Scanning resolutions for ${total} images...`);

    // Load images in parallel batches to avoid overwhelming the browser
    const BATCH_SIZE = 5;
    const resolutions = {};

    for (let i = 0; i < imagePaths.length; i += BATCH_SIZE) {
        const batch = imagePaths.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
            batch.map(async imagePath => {
                try {
                    const img = new Image();
                    const loadPromise = new Promise((resolve, reject) => {
                        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
                        img.onerror = () => reject(new Error(`Failed to load ${imagePath}`));
                    });
                    img.src = imagePath;

                    const result = await withTimeout(loadPromise, 5000, `Scanning ${imagePath}`);
                    return { path: imagePath, ...result };
                } catch (err) {
                    log(`Failed to scan ${imagePath}: ${err.message}`, LOG_LEVELS.WARNING);
                    return { path: imagePath, width: 0, height: 0 };
                }
            })
        );

        for (const result of results) {
            resolutions[result.path] = { width: result.width, height: result.height };
        }

        completed += batch.length;
        if (onProgress) {
            onProgress(completed, total);
        }
    }

    state.imageResolutions = resolutions;
    state.resolutionScanComplete = true;
    log(`Resolution scan complete: ${Object.keys(resolutions).length} images`, LOG_LEVELS.SUCCESS);

    return resolutions;
}

/**
 * Get resolution key string (e.g., "1920x1080")
 */
function getResolutionKey(width, height) {
    return `${width}x${height}`;
}

// ========================================
// Populate Image Select
// ========================================

/**
 * Populate the image select dropdown, grouped by resolution
 * @param {HTMLSelectElement} selectElement - The select element to populate
 */
export function populateImageSelect(selectElement) {
    selectElement.innerHTML = '<option value="">-- Select a test image --</option>';

    // If resolution scan is complete, group by resolution
    if (state.resolutionScanComplete && Object.keys(state.imageResolutions).length > 0) {
        populateGroupedByResolution(selectElement);
    } else {
        // Fallback to simple list if no resolution data
        populateSimpleList(selectElement);
    }
}

/**
 * Populate dropdown with images grouped by resolution
 */
function populateGroupedByResolution(selectElement) {
    const allPresets = presetManager.getAllPresets();

    // Group images by resolution
    const groups = {};
    for (const [imagePath, data] of Object.entries(state.groundTruth)) {
        if (imagePath.startsWith('_')) continue;

        const resolution = state.imageResolutions[imagePath];
        if (!resolution || resolution.width === 0) {
            // Unknown resolution - put in "Unknown" group
            if (!groups['unknown']) {
                groups['unknown'] = { key: 'unknown', width: 0, height: 0, images: [] };
            }
            groups['unknown'].images.push({ path: imagePath, data });
        } else {
            const key = getResolutionKey(resolution.width, resolution.height);
            if (!groups[key]) {
                groups[key] = { key, width: resolution.width, height: resolution.height, images: [] };
            }
            groups[key].images.push({ path: imagePath, data });
        }
    }

    // Sort groups by pixel count (highest first)
    const sortedGroups = Object.values(groups).sort((a, b) => {
        if (a.key === 'unknown') return 1;
        if (b.key === 'unknown') return -1;
        return b.width * b.height - a.width * a.height;
    });

    // Create optgroups
    for (const group of sortedGroups) {
        const hasPreset = group.key !== 'unknown' && allPresets[group.key];

        // Sort images within group alphabetically
        group.images.sort((a, b) => a.path.localeCompare(b.path));

        // Create optgroup with resolution info
        const optgroup = document.createElement('optgroup');
        const presetIndicator = hasPreset ? ' [P]' : '';
        if (group.key === 'unknown') {
            optgroup.label = `Unknown Resolution (${group.images.length})`;
        } else {
            optgroup.label = `${group.key}${presetIndicator} (${group.images.length} images)`;
        }

        // Add options for each image
        for (const { path, data } of group.images) {
            const option = createImageOption(path, data, allPresets, group);
            optgroup.appendChild(option);
        }

        selectElement.appendChild(optgroup);
    }
}

/**
 * Create an option element for an image
 */
function createImageOption(imagePath, data, allPresets, group) {
    const itemCount = data.items?.length || 0;
    const hasCustomOverride = data.calibration !== undefined;
    const resolutionKey = group.key;
    const hasResolutionPreset = resolutionKey !== 'unknown' && allPresets[resolutionKey];

    // Build status indicators
    let statusIndicator = '';
    if (hasCustomOverride) {
        statusIndicator = '[C] '; // Custom override in ground-truth.json
    } else if (hasResolutionPreset) {
        statusIndicator = ''; // No indicator needed - preset shown in group label
    }

    const option = document.createElement('option');
    option.value = imagePath;

    // Extract just the filename for display
    const filename = imagePath.split('/').pop();
    option.textContent = `${statusIndicator}${filename} (${itemCount} items)`;

    // Add data attributes for potential future use
    if (hasCustomOverride) {
        option.dataset.customOverride = 'true';
    }

    return option;
}

/**
 * Fallback: populate dropdown as simple list (no grouping)
 */
function populateSimpleList(selectElement) {
    for (const [imagePath, data] of Object.entries(state.groundTruth)) {
        if (imagePath.startsWith('_')) continue;

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
