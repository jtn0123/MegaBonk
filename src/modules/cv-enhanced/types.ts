// ========================================
// Enhanced CV Types
// ========================================
// Type definitions for the enhanced computer vision module

import type { CVDetectionResult, ROI } from '../computer-vision.ts';
import type { CVStrategy, ColorProfile, HSVColor } from '../cv-strategy.ts';

// Re-export types for backwards compatibility
export type { CVDetectionResult, ROI, CVStrategy, ColorProfile, HSVColor };

/**
 * Template data with enhanced color information
 */
export interface EnhancedTemplateData {
    image: HTMLImageElement;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
    colorProfile: ColorProfile;
    hsvColor: HSVColor;
    rarity: string;
}

/**
 * Valid cell data after empty cell filtering
 */
export interface ValidCellData {
    cell: ROI;
    imageData: ImageData;
    rarity?: string;
    colorProfile?: ColorProfile;
}

/**
 * Match result from cell matching
 */
export interface CellMatchResult {
    item: import('../../types/index.ts').Item;
    similarity: number;
}

/**
 * Progress callback type
 */
export type ProgressCallback = (progress: number, status: string) => void;
