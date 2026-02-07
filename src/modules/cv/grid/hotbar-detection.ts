// ========================================
// Hotbar Region Detection
// ========================================

import { calculateColorVariance, countRarityBorderPixels } from '../color.ts';
import type { HotbarRegion } from './grid-types.ts';

/**
 * Enhanced hotbar region detection using rarity border analysis
 * Returns the Y coordinates of the detected hotbar band
 */
export function detectHotbarRegion(ctx: CanvasRenderingContext2D, width: number, height: number): HotbarRegion {
    // Scan bottom 35% of screen (hotbar is at very bottom)
    const scanStartY = Math.floor(height * 0.65);
    const scanEndY = height - 5;

    // Sample center 70% of width (hotbar is centered)
    const sampleStartX = Math.floor(width * 0.15);
    const sampleWidth = Math.floor(width * 0.7);

    // Analyze horizontal strips
    const stripHeight = 2;
    const strips: Array<{
        y: number;
        rarityRatio: number;
        colorfulRatio: number;
        variance: number;
    }> = [];

    for (let y = scanStartY; y < scanEndY; y += stripHeight) {
        const imageData = ctx.getImageData(sampleStartX, y, sampleWidth, stripHeight);
        const stats = countRarityBorderPixels(imageData);
        const variance = calculateColorVariance(imageData);

        strips.push({
            y,
            rarityRatio: stats.rarityCount / stats.total,
            colorfulRatio: stats.colorfulCount / stats.total,
            variance,
        });
    }

    // Find the best hotbar band using sliding window
    const windowSize = 35; // ~70px window
    let bestScore = 0;
    let bestBandStart = scanStartY;
    let bestBandEnd = scanEndY;

    for (let i = 0; i < strips.length - windowSize; i++) {
        const windowSlice = strips.slice(i, i + windowSize);

        const avgRarityRatio = windowSlice.reduce((s, d) => s + d.rarityRatio, 0) / windowSlice.length;
        const avgColorful = windowSlice.reduce((s, d) => s + d.colorfulRatio, 0) / windowSlice.length;
        const avgVariance = windowSlice.reduce((s, d) => s + d.variance, 0) / windowSlice.length;

        let score = 0;

        // Rarity borders are a strong signal
        if (avgRarityRatio > 0.01) {
            score += avgRarityRatio * 200;
        }

        // Colorful pixels indicate icons
        if (avgColorful > 0.03) {
            score += avgColorful * 80;
        }

        // High variance means varied content (icons)
        if (avgVariance > 200) {
            score += Math.min(30, avgVariance / 50);
        }

        // Prefer lower on screen (hotbar is at very bottom)
        const firstStrip = windowSlice[0];
        const lastStrip = windowSlice[windowSlice.length - 1];
        if (!firstStrip || !lastStrip) continue;

        const yPosition = firstStrip.y / height;
        if (yPosition > 0.88) {
            score += 30;
        } else if (yPosition > 0.82) {
            score += 15;
        }

        if (score > bestScore) {
            bestScore = score;
            bestBandStart = firstStrip.y;
            bestBandEnd = lastStrip.y + stripHeight;
        }
    }

    // Constrain band height
    const maxBandHeight = Math.floor(height * 0.15);
    const minBandHeight = Math.floor(height * 0.05);

    if (bestBandEnd - bestBandStart > maxBandHeight) {
        bestBandStart = bestBandEnd - maxBandHeight;
    }
    if (bestBandEnd - bestBandStart < minBandHeight) {
        bestBandStart = bestBandEnd - minBandHeight;
    }

    // Fallback if nothing detected
    if (bestScore < 10) {
        bestBandStart = Math.floor(height * 0.85);
        bestBandEnd = height - 5;
    }

    return {
        topY: bestBandStart,
        bottomY: bestBandEnd,
        confidence: Math.min(1, bestScore / 100),
    };
}
