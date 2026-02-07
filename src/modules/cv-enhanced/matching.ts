// ========================================
// Enhanced CV Matching
// ========================================
// Cell matching, candidate filtering, and multi-pass detection

import type { Item } from '../../types/index.ts';
import type { ROI } from '../computer-vision.ts';
import type { CVStrategy, ColorProfile } from '../cv-strategy.ts';
import { getConfidenceThresholds, compareColorProfiles, getSimilarityPenalty } from '../cv-strategy.ts';
import { isEmptyCell, detectBorderRarity } from '../cv/color.ts';
import { extractColorProfile } from '../cv-strategy.ts';
import { calculateSimilarity } from './similarity.ts';
import { resizeImageData } from './utils.ts';
import { getEnhancedTemplate, getTemplatesByRarity, getTemplatesByColor } from './templates.ts';
import type { CVDetectionResult } from '../computer-vision.ts';
import type { ValidCellData, CellMatchResult, ProgressCallback } from './types.ts';

/**
 * Filter valid cells from grid positions (removes empty cells)
 */
export function filterValidCells(
    ctx: CanvasRenderingContext2D,
    gridPositions: ROI[],
    strategy: CVStrategy
): ValidCellData[] {
    const validCells: ValidCellData[] = [];

    for (const cell of gridPositions) {
        const cellImageData = ctx.getImageData(cell.x, cell.y, cell.width, cell.height);

        if (strategy.useEmptyCellDetection && isEmptyCell(cellImageData)) {
            continue;
        }

        // Extract rarity if using rarity-first filtering
        let cellRarity: string | undefined;
        if (strategy.colorFiltering === 'rarity-first') {
            cellRarity = detectBorderRarity(cellImageData) || undefined;
        }

        // Extract color profile for multi-region analysis
        let cellColorProfile: ColorProfile | undefined;
        if (strategy.colorAnalysis === 'multi-region') {
            cellColorProfile = extractColorProfile(cellImageData);
        }

        validCells.push({ cell, imageData: cellImageData, rarity: cellRarity, colorProfile: cellColorProfile });
    }

    return validCells;
}

/**
 * Filter candidate items based on strategy
 */
export function filterCandidates(
    items: Item[],
    strategy: CVStrategy,
    cellRarity?: string,
    cellColorProfile?: ColorProfile
): Item[] {
    let candidates = items;

    if (strategy.colorFiltering === 'rarity-first' && cellRarity) {
        // Rarity-first: Filter by rarity AND color
        const rarityItems = getTemplatesByRarity(cellRarity);

        if (cellColorProfile) {
            candidates = rarityItems.filter(item => {
                const template = getEnhancedTemplate(item.id);
                if (!template) return false;

                const colorMatch = compareColorProfiles(template.colorProfile, cellColorProfile);
                return colorMatch >= 0.5; // At least 50% color profile match
            });
        } else {
            candidates = rarityItems;
        }

        // Fallback to all items if no matches
        if (candidates.length === 0) candidates = items;
    } else if (strategy.colorFiltering === 'color-first') {
        // Color-first: Filter by dominant color
        if (cellColorProfile) {
            const colorItems = getTemplatesByColor(cellColorProfile.dominant);
            candidates = colorItems.length > 0 ? colorItems : items;
        }
    }

    return candidates;
}

/**
 * Match a cell against candidate items
 */
export function matchCell(cellImageData: ImageData, candidates: Item[], strategy: CVStrategy): CellMatchResult | null {
    let bestMatch: CellMatchResult | null = null;

    for (const item of candidates) {
        const template = getEnhancedTemplate(item.id);
        if (!template) continue;

        // Get template image data
        const templateImageData = template.ctx.getImageData(0, 0, template.width, template.height);

        // Resize template to match cell size
        const resizedTemplate = resizeImageData(templateImageData, cellImageData.width, cellImageData.height);

        // Calculate similarity using strategy algorithm
        let similarity = calculateSimilarity(cellImageData, resizedTemplate, strategy.matchingAlgorithm);

        // Apply feedback loop penalty if enabled
        if (strategy.useFeedbackLoop) {
            const penalty = getSimilarityPenalty(item.id, item.id);
            similarity += penalty;
        }

        // Apply context boosting if enabled
        // Common items need stricter matching (penalize to reduce false positives)
        // Legendary items are distinctive (boost since gold borders help identification)
        if (strategy.useContextBoosting) {
            if (item.rarity === 'legendary') similarity += 0.03;
            else if (item.rarity === 'epic') similarity += 0.02;
            else if (item.rarity === 'common') similarity -= 0.02;
        }

        // Apply border validation if enabled
        if (strategy.useBorderValidation) {
            const detectedRarity = detectBorderRarity(cellImageData);
            if (detectedRarity === item.rarity) {
                similarity *= 1.05;
            } else if (detectedRarity && detectedRarity !== item.rarity) {
                similarity *= 0.85;
            }
        }

        // Clamp similarity
        similarity = Math.max(0, Math.min(0.99, similarity));

        if (!bestMatch || similarity > bestMatch.similarity) {
            bestMatch = { item, similarity };
        }
    }

    // Similarity floor: reject matches below 0.35 absolute similarity
    // This prevents low-confidence garbage matches from propagating
    const SIMILARITY_FLOOR = 0.35;
    if (bestMatch && bestMatch.similarity < SIMILARITY_FLOOR) {
        return null;
    }

    return bestMatch;
}

/**
 * Multi-pass matching with strategy
 */
export function multiPassMatching(
    validCells: ValidCellData[],
    items: Item[],
    strategy: CVStrategy,
    progressCallback?: ProgressCallback
): CVDetectionResult[] {
    const detections: CVDetectionResult[] = [];
    const matchedCells = new Set<ROI>();

    const allThresholds = getConfidenceThresholds(strategy);

    // Pass 1: High confidence
    if (progressCallback) progressCallback(40, 'Pass 1: High confidence...');

    for (const { cell, imageData, rarity, colorProfile } of validCells) {
        const candidates = filterCandidates(items, strategy, rarity, colorProfile);
        const thresholds = rarity ? getConfidenceThresholds(strategy, rarity) : allThresholds;

        const match = matchCell(imageData, candidates, strategy);

        if (match && match.similarity >= thresholds.pass1) {
            detections.push({
                type: 'item',
                entity: match.item,
                confidence: match.similarity,
                position: cell,
                method: 'template_match',
            });
            matchedCells.add(cell);
        }
    }

    // Pass 2: Medium confidence
    if (progressCallback) progressCallback(60, 'Pass 2: Medium confidence...');

    const unmatchedAfterPass1 = validCells.filter(({ cell }) => !matchedCells.has(cell));

    for (const { cell, imageData, rarity, colorProfile } of unmatchedAfterPass1) {
        const candidates = filterCandidates(items, strategy, rarity, colorProfile);
        const thresholds = rarity ? getConfidenceThresholds(strategy, rarity) : allThresholds;

        const match = matchCell(imageData, candidates, strategy);

        if (match && match.similarity >= thresholds.pass2) {
            detections.push({
                type: 'item',
                entity: match.item,
                confidence: match.similarity,
                position: cell,
                method: 'template_match',
            });
            matchedCells.add(cell);
        }
    }

    // Pass 3: Low confidence with context
    if (progressCallback) progressCallback(80, 'Pass 3: Low confidence with validation...');

    const unmatchedAfterPass2 = validCells.filter(({ cell }) => !matchedCells.has(cell));

    for (const { cell, imageData, rarity, colorProfile } of unmatchedAfterPass2) {
        const candidates = filterCandidates(items, strategy, rarity, colorProfile);
        const thresholds = rarity ? getConfidenceThresholds(strategy, rarity) : allThresholds;

        const match = matchCell(imageData, candidates, strategy);

        if (match && match.similarity >= thresholds.pass3) {
            detections.push({
                type: 'item',
                entity: match.item,
                confidence: match.similarity,
                position: cell,
                method: 'template_match',
            });
            matchedCells.add(cell);
        }
    }

    return detections;
}

/**
 * Single-pass matching (for fast strategy)
 */
export function singlePassMatching(
    validCells: ValidCellData[],
    items: Item[],
    strategy: CVStrategy,
    progressCallback?: ProgressCallback
): CVDetectionResult[] {
    const detections: CVDetectionResult[] = [];

    for (let i = 0; i < validCells.length; i++) {
        const validCell = validCells[i];
        if (!validCell) continue;
        const { cell, imageData, rarity, colorProfile } = validCell;

        if (progressCallback && i % 5 === 0) {
            const progress = 40 + Math.floor((i / validCells.length) * 50);
            progressCallback(progress, `Matching ${i + 1}/${validCells.length}...`);
        }

        const candidates = filterCandidates(items, strategy, rarity, colorProfile);
        const match = matchCell(imageData, candidates, strategy);

        // Use rarity-based thresholds per cell for adaptive detection
        const thresholds = getConfidenceThresholds(strategy, rarity);
        if (match && match.similarity >= thresholds.pass2) {
            detections.push({
                type: 'item',
                entity: match.item,
                confidence: match.similarity,
                position: cell,
                method: 'template_match',
            });
        }
    }

    return detections;
}
