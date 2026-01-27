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
 */
export function isInventoryBackground(imageData) {
    const pixels = imageData.data;
    const bg = CONFIG.INVENTORY_BG_COLOR;
    let matchingPixels = 0;
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

            // Check if pixel is within tolerance of background color
            if (
                Math.abs(r - bg.r) <= bg.tolerance &&
                Math.abs(g - bg.g) <= bg.tolerance &&
                Math.abs(b - bg.b) <= bg.tolerance
            ) {
                matchingPixels++;
            }
            count++;
        }
    }

    // If >70% of center pixels match background, likely empty
    return count > 0 && matchingPixels / count > 0.7;
}

/**
 * Check if a cell is empty (Phase 1: per-cell analysis)
 * Uses multiple signals: variance, edge density, background color
 * LESS strict than before to avoid false negatives on real items
 */
export function isEmptyCell(imageData) {
    // Use shared library if available (but our local version may be better tuned)
    // Disabled: we want to use our improved local implementation
    // if (useSharedLibrary && sharedLibrary?.isEmptyCell) {
    //     return sharedLibrary.isEmptyCell(imageData);
    // }

    const pixels = imageData.data;
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

    // Check 1: Very dark cells are empty
    if (meanGray < CONFIG.EMPTY_CELL_MEAN_THRESHOLD) {
        return true;
    }

    // Check 2: Very low variance (truly uniform color) - MUST also pass edge check
    if (totalVariance < CONFIG.EMPTY_CELL_VARIANCE_THRESHOLD) {
        // Additional confirmation: check edge density
        const edgeDensity = calculateEdgeDensity(imageData);
        if (edgeDensity < CONFIG.EMPTY_CELL_EDGE_THRESHOLD) {
            return true;
        }
        // Low variance but has edges - might be an item with uniform colors
        // Also check if it matches inventory background specifically
        if (isInventoryBackground(imageData)) {
            return true;
        }
    }

    // Check 3: Matches inventory background color pattern
    // Only if variance is reasonably low (< 1000) to avoid matching colorful items
    if (totalVariance < 1000 && isInventoryBackground(imageData)) {
        const edgeDensity = calculateEdgeDensity(imageData);
        if (edgeDensity < CONFIG.EMPTY_CELL_EDGE_THRESHOLD * 2) {
            return true;
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
 * Fill pattern:
 * - Row 0 (bottom): Items fill from CENTER, expand LEFT and RIGHT
 * - Row 1+: Items fill from LEFT to RIGHT
 *
 * Logic:
 * - If we find N consecutive empty cells, assume rest of row is empty
 * - Exception: cells with high match confidence should not be skipped
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
        rows[r] = cells.filter(c => c.cell.row === r);
    }

    // Process each row
    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
        const rowCells = rows[rowIdx];
        if (!rowCells || rowCells.length === 0) continue;

        // Sort by column position
        rowCells.sort((a, b) => a.cell.col - b.cell.col);

        if (rowIdx === 0) {
            // Row 0: Center-fill pattern
            // Find center of the row
            const centerCol = Math.floor(iconsPerRow / 2);

            // Scan LEFT from center: after N consecutive empties, rest is empty
            let consecutiveEmptyLeft = 0;
            let leftCutoff = -1;
            for (let i = rowCells.length - 1; i >= 0; i--) {
                const c = rowCells[i];
                if (c.cell.col >= centerCol) continue; // Only process left side

                if (c.isEmpty) {
                    consecutiveEmptyLeft++;
                    if (consecutiveEmptyLeft >= threshold && leftCutoff < 0) {
                        leftCutoff = c.cell.col;
                    }
                } else {
                    consecutiveEmptyLeft = 0;
                }
            }

            // Scan RIGHT from center: after N consecutive empties, rest is empty
            let consecutiveEmptyRight = 0;
            let rightCutoff = iconsPerRow;
            for (const c of rowCells) {
                if (c.cell.col < centerCol) continue; // Only process right side

                if (c.isEmpty) {
                    consecutiveEmptyRight++;
                    if (consecutiveEmptyRight >= threshold && rightCutoff === iconsPerRow) {
                        rightCutoff = c.cell.col - threshold + 1;
                    }
                } else {
                    consecutiveEmptyRight = 0;
                }
            }

            // Mark cells outside cutoffs as empty (unless they have high confidence)
            for (const c of rowCells) {
                if (leftCutoff >= 0 && c.cell.col < leftCutoff) {
                    c.isEmpty = true;
                    c.fillPatternEmpty = true;
                }
                if (c.cell.col >= rightCutoff) {
                    c.isEmpty = true;
                    c.fillPatternEmpty = true;
                }
            }
        } else {
            // Row 1+: Left-to-right fill pattern
            // After N consecutive empties, rest of row is empty
            let consecutiveEmpty = 0;
            let cutoffCol = iconsPerRow;

            for (const c of rowCells) {
                if (c.isEmpty) {
                    consecutiveEmpty++;
                    if (consecutiveEmpty >= threshold && cutoffCol === iconsPerRow) {
                        cutoffCol = c.cell.col - threshold + 1;
                    }
                } else {
                    consecutiveEmpty = 0;
                }
            }

            // Mark cells after cutoff as empty
            for (const c of rowCells) {
                if (c.cell.col >= cutoffCol) {
                    c.isEmpty = true;
                    c.fillPatternEmpty = true;
                }
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
    const nonEmptyCells = [];

    // First pass: find non-empty cells, track empty ones
    for (const cell of gridPositions) {
        const cellData = ctx.getImageData(cell.x, cell.y, cell.width, cell.height);
        if (!isEmptyCell(cellData)) {
            nonEmptyCells.push({ cell, cellData });
        } else {
            // Track empty cells so they can be corrected if wrongly classified
            const cropDataURL = imageDataToDataURL(cellData);
            state.emptyCells.set(cell.slotIndex, {
                position: cell,
                cropDataURL: cropDataURL,
            });
        }
    }

    log(`Found ${nonEmptyCells.length} non-empty cells`);

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

        // Store detection data for this slot
        if (bestMatch && bestMatch.confidence >= threshold) {
            detections.push(bestMatch);

            // Generate crop data URL for display
            const cropDataURL = imageDataToDataURL(cellData);

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
