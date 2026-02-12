// ========================================
// CV Active Learning Prompts
// ========================================
// Prompts users to verify uncertain detections to improve accuracy

import type { Item, AllGameData } from '../../types/index.ts';
// Dynamically load active-learning CSS only when ML feedback features are active
import '../../styles/active-learning.css';
import { logger } from '../logger.ts';
import { addCorrection, startFeedbackSession, downloadFeedback, getCorrectionCount } from './training-feedback.ts';
import type { DetectionForFeedback } from './training-feedback.ts';
import { escapeHtml } from '../utils.ts';

// ========================================
// Types
// ========================================

/**
 * An uncertain detection needing verification
 */
export interface UncertainDetection {
    detection: DetectionForFeedback;
    alternatives: Item[];
    cropDataUrl?: string;
}

/**
 * User's verification response
 */
export interface VerificationResponse {
    detectionId: string;
    isCorrect: boolean;
    correctedItemId?: string;
    correctedItemName?: string;
}

/**
 * Active learning session state
 */
export interface ActiveLearningSession {
    uncertainDetections: UncertainDetection[];
    currentIndex: number;
    responses: VerificationResponse[];
    startedAt: string;
}

// ========================================
// Configuration
// ========================================

const CONFIG = {
    UNCERTAINTY_THRESHOLD: 0.6, // Detections below this are uncertain (default)
    MAX_ALTERNATIVES: 3,
    MIN_UNCERTAIN_FOR_PROMPT: 2, // Need at least this many uncertain to prompt
    // Rarity-specific thresholds - common items need higher confidence
    RARITY_THRESHOLDS: {
        common: 0.65, // Common items often look similar, need higher confidence
        uncommon: 0.6,
        rare: 0.55,
        epic: 0.55,
        legendary: 0.5, // Legendary items are more distinctive
    } as Record<string, number>,
};

/**
 * Get uncertainty threshold based on item rarity
 * Common items need higher confidence because they're often similar-looking
 * @internal Exported for potential future use in rarity-aware uncertainty detection
 */
export function getUncertaintyThreshold(rarity?: string): number {
    if (rarity && rarity in CONFIG.RARITY_THRESHOLDS) {
        return CONFIG.RARITY_THRESHOLDS[rarity] ?? CONFIG.UNCERTAINTY_THRESHOLD;
    }
    return CONFIG.UNCERTAINTY_THRESHOLD;
}

// ========================================
// State
// ========================================

let currentSession: ActiveLearningSession | null = null;
let allData: AllGameData = {};

// ========================================
// Initialization
// ========================================

/**
 * Initialize active learning with game data
 */
export function initActiveLearning(gameData: AllGameData): void {
    allData = gameData;
}

// ========================================
// Detection Analysis
// ========================================

/**
 * Find uncertain detections from a list
 */
export function findUncertainDetections(
    detections: DetectionForFeedback[],
    threshold: number = CONFIG.UNCERTAINTY_THRESHOLD
): UncertainDetection[] {
    const uncertain: UncertainDetection[] = [];

    for (const detection of detections) {
        if (detection.confidence < threshold) {
            // Find alternative items that might be correct
            const alternatives = findAlternatives(detection, CONFIG.MAX_ALTERNATIVES);

            uncertain.push({
                detection,
                alternatives,
                cropDataUrl: detection.cropDataUrl,
            });
        }
    }

    // Sort by confidence (lowest first - most uncertain)
    uncertain.sort((a, b) => a.detection.confidence - b.detection.confidence);

    return uncertain;
}

/**
 * Find alternative items for a detection
 */
function findAlternatives(detection: DetectionForFeedback, maxCount: number): Item[] {
    const items = allData.items?.items || [];

    // Filter out the detected item and score remaining
    const scored = items
        .filter(item => item.id !== detection.detectedItemId)
        .map(item => ({
            item,
            score: calculateSimilarityScore(detection, item),
        }))
        .filter(({ score }) => score > 0.3) // Only reasonably similar items
        .sort((a, b) => b.score - a.score);

    return scored.slice(0, maxCount).map(({ item }) => item);
}

/**
 * Calculate similarity score between detection and potential item
 * Uses name similarity and rarity as heuristics
 */
function calculateSimilarityScore(detection: DetectionForFeedback, item: Item): number {
    let score = 0;

    // Name similarity (simple substring/edit distance proxy)
    const detectedName = detection.detectedItemName.toLowerCase();
    const itemName = item.name.toLowerCase();

    // Exact word match bonus
    const detectedWords = detectedName.split(/\s+/);
    const itemWords = itemName.split(/\s+/);
    const commonWords = detectedWords.filter(w => itemWords.includes(w));
    score += commonWords.length * 0.2;

    // First letter match
    if (itemName.length > 0 && detectedName.startsWith(itemName.charAt(0))) {
        score += 0.1;
    }

    // Similar length
    const lengthDiff = Math.abs(detectedName.length - itemName.length);
    if (lengthDiff <= 3) {
        score += 0.1;
    }

    // Same rarity bonus (items often confused within same rarity)
    // Note: detection might not have rarity, so this is optional
    // For now, just use the item's rarity as a small boost

    return Math.min(1, score);
}

/**
 * Check if we should prompt for active learning
 */
export function shouldPromptForLearning(detections: DetectionForFeedback[]): boolean {
    const uncertain = findUncertainDetections(detections);
    return uncertain.length >= CONFIG.MIN_UNCERTAIN_FOR_PROMPT;
}

// ========================================
// Session Management
// ========================================

/**
 * Start an active learning session
 */
export function startActiveLearningSession(
    detections: DetectionForFeedback[],
    imageDataUrl: string,
    imageWidth: number,
    imageHeight: number
): ActiveLearningSession {
    const uncertainDetections = findUncertainDetections(detections);

    currentSession = {
        uncertainDetections,
        currentIndex: 0,
        responses: [],
        startedAt: new Date().toISOString(),
    };

    // Also start a feedback session for collecting corrections
    startFeedbackSession(imageDataUrl, imageWidth, imageHeight);

    logger.info({
        operation: 'active_learning.session_started',
        data: {
            totalDetections: detections.length,
            uncertainCount: uncertainDetections.length,
        },
    });

    return currentSession;
}

/**
 * Get current active learning session
 */
export function getActiveLearningSession(): ActiveLearningSession | null {
    return currentSession;
}

/**
 * Get current uncertain detection
 */
export function getCurrentUncertainDetection(): UncertainDetection | null {
    if (!currentSession || currentSession.currentIndex >= currentSession.uncertainDetections.length) {
        return null;
    }
    return currentSession.uncertainDetections[currentSession.currentIndex] ?? null;
}

/**
 * Submit verification response
 */
export async function submitVerification(response: VerificationResponse): Promise<boolean> {
    if (!currentSession) return false;

    const current = getCurrentUncertainDetection();
    if (!current) return false;

    currentSession.responses.push(response);

    // If user corrected the detection, add to feedback
    if (!response.isCorrect && response.correctedItemId) {
        const correctItem = allData.items?.items.find(i => i.id === response.correctedItemId);
        if (correctItem) {
            await addCorrection(current.detection, correctItem);
        }
    }

    // Move to next
    currentSession.currentIndex++;

    logger.info({
        operation: 'active_learning.verification_submitted',
        data: {
            isCorrect: response.isCorrect,
            correctedTo: response.correctedItemName || null,
            remaining: currentSession.uncertainDetections.length - currentSession.currentIndex,
        },
    });

    return true;
}

/**
 * Skip current detection
 */
export function skipCurrentDetection(): void {
    if (!currentSession) return;
    currentSession.currentIndex++;
}

/**
 * End active learning session
 */
export function endActiveLearningSession(): {
    totalReviewed: number;
    correctionsAdded: number;
    skipped: number;
} {
    if (!currentSession) {
        return { totalReviewed: 0, correctionsAdded: 0, skipped: 0 };
    }

    const totalReviewed = currentSession.responses.length;
    const correctionsAdded = currentSession.responses.filter(r => !r.isCorrect && r.correctedItemId).length;
    const skipped = currentSession.uncertainDetections.length - totalReviewed;

    logger.info({
        operation: 'active_learning.session_ended',
        data: { totalReviewed, correctionsAdded, skipped },
    });

    currentSession = null;

    return { totalReviewed, correctionsAdded, skipped };
}

// ========================================
// UI Rendering
// ========================================

/**
 * Render active learning prompt modal content
 */
export function renderActiveLearningPrompt(uncertain: UncertainDetection): string {
    const { detection, alternatives, cropDataUrl } = uncertain;

    return `
        <div class="active-learning-prompt">
            <div class="al-header">
                <h3>Help Improve Detection Accuracy</h3>
                <p>We're not sure about this detection. Can you help verify it?</p>
            </div>

            <div class="al-detection">
                ${
                    cropDataUrl
                        ? `<div class="al-crop"><img src="${cropDataUrl}" alt="Detected region" loading="lazy" /></div>`
                        : '<div class="al-crop-placeholder">No crop available</div>'
                }
                <div class="al-detected-info">
                    <span class="al-label">Detected as:</span>
                    <span class="al-item-name">${escapeHtml(detection.detectedItemName)}</span>
                    <span class="al-confidence">${Math.round(detection.confidence * 100)}% confidence</span>
                </div>
            </div>

            <div class="al-question">
                <p>Is this detection correct?</p>
            </div>

            <div class="al-actions">
                <button class="al-btn al-btn-correct" data-action="correct">
                    ✓ Yes, it's correct
                </button>
                <button class="al-btn al-btn-wrong" data-action="wrong">
                    ✗ No, it's wrong
                </button>
                <button class="al-btn al-btn-skip" data-action="skip">
                    Skip
                </button>
            </div>

            ${
                alternatives.length > 0
                    ? `
                <div class="al-alternatives" style="display: none;">
                    <p>Select the correct item:</p>
                    <div class="al-alternatives-list">
                        ${alternatives
                            .map(
                                item => `
                            <button class="al-alternative" data-item-id="${item.id}" data-item-name="${escapeHtml(item.name)}">
                                ${escapeHtml(item.name)}
                            </button>
                        `
                            )
                            .join('')}
                        <button class="al-alternative al-other" data-action="other">
                            Other...
                        </button>
                    </div>
                </div>
            `
                    : ''
            }

            <div class="al-progress">
                <span class="al-progress-text"></span>
            </div>
        </div>
    `;
}

/**
 * Render completion message
 */
export function renderCompletionMessage(stats: {
    totalReviewed: number;
    correctionsAdded: number;
    skipped: number;
}): string {
    const hasCorrections = getCorrectionCount() > 0;

    return `
        <div class="al-completion">
            <div class="al-completion-icon">🎉</div>
            <h3>Thank You!</h3>
            <p>Your feedback helps improve detection accuracy for everyone.</p>

            <div class="al-completion-stats">
                <div class="al-stat">
                    <span class="al-stat-value">${stats.totalReviewed}</span>
                    <span class="al-stat-label">Reviewed</span>
                </div>
                <div class="al-stat">
                    <span class="al-stat-value">${stats.correctionsAdded}</span>
                    <span class="al-stat-label">Corrections</span>
                </div>
            </div>

            ${
                hasCorrections
                    ? `
                <div class="al-export">
                    <p>Would you like to export your corrections to help train the system?</p>
                    <button class="al-btn al-btn-export" data-action="export">
                        📥 Export Feedback
                    </button>
                </div>
            `
                    : ''
            }

            <button class="al-btn al-btn-done" data-action="done">
                Done
            </button>
        </div>
    `;
}

/**
 * Render prompt badge for uncertain detections
 */
export function renderUncertainBadge(count: number): string {
    if (count === 0) return '';

    return `
        <div class="al-badge" title="${count} uncertain detections need verification">
            <span class="al-badge-icon">?</span>
            <span class="al-badge-count">${count}</span>
        </div>
    `;
}

// ========================================
// Event Handling Helpers
// ========================================

/**
 * Handle verification action
 */
export async function handleVerificationAction(
    action: string,
    itemId?: string,
    itemName?: string
): Promise<'next' | 'done' | 'alternatives'> {
    const current = getCurrentUncertainDetection();
    if (!current) return 'done';

    if (action === 'correct') {
        await submitVerification({
            detectionId: current.detection.detectedItemId,
            isCorrect: true,
        });
        return getCurrentUncertainDetection() ? 'next' : 'done';
    }

    if (action === 'wrong') {
        return 'alternatives';
    }

    if (action === 'skip') {
        skipCurrentDetection();
        return getCurrentUncertainDetection() ? 'next' : 'done';
    }

    if (action === 'alternative' && itemId) {
        await submitVerification({
            detectionId: current.detection.detectedItemId,
            isCorrect: false,
            correctedItemId: itemId,
            correctedItemName: itemName,
        });
        return getCurrentUncertainDetection() ? 'next' : 'done';
    }

    if (action === 'export') {
        downloadFeedback();
        return 'done';
    }

    return 'done';
}

// ========================================
// Reset for testing
// ========================================

export function __resetForTesting(): void {
    currentSession = null;
    allData = {};
}
