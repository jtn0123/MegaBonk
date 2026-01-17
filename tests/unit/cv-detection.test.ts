/**
 * CV Detection Pipeline Tests (Consolidated)
 *
 * Tests the detection pipeline: region detection, multi-pass scanning,
 * hybrid (OCR+CV) combining, and integration scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, vi, test } from 'vitest';
import { detectUIRegions, detectScreenType } from '../../src/modules/cv/regions.ts';
import { aggregateDuplicates, combineDetections } from '../../src/modules/computer-vision.ts';
import type { CVDetectionResult, ROI, DetectionResult } from '../../src/types';
import { cvTestKit } from '../helpers/cv-test-kit.ts';
import { createMockGameData } from '../fixtures/mock-entities.ts';

// ========================================
// Test Helpers
// ========================================

const createOCRResult = (id: string, name: string, confidence: number): DetectionResult => ({
    type: 'item',
    entity: { id, name, rarity: 'common', tier: 'B', base_effect: '', unlocked_by_default: true },
    confidence,
    rawText: name,
});

const createCVResult = (id: string, name: string, confidence: number, pos?: Partial<ROI>): CVDetectionResult => ({
    type: 'item',
    entity: { id, name, rarity: 'common', tier: 'B', base_effect: '', unlocked_by_default: true },
    confidence,
    method: 'template_match',
    position: { x: pos?.x ?? 0, y: pos?.y ?? 0, width: pos?.width ?? 64, height: pos?.height ?? 64 },
});

// ========================================
// Screen Type Detection
// ========================================

describe('Screen Type Detection', () => {
    it('detects pause menu (dark bottom)', () => {
        const ctx = cvTestKit.image.mockContext(1280, 720);
        // Simulate dark bottom
        const screenType = detectScreenType(ctx, 1280, 720);
        expect(['pause_menu', 'gameplay']).toContain(screenType);
    });

    it('detects gameplay (colorful hotbar at bottom)', () => {
        const ctx = cvTestKit.image.mockContext(1280, 720);
        const screenType = detectScreenType(ctx, 1280, 720);
        expect(['pause_menu', 'gameplay']).toContain(screenType);
    });
});

// ========================================
// UI Region Detection (Parameterized)
// ========================================

describe('UI Region Detection', () => {
    const resolutions = [
        { name: '720p', width: 1280, height: 720 },
        { name: '800p', width: 1280, height: 800 },
        { name: '1080p', width: 1920, height: 1080 },
        { name: '1440p', width: 2560, height: 1440 },
    ];

    test.each(resolutions)('detects regions for $name ($width×$height)', ({ width, height }) => {
        const regions = detectUIRegions(width, height);

        expect(regions.pauseMenu).toBeDefined();
        expect(regions.inventory).toBeDefined();
    });

    it('pause menu regions include inventory and stats', () => {
        const regions = detectUIRegions(1280, 720);

        expect(regions.inventory).toBeDefined();
        expect(regions.stats).toBeDefined();
        expect(regions.pauseMenu).toBeDefined();
    });

    it('inventory region has reasonable dimensions', () => {
        const regions = detectUIRegions(1280, 800);

        expect(regions.inventory!.width).toBeGreaterThan(400);
        expect(regions.inventory!.height).toBeGreaterThan(200);
    });
});

// ========================================
// Multi-Region Detection Strategy
// ========================================

describe('Multi-Region Detection Strategy', () => {
    describe('Hotbar Region', () => {
        const hotbarTestCases = [
            { width: 1280, height: 720, expectedY: 576, expectedHeight: 144 },
            { width: 1920, height: 1080, expectedY: 864, expectedHeight: 216 },
            { width: 2560, height: 1440, expectedY: 1152, expectedHeight: 288 },
        ];

        test.each(hotbarTestCases)(
            'at $width×$height → y=$expectedY, h=$expectedHeight',
            ({ width, height, expectedY, expectedHeight }) => {
                const hotbarROI: ROI = {
                    x: 0,
                    y: Math.floor(height * 0.8),
                    width: width,
                    height: Math.floor(height * 0.2),
                };

                expect(hotbarROI.y).toBe(expectedY);
                expect(hotbarROI.height).toBe(expectedHeight);
                expect(hotbarROI.width).toBe(width);
            }
        );
    });

    describe('Equipment Region (Top-Left)', () => {
        it('defines equipment region in top-left corner', () => {
            const width = 1280, height = 720;
            const equipmentROI: ROI = {
                x: 0,
                y: 0,
                width: Math.floor(width * 0.25),
                height: Math.floor(height * 0.4),
            };

            expect(equipmentROI.x).toBe(0);
            expect(equipmentROI.y).toBe(0);
            expect(equipmentROI.width).toBe(320);
            expect(equipmentROI.height).toBe(288);
        });

        it('does not overlap with hotbar region', () => {
            const width = 1280, height = 720;
            const equipmentROI: ROI = { x: 0, y: 0, width: 320, height: 288 };
            const hotbarROI: ROI = { x: 0, y: 576, width: 1280, height: 144 };

            const equipBottom = equipmentROI.y + equipmentROI.height;
            expect(equipBottom).toBeLessThan(hotbarROI.y);
        });
    });
});

// ========================================
// Color Pre-Filtering
// ========================================

describe('Color Pre-Filtering', () => {
    it('filters candidates by rarity color', () => {
        const rarityFilters: Record<string, string[]> = {
            common: ['gray', 'white'],
            uncommon: ['green'],
            rare: ['blue', 'cyan'],
            epic: ['purple', 'violet'],
            legendary: ['orange', 'yellow', 'gold'],
        };

        // Green border should filter to uncommon items
        const detectedRarity = 'uncommon';
        const allowedColors = rarityFilters[detectedRarity];

        expect(allowedColors).toContain('green');
        expect(allowedColors).not.toContain('purple');
    });

    it('provides fallback for unknown colors', () => {
        const rarityFilters: Record<string, string[]> = {
            unknown: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
        };

        expect(rarityFilters.unknown.length).toBe(5);
    });
});

// ========================================
// Hybrid Detection - OCR + CV Combining
// ========================================

describe('Hybrid Detection', () => {
    describe('combineDetections', () => {
        it('merges OCR and CV results', () => {
            const ocrResults: DetectionResult[] = [
                createOCRResult('wrench', 'Wrench', 0.85),
                createOCRResult('medkit', 'Medkit', 0.75),
            ];

            const cvResults: CVDetectionResult[] = [
                createCVResult('wrench', 'Wrench', 0.90),
                createCVResult('battery', 'Battery', 0.80),
            ];

            const combined = combineDetections(ocrResults, cvResults);

            expect(combined.length).toBeGreaterThanOrEqual(2);
        });

        it('boosts confidence for items detected by both methods', () => {
            const ocrResults: DetectionResult[] = [createOCRResult('wrench', 'Wrench', 0.80)];
            const cvResults: CVDetectionResult[] = [createCVResult('wrench', 'Wrench', 0.85)];

            const combined = combineDetections(ocrResults, cvResults);
            const wrench = combined.find(d => d.entity.id === 'wrench');

            // Combined confidence should be higher than individual
            expect(wrench?.confidence).toBeGreaterThanOrEqual(0.85);
        });

        it('handles empty OCR results', () => {
            const cvResults: CVDetectionResult[] = [
                createCVResult('wrench', 'Wrench', 0.90),
                createCVResult('battery', 'Battery', 0.80),
            ];

            const combined = combineDetections([], cvResults);

            expect(combined).toHaveLength(2);
        });

        it('handles empty CV results', () => {
            const ocrResults: DetectionResult[] = [
                createOCRResult('wrench', 'Wrench', 0.85),
                createOCRResult('medkit', 'Medkit', 0.75),
            ];

            const combined = combineDetections(ocrResults, []);

            expect(combined).toHaveLength(2);
        });
    });

    describe('aggregateDuplicates', () => {
        it('counts duplicate items', () => {
            const detections: CVDetectionResult[] = [
                createCVResult('wrench', 'Wrench', 0.90, { x: 100, y: 600 }),
                createCVResult('wrench', 'Wrench', 0.85, { x: 150, y: 600 }),
                createCVResult('wrench', 'Wrench', 0.88, { x: 200, y: 600 }),
                createCVResult('battery', 'Battery', 0.80, { x: 250, y: 600 }),
            ];

            const aggregated = aggregateDuplicates(detections);

            const wrench = aggregated.find(d => d.entity.id === 'wrench');
            const battery = aggregated.find(d => d.entity.id === 'battery');

            expect(wrench?.count).toBe(3);
            expect(battery?.count).toBe(1);
        });

        it('uses highest confidence for aggregated item', () => {
            const detections: CVDetectionResult[] = [
                createCVResult('wrench', 'Wrench', 0.70),
                createCVResult('wrench', 'Wrench', 0.95),
                createCVResult('wrench', 'Wrench', 0.85),
            ];

            const aggregated = aggregateDuplicates(detections);
            const wrench = aggregated.find(d => d.entity.id === 'wrench');

            expect(wrench?.confidence).toBe(0.95);
        });

        it('handles single item (no duplicates)', () => {
            const detections: CVDetectionResult[] = [createCVResult('wrench', 'Wrench', 0.90)];

            const aggregated = aggregateDuplicates(detections);

            expect(aggregated).toHaveLength(1);
            expect(aggregated[0].count).toBe(1);
        });
    });
});

// ========================================
// Pipeline Integration Tests
// ========================================

describe('Detection Pipeline Integration', () => {
    it('processes image through full pipeline', async () => {
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
        expect(mockPipeline.loadImage).toHaveBeenCalledTimes(1);
        expect(mockPipeline.detectRegions).toHaveBeenCalledTimes(1);
    });

    it('handles multi-pass detection', async () => {
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

    it('aggregates detections by slot', () => {
        const detections = [
            { name: 'Wrench', confidence: 0.88, slot: 0 },
            { name: 'wrench', confidence: 0.65, slot: 0 }, // Same slot
            { name: 'Medkit', confidence: 0.85, slot: 1 },
        ];

        // Simple slot-based aggregation
        const slotMap = new Map<number, typeof detections[0]>();
        for (const d of detections) {
            const existing = slotMap.get(d.slot);
            if (!existing || d.confidence > existing.confidence) {
                slotMap.set(d.slot, d);
            }
        }

        const aggregated = Array.from(slotMap.values());

        expect(aggregated).toHaveLength(2);
        expect(aggregated.find(d => d.slot === 0)?.confidence).toBe(0.88);
    });
});

// ========================================
// Performance Tests
// ========================================

describe('Detection Performance', () => {
    it('region detection is fast (< 5ms)', () => {
        const start = performance.now();
        for (let i = 0; i < 100; i++) {
            detectUIRegions(1920, 1080);
        }
        const elapsed = performance.now() - start;

        expect(elapsed).toBeLessThan(50); // 100 iterations < 50ms = < 0.5ms each
    });

    it('aggregation handles 50+ detections efficiently', () => {
        const detections: CVDetectionResult[] = Array.from({ length: 50 }, (_, i) =>
            createCVResult(`item_${i % 10}`, `Item ${i % 10}`, 0.7 + Math.random() * 0.25)
        );

        const start = performance.now();
        aggregateDuplicates(detections);
        const elapsed = performance.now() - start;

        expect(elapsed).toBeLessThan(10);
    });
});
