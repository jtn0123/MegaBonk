/**
 * @vitest-environment jsdom
 * CV Active Learning - Comprehensive Tests
 * Tests for active learning prompts and session management
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
    initActiveLearning,
    findUncertainDetections,
    shouldPromptForLearning,
    startActiveLearningSession,
    getActiveLearningSession,
    getCurrentUncertainDetection,
    skipCurrentDetection,
    endActiveLearningSession,
    renderActiveLearningPrompt,
    renderCompletionMessage,
    renderUncertainBadge,
    handleVerificationAction,
    submitVerification,
    __resetForTesting,
    type UncertainDetection,
    type ActiveLearningSession,
} from '../../src/modules/cv/active-learning.ts';

import type { DetectionForFeedback } from '../../src/modules/cv/training-feedback.ts';
import { __resetForTesting as resetFeedback } from '../../src/modules/cv/training-feedback.ts';

// ========================================
// Test Suite
// ========================================

describe('CV Active Learning', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        __resetForTesting();
        resetFeedback();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        __resetForTesting();
        resetFeedback();
    });

    // ========================================
    // initActiveLearning Tests
    // ========================================
    describe('initActiveLearning', () => {
        it('should initialize with game data', () => {
            const gameData = {
                items: {
                    items: [
                        { id: 'sword', name: 'Sword' },
                        { id: 'shield', name: 'Shield' },
                    ],
                },
            };

            expect(() => initActiveLearning(gameData as any)).not.toThrow();
        });

        it('should handle empty game data', () => {
            expect(() => initActiveLearning({})).not.toThrow();
        });

        it('should handle null game data', () => {
            expect(() => initActiveLearning(null as any)).not.toThrow();
        });
    });

    // ========================================
    // findUncertainDetections Tests
    // ========================================
    describe('findUncertainDetections', () => {
        it('should return empty array for empty detections', () => {
            const result = findUncertainDetections([]);
            expect(result).toEqual([]);
        });

        it('should filter detections below threshold', () => {
            const detections: DetectionForFeedback[] = [
                createMockDetection('sword', 0.4),
                createMockDetection('shield', 0.8),
                createMockDetection('potion', 0.3),
            ];

            const result = findUncertainDetections(detections, 0.6);

            expect(result.length).toBe(2);
            expect(result.map(r => r.detection.detectedItemId)).toContain('sword');
            expect(result.map(r => r.detection.detectedItemId)).toContain('potion');
        });

        it('should sort by confidence (lowest first)', () => {
            const detections: DetectionForFeedback[] = [
                createMockDetection('sword', 0.5),
                createMockDetection('shield', 0.2),
                createMockDetection('potion', 0.4),
            ];

            const result = findUncertainDetections(detections, 0.6);

            expect(result[0].detection.detectedItemId).toBe('shield');
            expect(result[1].detection.detectedItemId).toBe('potion');
            expect(result[2].detection.detectedItemId).toBe('sword');
        });

        it('should use default threshold of 0.6', () => {
            const detections: DetectionForFeedback[] = [
                createMockDetection('sword', 0.59),
                createMockDetection('shield', 0.61),
            ];

            const result = findUncertainDetections(detections);

            expect(result.length).toBe(1);
            expect(result[0].detection.detectedItemId).toBe('sword');
        });

        it('should include alternatives from game data', () => {
            initActiveLearning({
                items: {
                    items: [
                        { id: 'sword', name: 'Sword' },
                        { id: 'blade', name: 'Blade' },
                        { id: 'shield', name: 'Shield' },
                    ],
                },
            } as any);

            const detections: DetectionForFeedback[] = [createMockDetection('sword', 0.4)];

            const result = findUncertainDetections(detections);

            expect(result[0].alternatives).toBeDefined();
            // Alternatives should be items other than the detected item
        });

        it('should preserve crop data URL', () => {
            const detections: DetectionForFeedback[] = [
                {
                    ...createMockDetection('sword', 0.4),
                    cropDataUrl: 'data:image/png;base64,test',
                },
            ];

            const result = findUncertainDetections(detections);

            expect(result[0].cropDataUrl).toBe('data:image/png;base64,test');
        });
    });

    // ========================================
    // shouldPromptForLearning Tests
    // ========================================
    describe('shouldPromptForLearning', () => {
        it('should return false for empty detections', () => {
            expect(shouldPromptForLearning([])).toBe(false);
        });

        it('should return false when no uncertain detections', () => {
            const detections: DetectionForFeedback[] = [
                createMockDetection('sword', 0.9),
                createMockDetection('shield', 0.85),
            ];

            expect(shouldPromptForLearning(detections)).toBe(false);
        });

        it('should return false with only one uncertain detection', () => {
            const detections: DetectionForFeedback[] = [
                createMockDetection('sword', 0.4),
                createMockDetection('shield', 0.9),
            ];

            expect(shouldPromptForLearning(detections)).toBe(false);
        });

        it('should return true with multiple uncertain detections', () => {
            const detections: DetectionForFeedback[] = [
                createMockDetection('sword', 0.4),
                createMockDetection('shield', 0.3),
                createMockDetection('potion', 0.9),
            ];

            expect(shouldPromptForLearning(detections)).toBe(true);
        });
    });

    // ========================================
    // Session Management Tests
    // ========================================
    describe('Session Management', () => {
        describe('startActiveLearningSession', () => {
            it('should create a new session', () => {
                const detections: DetectionForFeedback[] = [
                    createMockDetection('sword', 0.4),
                    createMockDetection('shield', 0.3),
                ];

                const session = startActiveLearningSession(
                    detections,
                    'data:image/png;base64,test',
                    1920,
                    1080
                );

                expect(session).toBeDefined();
                expect(session.currentIndex).toBe(0);
                expect(session.responses).toEqual([]);
                expect(session.startedAt).toBeDefined();
            });

            it('should find uncertain detections', () => {
                const detections: DetectionForFeedback[] = [
                    createMockDetection('sword', 0.4),
                    createMockDetection('shield', 0.3),
                    createMockDetection('potion', 0.9),
                ];

                const session = startActiveLearningSession(
                    detections,
                    'data:image/png;base64,test',
                    1920,
                    1080
                );

                expect(session.uncertainDetections.length).toBe(2);
            });
        });

        describe('getActiveLearningSession', () => {
            it('should return null when no session started', () => {
                expect(getActiveLearningSession()).toBeNull();
            });

            it('should return current session', () => {
                const detections: DetectionForFeedback[] = [createMockDetection('sword', 0.4)];

                startActiveLearningSession(detections, 'data:image/png;base64,test', 1920, 1080);
                const session = getActiveLearningSession();

                expect(session).not.toBeNull();
            });
        });

        describe('getCurrentUncertainDetection', () => {
            it('should return null when no session', () => {
                expect(getCurrentUncertainDetection()).toBeNull();
            });

            it('should return current detection', () => {
                const detections: DetectionForFeedback[] = [
                    createMockDetection('sword', 0.4),
                    createMockDetection('shield', 0.3),
                ];

                startActiveLearningSession(detections, 'data:image/png;base64,test', 1920, 1080);
                const current = getCurrentUncertainDetection();

                expect(current).not.toBeNull();
                // First detection is the most uncertain (lowest confidence)
                expect(current!.detection.detectedItemId).toBe('shield');
            });

            it('should return null when all detections processed', () => {
                const detections: DetectionForFeedback[] = [createMockDetection('sword', 0.4)];

                startActiveLearningSession(detections, 'data:image/png;base64,test', 1920, 1080);
                skipCurrentDetection();

                expect(getCurrentUncertainDetection()).toBeNull();
            });
        });

        describe('skipCurrentDetection', () => {
            it('should do nothing when no session', () => {
                expect(() => skipCurrentDetection()).not.toThrow();
            });

            it('should advance to next detection', () => {
                const detections: DetectionForFeedback[] = [
                    createMockDetection('sword', 0.4),
                    createMockDetection('shield', 0.35),
                ];

                startActiveLearningSession(detections, 'data:image/png;base64,test', 1920, 1080);

                const first = getCurrentUncertainDetection();
                skipCurrentDetection();
                const second = getCurrentUncertainDetection();

                expect(first!.detection.detectedItemId).not.toBe(second!.detection.detectedItemId);
            });
        });

        describe('endActiveLearningSession', () => {
            it('should return zeros when no session', () => {
                const stats = endActiveLearningSession();

                expect(stats.totalReviewed).toBe(0);
                expect(stats.correctionsAdded).toBe(0);
                expect(stats.skipped).toBe(0);
            });

            it('should return session stats', () => {
                const detections: DetectionForFeedback[] = [
                    createMockDetection('sword', 0.4),
                    createMockDetection('shield', 0.35),
                ];

                startActiveLearningSession(detections, 'data:image/png;base64,test', 1920, 1080);
                skipCurrentDetection();

                const stats = endActiveLearningSession();

                expect(stats.totalReviewed).toBe(0);
                // Skipped = total uncertain - reviewed
                expect(stats.skipped).toBe(2);
            });

            it('should clear session after ending', () => {
                const detections: DetectionForFeedback[] = [createMockDetection('sword', 0.4)];

                startActiveLearningSession(detections, 'data:image/png;base64,test', 1920, 1080);
                endActiveLearningSession();

                expect(getActiveLearningSession()).toBeNull();
            });
        });

        describe('submitVerification', () => {
            it('should return false when no session', async () => {
                const result = await submitVerification({
                    detectionId: 'sword',
                    isCorrect: true,
                });

                expect(result).toBe(false);
            });

            it('should return false when no current detection', async () => {
                const detections: DetectionForFeedback[] = [createMockDetection('sword', 0.4)];

                startActiveLearningSession(detections, 'data:image/png;base64,test', 1920, 1080);
                skipCurrentDetection(); // Skip past all detections

                const result = await submitVerification({
                    detectionId: 'sword',
                    isCorrect: true,
                });

                expect(result).toBe(false);
            });

            it('should record verification and advance', async () => {
                const detections: DetectionForFeedback[] = [
                    createMockDetection('sword', 0.4),
                    createMockDetection('shield', 0.35),
                ];

                startActiveLearningSession(detections, 'data:image/png;base64,test', 1920, 1080);

                const result = await submitVerification({
                    detectionId: 'shield',
                    isCorrect: true,
                });

                expect(result).toBe(true);

                const session = getActiveLearningSession();
                expect(session!.responses.length).toBe(1);
                expect(session!.currentIndex).toBe(1);
            });
        });
    });

    // ========================================
    // Rendering Tests
    // ========================================
    describe('Rendering', () => {
        describe('renderActiveLearningPrompt', () => {
            it('should render prompt HTML', () => {
                const uncertain: UncertainDetection = {
                    detection: createMockDetection('sword', 0.4),
                    alternatives: [],
                };

                const html = renderActiveLearningPrompt(uncertain);

                expect(html).toContain('active-learning-prompt');
                expect(html).toContain('Sword');
                expect(html).toContain('40%');
            });

            it('should include crop image when available', () => {
                const uncertain: UncertainDetection = {
                    detection: createMockDetection('sword', 0.4),
                    alternatives: [],
                    cropDataUrl: 'data:image/png;base64,test',
                };

                const html = renderActiveLearningPrompt(uncertain);

                expect(html).toContain('data:image/png;base64,test');
                expect(html).toContain('<img');
            });

            it('should show placeholder when no crop', () => {
                const uncertain: UncertainDetection = {
                    detection: createMockDetection('sword', 0.4),
                    alternatives: [],
                };

                const html = renderActiveLearningPrompt(uncertain);

                expect(html).toContain('crop-placeholder');
            });

            it('should include alternatives when available', () => {
                const uncertain: UncertainDetection = {
                    detection: createMockDetection('sword', 0.4),
                    alternatives: [
                        { id: 'blade', name: 'Blade' } as any,
                        { id: 'dagger', name: 'Dagger' } as any,
                    ],
                };

                const html = renderActiveLearningPrompt(uncertain);

                expect(html).toContain('Blade');
                expect(html).toContain('Dagger');
                expect(html).toContain('al-alternatives');
            });

            it('should include action buttons', () => {
                const uncertain: UncertainDetection = {
                    detection: createMockDetection('sword', 0.4),
                    alternatives: [],
                };

                const html = renderActiveLearningPrompt(uncertain);

                expect(html).toContain('data-action="correct"');
                expect(html).toContain('data-action="wrong"');
                expect(html).toContain('data-action="skip"');
            });
        });

        describe('renderCompletionMessage', () => {
            it('should render completion stats', () => {
                const stats = {
                    totalReviewed: 5,
                    correctionsAdded: 2,
                    skipped: 1,
                };

                const html = renderCompletionMessage(stats);

                expect(html).toContain('al-completion');
                expect(html).toContain('5');
                expect(html).toContain('2');
                expect(html).toContain('Thank You');
            });

            it('should include done button', () => {
                const stats = {
                    totalReviewed: 0,
                    correctionsAdded: 0,
                    skipped: 0,
                };

                const html = renderCompletionMessage(stats);

                expect(html).toContain('data-action="done"');
            });
        });

        describe('renderUncertainBadge', () => {
            it('should return empty string for zero count', () => {
                expect(renderUncertainBadge(0)).toBe('');
            });

            it('should render badge with count', () => {
                const html = renderUncertainBadge(5);

                expect(html).toContain('al-badge');
                expect(html).toContain('5');
            });

            it('should include tooltip', () => {
                const html = renderUncertainBadge(3);

                expect(html).toContain('title=');
                expect(html).toContain('3 uncertain');
            });
        });
    });

    // ========================================
    // handleVerificationAction Tests
    // ========================================
    describe('handleVerificationAction', () => {
        it('should return done when no session', async () => {
            const result = await handleVerificationAction('correct');
            expect(result).toBe('done');
        });

        it('should handle correct action', async () => {
            const detections: DetectionForFeedback[] = [
                createMockDetection('sword', 0.4),
                createMockDetection('shield', 0.35),
            ];

            startActiveLearningSession(detections, 'data:image/png;base64,test', 1920, 1080);

            const result = await handleVerificationAction('correct');

            expect(result).toBe('next');
        });

        it('should return alternatives on wrong action', async () => {
            const detections: DetectionForFeedback[] = [createMockDetection('sword', 0.4)];

            startActiveLearningSession(detections, 'data:image/png;base64,test', 1920, 1080);

            const result = await handleVerificationAction('wrong');

            expect(result).toBe('alternatives');
        });

        it('should handle skip action', async () => {
            const detections: DetectionForFeedback[] = [
                createMockDetection('sword', 0.4),
                createMockDetection('shield', 0.35),
            ];

            startActiveLearningSession(detections, 'data:image/png;base64,test', 1920, 1080);

            const result = await handleVerificationAction('skip');

            expect(result).toBe('next');
        });

        it('should return done on last detection', async () => {
            const detections: DetectionForFeedback[] = [createMockDetection('sword', 0.4)];

            startActiveLearningSession(detections, 'data:image/png;base64,test', 1920, 1080);

            const result = await handleVerificationAction('correct');

            expect(result).toBe('done');
        });

        it('should handle alternative selection', async () => {
            const detections: DetectionForFeedback[] = [createMockDetection('sword', 0.4)];

            startActiveLearningSession(detections, 'data:image/png;base64,test', 1920, 1080);

            const result = await handleVerificationAction('alternative', 'blade', 'Blade');

            expect(result).toBe('done');
        });
    });

    // ========================================
    // __resetForTesting Tests
    // ========================================
    describe('__resetForTesting', () => {
        it('should clear all state', () => {
            const detections: DetectionForFeedback[] = [createMockDetection('sword', 0.4)];

            startActiveLearningSession(detections, 'data:image/png;base64,test', 1920, 1080);
            __resetForTesting();

            expect(getActiveLearningSession()).toBeNull();
        });
    });
});

// ========================================
// Test Helpers
// ========================================

function createMockDetection(itemId: string, confidence: number): DetectionForFeedback {
    const names: Record<string, string> = {
        sword: 'Sword',
        shield: 'Shield',
        potion: 'Potion',
        blade: 'Blade',
    };

    return {
        detectedItemId: itemId,
        detectedItemName: names[itemId] || itemId,
        confidence,
        x: 100,
        y: 100,
        width: 50,
        height: 50,
    };
}
