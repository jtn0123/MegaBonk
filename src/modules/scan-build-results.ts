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

export type DetectionSourceMethod = 'ocr' | 'cv' | 'hybrid';
export type DetectionReviewLevel = 'safe' | 'review' | 'risky';

export interface DetectionCorrection {
    entityId: string;
    entityName: string;
}

export interface DisplayDetectionResult extends DetectionResult {
    count?: number;
    position?: { x: number; y: number; width: number; height: number };
    sourceMethod: DetectionSourceMethod;
    reviewLevel: DetectionReviewLevel;
    reviewReasons: string[];
    correction?: DetectionCorrection;
}

/**
 * Detection results structure
 */
export interface DetectionResults {
    items: DisplayDetectionResult[];
    tomes: DisplayDetectionResult[];
    character: DisplayDetectionResult | null;
    weapon: DisplayDetectionResult | null;
}

export interface TrustSummary {
    safeCount: number;
    reviewCount: number;
    riskyCount: number;
    totalFlaggedCount: number;
    unresolvedRiskyCount: number;
    reviewedCount: number;
    manualReviewCount: number;
    explicitCorrectionCount: number;
}

interface DetectionReviewActions {
    onOpenCorrection?: (result: DisplayDetectionResult) => void;
}

interface DetectionTrustState {
    results: DetectionResults | null;
    correctedKeys: Set<string>;
    correctedCount: number;
    manualReviewCount: number;
    explicitCorrectionCount: number;
}

const detectionTrustState: DetectionTrustState = {
    results: null,
    correctedKeys: new Set(),
    correctedCount: 0,
    manualReviewCount: 0,
    explicitCorrectionCount: 0,
};

const detectionReviewActions: DetectionReviewActions = {};

function getDetectionKey(type: DisplayDetectionResult['type'], entityId: string): string {
    return `${type}:${entityId}`;
}

function getReviewLevel(confidence: number): DetectionReviewLevel {
    if (confidence >= 0.8) return 'safe';
    if (confidence >= 0.5) return 'review';
    return 'risky';
}

function getReviewLabel(level: DetectionReviewLevel): string {
    switch (level) {
        case 'safe':
            return 'Looks good';
        case 'review':
            return 'Review recommended';
        case 'risky':
            return 'Low confidence results';
    }
}

function getReviewClass(level: DetectionReviewLevel): string {
    switch (level) {
        case 'safe':
            return 'review-safe';
        case 'review':
            return 'review-review';
        case 'risky':
            return 'review-risky';
    }
}

function getSourceLabel(sourceMethod: DetectionSourceMethod): string {
    switch (sourceMethod) {
        case 'ocr':
            return 'OCR';
        case 'cv':
            return 'CV';
        case 'hybrid':
            return 'Hybrid';
    }
}

function getTargetSelector(type: DisplayDetectionResult['type'], entityId: string): string {
    switch (type) {
        case 'character':
            return `#scan-character-grid [data-id="${entityId}"]`;
        case 'weapon':
            return `#scan-weapon-grid [data-id="${entityId}"]`;
        case 'item':
            return `#scan-grid-items-container [data-id="${entityId}"]`;
        case 'tome':
            return `#scan-tome-grid [data-id="${entityId}"]`;
    }
}

function getResultsList(results: DetectionResults): DisplayDetectionResult[] {
    return [
        ...(results.character ? [results.character] : []),
        ...(results.weapon ? [results.weapon] : []),
        ...results.items,
        ...results.tomes,
    ];
}

function getUnresolvedDetectionsByLevel(level: DetectionReviewLevel): DisplayDetectionResult[] {
    if (!detectionTrustState.results) return [];

    return getResultsList(detectionTrustState.results).filter(result => {
        const key = getDetectionKey(result.type, result.entity.id);
        return result.reviewLevel === level && !detectionTrustState.correctedKeys.has(key);
    });
}

export function setDetectionReviewActions(actions: DetectionReviewActions): void {
    detectionReviewActions.onOpenCorrection = actions.onOpenCorrection;
}

export function getTrustSummary(): TrustSummary {
    if (!detectionTrustState.results) {
        return {
            safeCount: 0,
            reviewCount: 0,
            riskyCount: 0,
            totalFlaggedCount: 0,
            unresolvedRiskyCount: 0,
            reviewedCount: 0,
            manualReviewCount: 0,
            explicitCorrectionCount: 0,
        };
    }

    const allResults = getResultsList(detectionTrustState.results);
    return {
        safeCount: allResults.filter(result => result.reviewLevel === 'safe').length,
        reviewCount: allResults.filter(result => result.reviewLevel === 'review').length,
        riskyCount: allResults.filter(result => result.reviewLevel === 'risky').length,
        totalFlaggedCount: allResults.filter(result => result.reviewLevel !== 'safe').length,
        unresolvedRiskyCount: getUnresolvedDetectionsByLevel('risky').length,
        reviewedCount: detectionTrustState.correctedCount,
        manualReviewCount: detectionTrustState.manualReviewCount,
        explicitCorrectionCount: detectionTrustState.explicitCorrectionCount,
    };
}

export function resetDetectionReviewState(): void {
    detectionTrustState.results = null;
    detectionTrustState.correctedKeys.clear();
    detectionTrustState.correctedCount = 0;
    detectionTrustState.manualReviewCount = 0;
    detectionTrustState.explicitCorrectionCount = 0;
    renderTrustSummary();
}

export function markDetectionReviewed(type: DisplayDetectionResult['type'], entityId: string): void {
    if (!detectionTrustState.results) return;

    const key = getDetectionKey(type, entityId);
    const result = getResultsList(detectionTrustState.results).find(
        entry => getDetectionKey(entry.type, entry.entity.id) === key
    );

    if (!result || result.reviewLevel === 'safe' || detectionTrustState.correctedKeys.has(key)) {
        return;
    }

    detectionTrustState.correctedKeys.add(key);
    detectionTrustState.correctedCount += 1;
    detectionTrustState.manualReviewCount += 1;
    renderDetectionReview(detectionTrustState.results);
}

export function applyItemCorrection(detectedItemId: string, correctedItem: Item): void {
    if (!detectionTrustState.results) return;

    const result = detectionTrustState.results.items.find(item => item.entity.id === detectedItemId);
    if (!result) return;

    result.correction = {
        entityId: correctedItem.id,
        entityName: correctedItem.name,
    };
    detectionTrustState.explicitCorrectionCount += 1;
    markDetectionReviewed('item', detectedItemId);
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
 * Build a UI-facing detection result with review metadata.
 */
export function createDisplayDetectionResult(
    result: DetectionResult & { count?: number; position?: { x: number; y: number; width: number; height: number } },
    sourceMethod: DetectionSourceMethod,
    reviewReasons: string[] = []
): DisplayDetectionResult {
    const reviewLevel = getReviewLevel(result.confidence);
    const dedupedReasons = Array.from(
        new Set([...reviewReasons, ...(reviewLevel === 'review' || reviewLevel === 'risky' ? ['low confidence'] : [])])
    );

    return {
        ...result,
        sourceMethod,
        reviewLevel,
        reviewReasons: dedupedReasons,
    };
}

function renderDetectionSection(title: string, results: DisplayDetectionResult[], correctedKeys: Set<string>): string {
    if (results.length === 0) return '';

    const rows = results
        .map(result => {
            const key = getDetectionKey(result.type, result.entity.id);
            const isCorrected = correctedKeys.has(key);
            const reasonHtml = result.reviewReasons
                .map(reason => `<span class="scan-reason-chip">${escapeHtml(reason)}</span>`)
                .join('');
            const countHtml = result.count && result.count > 1 ? ` x${result.count}` : '';
            const reviewedHtml = isCorrected ? '<span class="scan-reviewed-badge">Reviewed</span>' : '';
            const correctionHtml = result.correction
                ? `<span class="scan-correction-note">Corrected to ${escapeHtml(result.correction.entityName)}</span>`
                : '';
            const actionHtml =
                result.reviewLevel === 'safe' || isCorrected
                    ? ''
                    : `<div class="scan-detection-item-actions">
                        <button type="button" class="scan-inline-action" data-mark-reviewed="true" data-review-type="${escapeHtml(result.type)}" data-review-id="${escapeHtml(result.entity.id)}">Mark reviewed</button>
                        ${
                            result.type === 'item'
                                ? `<button type="button" class="scan-inline-action" data-open-correction="true" data-review-id="${escapeHtml(result.entity.id)}">Correct</button>`
                                : ''
                        }
                    </div>`;

            return `<div class="scan-detection-item ${getReviewClass(result.reviewLevel)} ${isCorrected ? 'is-corrected' : ''}">
                <div class="scan-detection-main">
                    <span class="scan-detection-name">${escapeHtml(result.entity.name)}${countHtml}</span>
                    <span class="scan-source-badge source-${escapeHtml(result.sourceMethod)}">${getSourceLabel(result.sourceMethod)}</span>
                    ${reviewedHtml}
                    ${correctionHtml}
                </div>
                <div class="scan-detection-meta">
                    <span class="confidence ${getConfidenceClass(result.confidence)}">${Math.round(result.confidence * 100)}%</span>
                    ${reasonHtml ? `<div class="scan-reason-list">${reasonHtml}</div>` : ''}
                    ${actionHtml}
                </div>
            </div>`;
        })
        .join('');

    return `<div class="scan-detection-section">
        <strong>${title}</strong>
        ${rows}
    </div>`;
}

function attachReviewQueueHandlers(container: HTMLElement): void {
    container.querySelectorAll<HTMLElement>('[data-review-target]').forEach(button => {
        button.addEventListener('click', () => {
            const type = button.dataset.reviewType as DisplayDetectionResult['type'] | undefined;
            const entityId = button.dataset.reviewId;
            if (!type || !entityId) return;

            const target = document.querySelector<HTMLElement>(getTargetSelector(type, entityId));
            target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (target && !target.hasAttribute('tabindex')) {
                target.setAttribute('tabindex', '-1');
            }
            target?.focus?.();
        });
    });

    container.querySelectorAll<HTMLElement>('[data-mark-reviewed]').forEach(button => {
        button.addEventListener('click', () => {
            const type = button.dataset.reviewType as DisplayDetectionResult['type'] | undefined;
            const entityId = button.dataset.reviewId;
            if (!type || !entityId) return;
            markDetectionReviewed(type, entityId);
        });
    });

    container.querySelectorAll<HTMLElement>('[data-open-correction]').forEach(button => {
        button.addEventListener('click', () => {
            const entityId = button.dataset.reviewId;
            if (!entityId || !detectionTrustState.results || !detectionReviewActions.onOpenCorrection) return;

            const result = detectionTrustState.results.items.find(item => item.entity.id === entityId);
            if (!result) return;
            detectionReviewActions.onOpenCorrection(result);
        });
    });
}

function renderTrustSummary(): void {
    const container = document.getElementById('scan-trust-summary');
    if (!container) return;

    const summary = getTrustSummary();
    if (summary.totalFlaggedCount === 0 && summary.reviewedCount === 0) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }

    const unresolvedCopy =
        summary.unresolvedRiskyCount > 0
            ? `${summary.unresolvedRiskyCount} risky result${summary.unresolvedRiskyCount === 1 ? '' : 's'} still need attention.`
            : 'No unresolved risky results remain.';

    container.innerHTML = `
        <div class="scan-trust-summary-main">
            <div>
                <div class="scan-trust-summary-title">Trust Summary</div>
                <div class="scan-trust-summary-copy">${unresolvedCopy}</div>
            </div>
            <div class="scan-trust-summary-stats">
                <span class="scan-trust-chip review">${summary.totalFlaggedCount} flagged</span>
                <span class="scan-trust-chip risky">${summary.unresolvedRiskyCount} unresolved risky</span>
                <span class="scan-trust-chip reviewed">${summary.reviewedCount} reviewed</span>
                <span class="scan-trust-chip corrected">${summary.explicitCorrectionCount} corrected</span>
            </div>
        </div>
    `;
    container.style.display = 'block';
}

/**
 * Display detection review information.
 */
export function renderDetectionReview(results: DetectionResults): void {
    const container = document.getElementById('scan-detection-info');
    if (!container) return;

    detectionTrustState.results = results;

    const allDetections = getResultsList(results);
    const correctedKeys = detectionTrustState.correctedKeys;
    const highCount = allDetections.filter(d => d.reviewLevel === 'safe').length;
    const mediumCount = allDetections.filter(d => d.reviewLevel === 'review').length;
    const lowCount = allDetections.filter(d => d.reviewLevel === 'risky').length;
    const avgConfidence =
        allDetections.length > 0 ? allDetections.reduce((sum, d) => sum + d.confidence, 0) / allDetections.length : 0;
    const reviewQueue = allDetections.filter(
        d => d.reviewLevel !== 'safe' && !correctedKeys.has(getDetectionKey(d.type, d.entity.id))
    );
    const overallStatus: DetectionReviewLevel = lowCount > 0 ? 'risky' : mediumCount > 0 ? 'review' : 'safe';

    let html = '<div class="scan-detection-results"><h4>🔍 Scan Review</h4>';

    if (allDetections.length > 0) {
        html += `<div class="scan-detection-stats">
            <div class="scan-detection-stat">
                <span class="stat-count">${allDetections.length}</span> total
            </div>
            <div class="scan-detection-stat stat-high">
                <span class="stat-count">${highCount}</span> safe
            </div>
            <div class="scan-detection-stat stat-medium">
                <span class="stat-count">${mediumCount}</span> review
            </div>
            <div class="scan-detection-stat stat-low">
                <span class="stat-count">${lowCount}</span> risky
            </div>
            <div class="scan-detection-stat">
                Avg: <span class="stat-count">${Math.round(avgConfidence * 100)}%</span>
            </div>
        </div>`;

        html += `<div class="scan-review-banner ${getReviewClass(overallStatus)} ${overallStatus === 'risky' ? 'scan-low-confidence-warning' : ''}">
            <strong>${getReviewLabel(overallStatus)}</strong>
            <span>${reviewQueue.length > 0 ? `${reviewQueue.length} result${reviewQueue.length === 1 ? '' : 's'} need attention before you apply.` : 'No flagged results. You can apply the detected build as-is.'}</span>
        </div>`;
    }

    if (reviewQueue.length > 0) {
        html += '<div class="scan-detection-section"><strong>Review Queue</strong>';
        reviewQueue.forEach(result => {
            const reasons = result.reviewReasons
                .map(reason => `<span class="scan-reason-chip">${escapeHtml(reason)}</span>`)
                .join('');
            html += `<div class="scan-review-queue-item ${getReviewClass(result.reviewLevel)}">
                <div class="scan-review-queue-main">
                    <span class="scan-review-name">${escapeHtml(result.entity.name)}</span>
                    <span class="scan-review-type">${escapeHtml(result.type)}</span>
                    <span class="scan-source-badge source-${escapeHtml(result.sourceMethod)}">${getSourceLabel(result.sourceMethod)}</span>
                </div>
                <div class="scan-review-queue-meta">
                    <span class="confidence ${getConfidenceClass(result.confidence)}">${Math.round(result.confidence * 100)}%</span>
                    <div class="scan-reason-list">${reasons}</div>
                </div>
                <div class="scan-review-queue-actions">
                    <button type="button" class="scan-inline-action" data-review-target="true" data-review-type="${escapeHtml(result.type)}" data-review-id="${escapeHtml(result.entity.id)}">Jump to selection</button>
                    <button type="button" class="scan-inline-action" data-mark-reviewed="true" data-review-type="${escapeHtml(result.type)}" data-review-id="${escapeHtml(result.entity.id)}">Mark reviewed</button>
                    ${
                        result.type === 'item'
                            ? `<button type="button" class="scan-inline-action" data-open-correction="true" data-review-id="${escapeHtml(result.entity.id)}">Correct</button>`
                            : ''
                    }
                </div>
            </div>`;
        });
        html += '</div>';
    }

    html += renderDetectionSection('Character', results.character ? [results.character] : [], correctedKeys);
    html += renderDetectionSection('Weapon', results.weapon ? [results.weapon] : [], correctedKeys);
    html += renderDetectionSection('Items', results.items, correctedKeys);
    html += renderDetectionSection('Tomes', results.tomes, correctedKeys);

    html += '<p class="scan-detection-hint">💡 Review and adjust selections below if needed</p></div>';
    container.innerHTML = html;
    container.style.display = 'block';
    renderTrustSummary();
    attachReviewQueueHandlers(container);
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
    resetDetectionReviewState();

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
        itemCounts.set(item.id, currentCount + (detection.count || 1));
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

    // Show detection review info
    renderDetectionReview(results);
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
export function applyToAdvisor(state: SelectionState, onBuildStateChange: ((state: BuildState) => void) | null): void {
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

    const unresolvedRisky = getUnresolvedDetectionsByLevel('risky');
    if (unresolvedRisky.length > 0) {
        ToastManager.warning(
            `Applying build with ${unresolvedRisky.length} risky detection${unresolvedRisky.length === 1 ? '' : 's'} still unresolved`
        );
    }

    // Use callback if provided
    if (onBuildStateChange) {
        onBuildStateChange(buildState);
    }

    // Also call the global applyScannedBuild function if available
    // Use typed window lookup for better type safety
    if (typeof globalThis.applyScannedBuild === 'function') {
        globalThis.applyScannedBuild(buildState);
    }

    ToastManager.success('Build state applied to advisor!');

    logger.info({
        operation: 'scan_build.applied_to_advisor',
        data: {
            character: state.selectedCharacter?.name,
            weapon: state.selectedWeapon?.name,
            itemsCount: items.length,
            tomesCount: buildState.tomes.length,
            trust: {
                ...getTrustSummary(),
                correctedCount: detectionTrustState.correctedCount,
                appliedWithUnresolvedRisky: unresolvedRisky.length > 0,
            },
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
