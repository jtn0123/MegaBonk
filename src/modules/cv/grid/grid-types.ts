// ========================================
// Grid Detection Types and Interfaces
// ========================================

import type { CVDetectionResult } from '../types.ts';

/**
 * Grid parameters detected from icon edges
 */
export interface GridParameters {
    startX: number;
    startY: number;
    cellWidth: number;
    cellHeight: number;
    columns: number;
    rows: number;
    confidence: number;
}

/**
 * Result of grid verification
 */
export interface GridVerificationResult {
    isValid: boolean;
    confidence: number;
    filteredDetections: CVDetectionResult[];
    gridParams: {
        xSpacing: number;
        ySpacing: number;
        tolerance: number;
    } | null;
}

/**
 * Dynamic scale detection result
 */
export interface ScaleDetectionResult {
    iconSize: number;
    confidence: number;
    method: 'edge_analysis' | 'resolution_fallback';
}

/**
 * Hotbar region detected in the image
 */
export interface HotbarRegion {
    topY: number;
    bottomY: number;
    confidence: number;
}
