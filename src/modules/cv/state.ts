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

// Detection result cache (key = image hash, value = results)
const detectionCache = new Map<string, { results: CVDetectionResult[]; timestamp: number }>();

// Resized template cache (key = templateId_width_height, value = ImageData)
const resizedTemplateCache = new Map<string, ImageData>();
const MAX_RESIZED_CACHE_SIZE = 500; // Keep up to 500 resized variants

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
    detectionCache.clear();
    resizedTemplateCache.clear();
    if (cacheCleanupTimer) {
        clearInterval(cacheCleanupTimer);
        cacheCleanupTimer = null;
    }
}
