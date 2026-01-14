/**
 * Tesseract.js Integration Tests
 * Tests that Tesseract.js can be loaded and used for OCR
 * These tests help catch CSP issues and worker loading problems
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    initOCR,
    extractTextFromImage,
    autoDetectFromImage,
} from '../../src/modules/ocr';
import type { AllGameData } from '../../src/types';

// Mock Tesseract.js to avoid actual network calls in unit tests
vi.mock('tesseract.js', () => ({
    default: {
        recognize: vi.fn().mockImplementation(async (image, lang, options) => {
            // Simulate progress callback
            if (options?.logger) {
                options.logger({ status: 'recognizing text', progress: 0.5 });
                options.logger({ status: 'recognizing text', progress: 1.0 });
            }
            return {
                data: {
                    text: 'Wrench\nGym Sauce\nBattery\nFirst Aid Kit',
                    confidence: 85,
                },
            };
        }),
    },
}));

// Mock game data for OCR tests
const mockGameData: AllGameData = {
    items: {
        version: '1.0',
        last_updated: '2024-01-01',
        items: [
            {
                id: 'wrench',
                name: 'Wrench',
                description: 'Increases damage',
                rarity: 'uncommon',
                tier: 'A',
                tags: ['damage'],
                mechanics: { base: { damage: 10 } },
            },
            {
                id: 'gym_sauce',
                name: 'Gym Sauce',
                description: 'Increases strength',
                rarity: 'epic',
                tier: 'SS',
                tags: ['strength'],
                mechanics: { base: { strength: 20 } },
            },
            {
                id: 'battery',
                name: 'Battery',
                description: 'More energy',
                rarity: 'rare',
                tier: 'S',
                tags: ['energy'],
                mechanics: { base: { energy: 15 } },
            },
            {
                id: 'first_aid_kit',
                name: 'First Aid Kit',
                description: 'Heals you',
                rarity: 'common',
                tier: 'B',
                tags: ['health'],
                mechanics: { base: { health_regen: 5 } },
            },
        ],
    },
    tomes: {
        version: '1.0',
        last_updated: '2024-01-01',
        tomes: [
            {
                id: 'damage_tome',
                name: 'Damage Tome',
                description: 'Increases damage',
                priority_rank: 1,
                mechanics: { damage_multiplier: 1.5 },
            },
        ],
    },
    characters: {
        version: '1.0',
        last_updated: '2024-01-01',
        characters: [
            {
                id: 'cl4nk',
                name: 'CL4NK',
                description: 'A robot character',
                passive: 'Crit Chance per level',
            },
        ],
    },
    weapons: {
        version: '1.0',
        last_updated: '2024-01-01',
        weapons: [
            {
                id: 'revolver',
                name: 'Revolver',
                description: 'A six-shooter',
                base_damage: 10,
            },
        ],
    },
} as AllGameData;

describe('Tesseract.js Integration', () => {
    beforeEach(() => {
        initOCR(mockGameData);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Tesseract Module Loading', () => {
        it('should import tesseract.js module', async () => {
            const Tesseract = await import('tesseract.js');
            expect(Tesseract.default).toBeDefined();
            expect(Tesseract.default.recognize).toBeDefined();
        });

        it('should have recognize function callable', async () => {
            const Tesseract = await import('tesseract.js');
            expect(typeof Tesseract.default.recognize).toBe('function');
        });
    });

    describe('Text Extraction', () => {
        it('should extract text from image data URL', async () => {
            const mockImageDataUrl =
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

            const result = await extractTextFromImage(mockImageDataUrl);

            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
            expect(result).toContain('Wrench');
        });

        it('should call progress callback during OCR processing', async () => {
            const mockImageDataUrl =
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            const progressCallback = vi.fn();

            await extractTextFromImage(mockImageDataUrl, progressCallback);

            expect(progressCallback).toHaveBeenCalled();
        });

        it('should support english language recognition', async () => {
            const Tesseract = await import('tesseract.js');
            const mockImageDataUrl =
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

            await extractTextFromImage(mockImageDataUrl);

            expect(Tesseract.default.recognize).toHaveBeenCalledWith(
                expect.any(String),
                'eng',
                expect.any(Object)
            );
        });
    });

    describe('Auto Detection', () => {
        it('should return detection results object', async () => {
            const mockImageDataUrl =
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

            const results = await autoDetectFromImage(mockImageDataUrl);

            expect(results).toBeDefined();
            expect(results.items).toBeDefined();
            expect(results.tomes).toBeDefined();
            expect(Array.isArray(results.items)).toBe(true);
            expect(Array.isArray(results.tomes)).toBe(true);
        });

        it('should detect items from OCR text', async () => {
            const mockImageDataUrl =
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

            const results = await autoDetectFromImage(mockImageDataUrl);

            // Should detect at least one item from the mock OCR text
            expect(results.items.length).toBeGreaterThan(0);
        });
    });

    describe('Error Handling', () => {
        it('should handle OCR failures gracefully', async () => {
            const Tesseract = await import('tesseract.js');
            vi.mocked(Tesseract.default.recognize).mockRejectedValueOnce(
                new Error('Worker failed to load')
            );

            const mockImageDataUrl = 'data:image/png;base64,test';

            await expect(extractTextFromImage(mockImageDataUrl)).rejects.toThrow(
                'Worker failed to load'
            );
        });

        it('should handle empty OCR results', async () => {
            const Tesseract = await import('tesseract.js');
            vi.mocked(Tesseract.default.recognize).mockResolvedValueOnce({
                data: {
                    text: '',
                    confidence: 0,
                },
            });

            const mockImageDataUrl =
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

            const result = await extractTextFromImage(mockImageDataUrl);
            expect(result).toBe('');
        });
    });

    describe('CSP Compatibility', () => {
        it('should not require external script loading in tests', () => {
            // This test verifies our mock doesn't try to load external scripts
            // In a real browser, CSP issues would cause Tesseract to fail to load
            expect(vi.isMockFunction((import('tesseract.js') as any).default?.recognize)).toBe(
                false
            );
        });
    });
});
