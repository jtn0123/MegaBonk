// ========================================
// Icon Edge Detection
// ========================================

import { detectRarityAtPixel } from '../color.ts';

/**
 * Detect vertical edges (icon borders) using rarity colors
 * Returns X positions of detected edges
 */
export function detectIconEdges(
    ctx: CanvasRenderingContext2D,
    width: number,
    bandRegion: { topY: number; bottomY: number }
): number[] {
    const { topY, bottomY } = bandRegion;
    const bandHeight = bottomY - topY;

    // Only scan center 70% of width
    const scanStartX = Math.floor(width * 0.15);
    const scanEndX = Math.floor(width * 0.85);

    // Scan multiple horizontal lines within the band
    const scanYOffsets = [0.1, 0.25, 0.5, 0.75, 0.9];
    const edgeCounts = new Map<number, number>();

    for (const yOffset of scanYOffsets) {
        const scanY = Math.floor(topY + bandHeight * yOffset);
        if (scanY >= ctx.canvas.height) continue;

        const lineData = ctx.getImageData(scanStartX, scanY, scanEndX - scanStartX, 1);
        const pixels = lineData.data;

        let inBorder = false;
        let borderStart = -1;

        for (let localX = 0; localX < scanEndX - scanStartX; localX++) {
            const x = localX + scanStartX;
            const idx = localX * 4;
            const r = pixels[idx] ?? 0;
            const g = pixels[idx + 1] ?? 0;
            const b = pixels[idx + 2] ?? 0;

            const rarity = detectRarityAtPixel(r, g, b);

            if (rarity && !inBorder) {
                inBorder = true;
                borderStart = x;
            } else if (!rarity && inBorder) {
                const borderWidth = x - borderStart;

                // Valid borders are 2-8 pixels wide
                if (borderWidth >= 2 && borderWidth <= 8) {
                    // Record edge at start of border
                    const bucket = Math.round(borderStart / 4) * 4; // 4px tolerance
                    edgeCounts.set(bucket, (edgeCounts.get(bucket) || 0) + 1);
                }

                inBorder = false;
            }
        }
    }

    // Filter to edges detected in multiple scan lines
    const consistentEdges: number[] = [];
    for (const [x, count] of edgeCounts) {
        if (count >= 2) {
            consistentEdges.push(x);
        }
    }

    // Sort by X position
    consistentEdges.sort((a, b) => a - b);

    // Filter by spacing consistency
    return filterByConsistentSpacing(consistentEdges);
}

/**
 * Filter edges to keep only those with consistent spacing
 */
export function filterByConsistentSpacing(edges: number[]): number[] {
    if (edges.length < 3) return edges;

    // Calculate gaps
    const gaps: Array<{ gap: number; fromIdx: number; toIdx: number }> = [];
    for (let i = 1; i < edges.length; i++) {
        const current = edges[i];
        const previous = edges[i - 1];
        if (current === undefined || previous === undefined) continue;

        const gap = current - previous;
        if (gap > 20 && gap < 120) {
            gaps.push({ gap, fromIdx: i - 1, toIdx: i });
        }
    }

    if (gaps.length < 2) return edges;

    // Find mode gap (most common spacing)
    const gapCounts = new Map<number, number>();
    const tolerance = 4;

    for (const { gap } of gaps) {
        const bucket = Math.round(gap / tolerance) * tolerance;
        gapCounts.set(bucket, (gapCounts.get(bucket) || 0) + 1);
    }

    let modeGap = 0;
    let modeCount = 0;
    for (const [bucket, count] of gapCounts) {
        if (count > modeCount) {
            modeCount = count;
            modeGap = bucket;
        }
    }

    if (modeCount < 2) return edges;

    // Keep edges that fit the mode spacing
    const consistentIndices = new Set<number>();
    for (const { gap, fromIdx, toIdx } of gaps) {
        if (Math.abs(gap - modeGap) <= tolerance) {
            consistentIndices.add(fromIdx);
            consistentIndices.add(toIdx);
        }
    }

    return edges.filter((_, idx) => consistentIndices.has(idx));
}
