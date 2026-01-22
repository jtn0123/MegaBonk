// ========================================
// CV Auto-Grid Detection
// Dynamic edge detection + multi-pass refinement
// Self-calibrating grid detection for any resolution
// Ported from cv-validator/js/auto-grid-detection.js
// ========================================

import { rgbToHsl, matchesRarityColor, detectRarityAtPixel } from './color.ts';

// ========================================
// Types and Interfaces
// ========================================

/**
 * Configuration for auto-grid detection
 */
export interface AutoGridConfig {
    /** Base resolution for calibration (default: 720) */
    baseResolution: number;
    /** Maximum rows to detect in hotbar (default: 2) */
    maxDetectedRows: number;
    /** Default calibration values */
    defaultCalibration: GridCalibration;
}

/**
 * Grid calibration parameters (base resolution values)
 */
export interface GridCalibration {
    xOffset: number;
    yOffset: number;
    iconWidth: number;
    iconHeight: number;
    xSpacing: number;
    ySpacing: number;
    iconsPerRow: number;
    numRows: number;
    totalItems?: number;
}

/**
 * Band region where hotbar is located
 */
export interface BandRegion {
    topY: number;
    bottomY: number;
    height: number;
    confidence: number;
    debug?: {
        stripData: StripData[];
        bestScore: number;
    };
}

/**
 * Strip analysis data for hotbar detection
 */
interface StripData {
    y: number;
    avgBrightness: number;
    avgVariance: number;
    colorfulRatio: number;
    rarityRatio: number;
}

/**
 * Detected cell edge
 */
export interface CellEdge {
    x: number;
    borderWidth: number;
    rarity: string;
    confidence: number;
    detections: number;
    verticalConsistency: number;
}

/**
 * Raw edge detection from a scan line
 */
interface RawEdge {
    x: number;
    endX: number;
    y: number;
    width: number;
    rarity: string;
    type: 'left';
}

/**
 * Border detection result
 */
export interface BorderResult {
    edges: CellEdge[];
    allEdges: RawEdge[];
    colorCounts: Record<string, number>;
    dominantColors: string[];
}

/**
 * Icon metrics calculated from detected edges
 */
export interface IconMetrics {
    iconWidth: number;
    iconHeight: number;
    xSpacing: number;
    ySpacing: number;
    cellStride: number;
    borderWidth: number;
    confidence: number;
    detectedCells: number;
    firstCellX: number | null;
    centerOffset: number;
    isDefault?: boolean;
    debug?: {
        gaps: number[];
        gapMode: number;
    };
}

/**
 * Grid cell position
 */
export interface GridPosition {
    x: number;
    y: number;
    width: number;
    height: number;
    row: number;
    col: number;
    slotIndex: number;
}

/**
 * Grid building result
 */
export interface GridResult {
    positions: GridPosition[];
    calibration: GridCalibration;
    debug: {
        startX: number;
        firstRowY: number;
        cellStride: number;
        scale: number;
    };
}

/**
 * Cell validation result
 */
export interface CellValidation {
    isEmpty: boolean;
    isSuspicious: boolean;
    meanBrightness: number;
    totalVariance: number;
    colorfulRatio: number;
}

/**
 * Validated cell with position
 */
export interface ValidatedCell extends GridPosition {
    validation: CellValidation;
}

/**
 * Grid validation result
 */
export interface ValidationResult {
    validCells: ValidatedCell[];
    emptyCells: ValidatedCell[];
    suspiciousCells: ValidatedCell[];
    totalCells: number;
    confidence: number;
    stats: {
        valid: number;
        empty: number;
        suspicious: number;
    };
    failureReasons?: string[];
}

/**
 * Failure reason codes for auto-detection
 */
export type FailureReason =
    | 'icons_too_small'
    | 'likely_empty_screen'
    | 'inconsistent_detection'
    | 'no_vertical_clusters'
    | 'exception_thrown';

/**
 * Complete auto-detection result
 */
export interface AutoDetectionResult {
    success: boolean;
    bandRegion?: BandRegion;
    borders?: BorderResult;
    metrics?: IconMetrics;
    grid?: GridResult;
    validation?: ValidationResult;
    calibration: GridCalibration | null;
    elapsed?: number;
    confidence?: number;
    reasons?: FailureReason[] | null;
    error?: string;
}

/**
 * Preset comparison result
 */
export interface PresetComparison {
    [field: string]: {
        auto: number;
        preset: number;
        diff: number;
        isClose: boolean;
    };
    matchScore: number;
    totalDiff: number;
    recommendation: string;
}

/**
 * Progress callback for tracking detection stages
 */
export type ProgressCallback = (percent: number, message: string) => void;

// ========================================
// Default Configuration
// ========================================

const DEFAULT_CONFIG: AutoGridConfig = {
    baseResolution: 720,
    maxDetectedRows: 2,
    defaultCalibration: {
        xOffset: 0,
        yOffset: 0,
        iconWidth: 40,
        iconHeight: 40,
        xSpacing: 4,
        ySpacing: 4,
        iconsPerRow: 20,
        numRows: 3,
        totalItems: 60,
    },
};

// Module-level config that can be overridden
let config: AutoGridConfig = { ...DEFAULT_CONFIG };

/**
 * Set custom configuration
 */
export function setConfig(customConfig: Partial<AutoGridConfig>): void {
    config = { ...config, ...customConfig };
}

/**
 * Get current configuration
 */
export function getConfig(): AutoGridConfig {
    return { ...config };
}

// ========================================
// Pass 1: Hotbar Band Detection
// ========================================

/**
 * Detect the hotbar band region at the bottom of the screen
 * Returns the Y coordinates where the item bar exists
 */
export function detectHotbarBand(ctx: CanvasRenderingContext2D, width: number, height: number): BandRegion {
    // Scan bottom 30% of screen (hotbar is usually at very bottom)
    const scanStartY = Math.floor(height * 0.7);

    // Only sample center 70% of width (where hotbar items are, avoiding UI edges)
    const sampleStartX = Math.floor(width * 0.15);
    const sampleWidth = Math.floor(width * 0.7);

    // Analyze horizontal strips
    const stripData: StripData[] = [];
    const stripHeight = 2; // Sample every 2 pixels for speed

    for (let y = scanStartY; y < height - stripHeight; y += stripHeight) {
        const imageData = ctx.getImageData(sampleStartX, y, sampleWidth, stripHeight);
        const pixels = imageData.data;

        let totalBrightness = 0;
        let totalVariance = 0;
        let colorfulPixels = 0;
        let rarityBorderPixels = 0;
        let count = 0;

        // Sample across the strip
        for (let i = 0; i < pixels.length; i += 16) {
            // Sample every 4th pixel
            const r = pixels[i] ?? 0;
            const g = pixels[i + 1] ?? 0;
            const b = pixels[i + 2] ?? 0;

            const brightness = (r + g + b) / 3;
            totalBrightness += brightness;

            // Color variance (how different are RGB channels)
            const mean = brightness;
            const variance = Math.pow(r - mean, 2) + Math.pow(g - mean, 2) + Math.pow(b - mean, 2);
            totalVariance += variance;

            // Count colorful pixels (potential rarity borders)
            const saturation = Math.max(r, g, b) - Math.min(r, g, b);
            if (saturation > 50) colorfulPixels++;

            // Count actual rarity border color matches (more specific)
            if (detectRarityAtPixel(r, g, b)) {
                rarityBorderPixels++;
            }

            count++;
        }

        stripData.push({
            y,
            avgBrightness: totalBrightness / count,
            avgVariance: totalVariance / count,
            colorfulRatio: colorfulPixels / count,
            rarityRatio: rarityBorderPixels / count,
        });
    }

    // Find the hotbar band by looking for:
    // 1. Region with moderate brightness (not too dark, not too bright)
    // 2. Higher color variance (icons are colorful)
    // 3. Some colorful pixels (rarity borders)

    let bestBandStart = -1;
    let bestBandEnd = height;
    let bestScore = 0;

    // Window size: 35 strips × 2px = ~70px to capture full icon height
    const windowSize = 35;

    for (let i = 0; i < stripData.length - windowSize; i++) {
        const windowSlice = stripData.slice(i, i + windowSize);

        const avgBrightness = windowSlice.reduce((s, d) => s + d.avgBrightness, 0) / windowSlice.length;
        const avgVariance = windowSlice.reduce((s, d) => s + d.avgVariance, 0) / windowSlice.length;
        const avgColorful = windowSlice.reduce((s, d) => s + d.colorfulRatio, 0) / windowSlice.length;
        const avgRarity = windowSlice.reduce((s, d) => s + d.rarityRatio, 0) / windowSlice.length;

        // Score: prefer moderate brightness, high variance, rarity borders present
        let score = 0;

        // Moderate brightness indicates UI panel area (25-160 range)
        if (avgBrightness >= 25 && avgBrightness <= 160) {
            score += 25;
        }

        // High variance means colorful icons (>200 threshold)
        if (avgVariance > 200) {
            score += Math.min(35, avgVariance / 40);
        }

        // Colorful pixels
        if (avgColorful > 0.03) {
            score += avgColorful * 80;
        }

        // BONUS: Rarity border colors detected (strong signal, >1% threshold)
        if (avgRarity > 0.01) {
            score += avgRarity * 150;
        }

        // Prefer lower on screen (hotbar is at very bottom)
        const yPosition = windowSlice[0].y / height;
        if (yPosition > 0.88) {
            score += 25;
        } else if (yPosition > 0.82) {
            score += 15;
        }

        if (score > bestScore) {
            bestScore = score;
            bestBandStart = windowSlice[0].y;
            bestBandEnd = windowSlice[windowSlice.length - 1].y + stripHeight;
        }
    }

    // Fallback if no band found
    if (bestBandStart === -1) {
        bestBandStart = Math.floor(height * 0.88);
        bestBandEnd = height - 5;
    }

    // Constrain band height - hotbar is typically 1-2 icon rows (~60-120px at 1080p)
    // Max band height is ~12% of screen height (covers 2 full icon rows with margin)
    const maxBandHeight = Math.floor(height * 0.12);
    const minBandHeight = Math.floor(height * 0.06); // ~43px at 720p, ~65px at 1080p

    // If band is too tall, constrain it to reasonable size
    const currentHeight = bestBandEnd - bestBandStart;
    if (currentHeight > maxBandHeight) {
        // Keep the bottom of the band (where hotbar is) and move top down
        bestBandStart = bestBandEnd - maxBandHeight;
    }

    if (bestBandEnd - bestBandStart < minBandHeight) {
        bestBandStart = bestBandEnd - minBandHeight;
    }

    return {
        topY: bestBandStart,
        bottomY: bestBandEnd,
        height: bestBandEnd - bestBandStart,
        confidence: Math.min(1, bestScore / 100),
        debug: { stripData, bestScore },
    };
}

// ========================================
// Pass 2: Rarity Border Detection
// ========================================

/**
 * Detect item cell edges by finding rarity border colors
 */
export function detectRarityBorders(
    ctx: CanvasRenderingContext2D,
    width: number,
    bandRegion: BandRegion
): BorderResult {
    const { topY, bottomY } = bandRegion;
    const bandHeight = bottomY - topY;

    // RESTRICT: Only scan center 70% of width (hotbar is centered, avoid UI edges)
    const scanStartX = Math.floor(width * 0.15);
    const scanEndX = Math.floor(width * 0.85);

    // Scan multiple horizontal lines within the band
    const scanLines = [
        topY + Math.floor(bandHeight * 0.05), // Very top edge of icons
        topY + Math.floor(bandHeight * 0.15), // Top of icons
        topY + Math.floor(bandHeight * 0.3), // Upper middle
        topY + Math.floor(bandHeight * 0.5), // Middle
        topY + Math.floor(bandHeight * 0.7), // Lower middle
        topY + Math.floor(bandHeight * 0.85), // Bottom of icons
        topY + Math.floor(bandHeight * 0.95), // Very bottom edge
    ];

    // Collect all detected edges across scan lines
    const allEdges: RawEdge[] = [];
    const colorCounts: Record<string, number> = {};

    for (const scanY of scanLines) {
        if (scanY >= ctx.canvas.height) continue;

        const lineData = ctx.getImageData(scanStartX, scanY, scanEndX - scanStartX, 1);
        const pixels = lineData.data;

        let inBorder = false;
        let borderStart = -1;
        let currentRarity: string | null = null;

        for (let localX = 0; localX < scanEndX - scanStartX; localX++) {
            const x = localX + scanStartX; // Convert to absolute X
            const idx = localX * 4;
            const r = pixels[idx] ?? 0;
            const g = pixels[idx + 1] ?? 0;
            const b = pixels[idx + 2] ?? 0;

            const rarity = detectRarityAtPixel(r, g, b);

            if (rarity && !inBorder) {
                // Start of a border
                inBorder = true;
                borderStart = x;
                currentRarity = rarity;
            } else if (!rarity && inBorder) {
                // End of a border
                const borderWidth = x - borderStart;

                // Valid borders are typically 2-8 pixels wide
                if (borderWidth >= 2 && borderWidth <= 8 && currentRarity) {
                    allEdges.push({
                        x: borderStart,
                        endX: x,
                        y: scanY,
                        width: borderWidth,
                        rarity: currentRarity,
                        type: 'left',
                    });

                    colorCounts[currentRarity] = (colorCounts[currentRarity] || 0) + 1;
                }

                inBorder = false;
                currentRarity = null;
            }
        }
    }

    // Cluster edges by X position (edges at same X across different scan lines = same icon)
    let clusteredEdges = clusterEdgesByX(allEdges, 6); // 6px tolerance

    // VERTICAL CONSISTENCY FILTER: True borders appear at multiple Y positions
    clusteredEdges = filterByVerticalConsistency(clusteredEdges, 2);

    // SPACING CONSISTENCY FILTER: Remove edges that don't fit regular spacing pattern
    clusteredEdges = filterBySpacingConsistency(clusteredEdges);

    return {
        edges: clusteredEdges,
        allEdges,
        colorCounts,
        dominantColors: Object.entries(colorCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([color]) => color),
    };
}

/**
 * Cluster detected edges by X position
 */
function clusterEdgesByX(edges: RawEdge[], tolerance: number): CellEdge[] {
    if (edges.length === 0) return [];

    // Sort by X position
    const sorted = [...edges].sort((a, b) => a.x - b.x);

    const clusters: RawEdge[][] = [];
    let currentCluster: RawEdge[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
        const edge = sorted[i];
        const lastEdge = currentCluster[currentCluster.length - 1];

        if (edge.x - lastEdge.x <= tolerance) {
            // Same cluster
            currentCluster.push(edge);
        } else {
            // New cluster
            clusters.push(currentCluster);
            currentCluster = [edge];
        }
    }

    // Don't forget the last cluster
    if (currentCluster.length > 0) {
        clusters.push(currentCluster);
    }

    return clusters.map(processCluster);
}

/**
 * Process a cluster of edges into a single cell edge
 */
function processCluster(edges: RawEdge[]): CellEdge {
    const avgX = Math.round(edges.reduce((s, e) => s + e.x, 0) / edges.length);
    const avgWidth = Math.round(edges.reduce((s, e) => s + e.width, 0) / edges.length);

    // Most common rarity in cluster
    const rarityCounts: Record<string, number> = {};
    edges.forEach(e => {
        rarityCounts[e.rarity] = (rarityCounts[e.rarity] || 0) + 1;
    });
    const dominantRarity = Object.entries(rarityCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

    // Calculate vertical consistency - true borders appear at multiple Y positions
    const uniqueYs = new Set(edges.map(e => e.y));
    const verticalConsistency = uniqueYs.size;

    return {
        x: avgX,
        borderWidth: avgWidth,
        rarity: dominantRarity,
        confidence: edges.length / 7, // More scan lines = higher confidence
        detections: edges.length,
        verticalConsistency,
    };
}

/**
 * Filter clusters to keep only those with vertical consistency
 * True item borders appear at multiple Y positions, random elements don't
 */
function filterByVerticalConsistency(clusters: CellEdge[], minConsistency: number = 2): CellEdge[] {
    return clusters.filter(c => c.verticalConsistency >= minConsistency);
}

/**
 * Filter edges to keep only those that form consistent spacing patterns
 * This removes random noise from gameplay elements (trees, etc.)
 */
function filterBySpacingConsistency(edges: CellEdge[]): CellEdge[] {
    if (edges.length < 3) {
        return edges;
    }

    // Calculate all gaps between consecutive edges
    const gaps: Array<{ gap: number; fromIdx: number; toIdx: number }> = [];
    for (let i = 1; i < edges.length; i++) {
        const gap = edges[i].x - edges[i - 1].x;
        if (gap > 0 && gap < 150) {
            // Reasonable gap range
            gaps.push({ gap, fromIdx: i - 1, toIdx: i });
        }
    }

    if (gaps.length < 2) {
        return edges;
    }

    // Find dominant gap size (icon stride: iconWidth + spacing)
    // Use histogram approach to find mode
    const gapCounts = new Map<number, number>();
    const tolerance = 4; // Allow ±4px variance

    for (const { gap } of gaps) {
        const bucket = Math.round(gap / tolerance) * tolerance;
        gapCounts.set(bucket, (gapCounts.get(bucket) || 0) + 1);
    }

    // Find the most common gap size
    let modeGap = 0;
    let modeCount = 0;
    for (const [bucket, count] of gapCounts) {
        if (count > modeCount) {
            modeCount = count;
            modeGap = bucket;
        }
    }

    // Require at least 3 consistent spacings to be confident
    if (modeCount < 3) return edges;

    // Keep only edges that participate in consistent-spacing relationships
    const consistentEdgeIndices = new Set<number>();

    for (const { gap, fromIdx, toIdx } of gaps) {
        // Check if this gap matches the mode (within tolerance)
        if (Math.abs(gap - modeGap) <= tolerance) {
            consistentEdgeIndices.add(fromIdx);
            consistentEdgeIndices.add(toIdx);
        }
    }

    // Also check for multiples of the mode (skipped cells due to empty slots)
    for (const { gap, fromIdx, toIdx } of gaps) {
        const multiplier = Math.round(gap / modeGap);
        if (multiplier >= 2 && multiplier <= 4) {
            const expectedGap = modeGap * multiplier;
            if (Math.abs(gap - expectedGap) <= tolerance * multiplier) {
                consistentEdgeIndices.add(fromIdx);
                consistentEdgeIndices.add(toIdx);
            }
        }
    }

    // Filter to consistent edges only
    const filtered = edges.filter((_, idx) => consistentEdgeIndices.has(idx));

    // If we filtered out too many, fall back to original
    if (filtered.length < 3 && edges.length >= 3) {
        return edges;
    }

    return filtered;
}

// ========================================
// Pass 3: Icon Size Calculation
// ========================================

/**
 * Calculate icon dimensions from detected cell edges
 */
export function calculateIconMetrics(cellEdges: CellEdge[], width: number, bandRegion: BandRegion): IconMetrics {
    if (cellEdges.length < 2) {
        return getDefaultMetrics(width, bandRegion);
    }

    // Calculate gaps between consecutive edges (this is icon width + spacing)
    const gaps: number[] = [];
    for (let i = 1; i < cellEdges.length; i++) {
        const gap = cellEdges[i].x - cellEdges[i - 1].x;
        // Filter reasonable gaps (20-100px for icon + spacing)
        if (gap >= 20 && gap <= 100) {
            gaps.push(gap);
        }
    }

    if (gaps.length < 2) {
        return getDefaultMetrics(width, bandRegion);
    }

    // Find the mode (most common gap size) - this is iconWidth + spacing
    const gapMode = findMode(gaps);

    // Average border width from edges
    const avgBorderWidth = Math.round(cellEdges.reduce((s, e) => s + e.borderWidth, 0) / cellEdges.length);

    // Estimate spacing as border width * 1.2 (typical pattern)
    const estimatedSpacing = Math.max(2, Math.min(10, Math.round(avgBorderWidth * 1.2)));

    // Icon width = total gap - spacing
    const iconWidth = gapMode - estimatedSpacing;

    // Icon height: typically equals width for square icons
    const estimatedRowHeight = iconWidth + estimatedSpacing;
    const possibleRows = Math.floor(bandRegion.height / estimatedRowHeight);

    // Icons are typically square, so height should match width
    const maxIconHeight = possibleRows >= 1 ? iconWidth : bandRegion.height - 10;
    const iconHeight = Math.min(iconWidth, Math.max(iconWidth, maxIconHeight));

    // Calculate how many icons fit
    const totalGridWidth = cellEdges.length * gapMode;
    const startX = cellEdges[0].x;
    const centerOffset = Math.round((width - totalGridWidth) / 2) - startX;

    return {
        iconWidth: Math.round(iconWidth),
        iconHeight: Math.round(iconHeight),
        xSpacing: estimatedSpacing,
        ySpacing: estimatedSpacing,
        cellStride: gapMode,
        borderWidth: avgBorderWidth,
        confidence: gaps.length / (cellEdges.length - 1),
        detectedCells: cellEdges.length,
        firstCellX: cellEdges[0].x,
        centerOffset,
        debug: { gaps, gapMode },
    };
}

/**
 * Find the mode (most common value) with tolerance
 */
function findMode(values: number[], tolerance: number = 2): number {
    const counts = new Map<number, number>();

    for (const val of values) {
        // Round to nearest multiple of tolerance
        const bucket = Math.round(val / tolerance) * tolerance;
        counts.set(bucket, (counts.get(bucket) || 0) + 1);
    }

    let maxCount = 0;
    let mode = values[0];

    for (const [value, count] of counts) {
        if (count > maxCount) {
            maxCount = count;
            mode = value;
        }
    }

    return mode;
}

/**
 * Get default metrics based on resolution
 */
function getDefaultMetrics(width: number, bandRegion: BandRegion): IconMetrics {
    const height = bandRegion.bottomY;
    const scale = height / config.baseResolution;

    return {
        iconWidth: Math.round(config.defaultCalibration.iconWidth * scale),
        iconHeight: Math.round(config.defaultCalibration.iconHeight * scale),
        xSpacing: Math.round(config.defaultCalibration.xSpacing * scale),
        ySpacing: Math.round(config.defaultCalibration.ySpacing * scale),
        cellStride: Math.round((config.defaultCalibration.iconWidth + config.defaultCalibration.xSpacing) * scale),
        borderWidth: 3,
        confidence: 0,
        detectedCells: 0,
        firstCellX: null,
        centerOffset: 0,
        isDefault: true,
    };
}

// ========================================
// Pass 4: Build Precise Grid
// ========================================

/**
 * Build the final grid positions from detected metrics
 */
export function buildPreciseGrid(
    metrics: IconMetrics,
    bandRegion: BandRegion,
    width: number,
    height: number,
    cellEdges: CellEdge[]
): GridResult {
    const positions: GridPosition[] = [];
    const { iconWidth, iconHeight, xSpacing, ySpacing, cellStride } = metrics;

    // Calculate Y positions for rows
    const rowHeight = iconHeight + ySpacing;
    const bandHeight = bandRegion.bottomY - bandRegion.topY;

    // How many rows can fit?
    const possibleRows = Math.floor(bandHeight / rowHeight);
    const maxRows = config.maxDetectedRows;
    const numRows = Math.min(possibleRows, maxRows);

    // Y offset: position first row near bottom of band
    const bottomMargin = 5;
    const firstRowY = bandRegion.bottomY - iconHeight - bottomMargin;

    // X positioning: use detected edges if available, otherwise center
    let startX: number;
    let iconsPerRow: number;

    if (cellEdges && cellEdges.length >= 2 && metrics.firstCellX !== null) {
        // Use detected first cell position
        startX = metrics.firstCellX;
        iconsPerRow = cellEdges.length;
    } else {
        // Calculate centered grid
        iconsPerRow = Math.floor((width - 100) / cellStride); // 50px margin each side
        const totalGridWidth = iconsPerRow * cellStride - xSpacing;
        startX = Math.round((width - totalGridWidth) / 2);
    }

    // Build grid positions
    for (let row = 0; row < numRows; row++) {
        const rowY = firstRowY - row * rowHeight;

        // Don't place rows too high up
        if (rowY < height * 0.7) break;

        for (let col = 0; col < iconsPerRow; col++) {
            const cellX = startX + col * cellStride;

            // Skip if outside screen bounds
            if (cellX < 0 || cellX + iconWidth > width) continue;

            positions.push({
                x: cellX,
                y: rowY,
                width: iconWidth,
                height: iconHeight,
                row,
                col,
                slotIndex: positions.length,
            });
        }
    }

    // Convert to calibration format (base 720p values)
    const scale = height / config.baseResolution;
    const calibration: GridCalibration = {
        xOffset: Math.round((startX - (width - iconsPerRow * cellStride) / 2) / scale),
        yOffset: Math.round(100 - (height - firstRowY - iconHeight) / scale),
        iconWidth: Math.round(iconWidth / scale),
        iconHeight: Math.round(iconHeight / scale),
        xSpacing: Math.round(xSpacing / scale),
        ySpacing: Math.round(ySpacing / scale),
        iconsPerRow,
        numRows,
        totalItems: positions.length,
    };

    return {
        positions,
        calibration,
        debug: {
            startX,
            firstRowY,
            cellStride,
            scale,
        },
    };
}

// ========================================
// Pass 5: Validate Grid
// ========================================

/**
 * Validate detected grid positions by checking cell contents
 */
export function validateGrid(ctx: CanvasRenderingContext2D, positions: GridPosition[]): ValidationResult {
    const validCells: ValidatedCell[] = [];
    const emptyCells: ValidatedCell[] = [];
    const suspiciousCells: ValidatedCell[] = [];

    for (const cell of positions) {
        const cellData = ctx.getImageData(cell.x, cell.y, cell.width, cell.height);
        const validation = validateCell(cellData);

        if (validation.isEmpty) {
            emptyCells.push({ ...cell, validation });
        } else if (validation.isSuspicious) {
            suspiciousCells.push({ ...cell, validation });
        } else {
            validCells.push({ ...cell, validation });
        }
    }

    // Calculate overall confidence
    const totalCells = positions.length;
    const validRatio = validCells.length / totalCells;
    const emptyRatio = emptyCells.length / totalCells;

    // Good confidence if we have a reasonable number of valid cells
    // and not too many empty cells in the middle
    let confidence = validRatio;
    if (emptyRatio > 0.5) {
        confidence *= 0.5; // Penalize if mostly empty
    }

    return {
        validCells,
        emptyCells,
        suspiciousCells,
        totalCells,
        confidence,
        stats: {
            valid: validCells.length,
            empty: emptyCells.length,
            suspicious: suspiciousCells.length,
        },
    };
}

/**
 * Validate a single cell
 */
function validateCell(imageData: ImageData): CellValidation {
    const pixels = imageData.data;

    let sumR = 0,
        sumG = 0,
        sumB = 0;
    let sumSqR = 0,
        sumSqG = 0,
        sumSqB = 0;
    let colorfulPixels = 0;
    let count = 0;

    // Sample pixels
    for (let i = 0; i < pixels.length; i += 16) {
        const r = pixels[i] ?? 0;
        const g = pixels[i + 1] ?? 0;
        const b = pixels[i + 2] ?? 0;

        sumR += r;
        sumG += g;
        sumB += b;
        sumSqR += r * r;
        sumSqG += g * g;
        sumSqB += b * b;

        // Check for colorful pixels
        const saturation = Math.max(r, g, b) - Math.min(r, g, b);
        if (saturation > 40) colorfulPixels++;

        count++;
    }

    const meanR = sumR / count;
    const meanG = sumG / count;
    const meanB = sumB / count;
    const meanBrightness = (meanR + meanG + meanB) / 3;

    const varianceR = sumSqR / count - meanR * meanR;
    const varianceG = sumSqG / count - meanG * meanG;
    const varianceB = sumSqB / count - meanB * meanB;
    const totalVariance = varianceR + varianceG + varianceB;

    const colorfulRatio = colorfulPixels / count;

    // Determine cell status
    // Variance <400 or brightness <30 = likely empty
    const isEmpty = totalVariance < 400 || meanBrightness < 30;
    // Variance <600 and colorful ratio <0.1 = suspicious
    const isSuspicious = totalVariance < 600 && colorfulRatio < 0.1;

    return {
        isEmpty,
        isSuspicious,
        meanBrightness,
        totalVariance,
        colorfulRatio,
    };
}

// ========================================
// Main Auto-Detection Function
// ========================================

/**
 * Run full auto-detection pipeline
 */
export async function autoDetectGrid(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    options: { progressCallback?: ProgressCallback } = {}
): Promise<AutoDetectionResult> {
    const startTime = Date.now();
    const { progressCallback } = options;

    try {
        // Pass 1: Detect hotbar band
        if (progressCallback) progressCallback(10, 'Detecting hotbar region...');
        const bandRegion = detectHotbarBand(ctx, width, height);

        // Pass 2: Detect rarity borders
        if (progressCallback) progressCallback(30, 'Finding item borders...');
        const borderResult = detectRarityBorders(ctx, width, bandRegion);

        // Pass 3: Calculate icon metrics
        if (progressCallback) progressCallback(50, 'Calculating icon sizes...');
        const metrics = calculateIconMetrics(borderResult.edges, width, bandRegion);

        // Pass 4: Build grid
        if (progressCallback) progressCallback(70, 'Building grid...');
        const gridResult = buildPreciseGrid(metrics, bandRegion, width, height, borderResult.edges);

        // Pass 5: Validate
        if (progressCallback) progressCallback(90, 'Validating cells...');
        const validation = validateGrid(ctx, gridResult.positions);

        // Pass 6: Empty screen detection
        // Icons smaller than 22px absolute are likely false positives from UI elements
        const minAbsoluteIconSize = 22;
        const iconsTooSmall = metrics.iconWidth < minAbsoluteIconSize || metrics.iconHeight < minAbsoluteIconSize;

        const isLikelyEmpty = bandRegion.confidence < 0.4 && borderResult.edges.length < 3 && metrics.isDefault;

        const hasInconsistentDetection =
            borderResult.edges.length >= 2 && metrics.confidence < 0.3 && validation.validCells.length < 3;

        // Collect failure reasons for UI display
        const failureReasons: FailureReason[] = [];
        if (iconsTooSmall) {
            failureReasons.push('icons_too_small');
        }
        if (isLikelyEmpty) {
            failureReasons.push('likely_empty_screen');
        }
        if (hasInconsistentDetection) {
            failureReasons.push('inconsistent_detection');
        }
        if (borderResult.edges.length === 0) {
            failureReasons.push('no_vertical_clusters');
        }

        if (isLikelyEmpty || hasInconsistentDetection || iconsTooSmall) {
            validation.validCells = [];
            validation.confidence = 0;
            validation.failureReasons = failureReasons;
        }

        const elapsed = Date.now() - startTime;

        if (progressCallback) progressCallback(100, 'Done!');

        return {
            success: true,
            bandRegion,
            borders: borderResult,
            metrics,
            grid: gridResult,
            validation,
            calibration: gridResult.calibration,
            elapsed,
            confidence: calculateOverallConfidence(bandRegion, metrics, validation),
            reasons: failureReasons.length > 0 ? failureReasons : null,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            reasons: ['exception_thrown'],
            calibration: null,
        };
    }
}

/**
 * Calculate overall confidence score
 */
function calculateOverallConfidence(
    bandRegion: BandRegion,
    metrics: IconMetrics,
    validation: ValidationResult
): number {
    const bandConf = bandRegion.confidence || 0;
    const metricsConf = metrics.confidence || 0;
    const validationConf = validation.confidence || 0;

    // Weighted average
    const overall = bandConf * 0.2 + metricsConf * 0.4 + validationConf * 0.4;

    return Math.min(1, Math.max(0, overall));
}

// ========================================
// Comparison with Presets
// ========================================

/**
 * Compare auto-detected calibration with a saved preset
 */
export function compareWithPreset(
    autoCalibration: GridCalibration | null,
    presetCalibration: GridCalibration | null
): PresetComparison | null {
    if (!autoCalibration || !presetCalibration) {
        return null;
    }

    const fields = ['iconWidth', 'iconHeight', 'xSpacing', 'ySpacing', 'xOffset', 'yOffset', 'iconsPerRow', 'numRows'];

    const comparison: Record<string, { auto: number; preset: number; diff: number; isClose: boolean }> = {};
    let totalDiff = 0;
    let matchingFields = 0;

    // Define tolerances for each field
    const tolerances: Record<string, number> = {
        iconWidth: 3,
        iconHeight: 3,
        xSpacing: 2,
        ySpacing: 2,
        xOffset: 10,
        yOffset: 10,
        iconsPerRow: 2,
        numRows: 1,
    };

    for (const field of fields) {
        const autoVal = (autoCalibration as Record<string, number>)[field] || 0;
        const presetVal = (presetCalibration as Record<string, number>)[field] || 0;
        const diff = Math.abs(autoVal - presetVal);

        const tolerance = tolerances[field] || 5;
        const isClose = diff <= tolerance;

        comparison[field] = {
            auto: autoVal,
            preset: presetVal,
            diff,
            isClose,
        };

        totalDiff += diff;
        if (isClose) matchingFields++;
    }

    const matchScore = (matchingFields / fields.length) * 100;

    return {
        ...comparison,
        matchScore,
        totalDiff,
        recommendation:
            matchScore >= 70
                ? 'Auto-detection matches preset well'
                : 'Auto-detection differs significantly from preset',
    } as PresetComparison;
}

// ========================================
// Debug Visualization
// ========================================

/**
 * Draw detection overlay on canvas for debugging
 */
export function drawDetectionOverlay(
    ctx: CanvasRenderingContext2D,
    detectionResult: AutoDetectionResult,
    options: {
        showBand?: boolean;
        showEdges?: boolean;
        showGrid?: boolean;
        showLabels?: boolean;
    } = {}
): void {
    const { showBand = true, showEdges = true, showGrid = true, showLabels = true } = options;

    ctx.save();

    // Draw hotbar band region
    if (showBand && detectionResult.bandRegion) {
        const band = detectionResult.bandRegion;
        ctx.strokeStyle = 'rgba(0, 100, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(0, band.topY, ctx.canvas.width, band.height);
        ctx.setLineDash([]);

        if (showLabels) {
            ctx.fillStyle = 'rgba(0, 100, 255, 0.8)';
            ctx.font = '12px monospace';
            ctx.fillText(`Band: Y=${band.topY}-${band.bottomY}`, 5, band.topY - 5);
        }
    }

    // Draw detected border edges
    if (showEdges && detectionResult.borders?.edges && detectionResult.bandRegion) {
        ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
        for (const edge of detectionResult.borders.edges) {
            ctx.beginPath();
            ctx.arc(edge.x, detectionResult.bandRegion.topY + 20, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Draw grid positions
    if (showGrid && detectionResult.grid?.positions && detectionResult.validation) {
        for (const cell of detectionResult.grid.positions) {
            // Determine cell status
            const isValid = detectionResult.validation.validCells?.some(v => v.slotIndex === cell.slotIndex);
            const isEmpty = detectionResult.validation.emptyCells?.some(e => e.slotIndex === cell.slotIndex);

            if (isValid) {
                ctx.strokeStyle = 'rgba(0, 255, 0, 0.9)';
                ctx.lineWidth = 2;
            } else if (isEmpty) {
                ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
                ctx.lineWidth = 1;
            } else {
                ctx.strokeStyle = 'rgba(255, 165, 0, 0.7)';
                ctx.lineWidth = 2;
            }

            ctx.strokeRect(cell.x, cell.y, cell.width, cell.height);

            // Draw slot index
            if (showLabels && isValid) {
                ctx.fillStyle = 'rgba(0, 255, 0, 0.9)';
                ctx.font = '10px monospace';
                ctx.fillText(`${cell.slotIndex}`, cell.x + 2, cell.y + 10);
            }
        }
    }

    ctx.restore();
}

// ========================================
// Default Export
// ========================================

export default {
    autoDetectGrid,
    detectHotbarBand,
    detectRarityBorders,
    calculateIconMetrics,
    buildPreciseGrid,
    validateGrid,
    compareWithPreset,
    drawDetectionOverlay,
    setConfig,
    getConfig,
};
