// ========================================
// CV Training Data Loader
// ========================================
// Loads validated training samples for multi-template matching

import { logger } from '../logger.ts';

// ========================================
// Types
// ========================================

export interface TrainingSample {
    id: string;
    file: string;
    source_resolution: string;
    source_image: string;
    validation_type: 'verified' | 'corrected' | 'corrected_from_empty';
    original_confidence: number;
    dimensions: { w: number; h: number };
    added_at: string;
}

export interface TrainingItemData {
    name: string;
    sample_count: number;
    samples: TrainingSample[];
}

export interface TrainingIndex {
    version: string;
    created_at: string;
    updated_at: string;
    total_samples: number;
    items: Record<string, TrainingItemData>;
}

export interface TrainingTemplate {
    imageData: ImageData;
    weight: number; // 1.2 for corrected, 1.0 for verified, 0.8 for uncorrected
    resolution: string;
    validationType: string;
    sourceImage: string; // e.g., "pc-1080p/level_803_russian_stress_test.jpg"
}

// ========================================
// State
// ========================================

// Map of item_id -> array of training templates
const trainingTemplates = new Map<string, TrainingTemplate[]>();
let trainingDataLoaded = false;
let trainingIndex: TrainingIndex | null = null;

// Track available source images and which are enabled
const availableSources = new Set<string>();
const enabledSources = new Set<string>();

// Base path for training data (relative to app root)
// Can be overridden with setTrainingDataBasePath() for library consumers
let trainingDataBasePath = '/data/training-data/';

/**
 * Set the base path for training data
 * Useful for library consumers who have different directory structures
 * @param path The base path (should end with /)
 */
export function setTrainingDataBasePath(path: string): void {
    trainingDataBasePath = path.endsWith('/') ? path : path + '/';
}

// ========================================
// Getters
// ========================================

export function getTrainingTemplates(): Map<string, TrainingTemplate[]> {
    return trainingTemplates;
}

export function isTrainingDataLoaded(): boolean {
    return trainingDataLoaded;
}

export function getTrainingIndex(): TrainingIndex | null {
    return trainingIndex;
}

export function getTrainingTemplatesForItem(itemId: string): TrainingTemplate[] {
    const templates = trainingTemplates.get(itemId) || [];

    // If no sources are enabled or all sources are enabled, return all
    if (enabledSources.size === 0 || enabledSources.size === availableSources.size) {
        return templates;
    }

    // Filter by enabled sources
    return templates.filter(t => enabledSources.has(t.sourceImage));
}

// ========================================
// Source Management
// ========================================

/**
 * Get all available training data sources
 */
export function getAvailableSources(): string[] {
    return Array.from(availableSources).sort();
}

/**
 * Get currently enabled sources
 */
export function getEnabledSources(): string[] {
    return Array.from(enabledSources).sort();
}

/**
 * Enable a specific source
 */
export function enableSource(source: string): void {
    if (availableSources.has(source)) {
        enabledSources.add(source);
    }
}

/**
 * Disable a specific source
 */
export function disableSource(source: string): void {
    enabledSources.delete(source);
}

/**
 * Set which sources are enabled (replaces current selection)
 */
export function setEnabledSources(sources: string[]): void {
    enabledSources.clear();
    for (const source of sources) {
        if (availableSources.has(source)) {
            enabledSources.add(source);
        }
    }
}

/**
 * Enable all sources
 */
export function enableAllSources(): void {
    enabledSources.clear();
    for (const source of availableSources) {
        enabledSources.add(source);
    }
}

/**
 * Check if a source is enabled
 */
export function isSourceEnabled(source: string): boolean {
    // If no explicit selection, all are considered enabled
    if (enabledSources.size === 0) return true;
    return enabledSources.has(source);
}

// ========================================
// Weight Calculation
// ========================================

function getTemplateWeight(validationType: string): number {
    switch (validationType) {
        case 'corrected':
        case 'corrected_from_empty':
            return 1.2; // Most valuable - human-labeled
        case 'verified':
            return 1.0; // Confirmed correct
        default:
            return 0.8; // Unreviewed
    }
}

// ========================================
// Loading Functions
// ========================================

/**
 * Load a single training image as ImageData
 */
async function loadTrainingImage(imagePath: string): Promise<ImageData | null> {
    return new Promise(resolve => {
        const img = new Image();
        let resolved = false;

        // Timeout after 5 seconds
        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                resolve(null);
            }
        }, 5000);

        img.onload = () => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timeout);

            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });

                if (!ctx) {
                    resolve(null);
                    return;
                }

                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, img.width, img.height);
                resolve(imageData);
            } catch {
                resolve(null);
            }
        };

        img.onerror = () => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timeout);
            resolve(null);
        };

        img.src = trainingDataBasePath + imagePath;
    });
}

/**
 * Load training data index and all training templates
 */
export async function loadTrainingData(): Promise<boolean> {
    if (trainingDataLoaded) {
        logger.info({
            operation: 'cv.training.already_loaded',
            data: { templateCount: trainingTemplates.size },
        });
        return true;
    }

    try {
        // Load index file
        const indexPath = trainingDataBasePath + 'index.json';
        const response = await fetch(indexPath);

        if (!response.ok) {
            logger.info({
                operation: 'cv.training.no_index',
                data: { status: response.status, message: 'No training data index found' },
            });
            trainingDataLoaded = true; // Mark as loaded (just no data)
            return true;
        }

        const index: TrainingIndex = await response.json();
        trainingIndex = index;

        logger.info({
            operation: 'cv.training.index_loaded',
            data: {
                version: index.version,
                totalSamples: index.total_samples,
                itemCount: Object.keys(index.items).length,
            },
        });

        // Load training templates for each item
        let loadedCount = 0;
        let failedCount = 0;

        for (const [itemId, itemData] of Object.entries(index.items)) {
            const templates: TrainingTemplate[] = [];

            for (const sample of itemData.samples) {
                const imageData = await loadTrainingImage(sample.file);

                if (imageData) {
                    // Track this source
                    availableSources.add(sample.source_image);

                    templates.push({
                        imageData,
                        weight: getTemplateWeight(sample.validation_type),
                        resolution: sample.source_resolution,
                        validationType: sample.validation_type,
                        sourceImage: sample.source_image,
                    });
                    loadedCount++;
                } else {
                    failedCount++;
                }
            }

            if (templates.length > 0) {
                trainingTemplates.set(itemId, templates);
            }
        }

        trainingDataLoaded = true;

        // Enable all sources by default
        enableAllSources();

        logger.info({
            operation: 'cv.training.load_complete',
            data: {
                loadedTemplates: loadedCount,
                failedTemplates: failedCount,
                itemsWithTemplates: trainingTemplates.size,
                sourcesFound: availableSources.size,
            },
        });

        return true;
    } catch (error) {
        logger.warn({
            operation: 'cv.training.load_error',
            error: {
                name: (error as Error).name,
                message: (error as Error).message,
            },
        });

        trainingDataLoaded = true; // Mark as loaded (with error)
        return false;
    }
}

/**
 * Get training data statistics
 */
export function getTrainingStats(): {
    loaded: boolean;
    totalItems: number;
    totalTemplates: number;
    itemsWithMostSamples: { id: string; count: number }[];
} {
    let totalTemplates = 0;
    const itemCounts: { id: string; count: number }[] = [];

    for (const [itemId, templates] of trainingTemplates) {
        totalTemplates += templates.length;
        itemCounts.push({ id: itemId, count: templates.length });
    }

    // Sort by count descending
    itemCounts.sort((a, b) => b.count - a.count);

    return {
        loaded: trainingDataLoaded,
        totalItems: trainingTemplates.size,
        totalTemplates,
        itemsWithMostSamples: itemCounts.slice(0, 10),
    };
}

/**
 * Clear training data (for cleanup)
 */
export function clearTrainingData(): void {
    trainingTemplates.clear();
    trainingDataLoaded = false;
    trainingIndex = null;
    availableSources.clear();
    enabledSources.clear();
}
