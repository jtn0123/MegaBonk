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
    applyItemCorrection,
    applyToAdvisor,
    createDisplayDetectionResult,
    getTrustSummary,
    markDetectionReviewed,
    renderDetectionReview,
    resetDetectionReviewState,
    setDetectionReviewActions,
    type DetectionResults,
} from '../../src/modules/scan-build-results.ts';
import { logger } from '../../src/modules/logger.ts';
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
        setDetectionReviewActions({});
        document.body.innerHTML = `
            <div id="scan-detection-info"></div>
            <div id="scan-trust-summary"></div>
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

    it('should expose correction action callbacks for item detections', () => {
        const onOpenCorrection = vi.fn();
        setDetectionReviewActions({ onOpenCorrection });

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

        const correctButton = document.querySelector('[data-open-correction="true"]') as HTMLButtonElement;
        expect(correctButton).not.toBeNull();
        correctButton.click();

        expect(onOpenCorrection).toHaveBeenCalledWith(expect.objectContaining({
            entity: expect.objectContaining({ id: 'wrench' }),
        }));
    });

    it('should track explicit item corrections in the trust summary', () => {
        const results: DetectionResults = {
            character: null,
            weapon: null,
            items: [
                createDisplayDetectionResult({
                    type: 'item',
                    entity: mockItem('wrench', 'Wrench'),
                    confidence: 0.4,
                    rawText: 'wrench',
                    count: 2,
                }, 'cv'),
            ],
            tomes: [],
        };

        renderDetectionReview(results);
        applyItemCorrection('wrench', mockItem('battery', 'Battery'));

        const trustSummary = getTrustSummary();
        expect(trustSummary.explicitCorrectionCount).toBe(1);
        expect(trustSummary.reviewedCount).toBe(1);
        expect(document.getElementById('scan-detection-info')!.innerHTML).toContain('Corrected to Battery');
        expect(document.getElementById('scan-trust-summary')!.innerHTML).toContain('1 corrected');
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

    it('should log trust counts and correction state when applying to advisor', () => {
        const results: DetectionResults = {
            character: createDisplayDetectionResult({
                type: 'character',
                entity: mockCharacter('clank', 'CL4NK'),
                confidence: 0.95,
                rawText: 'clank',
            }, 'ocr'),
            weapon: null,
            items: [
                createDisplayDetectionResult({
                    type: 'item',
                    entity: mockItem('wrench', 'Wrench'),
                    confidence: 0.61,
                    rawText: 'wrench',
                }, 'cv', ['OCR-only fallback']),
            ],
            tomes: [
                createDisplayDetectionResult({
                    type: 'tome',
                    entity: mockTome('strength', 'Strength'),
                    confidence: 0.32,
                    rawText: 'strength',
                }, 'hybrid', ['hybrid disagreement']),
            ],
        };

        renderDetectionReview(results);
        markDetectionReviewed('item', 'wrench');

        applyToAdvisor(
            {
                selectedCharacter: mockCharacter('clank', 'CL4NK'),
                selectedWeapon: null,
                selectedItems: new Map([
                    ['wrench', { item: mockItem('wrench', 'Wrench'), count: 1 }],
                ]),
                selectedTomes: new Map([
                    ['strength', mockTome('strength', 'Strength')],
                ]),
            },
            null
        );

        expect(logger.info).toHaveBeenCalledWith(
            expect.objectContaining({
                operation: 'scan_build.applied_to_advisor',
                data: expect.objectContaining({
                    trust: {
                        safeCount: 1,
                        reviewCount: 1,
                        riskyCount: 1,
                        correctedCount: 1,
                        reviewedCount: 1,
                        manualReviewCount: 1,
                        explicitCorrectionCount: 0,
                        totalFlaggedCount: 2,
                        unresolvedRiskyCount: 1,
                        appliedWithUnresolvedRisky: true,
                    },
                }),
            })
        );
    });

    it('should route review queue buttons to the correct selectors for every entity type', () => {
        const characterTarget = document.querySelector('#scan-character-grid [data-id="clank"]') as HTMLButtonElement;
        const weaponTarget = document.querySelector('#scan-weapon-grid [data-id="hammer"]') as HTMLButtonElement;
        const itemTarget = document.querySelector('#scan-grid-items-container [data-id="wrench"]') as HTMLButtonElement;
        const tomeTarget = document.querySelector('#scan-tome-grid [data-id="strength"]') as HTMLButtonElement;

        const characterScroll = vi.spyOn(characterTarget, 'scrollIntoView');
        const weaponScroll = vi.spyOn(weaponTarget, 'scrollIntoView');
        const itemScroll = vi.spyOn(itemTarget, 'scrollIntoView');
        const tomeScroll = vi.spyOn(tomeTarget, 'scrollIntoView');

        const results: DetectionResults = {
            character: createDisplayDetectionResult({
                type: 'character',
                entity: mockCharacter('clank', 'CL4NK'),
                confidence: 0.6,
                rawText: 'clank',
            }, 'ocr'),
            weapon: createDisplayDetectionResult({
                type: 'weapon',
                entity: mockWeapon('hammer', 'Hammer'),
                confidence: 0.6,
                rawText: 'hammer',
            }, 'cv', ['CV-only fallback']),
            items: [
                createDisplayDetectionResult({
                    type: 'item',
                    entity: mockItem('wrench', 'Wrench'),
                    confidence: 0.6,
                    rawText: 'wrench',
                }, 'ocr'),
            ],
            tomes: [
                createDisplayDetectionResult({
                    type: 'tome',
                    entity: mockTome('strength', 'Strength'),
                    confidence: 0.4,
                    rawText: 'strength',
                }, 'hybrid', ['hybrid disagreement']),
            ],
        };

        renderDetectionReview(results);

        const clickReviewButton = (reviewId: string) => {
            const button = document.querySelector(`[data-review-id="${reviewId}"]`) as HTMLButtonElement;
            expect(button).not.toBeNull();
            button.click();
        };

        clickReviewButton('clank');
        expect(characterScroll).toHaveBeenCalled();
        expect(document.activeElement).toBe(characterTarget);

        clickReviewButton('hammer');
        expect(weaponScroll).toHaveBeenCalled();
        expect(document.activeElement).toBe(weaponTarget);

        clickReviewButton('wrench');
        expect(itemScroll).toHaveBeenCalled();
        expect(document.activeElement).toBe(itemTarget);

        clickReviewButton('strength');
        expect(tomeScroll).toHaveBeenCalled();
        expect(document.activeElement).toBe(tomeTarget);
    });
});
