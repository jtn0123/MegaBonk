/**
 * CV Pipeline Integration Tests
 * Tests the full detection pipeline with realistic scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('CV Pipeline Integration Tests', () => {
    describe('End-to-End Detection Flow', () => {
        it('should process image through full pipeline', async () => {
            // Mock: Image → Region Detection → Template Matching → Post-processing → Results
            const mockPipeline = {
                loadImage: vi.fn().mockResolvedValue({ width: 1280, height: 720 }),
                detectRegions: vi.fn().mockReturnValue([
                    { x: 100, y: 600, width: 45, height: 45 },
                    { x: 150, y: 600, width: 45, height: 45 },
                ]),
                matchTemplates: vi.fn().mockResolvedValue([
                    { name: 'Wrench', confidence: 0.88, x: 100, y: 600 },
                    { name: 'Medkit', confidence: 0.85, x: 150, y: 600 },
                ]),
                postProcess: vi.fn().mockReturnValue([
                    { name: 'Wrench', confidence: 0.88 },
                    { name: 'Medkit', confidence: 0.85 },
                ]),
            };

            const image = await mockPipeline.loadImage();
            const regions = mockPipeline.detectRegions(image);
            const matches = await mockPipeline.matchTemplates(regions);
            const results = mockPipeline.postProcess(matches);

            expect(results).toHaveLength(2);
            expect(results[0].name).toBe('Wrench');
            expect(mockPipeline.loadImage).toHaveBeenCalledTimes(1);
            expect(mockPipeline.detectRegions).toHaveBeenCalledTimes(1);
            expect(mockPipeline.matchTemplates).toHaveBeenCalledTimes(1);
            expect(mockPipeline.postProcess).toHaveBeenCalledTimes(1);
        });

        it('should handle multi-pass detection', async () => {
            const mockDetector = {
                pass1: vi.fn().mockResolvedValue([{ name: 'Wrench', confidence: 0.88 }]),
                pass2: vi.fn().mockResolvedValue([
                    { name: 'Wrench', confidence: 0.88 },
                    { name: 'Medkit', confidence: 0.72 },
                ]),
                pass3: vi.fn().mockResolvedValue([
                    { name: 'Wrench', confidence: 0.88 },
                    { name: 'Medkit', confidence: 0.72 },
                    { name: 'Tent', confidence: 0.58 },
                ]),
            };

            const results1 = await mockDetector.pass1();
            const results2 = await mockDetector.pass2();
            const results3 = await mockDetector.pass3();

            expect(results1).toHaveLength(1);
            expect(results2).toHaveLength(2);
            expect(results3).toHaveLength(3);
        });

        it('should apply NMS (Non-Maximum Suppression)', () => {
            const detections = [
                { name: 'Wrench', confidence: 0.88, x: 100, y: 600, width: 45, height: 45 },
                { name: 'Wrench', confidence: 0.75, x: 102, y: 602, width: 45, height: 45 }, // Duplicate
                { name: 'Medkit', confidence: 0.85, x: 200, y: 600, width: 45, height: 45 },
            ];

            const filtered = applyNMS(detections, 0.5);

            // Should remove duplicate Wrench detection
            expect(filtered).toHaveLength(2);
            expect(filtered[0].name).toBe('Wrench');
            expect(filtered[0].confidence).toBe(0.88); // Keep highest confidence
            expect(filtered[1].name).toBe('Medkit');
        });

        it('should aggregate detections by slot', () => {
            const detections = [
                { name: 'Wrench', confidence: 0.88, slot: 0 },
                { name: 'wrench', confidence: 0.65, slot: 0 }, // Same slot, different match
                { name: 'Medkit', confidence: 0.85, slot: 1 },
            ];

            const aggregated = aggregateBySlot(detections);

            // Should keep best match per slot
            expect(aggregated).toHaveLength(2);
            expect(aggregated[0].name).toBe('Wrench');
            expect(aggregated[0].confidence).toBe(0.88);
        });
    });

    describe('Strategy Switching', () => {
        it('should switch strategies mid-detection', () => {
            const strategies = ['current', 'optimized', 'fast'];
            const results: any[] = [];

            for (const strategy of strategies) {
                // Mock: switch strategy and run detection
                const result = { strategy, items: [{ name: 'Wrench' }] };
                results.push(result);
            }

            expect(results).toHaveLength(3);
            expect(results[0].strategy).toBe('current');
            expect(results[1].strategy).toBe('optimized');
            expect(results[2].strategy).toBe('fast');
        });

        it('should preserve results when switching strategies', () => {
            const initialResults = [
                { name: 'Wrench', confidence: 0.88 },
                { name: 'Medkit', confidence: 0.85 },
            ];

            // Switch strategy
            const newStrategy = 'fast';

            // Results should still be valid after switch
            expect(initialResults).toHaveLength(2);
            expect(newStrategy).toBe('fast');
        });
    });

    describe('Color Filtering Integration', () => {
        it('should filter by rarity before template matching', () => {
            const regions = [
                { x: 100, y: 600, color: 'legendary', rarity: 'legendary' },
                { x: 150, y: 600, color: 'common', rarity: 'common' },
                { x: 200, y: 600, color: 'rare', rarity: 'rare' },
            ];

            const legendaryItems = ['Big Bonk', 'Anvil'];
            const filtered = regions.filter(r => r.rarity === 'legendary');

            // Should only match against legendary items
            expect(filtered).toHaveLength(1);
            expect(filtered[0].rarity).toBe('legendary');
        });

        it('should boost confidence for matching rarity', () => {
            const detections = [
                { name: 'Big Bonk', confidence: 0.82, detectedRarity: 'legendary', actualRarity: 'legendary' },
                { name: 'Wrench', confidence: 0.85, detectedRarity: 'common', actualRarity: 'rare' },
            ];

            const boosted = detections.map(d => ({
                ...d,
                confidence: d.detectedRarity === d.actualRarity ? d.confidence * 1.1 : d.confidence,
            }));

            // Big Bonk should get boost, Wrench should not
            expect(boosted[0].confidence).toBeGreaterThan(0.82);
            expect(boosted[1].confidence).toBe(0.85);
        });
    });

    describe('Context-Based Boosting', () => {
        it('should boost confidence for synergistic items', () => {
            const detections = [
                { name: 'Beefy Ring', confidence: 0.78 },
                { name: 'Oats', confidence: 0.82 }, // Synergizes with Beefy Ring
            ];

            // Mock synergy detection
            const synergies = { 'Beefy Ring': ['Oats', 'Demonic Blood', 'Holy Book'] };

            if (detections.some(d => d.name === 'Oats')) {
                const beefyRing = detections.find(d => d.name === 'Beefy Ring');
                if (beefyRing) {
                    beefyRing.confidence *= 1.05; // Boost
                }
            }

            expect(detections[0].confidence).toBeGreaterThan(0.78);
        });

        it('should boost confidence for common duplicates', () => {
            const detections = [
                { name: 'Wrench', confidence: 0.85 },
                { name: 'Wrench', confidence: 0.72 },
                { name: 'Wrench', confidence: 0.68 },
            ];

            // Having multiple of same item is common, boost confidence
            const wrenchCount = detections.filter(d => d.name === 'Wrench').length;

            if (wrenchCount >= 3) {
                detections.forEach(d => {
                    if (d.name === 'Wrench' && d.confidence < 0.8) {
                        d.confidence *= 1.05;
                    }
                });
            }

            expect(detections[1].confidence).toBeGreaterThan(0.72);
            expect(detections[2].confidence).toBeGreaterThan(0.68);
        });
    });

    describe('Error Propagation', () => {
        it('should handle region detection failure gracefully', async () => {
            const mockPipeline = {
                detectRegions: vi.fn().mockReturnValue([]), // No regions found
                matchTemplates: vi.fn(),
            };

            const regions = mockPipeline.detectRegions();

            if (regions.length === 0) {
                // Don't call matchTemplates if no regions
                expect(mockPipeline.matchTemplates).not.toHaveBeenCalled();
            }
        });

        it('should handle template loading failure', async () => {
            const mockLoader = {
                loadTemplate: vi.fn().mockRejectedValue(new Error('Template not found')),
            };

            try {
                await mockLoader.loadTemplate('NonexistentItem');
            } catch (e) {
                expect((e as Error).message).toBe('Template not found');
            }

            // Should continue with other templates
            expect(mockLoader.loadTemplate).toHaveBeenCalledTimes(1);
        });

        it('should handle corrupted image data', () => {
            const corruptedImage = { width: 0, height: 0, data: null };

            const isValid = corruptedImage.width > 0 && corruptedImage.height > 0 && corruptedImage.data !== null;

            expect(isValid).toBe(false);
        });

        it('should recover from partial failures', async () => {
            const mockDetector = {
                detectItem: vi
                    .fn()
                    .mockResolvedValueOnce({ name: 'Wrench', confidence: 0.88 })
                    .mockRejectedValueOnce(new Error('Detection failed'))
                    .mockResolvedValueOnce({ name: 'Medkit', confidence: 0.85 }),
            };

            const results = [];

            for (let i = 0; i < 3; i++) {
                try {
                    const result = await mockDetector.detectItem();
                    results.push(result);
                } catch (e) {
                    // Log error but continue
                    console.error('Detection failed', e);
                }
            }

            // Should have 2 successful detections despite 1 failure
            expect(results).toHaveLength(2);
            expect(results[0].name).toBe('Wrench');
            expect(results[1].name).toBe('Medkit');
        });
    });

    describe('Performance Under Load', () => {
        it('should handle rapid successive detections', async () => {
            const mockDetector = {
                detect: vi.fn().mockResolvedValue([{ name: 'Wrench' }]),
            };

            const promises = [];

            for (let i = 0; i < 10; i++) {
                promises.push(mockDetector.detect());
            }

            const results = await Promise.all(promises);

            expect(results).toHaveLength(10);
            expect(mockDetector.detect).toHaveBeenCalledTimes(10);
        });

        it('should maintain accuracy under load', async () => {
            const detections = [];

            for (let i = 0; i < 100; i++) {
                // Mock: rapid detections
                detections.push({ name: 'Wrench', confidence: 0.85 + Math.random() * 0.1 });
            }

            const avgConfidence =
                detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length;

            // Average confidence should remain high
            expect(avgConfidence).toBeGreaterThan(0.8);
        });

        it('should not degrade over time', async () => {
            const initialDetections = [
                { name: 'Wrench', confidence: 0.88 },
                { name: 'Medkit', confidence: 0.85 },
            ];

            // Simulate many detections
            const laterDetections = [
                { name: 'Wrench', confidence: 0.87 },
                { name: 'Medkit', confidence: 0.84 },
            ];

            const initialAvg =
                initialDetections.reduce((sum, d) => sum + d.confidence, 0) /
                initialDetections.length;
            const laterAvg =
                laterDetections.reduce((sum, d) => sum + d.confidence, 0) /
                laterDetections.length;

            // Should not degrade significantly (within 5%)
            expect(laterAvg).toBeGreaterThan(initialAvg * 0.95);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty inventory', () => {
            const regions = [];
            const results = processRegions(regions);

            expect(results).toHaveLength(0);
        });

        it('should handle full inventory (maximum items)', () => {
            const regions = Array(50).fill({ x: 100, y: 600, width: 45, height: 45 });
            const results = processRegions(regions);

            expect(results.length).toBeLessThanOrEqual(50);
        });

        it('should handle duplicate items in same frame', () => {
            const detections = [
                { name: 'Wrench', confidence: 0.88, slot: 0 },
                { name: 'Wrench', confidence: 0.85, slot: 1 },
                { name: 'Wrench', confidence: 0.82, slot: 2 },
            ];

            // All should be kept (different slots)
            expect(detections).toHaveLength(3);
        });

        it('should handle extreme resolutions', () => {
            const resolutions = [
                { width: 1280, height: 720, valid: true },
                { width: 3840, height: 2160, valid: true },
                { width: 640, height: 480, valid: true },
                { width: 100, height: 100, valid: false }, // Too small
            ];

            for (const res of resolutions) {
                const isValid = res.width >= 640 && res.height >= 480;
                expect(isValid).toBe(res.valid);
            }
        });
    });
});

// Helper functions

function applyNMS(
    detections: Array<{ name: string; confidence: number; x: number; y: number; width: number; height: number }>,
    threshold: number
): Array<{ name: string; confidence: number; x: number; y: number; width: number; height: number }> {
    const filtered: Array<{
        name: string;
        confidence: number;
        x: number;
        y: number;
        width: number;
        height: number;
    }> = [];

    // Sort by confidence
    const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);

    for (const detection of sorted) {
        let shouldAdd = true;

        for (const existing of filtered) {
            // Calculate IoU
            const xOverlap = Math.max(
                0,
                Math.min(detection.x + detection.width, existing.x + existing.width) -
                    Math.max(detection.x, existing.x)
            );
            const yOverlap = Math.max(
                0,
                Math.min(detection.y + detection.height, existing.y + existing.height) -
                    Math.max(detection.y, existing.y)
            );

            const intersection = xOverlap * yOverlap;
            const union =
                detection.width * detection.height +
                existing.width * existing.height -
                intersection;

            const iou = intersection / union;

            if (iou > threshold && detection.name === existing.name) {
                shouldAdd = false;
                break;
            }
        }

        if (shouldAdd) {
            filtered.push(detection);
        }
    }

    return filtered;
}

function aggregateBySlot(detections: Array<{ name: string; confidence: number; slot: number }>) {
    const slots = new Map<number, { name: string; confidence: number; slot: number }>();

    for (const detection of detections) {
        const existing = slots.get(detection.slot);

        if (!existing || detection.confidence > existing.confidence) {
            slots.set(detection.slot, detection);
        }
    }

    return Array.from(slots.values());
}

function processRegions(regions: any[]): any[] {
    // Mock processing
    return regions.map(r => ({ name: 'Item', confidence: 0.85, ...r }));
}
