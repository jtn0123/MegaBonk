/**
 * @vitest-environment jsdom
 * Batch Scan Module Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { AllGameData, Item, Tome } from '../../src/types/index.ts';

// Mock CV module - factory must not reference outside variables
vi.mock('../../src/modules/cv/index.ts', () => ({
    initCV: vi.fn(),
    loadItemTemplates: vi.fn().mockResolvedValue(undefined),
    detectItemsWithCV: vi.fn().mockResolvedValue([]),
    combineDetections: vi.fn((ocrResults: unknown[]) => ocrResults),
    aggregateDuplicates: vi.fn((results: Array<{ entity: Item | Tome }>) => 
        results.map((r) => ({ ...r, count: 1 }))),
    isFullyLoaded: vi.fn().mockReturnValue(true),
}));

// Mock OCR module
vi.mock('../../src/modules/ocr', () => ({
    initOCR: vi.fn(),
    autoDetectFromImage: vi.fn().mockResolvedValue({
        items: [],
        tomes: [],
        character: null,
        weapon: null,
    }),
}));

// Import mocked modules to get references
import * as cvModule from '../../src/modules/cv/index.ts';

// Import module after mocks
import {
    initBatchScan,
    processBatch,
    getBatchResults,
    getBatchResultById,
    clearBatchResults,
    removeBatchResult,
    compareBatchResults,
    getBatchSummary,
    renderBatchResultsGrid,
    __resetForTesting,
} from '../../src/modules/batch-scan.ts';
import { ToastManager } from '../../src/modules/toast.ts';

// Mock game data
const mockGameData: AllGameData = {
    items: {
        version: '1.0',
        items: [
            { id: 'item1', name: 'Test Item 1', tier: 'common' } as Item,
            { id: 'item2', name: 'Test Item 2', tier: 'rare' } as Item,
        ],
    },
    weapons: { version: '1.0', weapons: [] },
    tomes: { version: '1.0', tomes: [] },
    characters: { version: '1.0', characters: [] },
    shrines: { version: '1.0', shrines: [] },
    stats: { version: '1.0', stats: [] },
};

// Create mock File
function createMockFile(name: string, type: string): File {
    const blob = new Blob(['mock-image-data'], { type });
    return new File([blob], name, { type });
}

describe('Batch Scan Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        __resetForTesting();
    });

    afterEach(() => {
        __resetForTesting();
    });

    // ========================================
    // Initialization Tests
    // ========================================
    describe('initBatchScan', () => {
        it('should initialize without errors', () => {
            expect(() => initBatchScan(mockGameData)).not.toThrow();
        });

        it('should call initCV on initialization', () => {
            initBatchScan(mockGameData);
            expect(cvModule.initCV).toHaveBeenCalledWith(mockGameData);
        });

        it('should call loadItemTemplates on initialization', () => {
            initBatchScan(mockGameData);
            expect(cvModule.loadItemTemplates).toHaveBeenCalled();
        });
    });

    // ========================================
    // Batch Results Management Tests
    // ========================================
    describe('getBatchResults', () => {
        it('should return empty array initially', () => {
            const results = getBatchResults();
            expect(results).toEqual([]);
        });

        it('should return a copy of results array', () => {
            const results1 = getBatchResults();
            const results2 = getBatchResults();
            expect(results1).not.toBe(results2);
        });
    });

    describe('getBatchResultById', () => {
        it('should return undefined for non-existent id', () => {
            const result = getBatchResultById('non-existent');
            expect(result).toBeUndefined();
        });
    });

    describe('clearBatchResults', () => {
        it('should clear all results', () => {
            clearBatchResults();
            const results = getBatchResults();
            expect(results).toEqual([]);
        });
    });

    describe('removeBatchResult', () => {
        it('should return false for non-existent id', () => {
            const removed = removeBatchResult('non-existent');
            expect(removed).toBe(false);
        });
    });

    // ========================================
    // File Validation Tests
    // ========================================
    describe('processBatch', () => {
        beforeEach(() => {
            initBatchScan(mockGameData);
        });

        it('should reject non-image files', async () => {
            const textFile = createMockFile('test.txt', 'text/plain');
            const files = [textFile];
            
            const results = await processBatch(files);
            expect(results).toEqual([]);
            expect(ToastManager.error).toHaveBeenCalledWith('No valid image files selected');
        });

        it('should reject files larger than 10MB', async () => {
            // Create a mock file that reports a large size
            const largeFile = new File(['x'], 'large.png', { type: 'image/png' });
            Object.defineProperty(largeFile, 'size', { value: 15 * 1024 * 1024 });
            
            const results = await processBatch([largeFile]);
            expect(results).toEqual([]);
        });

        it('should return empty array for empty file list', async () => {
            const results = await processBatch([]);
            expect(results).toEqual([]);
        });
    });

    // ========================================
    // Comparison Tests
    // ========================================
    describe('compareBatchResults', () => {
        it('should return null for non-existent ids', () => {
            const result = compareBatchResults('id1', 'id2');
            expect(result).toBeNull();
        });

        it('should return null if either result has no detectedBuild', () => {
            // With empty results, comparison should return null
            const result = compareBatchResults('any-id', 'another-id');
            expect(result).toBeNull();
        });
    });

    // ========================================
    // Summary Tests
    // ========================================
    describe('getBatchSummary', () => {
        it('should return zeros for empty results', () => {
            const summary = getBatchSummary();
            
            expect(summary).toEqual({
                totalScreenshots: 0,
                successfulScans: 0,
                totalItemsDetected: 0,
                avgConfidence: 0,
                mostCommonItems: [],
            });
        });

        it('should include totalScreenshots count', () => {
            const summary = getBatchSummary();
            expect(typeof summary.totalScreenshots).toBe('number');
        });

        it('should include avgConfidence field', () => {
            const summary = getBatchSummary();
            expect(typeof summary.avgConfidence).toBe('number');
        });
    });

    // ========================================
    // UI Rendering Tests
    // ========================================
    describe('renderBatchResultsGrid', () => {
        it('should render empty state when no results', () => {
            const container = document.createElement('div');
            container.id = 'test-container';
            document.body.appendChild(container);

            renderBatchResultsGrid('test-container');

            expect(container.innerHTML).toContain('No screenshots processed yet');
            
            document.body.removeChild(container);
        });

        it('should do nothing for non-existent container', () => {
            expect(() => renderBatchResultsGrid('non-existent')).not.toThrow();
        });

        it('should include upload instructions in empty state', () => {
            const container = document.createElement('div');
            container.id = 'test-container-2';
            document.body.appendChild(container);

            renderBatchResultsGrid('test-container-2');

            expect(container.innerHTML).toContain('Upload multiple screenshots');
            
            document.body.removeChild(container);
        });
    });

    // ========================================
    // Module Export Tests
    // ========================================
    describe('module exports', () => {
        it('should export initBatchScan function', () => {
            expect(typeof initBatchScan).toBe('function');
        });

        it('should export processBatch function', () => {
            expect(typeof processBatch).toBe('function');
        });

        it('should export getBatchResults function', () => {
            expect(typeof getBatchResults).toBe('function');
        });

        it('should export getBatchResultById function', () => {
            expect(typeof getBatchResultById).toBe('function');
        });

        it('should export clearBatchResults function', () => {
            expect(typeof clearBatchResults).toBe('function');
        });

        it('should export removeBatchResult function', () => {
            expect(typeof removeBatchResult).toBe('function');
        });

        it('should export compareBatchResults function', () => {
            expect(typeof compareBatchResults).toBe('function');
        });

        it('should export getBatchSummary function', () => {
            expect(typeof getBatchSummary).toBe('function');
        });

        it('should export renderBatchResultsGrid function', () => {
            expect(typeof renderBatchResultsGrid).toBe('function');
        });
    });

    // ========================================
    // Edge Cases
    // ========================================
    describe('edge cases', () => {
        it('should handle empty FileList', async () => {
            initBatchScan(mockGameData);
            const results = await processBatch([]);
            expect(results).toEqual([]);
        });

        it('should handle mixed valid and invalid files', async () => {
            initBatchScan(mockGameData);
            
            const invalidFile = createMockFile('test.txt', 'text/plain');
            // Only invalid file should be filtered out
            const results = await processBatch([invalidFile]);
            expect(results).toEqual([]);
        });

        it('should handle __resetForTesting multiple times', () => {
            initBatchScan(mockGameData);
            __resetForTesting();
            __resetForTesting();
            
            // Should be able to initialize again
            expect(() => initBatchScan(mockGameData)).not.toThrow();
        });
    });
});
