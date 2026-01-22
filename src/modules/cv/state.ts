// ========================================
// CV Module State and Cache Management
// ========================================

import type { AllGameData, Item } from '../../types/index.ts';
import type { CVDetectionResult, TemplateData } from './types.ts';

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

// Resized template cache (key = templateId_width_height, value = ImageData)
const resizedTemplateCache = new Map<string, ImageData>();
const MAX_RESIZED_CACHE_SIZE = 500; // Keep up to 500 resized variants

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
    return resizedTemplateCache.get(key);
}

export function setResizedTemplate(templateId: string, width: number, height: number, imageData: ImageData): void {
    const key = `${templateId}_${width}_${height}`;

    // Evict oldest entries if cache is full (simple FIFO)
    if (resizedTemplateCache.size >= MAX_RESIZED_CACHE_SIZE) {
        const firstKey = resizedTemplateCache.keys().next().value;
        if (firstKey) {
            resizedTemplateCache.delete(firstKey);
        }
    }

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
    if (cacheCleanupTimer) {
        clearInterval(cacheCleanupTimer);
        cacheCleanupTimer = null;
    }
}
