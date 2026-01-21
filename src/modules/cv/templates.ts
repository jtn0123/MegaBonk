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
    isStandardTemplatesLoading,
    setStandardTemplatesLoading,
} from './state.ts';
import { getDominantColor } from './color.ts';

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
            // Try WebP first (smaller), fallback to PNG
            // Only replace .png extension at the end of the path
            const imagePath = item.image.endsWith('.png')
                ? item.image.slice(0, -4) + '.webp'
                : item.image.replace(/\.png$/, '.webp');
            const img = new Image();

            await new Promise<void>((resolve, reject) => {
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });

                    if (!ctx) {
                        reject(new Error('Failed to get canvas context'));
                        return;
                    }

                    ctx.drawImage(img, 0, 0);

                    itemTemplates.set(item.id, {
                        image: img,
                        canvas,
                        ctx,
                        width: img.width,
                        height: img.height,
                    });

                    loaded++;
                    resolve();
                };

                img.onerror = () => {
                    // Try PNG fallback
                    const pngImg = new Image();
                    pngImg.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = pngImg.width;
                        canvas.height = pngImg.height;
                        const ctx = canvas.getContext('2d', { willReadFrequently: true });

                        if (!ctx) {
                            reject(new Error('Failed to get canvas context'));
                            return;
                        }

                        ctx.drawImage(pngImg, 0, 0);

                        itemTemplates.set(item.id, {
                            image: pngImg,
                            canvas,
                            ctx,
                            width: pngImg.width,
                            height: pngImg.height,
                        });

                        loaded++;
                        resolve();
                    };
                    pngImg.onerror = () => reject(new Error(`Failed to load: ${item.image}`));
                    pngImg.src = item.image!;
                };

                img.src = imagePath;
            });
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

    const itemTemplates = getItemTemplates();
    const templatesByColor = getTemplatesByColor();

    // Clear old templates before loading new ones to prevent memory leaks
    // This handles cases where loadItemTemplates is called after a data refresh
    if (itemTemplates.size > 0) {
        itemTemplates.clear();
        templatesByColor.clear();
        setPriorityTemplatesLoaded(false);
        logger.info({
            operation: 'cv.load_templates',
            data: { phase: 'clearing_old_templates' },
        });
    }

    const items = getAllData().items?.items || [];

    logger.info({
        operation: 'cv.load_templates',
        data: { phase: 'start', totalItems: items.length },
    });

    // Prioritize items (common/uncommon first)
    const { priority, standard } = prioritizeItems(items);

    // Load priority items first
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

    // Load remaining items in background (non-blocking)
    // Use setTimeout(0) to yield to the event loop without arbitrary delay
    // Guard against concurrent loads with isStandardTemplatesLoading flag
    if (isStandardTemplatesLoading()) {
        logger.info({
            operation: 'cv.load_templates',
            data: { phase: 'skipped_standard', reason: 'already_loading' },
        });
        return;
    }
    setStandardTemplatesLoading(true);

    setTimeout(async () => {
        try {
            const standardResult = await loadTemplatesBatch(standard);
            groupTemplatesByColor(standard);
            setTemplatesLoaded(true);
            setStandardTemplatesLoading(false);

            logger.info({
                operation: 'cv.load_templates',
                data: {
                    phase: 'complete',
                    priorityLoaded: priorityResult.loaded,
                    priorityFailed: priorityResult.failed,
                    standardLoaded: standardResult.loaded,
                    standardFailed: standardResult.failed,
                    total: items.length,
                    colorGroups: Object.fromEntries(
                        Array.from(templatesByColor.entries()).map(([color, items]) => [color, items.length])
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
            // Still mark as loaded to prevent infinite retries
            setTemplatesLoaded(true);
            setStandardTemplatesLoading(false);
        }
    }, 0);
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
