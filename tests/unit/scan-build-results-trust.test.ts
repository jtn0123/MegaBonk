/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character, Item, Tome, Weapon } from '../../src/types';

vi.mock('../../src/modules/toast.ts', () => ({
    ToastManager: {
        success: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

import {
    applyToAdvisor,
    createDisplayDetectionResult,
    markDetectionReviewed,
    renderDetectionReview,
    resetDetectionReviewState,
    type DetectionResults,
} from '../../src/modules/scan-build-results.ts';
import { ToastManager } from '../../src/modules/toast.ts';

const mockItem = (id: string, name: string): Item => ({
    id,
    name,
    description: `${name} description`,
    rarity: 'common',
    tier: 'A',
    tags: ['test'],
    mechanics: { base: { damage: 10 } },
});

const mockTome = (id: string, name: string): Tome => ({
    id,
    name,
    description: `${name} description`,
    tier: 'A',
    stat_affected: 'damage',
    value_per_level: '5%',
    max_level: 5,
    priority: 1,
});

const mockCharacter = (id: string, name: string): Character => ({
    id,
    name,
    description: `${name} description`,
    tier: 'S',
    starting_stats: { health: 100, damage: 10 },
    passive_abilities: [],
});

const mockWeapon = (id: string, name: string): Weapon => ({
    id,
    name,
    description: `${name} description`,
    tier: 'A',
    base_damage: 10,
    attack_speed: 1,
    upgrade_path: [],
});

describe('scan-build-results trust layer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetDetectionReviewState();
        document.body.innerHTML = `
            <div id="scan-detection-info"></div>
            <div id="scan-character-grid"><button data-id="clank">CL4NK</button></div>
            <div id="scan-weapon-grid"><button data-id="hammer">Hammer</button></div>
            <div id="scan-grid-items-container"><button data-id="wrench">Wrench</button></div>
            <div id="scan-tome-grid"><button data-id="strength">Strength</button></div>
            <div id="advisor-current-build-section"></div>
        `;
    });

    it('should classify confidence thresholds into review buckets', () => {
        expect(createDisplayDetectionResult({
            type: 'item',
            entity: mockItem('safe', 'Safe'),
            confidence: 0.8,
            rawText: 'safe',
        }, 'ocr').reviewLevel).toBe('safe');

        expect(createDisplayDetectionResult({
            type: 'item',
            entity: mockItem('review', 'Review'),
            confidence: 0.5,
            rawText: 'review',
        }, 'ocr').reviewLevel).toBe('review');

        expect(createDisplayDetectionResult({
            type: 'item',
            entity: mockItem('risky', 'Risky'),
            confidence: 0.49,
            rawText: 'risky',
        }, 'ocr').reviewLevel).toBe('risky');
    });

    it('should render review queue and source badges for flagged detections', () => {
        const results: DetectionResults = {
            character: createDisplayDetectionResult({
                type: 'character',
                entity: mockCharacter('clank', 'CL4NK'),
                confidence: 0.91,
                rawText: 'clank',
            }, 'ocr'),
            weapon: null,
            items: [
                createDisplayDetectionResult({
                    type: 'item',
                    entity: mockItem('wrench', 'Wrench'),
                    confidence: 0.62,
                    rawText: 'wrench',
                }, 'cv', ['OCR-only fallback']),
            ],
            tomes: [
                createDisplayDetectionResult({
                    type: 'tome',
                    entity: mockTome('strength', 'Strength'),
                    confidence: 0.33,
                    rawText: 'strength',
                }, 'hybrid', ['hybrid disagreement']),
            ],
        };

        renderDetectionReview(results);

        const detectionInfo = document.getElementById('scan-detection-info')!;
        expect(detectionInfo.innerHTML).toContain('Review Queue');
        expect(detectionInfo.innerHTML).toContain('source-cv');
        expect(detectionInfo.innerHTML).toContain('source-hybrid');
        expect(detectionInfo.innerHTML).toContain('OCR-only fallback');
        expect(detectionInfo.innerHTML).toContain('hybrid disagreement');
    });

    it('should remove corrected entities from the review queue', () => {
        const results: DetectionResults = {
            character: null,
            weapon: null,
            items: [
                createDisplayDetectionResult({
                    type: 'item',
                    entity: mockItem('wrench', 'Wrench'),
                    confidence: 0.55,
                    rawText: 'wrench',
                }, 'ocr'),
            ],
            tomes: [],
        };

        renderDetectionReview(results);
        expect(document.getElementById('scan-detection-info')!.innerHTML).toContain('Wrench');

        markDetectionReviewed('item', 'wrench');

        const detectionInfo = document.getElementById('scan-detection-info')!;
        expect(detectionInfo.innerHTML).not.toContain('data-review-id="wrench"');
        expect(detectionInfo.innerHTML).toContain('Reviewed');
    });

    it('should warn when applying with unresolved risky detections', () => {
        const results: DetectionResults = {
            character: null,
            weapon: createDisplayDetectionResult({
                type: 'weapon',
                entity: mockWeapon('hammer', 'Hammer'),
                confidence: 0.41,
                rawText: 'hammer',
            }, 'cv', ['CV-only fallback']),
            items: [],
            tomes: [],
        };

        renderDetectionReview(results);

        applyToAdvisor(
            {
                selectedCharacter: null,
                selectedWeapon: mockWeapon('hammer', 'Hammer'),
                selectedItems: new Map(),
                selectedTomes: new Map(),
            },
            null
        );

        expect(ToastManager.warning).toHaveBeenCalledWith(
            expect.stringContaining('risky detection')
        );
        expect(ToastManager.success).toHaveBeenCalledWith('Build state applied to advisor!');
    });
});
