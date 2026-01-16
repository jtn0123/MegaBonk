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
