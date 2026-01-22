// ========================================
// Unified Template Manager
// ========================================
// Combines template loading, quality scoring, and multi-scale generation
// Used by both main site and CV validator for consistent template handling

import type { Item } from '../../types/index.ts';
import { logger } from '../logger.ts';
import { getDominantColor } from './color.ts';

// ========================================
// Types
// ========================================

/**
 * Source types for training samples
 */
export type TemplateSource =
    | 'ground_truth'
    | 'corrected'
    | 'corrected_from_empty'
    | 'verified'
    | 'unreviewed'
    | 'default';

/**
 * Multi-scale template data
 */
export interface ScaledTemplate {
    imageData: ImageData;
    size: number;
}

/**
 * Full template data for an item
 */
export interface TemplateData {
    itemId: string;
    image: HTMLImageElement;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
    scaledVariants: Map<number, ImageData>;
    dominantColor?: string;
    qualityScore?: number;
    source?: TemplateSource;
}

/**
 * Training sample metadata
 */
export interface TrainingSample {
    id: string;
    itemId: string;
    source: TemplateSource;
    confidence?: number;
    sourceResolution?: string;
    cropData?: string;
}

/**
 * Weighted template for matching
 */
export interface WeightedTemplate {
    sample: TrainingSample;
    weight: number;
}

/**
 * Template selection options
 */
export interface TemplateSelectionOptions {
    targetResolution?: string;
    maxCount?: number;
    preferDiversity?: boolean;
}

/**
 * LRU Cache entry
 */
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    accessCount: number;
}

// ========================================
// Configuration
// ========================================

const CONFIG = {
    // Source weights for quality scoring (higher = more trusted)
    SOURCE_WEIGHTS: {
        ground_truth: 1.5,
        corrected: 1.3,
        corrected_from_empty: 1.2,
        verified: 1.0,
        unreviewed: 0.8,
        default: 0.7,
    } as Record<TemplateSource, number>,

    // Multi-scale sizes for template matching
    COMMON_ICON_SIZES: [32, 40, 48, 56, 64, 72] as const,

    // Cache settings
    MAX_CACHE_SIZE: 500,
    CACHE_TTL_MS: 5 * 60 * 1000, // 5 minutes

    // Template selection
    MAX_TEMPLATES_PER_ITEM: 10,
    RESOLUTION_MATCH_BONUS: 0.15,
    ASPECT_RATIO_TOLERANCE: 0.05,
};

// ========================================
// State
// ========================================

// Main template storage
const templateStore: Map<string, TemplateData> = new Map();

// Templates grouped by dominant color
const templatesByColor: Map<string, Item[]> = new Map();

// LRU cache for detection results
const detectionCache: Map<string, CacheEntry<unknown>> = new Map();

// Loading state
let templatesLoaded = false;
let priorityTemplatesLoaded = false;

// ========================================
// Quality Scoring
// ========================================

/**
 * Calculate quality score for a template/sample
 * Higher scores indicate more reliable templates
 */
export function calculateQualityScore(sample: TrainingSample): number {
    let score = 0.5; // Base score

    // Source weight (higher for verified sources)
    const sourceWeight = CONFIG.SOURCE_WEIGHTS[sample.source] ?? CONFIG.SOURCE_WEIGHTS.default;
    score += (sourceWeight - 1) * 0.3;

    // Confidence bonus
    if (sample.confidence !== undefined) {
        score += sample.confidence * 0.1;
    }

    // Clamp to [0, 1]
    return Math.min(1, Math.max(0, score));
}

/**
 * Calculate bonus for matching resolution
 */
export function calculateResolutionBonus(sampleResolution?: string, targetResolution?: string): number {
    if (!sampleResolution || !targetResolution) return 0;

    // Exact match
    if (sampleResolution === targetResolution) {
        return CONFIG.RESOLUTION_MATCH_BONUS;
    }

    // Parse resolutions
    const [sw, sh] = sampleResolution.split('x').map(Number);
    const [tw, th] = targetResolution.split('x').map(Number);

    if (!sw || !sh || !tw || !th) return 0;

    // Similar aspect ratio bonus
    const sampleRatio = sw / sh;
    const targetRatio = tw / th;

    if (Math.abs(sampleRatio - targetRatio) < CONFIG.ASPECT_RATIO_TOLERANCE) {
        return CONFIG.RESOLUTION_MATCH_BONUS * 0.5;
    }

    return 0;
}

// ========================================
// Template Selection
// ========================================

/**
 * Select best templates for an item based on quality and relevance
 */
export function selectBestTemplates(
    samples: TrainingSample[],
    options: TemplateSelectionOptions = {}
): WeightedTemplate[] {
    if (!samples || samples.length === 0) return [];

    const { targetResolution, maxCount = 5, preferDiversity = true } = options;

    // Score each sample
    const scoredSamples = samples.map(sample => {
        const qualityScore = calculateQualityScore(sample);
        const resolutionBonus = calculateResolutionBonus(sample.sourceResolution, targetResolution);
        const totalScore = qualityScore + resolutionBonus;

        return { sample, score: totalScore };
    });

    // Sort by score descending
    scoredSamples.sort((a, b) => b.score - a.score);

    // Select top samples
    if (!preferDiversity) {
        return scoredSamples.slice(0, maxCount).map(({ sample, score }) => ({
            sample,
            weight: score,
        }));
    }

    // Prefer diversity in sources
    const selected: WeightedTemplate[] = [];
    const sourceCounts: Record<string, number> = {};

    for (const { sample, score } of scoredSamples) {
        if (selected.length >= maxCount) break;

        // Limit samples from same source (max 2 per source)
        const source = sample.source || 'unknown';
        if ((sourceCounts[source] || 0) >= 2) continue;

        selected.push({ sample, weight: score });
        sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    }

    return selected;
}

/**
 * Calculate weighted match score from multiple template scores
 */
export function calculateWeightedMatchScore(templateScores: Array<{ score: number; weight: number }>): number {
    if (!templateScores || templateScores.length === 0) return 0;

    let weightedSum = 0;
    let totalWeight = 0;

    for (const { score, weight } of templateScores) {
        weightedSum += score * (weight || 1);
        totalWeight += weight || 1;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

// ========================================
// Multi-Scale Generation
// ========================================

/**
 * Generate multi-scale variants of a template
 */
export function generateMultiScaleVariants(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D
): Map<number, ImageData> {
    const variants = new Map<number, ImageData>();
    const width = canvas.width;
    const height = canvas.height;

    for (const targetSize of CONFIG.COMMON_ICON_SIZES) {
        if (targetSize === width && targetSize === height) {
            // Store original as-is
            const imageData = ctx.getImageData(0, 0, width, height);
            variants.set(targetSize, imageData);
            continue;
        }

        // Create resized canvas
        const resizedCanvas = document.createElement('canvas');
        resizedCanvas.width = targetSize;
        resizedCanvas.height = targetSize;
        const resizedCtx = resizedCanvas.getContext('2d', { willReadFrequently: true });

        if (!resizedCtx) continue;

        // Use high-quality scaling
        resizedCtx.imageSmoothingEnabled = true;
        resizedCtx.imageSmoothingQuality = 'high';
        resizedCtx.drawImage(canvas, 0, 0, width, height, 0, 0, targetSize, targetSize);

        const imageData = resizedCtx.getImageData(0, 0, targetSize, targetSize);
        variants.set(targetSize, imageData);
    }

    return variants;
}

/**
 * Get template at specific size (nearest available)
 */
export function getTemplateAtSize(itemId: string, targetSize: number): ImageData | null {
    const template = templateStore.get(itemId);
    if (!template) return null;

    // Exact match
    if (template.scaledVariants.has(targetSize)) {
        return template.scaledVariants.get(targetSize)!;
    }

    // Find nearest size
    let nearestSize = 0;
    let nearestDiff = Infinity;

    for (const size of template.scaledVariants.keys()) {
        const diff = Math.abs(size - targetSize);
        if (diff < nearestDiff) {
            nearestDiff = diff;
            nearestSize = size;
        }
    }

    return nearestSize > 0 ? (template.scaledVariants.get(nearestSize) ?? null) : null;
}

// ========================================
// Template Loading
// ========================================

/**
 * Load a single item template from image
 */
export async function loadTemplate(item: Item, source: TemplateSource = 'default'): Promise<TemplateData | null> {
    if (!item.image) return null;

    // Try WebP first, fallback to PNG
    const imagePath = item.image.endsWith('.png')
        ? item.image.slice(0, -4) + '.webp'
        : item.image.replace(/\.png$/, '.webp');

    return new Promise(resolve => {
        const img = new Image();

        const handleLoad = (loadedImg: HTMLImageElement) => {
            const canvas = document.createElement('canvas');
            canvas.width = loadedImg.width;
            canvas.height = loadedImg.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            if (!ctx) {
                resolve(null);
                return;
            }

            ctx.drawImage(loadedImg, 0, 0);

            // Generate multi-scale variants
            const scaledVariants = generateMultiScaleVariants(canvas, ctx);

            // Get dominant color for grouping
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const dominantColor = getDominantColor(imageData);

            const templateData: TemplateData = {
                itemId: item.id,
                image: loadedImg,
                canvas,
                ctx,
                width: loadedImg.width,
                height: loadedImg.height,
                scaledVariants,
                dominantColor,
                qualityScore: CONFIG.SOURCE_WEIGHTS[source],
                source,
            };

            // Store in main store
            templateStore.set(item.id, templateData);

            resolve(templateData);
        };

        img.onload = () => handleLoad(img);

        img.onerror = () => {
            // Try PNG fallback
            const pngImg = new Image();
            pngImg.onload = () => handleLoad(pngImg);
            pngImg.onerror = () => resolve(null);
            pngImg.src = item.image!;
        };

        img.src = imagePath;
    });
}

/**
 * Load templates in batch with prioritization
 */
export async function loadTemplatesBatch(
    items: Item[],
    source: TemplateSource = 'default'
): Promise<{ loaded: number; failed: number; failedIds: string[] }> {
    let loaded = 0;
    const failedIds: string[] = [];

    const loadPromises = items.map(async item => {
        try {
            const result = await loadTemplate(item, source);
            if (result) {
                loaded++;
            } else {
                failedIds.push(item.id);
            }
        } catch (error) {
            failedIds.push(item.id);
            logger.error({
                operation: 'unified_template.load',
                error: {
                    name: (error as Error).name,
                    message: (error as Error).message,
                },
                data: { itemId: item.id },
            });
        }
    });

    await Promise.all(loadPromises);

    return { loaded, failed: failedIds.length, failedIds };
}

/**
 * Group templates by dominant color for faster matching
 */
export function groupTemplatesByColor(items: Item[]): void {
    items.forEach(item => {
        const template = templateStore.get(item.id);
        if (!template || !template.dominantColor) return;

        const colorCategory = template.dominantColor;

        if (!templatesByColor.has(colorCategory)) {
            templatesByColor.set(colorCategory, []);
        }
        templatesByColor.get(colorCategory)!.push(item);
    });
}

/**
 * Prioritize items by rarity (common items first)
 */
export function prioritizeItems(items: Item[]): { priority: Item[]; standard: Item[] } {
    const priority: Item[] = [];
    const standard: Item[] = [];
    const priorityRarities = ['common', 'uncommon'];

    items.forEach(item => {
        if (priorityRarities.includes(item.rarity)) {
            priority.push(item);
        } else {
            standard.push(item);
        }
    });

    return { priority, standard };
}

// ========================================
// LRU Cache Management
// ========================================

/**
 * Add item to detection cache with LRU eviction
 */
export function cacheDetection<T>(key: string, data: T): void {
    // Evict if at capacity
    if (detectionCache.size >= CONFIG.MAX_CACHE_SIZE) {
        evictOldestCache();
    }

    detectionCache.set(key, {
        data,
        timestamp: Date.now(),
        accessCount: 1,
    });
}

/**
 * Get item from cache, updating access metadata
 */
export function getCachedDetection<T>(key: string): T | null {
    const entry = detectionCache.get(key);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > CONFIG.CACHE_TTL_MS) {
        detectionCache.delete(key);
        return null;
    }

    // Update access count
    entry.accessCount++;
    return entry.data as T;
}

/**
 * Evict oldest/least accessed cache entry
 */
function evictOldestCache(): void {
    let oldestKey: string | null = null;
    let oldestScore = Infinity;

    // LRU scoring: lower = should evict first
    // Score = timestamp + (accessCount * 1000)
    for (const [key, entry] of detectionCache.entries()) {
        const score = entry.timestamp + entry.accessCount * 1000;
        if (score < oldestScore) {
            oldestScore = score;
            oldestKey = key;
        }
    }

    if (oldestKey) {
        detectionCache.delete(oldestKey);
    }
}

/**
 * Clear detection cache
 */
export function clearCache(): void {
    detectionCache.clear();
    logger.info({
        operation: 'unified_template.cache_cleared',
        data: { cleared: true },
    });
}

/**
 * Clean expired cache entries
 */
export function cleanExpiredCache(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of detectionCache.entries()) {
        if (now - entry.timestamp > CONFIG.CACHE_TTL_MS) {
            detectionCache.delete(key);
            cleaned++;
        }
    }

    return cleaned;
}

// ========================================
// Getters
// ========================================

export function getTemplate(itemId: string): TemplateData | undefined {
    return templateStore.get(itemId);
}

export function getAllTemplates(): Map<string, TemplateData> {
    return templateStore;
}

export function getTemplatesByColorGroup(color: string): Item[] {
    return templatesByColor.get(color) ?? [];
}

export function getAllColorGroups(): Map<string, Item[]> {
    return templatesByColor;
}

export function isTemplatesFullyLoaded(): boolean {
    return templatesLoaded;
}

export function isPriorityLoaded(): boolean {
    return priorityTemplatesLoaded;
}

export function getTemplateCount(): number {
    return templateStore.size;
}

export function getScaledVariantCount(): number {
    let count = 0;
    for (const template of templateStore.values()) {
        count += template.scaledVariants.size;
    }
    return count;
}

export function getCacheSize(): number {
    return detectionCache.size;
}

export function getConfig(): typeof CONFIG {
    return { ...CONFIG };
}

// ========================================
// Setters for state management
// ========================================

export function setTemplatesLoaded(loaded: boolean): void {
    templatesLoaded = loaded;
}

export function setPriorityTemplatesLoaded(loaded: boolean): void {
    priorityTemplatesLoaded = loaded;
}

// ========================================
// Reset for testing
// ========================================

export function resetState(): void {
    templateStore.clear();
    templatesByColor.clear();
    detectionCache.clear();
    templatesLoaded = false;
    priorityTemplatesLoaded = false;
}
