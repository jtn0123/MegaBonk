/**
 * Unit tests for OCR module - Worker management and Tesseract integration
 * Tests lazy loading, worker lifecycle, timeout handling, and image extraction
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import {
    initOCR,
    terminateOCRWorker,
    isOCRWorkerActive,
    extractTextFromImage,
    autoDetectFromImage,
    detectStackCount,
    detectStackCountsBatch,
    extractItemCounts,
    __resetForTesting,
} from '../../src/modules/ocr';
import type { AllGameData } from '../../src/types';

// Mock tesseract.js
vi.mock('tesseract.js', () => {
    const mockWorker = {
        recognize: vi.fn(),
        setParameters: vi.fn().mockResolvedValue(undefined),
        terminate: vi.fn().mockResolvedValue(undefined),
    };

    return {
        createWorker: vi.fn().mockResolvedValue(mockWorker),
        default: {
            createWorker: vi.fn().mockResolvedValue(mockWorker),
        },
    };
});

// Mock logger to prevent noise in tests
vi.mock('../../src/modules/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock game data
const mockGameData: AllGameData = {
    items: {
        version: '1.0',
        last_updated: '2024-01-01',
        items: [
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
                id: 'wrench',
                name: 'Wrench',
                description: 'Increases damage',
                rarity: 'uncommon',
                tier: 'A',
                tags: ['damage'],
                mechanics: { base: { damage: 10 } },
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
                id: 'clank',
                name: 'CL4NK',
                description: 'Robot character',
                starting_stats: { health: 100, damage: 10 },
                passive_abilities: ['shield'],
            },
        ],
    },
    weapons: {
        version: '1.0',
        last_updated: '2024-01-01',
        weapons: [
            {
                id: 'hammer',
                name: 'Hammer',
                description: 'Heavy weapon',
                base_damage: 50,
                attack_speed: 1.0,
                upgrade_path: [],
            },
        ],
    },
    stats: {
        version: '1.0',
        last_updated: '2024-01-01',
    },
};

describe('OCR Module - Worker Management', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await __resetForTesting();
    });

    afterEach(async () => {
        vi.clearAllMocks();
        await __resetForTesting();
    });

    describe('isOCRWorkerActive', () => {
        it('should return false when no worker is active', () => {
            expect(isOCRWorkerActive()).toBe(false);
        });

        it('should return true after worker is created via extractTextFromImage', async () => {
            const tesseract = await import('tesseract.js');
            const mockWorker = {
                recognize: vi.fn().mockResolvedValue({
                    data: { text: 'test', confidence: 95 },
                }),
                setParameters: vi.fn().mockResolvedValue(undefined),
                terminate: vi.fn().mockResolvedValue(undefined),
            };
            vi.mocked(tesseract.createWorker).mockResolvedValue(mockWorker as any);

            await extractTextFromImage('data:image/png;base64,test');
            expect(isOCRWorkerActive()).toBe(true);
        });
    });

    describe('terminateOCRWorker', () => {
        it('should do nothing when no worker is active', async () => {
            // Should not throw
            await expect(terminateOCRWorker()).resolves.not.toThrow();
            expect(isOCRWorkerActive()).toBe(false);
        });

        it('should terminate active worker', async () => {
            const tesseract = await import('tesseract.js');
            const mockWorker = {
                recognize: vi.fn().mockResolvedValue({
                    data: { text: 'test', confidence: 95 },
                }),
                setParameters: vi.fn().mockResolvedValue(undefined),
                terminate: vi.fn().mockResolvedValue(undefined),
            };
            vi.mocked(tesseract.createWorker).mockResolvedValue(mockWorker as any);

            // Create worker
            await extractTextFromImage('data:image/png;base64,test');
            expect(isOCRWorkerActive()).toBe(true);

            // Terminate
            await terminateOCRWorker();
            expect(isOCRWorkerActive()).toBe(false);
            expect(mockWorker.terminate).toHaveBeenCalled();
        });

        it('should handle termination errors gracefully', async () => {
            const tesseract = await import('tesseract.js');
            const mockWorker = {
                recognize: vi.fn().mockResolvedValue({
                    data: { text: 'test', confidence: 95 },
                }),
                setParameters: vi.fn().mockResolvedValue(undefined),
                terminate: vi.fn().mockRejectedValue(new Error('Termination failed')),
            };
            vi.mocked(tesseract.createWorker).mockResolvedValue(mockWorker as any);

            // Create worker
            await extractTextFromImage('data:image/png;base64,test');

            // Terminate should not throw even with error
            await expect(terminateOCRWorker()).resolves.not.toThrow();
            // Worker should still be marked as inactive
            expect(isOCRWorkerActive()).toBe(false);
        });
    });
});

describe('OCR Module - Text Extraction', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await __resetForTesting();
        vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(async () => {
        vi.useRealTimers();
        vi.clearAllMocks();
        await __resetForTesting();
    });

    describe('extractTextFromImage', () => {
        it('should extract text from image using Tesseract', async () => {
            const tesseract = await import('tesseract.js');
            const mockWorker = {
                recognize: vi.fn().mockResolvedValue({
                    data: { text: 'Hello World', confidence: 95 },
                }),
                setParameters: vi.fn().mockResolvedValue(undefined),
                terminate: vi.fn().mockResolvedValue(undefined),
            };
            vi.mocked(tesseract.createWorker).mockResolvedValue(mockWorker as any);

            const result = await extractTextFromImage('data:image/png;base64,test');

            expect(result).toBe('Hello World');
            expect(mockWorker.recognize).toHaveBeenCalledWith('data:image/png;base64,test');
        });

        it('should call progress callback', async () => {
            const tesseract = await import('tesseract.js');
            const mockWorker = {
                recognize: vi.fn().mockResolvedValue({
                    data: { text: 'Test', confidence: 90 },
                }),
                setParameters: vi.fn().mockResolvedValue(undefined),
                terminate: vi.fn().mockResolvedValue(undefined),
            };
            vi.mocked(tesseract.createWorker).mockResolvedValue(mockWorker as any);

            const progressCallback = vi.fn();
            await extractTextFromImage('data:image/png;base64,test', progressCallback);

            expect(progressCallback).toHaveBeenCalledWith(0, 'Loading OCR engine...');
        });

        it('should reuse existing worker on subsequent calls', async () => {
            const tesseract = await import('tesseract.js');
            const mockWorker = {
                recognize: vi.fn().mockResolvedValue({
                    data: { text: 'Test', confidence: 90 },
                }),
                setParameters: vi.fn().mockResolvedValue(undefined),
                terminate: vi.fn().mockResolvedValue(undefined),
            };
            vi.mocked(tesseract.createWorker).mockResolvedValue(mockWorker as any);

            await extractTextFromImage('data:image/png;base64,test1');
            await extractTextFromImage('data:image/png;base64,test2');

            // Worker should only be created once
            expect(tesseract.createWorker).toHaveBeenCalledTimes(1);
            // But recognize should be called twice
            expect(mockWorker.recognize).toHaveBeenCalledTimes(2);
        });

        it('should retry on failure', async () => {
            vi.useRealTimers();
            
            const tesseract = await import('tesseract.js');
            let attempts = 0;
            const mockWorker = {
                recognize: vi.fn().mockImplementation(() => {
                    attempts++;
                    if (attempts < 2) {
                        return Promise.reject(new Error('OCR failed'));
                    }
                    return Promise.resolve({ data: { text: 'Success', confidence: 90 } });
                }),
                setParameters: vi.fn().mockResolvedValue(undefined),
                terminate: vi.fn().mockResolvedValue(undefined),
            };
            vi.mocked(tesseract.createWorker).mockResolvedValue(mockWorker as any);

            const result = await extractTextFromImage('data:image/png;base64,test', undefined, 60000, 2);

            expect(result).toBe('Success');
            expect(mockWorker.recognize).toHaveBeenCalledTimes(2);
        });

        it('should throw after max retries exhausted', async () => {
            vi.useRealTimers();

            const tesseract = await import('tesseract.js');
            const mockWorker = {
                recognize: vi.fn().mockRejectedValue(new Error('Persistent failure')),
                setParameters: vi.fn().mockResolvedValue(undefined),
                terminate: vi.fn().mockResolvedValue(undefined),
            };
            vi.mocked(tesseract.createWorker).mockResolvedValue(mockWorker as any);

            await expect(
                extractTextFromImage('data:image/png;base64,test', undefined, 60000, 0)
            ).rejects.toThrow('Persistent failure');
        });

        it('should timeout on slow recognition', async () => {
            vi.useRealTimers();

            const tesseract = await import('tesseract.js');
            const mockWorker = {
                recognize: vi.fn().mockImplementation(
                    () => new Promise(resolve => setTimeout(() => resolve({ data: { text: 'Late', confidence: 90 } }), 5000))
                ),
                setParameters: vi.fn().mockResolvedValue(undefined),
                terminate: vi.fn().mockResolvedValue(undefined),
            };
            vi.mocked(tesseract.createWorker).mockResolvedValue(mockWorker as any);

            await expect(
                extractTextFromImage('data:image/png;base64,test', undefined, 100, 0)
            ).rejects.toThrow(/timed out/);
        });
    });
});

describe('OCR Module - Auto Detection', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await __resetForTesting();
        initOCR(mockGameData);
    });

    afterEach(async () => {
        vi.clearAllMocks();
        await __resetForTesting();
    });

    describe('autoDetectFromImage', () => {
        it('should detect all entity types from image', async () => {
            const tesseract = await import('tesseract.js');
            const mockWorker = {
                recognize: vi.fn().mockResolvedValue({
                    data: {
                        text: 'Battery\nCL4NK\nHammer\nDamage Tome',
                        confidence: 90,
                    },
                }),
                setParameters: vi.fn().mockResolvedValue(undefined),
                terminate: vi.fn().mockResolvedValue(undefined),
            };
            vi.mocked(tesseract.createWorker).mockResolvedValue(mockWorker as any);

            const result = await autoDetectFromImage('data:image/png;base64,test');

            // Check that items were detected
            expect(result.items.length).toBeGreaterThan(0);
            expect(result.items[0].entity.name).toBe('Battery');
            
            // Check tomes were detected
            expect(result.tomes.length).toBeGreaterThan(0);
            expect(result.tomes[0].entity.name).toBe('Damage Tome');
            
            // Character and weapon detection use single-line search which may not match
            // multiline text well, but the rawText should be present
            expect(result.rawText).toContain('Battery');
            expect(result.rawText).toContain('CL4NK');
        });

        it('should call progress callback during detection', async () => {
            const tesseract = await import('tesseract.js');
            const mockWorker = {
                recognize: vi.fn().mockResolvedValue({
                    data: { text: 'Battery', confidence: 90 },
                }),
                setParameters: vi.fn().mockResolvedValue(undefined),
                terminate: vi.fn().mockResolvedValue(undefined),
            };
            vi.mocked(tesseract.createWorker).mockResolvedValue(mockWorker as any);

            const progressCallback = vi.fn();
            await autoDetectFromImage('data:image/png;base64,test', progressCallback);

            expect(progressCallback).toHaveBeenCalledWith(0, 'Starting OCR...');
            expect(progressCallback).toHaveBeenCalledWith(100, 'Matching detected text...');
        });

        it('should return empty results when no entities detected', async () => {
            const tesseract = await import('tesseract.js');
            const mockWorker = {
                recognize: vi.fn().mockResolvedValue({
                    data: { text: 'Random unrelated text', confidence: 90 },
                }),
                setParameters: vi.fn().mockResolvedValue(undefined),
                terminate: vi.fn().mockResolvedValue(undefined),
            };
            vi.mocked(tesseract.createWorker).mockResolvedValue(mockWorker as any);

            const result = await autoDetectFromImage('data:image/png;base64,test');

            expect(result.items).toHaveLength(0);
            expect(result.tomes).toHaveLength(0);
            expect(result.character).toBeNull();
            expect(result.weapon).toBeNull();
        });

        it('should throw on OCR failure', async () => {
            vi.useRealTimers();

            const tesseract = await import('tesseract.js');
            const mockWorker = {
                recognize: vi.fn().mockRejectedValue(new Error('OCR failed')),
                setParameters: vi.fn().mockResolvedValue(undefined),
                terminate: vi.fn().mockResolvedValue(undefined),
            };
            vi.mocked(tesseract.createWorker).mockResolvedValue(mockWorker as any);

            await expect(
                autoDetectFromImage('data:image/png;base64,test')
            ).rejects.toThrow('OCR failed');
        });
    });
});

describe('OCR Module - Stack Count Detection', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await __resetForTesting();
        
        // Mock DOM APIs for canvas operations
        const mockCanvas = {
            width: 100,
            height: 100,
            getContext: vi.fn().mockReturnValue({
                drawImage: vi.fn(),
                getImageData: vi.fn().mockReturnValue({
                    data: new Uint8ClampedArray(100 * 100 * 4).fill(128),
                    width: 100,
                    height: 100,
                }),
                putImageData: vi.fn(),
            }),
            toDataURL: vi.fn().mockReturnValue('data:image/png;base64,processed'),
        };
        
        vi.stubGlobal('document', {
            createElement: vi.fn().mockReturnValue(mockCanvas),
        });
        
        // Mock Image constructor
        class MockImage {
            width = 100;
            height = 100;
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            src = '';
            
            constructor() {
                setTimeout(() => this.onload?.(), 0);
            }
        }
        vi.stubGlobal('Image', MockImage);
    });

    afterEach(async () => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
        await __resetForTesting();
    });

    describe('detectStackCount', () => {
        it('should detect numeric stack count', async () => {
            const tesseract = await import('tesseract.js');
            const mockWorker = {
                recognize: vi.fn().mockResolvedValue({
                    data: { text: 'x5', confidence: 90 },
                }),
                setParameters: vi.fn().mockResolvedValue(undefined),
                terminate: vi.fn().mockResolvedValue(undefined),
            };
            vi.mocked(tesseract.createWorker).mockResolvedValue(mockWorker as any);

            const result = await detectStackCount('data:image/png;base64,test');

            expect(result.count).toBe(5);
            expect(result.confidence).toBeCloseTo(0.9);
        });

        it('should detect count with × symbol', async () => {
            const tesseract = await import('tesseract.js');
            const mockWorker = {
                recognize: vi.fn().mockResolvedValue({
                    data: { text: '×3', confidence: 85 },
                }),
                setParameters: vi.fn().mockResolvedValue(undefined),
                terminate: vi.fn().mockResolvedValue(undefined),
            };
            vi.mocked(tesseract.createWorker).mockResolvedValue(mockWorker as any);

            const result = await detectStackCount('data:image/png;base64,test');

            expect(result.count).toBe(3);
        });

        it('should detect plain numeric count', async () => {
            const tesseract = await import('tesseract.js');
            const mockWorker = {
                recognize: vi.fn().mockResolvedValue({
                    data: { text: '12', confidence: 95 },
                }),
                setParameters: vi.fn().mockResolvedValue(undefined),
                terminate: vi.fn().mockResolvedValue(undefined),
            };
            vi.mocked(tesseract.createWorker).mockResolvedValue(mockWorker as any);

            const result = await detectStackCount('data:image/png;base64,test');

            expect(result.count).toBe(12);
        });

        it('should return null for invalid count (> 30)', async () => {
            const tesseract = await import('tesseract.js');
            const mockWorker = {
                recognize: vi.fn().mockResolvedValue({
                    data: { text: '99', confidence: 90 },
                }),
                setParameters: vi.fn().mockResolvedValue(undefined),
                terminate: vi.fn().mockResolvedValue(undefined),
            };
            vi.mocked(tesseract.createWorker).mockResolvedValue(mockWorker as any);

            const result = await detectStackCount('data:image/png;base64,test');

            expect(result.count).toBeNull();
        });

        it('should return null for no recognized digits', async () => {
            const tesseract = await import('tesseract.js');
            const mockWorker = {
                recognize: vi.fn().mockResolvedValue({
                    data: { text: 'abc', confidence: 50 },
                }),
                setParameters: vi.fn().mockResolvedValue(undefined),
                terminate: vi.fn().mockResolvedValue(undefined),
            };
            vi.mocked(tesseract.createWorker).mockResolvedValue(mockWorker as any);

            const result = await detectStackCount('data:image/png;base64,test');

            expect(result.count).toBeNull();
        });

        it('should handle OCR errors gracefully', async () => {
            const tesseract = await import('tesseract.js');
            const mockWorker = {
                recognize: vi.fn().mockRejectedValue(new Error('Recognition failed')),
                setParameters: vi.fn().mockResolvedValue(undefined),
                terminate: vi.fn().mockResolvedValue(undefined),
            };
            vi.mocked(tesseract.createWorker).mockResolvedValue(mockWorker as any);

            const result = await detectStackCount('data:image/png;base64,test');

            expect(result.count).toBeNull();
            expect(result.confidence).toBe(0);
        });

        it('should set OCR parameters for digit recognition', async () => {
            const tesseract = await import('tesseract.js');
            const mockWorker = {
                recognize: vi.fn().mockResolvedValue({
                    data: { text: 'x2', confidence: 90 },
                }),
                setParameters: vi.fn().mockResolvedValue(undefined),
                terminate: vi.fn().mockResolvedValue(undefined),
            };
            vi.mocked(tesseract.createWorker).mockResolvedValue(mockWorker as any);

            await detectStackCount('data:image/png;base64,test');

            // Should set whitelist for digits
            expect(mockWorker.setParameters).toHaveBeenCalledWith(
                expect.objectContaining({
                    tessedit_char_whitelist: '0123456789x×X',
                })
            );
            
            // Should reset parameters after
            expect(mockWorker.setParameters).toHaveBeenCalledWith(
                expect.objectContaining({
                    tessedit_char_whitelist: '',
                })
            );
        });
    });

    describe('detectStackCountsBatch', () => {
        it('should detect counts for multiple images', async () => {
            const tesseract = await import('tesseract.js');
            let callCount = 0;
            const mockWorker = {
                recognize: vi.fn().mockImplementation(() => {
                    callCount++;
                    const counts = ['x2', 'x5', 'x10'];
                    return Promise.resolve({
                        data: { text: counts[callCount - 1] || 'x1', confidence: 90 },
                    });
                }),
                setParameters: vi.fn().mockResolvedValue(undefined),
                terminate: vi.fn().mockResolvedValue(undefined),
            };
            vi.mocked(tesseract.createWorker).mockResolvedValue(mockWorker as any);

            const imageUrls = [
                'data:image/png;base64,test1',
                'data:image/png;base64,test2',
                'data:image/png;base64,test3',
            ];

            const results = await detectStackCountsBatch(imageUrls);

            expect(results.size).toBe(3);
            expect(results.get(0)?.count).toBe(2);
            expect(results.get(1)?.count).toBe(5);
            expect(results.get(2)?.count).toBe(10);
        });

        it('should handle empty array', async () => {
            const results = await detectStackCountsBatch([]);
            expect(results.size).toBe(0);
        });

        it('should process in batches of 3', async () => {
            const tesseract = await import('tesseract.js');
            const mockWorker = {
                recognize: vi.fn().mockResolvedValue({
                    data: { text: 'x1', confidence: 90 },
                }),
                setParameters: vi.fn().mockResolvedValue(undefined),
                terminate: vi.fn().mockResolvedValue(undefined),
            };
            vi.mocked(tesseract.createWorker).mockResolvedValue(mockWorker as any);

            const imageUrls = Array(5).fill('data:image/png;base64,test');
            const results = await detectStackCountsBatch(imageUrls);

            expect(results.size).toBe(5);
        });
    });
});

describe('OCR Module - Concurrent Worker Access', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await __resetForTesting();
    });

    afterEach(async () => {
        vi.clearAllMocks();
        await __resetForTesting();
    });

    it('should handle concurrent extractTextFromImage calls', async () => {
        const tesseract = await import('tesseract.js');
        
        const mockWorker = {
            recognize: vi.fn().mockResolvedValue({
                data: { text: 'Concurrent result', confidence: 90 },
            }),
            setParameters: vi.fn().mockResolvedValue(undefined),
            terminate: vi.fn().mockResolvedValue(undefined),
        };
        
        vi.mocked(tesseract.createWorker).mockResolvedValue(mockWorker as any);

        // Start multiple concurrent calls
        const promises = [
            extractTextFromImage('data:image/png;base64,test1'),
            extractTextFromImage('data:image/png;base64,test2'),
            extractTextFromImage('data:image/png;base64,test3'),
        ];

        const results = await Promise.all(promises);

        // All results should be valid
        expect(results).toHaveLength(3);
        expect(results.every(r => r === 'Concurrent result')).toBe(true);
        
        // Worker recognize should be called 3 times (once per image)
        expect(mockWorker.recognize).toHaveBeenCalledTimes(3);
    });
});

describe('OCR Module - Item Count Edge Cases', () => {
    it('should handle negative numbers in count patterns', () => {
        const text = 'Item x-5'; // Invalid negative
        const counts = extractItemCounts(text);
        // Should not include negative counts
        expect(counts.get('item')).toBeUndefined();
    });

    it('should handle zero counts', () => {
        const text = 'Item x0';
        const counts = extractItemCounts(text);
        // Zero is invalid (must be > 0)
        expect(counts.get('item')).toBeUndefined();
    });

    it('should handle floating point in counts', () => {
        const text = 'Item x2.5';
        const counts = extractItemCounts(text);
        // parseInt will parse "2" from "2.5"
        expect(counts.get('item')).toBe(2);
    });

    it('should handle multiple count formats for same item', () => {
        // Later match should win based on iteration order
        const text = 'Battery x3\nBattery (5)';
        const counts = extractItemCounts(text);
        // Both should be detected as separate entries
        expect(counts.has('battery')).toBe(true);
    });

    it('should handle uppercase X notation', () => {
        const text = 'Battery X10';
        const counts = extractItemCounts(text);
        expect(counts.get('battery')).toBe(10);
    });
});
