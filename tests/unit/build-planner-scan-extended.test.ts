/**
 * @vitest-environment jsdom
 * Extended tests for build-planner-scan module
 * Focus on image processing, modal UI, progress callbacks, and detection pipelines
 */
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import type { AllGameData, Item, Tome, Character, Weapon } from '../../src/types/index.ts';

// Store mock function references for manipulation
let mockDetectItemsWithCV: Mock = vi.fn().mockResolvedValue([]);
let mockAutoDetectFromImage: Mock = vi.fn().mockResolvedValue({
    items: [],
    tomes: [],
    character: null,
    weapon: null,
});
let mockIsFullyLoaded: Mock = vi.fn().mockReturnValue(true);
let mockCombineDetections: Mock = vi.fn((ocrResults: unknown[]) => ocrResults);
let mockAggregateDuplicates: Mock = vi.fn((results: Array<{ entity: Item | Tome }>) =>
    results.map(r => ({ ...r, count: 1 }))
);
let mockGetPresetForResolution: Mock = vi.fn().mockReturnValue(null);
let mockAutoDetectGrid: Mock = vi.fn().mockResolvedValue({ success: false });
let mockLoadItemTemplates: Mock = vi.fn().mockResolvedValue(undefined);
let mockLoadGridPresets: Mock = vi.fn().mockResolvedValue(undefined);
let mockLoadBuildFromData: Mock = vi.fn();

// Mock CV module
vi.mock('../../src/modules/cv/index.ts', () => ({
    initCV: vi.fn(),
    loadItemTemplates: (...args: unknown[]) => mockLoadItemTemplates(...args),
    detectItemsWithCV: (...args: unknown[]) => mockDetectItemsWithCV(...args),
    combineDetections: (...args: unknown[]) => mockCombineDetections(...args),
    aggregateDuplicates: (...args: unknown[]) => mockAggregateDuplicates(...args),
    isFullyLoaded: () => mockIsFullyLoaded(),
    autoDetectGrid: (...args: unknown[]) => mockAutoDetectGrid(...args),
    getPresetForResolution: (...args: unknown[]) => mockGetPresetForResolution(...args),
    loadGridPresets: (...args: unknown[]) => mockLoadGridPresets(...args),
}));

// Mock OCR module
vi.mock('../../src/modules/ocr.ts', () => ({
    initOCR: vi.fn(),
    autoDetectFromImage: (...args: unknown[]) => mockAutoDetectFromImage(...args),
}));

// Mock build-planner module
vi.mock('../../src/modules/build-planner.ts', () => ({
    loadBuildFromData: (...args: unknown[]) => mockLoadBuildFromData(...args),
}));

// Mock toast manager
vi.mock('../../src/modules/toast.ts', () => ({
    ToastManager: {
        error: vi.fn(),
        success: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
    },
}));

// Mock logger
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Import after mocks
import {
    initBuildPlannerScan,
    closePreviewModal,
    applyDetectedBuild,
} from '../../src/modules/build-planner-scan.ts';
import { ToastManager } from '../../src/modules/toast.ts';
import { logger } from '../../src/modules/logger.ts';

// Mock game data
const mockGameData: AllGameData = {
    items: {
        version: '1.0',
        items: [
            { id: 'item1', name: 'Test Item 1', tier: 'common' } as Item,
            { id: 'item2', name: 'Test Item 2', tier: 'rare' } as Item,
            { id: 'item3', name: 'Test Item 3', tier: 'legendary' } as Item,
        ],
    },
    weapons: {
        version: '1.0',
        weapons: [
            { id: 'weapon1', name: 'Test Weapon 1' } as Weapon,
            { id: 'weapon2', name: 'Test Weapon 2' } as Weapon,
        ],
    },
    tomes: {
        version: '1.0',
        tomes: [
            { id: 'tome1', name: 'Test Tome 1' } as Tome,
            { id: 'tome2', name: 'Test Tome 2' } as Tome,
        ],
    },
    characters: {
        version: '1.0',
        characters: [
            { id: 'char1', name: 'Test Character 1' } as Character,
            { id: 'char2', name: 'Test Character 2' } as Character,
        ],
    },
    shrines: { version: '1.0', shrines: [] },
    stats: { version: '1.0', stats: [] },
};

// Helper to create mock image file
function createMockImageFile(name: string, size: number = 1024, type: string = 'image/png'): File {
    const blob = new Blob(['x'.repeat(size)], { type });
    return new File([blob], name, { type });
}

// Store original implementations
let originalFileReader: typeof FileReader;
let originalImage: typeof Image;

// Setup mocks at module level
function setupGlobalMocks(): void {
    // Save originals
    originalFileReader = globalThis.FileReader;
    originalImage = globalThis.Image;
    
    // Mock FileReader
    const MockFileReader = function(this: FileReader) {
        const self = this;
        (self as any).result = 'data:image/png;base64,mockdata';
        (self as any).readAsDataURL = function() {
            setTimeout(() => {
                if ((self as any).onload) {
                    (self as any).onload({ target: { result: 'data:image/png;base64,mockdata' } });
                }
            }, 0);
        };
        return self;
    } as unknown as typeof FileReader;
    
    globalThis.FileReader = MockFileReader;
    
    // Mock Image
    const MockImage = function(this: HTMLImageElement) {
        const self = this;
        (self as any).naturalWidth = 1920;
        (self as any).naturalHeight = 1080;
        (self as any).width = 1920;
        (self as any).height = 1080;
        
        Object.defineProperty(self, 'src', {
            set(value: string) {
                (self as any)._src = value;
                setTimeout(() => {
                    if ((self as any).onload) (self as any).onload();
                }, 0);
            },
            get() {
                return (self as any)._src;
            },
        });
        
        return self;
    } as unknown as typeof Image;
    
    globalThis.Image = MockImage;
    
    // Mock canvas
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(4) }),
    });
    HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/jpeg;base64,thumbnail');
}

// Restore mocks
function restoreGlobalMocks(): void {
    if (originalFileReader) globalThis.FileReader = originalFileReader;
    if (originalImage) globalThis.Image = originalImage;
}

// Reset mocks to default state
function resetMocks(): void {
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
    mockGetPresetForResolution = vi.fn().mockReturnValue(null);
    mockAutoDetectGrid = vi.fn().mockResolvedValue({ success: false });
    mockLoadItemTemplates = vi.fn().mockResolvedValue(undefined);
    mockLoadGridPresets = vi.fn().mockResolvedValue(undefined);
    mockLoadBuildFromData = vi.fn();
}

// Helper to trigger file selection
function triggerFileSelection(file: File): void {
    const fileInput = document.getElementById('build-planner-file-input') as HTMLInputElement;
    if (!fileInput) return;
    
    Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: true,
        configurable: true,
    });
    
    fileInput.dispatchEvent(new Event('change'));
}

// Track if module is initialized
let moduleInitialized = false;

describe('Build Planner Scan Module - Extended Coverage', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        resetMocks();
        setupGlobalMocks();
        
        // Setup DOM
        document.body.innerHTML = `<div class="build-actions"></div>`;
        
        // Initialize module once
        if (!moduleInitialized) {
            await initBuildPlannerScan(mockGameData);
            moduleInitialized = true;
        }
        
        // Hide modal
        const modal = document.getElementById('build-planner-scan-modal');
        if (modal) modal.style.display = 'none';
    });

    afterEach(() => {
        restoreGlobalMocks();
        vi.clearAllMocks();
    });

    // ========================================
    // Module Initialization
    // ========================================
    describe('Module Initialization', () => {
        it('should be idempotent - multiple calls should not throw', async () => {
            await expect(initBuildPlannerScan(mockGameData)).resolves.not.toThrow();
            await expect(initBuildPlannerScan(mockGameData)).resolves.not.toThrow();
        });

        it('should have created UI elements during initialization', () => {
            const importBtn = document.getElementById('import-screenshot-btn');
            const fileInput = document.getElementById('build-planner-file-input');
            const modal = document.getElementById('build-planner-scan-modal');
            
            expect(importBtn).toBeTruthy();
            expect(fileInput).toBeTruthy();
            expect(modal).toBeTruthy();
        });

        it('should have correct file input attributes', () => {
            const fileInput = document.getElementById('build-planner-file-input') as HTMLInputElement;
            expect(fileInput?.type).toBe('file');
            expect(fileInput?.accept).toBe('image/*');
        });

        it('should have modal with correct class', () => {
            const modal = document.getElementById('build-planner-scan-modal');
            expect(modal?.classList.contains('modal')).toBe(true);
        });
    });

    // ========================================
    // UI Event Handlers
    // ========================================
    describe('UI Event Handlers', () => {
        it('should trigger file input when import button clicked', () => {
            const importBtn = document.getElementById('import-screenshot-btn');
            const fileInput = document.getElementById('build-planner-file-input') as HTMLInputElement;
            
            if (fileInput) {
                const clickSpy = vi.spyOn(fileInput, 'click');
                importBtn?.click();
                expect(clickSpy).toHaveBeenCalled();
            }
        });

        it('should close modal on close button click', () => {
            const modal = document.getElementById('build-planner-scan-modal');
            if (modal) modal.style.display = 'flex';

            const closeBtn = document.getElementById('close-scan-modal');
            closeBtn?.click();

            expect(modal?.style.display).toBe('none');
        });

        it('should close modal on escape key', () => {
            const modal = document.getElementById('build-planner-scan-modal');
            if (modal) modal.style.display = 'flex';

            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

            expect(modal?.style.display).toBe('none');
        });

        it('should close modal on backdrop click', () => {
            const modal = document.getElementById('build-planner-scan-modal');
            if (modal) {
                modal.style.display = 'flex';
                const event = new MouseEvent('click', { bubbles: true });
                Object.defineProperty(event, 'target', { value: modal, writable: false });
                modal.dispatchEvent(event);
            }

            expect(modal?.style.display).toBe('none');
        });
    });

    // ========================================
    // File Validation
    // ========================================
    describe('File Validation', () => {
        it('should reject non-image files', async () => {
            const file = new File(['test'], 'test.txt', { type: 'text/plain' });
            triggerFileSelection(file);

            await vi.waitFor(() => {
                expect(ToastManager.error).toHaveBeenCalledWith('Please select an image file');
            }, { timeout: 1000 });
        });

        it('should reject files larger than 10MB', async () => {
            const largeFile = createMockImageFile('large.png', 11 * 1024 * 1024);
            triggerFileSelection(largeFile);

            await vi.waitFor(() => {
                expect(ToastManager.error).toHaveBeenCalledWith('Image size must be less than 10MB');
            }, { timeout: 1000 });
        });

        it('should accept PNG files', async () => {
            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                const modal = document.getElementById('build-planner-scan-modal');
                expect(modal?.style.display).toBe('flex');
            }, { timeout: 2000 });
        });

        it('should accept JPEG files', async () => {
            const jpegFile = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
            triggerFileSelection(jpegFile);

            await vi.waitFor(() => {
                const modal = document.getElementById('build-planner-scan-modal');
                expect(modal?.style.display).toBe('flex');
            }, { timeout: 2000 });
        });

        it('should accept WebP files', async () => {
            const webpFile = new File(['data'], 'test.webp', { type: 'image/webp' });
            triggerFileSelection(webpFile);

            await vi.waitFor(() => {
                const modal = document.getElementById('build-planner-scan-modal');
                expect(modal?.style.display).toBe('flex');
            }, { timeout: 2000 });
        });

        it('should do nothing if no file selected', () => {
            const fileInput = document.getElementById('build-planner-file-input') as HTMLInputElement;
            if (!fileInput) return;
            
            Object.defineProperty(fileInput, 'files', {
                value: [],
                writable: true,
                configurable: true,
            });
            
            fileInput.dispatchEvent(new Event('change'));
            expect(ToastManager.error).not.toHaveBeenCalled();
        });
    });

    // ========================================
    // Detection Pipeline
    // ========================================
    describe('Detection Pipeline', () => {
        it('should run OCR detection', async () => {
            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                expect(mockAutoDetectFromImage).toHaveBeenCalled();
            }, { timeout: 2000 });
        });

        it('should run CV detection when fully loaded', async () => {
            mockIsFullyLoaded.mockReturnValue(true);
            
            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                expect(mockDetectItemsWithCV).toHaveBeenCalled();
            }, { timeout: 2000 });
        });

        it('should handle OCR failure gracefully', async () => {
            mockAutoDetectFromImage.mockRejectedValue(new Error('OCR failed'));
            
            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                expect(logger.warn).toHaveBeenCalledWith(
                    expect.objectContaining({ operation: 'build_planner_scan.ocr_failed' })
                );
            }, { timeout: 2000 });
        });

        it('should handle CV failure gracefully', async () => {
            mockDetectItemsWithCV.mockRejectedValue(new Error('CV failed'));
            
            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                expect(logger.warn).toHaveBeenCalledWith(
                    expect.objectContaining({ operation: 'build_planner_scan.cv_failed' })
                );
            }, { timeout: 2000 });
        });

        it('should combine OCR and CV results', async () => {
            const mockItem = { id: 'item1', name: 'Test Item 1', tier: 'common' } as Item;

            mockAutoDetectFromImage.mockResolvedValue({
                items: [{ type: 'item', entity: mockItem, confidence: 0.8, rawText: 'Test' }],
                tomes: [],
                character: null,
                weapon: null,
            });

            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                expect(mockCombineDetections).toHaveBeenCalled();
            }, { timeout: 2000 });
        });

        it('should aggregate duplicate items', async () => {
            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                expect(mockAggregateDuplicates).toHaveBeenCalled();
            }, { timeout: 2000 });
        });

        it('should try auto-detect grid when no preset', async () => {
            mockGetPresetForResolution.mockReturnValue(null);
            
            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                expect(mockAutoDetectGrid).toHaveBeenCalled();
            }, { timeout: 2000 });
        });

        it('should handle auto-detect grid failure', async () => {
            mockAutoDetectGrid.mockRejectedValue(new Error('Grid failed'));
            
            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                expect(logger.warn).toHaveBeenCalledWith(
                    expect.objectContaining({ operation: 'build_planner_scan.auto_grid_failed' })
                );
            }, { timeout: 2000 });
        });

        it('should log successful auto grid detection', async () => {
            mockAutoDetectGrid.mockResolvedValue({
                success: true,
                calibration: { x: 0, y: 0, width: 100, height: 100 },
            });
            
            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                expect(logger.info).toHaveBeenCalledWith(
                    expect.objectContaining({ operation: 'build_planner_scan.auto_grid_success' })
                );
            }, { timeout: 2000 });
        });

        it('should log file processing success', async () => {
            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                expect(logger.info).toHaveBeenCalledWith(
                    expect.objectContaining({ operation: 'build_planner_scan.file_processed' })
                );
            }, { timeout: 2000 });
        });

        it('should call getPresetForResolution with image dimensions', async () => {
            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                expect(mockGetPresetForResolution).toHaveBeenCalledWith(1920, 1080);
            }, { timeout: 2000 });
        });
    });

    // ========================================
    // Preview Modal Display
    // ========================================
    describe('Preview Modal Display', () => {
        it('should show processing state', async () => {
            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                const content = document.getElementById('build-scan-content');
                expect(content?.innerHTML).toContain('build-scan-progress');
            }, { timeout: 2000 });
        });

        it('should show preview with detected items', async () => {
            const mockItem = { id: 'item1', name: 'Test Item 1', tier: 'common' } as Item;
            mockAggregateDuplicates.mockReturnValue([
                { entity: mockItem, confidence: 0.85, count: 2 },
            ]);

            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                const content = document.getElementById('build-scan-content');
                expect(content?.innerHTML).toContain('build-scan-preview');
            }, { timeout: 2000 });
        });

        it('should display confidence percentage', async () => {
            const mockItem = { id: 'item1', name: 'Test Item 1', tier: 'common' } as Item;
            mockAggregateDuplicates.mockReturnValue([
                { entity: mockItem, confidence: 0.85, count: 1 },
            ]);

            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                const content = document.getElementById('build-scan-content');
                expect(content?.innerHTML).toContain('85%');
            }, { timeout: 2000 });
        });

        it('should show empty message when no items', async () => {
            mockAggregateDuplicates.mockReturnValue([]);

            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                const content = document.getElementById('build-scan-content');
                expect(content?.innerHTML).toContain('No items detected');
            }, { timeout: 2000 });
        });

        it('should show character when detected via OCR', async () => {
            const mockChar = { id: 'char1', name: 'Test Character 1' } as Character;
            const mockItem = { id: 'item1', name: 'Item' } as Item;

            mockAutoDetectFromImage.mockResolvedValue({
                items: [],
                tomes: [],
                character: { type: 'character', entity: mockChar, confidence: 0.9, rawText: '' },
                weapon: null,
            });
            mockAggregateDuplicates.mockReturnValue([
                { entity: mockItem, confidence: 0.8, count: 1 },
            ]);

            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                const content = document.getElementById('build-scan-content');
                expect(content?.innerHTML).toContain('Character');
            }, { timeout: 2000 });
        });

        it('should show weapon when detected', async () => {
            const mockWeapon = { id: 'weapon1', name: 'Test Weapon 1' } as Weapon;
            const mockItem = { id: 'item1', name: 'Item' } as Item;

            mockAutoDetectFromImage.mockResolvedValue({
                items: [],
                tomes: [],
                character: null,
                weapon: { type: 'weapon', entity: mockWeapon, confidence: 0.85, rawText: '' },
            });
            mockAggregateDuplicates.mockReturnValue([
                { entity: mockItem, confidence: 0.8, count: 1 },
            ]);

            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                const content = document.getElementById('build-scan-content');
                expect(content?.innerHTML).toContain('Weapon');
            }, { timeout: 2000 });
        });

        it('should show tomes section when detected', async () => {
            const mockTome = { id: 'tome1', name: 'Test Tome 1' } as Tome;
            mockAggregateDuplicates
                .mockReturnValueOnce([])
                .mockReturnValueOnce([{ entity: mockTome, confidence: 0.75, count: 1 }]);

            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                const content = document.getElementById('build-scan-content');
                expect(content?.innerHTML).toContain('Tomes');
            }, { timeout: 2000 });
        });

        it('should apply high confidence class', async () => {
            const mockItem = { id: 'item1', name: 'Test Item 1', tier: 'common' } as Item;
            mockAggregateDuplicates.mockReturnValue([
                { entity: mockItem, confidence: 0.95, count: 1 },
            ]);

            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                const content = document.getElementById('build-scan-content');
                expect(content?.innerHTML).toContain('confidence-high');
            }, { timeout: 2000 });
        });

        it('should apply medium confidence class', async () => {
            const mockItem = { id: 'item1', name: 'Test Item 1', tier: 'common' } as Item;
            mockAggregateDuplicates.mockReturnValue([
                { entity: mockItem, confidence: 0.65, count: 1 },
            ]);

            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                const content = document.getElementById('build-scan-content');
                expect(content?.innerHTML).toContain('confidence-medium');
            }, { timeout: 2000 });
        });

        it('should apply low confidence class', async () => {
            const mockItem = { id: 'item1', name: 'Test Item 1', tier: 'common' } as Item;
            mockAggregateDuplicates.mockReturnValue([
                { entity: mockItem, confidence: 0.35, count: 1 },
            ]);

            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                const content = document.getElementById('build-scan-content');
                expect(content?.innerHTML).toContain('confidence-low');
            }, { timeout: 2000 });
        });

        it('should show apply button when items detected', async () => {
            const mockItem = { id: 'item1', name: 'Test Item 1', tier: 'common' } as Item;
            mockAggregateDuplicates.mockReturnValue([
                { entity: mockItem, confidence: 0.85, count: 1 },
            ]);

            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                const applyBtn = document.getElementById('apply-detected-build');
                expect(applyBtn).toBeTruthy();
            }, { timeout: 2000 });
        });

        it('should not show apply button when no items', async () => {
            mockAggregateDuplicates.mockReturnValue([]);

            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                const applyBtn = document.getElementById('apply-detected-build');
                expect(applyBtn).toBeNull();
            }, { timeout: 2000 });
        });

        it('should show cancel button', async () => {
            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                const cancelBtn = document.getElementById('cancel-detected-build');
                expect(cancelBtn).toBeTruthy();
            }, { timeout: 2000 });
        });

        it('should close modal when cancel clicked', async () => {
            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                const cancelBtn = document.getElementById('cancel-detected-build');
                cancelBtn?.click();
            }, { timeout: 2000 });

            const modal = document.getElementById('build-planner-scan-modal');
            expect(modal?.style.display).toBe('none');
        });

        it('should escape HTML in item names', async () => {
            const mockItem = { id: 'item1', name: '<script>xss</script>', tier: 'common' } as Item;
            mockAggregateDuplicates.mockReturnValue([
                { entity: mockItem, confidence: 0.85, count: 1 },
            ]);

            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                const content = document.getElementById('build-scan-content');
                expect(content?.innerHTML).not.toContain('<script>');
                expect(content?.innerHTML).toContain('&lt;script&gt;');
            }, { timeout: 2000 });
        });

        it('should display total item count', async () => {
            const mockItem1 = { id: 'item1', name: 'Item 1', tier: 'common' } as Item;
            const mockItem2 = { id: 'item2', name: 'Item 2', tier: 'rare' } as Item;
            mockAggregateDuplicates.mockReturnValue([
                { entity: mockItem1, confidence: 0.85, count: 3 },
                { entity: mockItem2, confidence: 0.9, count: 2 },
            ]);

            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                const content = document.getElementById('build-scan-content');
                expect(content?.innerHTML).toContain('5 items');
            }, { timeout: 2000 });
        });

        it('should display average confidence', async () => {
            const mockItem1 = { id: 'item1', name: 'Item 1', tier: 'common' } as Item;
            const mockItem2 = { id: 'item2', name: 'Item 2', tier: 'rare' } as Item;
            mockAggregateDuplicates.mockReturnValue([
                { entity: mockItem1, confidence: 0.8, count: 1 },
                { entity: mockItem2, confidence: 0.6, count: 1 },
            ]);

            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                const content = document.getElementById('build-scan-content');
                expect(content?.innerHTML).toContain('Avg confidence: 70%');
            }, { timeout: 2000 });
        });
    });

    // ========================================
    // Apply Build
    // ========================================
    describe('Apply Build', () => {
        it('should call loadBuildFromData with items', async () => {
            const mockItem = { id: 'item1', name: 'Test Item 1', tier: 'common' } as Item;
            mockAggregateDuplicates.mockReturnValue([
                { entity: mockItem, confidence: 0.85, count: 2 },
            ]);

            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                const applyBtn = document.getElementById('apply-detected-build');
                if (applyBtn) applyBtn.click();
            }, { timeout: 2000 });

            await vi.waitFor(() => {
                expect(mockLoadBuildFromData).toHaveBeenCalled();
            }, { timeout: 1000 });
        });

        it('should show success toast after applying', async () => {
            const mockItem = { id: 'item1', name: 'Test Item 1', tier: 'common' } as Item;
            mockAggregateDuplicates.mockReturnValue([
                { entity: mockItem, confidence: 0.85, count: 1 },
            ]);

            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                const applyBtn = document.getElementById('apply-detected-build');
                if (applyBtn) applyBtn.click();
            }, { timeout: 2000 });

            await vi.waitFor(() => {
                expect(ToastManager.success).toHaveBeenCalledWith(expect.stringContaining('Applied'));
            }, { timeout: 1000 });
        });

        it('should close modal after applying', async () => {
            const mockItem = { id: 'item1', name: 'Test Item 1', tier: 'common' } as Item;
            mockAggregateDuplicates.mockReturnValue([
                { entity: mockItem, confidence: 0.85, count: 1 },
            ]);

            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                const applyBtn = document.getElementById('apply-detected-build');
                if (applyBtn) applyBtn.click();
            }, { timeout: 2000 });

            await vi.waitFor(() => {
                const modal = document.getElementById('build-planner-scan-modal');
                expect(modal?.style.display).toBe('none');
            }, { timeout: 1000 });
        });

        it('should log build application', async () => {
            const mockItem = { id: 'item1', name: 'Test Item 1', tier: 'common' } as Item;
            mockAggregateDuplicates.mockReturnValue([
                { entity: mockItem, confidence: 0.85, count: 1 },
            ]);

            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                const applyBtn = document.getElementById('apply-detected-build');
                if (applyBtn) applyBtn.click();
            }, { timeout: 2000 });

            await vi.waitFor(() => {
                expect(logger.info).toHaveBeenCalledWith(
                    expect.objectContaining({ operation: 'build_planner_scan.build_applied' })
                );
            }, { timeout: 1000 });
        });

        it('should show error when no build to apply', () => {
            applyDetectedBuild();
            expect(ToastManager.error).toHaveBeenCalledWith('No detected build to apply');
        });

        it('should not call loadBuildFromData when no build', () => {
            applyDetectedBuild();
            expect(mockLoadBuildFromData).not.toHaveBeenCalled();
        });
    });

    // ========================================
    // closePreviewModal
    // ========================================
    describe('closePreviewModal Function', () => {
        it('should hide the modal', () => {
            const modal = document.getElementById('build-planner-scan-modal');
            if (modal) modal.style.display = 'flex';

            closePreviewModal();

            expect(modal?.style.display).toBe('none');
        });

        it('should not throw if modal does not exist', () => {
            expect(() => closePreviewModal()).not.toThrow();
        });

        it('should be safe to call multiple times', () => {
            closePreviewModal();
            closePreviewModal();
            closePreviewModal();
            expect(true).toBe(true);
        });

        it('should clear detected build state', async () => {
            const mockItem = { id: 'item1', name: 'Test Item 1', tier: 'common' } as Item;
            mockAggregateDuplicates.mockReturnValue([
                { entity: mockItem, confidence: 0.85, count: 1 },
            ]);

            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                closePreviewModal();
            }, { timeout: 2000 });

            applyDetectedBuild();
            expect(ToastManager.error).toHaveBeenCalledWith('No detected build to apply');
        });
    });

    // ========================================
    // CV Detection for Character/Weapon
    // ========================================
    describe('CV Detection - Character and Weapon', () => {
        it('should detect character from CV when OCR misses it', async () => {
            const mockChar = { id: 'char1', name: 'Test Character' } as Character;
            const mockItem = { id: 'item1', name: 'Item' } as Item;

            mockAutoDetectFromImage.mockResolvedValue({
                items: [],
                tomes: [],
                character: null,
                weapon: null,
            });

            mockDetectItemsWithCV.mockResolvedValue([
                { entity: mockChar, confidence: 0.9, type: 'character' },
            ]);

            mockAggregateDuplicates.mockReturnValue([
                { entity: mockItem, confidence: 0.8, count: 1 },
            ]);

            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                const content = document.getElementById('build-scan-content');
                expect(content?.innerHTML).toContain('Test Character');
            }, { timeout: 2000 });
        });

        it('should detect weapon from CV when OCR misses it', async () => {
            const mockWeapon = { id: 'weapon1', name: 'Test Weapon' } as Weapon;
            const mockItem = { id: 'item1', name: 'Item' } as Item;

            mockAutoDetectFromImage.mockResolvedValue({
                items: [],
                tomes: [],
                character: null,
                weapon: null,
            });

            mockDetectItemsWithCV.mockResolvedValue([
                { entity: mockWeapon, confidence: 0.85, type: 'weapon' },
            ]);

            mockAggregateDuplicates.mockReturnValue([
                { entity: mockItem, confidence: 0.8, count: 1 },
            ]);

            const validFile = createMockImageFile('test.png', 1024);
            triggerFileSelection(validFile);

            await vi.waitFor(() => {
                const content = document.getElementById('build-scan-content');
                expect(content?.innerHTML).toContain('Test Weapon');
            }, { timeout: 2000 });
        });
    });

    // ========================================
    // Edge Cases
    // ========================================
    describe('Edge Cases', () => {
        it('should handle empty game data', async () => {
            const emptyGameData: AllGameData = {
                items: { version: '1.0', items: [] },
                weapons: { version: '1.0', weapons: [] },
                tomes: { version: '1.0', tomes: [] },
                characters: { version: '1.0', characters: [] },
                shrines: { version: '1.0', shrines: [] },
                stats: { version: '1.0', stats: [] },
            };
            await expect(initBuildPlannerScan(emptyGameData)).resolves.not.toThrow();
        });

        it('should handle special characters in filenames', async () => {
            const specialFile = new File(['data'], 'test <file> (1).png', { type: 'image/png' });
            triggerFileSelection(specialFile);

            await vi.waitFor(() => {
                const modal = document.getElementById('build-planner-scan-modal');
                expect(modal?.style.display).toBe('flex');
            }, { timeout: 2000 });
        });

        it('should handle unicode filenames', async () => {
            const unicodeFile = new File(['data'], '测试_тест_🎮.png', { type: 'image/png' });
            triggerFileSelection(unicodeFile);

            await vi.waitFor(() => {
                expect(logger.info).toHaveBeenCalled();
            }, { timeout: 2000 });
        });
    });

    // ========================================
    // Module Exports
    // ========================================
    describe('Module Exports', () => {
        it('should export initBuildPlannerScan function', () => {
            expect(typeof initBuildPlannerScan).toBe('function');
        });

        it('should export closePreviewModal function', () => {
            expect(typeof closePreviewModal).toBe('function');
        });

        it('should export applyDetectedBuild function', () => {
            expect(typeof applyDetectedBuild).toBe('function');
        });
    });
});
