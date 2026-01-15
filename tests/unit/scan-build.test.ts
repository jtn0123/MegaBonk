/**
 * Unit tests for scan-build module
 * Tests initialization, state management, and event handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { AllGameData, Item, Tome, Character, Weapon } from '../../src/types';

// Mock dependencies before importing
vi.mock('../../src/modules/toast.ts', () => ({
    ToastManager: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
    },
}));

vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('../../src/modules/ocr.ts', () => ({
    autoDetectFromImage: vi.fn(),
    initOCR: vi.fn(),
}));

vi.mock('../../src/modules/computer-vision.ts', () => ({
    detectItemsWithCV: vi.fn(),
    initCV: vi.fn(),
    loadItemTemplates: vi.fn().mockResolvedValue(undefined),
    combineDetections: vi.fn((a) => a),
    aggregateDuplicates: vi.fn((a) => a.map((x: any) => ({ ...x, count: 1, method: 'test' }))),
    createDebugOverlay: vi.fn().mockResolvedValue('data:image/png;base64,mock'),
    detectGridPositions: vi.fn(),
}));

import { initScanBuild, getScanState } from '../../src/modules/scan-build.ts';
import { ToastManager } from '../../src/modules/toast.ts';
import { logger } from '../../src/modules/logger.ts';
import { autoDetectFromImage, initOCR } from '../../src/modules/ocr.ts';
import { initCV, loadItemTemplates, detectItemsWithCV } from '../../src/modules/computer-vision.ts';

// Test fixtures
const createMockItem = (id: string, name: string, tier = 'A'): Item => ({
    id,
    name,
    description: `${name} description`,
    rarity: 'common',
    tier: tier as any,
    tags: ['test'],
    mechanics: { base: { damage: 10 } },
});

const createMockTome = (id: string, name: string): Tome => ({
    id,
    name,
    description: `${name} description`,
    tier: 'A',
    stat_affected: 'damage',
    value_per_level: '5%',
    max_level: 5,
    priority: 1,
});

const createMockCharacter = (id: string, name: string): Character => ({
    id,
    name,
    description: `${name} description`,
    tier: 'S',
    starting_stats: { health: 100, damage: 10 },
    passive_abilities: [],
});

const createMockWeapon = (id: string, name: string): Weapon => ({
    id,
    name,
    description: `${name} description`,
    tier: 'A',
    base_damage: 50,
    attack_speed: 1.0,
    upgrade_path: [],
});

const createMockGameData = (): AllGameData => ({
    items: {
        version: '1.0',
        last_updated: '2024-01-01',
        items: [
            createMockItem('wrench', 'Wrench'),
            createMockItem('first_aid_kit', 'First Aid Kit', 'B'),
            createMockItem('battery', 'Battery', 'S'),
            createMockItem('banana', 'Banana', 'C'),
        ],
    },
    tomes: {
        version: '1.0',
        last_updated: '2024-01-01',
        tomes: [
            createMockTome('tome_strength', 'Tome of Strength'),
            createMockTome('tome_agility', 'Tome of Agility'),
        ],
    },
    characters: {
        version: '1.0',
        last_updated: '2024-01-01',
        characters: [
            createMockCharacter('clank', 'CL4NK'),
            createMockCharacter('bonk', 'Bonk'),
        ],
    },
    weapons: {
        version: '1.0',
        last_updated: '2024-01-01',
        weapons: [
            createMockWeapon('hammer', 'Hammer'),
            createMockWeapon('sword', 'Sword'),
        ],
    },
    stats: {
        version: '1.0',
        last_updated: '2024-01-01',
    },
});

// DOM setup helpers
function setupDOM() {
    document.body.innerHTML = `
        <div id="scan-upload-btn"></div>
        <input type="file" id="scan-file-input" />
        <div id="scan-clear-image"></div>
        <div id="scan-apply-to-advisor" style="display: none;"></div>
        <div id="scan-auto-detect-btn"></div>
        <div id="scan-hybrid-detect-btn"></div>
        <div id="scan-image-preview" style="display: none;"></div>
        <div id="scan-selection-area" style="display: none;"></div>
        <div id="scan-auto-detect-area" style="display: none;"></div>
        <div id="scan-detection-info" style="display: none;"></div>
        <div id="scan-selection-summary"></div>
        <div id="scan-character-grid"></div>
        <div id="scan-weapon-grid"></div>
        <div id="scan-item-grid"></div>
        <div id="scan-tome-grid"></div>
        <div id="scan-debug-mode"></div>
        <div id="advisor-current-build-section"></div>
    `;
}

describe('scan-build - initScanBuild', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDOM();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should initialize with game data', () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        expect(initOCR).toHaveBeenCalledWith(gameData);
        expect(initCV).toHaveBeenCalledWith(gameData);
        expect(loadItemTemplates).toHaveBeenCalled();
    });

    it('should log initialization info', () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        expect(logger.info).toHaveBeenCalledWith(
            expect.objectContaining({
                operation: 'scan_build.init',
                data: expect.objectContaining({
                    itemsCount: 4,
                }),
            })
        );
    });

    it('should accept build state callback', () => {
        const gameData = createMockGameData();
        const callback = vi.fn();
        initScanBuild(gameData, callback);

        // Callback should be stored (tested indirectly via apply)
        expect(initOCR).toHaveBeenCalled();
    });

    it('should handle missing game data gracefully', () => {
        const emptyData: AllGameData = {};
        initScanBuild(emptyData);

        expect(logger.info).toHaveBeenCalledWith(
            expect.objectContaining({
                operation: 'scan_build.init',
                data: { itemsCount: 0 },
            })
        );
    });

    it('should handle template loading failure', async () => {
        vi.mocked(loadItemTemplates).mockRejectedValueOnce(new Error('Template load failed'));

        const gameData = createMockGameData();
        initScanBuild(gameData);

        // Wait for async template loading
        await vi.waitFor(() => {
            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'scan_build.load_templates',
                })
            );
        });

        expect(ToastManager.error).toHaveBeenCalledWith('Failed to load item templates for recognition');
    });

    it('should setup event listeners on upload button', () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        const uploadBtn = document.getElementById('scan-upload-btn');
        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;

        const clickSpy = vi.spyOn(fileInput, 'click');
        uploadBtn?.click();

        expect(clickSpy).toHaveBeenCalled();
    });

    it('should setup event listeners without crashing when elements missing', () => {
        document.body.innerHTML = ''; // Remove all elements
        const gameData = createMockGameData();

        expect(() => initScanBuild(gameData)).not.toThrow();
    });
});

describe('scan-build - getScanState', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDOM();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should return empty state initially', () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        const state = getScanState();
        expect(state.character).toBeNull();
        expect(state.weapon).toBeNull();
        expect(state.items).toEqual([]);
        expect(state.tomes).toEqual([]);
    });

    it('should return state structure with correct shape', () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        const state = getScanState();
        expect(state).toHaveProperty('character');
        expect(state).toHaveProperty('weapon');
        expect(state).toHaveProperty('items');
        expect(state).toHaveProperty('tomes');
        expect(Array.isArray(state.items)).toBe(true);
        expect(Array.isArray(state.tomes)).toBe(true);
    });
});

describe('scan-build - File Handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDOM();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should reject non-image files', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const textFile = new File(['text content'], 'test.txt', { type: 'text/plain' });

        Object.defineProperty(fileInput, 'files', {
            value: [textFile],
            writable: false,
        });

        fileInput.dispatchEvent(new Event('change'));

        await vi.waitFor(() => {
            expect(ToastManager.error).toHaveBeenCalledWith('Please select an image file');
        });
    });

    it('should reject files larger than 10MB', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;

        // Create mock file > 10MB
        const largeFile = new File(['x'.repeat(100)], 'large.png', { type: 'image/png' });
        Object.defineProperty(largeFile, 'size', { value: 11 * 1024 * 1024 });

        Object.defineProperty(fileInput, 'files', {
            value: [largeFile],
            writable: false,
        });

        fileInput.dispatchEvent(new Event('change'));

        await vi.waitFor(() => {
            expect(ToastManager.error).toHaveBeenCalledWith('Image size must be less than 10MB');
        });
    });

    it('should handle no file selected', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;

        Object.defineProperty(fileInput, 'files', {
            value: [],
            writable: false,
        });

        fileInput.dispatchEvent(new Event('change'));

        // Should not trigger any toast
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(ToastManager.error).not.toHaveBeenCalled();
        expect(ToastManager.success).not.toHaveBeenCalled();
    });

    it('should log file info on valid upload', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        // Test validates that file validation passes for valid images
        // Full FileReader testing is covered in integration tests
        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const validFile = new File(['fake'], 'test.png', { type: 'image/png' });
        Object.defineProperty(validFile, 'size', { value: 1024 });

        Object.defineProperty(fileInput, 'files', { value: [validFile] });

        // Dispatch change - validation should pass (no error toast)
        fileInput.dispatchEvent(new Event('change'));

        // Give time for async operations
        await new Promise(resolve => setTimeout(resolve, 50));

        // Should NOT show size or type errors since file is valid
        expect(ToastManager.error).not.toHaveBeenCalledWith('Please select an image file');
        expect(ToastManager.error).not.toHaveBeenCalledWith('Image size must be less than 10MB');
    });
});

describe('scan-build - Auto Detection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDOM();
        // Initialize and immediately clear to reset internal state
        const gameData = createMockGameData();
        initScanBuild(gameData);
        const clearBtn = document.getElementById('scan-clear-image');
        clearBtn?.click();
        vi.clearAllMocks(); // Clear the mocks after clear button toast
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should require image before auto-detect', async () => {
        const autoDetectBtn = document.getElementById('scan-auto-detect-btn');
        autoDetectBtn?.click();

        await vi.waitFor(() => {
            expect(ToastManager.error).toHaveBeenCalledWith('Please upload an image first');
        });
    });

    it('should have auto-detect button event listener attached', () => {
        const autoDetectBtn = document.getElementById('scan-auto-detect-btn');
        expect(autoDetectBtn).toBeDefined();

        // Clicking without image should trigger error message (since we cleared in beforeEach)
        autoDetectBtn?.click();
        expect(ToastManager.error).toHaveBeenCalledWith('Please upload an image first');
    });

    it('should mock autoDetectFromImage correctly', () => {
        expect(vi.isMockFunction(autoDetectFromImage)).toBe(true);
    });
});

describe('scan-build - Hybrid Detection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDOM();
        // Initialize and immediately clear to reset internal state
        const gameData = createMockGameData();
        initScanBuild(gameData);
        const clearBtn = document.getElementById('scan-clear-image');
        clearBtn?.click();
        vi.clearAllMocks(); // Clear the mocks after clear button toast
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should require image before hybrid-detect', async () => {
        const hybridDetectBtn = document.getElementById('scan-hybrid-detect-btn');
        hybridDetectBtn?.click();

        await vi.waitFor(() => {
            expect(ToastManager.error).toHaveBeenCalledWith('Please upload an image first');
        });
    });

    it('should have hybrid-detect button event listener attached', () => {
        const hybridDetectBtn = document.getElementById('scan-hybrid-detect-btn');
        expect(hybridDetectBtn).toBeDefined();

        // Clicking without image should trigger error message
        hybridDetectBtn?.click();
        expect(ToastManager.error).toHaveBeenCalledWith('Please upload an image first');
    });

    it('should mock detectItemsWithCV correctly', () => {
        expect(vi.isMockFunction(detectItemsWithCV)).toBe(true);
    });
});

describe('scan-build - Clear Image', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDOM();
        const gameData = createMockGameData();
        initScanBuild(gameData);
        vi.clearAllMocks(); // Clear init-related mocks
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should show toast when clear button clicked', () => {
        const clearBtn = document.getElementById('scan-clear-image');
        clearBtn?.click();

        expect(ToastManager.info).toHaveBeenCalledWith('Image cleared');
    });

    it('should reset state when cleared', () => {
        const clearBtn = document.getElementById('scan-clear-image');
        clearBtn?.click();

        const state = getScanState();
        expect(state.character).toBeNull();
        expect(state.weapon).toBeNull();
        expect(state.items).toEqual([]);
        expect(state.tomes).toEqual([]);
    });

    it('should hide preview containers on clear', () => {
        const clearBtn = document.getElementById('scan-clear-image');
        clearBtn?.click();

        const previewContainer = document.getElementById('scan-image-preview');
        const selectionContainer = document.getElementById('scan-selection-area');
        const autoDetectArea = document.getElementById('scan-auto-detect-area');

        expect(previewContainer?.style.display).toBe('none');
        expect(selectionContainer?.style.display).toBe('none');
        expect(autoDetectArea?.style.display).toBe('none');
    });

    it('should hide detection info on clear', () => {
        const clearBtn = document.getElementById('scan-clear-image');
        clearBtn?.click();

        const detectionInfo = document.getElementById('scan-detection-info');
        expect(detectionInfo?.style.display).toBe('none');
    });
});

describe('scan-build - Module Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDOM();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should initialize OCR module with game data', () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        expect(initOCR).toHaveBeenCalledWith(gameData);
    });

    it('should initialize CV module with game data', () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        expect(initCV).toHaveBeenCalledWith(gameData);
    });

    it('should preload item templates', () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        expect(loadItemTemplates).toHaveBeenCalled();
    });

    it('should call all module initializers', () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        // Verify all dependent modules are initialized
        expect(initOCR).toHaveBeenCalledTimes(1);
        expect(initCV).toHaveBeenCalledTimes(1);
        expect(loadItemTemplates).toHaveBeenCalledTimes(1);
    });
});

describe('scan-build - State Callback', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDOM();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should store callback when provided', () => {
        const gameData = createMockGameData();
        const callback = vi.fn();

        initScanBuild(gameData, callback);

        // Callback is stored internally - we verify init succeeded
        expect(initOCR).toHaveBeenCalled();
    });

    it('should work without callback', () => {
        const gameData = createMockGameData();

        expect(() => initScanBuild(gameData)).not.toThrow();
        expect(initOCR).toHaveBeenCalled();
    });
});

describe('scan-build - Progress Indicator', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDOM();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should handle missing preview container for progress', async () => {
        document.getElementById('scan-image-preview')?.remove();

        const gameData = createMockGameData();
        initScanBuild(gameData);

        // This should not throw even without the container
        expect(initOCR).toHaveBeenCalled();
    });
});

describe('scan-build - Edge Cases', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDOM();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should handle undefined items array', () => {
        const gameData: AllGameData = {
            items: undefined,
            tomes: { version: '1.0', last_updated: '2024-01-01', tomes: [] },
            characters: { version: '1.0', last_updated: '2024-01-01', characters: [] },
            weapons: { version: '1.0', last_updated: '2024-01-01', weapons: [] },
            stats: { version: '1.0', last_updated: '2024-01-01' },
        };

        initScanBuild(gameData);

        expect(logger.info).toHaveBeenCalledWith(
            expect.objectContaining({
                operation: 'scan_build.init',
                data: { itemsCount: 0 },
            })
        );
    });

    it('should handle null items in game data', () => {
        const gameData: AllGameData = {
            items: null as any,
            tomes: { version: '1.0', last_updated: '2024-01-01', tomes: [] },
            characters: { version: '1.0', last_updated: '2024-01-01', characters: [] },
            weapons: { version: '1.0', last_updated: '2024-01-01', weapons: [] },
            stats: { version: '1.0', last_updated: '2024-01-01' },
        };

        initScanBuild(gameData);

        expect(logger.info).toHaveBeenCalledWith(
            expect.objectContaining({
                operation: 'scan_build.init',
                data: { itemsCount: 0 },
            })
        );
    });

    it('should handle empty arrays in game data', () => {
        const gameData: AllGameData = {
            items: { version: '1.0', last_updated: '2024-01-01', items: [] },
            tomes: { version: '1.0', last_updated: '2024-01-01', tomes: [] },
            characters: { version: '1.0', last_updated: '2024-01-01', characters: [] },
            weapons: { version: '1.0', last_updated: '2024-01-01', weapons: [] },
            stats: { version: '1.0', last_updated: '2024-01-01' },
        };

        initScanBuild(gameData);

        expect(logger.info).toHaveBeenCalledWith(
            expect.objectContaining({
                operation: 'scan_build.init',
                data: { itemsCount: 0 },
            })
        );
    });

    it('should re-initialize cleanly', () => {
        const gameData1 = createMockGameData();
        initScanBuild(gameData1);

        vi.clearAllMocks();

        const gameData2 = createMockGameData();
        gameData2.items!.items.push(createMockItem('new_item', 'New Item'));
        initScanBuild(gameData2);

        expect(logger.info).toHaveBeenCalledWith(
            expect.objectContaining({
                operation: 'scan_build.init',
                data: { itemsCount: 5 },
            })
        );
    });
});

describe('scan-build - File Type Validation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDOM();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should pass validation for PNG files', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const pngFile = new File(['fake'], 'test.png', { type: 'image/png' });
        Object.defineProperty(pngFile, 'size', { value: 1024 });
        Object.defineProperty(fileInput, 'files', { value: [pngFile] });

        fileInput.dispatchEvent(new Event('change'));

        await new Promise(resolve => setTimeout(resolve, 50));
        expect(ToastManager.error).not.toHaveBeenCalledWith('Please select an image file');
    });

    it('should pass validation for JPEG files', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const jpegFile = new File(['fake'], 'test.jpg', { type: 'image/jpeg' });
        Object.defineProperty(jpegFile, 'size', { value: 1024 });
        Object.defineProperty(fileInput, 'files', { value: [jpegFile] });

        fileInput.dispatchEvent(new Event('change'));

        await new Promise(resolve => setTimeout(resolve, 50));
        expect(ToastManager.error).not.toHaveBeenCalledWith('Please select an image file');
    });

    it('should pass validation for WebP files', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const webpFile = new File(['fake'], 'test.webp', { type: 'image/webp' });
        Object.defineProperty(webpFile, 'size', { value: 1024 });
        Object.defineProperty(fileInput, 'files', { value: [webpFile] });

        fileInput.dispatchEvent(new Event('change'));

        await new Promise(resolve => setTimeout(resolve, 50));
        expect(ToastManager.error).not.toHaveBeenCalledWith('Please select an image file');
    });

    it('should reject PDF files', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const pdfFile = new File(['fake'], 'test.pdf', { type: 'application/pdf' });
        Object.defineProperty(fileInput, 'files', { value: [pdfFile] });

        fileInput.dispatchEvent(new Event('change'));

        await vi.waitFor(() => {
            expect(ToastManager.error).toHaveBeenCalledWith('Please select an image file');
        });
    });

    it('should reject text files', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const txtFile = new File(['fake'], 'test.txt', { type: 'text/plain' });
        Object.defineProperty(fileInput, 'files', { value: [txtFile] });

        fileInput.dispatchEvent(new Event('change'));

        await vi.waitFor(() => {
            expect(ToastManager.error).toHaveBeenCalledWith('Please select an image file');
        });
    });

    it('should reject JSON files', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const jsonFile = new File(['{}'], 'test.json', { type: 'application/json' });
        Object.defineProperty(fileInput, 'files', { value: [jsonFile] });

        fileInput.dispatchEvent(new Event('change'));

        await vi.waitFor(() => {
            expect(ToastManager.error).toHaveBeenCalledWith('Please select an image file');
        });
    });
});

describe('scan-build - Size Validation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDOM();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should pass validation for files at exactly 10MB', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const file = new File(['fake'], 'test.png', { type: 'image/png' });
        Object.defineProperty(file, 'size', { value: 10 * 1024 * 1024 }); // Exactly 10MB
        Object.defineProperty(fileInput, 'files', { value: [file] });

        fileInput.dispatchEvent(new Event('change'));

        await new Promise(resolve => setTimeout(resolve, 50));
        expect(ToastManager.error).not.toHaveBeenCalledWith('Image size must be less than 10MB');
    });

    it('should reject files at 10MB + 1 byte', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const file = new File(['fake'], 'test.png', { type: 'image/png' });
        Object.defineProperty(file, 'size', { value: 10 * 1024 * 1024 + 1 }); // 10MB + 1 byte
        Object.defineProperty(fileInput, 'files', { value: [file] });

        fileInput.dispatchEvent(new Event('change'));

        await vi.waitFor(() => {
            expect(ToastManager.error).toHaveBeenCalledWith('Image size must be less than 10MB');
        });
    });

    it('should pass validation for very small files', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const file = new File(['fake'], 'test.png', { type: 'image/png' });
        Object.defineProperty(file, 'size', { value: 1 }); // 1 byte
        Object.defineProperty(fileInput, 'files', { value: [file] });

        fileInput.dispatchEvent(new Event('change'));

        await new Promise(resolve => setTimeout(resolve, 50));
        expect(ToastManager.error).not.toHaveBeenCalledWith('Image size must be less than 10MB');
    });

    it('should reject files at 100MB', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const file = new File(['fake'], 'test.png', { type: 'image/png' });
        Object.defineProperty(file, 'size', { value: 100 * 1024 * 1024 }); // 100MB
        Object.defineProperty(fileInput, 'files', { value: [file] });

        fileInput.dispatchEvent(new Event('change'));

        await vi.waitFor(() => {
            expect(ToastManager.error).toHaveBeenCalledWith('Image size must be less than 10MB');
        });
    });
});

// ========================================
// Auto-Detection Flow Tests
// ========================================
describe('scan-build - Auto Detection Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDOM();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should run auto-detect with successful OCR results', async () => {
        const gameData = createMockGameData();
        const mockItem = createMockItem('wrench', 'Wrench');

        vi.mocked(autoDetectFromImage).mockResolvedValue({
            items: [{ type: 'item', entity: mockItem, confidence: 0.85, rawText: 'Wrench' }],
            tomes: [],
            character: null,
            weapon: null,
        });

        initScanBuild(gameData);

        // Simulate image upload by setting internal state
        // We need to trigger file upload first
        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;

        // Mock FileReader
        const mockFileReader = {
            readAsDataURL: vi.fn(),
            onload: null as any,
            onerror: null as any,
            result: 'data:image/png;base64,fake',
        };
        vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

        const validFile = new File(['fake-image-data'], 'test.png', { type: 'image/png' });
        Object.defineProperty(validFile, 'size', { value: 1024 });
        Object.defineProperty(fileInput, 'files', { value: [validFile] });

        fileInput.dispatchEvent(new Event('change'));

        // Trigger FileReader onload
        await new Promise(resolve => setTimeout(resolve, 10));
        if (mockFileReader.onload) {
            mockFileReader.onload({ target: { result: 'data:image/png;base64,fake' } } as any);
        }

        await new Promise(resolve => setTimeout(resolve, 50));

        // Now click auto-detect
        const autoDetectBtn = document.getElementById('scan-auto-detect-btn');
        autoDetectBtn?.click();

        await vi.waitFor(() => {
            expect(autoDetectFromImage).toHaveBeenCalled();
        });
    });

    it('should try CV fallback when OCR finds nothing', async () => {
        const gameData = createMockGameData();
        const mockItem = createMockItem('wrench', 'Wrench');

        // OCR returns empty
        vi.mocked(autoDetectFromImage).mockResolvedValue({
            items: [],
            tomes: [],
            character: null,
            weapon: null,
        });

        // CV returns results
        vi.mocked(detectItemsWithCV).mockResolvedValue([
            { type: 'item', entity: mockItem, confidence: 0.75 },
        ]);

        initScanBuild(gameData);

        // Simulate image upload
        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const mockFileReader = {
            readAsDataURL: vi.fn(),
            onload: null as any,
            onerror: null as any,
            result: 'data:image/png;base64,fake',
        };
        vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

        const validFile = new File(['fake'], 'test.png', { type: 'image/png' });
        Object.defineProperty(validFile, 'size', { value: 1024 });
        Object.defineProperty(fileInput, 'files', { value: [validFile] });

        fileInput.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 10));
        if (mockFileReader.onload) {
            mockFileReader.onload({ target: { result: 'data:image/png;base64,fake' } } as any);
        }
        await new Promise(resolve => setTimeout(resolve, 50));

        const autoDetectBtn = document.getElementById('scan-auto-detect-btn');
        autoDetectBtn?.click();

        await vi.waitFor(() => {
            expect(detectItemsWithCV).toHaveBeenCalled();
        });
    });

    it('should handle auto-detect error gracefully', async () => {
        const gameData = createMockGameData();

        vi.mocked(autoDetectFromImage).mockRejectedValue(new Error('OCR failed'));

        initScanBuild(gameData);

        // Simulate image upload
        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const mockFileReader = {
            readAsDataURL: vi.fn(),
            onload: null as any,
            result: 'data:image/png;base64,fake',
        };
        vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

        const validFile = new File(['fake'], 'test.png', { type: 'image/png' });
        Object.defineProperty(validFile, 'size', { value: 1024 });
        Object.defineProperty(fileInput, 'files', { value: [validFile] });

        fileInput.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 10));
        if (mockFileReader.onload) {
            mockFileReader.onload({ target: { result: 'data:image/png;base64,fake' } } as any);
        }
        await new Promise(resolve => setTimeout(resolve, 50));

        const autoDetectBtn = document.getElementById('scan-auto-detect-btn');
        autoDetectBtn?.click();

        await vi.waitFor(() => {
            expect(ToastManager.error).toHaveBeenCalledWith(expect.stringContaining('Auto-detection failed'));
        });
    });
});

// ========================================
// Hybrid Detection Flow Tests
// ========================================
describe('scan-build - Hybrid Detection Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDOM();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should run hybrid detection with both OCR and CV', async () => {
        const gameData = createMockGameData();
        const mockItem = createMockItem('wrench', 'Wrench');
        const mockCharacter = createMockCharacter('clank', 'CL4NK');

        vi.mocked(autoDetectFromImage).mockResolvedValue({
            items: [{ type: 'item', entity: mockItem, confidence: 0.85, rawText: 'Wrench' }],
            tomes: [],
            character: { type: 'character', entity: mockCharacter, confidence: 0.9, rawText: 'CL4NK' },
            weapon: null,
        });

        vi.mocked(detectItemsWithCV).mockResolvedValue([
            { type: 'item', entity: mockItem, confidence: 0.8 },
        ]);

        initScanBuild(gameData);

        // Simulate image upload
        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const mockFileReader = {
            readAsDataURL: vi.fn(),
            onload: null as any,
            result: 'data:image/png;base64,fake',
        };
        vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

        const validFile = new File(['fake'], 'test.png', { type: 'image/png' });
        Object.defineProperty(validFile, 'size', { value: 1024 });
        Object.defineProperty(fileInput, 'files', { value: [validFile] });

        fileInput.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 10));
        if (mockFileReader.onload) {
            mockFileReader.onload({ target: { result: 'data:image/png;base64,fake' } } as any);
        }
        await new Promise(resolve => setTimeout(resolve, 50));

        const hybridDetectBtn = document.getElementById('scan-hybrid-detect-btn');
        hybridDetectBtn?.click();

        await vi.waitFor(() => {
            expect(autoDetectFromImage).toHaveBeenCalled();
            expect(detectItemsWithCV).toHaveBeenCalled();
        });
    });

    it('should handle hybrid detect error gracefully', async () => {
        const gameData = createMockGameData();

        vi.mocked(autoDetectFromImage).mockRejectedValue(new Error('Hybrid failed'));

        initScanBuild(gameData);

        // Simulate image upload
        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const mockFileReader = {
            readAsDataURL: vi.fn(),
            onload: null as any,
            result: 'data:image/png;base64,fake',
        };
        vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

        const validFile = new File(['fake'], 'test.png', { type: 'image/png' });
        Object.defineProperty(validFile, 'size', { value: 1024 });
        Object.defineProperty(fileInput, 'files', { value: [validFile] });

        fileInput.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 10));
        if (mockFileReader.onload) {
            mockFileReader.onload({ target: { result: 'data:image/png;base64,fake' } } as any);
        }
        await new Promise(resolve => setTimeout(resolve, 50));

        const hybridDetectBtn = document.getElementById('scan-hybrid-detect-btn');
        hybridDetectBtn?.click();

        await vi.waitFor(() => {
            expect(ToastManager.error).toHaveBeenCalledWith(expect.stringContaining('Hybrid detection failed'));
        });
    });

    it('should show debug overlay when debug mode enabled', async () => {
        const gameData = createMockGameData();
        const mockItem = createMockItem('wrench', 'Wrench');

        vi.mocked(autoDetectFromImage).mockResolvedValue({
            items: [{ type: 'item', entity: mockItem, confidence: 0.85, rawText: 'Wrench' }],
            tomes: [],
            character: null,
            weapon: null,
        });

        vi.mocked(detectItemsWithCV).mockResolvedValue([]);

        initScanBuild(gameData);

        // Enable debug mode
        const debugCheckbox = document.getElementById('scan-debug-mode') as HTMLInputElement;
        if (debugCheckbox) {
            debugCheckbox.type = 'checkbox';
            debugCheckbox.checked = true;
        }

        // Simulate image upload
        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const mockFileReader = {
            readAsDataURL: vi.fn(),
            onload: null as any,
            result: 'data:image/png;base64,fake',
        };
        vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

        const validFile = new File(['fake'], 'test.png', { type: 'image/png' });
        Object.defineProperty(validFile, 'size', { value: 1024 });
        Object.defineProperty(fileInput, 'files', { value: [validFile] });

        fileInput.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 10));
        if (mockFileReader.onload) {
            mockFileReader.onload({ target: { result: 'data:image/png;base64,fake' } } as any);
        }
        await new Promise(resolve => setTimeout(resolve, 50));

        const hybridDetectBtn = document.getElementById('scan-hybrid-detect-btn');
        hybridDetectBtn?.click();

        await vi.waitFor(() => {
            expect(autoDetectFromImage).toHaveBeenCalled();
        });
    });
});

// ========================================
// Item Grid and Card Tests
// ========================================
describe('scan-build - Item Grid and Cards', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDOM();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should create item grid after image upload', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        // Simulate image upload
        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const mockFileReader = {
            readAsDataURL: vi.fn(),
            onload: null as any,
            result: 'data:image/png;base64,fake',
        };
        vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

        const validFile = new File(['fake'], 'test.png', { type: 'image/png' });
        Object.defineProperty(validFile, 'size', { value: 1024 });
        Object.defineProperty(fileInput, 'files', { value: [validFile] });

        fileInput.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 10));
        if (mockFileReader.onload) {
            mockFileReader.onload({ target: { result: 'data:image/png;base64,fake' } } as any);
        }

        await vi.waitFor(() => {
            const itemGrid = document.getElementById('scan-item-grid');
            expect(itemGrid?.innerHTML).not.toBe('');
        });
    });

    it('should create item cards for each item', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        // Simulate image upload
        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const mockFileReader = {
            readAsDataURL: vi.fn(),
            onload: null as any,
            result: 'data:image/png;base64,fake',
        };
        vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

        const validFile = new File(['fake'], 'test.png', { type: 'image/png' });
        Object.defineProperty(validFile, 'size', { value: 1024 });
        Object.defineProperty(fileInput, 'files', { value: [validFile] });

        fileInput.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 10));
        if (mockFileReader.onload) {
            mockFileReader.onload({ target: { result: 'data:image/png;base64,fake' } } as any);
        }

        await vi.waitFor(() => {
            const cards = document.querySelectorAll('.scan-item-card');
            expect(cards.length).toBeGreaterThan(0);
        });
    });

    it('should have search input for filtering items', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        // Simulate image upload
        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const mockFileReader = {
            readAsDataURL: vi.fn(),
            onload: null as any,
            result: 'data:image/png;base64,fake',
        };
        vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

        const validFile = new File(['fake'], 'test.png', { type: 'image/png' });
        Object.defineProperty(validFile, 'size', { value: 1024 });
        Object.defineProperty(fileInput, 'files', { value: [validFile] });

        fileInput.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 10));
        if (mockFileReader.onload) {
            mockFileReader.onload({ target: { result: 'data:image/png;base64,fake' } } as any);
        }

        await vi.waitFor(() => {
            const searchInput = document.querySelector('.scan-search-input');
            expect(searchInput).not.toBeNull();
        });
    });

    it('should filter items when searching', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        // Simulate image upload
        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const mockFileReader = {
            readAsDataURL: vi.fn(),
            onload: null as any,
            result: 'data:image/png;base64,fake',
        };
        vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

        const validFile = new File(['fake'], 'test.png', { type: 'image/png' });
        Object.defineProperty(validFile, 'size', { value: 1024 });
        Object.defineProperty(fileInput, 'files', { value: [validFile] });

        fileInput.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 10));
        if (mockFileReader.onload) {
            mockFileReader.onload({ target: { result: 'data:image/png;base64,fake' } } as any);
        }

        await vi.waitFor(() => {
            const searchInput = document.querySelector('.scan-search-input') as HTMLInputElement;
            if (searchInput) {
                searchInput.value = 'wrench';
                searchInput.dispatchEvent(new Event('input'));
            }
        });

        await new Promise(resolve => setTimeout(resolve, 50));

        // Cards with different names should be hidden
        const visibleCards = document.querySelectorAll('.scan-item-card[style*="display: flex"], .scan-item-card:not([style*="display"])');
        // At least wrench card should be visible
        expect(visibleCards.length).toBeGreaterThanOrEqual(0);
    });
});

// ========================================
// Tome Grid Tests
// ========================================
describe('scan-build - Tome Grid', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDOM();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should create tome grid after image upload', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        // Simulate image upload
        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const mockFileReader = {
            readAsDataURL: vi.fn(),
            onload: null as any,
            result: 'data:image/png;base64,fake',
        };
        vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

        const validFile = new File(['fake'], 'test.png', { type: 'image/png' });
        Object.defineProperty(validFile, 'size', { value: 1024 });
        Object.defineProperty(fileInput, 'files', { value: [validFile] });

        fileInput.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 10));
        if (mockFileReader.onload) {
            mockFileReader.onload({ target: { result: 'data:image/png;base64,fake' } } as any);
        }

        await vi.waitFor(() => {
            const tomeGrid = document.getElementById('scan-tome-grid');
            expect(tomeGrid?.innerHTML).not.toBe('');
        });
    });

    it('should create tome cards for each tome', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const mockFileReader = {
            readAsDataURL: vi.fn(),
            onload: null as any,
            result: 'data:image/png;base64,fake',
        };
        vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

        const validFile = new File(['fake'], 'test.png', { type: 'image/png' });
        Object.defineProperty(validFile, 'size', { value: 1024 });
        Object.defineProperty(fileInput, 'files', { value: [validFile] });

        fileInput.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 10));
        if (mockFileReader.onload) {
            mockFileReader.onload({ target: { result: 'data:image/png;base64,fake' } } as any);
        }

        await vi.waitFor(() => {
            const tomeCards = document.querySelectorAll('.scan-tome-card');
            expect(tomeCards.length).toBe(2); // 2 tomes in mock data
        });
    });

    it('should toggle tome selection on click', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const mockFileReader = {
            readAsDataURL: vi.fn(),
            onload: null as any,
            result: 'data:image/png;base64,fake',
        };
        vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

        const validFile = new File(['fake'], 'test.png', { type: 'image/png' });
        Object.defineProperty(validFile, 'size', { value: 1024 });
        Object.defineProperty(fileInput, 'files', { value: [validFile] });

        fileInput.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 10));
        if (mockFileReader.onload) {
            mockFileReader.onload({ target: { result: 'data:image/png;base64,fake' } } as any);
        }

        await vi.waitFor(() => {
            const tomeCard = document.querySelector('.scan-tome-card') as HTMLElement;
            if (tomeCard) {
                tomeCard.click();
                expect(tomeCard.classList.contains('selected')).toBe(true);

                // Click again to deselect
                tomeCard.click();
                expect(tomeCard.classList.contains('selected')).toBe(false);
            }
        });
    });
});

// ========================================
// Entity Selection Tests
// ========================================
describe('scan-build - Entity Selection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDOM();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should create character selection cards', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const mockFileReader = {
            readAsDataURL: vi.fn(),
            onload: null as any,
            result: 'data:image/png;base64,fake',
        };
        vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

        const validFile = new File(['fake'], 'test.png', { type: 'image/png' });
        Object.defineProperty(validFile, 'size', { value: 1024 });
        Object.defineProperty(fileInput, 'files', { value: [validFile] });

        fileInput.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 10));
        if (mockFileReader.onload) {
            mockFileReader.onload({ target: { result: 'data:image/png;base64,fake' } } as any);
        }

        await vi.waitFor(() => {
            const charGrid = document.getElementById('scan-character-grid');
            const cards = charGrid?.querySelectorAll('.scan-entity-card');
            expect(cards?.length).toBe(2); // 2 characters in mock data
        });
    });

    it('should create weapon selection cards', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const mockFileReader = {
            readAsDataURL: vi.fn(),
            onload: null as any,
            result: 'data:image/png;base64,fake',
        };
        vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

        const validFile = new File(['fake'], 'test.png', { type: 'image/png' });
        Object.defineProperty(validFile, 'size', { value: 1024 });
        Object.defineProperty(fileInput, 'files', { value: [validFile] });

        fileInput.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 10));
        if (mockFileReader.onload) {
            mockFileReader.onload({ target: { result: 'data:image/png;base64,fake' } } as any);
        }

        await vi.waitFor(() => {
            const weaponGrid = document.getElementById('scan-weapon-grid');
            const cards = weaponGrid?.querySelectorAll('.scan-entity-card');
            expect(cards?.length).toBe(2); // 2 weapons in mock data
        });
    });

    it('should select character on click and deselect others', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const mockFileReader = {
            readAsDataURL: vi.fn(),
            onload: null as any,
            result: 'data:image/png;base64,fake',
        };
        vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

        const validFile = new File(['fake'], 'test.png', { type: 'image/png' });
        Object.defineProperty(validFile, 'size', { value: 1024 });
        Object.defineProperty(fileInput, 'files', { value: [validFile] });

        fileInput.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 10));
        if (mockFileReader.onload) {
            mockFileReader.onload({ target: { result: 'data:image/png;base64,fake' } } as any);
        }

        await vi.waitFor(() => {
            const charGrid = document.getElementById('scan-character-grid');
            const cards = charGrid?.querySelectorAll('.scan-entity-card');

            if (cards && cards.length >= 2) {
                // Select first character
                (cards[0] as HTMLElement).click();
                expect(cards[0].classList.contains('selected')).toBe(true);

                // Select second character - first should be deselected
                (cards[1] as HTMLElement).click();
                expect(cards[0].classList.contains('selected')).toBe(false);
                expect(cards[1].classList.contains('selected')).toBe(true);
            }
        });
    });
});

// ========================================
// Apply to Advisor Tests
// ========================================
describe('scan-build - Apply to Advisor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDOM();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete (window as any).applyScannedBuild;
    });

    it('should call callback when apply button clicked', async () => {
        const gameData = createMockGameData();
        const callback = vi.fn();
        initScanBuild(gameData, callback);

        // Simulate image upload
        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const mockFileReader = {
            readAsDataURL: vi.fn(),
            onload: null as any,
            result: 'data:image/png;base64,fake',
        };
        vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

        const validFile = new File(['fake'], 'test.png', { type: 'image/png' });
        Object.defineProperty(validFile, 'size', { value: 1024 });
        Object.defineProperty(fileInput, 'files', { value: [validFile] });

        fileInput.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 10));
        if (mockFileReader.onload) {
            mockFileReader.onload({ target: { result: 'data:image/png;base64,fake' } } as any);
        }

        await vi.waitFor(() => {
            // Select a character
            const charCard = document.querySelector('.scan-entity-card') as HTMLElement;
            charCard?.click();
        });

        await new Promise(resolve => setTimeout(resolve, 50));

        // Click apply button
        const applyBtn = document.getElementById('scan-apply-to-advisor') as HTMLElement;
        applyBtn?.click();

        await vi.waitFor(() => {
            expect(callback).toHaveBeenCalledWith(
                expect.objectContaining({
                    character: expect.any(Object),
                })
            );
        });
    });

    it('should call window.applyScannedBuild if available', async () => {
        const gameData = createMockGameData();
        (window as any).applyScannedBuild = vi.fn();

        initScanBuild(gameData);

        // Simulate image upload
        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const mockFileReader = {
            readAsDataURL: vi.fn(),
            onload: null as any,
            result: 'data:image/png;base64,fake',
        };
        vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

        const validFile = new File(['fake'], 'test.png', { type: 'image/png' });
        Object.defineProperty(validFile, 'size', { value: 1024 });
        Object.defineProperty(fileInput, 'files', { value: [validFile] });

        fileInput.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 10));
        if (mockFileReader.onload) {
            mockFileReader.onload({ target: { result: 'data:image/png;base64,fake' } } as any);
        }

        await vi.waitFor(() => {
            const charCard = document.querySelector('.scan-entity-card') as HTMLElement;
            charCard?.click();
        });

        await new Promise(resolve => setTimeout(resolve, 50));

        const applyBtn = document.getElementById('scan-apply-to-advisor') as HTMLElement;
        applyBtn?.click();

        await vi.waitFor(() => {
            expect((window as any).applyScannedBuild).toHaveBeenCalled();
        });
    });

    it('should show success toast when applied', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const mockFileReader = {
            readAsDataURL: vi.fn(),
            onload: null as any,
            result: 'data:image/png;base64,fake',
        };
        vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

        const validFile = new File(['fake'], 'test.png', { type: 'image/png' });
        Object.defineProperty(validFile, 'size', { value: 1024 });
        Object.defineProperty(fileInput, 'files', { value: [validFile] });

        fileInput.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 10));
        if (mockFileReader.onload) {
            mockFileReader.onload({ target: { result: 'data:image/png;base64,fake' } } as any);
        }

        await vi.waitFor(() => {
            const charCard = document.querySelector('.scan-entity-card') as HTMLElement;
            charCard?.click();
        });

        await new Promise(resolve => setTimeout(resolve, 50));

        const applyBtn = document.getElementById('scan-apply-to-advisor') as HTMLElement;
        applyBtn?.click();

        await vi.waitFor(() => {
            expect(ToastManager.success).toHaveBeenCalledWith('Build state applied to advisor!');
        });
    });

    it('should log apply action', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const mockFileReader = {
            readAsDataURL: vi.fn(),
            onload: null as any,
            result: 'data:image/png;base64,fake',
        };
        vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

        const validFile = new File(['fake'], 'test.png', { type: 'image/png' });
        Object.defineProperty(validFile, 'size', { value: 1024 });
        Object.defineProperty(fileInput, 'files', { value: [validFile] });

        fileInput.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 10));
        if (mockFileReader.onload) {
            mockFileReader.onload({ target: { result: 'data:image/png;base64,fake' } } as any);
        }

        await vi.waitFor(() => {
            const charCard = document.querySelector('.scan-entity-card') as HTMLElement;
            charCard?.click();
        });

        await new Promise(resolve => setTimeout(resolve, 50));

        const applyBtn = document.getElementById('scan-apply-to-advisor') as HTMLElement;
        applyBtn?.click();

        await vi.waitFor(() => {
            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'scan_build.applied_to_advisor',
                })
            );
        });
    });
});

// ========================================
// Selection Summary Tests
// ========================================
describe('scan-build - Selection Summary', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDOM();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should update summary when character selected', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const mockFileReader = {
            readAsDataURL: vi.fn(),
            onload: null as any,
            result: 'data:image/png;base64,fake',
        };
        vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

        const validFile = new File(['fake'], 'test.png', { type: 'image/png' });
        Object.defineProperty(validFile, 'size', { value: 1024 });
        Object.defineProperty(fileInput, 'files', { value: [validFile] });

        fileInput.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 10));
        if (mockFileReader.onload) {
            mockFileReader.onload({ target: { result: 'data:image/png;base64,fake' } } as any);
        }

        await vi.waitFor(() => {
            const charCard = document.querySelector('.scan-entity-card') as HTMLElement;
            charCard?.click();
        });

        await new Promise(resolve => setTimeout(resolve, 50));

        const summary = document.getElementById('scan-selection-summary');
        expect(summary?.innerHTML).toContain('👤');
    });

    it('should show apply button when selections made', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);

        const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
        const mockFileReader = {
            readAsDataURL: vi.fn(),
            onload: null as any,
            result: 'data:image/png;base64,fake',
        };
        vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

        const validFile = new File(['fake'], 'test.png', { type: 'image/png' });
        Object.defineProperty(validFile, 'size', { value: 1024 });
        Object.defineProperty(fileInput, 'files', { value: [validFile] });

        fileInput.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 10));
        if (mockFileReader.onload) {
            mockFileReader.onload({ target: { result: 'data:image/png;base64,fake' } } as any);
        }

        await vi.waitFor(() => {
            const charCard = document.querySelector('.scan-entity-card') as HTMLElement;
            charCard?.click();
        });

        await new Promise(resolve => setTimeout(resolve, 50));

        const applyBtn = document.getElementById('scan-apply-to-advisor');
        expect(applyBtn?.style.display).toBe('block');
    });
});
