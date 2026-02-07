/**
 * @vitest-environment jsdom
 * CV Training Feedback - Comprehensive Tests
 * Tests for training feedback collection and export
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
    startFeedbackSession,
    getCurrentSession,
    clearFeedbackSession,
    getCorrectionCount,
    getCorrections,
    isDetectionCorrected,
    removeCorrection,
    exportFeedback,
    downloadFeedback,
    addCorrection,
    __resetForTesting,
    type FeedbackSession,
    type FeedbackCorrection,
    type DetectionForFeedback,
    type FeedbackExport,
} from '../../src/modules/cv/training-feedback.ts';

// ========================================
// Test Suite
// ========================================

describe('CV Training Feedback', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Clear sessionStorage between tests
        try {
            sessionStorage.clear();
        } catch {
            // Ignore
        }
        __resetForTesting();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        __resetForTesting();
    });

    // ========================================
    // Session Management Tests
    // ========================================
    describe('Session Management', () => {
        describe('startFeedbackSession', () => {
            it('should create a new feedback session', () => {
                const session = startFeedbackSession('data:image/png;base64,test', 1920, 1080);

                expect(session).toBeDefined();
                expect(session.corrections).toEqual([]);
                expect(session.imageDataUrl).toBe('data:image/png;base64,test');
                expect(session.imageResolution).toEqual({ width: 1920, height: 1080 });
                expect(session.startedAt).toBeDefined();
            });

            it('should persist session to sessionStorage', () => {
                startFeedbackSession('data:image/png;base64,test', 1920, 1080);

                // Verify the session was saved by checking sessionStorage
                const stored = sessionStorage.getItem('cv-feedback-session');
                expect(stored).not.toBeNull();
                expect(JSON.parse(stored!).imageDataUrl).toBe('data:image/png;base64,test');
            });
        });

        describe('getCurrentSession', () => {
            it('should return null when no session exists', () => {
                expect(getCurrentSession()).toBeNull();
            });

            it('should return current session', () => {
                startFeedbackSession('data:image/png;base64,test', 1920, 1080);
                const session = getCurrentSession();

                expect(session).not.toBeNull();
                expect(session!.imageDataUrl).toBe('data:image/png;base64,test');
            });

            it('should return same session instance on repeated calls', () => {
                // Create a session
                const session1 = startFeedbackSession('data:image/png;base64,test', 1920, 1080);
                const session2 = getCurrentSession();
                
                // Both should return the same session (from cache)
                expect(session1).toBe(session2);
                expect(session2!.imageDataUrl).toBe('data:image/png;base64,test');
            });
        });

        describe('clearFeedbackSession', () => {
            it('should clear current session', () => {
                startFeedbackSession('data:image/png;base64,test', 1920, 1080);
                clearFeedbackSession();

                expect(getCurrentSession()).toBeNull();
            });

            it('should remove from sessionStorage', () => {
                startFeedbackSession('data:image/png;base64,test', 1920, 1080);
                clearFeedbackSession();

                // Verify it was removed from sessionStorage
                const stored = sessionStorage.getItem('cv-feedback-session');
                expect(stored).toBeNull();
            });
        });
    });

    // ========================================
    // Correction Getters Tests
    // ========================================
    describe('Correction Getters', () => {
        describe('getCorrectionCount', () => {
            it('should return 0 when no session', () => {
                expect(getCorrectionCount()).toBe(0);
            });

            it('should return 0 for empty session', () => {
                startFeedbackSession('data:image/png;base64,test', 1920, 1080);
                expect(getCorrectionCount()).toBe(0);
            });

            it('should return count of corrections', async () => {
                startFeedbackSession('data:image/png;base64,test', 1920, 1080);

                // Add corrections manually by modifying session
                const session = getCurrentSession();
                session!.corrections.push(createMockCorrection('sword', 'blade'));
                session!.corrections.push(createMockCorrection('shield', 'armor'));

                expect(getCorrectionCount()).toBe(2);
            });
        });

        describe('getCorrections', () => {
            it('should return empty array when no session', () => {
                expect(getCorrections()).toEqual([]);
            });

            it('should return all corrections', () => {
                startFeedbackSession('data:image/png;base64,test', 1920, 1080);

                const session = getCurrentSession();
                const correction = createMockCorrection('sword', 'blade');
                session!.corrections.push(correction);

                const corrections = getCorrections();

                expect(corrections.length).toBe(1);
                expect(corrections[0].correctItemId).toBe('blade');
            });
        });
    });

    // ========================================
    // isDetectionCorrected Tests
    // ========================================
    describe('isDetectionCorrected', () => {
        it('should return false when no session', () => {
            expect(isDetectionCorrected('sword', 100, 100)).toBe(false);
        });

        it('should return false when detection not corrected', () => {
            startFeedbackSession('data:image/png;base64,test', 1920, 1080);
            expect(isDetectionCorrected('sword', 100, 100)).toBe(false);
        });

        it('should return true when detection is corrected', () => {
            startFeedbackSession('data:image/png;base64,test', 1920, 1080);

            const session = getCurrentSession();
            const correction = createMockCorrection('sword', 'blade');
            correction.detection.x = 100;
            correction.detection.y = 100;
            session!.corrections.push(correction);

            expect(isDetectionCorrected('sword', 100, 100)).toBe(true);
        });

        it('should handle nearby coordinates within tolerance', () => {
            startFeedbackSession('data:image/png;base64,test', 1920, 1080);

            const session = getCurrentSession();
            const correction = createMockCorrection('sword', 'blade');
            correction.detection.x = 100;
            correction.detection.y = 100;
            session!.corrections.push(correction);

            // Within 5px tolerance
            expect(isDetectionCorrected('sword', 103, 102)).toBe(true);
            expect(isDetectionCorrected('sword', 96, 97)).toBe(true);
        });

        it('should return false for coordinates outside tolerance', () => {
            startFeedbackSession('data:image/png;base64,test', 1920, 1080);

            const session = getCurrentSession();
            const correction = createMockCorrection('sword', 'blade');
            correction.detection.x = 100;
            correction.detection.y = 100;
            session!.corrections.push(correction);

            // Outside 5px tolerance
            expect(isDetectionCorrected('sword', 110, 100)).toBe(false);
            expect(isDetectionCorrected('sword', 100, 110)).toBe(false);
        });
    });

    // ========================================
    // removeCorrection Tests
    // ========================================
    describe('removeCorrection', () => {
        it('should return false when no session', () => {
            expect(removeCorrection('correction-123')).toBe(false);
        });

        it('should return false when correction not found', () => {
            startFeedbackSession('data:image/png;base64,test', 1920, 1080);
            expect(removeCorrection('nonexistent')).toBe(false);
        });

        it('should remove correction by ID', () => {
            startFeedbackSession('data:image/png;base64,test', 1920, 1080);

            const session = getCurrentSession();
            const correction = createMockCorrection('sword', 'blade');
            correction.id = 'correction-to-remove';
            session!.corrections.push(correction);

            expect(getCorrectionCount()).toBe(1);

            const result = removeCorrection('correction-to-remove');

            expect(result).toBe(true);
            expect(getCorrectionCount()).toBe(0);
        });

        it('should update sessionStorage after removal', () => {
            startFeedbackSession('data:image/png;base64,test', 1920, 1080);

            const session = getCurrentSession();
            const correction = createMockCorrection('sword', 'blade');
            correction.id = 'correction-123';
            session!.corrections.push(correction);

            removeCorrection('correction-123');

            // Verify sessionStorage was updated
            const stored = sessionStorage.getItem('cv-feedback-session');
            expect(stored).not.toBeNull();
            const parsed = JSON.parse(stored!);
            expect(parsed.corrections.length).toBe(0);
        });
    });

    // ========================================
    // Export Tests
    // ========================================
    describe('Export', () => {
        describe('exportFeedback', () => {
            it('should return null when no session', () => {
                expect(exportFeedback()).toBeNull();
            });

            it('should return null when no corrections', () => {
                startFeedbackSession('data:image/png;base64,test', 1920, 1080);
                expect(exportFeedback()).toBeNull();
            });

            it('should export feedback with corrections', () => {
                startFeedbackSession('data:image/png;base64,test', 1920, 1080);

                const session = getCurrentSession();
                session!.corrections.push(createMockCorrection('sword', 'blade'));
                session!.corrections.push(createMockCorrection('shield', 'armor'));

                const exported = exportFeedback();

                expect(exported).not.toBeNull();
                expect(exported!.version).toBe('1.0.0');
                expect(exported!.corrections.length).toBe(2);
                expect(exported!.stats.totalCorrections).toBe(2);
                expect(exported!.stats.uniqueItems).toBe(2);
            });

            it('should calculate average confidence', () => {
                startFeedbackSession('data:image/png;base64,test', 1920, 1080);

                const session = getCurrentSession();
                const correction1 = createMockCorrection('sword', 'blade');
                correction1.detection.confidence = 0.4;
                const correction2 = createMockCorrection('shield', 'armor');
                correction2.detection.confidence = 0.6;

                session!.corrections.push(correction1);
                session!.corrections.push(correction2);

                const exported = exportFeedback();

                expect(exported!.stats.avgOriginalConfidence).toBeCloseTo(0.5, 2);
            });

            it('should include correct metadata', () => {
                startFeedbackSession('data:image/png;base64,test', 1920, 1080);

                const session = getCurrentSession();
                session!.corrections.push(createMockCorrection('sword', 'blade'));

                const exported = exportFeedback();

                expect(exported!.exportedBy).toBe('megabonk-user');
                expect(exported!.exportedAt).toBeDefined();
            });

            it('should format corrections correctly', () => {
                startFeedbackSession('data:image/png;base64,test', 1920, 1080);

                const session = getCurrentSession();
                const correction = createMockCorrection('sword', 'blade');
                correction.detection.cropDataUrl = 'data:image/png;base64,crop';
                session!.corrections.push(correction);

                const exported = exportFeedback();
                const exportedCorrection = exported!.corrections[0];

                expect(exportedCorrection.itemId).toBe('blade');
                expect(exportedCorrection.itemName).toBe('Blade');
                expect(exportedCorrection.source).toBe('user_correction');
                expect(exportedCorrection.originalDetection.itemId).toBe('sword');
            });
        });

        describe('downloadFeedback', () => {
            it('should return false when no export data', () => {
                expect(downloadFeedback()).toBe(false);
            });

            it('should create and trigger download', () => {
                startFeedbackSession('data:image/png;base64,test', 1920, 1080);

                const session = getCurrentSession();
                session!.corrections.push(createMockCorrection('sword', 'blade'));

                // Mock URL.createObjectURL and revokeObjectURL
                const mockCreateObjectURL = vi.fn().mockReturnValue('blob:test');
                const mockRevokeObjectURL = vi.fn();
                global.URL.createObjectURL = mockCreateObjectURL;
                global.URL.revokeObjectURL = mockRevokeObjectURL;

                // Track click calls
                const clickSpy = vi.fn();
                const originalCreateElement = document.createElement.bind(document);
                vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
                    const element = originalCreateElement(tagName);
                    if (tagName === 'a') {
                        element.click = clickSpy;
                    }
                    return element;
                });

                const result = downloadFeedback();

                expect(result).toBe(true);
                expect(mockCreateObjectURL).toHaveBeenCalled();
                expect(clickSpy).toHaveBeenCalled();
                expect(mockRevokeObjectURL).toHaveBeenCalled();
            });
        });
    });

    // ========================================
    // addCorrection Tests
    // ========================================
    describe('addCorrection', () => {
        it('should return null when no session', async () => {
            const detection = createMockDetection('sword');
            const correctItem = { id: 'blade', name: 'Blade' };

            const result = await addCorrection(detection, correctItem as any);

            expect(result).toBeNull();
        });

        it('should add correction to session', async () => {
            startFeedbackSession('data:image/png;base64,test', 1920, 1080);

            const detection = createMockDetection('sword');
            detection.cropDataUrl = 'data:image/png;base64,crop';
            const correctItem = { id: 'blade', name: 'Blade' };

            const result = await addCorrection(detection, correctItem as any);

            expect(result).not.toBeNull();
            expect(result!.correctItemId).toBe('blade');
            expect(result!.correctItemName).toBe('Blade');
            expect(getCorrectionCount()).toBe(1);
        });

        it('should generate unique correction ID', async () => {
            startFeedbackSession('data:image/png;base64,test', 1920, 1080);

            const detection1 = createMockDetection('sword');
            detection1.cropDataUrl = 'data:image/png;base64,crop';
            const detection2 = createMockDetection('shield');
            detection2.cropDataUrl = 'data:image/png;base64,crop';

            const result1 = await addCorrection(detection1, { id: 'blade', name: 'Blade' } as any);
            const result2 = await addCorrection(detection2, { id: 'armor', name: 'Armor' } as any);

            expect(result1!.id).not.toBe(result2!.id);
        });

        it('should include user notes', async () => {
            startFeedbackSession('data:image/png;base64,test', 1920, 1080);

            const detection = createMockDetection('sword');
            detection.cropDataUrl = 'data:image/png;base64,crop';
            const correctItem = { id: 'blade', name: 'Blade' };

            const result = await addCorrection(detection, correctItem as any, 'This is actually a blade');

            expect(result!.userNotes).toBe('This is actually a blade');
        });

        it('should save to sessionStorage after adding', async () => {
            startFeedbackSession('data:image/png;base64,test', 1920, 1080);

            const detection = createMockDetection('sword');
            detection.cropDataUrl = 'data:image/png;base64,crop';
            const correctItem = { id: 'blade', name: 'Blade' };

            await addCorrection(detection, correctItem as any);

            // Verify sessionStorage was updated
            const stored = sessionStorage.getItem('cv-feedback-session');
            expect(stored).not.toBeNull();
            const parsed = JSON.parse(stored!);
            expect(parsed.corrections.length).toBe(1);
        });
    });

    // ========================================
    // __resetForTesting Tests
    // ========================================
    describe('__resetForTesting', () => {
        it('should clear all state', () => {
            startFeedbackSession('data:image/png;base64,test', 1920, 1080);

            const session = getCurrentSession();
            session!.corrections.push(createMockCorrection('sword', 'blade'));

            __resetForTesting();

            expect(getCurrentSession()).toBeNull();
            expect(getCorrectionCount()).toBe(0);
        });
    });
});

// ========================================
// Test Helpers
// ========================================

function createMockDetection(itemId: string): DetectionForFeedback {
    const names: Record<string, string> = {
        sword: 'Sword',
        shield: 'Shield',
        blade: 'Blade',
        armor: 'Armor',
    };

    return {
        detectedItemId: itemId,
        detectedItemName: names[itemId] || itemId,
        confidence: 0.5,
        x: 100,
        y: 100,
        width: 50,
        height: 50,
    };
}

function createMockCorrection(detectedItemId: string, correctItemId: string): FeedbackCorrection {
    const names: Record<string, string> = {
        sword: 'Sword',
        shield: 'Shield',
        blade: 'Blade',
        armor: 'Armor',
    };

    return {
        id: `correction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        detection: {
            detectedItemId,
            detectedItemName: names[detectedItemId] || detectedItemId,
            confidence: 0.4,
            x: 100,
            y: 100,
            width: 50,
            height: 50,
        },
        correctItemId,
        correctItemName: names[correctItemId] || correctItemId,
        resolution: { width: 1920, height: 1080 },
    };
}
