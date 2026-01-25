// ========================================
// CV Module State and Cache Management
// ========================================

import type { AllGameData, Item } from '../../types/index.ts';
import type { CVDetectionResult, TemplateData, GridPreset, GridPresetsFile } from './types.ts';

// ========================================
// Module State
// ========================================

let allData: AllGameData = {};

const itemTemplates = new Map<string, TemplateData>();
const templatesByColor = new Map<string, Item[]>();
let templatesLoaded = false;
let priorityTemplatesLoaded = false;
let standardTemplatesLoading = false; // Guard against concurrent standard template loads

// Detection result cache (key = image hash, value = results)
const detectionCache = new Map<string, { results: CVDetectionResult[]; timestamp: number }>();

// ========================================
// LRU Cache Implementation
// ========================================

/**
 * LRU (Least Recently Used) Cache
 * Provides O(1) get/set operations with automatic eviction
 */
class LRUCache<K, V> {
    private cache: Map<K, V>;
    private maxSize: number;

    constructor(maxSize: number) {
        this.cache = new Map();
        this.maxSize = maxSize;
    }

    /**
     * Get value from cache, moving it to most recently used
     */
    get(key: K): V | undefined {
        const value = this.cache.get(key);
        if (value !== undefined) {
            // Move to end (most recently used) by deleting and re-adding
            this.cache.delete(key);
            this.cache.set(key, value);
        }
        return value;
    }

    /**
     * Set value in cache, evicting LRU entry if full
     */
    set(key: K, value: V): void {
        // If key exists, delete it first (will be re-added at end)
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            // Evict least recently used (first entry in Map)
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }
        this.cache.set(key, value);
    }

    /**
     * Check if key exists in cache
     */
    has(key: K): boolean {
        return this.cache.has(key);
    }

    /**
     * Delete a specific key
     */
    delete(key: K): boolean {
        return this.cache.delete(key);
    }

    /**
     * Clear the entire cache
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Get current size of cache
     */
    get size(): number {
        return this.cache.size;
    }

    /**
     * Get all entries (for iteration)
     */
    entries(): IterableIterator<[K, V]> {
        return this.cache.entries();
    }
}

// Resized template cache using LRU (key = templateId_width_height, value = ImageData)
const RESIZED_CACHE_SIZE = 500;
const resizedTemplateCache = new LRUCache<string, ImageData>(RESIZED_CACHE_SIZE);

// Multi-scale template variants (pre-generated at common sizes for faster matching)
// Key: itemId, Value: Map of size -> ImageData
const multiScaleTemplates = new Map<string, Map<number, ImageData>>();

// Common icon sizes used in different resolutions
export const COMMON_ICON_SIZES = [32, 38, 40, 44, 48, 55, 64, 72] as const;

// ========================================
// Cache Constants
// ========================================

export const CACHE_TTL = 1000 * 60 * 15; // 15 minutes
export const MAX_CACHE_SIZE = 50; // Maximum number of cache entries

// Timer for periodic cache cleanup
let cacheCleanupTimer: ReturnType<typeof setInterval> | null = null;

// ========================================
// State Getters
// ========================================

export function getAllData(): AllGameData {
    return allData;
}

export function getItemTemplates(): Map<string, TemplateData> {
    return itemTemplates;
}

export function getTemplatesByColor(): Map<string, Item[]> {
    return templatesByColor;
}

export function isTemplatesLoaded(): boolean {
    return templatesLoaded;
}

export function isPriorityTemplatesLoaded(): boolean {
    return priorityTemplatesLoaded;
}

export function isStandardTemplatesLoading(): boolean {
    return standardTemplatesLoading;
}

export function setStandardTemplatesLoading(loading: boolean): void {
    standardTemplatesLoading = loading;
}

export function getDetectionCache(): Map<string, { results: CVDetectionResult[]; timestamp: number }> {
    return detectionCache;
}

export function getResizedTemplate(templateId: string, width: number, height: number): ImageData | undefined {
    const key = `${templateId}_${width}_${height}`;
    // LRU cache automatically moves accessed item to most recently used
    return resizedTemplateCache.get(key);
}

export function setResizedTemplate(templateId: string, width: number, height: number, imageData: ImageData): void {
    const key = `${templateId}_${width}_${height}`;
    // LRU cache automatically handles eviction
    resizedTemplateCache.set(key, imageData);
}

export function getResizedTemplateCacheSize(): number {
    return resizedTemplateCache.size;
}

export function getMultiScaleTemplates(): Map<string, Map<number, ImageData>> {
    return multiScaleTemplates;
}

export function getMultiScaleTemplate(itemId: string, size: number): ImageData | undefined {
    return multiScaleTemplates.get(itemId)?.get(size);
}

export function setMultiScaleTemplate(itemId: string, size: number, imageData: ImageData): void {
    if (!multiScaleTemplates.has(itemId)) {
        multiScaleTemplates.set(itemId, new Map());
    }
    multiScaleTemplates.get(itemId)!.set(size, imageData);
}

export function hasMultiScaleTemplates(itemId: string): boolean {
    return multiScaleTemplates.has(itemId) && multiScaleTemplates.get(itemId)!.size > 0;
}

export function getMultiScaleTemplateCount(): number {
    let count = 0;
    multiScaleTemplates.forEach(sizes => {
        count += sizes.size;
    });
    return count;
}

export function getCacheCleanupTimer(): ReturnType<typeof setInterval> | null {
    return cacheCleanupTimer;
}

// ========================================
// State Setters
// ========================================

export function setAllData(data: AllGameData): void {
    allData = data;
}

export function setTemplatesLoaded(loaded: boolean): void {
    templatesLoaded = loaded;
}

export function setPriorityTemplatesLoaded(loaded: boolean): void {
    priorityTemplatesLoaded = loaded;
}

export function setCacheCleanupTimer(timer: ReturnType<typeof setInterval> | null): void {
    cacheCleanupTimer = timer;
}

// ========================================
// State Reset (for cleanup)
// ========================================

export function resetState(): void {
    allData = {};
    itemTemplates.clear();
    templatesByColor.clear();
    templatesLoaded = false;
    priorityTemplatesLoaded = false;
    standardTemplatesLoading = false;
    detectionCache.clear();
    resizedTemplateCache.clear();
    multiScaleTemplates.clear();
    gridPresets = null;
    gridPresetsLoaded = false;
    if (cacheCleanupTimer) {
        clearInterval(cacheCleanupTimer);
        cacheCleanupTimer = null;
    }
}

// ========================================
// Grid Presets State
// ========================================

let gridPresets: GridPresetsFile | null = null;
let gridPresetsLoaded = false;

/**
 * Load grid presets from the data directory
 */
export async function loadGridPresets(): Promise<GridPresetsFile | null> {
    if (gridPresetsLoaded && gridPresets) {
        return gridPresets;
    }

    try {
        const response = await fetch('data/grid-presets.json');
        if (!response.ok) {
            console.warn(`Grid presets not found (${response.status})`);
            gridPresetsLoaded = true;
            return null;
        }

        gridPresets = await response.json();
        gridPresetsLoaded = true;
        console.log(`Loaded ${Object.keys(gridPresets?.presets || {}).length} grid presets`);
        return gridPresets;
    } catch (e) {
        console.warn('Failed to load grid presets:', e);
        gridPresetsLoaded = true;
        return null;
    }
}

/**
 * Get a preset for a specific resolution
 */
export function getPresetForResolution(width: number, height: number): GridPreset | null {
    if (!gridPresets?.presets) return null;
    const key = `${width}x${height}`;
    return gridPresets.presets[key] || null;
}

/**
 * Find best matching preset by aspect ratio (fallback when exact resolution not found)
 */
export function findPresetByAspectRatio(width: number, height: number): GridPreset | null {
    if (!gridPresets?.presets) return null;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return null;
    }

    const targetRatio = width / height;
    let bestMatch: GridPreset | null = null;
    let bestScore = Infinity;

    for (const preset of Object.values(gridPresets.presets)) {
        const presetRatio = preset.resolution.width / preset.resolution.height;
        const ratioDiff = Math.abs(presetRatio - targetRatio);

        // Prefer closer aspect ratio and closer total resolution
        const sizeDiff = Math.abs(preset.resolution.width * preset.resolution.height - width * height) / 1000000;
        const score = ratioDiff * 10 + sizeDiff;

        if (score < bestScore) {
            bestScore = score;
            bestMatch = preset;
        }
    }

    return bestMatch;
}

/**
 * Get all loaded presets
 */
export function getAllGridPresets(): Record<string, GridPreset> {
    return gridPresets?.presets || {};
}

/**
 * Check if grid presets have been loaded
 */
export function isGridPresetsLoaded(): boolean {
    return gridPresetsLoaded;
}

/**
 * Scale calibration values from one resolution to another
 */
export function scaleCalibrationToResolution(
    calibration: GridPreset['calibration'],
    fromHeight: number,
    toHeight: number
): GridPreset['calibration'] {
    const scale = toHeight / fromHeight;
    return {
        xOffset: Math.round(calibration.xOffset * scale),
        yOffset: Math.round(calibration.yOffset * scale),
        iconWidth: Math.round(calibration.iconWidth * scale),
        iconHeight: Math.round(calibration.iconHeight * scale),
        xSpacing: Math.round(calibration.xSpacing * scale),
        ySpacing: Math.round(calibration.ySpacing * scale),
        iconsPerRow: calibration.iconsPerRow, // These don't scale
        numRows: calibration.numRows,
    };
}
