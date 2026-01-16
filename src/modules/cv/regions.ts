// ========================================
// CV UI Region Detection
// ========================================

import { logger } from '../logger.ts';
import { detectResolution, detectUILayout } from '../test-utils.ts';
import type { ROI } from './types.ts';

// ========================================
// Screen Type Detection
// ========================================

/**
 * Detect if screenshot shows pause menu or gameplay by analyzing bottom hotbar region
 * Gameplay has colorful icons at bottom, pause menu has empty/dark bottom
 */
export function detectScreenType(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
): 'pause_menu' | 'gameplay' {
    // Sample bottom 20% of screen (where hotbar is during gameplay)
    const hotbarY = Math.floor(height * 0.8);
    const hotbarHeight = height - hotbarY;
    const imageData = ctx.getImageData(0, hotbarY, width, hotbarHeight);
    const pixels = imageData.data;

    // Calculate brightness and color variance
    let totalBrightness = 0;
    let totalVariance = 0;
    let sampleCount = 0;

    // Sample every 10th pixel for performance
    for (let i = 0; i < pixels.length; i += 40) {
        // 40 = 10 pixels * 4 channels (RGBA)
        const r = pixels[i] ?? 0;
        const g = pixels[i + 1] ?? 0;
        const b = pixels[i + 2] ?? 0;
        const a = pixels[i + 3] ?? 0;

        // Skip transparent pixels
        if (a < 128) continue;

        // Brightness (0-255)
        const brightness = (r + g + b) / 3;
        totalBrightness += brightness;

        // Color variance (how different are R, G, B from each other)
        const mean = brightness;
        const variance = Math.pow(r - mean, 2) + Math.pow(g - mean, 2) + Math.pow(b - mean, 2);
        totalVariance += variance;

        sampleCount++;
    }

    if (sampleCount === 0) {
        // No pixels sampled, assume pause menu (fully transparent bottom)
        return 'pause_menu';
    }

    const avgBrightness = totalBrightness / sampleCount;
    const avgVariance = totalVariance / sampleCount;

    // Thresholds:
    // - Gameplay: Bright colorful icons (brightness > 80, variance > 1000)
    // - Pause menu: Dark or uniform bottom (brightness < 60 or variance < 800)
    const isGameplay = avgBrightness > 70 && avgVariance > 900;

    logger.info({
        operation: 'cv.detect_screen_type',
        data: {
            avgBrightness: Math.round(avgBrightness),
            avgVariance: Math.round(avgVariance),
            sampleCount,
            screenType: isGameplay ? 'gameplay' : 'pause_menu',
        },
    });

    return isGameplay ? 'gameplay' : 'pause_menu';
}

// ========================================
// UI Region Detection
// ========================================

/**
 * Detect UI regions (for finding inventory, stats, etc.)
 * Adapts to different UI layouts (PC vs Steam Deck)
 *
 * @param ctxOrWidth - Canvas context for screen type detection, or width if called without context
 * @param widthOrHeight - Width if ctx provided, or height if called without context
 * @param height - Height (only used when ctx is provided)
 */
export function detectUIRegions(
    ctxOrWidth: CanvasRenderingContext2D | number,
    widthOrHeight: number,
    height?: number
): { inventory?: ROI; stats?: ROI; character?: ROI; pauseMenu?: ROI; gameplay?: ROI } {
    // Handle both signatures: detectUIRegions(ctx, width, height) or detectUIRegions(width, height)
    let ctx: CanvasRenderingContext2D | null = null;
    let width: number;
    let actualHeight: number;

    if (typeof ctxOrWidth === 'number') {
        // Called as detectUIRegions(width, height)
        width = ctxOrWidth;
        actualHeight = widthOrHeight;
    } else {
        // Called as detectUIRegions(ctx, width, height)
        ctx = ctxOrWidth;
        width = widthOrHeight;
        actualHeight = height!;
    }

    const resolution = detectResolution(width, actualHeight);
    const uiLayout = detectUILayout(width, actualHeight);

    // Detect if this is pause menu or gameplay by analyzing bottom hotbar region
    // If no context provided, default to pause_menu for backwards compatibility
    const screenType = ctx ? detectScreenType(ctx, width, actualHeight) : 'pause_menu';

    logger.info({
        operation: 'cv.detect_ui_regions',
        data: {
            width,
            height: actualHeight,
            uiLayout,
            resolution: resolution.category,
            screenType,
            hasContext: ctx !== null,
        },
    });

    if (screenType === 'pause_menu') {
        return detectPauseMenuRegions(width, actualHeight, uiLayout);
    } else {
        return detectGameplayRegions(width, actualHeight, uiLayout);
    }
}

/**
 * Detect regions for pause menu layout
 */
function detectPauseMenuRegions(
    width: number,
    height: number,
    uiLayout: 'pc' | 'steam_deck' | 'unknown'
): { inventory?: ROI; stats?: ROI; character?: ROI; pauseMenu?: ROI } {
    if (uiLayout === 'steam_deck') {
        // Steam Deck: More compact layout
        return {
            pauseMenu: {
                x: Math.floor(width * 0.15),
                y: Math.floor(height * 0.15),
                width: Math.floor(width * 0.7),
                height: Math.floor(height * 0.7),
                label: 'pause_menu',
            },
            stats: {
                x: Math.floor(width * 0.2),
                y: Math.floor(height * 0.15),
                width: Math.floor(width * 0.6),
                height: Math.floor(height * 0.2),
                label: 'stats',
            },
            inventory: {
                x: Math.floor(width * 0.2),
                y: Math.floor(height * 0.4),
                width: Math.floor(width * 0.6),
                height: Math.floor(height * 0.45),
                label: 'inventory',
            },
        };
    } else {
        // PC: Standard layout
        return {
            pauseMenu: {
                x: Math.floor(width * 0.15),
                y: Math.floor(height * 0.1),
                width: Math.floor(width * 0.7),
                height: Math.floor(height * 0.8),
                label: 'pause_menu',
            },
            stats: {
                x: Math.floor(width * 0.25),
                y: Math.floor(height * 0.15),
                width: Math.floor(width * 0.5),
                height: Math.floor(height * 0.2),
                label: 'stats',
            },
            inventory: {
                x: Math.floor(width * 0.25),
                y: Math.floor(height * 0.4),
                width: Math.floor(width * 0.5),
                height: Math.floor(height * 0.5),
                label: 'inventory',
            },
        };
    }
}

/**
 * Detect regions for gameplay layout
 */
function detectGameplayRegions(
    width: number,
    height: number,
    _uiLayout: 'pc' | 'steam_deck' | 'unknown'
): { stats?: ROI; character?: ROI; gameplay?: ROI } {
    return {
        gameplay: {
            x: 0,
            y: 0,
            width,
            height,
            label: 'gameplay',
        },
        stats: {
            x: Math.floor(width * 0.02),
            y: Math.floor(height * 0.02),
            width: Math.floor(width * 0.15),
            height: Math.floor(height * 0.12),
            label: 'stats',
        },
        character: {
            x: Math.floor(width * 0.02),
            y: Math.floor(height * 0.2),
            width: Math.floor(width * 0.15),
            height: Math.floor(height * 0.4),
            label: 'character',
        },
    };
}
