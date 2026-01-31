// ========================================
// MegaBonk Scan Build - Results Module
// ========================================
// Handles result processing, display, selection management
// ========================================

import type { Item, Tome, Character, Weapon, AllGameData } from '../types/index.ts';
import type { DetectionResult } from './ocr/index.ts';
import { ToastManager } from './toast.ts';
import { logger } from './logger.ts';
import { escapeHtml } from './utils.ts';
import { highlightDetectedEntity, updateItemCardCount } from './scan-build-ui.ts';
import type { SelectionState } from './scan-build-ui.ts';

/**
 * Detection results structure
 */
export interface DetectionResults {
    items: DetectionResult[];
    tomes: DetectionResult[];
    character: DetectionResult | null;
    weapon: DetectionResult | null;
}

/**
 * Get confidence class based on confidence level
 */
export function getConfidenceClass(confidence: number): string {
    if (confidence >= 0.8) return 'confidence-high';
    if (confidence >= 0.5) return 'confidence-medium';
    return 'confidence-low';
}

/**
 * Display detection confidence information
 */
export function displayDetectionConfidence(results: DetectionResults): void {
    const container = document.getElementById('scan-detection-info');
    if (!container) return;

    // Count detections by confidence level
    const allDetections: DetectionResult[] = [
        ...(results.character ? [results.character] : []),
        ...(results.weapon ? [results.weapon] : []),
        ...results.items,
        ...results.tomes,
    ];

    const highCount = allDetections.filter(d => d.confidence >= 0.8).length;
    const mediumCount = allDetections.filter(d => d.confidence >= 0.5 && d.confidence < 0.8).length;
    const lowCount = allDetections.filter(d => d.confidence < 0.5).length;
    const avgConfidence =
        allDetections.length > 0 ? allDetections.reduce((sum, d) => sum + d.confidence, 0) / allDetections.length : 0;

    let html = '<div class="scan-detection-results"><h4>🔍 Detection Confidence:</h4>';

    // Stats summary
    if (allDetections.length > 0) {
        html += `<div class="scan-detection-stats">
            <div class="scan-detection-stat stat-high">
                <span class="stat-count">${highCount}</span> high
            </div>
            <div class="scan-detection-stat stat-medium">
                <span class="stat-count">${mediumCount}</span> medium
            </div>
            <div class="scan-detection-stat stat-low">
                <span class="stat-count">${lowCount}</span> low
            </div>
            <div class="scan-detection-stat">
                Avg: <span class="stat-count">${Math.round(avgConfidence * 100)}%</span>
            </div>
        </div>`;
    }

    // Low confidence warning
    if (lowCount >= 3 || (lowCount > 0 && lowCount >= allDetections.length * 0.5)) {
        html += `<div class="scan-low-confidence-warning">
            <strong>⚠️ Many low-confidence detections</strong>
            Some items may be incorrectly identified. Review the selections below and adjust as needed.
        </div>`;
    }

    if (results.character) {
        const confClass = getConfidenceClass(results.character.confidence);
        html += `<div class="scan-detection-item">
            <span>Character: ${escapeHtml(results.character.entity.name)}</span>
            <span class="confidence ${confClass}">${Math.round(results.character.confidence * 100)}%</span>
        </div>`;
    }

    if (results.weapon) {
        const confClass = getConfidenceClass(results.weapon.confidence);
        html += `<div class="scan-detection-item">
            <span>Weapon: ${escapeHtml(results.weapon.entity.name)}</span>
            <span class="confidence ${confClass}">${Math.round(results.weapon.confidence * 100)}%</span>
        </div>`;
    }

    if (results.items.length > 0) {
        html += '<div class="scan-detection-section"><strong>Items:</strong>';
        results.items.forEach(item => {
            const confClass = getConfidenceClass(item.confidence);
            html += `<div class="scan-detection-item">
                <span>${escapeHtml(item.entity.name)}</span>
                <span class="confidence ${confClass}">${Math.round(item.confidence * 100)}%</span>
            </div>`;
        });
        html += '</div>';
    }

    if (results.tomes.length > 0) {
        html += '<div class="scan-detection-section"><strong>Tomes:</strong>';
        results.tomes.forEach(tome => {
            const confClass = getConfidenceClass(tome.confidence);
            html += `<div class="scan-detection-item">
                <span>${escapeHtml(tome.entity.name)}</span>
                <span class="confidence ${confClass}">${Math.round(tome.confidence * 100)}%</span>
            </div>`;
        });
        html += '</div>';
    }

    html += '<p class="scan-detection-hint">💡 Review and adjust selections below if needed</p></div>';
    container.innerHTML = html;
    container.style.display = 'block';
}

/**
 * Apply detection results to the state and UI
 */
export function applyDetectionResults(
    results: DetectionResults,
    allData: AllGameData,
    state: SelectionState,
    showGrid: () => void,
    updateSummary: () => void
): void {
    // Clear existing selections
    state.selectedItems.clear();
    state.selectedTomes.clear();
    state.selectedCharacter = null;
    state.selectedWeapon = null;

    // Show selection grid
    showGrid();

    // Apply character
    if (results.character) {
        state.selectedCharacter = results.character.entity as Character;
        highlightDetectedEntity('character', results.character.entity.id);
    }

    // Apply weapon
    if (results.weapon) {
        state.selectedWeapon = results.weapon.entity as Weapon;
        highlightDetectedEntity('weapon', results.weapon.entity.id);
    }

    // Apply items (deduplicate and count)
    const itemCounts = new Map<string, number>();
    results.items.forEach(detection => {
        // Bug fix: Check detection.entity exists before accessing .id
        if (!detection.entity) return;
        const item = detection.entity as Item;
        const currentCount = itemCounts.get(item.id) || 0;
        itemCounts.set(item.id, currentCount + 1);
    });

    itemCounts.forEach((count, itemId) => {
        // Bug fix: Use optional chaining on .find() to prevent TypeError if items array is undefined
        const item = allData.items?.items?.find(i => i.id === itemId);
        if (item) {
            state.selectedItems.set(item.id, { item, count });
            updateItemCardCount(item.id, count);
        }
    });

    // Apply tomes (unique)
    const uniqueTomes = new Set<string>();
    results.tomes.forEach(detection => {
        // Bug fix: Check detection.entity exists before accessing .id
        if (!detection.entity) return;
        const tome = detection.entity as Tome;
        if (!uniqueTomes.has(tome.id)) {
            uniqueTomes.add(tome.id);
            state.selectedTomes.set(tome.id, tome);
            highlightDetectedEntity('tome', tome.id);
        }
    });

    // Update summary
    updateSummary();

    // Show detection confidence info
    displayDetectionConfidence(results);
}

/**
 * Build state for advisor
 */
export interface BuildState {
    character: Character | null;
    weapon: Weapon | null;
    items: Item[];
    tomes: Tome[];
}

/**
 * Apply selections to the main advisor
 */
export function applyToAdvisor(
    state: SelectionState,
    onBuildStateChange: ((state: BuildState) => void) | null
): void {
    // Convert items map to array (expand counts)
    const items: Item[] = [];
    state.selectedItems.forEach(({ item, count }) => {
        for (let i = 0; i < count; i++) {
            items.push(item);
        }
    });

    const buildState: BuildState = {
        character: state.selectedCharacter,
        weapon: state.selectedWeapon,
        items,
        tomes: Array.from(state.selectedTomes.values()),
    };

    // Use callback if provided
    if (onBuildStateChange) {
        onBuildStateChange(buildState);
    }

    // Also call the global applyScannedBuild function if available
    // Use typed window lookup for better type safety
    const windowWithApply = window as Window & {
        applyScannedBuild?: (state: BuildState) => void;
    };
    if (typeof windowWithApply.applyScannedBuild === 'function') {
        windowWithApply.applyScannedBuild(buildState);
    }

    ToastManager.success('Build state applied to advisor!');

    logger.info({
        operation: 'scan_build.applied_to_advisor',
        data: {
            character: state.selectedCharacter?.name,
            weapon: state.selectedWeapon?.name,
            itemsCount: items.length,
            tomesCount: buildState.tomes.length,
        },
    });

    // Scroll to advisor section
    setTimeout(() => {
        const advisorSection = document.getElementById('advisor-current-build-section');
        advisorSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

/**
 * Scan state return type
 */
export interface ScanState {
    character: Character | null;
    weapon: Weapon | null;
    items: Array<{ id: string; name: string; count: number }>;
    tomes: Array<{ id: string; name: string }>;
}

/**
 * Get current scan state
 */
export function getScanState(state: SelectionState): ScanState {
    return {
        character: state.selectedCharacter,
        weapon: state.selectedWeapon,
        items: Array.from(state.selectedItems.entries()).map(([id, data]) => ({
            id,
            name: data.item.name,
            count: data.count,
        })),
        tomes: Array.from(state.selectedTomes.values()).map(t => ({ id: t.id, name: t.name })),
    };
}
