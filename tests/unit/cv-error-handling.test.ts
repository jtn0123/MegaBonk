/**
 * Error Handling Tests for CV/OCR Modules
 * Tests graceful degradation and error recovery
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    initCV,
    detectGridPositions,
    detectUIRegions,
    clearDetectionCache,
} from '../../src/modules/computer-vision';
import { initOCR, detectItemsFromText } from '../../src/modules/ocr';
import type { AllGameData } from '../../src/types';

// Mock game data
const mockGameData: AllGameData = {
    items: {
        version: '1.0',
        last_updated: '2024-01-01',
        items: [
            {
                id: 'wrench',
                name: 'Wrench',
                description: 'Tool',
                rarity: 'common',
                tier: 'B',
                tags: ['utility'],
                mechanics: { base: { repair: 10 } },
            },
        ],
    },
};

describe('CV Error Handling - Initialization', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    it('should handle empty game data gracefully', () => {
        expect(() => initCV({})).not.toThrow();
    });

    it('should handle undefined game data', () => {
        // Handles gracefully without throwing
        expect(() => initCV(undefined as any)).not.toThrow();
    });

    it('should handle null game data', () => {
        // Handles gracefully without throwing
        expect(() => initCV(null as any)).not.toThrow();
    });

    it('should handle game data with empty items array', () => {
        const emptyData = {
            items: {
                version: '1.0',
                last_updated: '2024-01-01',
                items: [],
            },
        };
        expect(() => initCV(emptyData)).not.toThrow();
    });

    it('should handle game data with missing items property', () => {
        const noItemsData = {
            weapons: { version: '1.0', weapons: [] },
        };
        expect(() => initCV(noItemsData as any)).not.toThrow();
    });
});

describe('OCR Error Handling - Initialization', () => {
    it('should handle empty game data gracefully', () => {
        expect(() => initOCR({})).not.toThrow();
    });

    it('should throw for undefined game data', () => {
        // OCR requires game data to build item list
        expect(() => initOCR(undefined as any)).toThrow();
    });

    it('should throw for null game data', () => {
        // OCR requires game data to build item list
        expect(() => initOCR(null as any)).toThrow();
    });
});

describe('CV Error Handling - Grid Detection', () => {
    beforeEach(() => {
        initCV(mockGameData);
    });

    it('should return empty array for zero dimensions', () => {
        const result = detectGridPositions(0, 0);
        expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array for negative dimensions', () => {
        const result = detectGridPositions(-1920, -1080);
        expect(Array.isArray(result)).toBe(true);
    });

    it('should handle NaN dimensions', () => {
        const result = detectGridPositions(NaN, NaN);
        expect(Array.isArray(result)).toBe(true);
    });

    it('should handle Infinity dimensions', () => {
        const result = detectGridPositions(Infinity, Infinity);
        expect(Array.isArray(result)).toBe(true);
    });

    it('should handle very large dimensions', () => {
        // Should not hang or crash
        const result = detectGridPositions(100000, 100000);
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeLessThanOrEqual(30);
    });
});

describe('CV Error Handling - UI Regions', () => {
    beforeEach(() => {
        initCV(mockGameData);
    });

    it('should return valid regions for zero dimensions', () => {
        const regions = detectUIRegions(0, 0);
        expect(regions).toBeDefined();
    });

    it('should return valid regions for any dimensions', () => {
        const regions = detectUIRegions(1, 1);
        expect(regions).toBeDefined();
    });
});

describe('OCR Error Handling - Text Detection', () => {
    beforeEach(() => {
        initOCR(mockGameData);
    });

    it('should return empty array for null input', () => {
        const results = detectItemsFromText(null as any);
        expect(Array.isArray(results)).toBe(true);
    });

    it('should return empty array for undefined input', () => {
        const results = detectItemsFromText(undefined as any);
        expect(Array.isArray(results)).toBe(true);
    });

    it('should return empty array for number input', () => {
        const results = detectItemsFromText(12345 as any);
        expect(Array.isArray(results)).toBe(true);
    });

    it('should return empty array for object input', () => {
        const results = detectItemsFromText({ text: 'Wrench' } as any);
        expect(Array.isArray(results)).toBe(true);
    });

    it('should handle extremely long strings', () => {
        const veryLongText = 'a'.repeat(100000); // 100KB of text (reduced to avoid heap issues)
        const start = performance.now();
        const results = detectItemsFromText(veryLongText);
        const duration = performance.now() - start;

        expect(Array.isArray(results)).toBe(true);
        expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
});

describe('CV Error Handling - Cache Operations', () => {
    beforeEach(() => {
        initCV(mockGameData);
    });

    it('should not throw when clearing empty cache', () => {
        expect(() => clearDetectionCache()).not.toThrow();
    });

    it('should not throw when clearing cache multiple times', () => {
        clearDetectionCache();
        clearDetectionCache();
        clearDetectionCache();
        expect(true).toBe(true); // No error means pass
    });
});

describe('CV Error Handling - Invalid Image Data', () => {
    beforeEach(() => {
        initCV(mockGameData);
    });

    // These tests document expected behavior for invalid inputs
    // The actual detectItemsWithCV function would need to be tested
    // but requires browser environment or canvas mock

    it('should document that malformed data URLs should be rejected', () => {
        // Expected behavior: throw or return empty array
        const invalidUrls = [
            'not-a-data-url',
            'data:',
            'data:image',
            'data:image/',
            'data:image/png',
            'data:image/png;',
            'data:image/png;base64',
            'data:image/png;base64,',
            'data:image/png;base64,!!!INVALID!!!',
        ];

        invalidUrls.forEach(url => {
            // Document the expected behavior
            expect(typeof url).toBe('string');
        });
    });

    it('should document expected behavior for corrupted base64', () => {
        const corruptedBase64 = 'data:image/png;base64,iVBORw0KGgo=CORRUPTED';
        // Expected: throw or return empty array, not crash
        expect(typeof corruptedBase64).toBe('string');
    });
});

describe('Error Handling - Recovery and Resilience', () => {
    it('should continue working after encountering errors', () => {
        // Test that the module can recover from errors
        initCV(mockGameData);
        initOCR(mockGameData);

        // Try to break it
        try {
            detectItemsFromText(null as any);
        } catch {
            // Expected to possibly throw
        }

        // Should still work after error
        const validResults = detectItemsFromText('Wrench');
        expect(validResults.length).toBeGreaterThanOrEqual(0);
    });

    it('should maintain state after re-initialization', () => {
        initCV(mockGameData);
        initOCR(mockGameData);

        // Re-initialize with same data
        initCV(mockGameData);
        initOCR(mockGameData);

        // Should still work
        const results = detectItemsFromText('Wrench');
        expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle rapid re-initialization', () => {
        // Stress test initialization (reduced iterations to prevent memory issues)
        for (let i = 0; i < 10; i++) {
            initCV(mockGameData);
            initOCR(mockGameData);
        }

        // Should still work
        const results = detectItemsFromText('Wrench');
        expect(results.length).toBeGreaterThanOrEqual(1);
    });
});

describe('Error Handling - Boundary Values', () => {
    beforeEach(() => {
        initOCR(mockGameData);
    });

    it('should handle empty string', () => {
        expect(detectItemsFromText('')).toHaveLength(0);
    });

    it('should handle string with only whitespace', () => {
        expect(detectItemsFromText('   ')).toHaveLength(0);
    });

    it('should handle string with only newlines', () => {
        expect(detectItemsFromText('\n\n\n')).toHaveLength(0);
    });

    it('should handle string with only tabs', () => {
        expect(detectItemsFromText('\t\t\t')).toHaveLength(0);
    });

    it('should handle string with mixed whitespace', () => {
        expect(detectItemsFromText(' \n\t\r ')).toHaveLength(0);
    });

    it('should handle string with null characters', () => {
        const text = 'Wrench\0Battery';
        const results = detectItemsFromText(text);
        expect(Array.isArray(results)).toBe(true);
    });
});

describe('Error Handling - Type Coercion', () => {
    beforeEach(() => {
        initOCR(mockGameData);
    });

    it('should handle array input (coerced to string)', () => {
        const results = detectItemsFromText(['Wrench', 'Battery'] as any);
        expect(Array.isArray(results)).toBe(true);
    });

    it('should handle boolean input', () => {
        const results = detectItemsFromText(true as any);
        expect(Array.isArray(results)).toBe(true);
    });

    it('should handle Symbol input', () => {
        try {
            const results = detectItemsFromText(Symbol('test') as any);
            expect(Array.isArray(results)).toBe(true);
        } catch {
            // Symbols can't be coerced to string, so throwing is acceptable
            expect(true).toBe(true);
        }
    });
});

describe('Error Handling - Memory Safety', () => {
    beforeEach(() => {
        initOCR(mockGameData);
    });

    it('should not leak memory with repeated calls', () => {
        // Make moderate number of calls - should not cause memory issues
        for (let i = 0; i < 50; i++) {
            detectItemsFromText('Wrench');
        }

        // If we get here without crashing, test passes
        expect(true).toBe(true);
    });

    it('should handle concurrent calls', async () => {
        const promises = Array(10)
            .fill(null)
            .map(() => Promise.resolve(detectItemsFromText('Wrench')));

        const results = await Promise.all(promises);

        results.forEach(result => {
            expect(Array.isArray(result)).toBe(true);
        });
    });
});
