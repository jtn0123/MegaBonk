// ========================================
// CV Template Loading
// ========================================

import type { Item } from '../../types/index.ts';
import { logger } from '../logger.ts';
import {
    getAllData,
    getItemTemplates,
    getTemplatesByColor,
    getDetectionCache,
    isTemplatesLoaded,
    setTemplatesLoaded,
    setPriorityTemplatesLoaded,
    setStandardTemplatesLoading,
    setMultiScaleTemplate,
    getMultiScaleTemplateCount,
    COMMON_ICON_SIZES,
    clearTemplateState,
} from './state.ts';
import { getDominantColor } from './color.ts';

// ========================================
// Multi-Scale Template Generation
// ========================================

/**
 * Generate multi-scale variants of a template for faster matching
 * Pre-computes resized versions at common icon sizes
 */
function generateMultiScaleVariants(itemId: string, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
    const width = canvas.width;
    const height = canvas.height;

    // Generate variants at common sizes (skip if already that size)
    for (const targetSize of COMMON_ICON_SIZES) {
        if (targetSize === width && targetSize === height) {
            // Store original as-is
            const imageData = ctx.getImageData(0, 0, width, height);
            setMultiScaleTemplate(itemId, targetSize, imageData);
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
        setMultiScaleTemplate(itemId, targetSize, imageData);
    }
}

// ========================================
// Template Prioritization
// ========================================

/**
 * Categorize items by priority (common items first)
 */
export function prioritizeItems(items: Item[]): { priority: Item[]; standard: Item[] } {
    const priority: Item[] = [];
    const standard: Item[] = [];

    // High-priority items (common, frequently seen)
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
// Template Loading
// ========================================

// Retry configuration for template loading (2.4)
const TEMPLATE_LOAD_MAX_RETRIES = 2;
const TEMPLATE_LOAD_RETRY_DELAY_MS = 500;
let templateLoadPromise: Promise<void> | null = null;

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Load a single template image with retry logic (2.4)
 * Retries with exponential backoff on failure
 */
async function loadTemplateWithRetry(
    item: Item,
    retries: number = TEMPLATE_LOAD_MAX_RETRIES
): Promise<{ success: boolean; image?: HTMLImageElement }> {
    const imagePath = item.image?.endsWith('.png')
        ? item.image.slice(0, -4) + '.webp'
        : item.image?.replace(/\.png$/, '.webp') || '';

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            // Try WebP first
            const img = await loadImage(imagePath);
            return { success: true, image: img };
        } catch (error) {
            console.debug('[cv/templates] image load failed:', error);
            // Try PNG fallback on first failure of WebP
            if (attempt === 0 && item.image) {
                try {
                    const pngImg = await loadImage(item.image);
                    return { success: true, image: pngImg };
                } catch (error) {
                    console.debug('[cv/templates] PNG fallback load failed:', error);
                    // Continue to retry logic
                }
            }

            // Retry with exponential backoff
            if (attempt < retries) {
                const delay = TEMPLATE_LOAD_RETRY_DELAY_MS * Math.pow(2, attempt);
                logger.debug?.({
                    operation: 'cv.template_retry',
                    data: { itemId: item.id, attempt: attempt + 1, delay },
                });
                await sleep(delay);
            }
        }
    }

    return { success: false };
}

/**
 * Load an image and return a promise
 */
function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load: ${src}`));
        img.src = src;
    });
}

/**
 * Load item templates progressively (priority items first)
 */
export async function loadTemplatesBatch(
    items: Item[]
): Promise<{ loaded: number; failed: number; failedIds: string[] }> {
    let loaded = 0;
    const failedIds: string[] = [];
    const itemTemplates = getItemTemplates();

    const loadPromises = items.map(async item => {
        try {
            // Skip items without images
            if (!item.image) return;

            // Use retry logic for template loading (2.4)
            const result = await loadTemplateWithRetry(item);

            if (!result.success || !result.image) {
                throw new Error(`Failed to load template after retries: ${item.image}`);
            }

            const img = result.image;
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            if (!ctx) {
                throw new Error('Failed to get canvas context');
            }

            ctx.drawImage(img, 0, 0);

            itemTemplates.set(item.id, {
                image: img,
                canvas,
                ctx,
                width: img.width,
                height: img.height,
            });

            // Generate multi-scale variants for faster matching
            generateMultiScaleVariants(item.id, canvas, ctx);

            loaded++;
        } catch (error) {
            failedIds.push(item.id);
            logger.error({
                operation: 'cv.load_template',
                error: {
                    name: (error as Error).name,
                    message: (error as Error).message,
                },
                data: { itemId: item.id, itemName: item.name },
            });
        }
    });

    await Promise.all(loadPromises);

    // Log summary if there were failures
    if (failedIds.length > 0) {
        logger.warn({
            operation: 'cv.load_template_batch',
            data: {
                totalAttempted: items.length,
                loaded,
                failed: failedIds.length,
                failedIds: failedIds.slice(0, 10), // Limit to first 10 for brevity
            },
        });
    }

    return { loaded, failed: failedIds.length, failedIds };
}

/**
 * Group loaded templates by dominant color
 */
export function groupTemplatesByColor(items: Item[]): void {
    const itemTemplates = getItemTemplates();
    const templatesByColor = getTemplatesByColor();

    items.forEach(item => {
        const template = itemTemplates.get(item.id);
        if (!template) return;

        const imageData = template.ctx.getImageData(0, 0, template.width, template.height);
        const colorCategory = getDominantColor(imageData);

        if (!templatesByColor.has(colorCategory)) {
            templatesByColor.set(colorCategory, []);
        }
        templatesByColor.get(colorCategory)!.push(item);
    });
}

/**
 * Load all item template images into memory (with progressive loading)
 */
export async function loadItemTemplates(): Promise<void> {
    if (isTemplatesLoaded()) return;
    if (templateLoadPromise) {
        return templateLoadPromise;
    }

    templateLoadPromise = (async () => {
        const templatesByColor = getTemplatesByColor();

        clearDetectionCache();
        clearTemplateState();
        logger.info({
            operation: 'cv.load_templates',
            data: { phase: 'clearing_old_templates' },
        });

        const items = getAllData().items?.items || [];

        logger.info({
            operation: 'cv.load_templates',
            data: { phase: 'start', totalItems: items.length },
        });

        const { priority, standard } = prioritizeItems(items);

        const priorityResult = await loadTemplatesBatch(priority);
        groupTemplatesByColor(priority);
        setPriorityTemplatesLoaded(true);

        logger.info({
            operation: 'cv.load_templates',
            data: {
                phase: 'priority_complete',
                priorityLoaded: priorityResult.loaded,
                priorityFailed: priorityResult.failed,
                priorityTotal: priority.length,
            },
        });

        setStandardTemplatesLoading(true);
        try {
            await sleep(0);
            const standardResult = await loadTemplatesBatch(standard);
            groupTemplatesByColor(standard);
            setTemplatesLoaded(true);

            logger.info({
                operation: 'cv.load_templates',
                data: {
                    phase: 'complete',
                    priorityLoaded: priorityResult.loaded,
                    priorityFailed: priorityResult.failed,
                    standardLoaded: standardResult.loaded,
                    standardFailed: standardResult.failed,
                    total: items.length,
                    multiScaleVariants: getMultiScaleTemplateCount(),
                    colorGroups: Object.fromEntries(
                        Array.from(templatesByColor.entries()).map(([color, groupedItems]) => [
                            color,
                            groupedItems.length,
                        ])
                    ),
                },
            });
        } catch (error) {
            logger.error({
                operation: 'cv.load_templates',
                data: {
                    phase: 'error',
                    error: error instanceof Error ? error.message : String(error),
                },
            });
            // Keep the CV UI usable even if some templates fail to finish loading.
            setTemplatesLoaded(true);
        } finally {
            setStandardTemplatesLoading(false);
        }
    })();

    try {
        await templateLoadPromise;
    } finally {
        templateLoadPromise = null;
    }
}

// ========================================
// Cache Management
// ========================================

/**
 * Clear detection cache
 */
export function clearDetectionCache(): void {
    getDetectionCache().clear();
    logger.info({
        operation: 'cv.cache_cleared',
        data: { cleared: true },
    });
}
