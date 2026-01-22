// ========================================
// CV Types and Interfaces
// ========================================

import type { Item, Tome, Character, Weapon } from '../../types/index.ts';

/**
 * CV detection result with position
 */
export interface CVDetectionResult {
    type: 'item' | 'tome' | 'character' | 'weapon';
    entity: Item | Tome | Character | Weapon;
    confidence: number;
    position?: { x: number; y: number; width: number; height: number };
    method: 'template_match' | 'icon_similarity' | 'hybrid';
}

/**
 * Region of interest for analysis
 */
export interface ROI {
    x: number;
    y: number;
    width: number;
    height: number;
    label?: string;
}

/**
 * Template cache for item images
 */
export interface TemplateData {
    image: HTMLImageElement;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
}

// ========================================
// Grid Preset Types
// ========================================

/**
 * Grid calibration values for a specific resolution
 */
export interface PresetCalibration {
    xOffset: number;
    yOffset: number;
    iconWidth: number;
    iconHeight: number;
    xSpacing: number;
    ySpacing: number;
    iconsPerRow: number;
    numRows: number;
}

/**
 * A single grid preset for a resolution
 */
export interface GridPreset {
    name: string;
    resolution: {
        width: number;
        height: number;
    };
    calibration: PresetCalibration;
    lastModified: string;
    source?: 'auto-detected' | 'manual' | 'default' | 'imported';
}

/**
 * Grid presets file structure
 */
export interface GridPresetsFile {
    version: string;
    description: string;
    lastModified: string;
    presets: Record<string, GridPreset>;
}
