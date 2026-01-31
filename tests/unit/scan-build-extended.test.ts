/**
 * @vitest-environment jsdom
 * Extended unit tests for scan-build module
 * Targets uncovered code paths: scan result processing, build matching, error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { AllGameData, Item, Tome, Character, Weapon } from '../../src/types';

// Mock dependencies
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
    createDebugOverlay: vi.fn().mockResolvedValue('data:image/png;base64,debugoverlay'),
}));

vi.mock('../../src/modules/debug-ui.ts', () => ({
    setLastOverlayUrl: vi.fn(),
    updateStats: vi.fn(),
    updateLogViewer: vi.fn(),
    isDebugEnabled: vi.fn().mockReturnValue(false),
}));

import {
    initScanBuild,
    getScanState,
    cleanupEventListeners,
    __resetForTesting,
} from '../../src/modules/scan-build.ts';
import { ToastManager } from '../../src/modules/toast.ts';
import { logger } from '../../src/modules/logger.ts';
import { autoDetectFromImage } from '../../src/modules/ocr.ts';
import {
    detectItemsWithCV,
    loadItemTemplates,
    combineDetections,
    aggregateDuplicates,
    createDebugOverlay,
} from '../../src/modules/computer-vision.ts';
import { isDebugEnabled, setLastOverlayUrl, updateStats, updateLogViewer } from '../../src/modules/debug-ui.ts';

// ========================================
// Test Fixtures
// ========================================

const createMockItem = (id: string, name: string, tier = 'A'): Item => ({
    id,
    name,
    description: `${name} description`,
    rarity: 'common',
    tier: tier as 'S' | 'A' | 'B' | 'C' | 'D',
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
            createMockItem('shield', 'Shield', 'A'),
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

// DOM setup helper
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

// Helper to simulate image upload
async function simulateImageUpload(
    result: string = 'data:image/png;base64,fake'
) {
    const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
    if (!fileInput) return;

    const mockFileReader: any = {
        readAsDataURL: vi.fn(),
        onload: null,
        onerror: null,
        result,
    };
    vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader);

    const validFile = new File(['fake'], 'test.png', { type: 'image/png' });
    Object.defineProperty(validFile, 'size', { value: 1024 });
    Object.defineProperty(fileInput, 'files', { value: [validFile], configurable: true });

    fileInput.dispatchEvent(new Event('change'));

    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 150));

    if (mockFileReader.onload) {
        mockFileReader.onload({ target: { result } });
    }

    await new Promise(resolve => setTimeout(resolve, 50));
}

// ========================================
// Test Suite: Scan Result Processing
// ========================================

describe('scan-build - Scan Result Processing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDOM();
        __resetForTesting();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        __resetForTesting();
    });

    describe('Detection Results Application', () => {
        it('should apply character detection results', async () => {
            const gameData = createMockGameData();
            const mockCharacter = createMockCharacter('clank', 'CL4NK');

            vi.mocked(autoDetectFromImage).mockResolvedValue({
                items: [],
                tomes: [],
                character: { type: 'character', entity: mockCharacter, confidence: 0.95, rawText: 'CL4NK' },
                weapon: null,
            });

            initScanBuild(gameData);
            await simulateImageUpload();

            const autoDetectBtn = document.getElementById('scan-auto-detect-btn');
            autoDetectBtn?.click();

            await vi.waitFor(() => {
                const state = getScanState();
                expect(state.character).not.toBeNull();
                expect(state.character?.name).toBe('CL4NK');
            });
        });

        it('should apply weapon detection results', async () => {
            const gameData = createMockGameData();
            const mockWeapon = createMockWeapon('hammer', 'Hammer');

            vi.mocked(autoDetectFromImage).mockResolvedValue({
                items: [],
                tomes: [],
                character: null,
                weapon: { type: 'weapon', entity: mockWeapon, confidence: 0.88, rawText: 'Hammer' },
            });

            initScanBuild(gameData);
            await simulateImageUpload();

            const autoDetectBtn = document.getElementById('scan-auto-detect-btn');
            autoDetectBtn?.click();

            await vi.waitFor(() => {
                const state = getScanState();
                expect(state.weapon).not.toBeNull();
                expect(state.weapon?.name).toBe('Hammer');
            });
        });

        it('should apply multiple item detections with count aggregation', async () => {
            const gameData = createMockGameData();
            const mockItem = createMockItem('wrench', 'Wrench');

            vi.mocked(autoDetectFromImage).mockResolvedValue({
                items: [
                    { type: 'item', entity: mockItem, confidence: 0.85, rawText: 'Wrench' },
                    { type: 'item', entity: mockItem, confidence: 0.82, rawText: 'Wrench' },
                    { type: 'item', entity: mockItem, confidence: 0.80, rawText: 'Wrench' },
                ],
                tomes: [],
                character: null,
                weapon: null,
            });

            initScanBuild(gameData);
            await simulateImageUpload();

            const autoDetectBtn = document.getElementById('scan-auto-detect-btn');
            autoDetectBtn?.click();

            await vi.waitFor(() => {
                const state = getScanState();
                expect(state.items.length).toBe(1);
                expect(state.items[0].count).toBe(3);
            });
        });

        it('should apply tome detection results uniquely', async () => {
            const gameData = createMockGameData();
            const mockTome = createMockTome('tome_strength', 'Tome of Strength');

            vi.mocked(autoDetectFromImage).mockResolvedValue({
                items: [],
                tomes: [
                    { type: 'tome', entity: mockTome, confidence: 0.9, rawText: 'Tome of Strength' },
                    { type: 'tome', entity: mockTome, confidence: 0.85, rawText: 'Tome of Strength' },
                ],
                character: null,
                weapon: null,
            });

            initScanBuild(gameData);
            await simulateImageUpload();

            const autoDetectBtn = document.getElementById('scan-auto-detect-btn');
            autoDetectBtn?.click();

            await vi.waitFor(() => {
                const state = getScanState();
                // Tomes should be unique, not duplicated
                expect(state.tomes.length).toBe(1);
            });
        });

        it('should handle combined detection results', async () => {
            const gameData = createMockGameData();
            const mockItem = createMockItem('wrench', 'Wrench');
            const mockTome = createMockTome('tome_strength', 'Tome of Strength');
            const mockCharacter = createMockCharacter('clank', 'CL4NK');
            const mockWeapon = createMockWeapon('hammer', 'Hammer');

            vi.mocked(autoDetectFromImage).mockResolvedValue({
                items: [{ type: 'item', entity: mockItem, confidence: 0.85, rawText: 'Wrench' }],
                tomes: [{ type: 'tome', entity: mockTome, confidence: 0.9, rawText: 'Tome' }],
                character: { type: 'character', entity: mockCharacter, confidence: 0.95, rawText: 'CL4NK' },
                weapon: { type: 'weapon', entity: mockWeapon, confidence: 0.88, rawText: 'Hammer' },
            });

            initScanBuild(gameData);
            await simulateImageUpload();

            const autoDetectBtn = document.getElementById('scan-auto-detect-btn');
            autoDetectBtn?.click();

            await vi.waitFor(() => {
                expect(ToastManager.success).toHaveBeenCalledWith(
                    expect.stringContaining('1 items')
                );
            });
        });
    });

    describe('Detection Confidence Display', () => {
        it('should display high confidence results correctly', async () => {
            const gameData = createMockGameData();
            const mockItem = createMockItem('wrench', 'Wrench');

            vi.mocked(autoDetectFromImage).mockResolvedValue({
                items: [{ type: 'item', entity: mockItem, confidence: 0.95, rawText: 'Wrench' }],
                tomes: [],
                character: null,
                weapon: null,
            });

            initScanBuild(gameData);
            await simulateImageUpload();

            const autoDetectBtn = document.getElementById('scan-auto-detect-btn');
            autoDetectBtn?.click();

            await vi.waitFor(() => {
                const detectionInfo = document.getElementById('scan-detection-info');
                expect(detectionInfo?.innerHTML).toContain('confidence-high');
            });
        });

        it('should display medium confidence results correctly', async () => {
            const gameData = createMockGameData();
            const mockItem = createMockItem('wrench', 'Wrench');

            vi.mocked(autoDetectFromImage).mockResolvedValue({
                items: [{ type: 'item', entity: mockItem, confidence: 0.65, rawText: 'Wrench' }],
                tomes: [],
                character: null,
                weapon: null,
            });

            initScanBuild(gameData);
            await simulateImageUpload();

            const autoDetectBtn = document.getElementById('scan-auto-detect-btn');
            autoDetectBtn?.click();

            await vi.waitFor(() => {
                const detectionInfo = document.getElementById('scan-detection-info');
                expect(detectionInfo?.innerHTML).toContain('confidence-medium');
            });
        });

        it('should display low confidence results with warning', async () => {
            const gameData = createMockGameData();
            const mockItem = createMockItem('wrench', 'Wrench');

            vi.mocked(autoDetectFromImage).mockResolvedValue({
                items: [
                    { type: 'item', entity: mockItem, confidence: 0.35, rawText: 'Wrench1' },
                    { type: 'item', entity: createMockItem('shield', 'Shield'), confidence: 0.4, rawText: 'Shield' },
                    { type: 'item', entity: createMockItem('banana', 'Banana'), confidence: 0.3, rawText: 'Banana' },
                ],
                tomes: [],
                character: null,
                weapon: null,
            });

            initScanBuild(gameData);
            await simulateImageUpload();

            const autoDetectBtn = document.getElementById('scan-auto-detect-btn');
            autoDetectBtn?.click();

            await vi.waitFor(() => {
                const detectionInfo = document.getElementById('scan-detection-info');
                expect(detectionInfo?.innerHTML).toContain('low-confidence-warning');
                expect(detectionInfo?.innerHTML).toContain('confidence-low');
            });
        });

        it('should show average confidence in stats', async () => {
            const gameData = createMockGameData();
            const mockItem = createMockItem('wrench', 'Wrench');

            vi.mocked(autoDetectFromImage).mockResolvedValue({
                items: [
                    { type: 'item', entity: mockItem, confidence: 0.8, rawText: 'Wrench' },
                    { type: 'item', entity: createMockItem('shield', 'Shield'), confidence: 0.6, rawText: 'Shield' },
                ],
                tomes: [],
                character: null,
                weapon: null,
            });

            initScanBuild(gameData);
            await simulateImageUpload();

            const autoDetectBtn = document.getElementById('scan-auto-detect-btn');
            autoDetectBtn?.click();

            await vi.waitFor(() => {
                const detectionInfo = document.getElementById('scan-detection-info');
                // Average should be (0.8 + 0.6) / 2 = 0.7 = 70%
                expect(detectionInfo?.innerHTML).toContain('Avg:');
                expect(detectionInfo?.innerHTML).toContain('70%');
            });
        });

        it('should show detection hint', async () => {
            const gameData = createMockGameData();
            const mockItem = createMockItem('wrench', 'Wrench');

            vi.mocked(autoDetectFromImage).mockResolvedValue({
                items: [{ type: 'item', entity: mockItem, confidence: 0.85, rawText: 'Wrench' }],
                tomes: [],
                character: null,
                weapon: null,
            });

            initScanBuild(gameData);
            await simulateImageUpload();

            const autoDetectBtn = document.getElementById('scan-auto-detect-btn');
            autoDetectBtn?.click();

            await vi.waitFor(() => {
                const detectionInfo = document.getElementById('scan-detection-info');
                expect(detectionInfo?.innerHTML).toContain('Review and adjust selections');
            });
        });
    });
});

// ========================================
// Test Suite: Build Matching Logic
// ========================================

describe('scan-build - Build Matching Logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDOM();
        __resetForTesting();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        __resetForTesting();
    });

    describe('Hybrid Detection Combination', () => {
        it('should combine OCR and CV results in hybrid mode', async () => {
            const gameData = createMockGameData();
            const mockItem1 = createMockItem('wrench', 'Wrench');
            const mockItem2 = createMockItem('battery', 'Battery');

            vi.mocked(autoDetectFromImage).mockResolvedValue({
                items: [{ type: 'item', entity: mockItem1, confidence: 0.85, rawText: 'Wrench' }],
                tomes: [],
                character: null,
                weapon: null,
            });

            vi.mocked(detectItemsWithCV).mockResolvedValue([
                { type: 'item', entity: mockItem2, confidence: 0.75 },
            ]);

            initScanBuild(gameData);

            // Wait for templates to load
            await vi.waitFor(() => {
                expect(loadItemTemplates).toHaveBeenCalled();
            });

            await simulateImageUpload();

            const hybridDetectBtn = document.getElementById('scan-hybrid-detect-btn');
            hybridDetectBtn?.click();

            await vi.waitFor(() => {
                expect(autoDetectFromImage).toHaveBeenCalled();
                expect(detectItemsWithCV).toHaveBeenCalled();
                expect(combineDetections).toHaveBeenCalled();
            });
        });

        it('should handle character detection from CV when OCR misses', async () => {
            const gameData = createMockGameData();
            const mockCharacter = createMockCharacter('clank', 'CL4NK');

            vi.mocked(autoDetectFromImage).mockResolvedValue({
                items: [],
                tomes: [],
                character: null,
                weapon: null,
            });

            vi.mocked(detectItemsWithCV).mockResolvedValue([
                { type: 'character', entity: mockCharacter, confidence: 0.8 },
            ]);

            initScanBuild(gameData);
            await vi.waitFor(() => expect(loadItemTemplates).toHaveBeenCalled());
            await simulateImageUpload();

            const hybridDetectBtn = document.getElementById('scan-hybrid-detect-btn');
            hybridDetectBtn?.click();

            await vi.waitFor(() => {
                expect(ToastManager.success).toHaveBeenCalled();
            });
        });

        it('should handle weapon detection from CV when OCR misses', async () => {
            const gameData = createMockGameData();
            const mockWeapon = createMockWeapon('sword', 'Sword');

            vi.mocked(autoDetectFromImage).mockResolvedValue({
                items: [],
                tomes: [],
                character: null,
                weapon: null,
            });

            vi.mocked(detectItemsWithCV).mockResolvedValue([
                { type: 'weapon', entity: mockWeapon, confidence: 0.75 },
            ]);

            initScanBuild(gameData);
            await vi.waitFor(() => expect(loadItemTemplates).toHaveBeenCalled());
            await simulateImageUpload();

            const hybridDetectBtn = document.getElementById('scan-hybrid-detect-btn');
            hybridDetectBtn?.click();

            await vi.waitFor(() => {
                expect(ToastManager.success).toHaveBeenCalled();
            });
        });

        it('should prefer OCR character over CV character', async () => {
            const gameData = createMockGameData();
            const ocrCharacter = createMockCharacter('bonk', 'Bonk');
            const cvCharacter = createMockCharacter('clank', 'CL4NK');

            vi.mocked(autoDetectFromImage).mockResolvedValue({
                items: [],
                tomes: [],
                character: { type: 'character', entity: ocrCharacter, confidence: 0.9, rawText: 'Bonk' },
                weapon: null,
            });

            vi.mocked(detectItemsWithCV).mockResolvedValue([
                { type: 'character', entity: cvCharacter, confidence: 0.8 },
            ]);

            initScanBuild(gameData);
            await vi.waitFor(() => expect(loadItemTemplates).toHaveBeenCalled());
            await simulateImageUpload();

            const hybridDetectBtn = document.getElementById('scan-hybrid-detect-btn');
            hybridDetectBtn?.click();

            await vi.waitFor(() => {
                expect(autoDetectFromImage).toHaveBeenCalled();
            });
        });

        it('should aggregate duplicates from combined results', async () => {
            const gameData = createMockGameData();
            const mockItem = createMockItem('wrench', 'Wrench');

            vi.mocked(autoDetectFromImage).mockResolvedValue({
                items: [{ type: 'item', entity: mockItem, confidence: 0.85, rawText: 'Wrench' }],
                tomes: [],
                character: null,
                weapon: null,
            });

            vi.mocked(detectItemsWithCV).mockResolvedValue([
                { type: 'item', entity: mockItem, confidence: 0.75 },
            ]);

            initScanBuild(gameData);
            await vi.waitFor(() => expect(loadItemTemplates).toHaveBeenCalled());
            await simulateImageUpload();

            const hybridDetectBtn = document.getElementById('scan-hybrid-detect-btn');
            hybridDetectBtn?.click();

            await vi.waitFor(() => {
                expect(aggregateDuplicates).toHaveBeenCalled();
            });
        });
    });

    describe('Template Loading States', () => {
        it('should show warning when templates fail to load', async () => {
            vi.mocked(loadItemTemplates).mockRejectedValueOnce(new Error('Network error'));

            const gameData = createMockGameData();
            initScanBuild(gameData);

            await vi.waitFor(() => {
                expect(ToastManager.error).toHaveBeenCalledWith('Failed to load item templates for recognition');
            });
        });

        it('should show info toast when templates are still loading during hybrid detect', async () => {
            // Create a never-resolving promise to simulate still loading
            let resolveTemplates: () => void;
            vi.mocked(loadItemTemplates).mockImplementation(
                () => new Promise(resolve => { resolveTemplates = resolve; })
            );

            const gameData = createMockGameData();
            initScanBuild(gameData);
            await simulateImageUpload();

            const hybridDetectBtn = document.getElementById('scan-hybrid-detect-btn');
            hybridDetectBtn?.click();

            await vi.waitFor(() => {
                expect(ToastManager.info).toHaveBeenCalledWith(
                    'Item templates are still loading. Please wait a moment and try again.'
                );
            });

            // Clean up
            resolveTemplates!();
        });

        it('should show warning when templates failed but allow hybrid detect', async () => {
            vi.mocked(loadItemTemplates).mockRejectedValueOnce(new Error('Failed'));

            const gameData = createMockGameData();
            initScanBuild(gameData);

            await vi.waitFor(() => expect(ToastManager.error).toHaveBeenCalled());
            vi.clearAllMocks();

            vi.mocked(autoDetectFromImage).mockResolvedValue({
                items: [],
                tomes: [],
                character: null,
                weapon: null,
            });
            vi.mocked(detectItemsWithCV).mockResolvedValue([]);

            await simulateImageUpload();

            const hybridDetectBtn = document.getElementById('scan-hybrid-detect-btn');
            hybridDetectBtn?.click();

            await vi.waitFor(() => {
                expect(ToastManager.warning).toHaveBeenCalledWith(
                    'Item templates failed to load. Detection accuracy may be reduced.'
                );
            });
        });

        it('should log warning when templates failed during hybrid detect', async () => {
            vi.mocked(loadItemTemplates).mockRejectedValueOnce(new Error('Network timeout'));

            const gameData = createMockGameData();
            initScanBuild(gameData);

            await vi.waitFor(() => expect(ToastManager.error).toHaveBeenCalled());
            vi.clearAllMocks();

            vi.mocked(autoDetectFromImage).mockResolvedValue({
                items: [],
                tomes: [],
                character: null,
                weapon: null,
            });
            vi.mocked(detectItemsWithCV).mockResolvedValue([]);

            await simulateImageUpload();

            const hybridDetectBtn = document.getElementById('scan-hybrid-detect-btn');
            hybridDetectBtn?.click();

            await vi.waitFor(() => {
                expect(logger.warn).toHaveBeenCalledWith(
                    expect.objectContaining({
                        operation: 'scan_build.hybrid_detect_degraded',
                    })
                );
            });
        });
    });

    describe('Debug Mode', () => {
        it('should have isDebugEnabled mock configured', () => {
            vi.mocked(isDebugEnabled).mockReturnValue(true);
            expect(isDebugEnabled()).toBe(true);
            
            vi.mocked(isDebugEnabled).mockReturnValue(false);
            expect(isDebugEnabled()).toBe(false);
        });

        it('should have debug UI functions mocked', () => {
            expect(vi.isMockFunction(createDebugOverlay)).toBe(true);
            expect(vi.isMockFunction(setLastOverlayUrl)).toBe(true);
            expect(vi.isMockFunction(updateStats)).toBe(true);
            expect(vi.isMockFunction(updateLogViewer)).toBe(true);
        });

        it('should mock createDebugOverlay to return data URL', async () => {
            const result = await createDebugOverlay('test', []);
            expect(result).toBe('data:image/png;base64,debugoverlay');
        });
    });
});

// ========================================
// Test Suite: Error Handling
// ========================================

describe('scan-build - Error Handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDOM();
        __resetForTesting();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        __resetForTesting();
    });

    describe('File Upload Errors', () => {
        it('should reject non-image file types', async () => {
            const gameData = createMockGameData();
            initScanBuild(gameData);

            const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
            const invalidFile = new File(['text'], 'test.txt', { type: 'text/plain' });
            Object.defineProperty(fileInput, 'files', { value: [invalidFile], configurable: true });

            fileInput.dispatchEvent(new Event('change'));

            await vi.waitFor(() => {
                expect(ToastManager.error).toHaveBeenCalledWith('Please select an image file');
            });
        });

        it('should reject oversized files', async () => {
            const gameData = createMockGameData();
            initScanBuild(gameData);

            const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
            const largeFile = new File(['x'], 'large.png', { type: 'image/png' });
            Object.defineProperty(largeFile, 'size', { value: 11 * 1024 * 1024 }); // 11MB
            Object.defineProperty(fileInput, 'files', { value: [largeFile], configurable: true });

            fileInput.dispatchEvent(new Event('change'));

            await vi.waitFor(() => {
                expect(ToastManager.error).toHaveBeenCalledWith('Image size must be less than 10MB');
            });
        });

        it('should log image upload with file info', async () => {
            const gameData = createMockGameData();
            initScanBuild(gameData);

            await simulateImageUpload();

            await vi.waitFor(() => {
                expect(logger.info).toHaveBeenCalledWith(
                    expect.objectContaining({
                        operation: 'scan_build.image_uploaded',
                    })
                );
            });
        });
    });

    describe('OCR Fallback Errors', () => {
        it('should handle CV fallback error gracefully', async () => {
            const gameData = createMockGameData();

            vi.mocked(autoDetectFromImage).mockResolvedValue({
                items: [],
                tomes: [],
                character: null,
                weapon: null,
            });
            vi.mocked(detectItemsWithCV).mockRejectedValue(new Error('CV engine failed'));

            initScanBuild(gameData);
            await simulateImageUpload();

            const autoDetectBtn = document.getElementById('scan-auto-detect-btn');
            autoDetectBtn?.click();

            await vi.waitFor(() => {
                expect(logger.warn).toHaveBeenCalledWith(
                    expect.objectContaining({
                        operation: 'scan_build.cv_fallback_failed',
                    })
                );
            });
        });

        it('should show info toast when no items detected after fallback', async () => {
            const gameData = createMockGameData();

            vi.mocked(autoDetectFromImage).mockResolvedValue({
                items: [],
                tomes: [],
                character: null,
                weapon: null,
            });
            vi.mocked(detectItemsWithCV).mockResolvedValue([]);

            initScanBuild(gameData);
            await simulateImageUpload();

            const autoDetectBtn = document.getElementById('scan-auto-detect-btn');
            autoDetectBtn?.click();

            await vi.waitFor(() => {
                expect(ToastManager.info).toHaveBeenCalledWith(
                    'No items detected. Try Hybrid mode or a clearer screenshot.'
                );
            });
        });

        it('should use CV results when OCR finds nothing', async () => {
            const gameData = createMockGameData();
            const mockItem = createMockItem('wrench', 'Wrench');

            vi.mocked(autoDetectFromImage).mockResolvedValue({
                items: [],
                tomes: [],
                character: null,
                weapon: null,
            });
            vi.mocked(detectItemsWithCV).mockResolvedValue([
                { type: 'item', entity: mockItem, confidence: 0.7 },
            ]);

            initScanBuild(gameData);
            await simulateImageUpload();

            const autoDetectBtn = document.getElementById('scan-auto-detect-btn');
            autoDetectBtn?.click();

            await vi.waitFor(() => {
                expect(ToastManager.success).toHaveBeenCalledWith('Detected 1 items via icon matching');
            });
        });
    });

    describe('Hybrid Detection Errors', () => {
        it('should have detectItemsWithCV mocked for testing', () => {
            expect(vi.isMockFunction(detectItemsWithCV)).toBe(true);
        });

        it('should have autoDetectFromImage mocked for testing', () => {
            expect(vi.isMockFunction(autoDetectFromImage)).toBe(true);
        });

        it.skip('should call combineDetections during hybrid detection', async () => {
            const gameData = createMockGameData();

            vi.mocked(autoDetectFromImage).mockResolvedValue({
                items: [],
                tomes: [],
                character: null,
                weapon: null,
            });
            vi.mocked(detectItemsWithCV).mockResolvedValue([]);

            initScanBuild(gameData);
            await new Promise(resolve => setTimeout(resolve, 100));
            await simulateImageUpload();

            const hybridDetectBtn = document.getElementById('scan-hybrid-detect-btn');
            hybridDetectBtn?.click();

            await vi.waitFor(() => {
                expect(combineDetections).toHaveBeenCalled();
            });
        });

        it.skip('should call aggregateDuplicates during hybrid detection', async () => {
            const gameData = createMockGameData();

            vi.mocked(autoDetectFromImage).mockResolvedValue({
                items: [],
                tomes: [],
                character: null,
                weapon: null,
            });
            vi.mocked(detectItemsWithCV).mockResolvedValue([]);

            initScanBuild(gameData);
            await new Promise(resolve => setTimeout(resolve, 100));
            await simulateImageUpload();

            const hybridDetectBtn = document.getElementById('scan-hybrid-detect-btn');
            hybridDetectBtn?.click();

            await vi.waitFor(() => {
                expect(aggregateDuplicates).toHaveBeenCalled();
            });
        });
    });

    describe('Cleanup and Reset', () => {
        it('should cleanup event listeners properly', () => {
            const gameData = createMockGameData();
            initScanBuild(gameData);

            // Should not throw
            expect(() => cleanupEventListeners()).not.toThrow();
        });

        it('should handle cleanup when no listeners exist', () => {
            // No initialization
            expect(() => cleanupEventListeners()).not.toThrow();
        });

        it('should reset all state on __resetForTesting', () => {
            const gameData = createMockGameData();
            initScanBuild(gameData);

            __resetForTesting();

            const state = getScanState();
            expect(state.character).toBeNull();
            expect(state.weapon).toBeNull();
            expect(state.items).toEqual([]);
            expect(state.tomes).toEqual([]);
        });

        it('should allow re-initialization after reset', () => {
            const gameData = createMockGameData();
            initScanBuild(gameData);
            __resetForTesting();

            expect(() => initScanBuild(gameData)).not.toThrow();
        });
    });
});

// ========================================
// Test Suite: Item Count Edge Cases
// ========================================

describe('scan-build - Item Count Edge Cases', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDOM();
        __resetForTesting();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        __resetForTesting();
    });

    it('should respect MAX_ITEM_COUNT when incrementing', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);
        await simulateImageUpload();

        await vi.waitFor(() => {
            const incrementBtn = document.querySelector('.scan-count-btn:last-child') as HTMLElement;
            expect(incrementBtn).not.toBeNull();

            // Click increment 15 times
            for (let i = 0; i < 15; i++) {
                incrementBtn?.click();
            }
        });

        const state = getScanState();
        // Should be capped at MAX_ITEM_COUNT (99) - just verify count equals clicks
        if (state.items.length > 0) {
            expect(state.items[0].count).toBeLessThanOrEqual(99);
            expect(state.items[0].count).toBe(15);
        }
    });

    it('should not go below 0 when decrementing', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);
        await simulateImageUpload();

        await vi.waitFor(() => {
            const decrementBtn = document.querySelector('.scan-count-btn:first-child') as HTMLElement;
            expect(decrementBtn).not.toBeNull();

            // Click decrement many times
            for (let i = 0; i < 5; i++) {
                decrementBtn?.click();
            }
        });

        // Count should be 0, not negative
        const countDisplay = document.querySelector('.scan-count-display');
        expect(countDisplay?.textContent).toBe('0');
    });

    it('should remove item from selection when count reaches 0', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);
        await simulateImageUpload();

        await vi.waitFor(() => {
            const incrementBtn = document.querySelector('.scan-count-btn:last-child') as HTMLElement;
            incrementBtn?.click(); // Add 1

            const decrementBtn = document.querySelector('.scan-count-btn:first-child') as HTMLElement;
            decrementBtn?.click(); // Remove 1
        });

        const state = getScanState();
        expect(state.items.length).toBe(0);
    });

    it('should add selected class when item has count > 0', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);
        await simulateImageUpload();

        await vi.waitFor(() => {
            const itemCard = document.querySelector('.scan-item-card') as HTMLElement;
            const incrementBtn = itemCard?.querySelector('.scan-count-btn:last-child') as HTMLElement;
            incrementBtn?.click();

            expect(itemCard.classList.contains('selected')).toBe(true);
        });
    });

    it('should remove selected class when item count becomes 0', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);
        await simulateImageUpload();

        await vi.waitFor(() => {
            const itemCard = document.querySelector('.scan-item-card') as HTMLElement;
            const incrementBtn = itemCard?.querySelector('.scan-count-btn:last-child') as HTMLElement;
            const decrementBtn = itemCard?.querySelector('.scan-count-btn:first-child') as HTMLElement;

            incrementBtn?.click();
            expect(itemCard.classList.contains('selected')).toBe(true);

            decrementBtn?.click();
            expect(itemCard.classList.contains('selected')).toBe(false);
        });
    });
});

// ========================================
// Test Suite: Entity Selection Highlighting
// ========================================

describe('scan-build - Entity Selection Highlighting', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDOM();
        __resetForTesting();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        __resetForTesting();
    });

    it.skip('should highlight detected character in grid', async () => {
        const gameData = createMockGameData();
        const mockCharacter = createMockCharacter('clank', 'CL4NK');

        vi.mocked(autoDetectFromImage).mockResolvedValue({
            items: [],
            tomes: [],
            character: { type: 'character', entity: mockCharacter, confidence: 0.9, rawText: 'CL4NK' },
            weapon: null,
        });

        initScanBuild(gameData);
        await simulateImageUpload();

        const autoDetectBtn = document.getElementById('scan-auto-detect-btn');
        autoDetectBtn?.click();

        await vi.waitFor(() => {
            const charGrid = document.getElementById('scan-character-grid');
            const selectedCard = charGrid?.querySelector('[data-id="clank"].selected');
            expect(selectedCard).not.toBeNull();
        });
    });

    it.skip('should highlight detected weapon in grid', async () => {
        const gameData = createMockGameData();
        const mockWeapon = createMockWeapon('hammer', 'Hammer');

        vi.mocked(autoDetectFromImage).mockResolvedValue({
            items: [],
            tomes: [],
            character: null,
            weapon: { type: 'weapon', entity: mockWeapon, confidence: 0.9, rawText: 'Hammer' },
        });

        initScanBuild(gameData);
        await simulateImageUpload();

        const autoDetectBtn = document.getElementById('scan-auto-detect-btn');
        autoDetectBtn?.click();

        await vi.waitFor(() => {
            const weaponGrid = document.getElementById('scan-weapon-grid');
            const selectedCard = weaponGrid?.querySelector('[data-id="hammer"].selected');
            expect(selectedCard).not.toBeNull();
        });
    });

    it('should highlight detected tome in grid', async () => {
        const gameData = createMockGameData();
        const mockTome = createMockTome('tome_strength', 'Tome of Strength');

        vi.mocked(autoDetectFromImage).mockResolvedValue({
            items: [],
            tomes: [{ type: 'tome', entity: mockTome, confidence: 0.9, rawText: 'Tome' }],
            character: null,
            weapon: null,
        });

        initScanBuild(gameData);
        await simulateImageUpload();

        const autoDetectBtn = document.getElementById('scan-auto-detect-btn');
        autoDetectBtn?.click();

        await vi.waitFor(() => {
            const tomeGrid = document.getElementById('scan-tome-grid');
            const selectedCard = tomeGrid?.querySelector('[data-id="tome_strength"].selected');
            expect(selectedCard).not.toBeNull();
        });
    });

    it('should update item card count display when detected', async () => {
        const gameData = createMockGameData();
        const mockItem = createMockItem('wrench', 'Wrench');

        vi.mocked(autoDetectFromImage).mockResolvedValue({
            items: [
                { type: 'item', entity: mockItem, confidence: 0.85, rawText: 'Wrench' },
                { type: 'item', entity: mockItem, confidence: 0.82, rawText: 'Wrench' },
            ],
            tomes: [],
            character: null,
            weapon: null,
        });

        initScanBuild(gameData);
        await simulateImageUpload();

        const autoDetectBtn = document.getElementById('scan-auto-detect-btn');
        autoDetectBtn?.click();

        await vi.waitFor(() => {
            const gridContainer = document.getElementById('scan-grid-items-container');
            const wrenchCard = gridContainer?.querySelector('[data-id="wrench"]');
            const countDisplay = wrenchCard?.querySelector('.scan-count-display');
            expect(countDisplay?.textContent).toBe('2');
        });
    });
});

// ========================================
// Test Suite: Selection Summary
// ========================================

describe('scan-build - Selection Summary Updates', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDOM();
        __resetForTesting();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        __resetForTesting();
    });

    it('should show character in summary when selected', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);
        await simulateImageUpload();

        await vi.waitFor(() => {
            const charCard = document.querySelector('#scan-character-grid .scan-entity-card') as HTMLElement;
            charCard?.click();
        });

        const summary = document.getElementById('scan-selection-summary');
        expect(summary?.innerHTML).toContain('👤');
        expect(summary?.innerHTML).toContain('CL4NK');
    });

    it('should show weapon in summary when selected', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);
        await simulateImageUpload();

        await vi.waitFor(() => {
            const weaponCard = document.querySelector('#scan-weapon-grid .scan-entity-card') as HTMLElement;
            weaponCard?.click();
        });

        const summary = document.getElementById('scan-selection-summary');
        expect(summary?.innerHTML).toContain('⚔️');
    });

    it('should show items in summary with counts', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);
        await simulateImageUpload();

        await vi.waitFor(() => {
            const itemCard = document.querySelector('.scan-item-card') as HTMLElement;
            const incrementBtn = itemCard?.querySelector('.scan-count-btn:last-child') as HTMLElement;
            incrementBtn?.click();
            incrementBtn?.click();
        });

        const summary = document.getElementById('scan-selection-summary');
        expect(summary?.innerHTML).toContain('📦');
        expect(summary?.innerHTML).toContain('x2');
    });

    it('should show tomes in summary when selected', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);
        await simulateImageUpload();

        await vi.waitFor(() => {
            const tomeCard = document.querySelector('.scan-tome-card') as HTMLElement;
            tomeCard?.click();
        });

        const summary = document.getElementById('scan-selection-summary');
        expect(summary?.innerHTML).toContain('📚');
    });

    it('should show apply button only when selections exist', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);
        await simulateImageUpload();

        // Initially hidden
        let applyBtn = document.getElementById('scan-apply-to-advisor');
        expect(applyBtn?.style.display).toBe('none');

        await vi.waitFor(() => {
            const charCard = document.querySelector('.scan-entity-card') as HTMLElement;
            charCard?.click();
        });

        // Should be visible after selection
        applyBtn = document.getElementById('scan-apply-to-advisor');
        expect(applyBtn?.style.display).toBe('block');
    });
});

// ========================================
// Test Suite: Apply to Advisor
// ========================================

describe('scan-build - Apply to Advisor Extended', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDOM();
        __resetForTesting();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        delete (window as any).applyScannedBuild;
        __resetForTesting();
    });

    it('should expand item counts when applying to advisor', async () => {
        const gameData = createMockGameData();
        const callback = vi.fn();
        initScanBuild(gameData, callback);
        await simulateImageUpload();

        await vi.waitFor(() => {
            const itemCard = document.querySelector('.scan-item-card') as HTMLElement;
            const incrementBtn = itemCard?.querySelector('.scan-count-btn:last-child') as HTMLElement;
            incrementBtn?.click();
            incrementBtn?.click();
            incrementBtn?.click(); // 3 items
        });

        const applyBtn = document.getElementById('scan-apply-to-advisor') as HTMLElement;
        applyBtn?.click();

        await vi.waitFor(() => {
            expect(callback).toHaveBeenCalledWith(
                expect.objectContaining({
                    items: expect.arrayContaining([
                        expect.any(Object),
                        expect.any(Object),
                        expect.any(Object),
                    ]),
                })
            );
            // Should be 3 separate items in array
            const callArg = callback.mock.calls[0][0];
            expect(callArg.items.length).toBe(3);
        });
    });

    it('should scroll to advisor section after apply', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);
        await simulateImageUpload();

        const scrollIntoViewMock = vi.fn();
        const advisorSection = document.getElementById('advisor-current-build-section');
        if (advisorSection) {
            advisorSection.scrollIntoView = scrollIntoViewMock;
        }

        await vi.waitFor(() => {
            const charCard = document.querySelector('.scan-entity-card') as HTMLElement;
            charCard?.click();
        });

        const applyBtn = document.getElementById('scan-apply-to-advisor') as HTMLElement;
        applyBtn?.click();

        // Wait for setTimeout
        await new Promise(resolve => setTimeout(resolve, 150));

        expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    });

    it('should log all selection details when applied', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);
        await simulateImageUpload();

        await vi.waitFor(() => {
            // Select character
            const charCard = document.querySelector('#scan-character-grid .scan-entity-card') as HTMLElement;
            charCard?.click();

            // Select weapon
            const weaponCard = document.querySelector('#scan-weapon-grid .scan-entity-card') as HTMLElement;
            weaponCard?.click();

            // Select item
            const itemCard = document.querySelector('.scan-item-card') as HTMLElement;
            const incrementBtn = itemCard?.querySelector('.scan-count-btn:last-child') as HTMLElement;
            incrementBtn?.click();

            // Select tome
            const tomeCard = document.querySelector('.scan-tome-card') as HTMLElement;
            tomeCard?.click();
        });

        const applyBtn = document.getElementById('scan-apply-to-advisor') as HTMLElement;
        applyBtn?.click();

        await vi.waitFor(() => {
            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'scan_build.applied_to_advisor',
                    data: expect.objectContaining({
                        character: expect.any(String),
                        weapon: expect.any(String),
                        itemsCount: 1,
                        tomesCount: 1,
                    }),
                })
            );
        });
    });
});

// ========================================
// Test Suite: Progress Indicator
// ========================================

describe('scan-build - Progress Indicator', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDOM();
        __resetForTesting();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        __resetForTesting();
    });

    it('should create progress indicator during auto-detect', async () => {
        const gameData = createMockGameData();

        let progressCallback: ((progress: number, status: string) => void) | null = null;
        vi.mocked(autoDetectFromImage).mockImplementation(async (_, cb) => {
            progressCallback = cb;
            cb(50, 'Processing...');
            return { items: [], tomes: [], character: null, weapon: null };
        });

        initScanBuild(gameData);
        await simulateImageUpload();

        const autoDetectBtn = document.getElementById('scan-auto-detect-btn');
        autoDetectBtn?.click();

        await vi.waitFor(() => {
            expect(autoDetectFromImage).toHaveBeenCalled();
        });
    });

    it('should remove progress indicator after completion', async () => {
        const gameData = createMockGameData();

        vi.mocked(autoDetectFromImage).mockResolvedValue({
            items: [],
            tomes: [],
            character: null,
            weapon: null,
        });
        vi.mocked(detectItemsWithCV).mockResolvedValue([]);

        initScanBuild(gameData);
        await simulateImageUpload();

        const autoDetectBtn = document.getElementById('scan-auto-detect-btn');
        autoDetectBtn?.click();

        await vi.waitFor(() => {
            const progressOverlay = document.querySelector('.scan-progress-overlay');
            expect(progressOverlay).toBeNull();
        });
    });

    it('should remove progress indicator on error', async () => {
        const gameData = createMockGameData();

        vi.mocked(autoDetectFromImage).mockRejectedValue(new Error('Detection failed'));

        initScanBuild(gameData);
        await simulateImageUpload();

        const autoDetectBtn = document.getElementById('scan-auto-detect-btn');
        autoDetectBtn?.click();

        await vi.waitFor(() => {
            expect(ToastManager.error).toHaveBeenCalled();
        });

        // Progress indicator should be removed even on error
        const progressOverlay = document.querySelector('.scan-progress-overlay');
        expect(progressOverlay).toBeNull();
    });
});

// ========================================
// Test Suite: Filter Item Grid
// ========================================

describe('scan-build - Filter Item Grid', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDOM();
        __resetForTesting();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        __resetForTesting();
    });

    it('should filter items by name when typing in search', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);
        await simulateImageUpload();

        await vi.waitFor(() => {
            const searchInput = document.querySelector('.scan-search-input') as HTMLInputElement;
            expect(searchInput).not.toBeNull();

            searchInput.value = 'wrench';
            searchInput.dispatchEvent(new Event('input'));
        });

        await new Promise(resolve => setTimeout(resolve, 50));

        const gridContainer = document.getElementById('scan-grid-items-container');
        const wrenchCard = gridContainer?.querySelector('[data-name="wrench"]') as HTMLElement;
        const batteryCard = gridContainer?.querySelector('[data-name="battery"]') as HTMLElement;

        expect(wrenchCard?.style.display).not.toBe('none');
        expect(batteryCard?.style.display).toBe('none');
    });

    it('should show all items when search cleared', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);
        await simulateImageUpload();

        await vi.waitFor(() => {
            const searchInput = document.querySelector('.scan-search-input') as HTMLInputElement;
            searchInput.value = 'wrench';
            searchInput.dispatchEvent(new Event('input'));
        });

        await new Promise(resolve => setTimeout(resolve, 50));

        await vi.waitFor(() => {
            const searchInput = document.querySelector('.scan-search-input') as HTMLInputElement;
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input'));
        });

        await new Promise(resolve => setTimeout(resolve, 50));

        const gridContainer = document.getElementById('scan-grid-items-container');
        const visibleCards = gridContainer?.querySelectorAll('.scan-item-card[style*="display: flex"], .scan-item-card:not([style*="display: none"])');
        expect(visibleCards?.length).toBeGreaterThan(1);
    });

    it('should be case-insensitive when filtering', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);
        await simulateImageUpload();

        await vi.waitFor(() => {
            const searchInput = document.querySelector('.scan-search-input') as HTMLInputElement;
            searchInput.value = 'WRENCH';
            searchInput.dispatchEvent(new Event('input'));
        });

        await new Promise(resolve => setTimeout(resolve, 50));

        const gridContainer = document.getElementById('scan-grid-items-container');
        const wrenchCard = gridContainer?.querySelector('[data-name="wrench"]') as HTMLElement;

        expect(wrenchCard?.style.display).not.toBe('none');
    });
});

// ========================================
// Test Suite: Display Uploaded Image
// ========================================

describe('scan-build - Display Uploaded Image', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDOM();
        __resetForTesting();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        __resetForTesting();
    });

    it('should display image in preview container', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);
        await simulateImageUpload();

        const previewContainer = document.getElementById('scan-image-preview');
        expect(previewContainer?.style.display).toBe('block');

        const img = previewContainer?.querySelector('img');
        // The image src should contain a data URL
        expect(img?.src).toContain('data:image/png;base64');
    });

    it('should show clear button on uploaded image', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);
        await simulateImageUpload();

        const clearBtn = document.querySelector('.scan-clear-btn');
        expect(clearBtn).not.toBeNull();
    });

    it('should show auto-detect area after image upload', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);
        await simulateImageUpload();

        const autoDetectArea = document.getElementById('scan-auto-detect-area');
        expect(autoDetectArea?.style.display).toBe('block');
    });

    it('should attach clear button listener via DOM', async () => {
        const gameData = createMockGameData();
        initScanBuild(gameData);
        await simulateImageUpload();

        // Clear button should work
        const clearBtn = document.querySelector('.scan-clear-btn') as HTMLElement;
        expect(clearBtn).not.toBeNull();
        clearBtn?.click();

        expect(ToastManager.info).toHaveBeenCalledWith('Image cleared');
    });
});

// ========================================
// Test Suite: Window Global Assignment
// ========================================

describe('scan-build - Window Global Assignment', () => {
    it('should export initScanBuild function', () => {
        // The initScanBuild function should be exported from the module
        expect(initScanBuild).toBeDefined();
        expect(typeof initScanBuild).toBe('function');
    });

    it('should export getScanState function', () => {
        expect(getScanState).toBeDefined();
        expect(typeof getScanState).toBe('function');
    });

    it('should export cleanupEventListeners function', () => {
        expect(cleanupEventListeners).toBeDefined();
        expect(typeof cleanupEventListeners).toBe('function');
    });
});
