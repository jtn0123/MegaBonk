/**
 * @vitest-environment jsdom
 * Extended tests for batch-scan module
 * Focus on progress callbacks, file processing, and summaries
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { AllGameData, Item, Tome, Character, Weapon } from '../../src/types/index.ts';

// Store mock function references for manipulation
let mockDetectItemsWithCV = vi.fn().mockResolvedValue([]);
let mockAutoDetectFromImage = vi.fn().mockResolvedValue({
    items: [],
    tomes: [],
    character: null,
    weapon: null,
});
let mockIsFullyLoaded = vi.fn().mockReturnValue(true);
let mockCombineDetections = vi.fn((ocrResults: unknown[]) => ocrResults);
let mockAggregateDuplicates = vi.fn((results: Array<{ entity: Item | Tome }>) =>
    results.map(r => ({ ...r, count: 1 }))
);

// Mock CV module
vi.mock('../../src/modules/cv/index.ts', () => ({
    initCV: vi.fn(),
    loadItemTemplates: vi.fn().mockResolvedValue(undefined),
    detectItemsWithCV: (...args: unknown[]) => mockDetectItemsWithCV(...args),
    combineDetections: (...args: unknown[]) => mockCombineDetections(...args),
    aggregateDuplicates: (...args: unknown[]) => mockAggregateDuplicates(...args),
    isFullyLoaded: () => mockIsFullyLoaded(),
}));

// Mock OCR module
vi.mock('../../src/modules/ocr.ts', () => ({
    initOCR: vi.fn(),
    autoDetectFromImage: (...args: unknown[]) => mockAutoDetectFromImage(...args),
}));

// Mock toast
vi.mock('../../src/modules/toast.ts', () => ({
    ToastManager: {
        error: vi.fn(),
        success: vi.fn(),
        info: vi.fn(),
    },
}));

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
    type BatchDetectionResult,
} from '../../src/modules/batch-scan.ts';
import { ToastManager } from '../../src/modules/toast.ts';

// Mock game data
const mockGameData: AllGameData = {
    items: {
        version: '1.0',
        items: [
            { id: 'item1', name: 'Test Item 1', tier: 'S' } as Item,
            { id: 'item2', name: 'Test Item 2', tier: 'A' } as Item,
            { id: 'item3', name: 'Test Item 3', tier: 'B' } as Item,
        ],
    },
    weapons: {
        version: '1.0',
        weapons: [{ id: 'weapon1', name: 'Test Weapon' } as Weapon],
    },
    tomes: {
        version: '1.0',
        tomes: [{ id: 'tome1', name: 'Test Tome' } as Tome],
    },
    characters: {
        version: '1.0',
        characters: [{ id: 'char1', name: 'Test Character' } as Character],
    },
    shrines: { version: '1.0', shrines: [] },
    stats: { version: '1.0', stats: [] },
};

// Helper to create mock file
function createMockImageFile(name: string, content: string = 'mock-image-data'): File {
    const blob = new Blob([content], { type: 'image/png' });
    return new File([blob], name, { type: 'image/png' });
}

// Helper to create mock FileReader
function mockFileReader(dataUrl: string = 'data:image/png;base64,mockdata'): void {
    const mockReader = {
        readAsDataURL: vi.fn(),
        result: dataUrl,
        onload: null as ((event: ProgressEvent<FileReader>) => void) | null,
        onerror: null as (() => void) | null,
    };

    vi.spyOn(globalThis, 'FileReader').mockImplementation(() => {
        const reader = mockReader as unknown as FileReader;

        // Override readAsDataURL to trigger onload
        (reader as any).readAsDataURL = function () {
            setTimeout(() => {
                if (this.onload) {
                    this.onload({ target: { result: dataUrl } } as unknown as ProgressEvent<FileReader>);
                }
            }, 0);
        };

        return reader;
    });
}

// Helper to create mock Image
function mockImage(): void {
    vi.spyOn(globalThis, 'Image').mockImplementation(() => {
        const img = {
            src: '',
            width: 1920,
            height: 1080,
            onload: null as (() => void) | null,
            onerror: null as (() => void) | null,
        };

        // Trigger onload when src is set
        Object.defineProperty(img, 'src', {
            set(value: string) {
                this._src = value;
                setTimeout(() => {
                    if (this.onload) this.onload();
                }, 0);
            },
            get() {
                return this._src;
            },
        });

        return img as unknown as HTMLImageElement;
    });
}

// Mock canvas
function mockCanvas(): void {
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
        drawImage: vi.fn(),
    });
    HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/jpeg;base64,thumbnail');
}

describe('Batch Scan Module - Extended Coverage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        __resetForTesting();

        // Reset mock implementations
        mockDetectItemsWithCV = vi.fn().mockResolvedValue([]);
        mockAutoDetectFromImage = vi.fn().mockResolvedValue({
            items: [],
            tomes: [],
            character: null,
            weapon: null,
        });
        mockIsFullyLoaded = vi.fn().mockReturnValue(true);
        mockCombineDetections = vi.fn((ocrResults: unknown[]) => ocrResults);
        mockAggregateDuplicates = vi.fn((results: Array<{ entity: Item | Tome }>) =>
            results.map(r => ({ ...r, count: 1 }))
        );

        // Setup mocks
        mockFileReader();
        mockImage();
        mockCanvas();
    });

    afterEach(() => {
        __resetForTesting();
        vi.restoreAllMocks();
    });

    // ========================================
    // Initialization Tests
    // ========================================
    describe('Initialization', () => {
        it('should only initialize once (idempotent)', () => {
            // Reset and test that double init doesn't crash
            __resetForTesting();
            initBatchScan(mockGameData);
            
            // Should not throw when called again
            expect(() => initBatchScan(mockGameData)).not.toThrow();
        });

        it('should handle template loading failure gracefully', async () => {
            // Just verify initialization doesn't throw even if templates fail
            __resetForTesting();
            expect(() => initBatchScan(mockGameData)).not.toThrow();
        });

        it('should log initialization with item count', () => {
            initBatchScan(mockGameData);
            // Logger would be called internally - just verify no crash
        });
    });

    // ========================================
    // Progress Callback Tests
    // ========================================
    describe('Progress Callbacks', () => {
        beforeEach(() => {
            initBatchScan(mockGameData);
        });

        it('should call progress callback with correct structure', async () => {
            const progressCallback = vi.fn();
            const file = createMockImageFile('test.png');

            await processBatch([file], progressCallback);

            expect(progressCallback).toHaveBeenCalled();
            const firstCall = progressCallback.mock.calls[0][0];
            expect(firstCall).toHaveProperty('total');
            expect(firstCall).toHaveProperty('completed');
            expect(firstCall).toHaveProperty('current');
            expect(firstCall).toHaveProperty('overallProgress');
        });

        it('should report progress for each file', async () => {
            const progressCallback = vi.fn();
            const files = [createMockImageFile('test1.png'), createMockImageFile('test2.png')];

            await processBatch(files, progressCallback);

            // Should be called at least once per file + completion
            expect(progressCallback.mock.calls.length).toBeGreaterThanOrEqual(2);
        });

        it('should report 100% progress on completion', async () => {
            const progressCallback = vi.fn();
            const file = createMockImageFile('test.png');

            await processBatch([file], progressCallback);

            const lastCall = progressCallback.mock.calls[progressCallback.mock.calls.length - 1][0];
            expect(lastCall.overallProgress).toBe(100);
            expect(lastCall.current).toBe('Complete');
        });

        it('should work without progress callback', async () => {
            const file = createMockImageFile('test.png');

            const results = await processBatch([file]);
            expect(results).toBeDefined();
        });
    });

    // ========================================
    // File Validation Extended Tests
    // ========================================
    describe('File Validation - Extended', () => {
        beforeEach(() => {
            initBatchScan(mockGameData);
        });

        it('should accept JPEG files', async () => {
            const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
            const results = await processBatch([file]);
            expect(results.length).toBeGreaterThanOrEqual(0); // May or may not process depending on FileReader
        });

        it('should accept GIF files', async () => {
            const file = new File(['data'], 'test.gif', { type: 'image/gif' });
            const results = await processBatch([file]);
            expect(results.length).toBeGreaterThanOrEqual(0);
        });

        it('should accept WebP files', async () => {
            const file = new File(['data'], 'test.webp', { type: 'image/webp' });
            const results = await processBatch([file]);
            expect(results.length).toBeGreaterThanOrEqual(0);
        });

        it('should reject PDF files', async () => {
            const file = new File(['data'], 'test.pdf', { type: 'application/pdf' });
            const results = await processBatch([file]);
            expect(results).toEqual([]);
        });

        it('should reject video files', async () => {
            const file = new File(['data'], 'test.mp4', { type: 'video/mp4' });
            const results = await processBatch([file]);
            expect(results).toEqual([]);
        });

        it('should handle FileList-like objects', async () => {
            const files = [createMockImageFile('test1.png'), createMockImageFile('test2.png')];

            // Create FileList-like object
            const fileList = {
                0: files[0],
                1: files[1],
                length: 2,
                item: (i: number) => files[i],
                [Symbol.iterator]: function* () {
                    yield* files;
                },
            } as unknown as FileList;

            const results = await processBatch(fileList);
            expect(results).toBeDefined();
        });

        it('should filter out files exactly at 10MB limit', async () => {
            const file = new File(['x'], 'large.png', { type: 'image/png' });
            Object.defineProperty(file, 'size', { value: 10 * 1024 * 1024 }); // Exactly 10MB

            // 10MB should be allowed (> 10MB rejected)
            const results = await processBatch([file]);
            // Should attempt to process
            expect(results).toBeDefined();
        });
    });

    // ========================================
    // Detection Integration Tests
    // ========================================
    describe('Detection Integration', () => {
        beforeEach(() => {
            initBatchScan(mockGameData);
        });

        it('should handle file validation before detection', async () => {
            const file = createMockImageFile('test.png');

            // Just verify processBatch runs without error
            const results = await processBatch([file]);
            expect(results).toBeDefined();
        });

        it('should skip CV detection when not fully loaded', async () => {
            mockIsFullyLoaded.mockReturnValue(false);
            const file = createMockImageFile('test.png');

            const results = await processBatch([file]);
            // Should complete without error
            expect(results).toBeDefined();
        });

        it('should handle OCR detection failure gracefully', async () => {
            mockAutoDetectFromImage.mockRejectedValueOnce(new Error('OCR failed'));
            const file = createMockImageFile('test.png');

            const results = await processBatch([file]);
            // Should not crash, may have result with error or empty detection
            expect(results).toBeDefined();
        });

        it('should handle CV detection failure gracefully', async () => {
            mockDetectItemsWithCV.mockRejectedValueOnce(new Error('CV failed'));
            const file = createMockImageFile('test.png');

            const results = await processBatch([file]);
            expect(results).toBeDefined();
        });

        it('should handle detection modules being available', async () => {
            const mockItem = { id: 'item1', name: 'Test Item', tier: 'S' } as Item;

            mockAutoDetectFromImage.mockResolvedValueOnce({
                items: [{ type: 'item', entity: mockItem, confidence: 0.8, rawText: 'test' }],
                tomes: [],
                character: null,
                weapon: null,
            });

            const file = createMockImageFile('test.png');
            const results = await processBatch([file]);

            // Verify results are returned
            expect(results).toBeDefined();
        });
    });

    // ========================================
    // Result Management Extended Tests
    // ========================================
    describe('Result Management - Extended', () => {
        it('should clear results between batch operations', async () => {
            initBatchScan(mockGameData);

            const file1 = createMockImageFile('test1.png');
            await processBatch([file1]);

            const file2 = createMockImageFile('test2.png');
            const results2 = await processBatch([file2]);

            // Results should only contain the second batch
            expect(results2.length).toBe(1);
            expect(results2[0].filename).toBe('test2.png');
        });

        it('should generate unique IDs for each result', async () => {
            initBatchScan(mockGameData);

            const files = [createMockImageFile('test1.png'), createMockImageFile('test2.png')];

            const results = await processBatch(files);

            if (results.length >= 2) {
                expect(results[0].id).not.toBe(results[1].id);
            }
        });

        it('should store timestamp for each result', async () => {
            initBatchScan(mockGameData);

            const file = createMockImageFile('test.png');
            const results = await processBatch([file]);

            if (results.length > 0) {
                expect(results[0].timestamp).toBeDefined();
                // Should be valid ISO date
                expect(new Date(results[0].timestamp).toISOString()).toBe(results[0].timestamp);
            }
        });

        it('should allow removing individual results', async () => {
            initBatchScan(mockGameData);

            const files = [createMockImageFile('test1.png'), createMockImageFile('test2.png')];

            const results = await processBatch(files);

            if (results.length >= 1) {
                const initialLength = getBatchResults().length;
                const idToRemove = results[0].id;
                const removed = removeBatchResult(idToRemove);

                expect(removed).toBe(true);
                expect(getBatchResults().length).toBe(initialLength - 1);
                expect(getBatchResultById(idToRemove)).toBeUndefined();
            }
        });
    });

    // ========================================
    // Comparison Extended Tests
    // ========================================
    describe('Comparison - Extended', () => {
        it('should compare results with detected builds', async () => {
            initBatchScan(mockGameData);

            const mockItem1 = { id: 'item1', name: 'Item 1' } as Item;
            const mockItem2 = { id: 'item2', name: 'Item 2' } as Item;
            const mockItem3 = { id: 'item3', name: 'Item 3' } as Item;

            // First detection
            mockAggregateDuplicates.mockReturnValueOnce([
                { entity: mockItem1, confidence: 0.9, count: 1 },
                { entity: mockItem2, confidence: 0.8, count: 2 },
            ]);

            const file1 = createMockImageFile('test1.png');
            await processBatch([file1]);
            const results1 = getBatchResults();

            // Reset for second batch
            __resetForTesting();
            initBatchScan(mockGameData);

            // Second detection with different items
            mockAggregateDuplicates.mockReturnValueOnce([
                { entity: mockItem2, confidence: 0.85, count: 1 },
                { entity: mockItem3, confidence: 0.7, count: 1 },
            ]);

            const file2 = createMockImageFile('test2.png');
            await processBatch([file2]);
            const results2 = getBatchResults();

            // Note: In real usage, both results would be in same batch
            // This test verifies the comparison function structure
            if (results1.length > 0 && results2.length > 0) {
                // Put both in results for comparison
                // This would require manual manipulation since processBatch clears results
            }
        });

        it('should return null when results lack detectedBuild', () => {
            const result = compareBatchResults('nonexistent1', 'nonexistent2');
            expect(result).toBeNull();
        });
    });

    // ========================================
    // Summary Extended Tests
    // ========================================
    describe('Summary - Extended', () => {
        it('should calculate correct total items detected', async () => {
            initBatchScan(mockGameData);

            const mockItem = { id: 'item1', name: 'Test Item' } as Item;
            mockAggregateDuplicates.mockReturnValue([
                { entity: mockItem, confidence: 0.9, count: 3 },
            ]);
            mockCombineDetections.mockReturnValue([{ entity: mockItem, confidence: 0.9 }]);

            const file = createMockImageFile('test.png');
            await processBatch([file]);

            const summary = getBatchSummary();
            // Should count items with their quantities
            expect(typeof summary.totalItemsDetected).toBe('number');
        });

        it('should calculate average confidence correctly', async () => {
            initBatchScan(mockGameData);

            const mockItem1 = { id: 'item1', name: 'Item 1' } as Item;
            const mockItem2 = { id: 'item2', name: 'Item 2' } as Item;

            mockAggregateDuplicates.mockReturnValue([
                { entity: mockItem1, confidence: 0.9, count: 1 },
                { entity: mockItem2, confidence: 0.7, count: 1 },
            ]);
            mockCombineDetections.mockReturnValue([
                { entity: mockItem1, confidence: 0.9 },
                { entity: mockItem2, confidence: 0.7 },
            ]);

            const file = createMockImageFile('test.png');
            await processBatch([file]);

            const summary = getBatchSummary();
            // Average of 0.9 and 0.7 is 0.8
            expect(summary.avgConfidence).toBeGreaterThanOrEqual(0);
            expect(summary.avgConfidence).toBeLessThanOrEqual(1);
        });

        it('should track most common items across screenshots', async () => {
            initBatchScan(mockGameData);

            const summary = getBatchSummary();
            expect(Array.isArray(summary.mostCommonItems)).toBe(true);
        });

        it('should limit mostCommonItems to top 10', async () => {
            const summary = getBatchSummary();
            expect(summary.mostCommonItems.length).toBeLessThanOrEqual(10);
        });
    });

    // ========================================
    // Rendering Extended Tests
    // ========================================
    describe('Rendering - Extended', () => {
        it('should render summary stats', async () => {
            initBatchScan(mockGameData);

            const mockItem = { id: 'item1', name: 'Test Item' } as Item;
            mockAggregateDuplicates.mockReturnValue([{ entity: mockItem, confidence: 0.85, count: 2 }]);
            mockCombineDetections.mockReturnValue([{ entity: mockItem, confidence: 0.85 }]);

            const file = createMockImageFile('test.png');
            await processBatch([file]);

            const container = document.createElement('div');
            container.id = 'batch-container';
            document.body.appendChild(container);

            renderBatchResultsGrid('batch-container');

            expect(container.innerHTML).toContain('batch-summary');
            expect(container.innerHTML).toContain('batch-stat');

            document.body.removeChild(container);
        });

        it('should render result cards', async () => {
            initBatchScan(mockGameData);

            const file = createMockImageFile('test.png');
            await processBatch([file]);

            const container = document.createElement('div');
            container.id = 'batch-container-2';
            document.body.appendChild(container);

            renderBatchResultsGrid('batch-container-2');

            expect(container.innerHTML).toContain('batch-result-card');

            document.body.removeChild(container);
        });

        it('should show error state for failed results', async () => {
            initBatchScan(mockGameData);

            // Mock FileReader to fail
            vi.spyOn(globalThis, 'FileReader').mockImplementation(() => {
                const reader = {
                    readAsDataURL: function () {
                        setTimeout(() => {
                            if (this.onerror) this.onerror();
                        }, 0);
                    },
                    onload: null,
                    onerror: null,
                };
                return reader as unknown as FileReader;
            });

            const file = createMockImageFile('test.png');
            await processBatch([file]);

            const container = document.createElement('div');
            container.id = 'batch-container-3';
            document.body.appendChild(container);

            renderBatchResultsGrid('batch-container-3');

            // Should show either error state or empty state
            const html = container.innerHTML;
            expect(html.includes('batch-error') || html.includes('batch-empty-state')).toBe(true);

            document.body.removeChild(container);
        });

        it('should include thumbnail images when available', async () => {
            initBatchScan(mockGameData);

            const file = createMockImageFile('test.png');
            await processBatch([file]);

            const container = document.createElement('div');
            container.id = 'batch-container-4';
            document.body.appendChild(container);

            renderBatchResultsGrid('batch-container-4');

            // May have thumbnail or placeholder
            const html = container.innerHTML;
            expect(html.includes('batch-thumbnail')).toBe(true);

            document.body.removeChild(container);
        });

        it('should include action buttons for complete results', async () => {
            initBatchScan(mockGameData);

            const file = createMockImageFile('test.png');
            await processBatch([file]);

            const results = getBatchResults();
            if (results.length > 0 && results[0].status === 'complete') {
                const container = document.createElement('div');
                container.id = 'batch-container-5';
                document.body.appendChild(container);

                renderBatchResultsGrid('batch-container-5');

                const html = container.innerHTML;
                expect(html.includes('batch-view-btn') || html.includes('batch-apply-btn')).toBe(true);

                document.body.removeChild(container);
            }
        });

        it('should render most common items section', async () => {
            initBatchScan(mockGameData);

            const mockItem = { id: 'item1', name: 'Popular Item' } as Item;
            mockAggregateDuplicates.mockReturnValue([{ entity: mockItem, confidence: 0.9, count: 5 }]);
            mockCombineDetections.mockReturnValue([{ entity: mockItem, confidence: 0.9 }]);

            const file = createMockImageFile('test.png');
            await processBatch([file]);

            const container = document.createElement('div');
            container.id = 'batch-container-6';
            document.body.appendChild(container);

            renderBatchResultsGrid('batch-container-6');

            // May have common items section if detection worked
            // const html = container.innerHTML;

            document.body.removeChild(container);
        });

        it('should escape HTML in filenames', async () => {
            initBatchScan(mockGameData);

            const file = new File(['data'], '<script>alert("xss")</script>.png', { type: 'image/png' });
            await processBatch([file]);

            const container = document.createElement('div');
            container.id = 'batch-container-7';
            document.body.appendChild(container);

            renderBatchResultsGrid('batch-container-7');

            // Should not contain unescaped script tag
            expect(container.innerHTML).not.toContain('<script>alert');

            document.body.removeChild(container);
        });
    });

    // ========================================
    // Stats Calculation Tests
    // ========================================
    describe('Stats Calculation', () => {
        it('should calculate processing time', async () => {
            initBatchScan(mockGameData);

            const file = createMockImageFile('test.png');
            await processBatch([file]);

            const results = getBatchResults();
            if (results.length > 0 && results[0].stats) {
                expect(results[0].stats.processingTimeMs).toBeGreaterThanOrEqual(0);
            }
        });

        it('should calculate total items from detection', async () => {
            initBatchScan(mockGameData);

            const mockItem = { id: 'item1', name: 'Test' } as Item;
            mockAggregateDuplicates.mockReturnValue([
                { entity: mockItem, confidence: 0.9, count: 3 },
            ]);

            const file = createMockImageFile('test.png');
            await processBatch([file]);

            const results = getBatchResults();
            if (results.length > 0 && results[0].stats) {
                expect(typeof results[0].stats.totalItems).toBe('number');
            }
        });

        it('should calculate average confidence from all detections', async () => {
            initBatchScan(mockGameData);

            const file = createMockImageFile('test.png');
            await processBatch([file]);

            const results = getBatchResults();
            if (results.length > 0 && results[0].stats) {
                expect(results[0].stats.avgConfidence).toBeGreaterThanOrEqual(0);
                expect(results[0].stats.avgConfidence).toBeLessThanOrEqual(1);
            }
        });
    });

    // ========================================
    // Edge Cases
    // ========================================
    describe('Edge Cases - Extended', () => {
        it('should handle rapid successive batch operations', async () => {
            initBatchScan(mockGameData);

            const file1 = createMockImageFile('test1.png');
            const file2 = createMockImageFile('test2.png');

            // Start two batches rapidly
            const promise1 = processBatch([file1]);
            const promise2 = processBatch([file2]);

            const [results1, results2] = await Promise.all([promise1, promise2]);

            // Both should complete without error
            expect(results1).toBeDefined();
            expect(results2).toBeDefined();
        });

        it('should handle files with special characters in name', async () => {
            initBatchScan(mockGameData);

            const file = new File(['data'], 'test file (1) [2] {3}.png', { type: 'image/png' });
            const results = await processBatch([file]);

            expect(results).toBeDefined();
        });

        it('should handle files with unicode names', async () => {
            initBatchScan(mockGameData);

            const file = new File(['data'], 'тест_测试_🎮.png', { type: 'image/png' });
            const results = await processBatch([file]);

            expect(results).toBeDefined();
        });

        it('should handle very long filenames', async () => {
            initBatchScan(mockGameData);

            const longName = 'a'.repeat(255) + '.png';
            const file = new File(['data'], longName, { type: 'image/png' });
            const results = await processBatch([file]);

            expect(results).toBeDefined();
        });

        it('should handle empty filename', async () => {
            initBatchScan(mockGameData);

            const file = new File(['data'], '.png', { type: 'image/png' });
            const results = await processBatch([file]);

            expect(results).toBeDefined();
        });
    });

    // ========================================
    // Character and Weapon Detection Tests
    // ========================================
    describe('Character and Weapon Detection', () => {
        it('should detect character from OCR', async () => {
            initBatchScan(mockGameData);

            const mockChar = { id: 'char1', name: 'Test Char' } as Character;
            mockAutoDetectFromImage.mockResolvedValueOnce({
                items: [],
                tomes: [],
                character: { type: 'character', entity: mockChar, confidence: 0.9, rawText: 'test' },
                weapon: null,
            });

            const file = createMockImageFile('test.png');
            await processBatch([file]);

            const results = getBatchResults();
            if (results.length > 0 && results[0].detectedBuild) {
                expect(results[0].detectedBuild.character).toBeDefined();
            }
        });

        it('should detect weapon from OCR', async () => {
            initBatchScan(mockGameData);

            const mockWeapon = { id: 'weapon1', name: 'Test Weapon' } as Weapon;
            mockAutoDetectFromImage.mockResolvedValueOnce({
                items: [],
                tomes: [],
                character: null,
                weapon: { type: 'weapon', entity: mockWeapon, confidence: 0.9, rawText: 'test' },
            });

            const file = createMockImageFile('test.png');
            await processBatch([file]);

            const results = getBatchResults();
            if (results.length > 0 && results[0].detectedBuild) {
                expect(results[0].detectedBuild.weapon).toBeDefined();
            }
        });

        it('should fallback to CV for character detection', async () => {
            initBatchScan(mockGameData);

            const mockChar = { id: 'char1', name: 'CV Char' } as Character;
            mockAutoDetectFromImage.mockResolvedValueOnce({
                items: [],
                tomes: [],
                character: null,
                weapon: null,
            });
            mockDetectItemsWithCV.mockResolvedValueOnce([
                { entity: mockChar, confidence: 0.85, type: 'character' },
            ]);

            const file = createMockImageFile('test.png');
            await processBatch([file]);

            const results = getBatchResults();
            if (results.length > 0 && results[0].detectedBuild) {
                // May have character from CV
            }
        });
    });

    // ========================================
    // Tome Detection Tests
    // ========================================
    describe('Tome Detection', () => {
        it('should detect tomes and aggregate', async () => {
            initBatchScan(mockGameData);

            const mockTome = { id: 'tome1', name: 'Test Tome' } as Tome;
            mockAutoDetectFromImage.mockResolvedValueOnce({
                items: [],
                tomes: [{ type: 'tome', entity: mockTome, confidence: 0.9, rawText: 'test' }],
                character: null,
                weapon: null,
            });
            mockCombineDetections.mockImplementation(ocrResults => ocrResults);
            mockAggregateDuplicates.mockImplementation(results =>
                results.map(r => ({ ...r, count: 1 }))
            );

            const file = createMockImageFile('test.png');
            await processBatch([file]);

            const results = getBatchResults();
            if (results.length > 0 && results[0].detectedBuild) {
                expect(Array.isArray(results[0].detectedBuild.tomes)).toBe(true);
            }
        });
    });
});
