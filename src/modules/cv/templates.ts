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
export async function loadTemplatesBatch(items: Item[]): Promise<number> {
    let loaded = 0;
    const itemTemplates = getItemTemplates();

    const loadPromises = items.map(async item => {
        try {
            // Skip items without images
            if (!item.image) return;
            // Try WebP first (smaller), fallback to PNG
            const imagePath = item.image.replace('.png', '.webp');
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
            logger.error({
                operation: 'cv.load_template',
                error: {
                    name: (error as Error).name,
                    message: (error as Error).message,
                },
            });
        }
    });

    await Promise.all(loadPromises);

    return loaded;
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
    const priorityLoaded = await loadTemplatesBatch(priority);
    groupTemplatesByColor(priority);
    setPriorityTemplatesLoaded(true);

    logger.info({
        operation: 'cv.load_templates',
        data: {
            phase: 'priority_complete',
            priorityLoaded,
            priorityTotal: priority.length,
        },
    });

    // Load remaining items in background (non-blocking)
    setTimeout(async () => {
        try {
            const standardLoaded = await loadTemplatesBatch(standard);
            groupTemplatesByColor(standard);
            setTemplatesLoaded(true);

            logger.info({
                operation: 'cv.load_templates',
                data: {
                    phase: 'complete',
                    priorityLoaded,
                    standardLoaded,
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
        }
    }, 100); // Small delay to allow UI to update
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
