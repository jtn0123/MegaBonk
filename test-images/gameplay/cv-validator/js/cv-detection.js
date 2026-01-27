/* ========================================
 * CV Validator - CV Detection
 * Grid detection, similarity matching, template matching
 * Now uses shared CV library for enhanced detection
 * ======================================== */
/* global setTimeout, clearTimeout, Image */

import { CONFIG } from './config.js';
import { state } from './state.js';
import { log, LOG_LEVELS } from './utils.js';

// Import from shared CV library (built from TypeScript)
// Falls back to local implementations if library not available
let sharedLibrary = null;
let useSharedLibrary = false;

// Detection options (can be toggled via UI)
let detectionOptions = {
    useEnhanced: true, // Multi-method vs NCC only
    useTrainingData: true, // Use training templates
};

/**
 * Set detection options (called from UI toggles)
 */
export function setDetectionOptions(options) {
    detectionOptions = { ...detectionOptions, ...options };
}

/**
 * Get current detection options
 */
export function getDetectionOptions() {
    return { ...detectionOptions };
}

// Try to load the shared CV library
async function loadSharedLibrary() {
    try {
        // Path relative to cv-validator directory
        sharedLibrary = await import('../../../../dist/cv-library/cv-library.js');
        useSharedLibrary = true;
        log('Loaded shared CV library with enhanced detection', LOG_LEVELS.SUCCESS);
        return true;
    } catch (err) {
        log(`Shared CV library not available, using local NCC: ${err.message}`, LOG_LEVELS.WARNING);
        useSharedLibrary = false;
        return false;
    }
}

// Export the loader for initialization
export { loadSharedLibrary, useSharedLibrary };

// Check if shared library is loaded
export function isSharedLibraryLoaded() {
    return useSharedLibrary && sharedLibrary !== null;
}

// Store current image context for crop extraction
let currentImageCtx = null;
export function getCurrentImageCtx() {
    return currentImageCtx;
}

// ========================================
// Grid Position Detection
// ========================================

export function detectGridPositions(width, height) {
    const cal = state.calibration;

    // Scale factors - use height-based scaling from 720p base
    const scale = height / CONFIG.BASE_RESOLUTION;

    // Use manual calibration values, scaled to current resolution
    const iconW = Math.round(cal.iconWidth * scale);
    const iconH = Math.round(cal.iconHeight * scale);
    const spacingX = Math.round(cal.xSpacing * scale);
    const spacingY = Math.round(cal.ySpacing * scale);
    const positions = [];

    const rowHeight = iconH + spacingY;

    // Apply manual offsets for calibration (scaled to image size)
    // yOffset: positive values shift grid DOWN, negative values shift UP
    // Direct scaling: yOffset in preset is pixels at 720p base resolution
    const scaledYOffset = Math.round(cal.yOffset * scale);
    const scaledXOffset = Math.round(cal.xOffset * scale);
    const firstRowY = Math.round(height * CONFIG.ITEM_BAR_BOTTOM_PERCENT) - iconH + scaledYOffset;

    // Build row Y positions based on numRows setting
    const rowYPositions = [];
    for (let r = 0; r < cal.numRows; r++) {
        rowYPositions.push(firstRowY - r * rowHeight);
    }

    // Calculate grid width and center it, then apply X offset
    const totalGridWidth = cal.iconsPerRow * (iconW + spacingX) - spacingX;
    const baseStartX = Math.round((width - totalGridWidth) / 2);

    // Calculate max items to scan
    const maxItems = cal.totalItems > 0 ? cal.totalItems : cal.iconsPerRow * cal.numRows;

    let slotIndex = 0;
    let rowIndex = 0;
    for (const rowY of rowYPositions) {
        // Don't scan too high up the screen
        if (rowY < height * CONFIG.MIN_ROW_HEIGHT_PERCENT) break;

        // Calculate how many items are in this row
        const itemsRemaining = maxItems - slotIndex;
        const itemsInThisRow = Math.min(cal.iconsPerRow, itemsRemaining);

        // Calculate centering offset - ONLY for the bottom row (rowIndex 0)
        // Upper rows always start from the left
        let centeringOffset = 0;
        if (rowIndex === 0 && itemsInThisRow < cal.iconsPerRow) {
            centeringOffset = Math.floor((cal.iconsPerRow - itemsInThisRow) / 2);
        }
        const rowStartX = baseStartX + scaledXOffset + centeringOffset * (iconW + spacingX);

        for (let col = 0; col < itemsInThisRow; col++) {
            positions.push({
                x: rowStartX + col * (iconW + spacingX),
                y: rowY,
                width: iconW,
                height: iconH,
                slotIndex: slotIndex,
                row: rowIndex,
                col: col + centeringOffset, // Actual column position (for display)
            });
            slotIndex++;
        }

        // Stop if we've reached totalItems limit
        if (slotIndex >= maxItems) break;

        rowIndex++;
    }

    return positions;
}

// ========================================
// Empty Cell Detection (Phase 1: Per-cell analysis)
// ========================================

// ----------------------------------------
// New Empty Detection Methods (#1, #2, #3, #7)
// ----------------------------------------

/**
 * #2: Calculate average color saturation (HSL-based)
 * Returns value from 0 (grayscale) to 1 (fully saturated)
 *
 * Why it works: Item icons have vibrant colors (high saturation)
 * while stone/brick backgrounds are grey (low saturation)
 */
export function calculateAverageSaturation(imageData) {
    const pixels = imageData.data;
    let totalSaturation = 0;
    let count = 0;

    // Sample every 4th pixel for performance
    for (let i = 0; i < pixels.length; i += 16) {
        const r = pixels[i] || 0;
        const g = pixels[i + 1] || 0;
        const b = pixels[i + 2] || 0;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);

        // Saturation formula (HSL-based)
        // Saturation = 0 when max == min (pure grey)
        let saturation = 0;
        if (max !== min) {
            const lightness = (max + min) / 2;
            if (lightness <= 127.5) {
                saturation = (max - min) / (max + min);
            } else {
                saturation = (max - min) / (510 - max - min);
            }
        }

        totalSaturation += saturation;
        count++;
    }

    return count > 0 ? totalSaturation / count : 0;
}

/**
 * #3: Calculate color histogram width (number of distinct color bins)
 * Returns count of occupied bins (0-32)
 *
 * Why it works: Item icons have multiple distinct colors (outline, fill, highlights)
 * while backgrounds have few colors (grey variations)
 */
export function calculateHistogramWidth(imageData) {
    const pixels = imageData.data;
    const bins = new Set();

    // Sample every 4th pixel for performance
    for (let i = 0; i < pixels.length; i += 16) {
        const r = pixels[i] || 0;
        const g = pixels[i + 1] || 0;
        const b = pixels[i + 2] || 0;

        // Quantize to 32 bins (5 bits per channel → 8 levels each)
        // This gives 8*4 = 32 possible unique bins
        const rBin = Math.floor(r / 32);
        const gBin = Math.floor(g / 32);
        const bBin = Math.floor(b / 32);
        const binIndex = (rBin << 6) | (gBin << 3) | bBin;

        bins.add(binIndex);
    }

    return bins.size;
}

/**
 * #7: Calculate center vs edge variance ratio
 * Returns ratio of center variance to edge variance
 *
 * Why it works: Item icons are centered, so center region should be
 * more detailed than edges. Uniform backgrounds have ratio ~1.0
 */
export function calculateCenterEdgeRatio(imageData) {
    const pixels = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Define center region (inner 50%) and edge region (outer 25% ring)
    const marginX = Math.floor(width * 0.25);
    const marginY = Math.floor(height * 0.25);

    // Calculate variance for center region
    let centerSumR = 0,
        centerSumG = 0,
        centerSumB = 0;
    let centerSumSqR = 0,
        centerSumSqG = 0,
        centerSumSqB = 0;
    let centerCount = 0;

    // Calculate variance for edge region
    let edgeSumR = 0,
        edgeSumG = 0,
        edgeSumB = 0;
    let edgeSumSqR = 0,
        edgeSumSqG = 0,
        edgeSumSqB = 0;
    let edgeCount = 0;

    for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x += 2) {
            const idx = (y * width + x) * 4;
            const r = pixels[idx] || 0;
            const g = pixels[idx + 1] || 0;
            const b = pixels[idx + 2] || 0;

            // Check if this pixel is in center or edge region
            const inCenterX = x >= marginX && x < width - marginX;
            const inCenterY = y >= marginY && y < height - marginY;

            if (inCenterX && inCenterY) {
                // Center region
                centerSumR += r;
                centerSumG += g;
                centerSumB += b;
                centerSumSqR += r * r;
                centerSumSqG += g * g;
                centerSumSqB += b * b;
                centerCount++;
            } else {
                // Edge region
                edgeSumR += r;
                edgeSumG += g;
                edgeSumB += b;
                edgeSumSqR += r * r;
                edgeSumSqG += g * g;
                edgeSumSqB += b * b;
                edgeCount++;
            }
        }
    }

    // Calculate variances
    if (centerCount === 0 || edgeCount === 0) return 1.0;

    const centerMeanR = centerSumR / centerCount;
    const centerMeanG = centerSumG / centerCount;
    const centerMeanB = centerSumB / centerCount;
    const centerVariance =
        centerSumSqR / centerCount -
        centerMeanR * centerMeanR +
        (centerSumSqG / centerCount - centerMeanG * centerMeanG) +
        (centerSumSqB / centerCount - centerMeanB * centerMeanB);

    const edgeMeanR = edgeSumR / edgeCount;
    const edgeMeanG = edgeSumG / edgeCount;
    const edgeMeanB = edgeSumB / edgeCount;
    const edgeVariance =
        edgeSumSqR / edgeCount -
        edgeMeanR * edgeMeanR +
        (edgeSumSqG / edgeCount - edgeMeanG * edgeMeanG) +
        (edgeSumSqB / edgeCount - edgeMeanB * edgeMeanB);

    // Return ratio (add 1 to avoid division by zero)
    return centerVariance / (edgeVariance + 1);
}

// ----------------------------------------
// Existing Empty Detection Methods
// ----------------------------------------

/**
 * Calculate edge density using Sobel-like gradient detection
 * Returns ratio of edge pixels to total pixels (0-1)
 */
export function calculateEdgeDensity(imageData) {
    const pixels = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    let edgePixels = 0;
    let totalPixels = 0;

    // Simple gradient detection: compare each pixel to neighbors
    // Sample every 2nd pixel for performance
    for (let y = 1; y < height - 1; y += 2) {
        for (let x = 1; x < width - 1; x += 2) {
            const idx = (y * width + x) * 4;

            // Get grayscale values
            const center = (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3;
            const right = (pixels[idx + 4] + pixels[idx + 5] + pixels[idx + 6]) / 3;
            const bottom = (pixels[idx + width * 4] + pixels[idx + width * 4 + 1] + pixels[idx + width * 4 + 2]) / 3;

            // Calculate gradient magnitude
            const gradX = Math.abs(right - center);
            const gradY = Math.abs(bottom - center);
            const gradient = gradX + gradY;

            // Threshold for edge detection (30 is ~12% of 255)
            if (gradient > 30) {
                edgePixels++;
            }
            totalPixels++;
        }
    }

    return totalPixels > 0 ? edgePixels / totalPixels : 0;
}

/**
 * Check if cell color matches inventory background
 * Returns true if cell appears to be empty inventory background
 *
 * Inventory backgrounds are typically dark, low-saturation colors.
 * Rather than checking for a specific color, we check for:
 * - Dark pixels (brightness < 80)
 * - Low saturation (max-min channel difference < 40)
 */
export function isInventoryBackground(imageData) {
    const pixels = imageData.data;
    let darkLowSatPixels = 0;
    let count = 0;

    // Sample center region (avoid borders which may have item edges)
    const width = imageData.width;
    const height = imageData.height;
    const margin = Math.floor(Math.min(width, height) * 0.2);

    for (let y = margin; y < height - margin; y += 2) {
        for (let x = margin; x < width - margin; x += 2) {
            const idx = (y * width + x) * 4;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];

            // Check if pixel is dark and low-saturation
            const brightness = (r + g + b) / 3;
            const maxChannel = Math.max(r, g, b);
            const minChannel = Math.min(r, g, b);
            const saturation = maxChannel - minChannel;

            // Dark (< 80 brightness) and low saturation (< 40 spread)
            if (brightness < 80 && saturation < 40) {
                darkLowSatPixels++;
            }
            count++;
        }
    }

    // If >60% of center pixels are dark & low-saturation, likely empty background
    return count > 0 && darkLowSatPixels / count > 0.6;
}

/**
 * Check if a cell is empty (Phase 1: per-cell analysis)
 * Uses multiple signals: variance, edge density, background color, saturation, histogram
 *
 * Strategy: Be generous with empty detection (use higher variance threshold),
 * but use edge density to rescue cells that have low variance but contain items.
 *
 * New methods (#2, #3, #7) provide additional detection for textured backgrounds
 * like grey brick that fool the basic variance check.
 */
export function isEmptyCell(imageData) {
    const pixels = imageData.data;
    const methods = CONFIG.EMPTY_DETECTION_METHODS;

    let sumR = 0,
        sumG = 0,
        sumB = 0;
    let sumSqR = 0,
        sumSqG = 0,
        sumSqB = 0;
    let count = 0;

    // Sample every 4th pixel for performance
    for (let i = 0; i < pixels.length; i += 16) {
        const r = pixels[i] || 0;
        const g = pixels[i + 1] || 0;
        const b = pixels[i + 2] || 0;

        sumR += r;
        sumG += g;
        sumB += b;
        sumSqR += r * r;
        sumSqG += g * g;
        sumSqB += b * b;
        count++;
    }

    if (count === 0) return true;

    // Calculate variance for each channel
    const meanR = sumR / count;
    const meanG = sumG / count;
    const meanB = sumB / count;

    const varianceR = sumSqR / count - meanR * meanR;
    const varianceG = sumSqG / count - meanG * meanG;
    const varianceB = sumSqB / count - meanB * meanB;

    const totalVariance = varianceR + varianceG + varianceB;
    const meanGray = (meanR + meanG + meanB) / 3;

    // Check 1: Very dark cells are empty (meanGray < 40)
    if (meanGray < CONFIG.EMPTY_CELL_MEAN_THRESHOLD) {
        return true;
    }

    // ----------------------------------------
    // Method #2: Saturation check (good for grey/brick backgrounds)
    // Low saturation + moderate variance = likely empty textured background
    // ----------------------------------------
    if (methods.useSaturation) {
        const saturation = calculateAverageSaturation(imageData);
        // Low saturation (< 15%) combined with moderate variance = empty
        // This catches grey brick that has variance ~400-600 but no color
        if (saturation < CONFIG.EMPTY_CELL_MAX_SATURATION && totalVariance < 800) {
            return true;
        }
    }

    // ----------------------------------------
    // Method #3: Histogram width check (experimental)
    // Few distinct colors = likely empty background
    // ----------------------------------------
    if (methods.useHistogram) {
        const histWidth = calculateHistogramWidth(imageData);
        if (histWidth < CONFIG.EMPTY_CELL_MIN_HISTOGRAM_BINS) {
            return true;
        }
    }

    // ----------------------------------------
    // Method #7: Center/edge ratio check (experimental)
    // Uniform variance across cell = likely empty (no centered icon)
    // ----------------------------------------
    if (methods.useCenterEdge) {
        const ratio = calculateCenterEdgeRatio(imageData);
        if (ratio < CONFIG.EMPTY_CELL_MIN_CENTER_EDGE_RATIO) {
            return true;
        }
    }

    // ----------------------------------------
    // Original variance-based checks
    // ----------------------------------------
    if (methods.useVariance) {
        // Check 2: Low variance = likely empty
        // Use higher threshold (500) to catch empty cells
        if (totalVariance < 500) {
            // If variance is VERY low (< 150), definitely empty - no further checks
            if (totalVariance < 150) {
                return true;
            }

            // For moderate variance (150-500), check if it has significant edges
            // Items have edges (icon outlines), empty backgrounds don't
            const edgeDensity = calculateEdgeDensity(imageData);

            // Low edges (< 5%) = empty background
            if (edgeDensity < 0.05) {
                return true;
            }

            // Has some edges but matches inventory background = still empty
            if (edgeDensity < 0.12 && isInventoryBackground(imageData)) {
                return true;
            }
        }

        // Check 3: Matches inventory background color (even with higher variance)
        // Some empty cells have texture/noise but are clearly background
        if (totalVariance < 800 && isInventoryBackground(imageData)) {
            const edgeDensity = calculateEdgeDensity(imageData);
            if (edgeDensity < 0.08) {
                return true;
            }
        }
    }

    return false;
}

// ========================================
// Empty Cell Detection (Phase 2: Inventory Fill Pattern)
// ========================================

/**
 * Apply MegaBonk inventory fill pattern knowledge to improve empty detection
 *
 * MegaBonk Inventory Fill Pattern:
 * - Row 0 (bottom): Items fill from CENTER, expand LEFT and RIGHT
 * - Once you hit 3 consecutive empties on either edge → ALL remaining cells are empty
 * - This includes cells in rows 1 and 2 (above the bottom row)
 *
 * Key Rule:
 * - If row 0 is not full (items at both edges) → rows 1+ are COMPLETELY empty
 * - If row N is not full → rows N+1 and above are COMPLETELY empty
 *
 * @param {Array} cells - Array of { cell, cellData, isEmpty } objects
 * @param {number} numRows - Number of rows in grid
 * @param {number} iconsPerRow - Icons per row
 * @returns {Array} - Updated cells with optimized isEmpty flags
 */
export function applyInventoryFillPattern(cells, numRows, iconsPerRow) {
    if (!cells || cells.length === 0) return cells;

    const threshold = CONFIG.CONSECUTIVE_EMPTY_THRESHOLD;

    // Group cells by row
    const rows = [];
    for (let r = 0; r < numRows; r++) {
        rows[r] = cells.filter(c => c.cell.row === r).sort((a, b) => a.cell.col - b.cell.col);
    }

    // Process row 0 first (center-fill pattern)
    let row0LeftBound = 0; // leftmost column with items
    let row0RightBound = iconsPerRow - 1; // rightmost column with items
    let row0Full = false;

    if (rows[0] && rows[0].length > 0) {
        const centerCol = Math.floor(iconsPerRow / 2);

        // Find left edge (scan from center going left)
        let consecutiveEmpty = 0;
        for (let col = centerCol - 1; col >= 0; col--) {
            const cell = rows[0].find(c => c.cell.col === col);
            if (!cell || cell.isEmpty) {
                consecutiveEmpty++;
                if (consecutiveEmpty >= threshold) {
                    row0LeftBound = col + threshold; // First item position
                    break;
                }
            } else {
                consecutiveEmpty = 0;
            }
        }

        // Find right edge (scan from center going right)
        consecutiveEmpty = 0;
        for (let col = centerCol; col < iconsPerRow; col++) {
            const cell = rows[0].find(c => c.cell.col === col);
            if (!cell || cell.isEmpty) {
                consecutiveEmpty++;
                if (consecutiveEmpty >= threshold) {
                    row0RightBound = col - threshold; // Last item position
                    break;
                }
            } else {
                consecutiveEmpty = 0;
            }
        }

        // Check if row 0 is full (items at both edges)
        row0Full = row0LeftBound === 0 && row0RightBound === iconsPerRow - 1;

        // Mark row 0 cells outside bounds as empty
        for (const c of rows[0]) {
            if (c.cell.col < row0LeftBound || c.cell.col > row0RightBound) {
                c.isEmpty = true;
                c.fillPatternEmpty = true;
            }
        }

        log(`[FillPattern] Row 0: bounds [${row0LeftBound}-${row0RightBound}], full=${row0Full}`, LOG_LEVELS.INFO);
    }

    // Process rows 1+ (only have items if row 0 is full)
    for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
        const rowCells = rows[rowIdx];
        if (!rowCells || rowCells.length === 0) continue;

        if (!row0Full) {
            // Row 0 not full → this entire row is empty
            for (const c of rowCells) {
                c.isEmpty = true;
                c.fillPatternEmpty = true;
            }
            log(`[FillPattern] Row ${rowIdx}: ALL EMPTY (row 0 not full)`, LOG_LEVELS.INFO);
        } else {
            // Row 0 is full → this row fills left-to-right
            // Find the edge (3 consecutive empties)
            let cutoff = iconsPerRow;
            let consecutiveEmpty = 0;

            for (const c of rowCells) {
                if (c.isEmpty) {
                    consecutiveEmpty++;
                    if (consecutiveEmpty >= threshold) {
                        cutoff = c.cell.col - threshold + 1;
                        break;
                    }
                } else {
                    consecutiveEmpty = 0;
                }
            }

            // Mark everything after cutoff as empty
            for (const c of rowCells) {
                if (c.cell.col >= cutoff) {
                    c.isEmpty = true;
                    c.fillPatternEmpty = true;
                }
            }

            // If this row is not full, all rows above are empty too
            const rowFull = cutoff === iconsPerRow;
            log(`[FillPattern] Row ${rowIdx}: cutoff=${cutoff}, full=${rowFull}`, LOG_LEVELS.INFO);

            if (!rowFull) {
                // Mark all remaining rows as empty
                for (let futureRow = rowIdx + 1; futureRow < rows.length; futureRow++) {
                    if (rows[futureRow]) {
                        for (const c of rows[futureRow]) {
                            c.isEmpty = true;
                            c.fillPatternEmpty = true;
                        }
                        log(`[FillPattern] Row ${futureRow}: ALL EMPTY (row ${rowIdx} not full)`, LOG_LEVELS.INFO);
                    }
                }
                break; // No need to process more rows
            }
        }
    }

    return cells;
}

// ========================================
// Similarity Calculation
// ========================================

/**
 * Calculate similarity using the shared library's enhanced method
 * Falls back to local NCC if library not available or enhanced is disabled
 */
export function calculateSimilarity(imageData1, imageData2) {
    // Use enhanced only if enabled AND library loaded
    if (detectionOptions.useEnhanced && useSharedLibrary && sharedLibrary?.calculateEnhancedSimilarity) {
        return sharedLibrary.calculateEnhancedSimilarity(imageData1, imageData2);
    }

    // Fallback to local NCC
    return calculateNCC(imageData1, imageData2);
}

/**
 * Local NCC implementation (fallback when shared library not available)
 */
export function calculateNCC(imageData1, imageData2) {
    const pixels1 = imageData1.data;
    const pixels2 = imageData2.data;

    let sum1 = 0,
        sum2 = 0,
        sumProduct = 0,
        sumSquare1 = 0,
        sumSquare2 = 0,
        count = 0;
    const len = Math.min(pixels1.length, pixels2.length);

    for (let i = 0; i < len; i += 4) {
        const gray1 = (pixels1[i] + pixels1[i + 1] + pixels1[i + 2]) / 3;
        const gray2 = (pixels2[i] + pixels2[i + 1] + pixels2[i + 2]) / 3;

        sum1 += gray1;
        sum2 += gray2;
        sumProduct += gray1 * gray2;
        sumSquare1 += gray1 * gray1;
        sumSquare2 += gray2 * gray2;
        count++;
    }

    const mean1 = sum1 / count;
    const mean2 = sum2 / count;
    const numerator = sumProduct / count - mean1 * mean2;
    const denominator = Math.sqrt((sumSquare1 / count - mean1 * mean1) * (sumSquare2 / count - mean2 * mean2));

    if (denominator === 0) {
        // Denominator is 0 when one or both images have uniform color (zero variance).
        // This typically happens with empty cells or solid-color regions.
        // Returning 0 indicates no meaningful correlation can be computed.
        return 0;
    }
    return (numerator / denominator + 1) / 2;
}

// ========================================
// Image Data to Data URL
// ========================================

export function imageDataToDataURL(imageData) {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
}

// ========================================
// Image Data Resize
// ========================================

export function resizeImageData(imageData, targetWidth, targetHeight) {
    // Use shared library if available
    if (useSharedLibrary && sharedLibrary?.resizeImageData) {
        return sharedLibrary.resizeImageData(imageData, targetWidth, targetHeight);
    }

    // Local implementation
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = targetWidth;
    outCanvas.height = targetHeight;
    const outCtx = outCanvas.getContext('2d');
    outCtx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

    return outCtx.getImageData(0, 0, targetWidth, targetHeight);
}

// ========================================
// Training Template Matching
// ========================================

/**
 * Magic Numbers Documentation for Training Template Matching:
 *
 * Weights and Thresholds:
 * - primaryWeight (1.5): Primary template gets 1.5x weight bonus. Primary templates
 *   are high-quality reference images, so they're more reliable than user-submitted
 *   training samples which may have compression artifacts or lighting variations.
 *
 * - 0.7 scaling factor: When primary wins, apply weight * 0.7 = 1.05x effective bonus.
 *   This moderate boost reflects primary template reliability without being excessive.
 *
 * - 0.85 scaling factor: When training template wins, apply weight * 0.85.
 *   Training templates get slightly less boost since they may be lower quality.
 *
 * - threshold (0.5): Minimum raw score to count as a "vote" for confidence bonus.
 *   Scores below 0.5 indicate poor match and shouldn't contribute to voting bonus.
 *
 * - votingBonus max (0.08): Up to 8% bonus when multiple templates agree.
 *   Multiple high-confidence matches indicate strong item identity.
 *
 * - 0.015 per vote: Each template scoring >0.5 adds 1.5% bonus.
 *   Diminishing returns prevent excessive bonus from many mediocre matches.
 *
 * - 0.99 max score cap: Prevent confidence overflow. No match should be 100%
 *   certain since there's always some measurement noise.
 */

/**
 * Match using training templates if available
 * Returns boosted similarity score
 */
function matchWithTrainingTemplates(centerData, primaryTemplate, itemId) {
    // Skip if training data is disabled via toggle
    if (!detectionOptions.useTrainingData) {
        return null;
    }

    if (!useSharedLibrary || !sharedLibrary?.isTrainingDataLoaded || !sharedLibrary.isTrainingDataLoaded()) {
        return null; // No training data available
    }

    const trainingTemplates = sharedLibrary.getTrainingTemplatesForItem(itemId);
    if (!trainingTemplates || trainingTemplates.length === 0) {
        return null;
    }

    // Get primary template score
    const primaryScore = calculateSimilarity(centerData, primaryTemplate);

    // Match against training templates - store raw scores and weights separately
    const trainingResults = [];
    for (const trainingTpl of trainingTemplates) {
        // Resize training template to match center data size
        const resizedTraining = resizeImageData(trainingTpl.imageData, centerData.width, centerData.height);
        if (!resizedTraining) continue;

        const rawScore = calculateSimilarity(centerData, resizedTraining);
        trainingResults.push({ rawScore, weight: trainingTpl.weight });
    }

    if (trainingResults.length === 0) {
        return primaryScore;
    }

    // Aggregation strategy:
    // 1. Compare all RAW scores to find best match
    // 2. Apply weight to the winning score
    // 3. Add voting bonus for multiple high-confidence matches
    const primaryWeight = 1.5;

    // Collect all raw scores for comparison (fair comparison without weights)
    const allRawScores = [primaryScore, ...trainingResults.map(t => t.rawScore)];
    const maxRawScore = Math.max(...allRawScores);

    // Determine which template won and apply its weight
    let finalBaseScore;
    if (primaryScore === maxRawScore) {
        // Primary template won - apply primary weight bonus
        finalBaseScore = primaryScore * Math.min(1.0, primaryWeight * 0.7); // Scaled bonus, max 1.0
    } else {
        // A training template won - find which one and apply its weight
        const winningTraining = trainingResults.find(t => t.rawScore === maxRawScore);
        const weight = winningTraining?.weight || 1.0;
        finalBaseScore = maxRawScore * Math.min(1.0, weight * 0.85); // Scaled bonus, max 1.0
    }

    // Voting bonus: count how many templates exceed threshold (using raw scores)
    const threshold = 0.5;
    const votesAboveThreshold = allRawScores.filter(s => s > threshold).length;
    const votingBonus = Math.min(0.08, votesAboveThreshold * 0.015); // Up to 8% bonus

    // Final score with voting bonus, capped at 0.99
    return Math.min(0.99, finalBaseScore + votingBonus);
}

// ========================================
// Main Detection Runner
// ========================================

export async function runDetection(imageData, width, height, threshold, progressCallback) {
    const gridPositions = detectGridPositions(width, height);
    const detections = [];
    const ctx = imageData.ctx;

    // Store ctx for crop extraction
    currentImageCtx = ctx;

    // Clear previous detection tracking
    state.detectionsBySlot.clear();
    state.emptyCells.clear();
    state.gridPositionsCache = gridPositions;

    // Log detection method based on toggles
    let detectionMethod = 'NCC only';
    if (detectionOptions.useEnhanced && useSharedLibrary) {
        detectionMethod = 'enhanced multi-method';
    } else if (detectionOptions.useEnhanced && !useSharedLibrary) {
        detectionMethod = 'NCC only (library not loaded)';
    }

    let trainingStatus = 'training data disabled';
    if (detectionOptions.useTrainingData) {
        trainingStatus =
            useSharedLibrary && sharedLibrary?.isTrainingDataLoaded?.() ? 'with training data' : 'no training data';
    }
    log(`Scanning ${gridPositions.length} grid positions using ${detectionMethod} (${trainingStatus})...`);

    let processedCells = 0;

    // First pass: classify all cells as empty or not
    const allCells = [];
    for (const cell of gridPositions) {
        const cellData = ctx.getImageData(cell.x, cell.y, cell.width, cell.height);
        const isEmpty = isEmptyCell(cellData);
        allCells.push({ cell, cellData, isEmpty });
    }

    // Apply inventory fill pattern to improve empty detection
    // This uses game knowledge: items fill from center in row 0, left-to-right in upper rows
    // If row 0 isn't full, upper rows are completely empty
    applyInventoryFillPattern(allCells, state.calibration.numRows, state.calibration.iconsPerRow);

    // Now separate into empty and non-empty based on updated isEmpty flags
    const nonEmptyCells = [];
    for (const { cell, cellData, isEmpty, fillPatternEmpty } of allCells) {
        if (!isEmpty) {
            nonEmptyCells.push({ cell, cellData });
        } else {
            // Track empty cells so they can be corrected if wrongly classified
            const cropDataURL = imageDataToDataURL(cellData);
            state.emptyCells.set(cell.slotIndex, {
                position: cell,
                cropDataURL: cropDataURL,
                fillPatternEmpty: fillPatternEmpty || false, // Track if marked empty by fill pattern
            });
        }
    }

    log(`Found ${nonEmptyCells.length} non-empty cells (after fill pattern analysis)`);

    // Second pass: match templates and track top alternatives
    for (const { cell, cellData } of nonEmptyCells) {
        processedCells++;
        if (progressCallback) {
            progressCallback((processedCells / nonEmptyCells.length) * 100);
        }

        // Track all matches for this cell
        const allMatches = [];

        for (const [itemId, template] of state.templateCache) {
            if (!template) continue;

            const marginPercent = CONFIG.TEMPLATE_MARGIN_PERCENT;

            // Resize template to cell size (center region)
            const margin = Math.round(cell.width * marginPercent);
            const centerWidth = cell.width - margin * 2;
            const centerHeight = cell.height - margin * 2;

            // Extract center of cell
            const centerData = ctx.createImageData(centerWidth, centerHeight);
            for (let y = 0; y < centerHeight; y++) {
                for (let x = 0; x < centerWidth; x++) {
                    const srcIdx = ((y + margin) * cell.width + (x + margin)) * 4;
                    const dstIdx = (y * centerWidth + x) * 4;
                    centerData.data[dstIdx] = cellData.data[srcIdx];
                    centerData.data[dstIdx + 1] = cellData.data[srcIdx + 1];
                    centerData.data[dstIdx + 2] = cellData.data[srcIdx + 2];
                    centerData.data[dstIdx + 3] = cellData.data[srcIdx + 3];
                }
            }

            // Resize template center
            const tMargin = Math.round(template.width * marginPercent);
            const tCenterCanvas = document.createElement('canvas');
            tCenterCanvas.width = centerWidth;
            tCenterCanvas.height = centerHeight;
            const tCenterCtx = tCenterCanvas.getContext('2d');
            tCenterCtx.drawImage(
                template.canvas,
                tMargin,
                tMargin,
                template.width - tMargin * 2,
                template.height - tMargin * 2,
                0,
                0,
                centerWidth,
                centerHeight
            );
            const resizedTemplate = tCenterCtx.getImageData(0, 0, centerWidth, centerHeight);

            // Try training template matching first
            let similarity = matchWithTrainingTemplates(centerData, resizedTemplate, itemId);

            // Fall back to regular similarity if no training data
            if (similarity === null) {
                similarity = calculateSimilarity(centerData, resizedTemplate);
            }

            allMatches.push({
                item: state.itemIdLookup.get(itemId),
                confidence: similarity,
                position: cell,
            });
        }

        // Sort by confidence descending and get top matches
        allMatches.sort((a, b) => b.confidence - a.confidence);
        const topMatches = allMatches.slice(0, CONFIG.TOP_MATCHES_COUNT);
        const bestMatch = topMatches[0];

        // Generate crop data URL for display (needed for both detection and empty tracking)
        const cropDataURL = imageDataToDataURL(cellData);

        // ----------------------------------------
        // Method #1: Confidence threshold post-filter
        // If best match is below minimum confidence, this cell is actually empty
        // This catches textured backgrounds that passed the pre-filter
        // ----------------------------------------
        if (CONFIG.EMPTY_DETECTION_METHODS.useConfidenceThreshold) {
            if (!bestMatch || bestMatch.confidence < CONFIG.EMPTY_CELL_MIN_CONFIDENCE) {
                // Reclassify as empty - nothing matched well
                state.emptyCells.set(cell.slotIndex, {
                    position: cell,
                    cropDataURL: cropDataURL,
                    reclassifiedEmpty: true, // Flag to indicate this was reclassified
                    bestMatchConfidence: bestMatch?.confidence || 0,
                });
                log(
                    `[Slot ${cell.slotIndex}] Reclassified as EMPTY (best match ${bestMatch?.item?.name || 'none'} at ${((bestMatch?.confidence || 0) * 100).toFixed(0)}% < ${(CONFIG.EMPTY_CELL_MIN_CONFIDENCE * 100).toFixed(0)}% threshold)`
                );
                continue; // Skip to next cell
            }
        }

        // Store detection data for this slot
        if (bestMatch && bestMatch.confidence >= threshold) {
            detections.push(bestMatch);

            // Store slot data with alternatives and crop
            state.detectionsBySlot.set(cell.slotIndex, {
                detection: bestMatch,
                topMatches: topMatches,
                position: cell,
                cropDataURL: cropDataURL,
            });

            // Log with top 3 alternatives
            const top3Str = topMatches
                .slice(0, 3)
                .map(m => `${m.item.name}(${(m.confidence * 100).toFixed(0)}%)`)
                .join(', ');
            log(
                `[Slot ${cell.slotIndex}] Detected: ${bestMatch.item.name} ${(bestMatch.confidence * 100).toFixed(0)}% | TOP 3: ${top3Str}`
            );
        }
    }

    return detections;
}

// ========================================
// Get Resolution Info
// ========================================

export function getResolutionInfo(width, height) {
    const scale = height / CONFIG.BASE_RESOLUTION;
    return {
        width,
        height,
        scale,
        scaleText: `${scale.toFixed(2)}x`,
    };
}

// ========================================
// Get Training Data Stats (for UI display)
// ========================================

export function getTrainingDataStats() {
    if (!useSharedLibrary || !sharedLibrary?.getTrainingStats) {
        return null;
    }
    return sharedLibrary.getTrainingStats();
}

// ========================================
// Session Template Management (Real-time Learning)
// ========================================

/**
 * Add a training template to the current session
 * Templates added here are immediately available for detection
 * @param {string} itemId - The item ID (e.g., "sword_of_flames")
 * @param {ImageData} imageData - The ImageData of the cropped icon
 * @param {Object} metadata - Additional metadata
 */
export function addSessionTemplate(itemId, imageData, metadata = {}) {
    if (!useSharedLibrary || !sharedLibrary?.addSessionTemplate) {
        log('Session templates require shared CV library', LOG_LEVELS.WARNING);
        return false;
    }
    sharedLibrary.addSessionTemplate(itemId, imageData, metadata);
    return true;
}

/**
 * Get the count of session templates added this session
 */
export function getSessionTemplateCount() {
    if (!useSharedLibrary || !sharedLibrary?.getSessionTemplateCount) {
        return 0;
    }
    return sharedLibrary.getSessionTemplateCount();
}

/**
 * Get items that have session templates
 */
export function getSessionTemplateItems() {
    if (!useSharedLibrary || !sharedLibrary?.getSessionTemplateItems) {
        return [];
    }
    return sharedLibrary.getSessionTemplateItems();
}

/**
 * Clear all session templates
 */
export function clearSessionTemplates() {
    if (!useSharedLibrary || !sharedLibrary?.clearSessionTemplates) {
        return;
    }
    sharedLibrary.clearSessionTemplates();
}

/**
 * Extract ImageData from a crop data URL for adding as template
 * @param {string} dataURL - Base64 data URL of the crop
 * @param {number} timeoutMs - Timeout in milliseconds (default 5000)
 * @returns {Promise<ImageData|null>}
 */
export function dataURLToImageData(dataURL, timeoutMs = 5000) {
    return new Promise(resolve => {
        let resolved = false;

        const timeoutId = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                log('dataURLToImageData timed out', LOG_LEVELS.WARNING);
                resolve(null);
            }
        }, timeoutMs);

        const img = new Image();
        img.onload = () => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timeoutId);
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(ctx.getImageData(0, 0, img.width, img.height));
        };
        img.onerror = () => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timeoutId);
            resolve(null);
        };
        img.src = dataURL;
    });
}
