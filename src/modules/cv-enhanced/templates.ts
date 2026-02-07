// ========================================
// Enhanced CV Template Management
// ========================================
// Template loading and storage with enhanced color analysis

import type { Item } from '../../types/index.ts';
import type { EnhancedTemplateData } from './types.ts';
import { rgbToHSV, extractColorProfile } from '../cv-strategy.ts';
import type { HSVColor } from '../cv-strategy.ts';
import { getAllData } from '../cv/state.ts';
import { logger } from '../logger.ts';

// Enhanced template storage (extends base with color analysis)
const enhancedTemplates = new Map<string, EnhancedTemplateData>();
const templatesByRarity = new Map<string, Item[]>();
const enhancedTemplatesByColor = new Map<string, Item[]>();

// Track enhanced-specific loading state (separate from base templates)
let enhancedTemplatesLoaded = false;

/**
 * Get enhanced template data for an item
 */
export function getEnhancedTemplate(itemId: string): EnhancedTemplateData | undefined {
    return enhancedTemplates.get(itemId);
}

/**
 * Get items by rarity
 */
export function getTemplatesByRarity(rarity: string): Item[] {
    return templatesByRarity.get(rarity) || [];
}

/**
 * Get items by dominant color
 */
export function getTemplatesByColor(color: string): Item[] {
    return enhancedTemplatesByColor.get(color) || [];
}

/**
 * Check if enhanced templates are loaded
 */
export function areEnhancedTemplatesLoaded(): boolean {
    return enhancedTemplatesLoaded;
}

/**
 * Load a single template item with enhanced color analysis
 */
async function loadTemplateItem(item: Item): Promise<void> {
    if (!item.image) return;

    const imagePath = item.image.replace('.png', '.webp');

    const loadFromImage = (img: HTMLImageElement): void => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (!ctx) {
            throw new Error('Failed to get canvas context');
        }

        ctx.drawImage(img, 0, 0);

        // Extract enhanced color information
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const colorProfile = extractColorProfile(imageData);

        // Calculate average HSV
        let sumH = 0,
            sumS = 0,
            sumV = 0,
            count = 0;
        for (let i = 0; i < imageData.data.length; i += 16) {
            const hsv = rgbToHSV(imageData.data[i] ?? 0, imageData.data[i + 1] ?? 0, imageData.data[i + 2] ?? 0);
            sumH += hsv.h;
            sumS += hsv.s;
            sumV += hsv.v;
            count++;
        }

        const avgHSV: HSVColor = {
            h: sumH / count,
            s: sumS / count,
            v: sumV / count,
        };

        enhancedTemplates.set(item.id, {
            image: img,
            canvas,
            ctx,
            width: img.width,
            height: img.height,
            colorProfile,
            hsvColor: avgHSV,
            rarity: item.rarity,
        });

        // Group by rarity
        let rarityArray = templatesByRarity.get(item.rarity);
        if (!rarityArray) {
            rarityArray = [];
            templatesByRarity.set(item.rarity, rarityArray);
        }
        rarityArray.push(item);

        // Group by dominant color
        let colorArray = enhancedTemplatesByColor.get(colorProfile.dominant);
        if (!colorArray) {
            colorArray = [];
            enhancedTemplatesByColor.set(colorProfile.dominant, colorArray);
        }
        colorArray.push(item);
    };

    await new Promise<void>((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
            loadFromImage(img);
            resolve();
        };

        img.onerror = () => {
            // Try PNG fallback
            const pngImg = new Image();
            pngImg.onload = () => {
                loadFromImage(pngImg);
                resolve();
            };
            pngImg.onerror = () => reject(new Error(`Failed to load: ${item.image ?? 'unknown'}`));
            pngImg.src = item.image ?? '';
        };

        img.src = imagePath;
    });
}

/**
 * Load templates with enhanced color analysis
 */
export async function loadEnhancedTemplates(): Promise<void> {
    if (enhancedTemplatesLoaded) return;

    const gameData = getAllData();
    const items = gameData.items?.items || [];

    logger.info({
        operation: 'cv_enhanced.load_templates',
        data: { phase: 'start', totalItems: items.length },
    });

    // Load all items with enhanced analysis
    const loadPromises = items.map(async item => {
        try {
            await loadTemplateItem(item);
        } catch (error) {
            logger.error({
                operation: 'cv_enhanced.load_template',
                error: {
                    name: (error as Error).name,
                    message: `${(error as Error).message} (item: ${item.id})`,
                },
            });
        }
    });

    await Promise.all(loadPromises);

    enhancedTemplatesLoaded = true;

    logger.info({
        operation: 'cv_enhanced.load_templates',
        data: {
            phase: 'complete',
            total: enhancedTemplates.size,
            byRarity: Object.fromEntries(
                Array.from(templatesByRarity.entries()).map(([k, v]: [string, Item[]]) => [k, v.length])
            ),
            byColor: Object.fromEntries(
                Array.from(enhancedTemplatesByColor.entries()).map(([k, v]: [string, Item[]]) => [k, v.length])
            ),
        },
    });
}

/**
 * Reset enhanced CV state (for data refresh)
 * Clears all loaded templates and resets loading state
 */
export function resetEnhancedTemplates(): void {
    enhancedTemplates.clear();
    templatesByRarity.clear();
    enhancedTemplatesByColor.clear();
    enhancedTemplatesLoaded = false;

    logger.info({
        operation: 'cv_enhanced.reset',
        data: { message: 'Enhanced CV state cleared' },
    });
}
