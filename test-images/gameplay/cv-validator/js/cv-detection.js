/* ========================================
 * CV Validator - CV Detection
 * Grid detection, NCC, template matching
 * ======================================== */

import { CONFIG } from './config.js';
import { state } from './state.js';
import { log } from './utils.js';

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

    // Apply manual Y offset for calibration (scaled to image size)
    // Rebased: slider 0 = old -100 (typical position), slider +100 = old 0
    const scaledYOffset = Math.round((cal.yOffset - 100) * scale);
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

        const startX = baseStartX + scaledXOffset;

        for (let col = 0; col < cal.iconsPerRow; col++) {
            // Stop if we've reached totalItems limit
            if (slotIndex >= maxItems) break;

            positions.push({
                x: startX + col * (iconW + spacingX),
                y: rowY,
                width: iconW,
                height: iconH,
                slotIndex: slotIndex,
                row: rowIndex,
                col: col,
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
// Empty Cell Detection
// ========================================

export function isEmptyCell(imageData) {
    const pixels = imageData.data;
    let sum = 0,
        sumSq = 0,
        count = 0;

    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const gray = (r + g + b) / 3;
        sum += gray;
        sumSq += gray * gray;
        count++;
    }

    const mean = sum / count;
    const variance = sumSq / count - mean * mean;

    // Low variance or very dark = empty
    return variance < CONFIG.EMPTY_CELL_VARIANCE_THRESHOLD || mean < CONFIG.EMPTY_CELL_MEAN_THRESHOLD;
}

// ========================================
// NCC (Normalized Cross-Correlation)
// ========================================

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

    if (denominator === 0) return 0;
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

    log(`Scanning ${gridPositions.length} grid positions...`);

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

            const similarity = calculateNCC(centerData, resizedTemplate);

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
