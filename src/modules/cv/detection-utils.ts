// ========================================
// CV Detection Utility Functions
// ========================================

import { logger } from '../logger.ts';
import type { CVDetectionResult, ROI } from './types.ts';

// ========================================
// Similarity / Geometry Utilities
// ========================================

/**
 * Calculate Intersection over Union (IoU) between two boxes
 * Used for Non-Maximum Suppression
 */
export function calculateIoU(box1: ROI, box2: ROI): number {
    const x1 = Math.max(box1.x, box2.x);
    const y1 = Math.max(box1.y, box2.y);
    const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
    const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

    const intersectionWidth = Math.max(0, x2 - x1);
    const intersectionHeight = Math.max(0, y2 - y1);
    const intersectionArea = intersectionWidth * intersectionHeight;

    const box1Area = box1.width * box1.height;
    const box2Area = box2.width * box2.height;
    const unionArea = box1Area + box2Area - intersectionArea;

    return unionArea > 0 ? intersectionArea / unionArea : 0;
}

/**
 * Non-Maximum Suppression to remove overlapping detections
 * Keeps highest confidence detection when boxes overlap
 */
export function nonMaxSuppression(detections: CVDetectionResult[], iouThreshold: number = 0.3): CVDetectionResult[] {
    if (detections.length === 0) return [];

    // Sort by confidence (highest first)
    const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
    const kept: CVDetectionResult[] = [];

    for (const detection of sorted) {
        if (!detection.position) {
            kept.push(detection);
            continue;
        }

        // Check if this detection overlaps with any already kept
        let shouldKeep = true;
        for (const keptDetection of kept) {
            if (!keptDetection.position) continue;

            const iou = calculateIoU(detection.position, keptDetection.position);
            if (iou > iouThreshold) {
                shouldKeep = false;
                break;
            }
        }

        if (shouldKeep) {
            kept.push(detection);
        }
    }

    return kept;
}

// ========================================
// Image Data Utilities
// ========================================

/**
 * Resize ImageData to target dimensions
 * Returns null if canvas context cannot be obtained
 * Exported for use by CV Validator and other library consumers
 */
export function resizeImageData(imageData: ImageData, targetWidth: number, targetHeight: number): ImageData | null {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
        logger.warn({
            operation: 'cv.resize_image_data',
            error: { name: 'CanvasError', message: 'Failed to get source canvas 2D context' },
        });
        return null;
    }
    ctx.putImageData(imageData, 0, 0);

    // Create output canvas
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = targetWidth;
    outputCanvas.height = targetHeight;

    const outputCtx = outputCanvas.getContext('2d', { willReadFrequently: true });
    if (!outputCtx) {
        logger.warn({
            operation: 'cv.resize_image_data',
            error: { name: 'CanvasError', message: 'Failed to get output canvas 2D context' },
        });
        return null;
    }
    outputCtx.drawImage(canvas, 0, 0, imageData.width, imageData.height, 0, 0, targetWidth, targetHeight);

    return outputCtx.getImageData(0, 0, targetWidth, targetHeight);
}

// ========================================
// Region Extraction Utilities
// ========================================

/**
 * Extract icon region from cell, excluding count number area
 * Count numbers are typically in bottom-right corner (last 25-30% of cell)
 */
export function extractIconRegion(ctx: CanvasRenderingContext2D, cell: ROI): ImageData {
    // Extract 80% of cell to avoid count number area in bottom-right
    let iconWidth = Math.floor(cell.width * 0.8);
    let iconHeight = Math.floor(cell.height * 0.8);

    // Ensure minimum size
    iconWidth = Math.max(1, iconWidth);
    iconHeight = Math.max(1, iconHeight);

    // Bounds check: ensure we don't exceed canvas dimensions
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    const safeX = Math.max(0, Math.min(cell.x, canvasWidth - 1));
    const safeY = Math.max(0, Math.min(cell.y, canvasHeight - 1));
    const safeWidth = Math.min(iconWidth, canvasWidth - safeX);
    const safeHeight = Math.min(iconHeight, canvasHeight - safeY);

    // Return empty ImageData if dimensions are invalid
    if (safeWidth <= 0 || safeHeight <= 0) {
        return ctx.createImageData(1, 1);
    }

    return ctx.getImageData(safeX, safeY, safeWidth, safeHeight);
}

/**
 * Extract count region from cell (bottom-right corner)
 */
export function extractCountRegion(cell: ROI): ROI {
    const countSize = Math.min(25, Math.floor(cell.width * 0.25));

    return {
        x: cell.x + cell.width - countSize,
        y: cell.y + cell.height - countSize,
        width: countSize,
        height: countSize,
        label: `${cell.label || 'cell'}_count`,
    };
}

// ========================================
// Caching Utilities
// ========================================

/**
 * Generate hash from image data URL for caching
 * Uses DJB2 hash algorithm with higher sample count for better collision resistance
 */
export function hashImageDataUrl(dataUrl: string): string {
    const len = dataUrl.length;
    let hash1 = 5381; // DJB2 initial value
    let hash2 = 0;

    // Sample more characters for better collision resistance
    // Use 500 samples instead of 100, and include start/middle/end regions
    const sampleCount = Math.min(500, len);
    const step = Math.max(1, Math.floor(len / sampleCount));

    // DJB2 hash on sampled characters
    // Use >>> 0 inside loop to keep values as unsigned 32-bit integers
    // This prevents overflow beyond JS safe integer range
    for (let i = 0; i < len; i += step) {
        const char = dataUrl.charCodeAt(i);
        hash1 = (((hash1 << 5) + hash1) ^ char) >>> 0; // hash * 33 ^ char, kept as uint32
    }

    // Secondary hash from end of string for additional uniqueness
    const endSampleStart = Math.max(0, len - 1000);
    for (let i = endSampleStart; i < len; i += 10) {
        const char = dataUrl.charCodeAt(i);
        hash2 = ((hash2 << 5) + hash2 + char) >>> 0; // kept as uint32
    }

    // Combine both hashes with length for final key
    // Use >>> 0 to ensure unsigned 32-bit integer
    return `img_${(hash1 >>> 0).toString(16)}_${(hash2 >>> 0).toString(16)}_${len}`;
}

// ========================================
// Template Size Utilities
// ========================================

import { COMMON_ICON_SIZES } from './state.ts';

/**
 * Find the closest pre-generated template size
 */
export function findClosestTemplateSize(targetSize: number): number {
    let closest: number = COMMON_ICON_SIZES[0] ?? 48;
    let minDiff = Math.abs(targetSize - closest);

    for (const size of COMMON_ICON_SIZES) {
        const diff = Math.abs(targetSize - size);
        if (diff < minDiff) {
            minDiff = diff;
            closest = size;
        }
    }

    return closest;
}
