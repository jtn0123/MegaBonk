import { describe, it, expect, beforeAll } from 'vitest';
import {
    boostConfidenceWithContext,
    filterByConfidence,
    aggregateDetections,
    getCachedResults,
    cacheResults,
    buildDetectionCacheKey,
} from '../../src/modules/cv/detection-processing.ts';
import type { CVDetectionResult } from '../../src/modules/cv/types.ts';
import { resetState, setPriorityTemplatesLoaded, setTemplatesLoaded } from '../../src/modules/cv/state.ts';

beforeAll(() => {
    if (typeof globalThis.ImageData === 'undefined') {
        const c = document.createElement('canvas');
        const ctx = c.getContext('2d')!;
        (globalThis as any).ImageData = ctx.createImageData(1, 1).constructor;
    }
});

function mkDet(o: any): CVDetectionResult {
    return { type: 'item', confidence: 0.8, method: 'template_match', ...o } as CVDetectionResult;
}

describe('cv/detection-processing extended', () => {
    beforeAll(() => {
        resetState();
    });

    describe('boostConfidenceWithContext', () => {
        it('boosts common', () => {
            const r = boostConfidenceWithContext([mkDet({entity:{name:'S',rarity:'common'}})]);
            expect(r[0]!.confidence).toBeGreaterThan(0.8);
        });
        it('boosts uncommon', () => {
            const r = boostConfidenceWithContext([mkDet({entity:{name:'S',rarity:'uncommon'}})]);
            expect(r[0]!.confidence).toBeCloseTo(0.82, 10);
        });
        it('penalizes legendary', () => {
            const r = boostConfidenceWithContext([mkDet({entity:{name:'C',rarity:'legendary'}})]);
            expect(r[0]!.confidence).toBeLessThan(0.8);
        });
        it('boosts synergies', () => {
            const r = boostConfidenceWithContext([
                mkDet({entity:{name:'Wrench',rarity:'common'}}),
                mkDet({entity:{name:'Scrap Metal',rarity:'common'}}),
            ]);
            expect(r[0]!.confidence).toBeGreaterThan(0.83);
        });
        it('clamps to 0.99', () => {
            const r = boostConfidenceWithContext([mkDet({entity:{name:'T',rarity:'common'},confidence:0.99})]);
            expect(r[0]!.confidence).toBeLessThanOrEqual(0.99);
        });
        it('empty input', () => { expect(boostConfidenceWithContext([])).toEqual([]); });
    });

    describe('filterByConfidence', () => {
        it('filters low', () => {
            expect(filterByConfidence([mkDet({entity:{name:'A'},confidence:0.9}),mkDet({entity:{name:'B'},confidence:0.3})], 0.5)).toHaveLength(1);
        });
        it('all pass at 0', () => {
            expect(filterByConfidence([mkDet({entity:{name:'A'},confidence:0.1})], 0)).toHaveLength(1);
        });
        it('none pass at high', () => {
            expect(filterByConfidence([mkDet({entity:{name:'A'},confidence:0.5})], 0.9)).toHaveLength(0);
        });
    });

    describe('aggregateDetections', () => {
        it('merges arrays', () => {
            expect(aggregateDetections([mkDet({entity:{name:'A'}})],[mkDet({entity:{name:'B'}})])).toHaveLength(2);
        });
        it('handles empty', () => { expect(aggregateDetections([],[])).toHaveLength(0); });
    });

    describe('getCachedResults/cacheResults', () => {
        it('null for unknown', () => { expect(getCachedResults('xxx_' + Date.now())).toBeNull(); });
        it('round-trips', () => {
            const h = 'h_' + Date.now();
            cacheResults(h, [mkDet({entity:{name:'C'}})]);
            expect(getCachedResults(h)).toHaveLength(1);
        });

        it('builds distinct cache keys for mode and template readiness', () => {
            resetState();
            const coldMain = buildDetectionCacheKey('hash', false);
            const coldWorker = buildDetectionCacheKey('hash', true);
            setPriorityTemplatesLoaded(true);
            const priorityMain = buildDetectionCacheKey('hash', false);
            setTemplatesLoaded(true);
            const fullMain = buildDetectionCacheKey('hash', false);

            expect(coldMain).not.toBe(coldWorker);
            expect(coldMain).not.toBe(priorityMain);
            expect(priorityMain).not.toBe(fullMain);
        });
    });
});
