/**
 * @vitest-environment jsdom
 * Unit tests for cv/detection-pipeline/two-phase.ts
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { polyfillImageData } from './test-helpers';

beforeAll(() => {
    polyfillImageData();
});

// Mock all dependencies
vi.mock('../../../src/modules/logger.ts', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../src/modules/cv/state.ts', () => ({
    getTemplatesByColor: vi.fn(() => new Map()),
}));

vi.mock('../../../src/modules/cv/color.ts', () => ({
    getDominantColor: vi.fn(() => 'gray'),
    getColorCandidates: vi.fn((c: string) => [c]),
    isEmptyCell: vi.fn(() => false),
    calculateColorVariance: vi.fn(() => 2000),
}));

vi.mock('../../../src/modules/cv/training.ts', () => ({
    isTrainingDataLoaded: vi.fn(() => false),
}));

vi.mock('../../../src/modules/cv/metrics.ts', () => ({
    getMetricsCollector: vi.fn(() => ({
        recordGridDetectionTime: vi.fn(),
        recordTemplateMatchingTime: vi.fn(),
        recordColorFilter: vi.fn(),
        recordDetection: vi.fn(),
        recordTwoPhaseAttempt: vi.fn(),
    })),
}));

vi.mock('../../../src/modules/cv/detection-config.ts', () => ({
    getDynamicMinConfidence: vi.fn(() => 0.5),
}));

vi.mock('../../../src/modules/cv/validator-trace.ts', () => ({
    addSlotCandidate: vi.fn(),
    endValidatorStage: vi.fn(),
    updateValidatorStageProgress: vi.fn(),
    upsertSlotTrace: vi.fn(),
}));

vi.mock('../../../src/modules/cv/detection-grid.ts', () => ({
    detectHotbarRegion: vi.fn(() => ({ startY: 640, endY: 700, confidence: 0.9 })),
    detectIconEdges: vi.fn(() => [100, 148, 196, 244, 292]),
    inferGridFromEdges: vi.fn(() => ({
        startX: 100,
        startY: 640,
        cellWidth: 48,
        cellHeight: 48,
        columns: 5,
        rows: 1,
        confidence: 0.9,
    })),
    generateGridROIs: vi.fn(() => [
        { x: 100, y: 640, width: 48, height: 48 },
        { x: 148, y: 640, width: 48, height: 48 },
        { x: 196, y: 640, width: 48, height: 48 },
    ]),
}));

vi.mock('../../../src/modules/cv/detection-matching.ts', () => ({
    findBestTemplateMatch: vi.fn(() => null),
    findTopTemplateMatches: vi.fn(() => []),
}));

import { detectIconsWithTwoPhase } from '../../../src/modules/cv/detection-pipeline/two-phase';
import { inferGridFromEdges } from '../../../src/modules/cv/detection-grid';
import { findBestTemplateMatch, findTopTemplateMatches } from '../../../src/modules/cv/detection-matching';
import { isEmptyCell } from '../../../src/modules/cv/color';

describe('two-phase', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('detectIconsWithTwoPhase', () => {
        it('should return gridUsed:false when grid detection fails', async () => {
            vi.mocked(inferGridFromEdges).mockReturnValueOnce(null as any);

            const canvas = document.createElement('canvas');
            canvas.width = 1920;
            canvas.height = 1080;
            const ctx = canvas.getContext('2d')!;

            const result = await detectIconsWithTwoPhase(ctx, 1920, 1080, []);

            expect(result.gridUsed).toBe(false);
            expect(result.detections).toEqual([]);
            expect(result.grid).toBeNull();
        });

        it('should return gridUsed:false when confidence too low', async () => {
            vi.mocked(inferGridFromEdges).mockReturnValueOnce({
                startX: 100,
                startY: 640,
                cellWidth: 48,
                cellHeight: 48,
                columns: 5,
                rows: 1,
                confidence: 0.2, // Below 0.4 threshold
            } as any);

            const canvas = document.createElement('canvas');
            canvas.width = 1920;
            canvas.height = 1080;
            const ctx = canvas.getContext('2d')!;

            const result = await detectIconsWithTwoPhase(ctx, 1920, 1080, []);

            expect(result.gridUsed).toBe(false);
        });

        it('should return gridUsed:false when too few columns', async () => {
            vi.mocked(inferGridFromEdges).mockReturnValueOnce({
                startX: 100,
                startY: 640,
                cellWidth: 48,
                cellHeight: 48,
                columns: 2, // Below 3 threshold
                rows: 1,
                confidence: 0.9,
            } as any);

            const canvas = document.createElement('canvas');
            canvas.width = 1920;
            canvas.height = 1080;
            const ctx = canvas.getContext('2d')!;

            const result = await detectIconsWithTwoPhase(ctx, 1920, 1080, []);

            expect(result.gridUsed).toBe(false);
        });

        it('should skip empty cells in phase 2', async () => {
            vi.mocked(isEmptyCell).mockReturnValue(true);

            const canvas = document.createElement('canvas');
            canvas.width = 1920;
            canvas.height = 1080;
            const ctx = canvas.getContext('2d')!;

            const result = await detectIconsWithTwoPhase(ctx, 1920, 1080, []);

            expect(result.gridUsed).toBe(true);
            expect(result.detections).toEqual([]);
        });

        it('should detect items when template matches', async () => {
            vi.mocked(isEmptyCell).mockReturnValue(false);
            vi.mocked(findTopTemplateMatches).mockReturnValue([
                {
                    item: { id: 'item1', name: 'Test', rarity: 'common' } as any,
                    similarity: 0.8,
                },
            ]);
            vi.mocked(findBestTemplateMatch).mockReturnValue({
                item: { id: 'item1', name: 'Test', rarity: 'common' } as any,
                similarity: 0.8,
            });

            const canvas = document.createElement('canvas');
            canvas.width = 1920;
            canvas.height = 1080;
            const ctx = canvas.getContext('2d')!;

            const items = [{ id: 'item1', name: 'Test', rarity: 'common' }] as any[];
            const result = await detectIconsWithTwoPhase(ctx, 1920, 1080, items);

            expect(result.gridUsed).toBe(true);
            expect(result.detections.length).toBeGreaterThan(0);
            expect(result.detections[0]!.type).toBe('item');
            expect(result.detections[0]!.confidence).toBe(0.8);
        });

        it('should call progress callback during execution', async () => {
            vi.mocked(isEmptyCell).mockReturnValue(true);
            const progressFn = vi.fn();

            const canvas = document.createElement('canvas');
            canvas.width = 1920;
            canvas.height = 1080;
            const ctx = canvas.getContext('2d')!;

            await detectIconsWithTwoPhase(ctx, 1920, 1080, [], {
                progressCallback: progressFn,
            });

            // Should be called for phase 1 and phase 2
            expect(progressFn).toHaveBeenCalledWith(20, expect.any(String));
            expect(progressFn).toHaveBeenCalledWith(30, expect.any(String));
        });
    });
});
