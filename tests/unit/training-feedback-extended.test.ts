/**
 * @vitest-environment jsdom
 * Training Feedback Extended Tests
 * Covers edge cases, error paths, and uncovered branches
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
    startFeedbackSession,
    getCurrentSession,
    clearFeedbackSession,
    extractCropFromImage,
    addCorrection,
    exportFeedback,
    removeCorrection,
    isDetectionCorrected,
    getCorrectionCount,
    getCorrections,
    __resetForTesting,
    type DetectionForFeedback,
} from '../../src/modules/cv/training-feedback.ts';

// ========================================
// Extended Test Suite - Edge Cases & Error Paths
// ========================================

describe('CV Training Feedback - Extended Coverage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
    // Session Storage Error Handling
    // ========================================
    describe('Session Storage Error Handling', () => {
        it('should handle sessionStorage.setItem failure in startFeedbackSession', () => {
            // Mock sessionStorage to throw on setItem
            const originalSetItem = sessionStorage.setItem.bind(sessionStorage);
            vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
                throw new Error('QuotaExceededError');
            });

            // Should still create session despite storage failure
            const session = startFeedbackSession('data:image/png;base64,test', 800, 600);

            expect(session).toBeDefined();
            expect(session.imageDataUrl).toBe('data:image/png;base64,test');
            expect(session.corrections).toEqual([]);

            sessionStorage.setItem = originalSetItem;
        });

        it('should handle sessionStorage.getItem failure in getCurrentSession', () => {
            // First create a session
            startFeedbackSession('data:image/png;base64,test', 800, 600);
            
            // Clear the in-memory session to force storage lookup
            __resetForTesting();

            // Mock sessionStorage to throw on getItem
            vi.spyOn(sessionStorage, 'getItem').mockImplementation(() => {
                throw new Error('SecurityError');
            });

            // Should return null gracefully
            const session = getCurrentSession();
            expect(session).toBeNull();
        });

        it('should handle sessionStorage.getItem returning invalid JSON', () => {
            // Clear in-memory session
            __resetForTesting();

            // Mock sessionStorage to return invalid JSON
            vi.spyOn(sessionStorage, 'getItem').mockReturnValue('not valid json{{{');

            // Should return null and not crash
            const session = getCurrentSession();
            expect(session).toBeNull();
        });

        it('should handle sessionStorage.removeItem failure in clearFeedbackSession', () => {
            startFeedbackSession('data:image/png;base64,test', 800, 600);

            // Mock sessionStorage to throw on removeItem
            vi.spyOn(sessionStorage, 'removeItem').mockImplementation(() => {
                throw new Error('StorageError');
            });

            // Should clear session despite storage failure
            clearFeedbackSession();
            expect(getCurrentSession()).toBeNull();
        });

        it('should restore session from sessionStorage when in-memory session is cleared', () => {
            // Create session and let it persist to storage
            const originalSession = startFeedbackSession('data:image/png;base64,restored', 1280, 720);
            
            // Simulate a new page load by clearing in-memory state only
            // This is tricky - we need to clear currentSession but keep storage
            // We'll use a workaround by directly setting the module state
            __resetForTesting();
            
            // Manually set sessionStorage (simulating persisted state)
            sessionStorage.setItem('cv-feedback-session', JSON.stringify({
                corrections: [],
                startedAt: new Date().toISOString(),
                imageDataUrl: 'data:image/png;base64,restored',
                imageResolution: { width: 1280, height: 720 },
            }));

            // getCurrentSession should restore from storage
            const restoredSession = getCurrentSession();
            expect(restoredSession).not.toBeNull();
            expect(restoredSession!.imageDataUrl).toBe('data:image/png;base64,restored');
            expect(restoredSession!.imageResolution).toEqual({ width: 1280, height: 720 });
        });
    });

    // ========================================
    // extractCropFromImage Tests
    // ========================================
    describe('extractCropFromImage', () => {
        let mockCanvas: HTMLCanvasElement;
        let mockCtx: CanvasRenderingContext2D;

        beforeEach(() => {
            // Create mock canvas context
            mockCtx = {
                drawImage: vi.fn(),
            } as unknown as CanvasRenderingContext2D;

            mockCanvas = {
                width: 0,
                height: 0,
                getContext: vi.fn().mockReturnValue(mockCtx),
                toDataURL: vi.fn().mockReturnValue('data:image/png;base64,cropped'),
            } as unknown as HTMLCanvasElement;

            vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
                if (tagName === 'canvas') {
                    return mockCanvas;
                }
                return document.createElement(tagName);
            });
        });

        it('should extract crop with default padding', async () => {
            // Mock Image
            let loadHandler: (() => void) | null = null;
            class MockImage {
                width = 1920;
                height = 1080;
                src = '';
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;

                constructor() {
                    setTimeout(() => {
                        if (this.onload) this.onload();
                    }, 0);
                }
            }
            vi.stubGlobal('Image', MockImage);

            const result = await extractCropFromImage(
                'data:image/png;base64,test',
                100, 100, 50, 50
            );

            expect(result).toBe('data:image/png;base64,cropped');
            expect(mockCtx.drawImage).toHaveBeenCalled();
            expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/png');
        });

        it('should extract crop with custom padding', async () => {
            class MockImage {
                width = 1920;
                height = 1080;
                src = '';
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;

                constructor() {
                    setTimeout(() => {
                        if (this.onload) this.onload();
                    }, 0);
                }
            }
            vi.stubGlobal('Image', MockImage);

            const result = await extractCropFromImage(
                'data:image/png;base64,test',
                100, 100, 50, 50, 10 // Custom padding of 10
            );

            expect(result).toBe('data:image/png;base64,cropped');
        });

        it('should clamp crop coordinates to image bounds', async () => {
            class MockImage {
                width = 100;
                height = 100;
                src = '';
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;

                constructor() {
                    setTimeout(() => {
                        if (this.onload) this.onload();
                    }, 0);
                }
            }
            vi.stubGlobal('Image', MockImage);

            // Request crop that would exceed image bounds
            const result = await extractCropFromImage(
                'data:image/png;base64,test',
                80, 80, 50, 50, 5 // Would exceed 100x100 image
            );

            expect(result).toBe('data:image/png;base64,cropped');
            // Canvas size should be clamped
            expect(mockCanvas.width).toBeLessThanOrEqual(100);
            expect(mockCanvas.height).toBeLessThanOrEqual(100);
        });

        it('should clamp crop to zero when near origin', async () => {
            class MockImage {
                width = 100;
                height = 100;
                src = '';
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;

                constructor() {
                    setTimeout(() => {
                        if (this.onload) this.onload();
                    }, 0);
                }
            }
            vi.stubGlobal('Image', MockImage);

            // Request crop near origin with padding that would go negative
            const result = await extractCropFromImage(
                'data:image/png;base64,test',
                0, 0, 20, 20, 5
            );

            expect(result).toBe('data:image/png;base64,cropped');
        });

        it('should reject when canvas context is null', async () => {
            // Mock canvas to return null context
            mockCanvas.getContext = vi.fn().mockReturnValue(null);

            class MockImage {
                width = 100;
                height = 100;
                src = '';
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;

                constructor() {
                    setTimeout(() => {
                        if (this.onload) this.onload();
                    }, 0);
                }
            }
            vi.stubGlobal('Image', MockImage);

            await expect(
                extractCropFromImage('data:image/png;base64,test', 10, 10, 20, 20)
            ).rejects.toThrow('Failed to get canvas context');
        });

        it('should reject when image fails to load', async () => {
            class MockImage {
                width = 0;
                height = 0;
                src = '';
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;

                constructor() {
                    setTimeout(() => {
                        if (this.onerror) this.onerror();
                    }, 0);
                }
            }
            vi.stubGlobal('Image', MockImage);

            await expect(
                extractCropFromImage('data:image/png;base64,invalid', 10, 10, 20, 20)
            ).rejects.toThrow('Failed to load image');
        });
    });

    // ========================================
    // addCorrection Error Paths
    // ========================================
    describe('addCorrection - Error Paths', () => {
        it('should handle crop extraction failure gracefully', async () => {
            startFeedbackSession('data:image/png;base64,test', 800, 600);

            // Mock extractCropFromImage to fail by mocking Image to error
            class MockImage {
                width = 0;
                height = 0;
                src = '';
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;

                constructor() {
                    setTimeout(() => {
                        if (this.onerror) this.onerror();
                    }, 0);
                }
            }
            vi.stubGlobal('Image', MockImage);

            const detection: DetectionForFeedback = {
                detectedItemId: 'sword',
                detectedItemName: 'Sword',
                confidence: 0.5,
                x: 100,
                y: 100,
                width: 50,
                height: 50,
                // No cropDataUrl - will trigger extraction attempt
            };

            const correctItem = { id: 'blade', name: 'Blade' };

            // Should still add correction despite crop failure
            const result = await addCorrection(detection, correctItem as any);

            expect(result).not.toBeNull();
            expect(result!.correctItemId).toBe('blade');
            // cropDataUrl should be undefined since extraction failed
            expect(result!.detection.cropDataUrl).toBeUndefined();
        });

        it('should skip crop extraction when session has no imageDataUrl', async () => {
            // Create a session but clear the imageDataUrl
            const session = startFeedbackSession('data:image/png;base64,test', 800, 600);
            session.imageDataUrl = undefined;

            const detection: DetectionForFeedback = {
                detectedItemId: 'sword',
                detectedItemName: 'Sword',
                confidence: 0.5,
                x: 100,
                y: 100,
                width: 50,
                height: 50,
            };

            const correctItem = { id: 'blade', name: 'Blade' };

            const result = await addCorrection(detection, correctItem as any);

            expect(result).not.toBeNull();
            expect(result!.detection.cropDataUrl).toBeUndefined();
        });

        it('should use pre-provided cropDataUrl without extraction', async () => {
            startFeedbackSession('data:image/png;base64,test', 800, 600);

            const detection: DetectionForFeedback = {
                detectedItemId: 'sword',
                detectedItemName: 'Sword',
                confidence: 0.5,
                x: 100,
                y: 100,
                width: 50,
                height: 50,
                cropDataUrl: 'data:image/png;base64,pre-existing-crop',
            };

            const correctItem = { id: 'blade', name: 'Blade' };

            const result = await addCorrection(detection, correctItem as any);

            expect(result).not.toBeNull();
            expect(result!.detection.cropDataUrl).toBe('data:image/png;base64,pre-existing-crop');
        });

        it('should handle sessionStorage failure when saving correction', async () => {
            startFeedbackSession('data:image/png;base64,test', 800, 600);

            // Mock sessionStorage.setItem to fail after session creation
            vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
                throw new Error('StorageError');
            });

            const detection: DetectionForFeedback = {
                detectedItemId: 'sword',
                detectedItemName: 'Sword',
                confidence: 0.5,
                x: 100,
                y: 100,
                width: 50,
                height: 50,
                cropDataUrl: 'data:image/png;base64,crop',
            };

            const correctItem = { id: 'blade', name: 'Blade' };

            // Should still succeed despite storage failure
            const result = await addCorrection(detection, correctItem as any);
            expect(result).not.toBeNull();
        });
    });

    // ========================================
    // removeCorrection Error Paths
    // ========================================
    describe('removeCorrection - Error Paths', () => {
        it('should handle sessionStorage failure when saving after removal', () => {
            startFeedbackSession('data:image/png;base64,test', 800, 600);

            // Add a correction
            const session = getCurrentSession()!;
            session.corrections.push({
                id: 'test-correction-id',
                timestamp: new Date().toISOString(),
                detection: {
                    detectedItemId: 'sword',
                    detectedItemName: 'Sword',
                    confidence: 0.5,
                    x: 100,
                    y: 100,
                    width: 50,
                    height: 50,
                },
                correctItemId: 'blade',
                correctItemName: 'Blade',
                resolution: { width: 800, height: 600 },
            });

            // Mock sessionStorage.setItem to fail
            vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
                throw new Error('StorageError');
            });

            // Should still return true despite storage failure
            const result = removeCorrection('test-correction-id');
            expect(result).toBe(true);
            expect(getCorrectionCount()).toBe(0);
        });
    });

    // ========================================
    // exportFeedback Edge Cases
    // ========================================
    describe('exportFeedback - Edge Cases', () => {
        it('should handle corrections with missing resolution', () => {
            startFeedbackSession('data:image/png;base64,test', 800, 600);

            const session = getCurrentSession()!;
            session.corrections.push({
                id: 'test-correction',
                timestamp: new Date().toISOString(),
                detection: {
                    detectedItemId: 'sword',
                    detectedItemName: 'Sword',
                    confidence: 0.5,
                    x: 100,
                    y: 100,
                    width: 50,
                    height: 50,
                },
                correctItemId: 'blade',
                correctItemName: 'Blade',
                resolution: { width: 0, height: 0 }, // Edge case: zero resolution
            });

            const exported = exportFeedback();

            expect(exported).not.toBeNull();
            expect(exported!.corrections[0].resolution).toBe('0x0');
        });

        it('should handle corrections with missing cropDataUrl', () => {
            startFeedbackSession('data:image/png;base64,test', 800, 600);

            const session = getCurrentSession()!;
            session.corrections.push({
                id: 'test-correction',
                timestamp: new Date().toISOString(),
                detection: {
                    detectedItemId: 'sword',
                    detectedItemName: 'Sword',
                    confidence: 0.5,
                    x: 100,
                    y: 100,
                    width: 50,
                    height: 50,
                    // No cropDataUrl
                },
                correctItemId: 'blade',
                correctItemName: 'Blade',
                resolution: { width: 800, height: 600 },
            });

            const exported = exportFeedback();

            expect(exported).not.toBeNull();
            expect(exported!.corrections[0].cropData).toBe('');
        });

        it('should calculate correct unique items count with duplicates', () => {
            startFeedbackSession('data:image/png;base64,test', 800, 600);

            const session = getCurrentSession()!;
            // Add multiple corrections to the same item
            session.corrections.push({
                id: 'test-correction-1',
                timestamp: new Date().toISOString(),
                detection: {
                    detectedItemId: 'sword',
                    detectedItemName: 'Sword',
                    confidence: 0.4,
                    x: 100,
                    y: 100,
                    width: 50,
                    height: 50,
                },
                correctItemId: 'blade',
                correctItemName: 'Blade',
                resolution: { width: 800, height: 600 },
            });
            session.corrections.push({
                id: 'test-correction-2',
                timestamp: new Date().toISOString(),
                detection: {
                    detectedItemId: 'dagger',
                    detectedItemName: 'Dagger',
                    confidence: 0.3,
                    x: 200,
                    y: 200,
                    width: 50,
                    height: 50,
                },
                correctItemId: 'blade', // Same correct item
                correctItemName: 'Blade',
                resolution: { width: 800, height: 600 },
            });

            const exported = exportFeedback();

            expect(exported).not.toBeNull();
            expect(exported!.stats.totalCorrections).toBe(2);
            expect(exported!.stats.uniqueItems).toBe(1); // Only one unique item: blade
        });
    });

    // ========================================
    // isDetectionCorrected Edge Cases
    // ========================================
    describe('isDetectionCorrected - Edge Cases', () => {
        it('should handle exact coordinate match', () => {
            startFeedbackSession('data:image/png;base64,test', 800, 600);

            const session = getCurrentSession()!;
            session.corrections.push({
                id: 'test-correction',
                timestamp: new Date().toISOString(),
                detection: {
                    detectedItemId: 'sword',
                    detectedItemName: 'Sword',
                    confidence: 0.5,
                    x: 150,
                    y: 250,
                    width: 50,
                    height: 50,
                },
                correctItemId: 'blade',
                correctItemName: 'Blade',
                resolution: { width: 800, height: 600 },
            });

            expect(isDetectionCorrected('sword', 150, 250)).toBe(true);
        });

        it('should return false for different item ID even with same coordinates', () => {
            startFeedbackSession('data:image/png;base64,test', 800, 600);

            const session = getCurrentSession()!;
            session.corrections.push({
                id: 'test-correction',
                timestamp: new Date().toISOString(),
                detection: {
                    detectedItemId: 'sword',
                    detectedItemName: 'Sword',
                    confidence: 0.5,
                    x: 150,
                    y: 250,
                    width: 50,
                    height: 50,
                },
                correctItemId: 'blade',
                correctItemName: 'Blade',
                resolution: { width: 800, height: 600 },
            });

            // Same coordinates but different item ID
            expect(isDetectionCorrected('shield', 150, 250)).toBe(false);
        });

        it('should handle boundary tolerance (exactly 4 pixels away)', () => {
            startFeedbackSession('data:image/png;base64,test', 800, 600);

            const session = getCurrentSession()!;
            session.corrections.push({
                id: 'test-correction',
                timestamp: new Date().toISOString(),
                detection: {
                    detectedItemId: 'sword',
                    detectedItemName: 'Sword',
                    confidence: 0.5,
                    x: 100,
                    y: 100,
                    width: 50,
                    height: 50,
                },
                correctItemId: 'blade',
                correctItemName: 'Blade',
                resolution: { width: 800, height: 600 },
            });

            // Exactly 4 pixels away (within 5px tolerance)
            expect(isDetectionCorrected('sword', 104, 104)).toBe(true);
            expect(isDetectionCorrected('sword', 96, 96)).toBe(true);
        });

        it('should return false for exactly 5 pixels away', () => {
            startFeedbackSession('data:image/png;base64,test', 800, 600);

            const session = getCurrentSession()!;
            session.corrections.push({
                id: 'test-correction',
                timestamp: new Date().toISOString(),
                detection: {
                    detectedItemId: 'sword',
                    detectedItemName: 'Sword',
                    confidence: 0.5,
                    x: 100,
                    y: 100,
                    width: 50,
                    height: 50,
                },
                correctItemId: 'blade',
                correctItemName: 'Blade',
                resolution: { width: 800, height: 600 },
            });

            // Exactly 5 pixels away (boundary - should return false)
            expect(isDetectionCorrected('sword', 105, 100)).toBe(false);
            expect(isDetectionCorrected('sword', 100, 105)).toBe(false);
        });
    });

    // ========================================
    // __resetForTesting Edge Cases
    // ========================================
    describe('__resetForTesting - Edge Cases', () => {
        it('should handle reset when sessionStorage throws', () => {
            startFeedbackSession('data:image/png;base64,test', 800, 600);

            vi.spyOn(sessionStorage, 'removeItem').mockImplementation(() => {
                throw new Error('StorageError');
            });

            // Should not throw
            expect(() => __resetForTesting()).not.toThrow();
            expect(getCurrentSession()).toBeNull();
        });

        it('should be idempotent (can be called multiple times)', () => {
            startFeedbackSession('data:image/png;base64,test', 800, 600);

            __resetForTesting();
            __resetForTesting();
            __resetForTesting();

            expect(getCurrentSession()).toBeNull();
        });
    });

    // ========================================
    // Session with Missing imageResolution
    // ========================================
    describe('Session with Missing imageResolution', () => {
        it('should handle addCorrection when session has no imageResolution', async () => {
            const session = startFeedbackSession('data:image/png;base64,test', 800, 600);
            // Simulate missing resolution
            session.imageResolution = undefined;

            const detection: DetectionForFeedback = {
                detectedItemId: 'sword',
                detectedItemName: 'Sword',
                confidence: 0.5,
                x: 100,
                y: 100,
                width: 50,
                height: 50,
                cropDataUrl: 'data:image/png;base64,crop',
            };

            const correctItem = { id: 'blade', name: 'Blade' };

            const result = await addCorrection(detection, correctItem as any);

            expect(result).not.toBeNull();
            // Should use fallback resolution
            expect(result!.resolution).toEqual({ width: 0, height: 0 });
        });
    });

    // ========================================
    // Multiple Corrections Workflow
    // ========================================
    describe('Multiple Corrections Workflow', () => {
        it('should handle adding and removing multiple corrections', async () => {
            startFeedbackSession('data:image/png;base64,test', 800, 600);

            const detection1: DetectionForFeedback = {
                detectedItemId: 'sword',
                detectedItemName: 'Sword',
                confidence: 0.5,
                x: 100,
                y: 100,
                width: 50,
                height: 50,
                cropDataUrl: 'data:image/png;base64,crop1',
            };
            const detection2: DetectionForFeedback = {
                detectedItemId: 'shield',
                detectedItemName: 'Shield',
                confidence: 0.6,
                x: 200,
                y: 200,
                width: 60,
                height: 60,
                cropDataUrl: 'data:image/png;base64,crop2',
            };
            const detection3: DetectionForFeedback = {
                detectedItemId: 'potion',
                detectedItemName: 'Potion',
                confidence: 0.7,
                x: 300,
                y: 300,
                width: 40,
                height: 40,
                cropDataUrl: 'data:image/png;base64,crop3',
            };

            const result1 = await addCorrection(detection1, { id: 'blade', name: 'Blade' } as any);
            const result2 = await addCorrection(detection2, { id: 'armor', name: 'Armor' } as any);
            const result3 = await addCorrection(detection3, { id: 'elixir', name: 'Elixir' } as any);

            expect(getCorrectionCount()).toBe(3);

            // Remove middle correction
            removeCorrection(result2!.id);
            expect(getCorrectionCount()).toBe(2);

            // Verify remaining corrections
            const corrections = getCorrections();
            expect(corrections.map(c => c.correctItemId)).toEqual(['blade', 'elixir']);
        });

        it('should export all remaining corrections after removals', async () => {
            startFeedbackSession('data:image/png;base64,test', 800, 600);

            const detection1: DetectionForFeedback = {
                detectedItemId: 'sword',
                detectedItemName: 'Sword',
                confidence: 0.4,
                x: 100,
                y: 100,
                width: 50,
                height: 50,
                cropDataUrl: 'data:image/png;base64,crop1',
            };
            const detection2: DetectionForFeedback = {
                detectedItemId: 'shield',
                detectedItemName: 'Shield',
                confidence: 0.6,
                x: 200,
                y: 200,
                width: 60,
                height: 60,
                cropDataUrl: 'data:image/png;base64,crop2',
            };

            const result1 = await addCorrection(detection1, { id: 'blade', name: 'Blade' } as any);
            await addCorrection(detection2, { id: 'armor', name: 'Armor' } as any);

            // Remove first correction
            removeCorrection(result1!.id);

            const exported = exportFeedback();
            expect(exported).not.toBeNull();
            expect(exported!.stats.totalCorrections).toBe(1);
            expect(exported!.corrections[0].itemId).toBe('armor');
            expect(exported!.stats.avgOriginalConfidence).toBeCloseTo(0.6, 2);
        });
    });
});
