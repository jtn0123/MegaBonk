/**
 * Shared mock definitions for test files
 * Reduces duplication of common vi.mock() patterns
 */

import { vi } from 'vitest';

// ========================================
// Logger Mock Factory
// ========================================
export const createLoggerMock = () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        setContext: vi.fn(),
    },
});

// ========================================
// Toast Manager Mock Factory
// ========================================
export const createToastMock = () => ({
    ToastManager: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
    },
});

// ========================================
// Utils Mock Factory
// ========================================
export const createUtilsMock = () => ({
    safeGetElementById: vi.fn((id: string) => document.getElementById(id)),
    escapeHtml: vi.fn((str: string) => str),
    safeQuerySelectorAll: vi.fn((selector: string) => document.querySelectorAll(selector)),
    safeSetValue: vi.fn((id: string, value: string) => {
        const el = document.getElementById(id) as HTMLSelectElement | HTMLInputElement | null;
        if (el) el.value = value;
    }),
    formatNumber: vi.fn((n: number) => n.toString()),
    debounce: vi.fn((fn: Function) => fn),
});

// ========================================
// Data Service Mock Factory
// ========================================
export const createDataServiceMock = (overrides = {}) => ({
    allData: {
        items: { items: [], version: '1.0', last_updated: '2024-01-01' },
        weapons: { weapons: [], version: '1.0' },
        tomes: { tomes: [], version: '1.0' },
        characters: { characters: [], version: '1.0' },
        shrines: { shrines: [], version: '1.0' },
        stats: { version: '1.0', stats: {} },
        ...overrides,
    },
    loadAllData: vi.fn().mockResolvedValue(undefined),
});

// ========================================
// Constants Mock Factory
// ========================================
export const createConstantsMock = () => ({
    BUILD_ITEMS_LIMIT: 50,
    DEFAULT_BUILD_STATS: {
        damage: 100,
        hp: 100,
        crit_chance: 5,
        crit_damage: 150,
        attack_speed: 100,
        movement_speed: 100,
        armor: 0,
        evasion_internal: 0,
        projectiles: 1,
    },
    ITEM_EFFECTS: {
        'power-gloves': { stat: 'damage', type: 'add', value: 25 },
        'hp-ring': { stat: 'hp', type: 'add', value: 50 },
        'crit-amulet': { stat: 'crit_chance', type: 'add', value: 10 },
        'damage-multiplier': { stat: 'damage', type: 'multiply', value: 1.5 },
        'hp-percent-damage': { stat: 'damage', type: 'hp_percent', value: 5 },
    },
});

// ========================================
// Charts Mock Factory
// ========================================
export const createChartsMock = () => ({
    destroyAllCharts: vi.fn(),
    createScalingChart: vi.fn(),
    renderChart: vi.fn(),
});

// ========================================
// Renderers Mock Factory
// ========================================
export const createRenderersMock = () => ({
    renderTabContent: vi.fn(),
    renderItemCard: vi.fn(),
    renderWeaponCard: vi.fn(),
    renderTomeCard: vi.fn(),
    renderCharacterCard: vi.fn(),
    renderShrineCard: vi.fn(),
});

// ========================================
// Filters Mock Factory
// ========================================
export const createFiltersMock = () => ({
    clearFilters: vi.fn(),
    handleSearch: vi.fn(),
    updateFilters: vi.fn(),
    restoreFilterState: vi.fn(),
    saveFilterState: vi.fn(),
    showSearchHistoryDropdown: vi.fn(),
    applyFilters: vi.fn().mockReturnValue([]),
});

// ========================================
// Modal Mock Factory
// ========================================
export const createModalMock = () => ({
    closeModal: vi.fn(),
    openDetailModal: vi.fn(),
    showModal: vi.fn(),
    hideModal: vi.fn(),
});

// ========================================
// Compare Mock Factory
// ========================================
export const createCompareMock = () => ({
    closeCompareModal: vi.fn(),
    toggleCompareItem: vi.fn(),
    updateCompareDisplay: vi.fn(),
    openCompareModal: vi.fn(),
    getCompareItems: vi.fn().mockReturnValue([]),
});

// ========================================
// Calculator Mock Factory
// ========================================
export const createCalculatorMock = () => ({
    quickCalc: vi.fn(),
    calculateBreakpoints: vi.fn().mockReturnValue([]),
    calculateScaling: vi.fn().mockReturnValue(0),
});

// ========================================
// Favorites Mock Factory
// ========================================
export const createFavoritesMock = () => ({
    toggleFavorite: vi.fn().mockReturnValue(true),
    isFavorite: vi.fn().mockReturnValue(false),
    getFavorites: vi.fn().mockReturnValue([]),
});

// ========================================
// Build Planner Mock Factory
// ========================================
export const createBuildPlannerMock = () => ({
    setupBuildPlannerEvents: vi.fn(),
    updateBuildAnalysis: vi.fn(),
    getCurrentBuild: vi.fn().mockReturnValue({
        character: null,
        weapon: null,
        tomes: [],
        items: [],
    }),
    clearBuild: vi.fn(),
    loadBuildFromData: vi.fn(),
    calculateBuildStats: vi.fn().mockReturnValue({
        damage: 100,
        hp: 100,
        crit_chance: 5,
        crit_damage: 150,
        attack_speed: 100,
        movement_speed: 100,
        armor: 0,
        evasion: 0,
    }),
});

// ========================================
// Changelog Mock Factory
// ========================================
export const createChangelogMock = () => ({
    toggleChangelogExpand: vi.fn(),
    renderChangelog: vi.fn(),
});

// ========================================
// Canvas Mock Factory (for CV tests)
// ========================================
export const createCanvasMock = (width = 1920, height = 1080) => {
    const context = {
        drawImage: vi.fn(),
        getImageData: vi.fn(() => ({
            data: new Uint8ClampedArray(width * height * 4),
            width,
            height,
        })),
        putImageData: vi.fn(),
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        scale: vi.fn(),
        translate: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
    };

    return {
        width,
        height,
        getContext: vi.fn(() => context),
        toDataURL: vi.fn(() => 'data:image/png;base64,mock'),
        toBlob: vi.fn((cb) => cb(new Blob())),
        context,
    };
};

// ========================================
// Image Data Mock Factory (for CV tests)
// ========================================
export const createMockImageData = (width = 100, height = 100, fillColor?: { r: number; g: number; b: number }) => {
    const data = new Uint8ClampedArray(width * height * 4);

    if (fillColor) {
        for (let i = 0; i < data.length; i += 4) {
            data[i] = fillColor.r;
            data[i + 1] = fillColor.g;
            data[i + 2] = fillColor.b;
            data[i + 3] = 255;
        }
    }

    return { data, width, height };
};

// ========================================
// Mock Game Data for CV Tests
// ========================================
export const createMockGameDataForCV = () => ({
    items: {
        version: '1.0',
        last_updated: '2024-01-01',
        items: [
            {
                id: 'first_aid_kit',
                name: 'First Aid Kit',
                description: 'Heals you',
                rarity: 'common',
                tier: 'B',
                tags: ['health'],
                mechanics: { base: { health_regen: 5 } },
            },
            {
                id: 'battery',
                name: 'Battery',
                description: 'Energy boost',
                rarity: 'rare',
                tier: 'S',
                tags: ['energy'],
                mechanics: { base: { energy: 15 } },
            },
        ],
    },
});

// ========================================
// LocalStorage Mock Setup
// ========================================
export const createLocalStorageMock = () => {
    let store: Record<string, string> = {};

    return {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => {
            store[key] = value.toString();
        }),
        removeItem: vi.fn((key: string) => {
            delete store[key];
        }),
        clear: vi.fn(() => {
            store = {};
        }),
        get length() {
            return Object.keys(store).length;
        },
        key: vi.fn((index: number) => Object.keys(store)[index] || null),
        getStore: () => store,
        setStore: (newStore: Record<string, string>) => {
            store = newStore;
        },
    };
};

// ========================================
// Clipboard Mock Setup
// ========================================
export const createClipboardMock = () => {
    let content = '';
    return {
        writeText: vi.fn((text: string) => {
            content = text;
            return Promise.resolve();
        }),
        readText: vi.fn(() => Promise.resolve(content)),
        getContent: () => content,
    };
};

// ========================================
// Common Mock Module Paths
// ========================================
export const MOCK_PATHS = {
    logger: '../../src/modules/logger.ts',
    toast: '../../src/modules/toast.ts',
    utils: '../../src/modules/utils.ts',
    dataService: '../../src/modules/data-service.ts',
    constants: '../../src/modules/constants.ts',
    charts: '../../src/modules/charts.ts',
    renderers: '../../src/modules/renderers.ts',
    filters: '../../src/modules/filters.ts',
    modal: '../../src/modules/modal.ts',
    compare: '../../src/modules/compare.ts',
    calculator: '../../src/modules/calculator.ts',
    favorites: '../../src/modules/favorites.ts',
    buildPlanner: '../../src/modules/build-planner.ts',
    changelog: '../../src/modules/changelog.ts',
} as const;

// ========================================
// Helper to Reset All Mock Functions
// ========================================
export const resetAllMockFunctions = (mockObj: Record<string, unknown>) => {
    Object.values(mockObj).forEach(value => {
        if (typeof value === 'function' && 'mockClear' in value) {
            (value as ReturnType<typeof vi.fn>).mockClear();
        } else if (typeof value === 'object' && value !== null) {
            resetAllMockFunctions(value as Record<string, unknown>);
        }
    });
};
