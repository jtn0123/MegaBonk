// ========================================
// MegaBonk Type Definitions
// ========================================
// Central type definitions for the entire application
// NOTE: Properties use snake_case to match JSON data structure.
// This is intentional for 1:1 JSON mapping without transformation.
// ========================================

/**
 * Rarity types
 */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/**
 * Scaling track definition for items with multiple scaling paths
 */
export interface ScalingTrack {
    stat: string;
    values: number[];
}

/**
 * Tier types
 */
export type Tier = 'SS' | 'S' | 'A' | 'B' | 'C';

/**
 * Scaling formula definition
 */
export interface Scaling {
    formula: string;
    min?: number;
    max?: number;
    cap?: number;
}

/**
 * Item interface
 */
export interface Item {
    id: string;
    name: string;
    description: string;
    tier: Tier;
    rarity: Rarity;
    image?: string;
    category?: string;
    tags?: string[];
    cooldown?: number;
    damage?: number | string;
    healing?: number | string;
    scaling?: Scaling;
    synergies?: string[];
    antiSynergies?: string[];
    // Calculator/scaling properties
    formula?: string;
    scaling_type?: string;
    scaling_per_stack?: number[];
    stack_cap?: number;
    one_and_done?: boolean;
    stacks_well?: boolean;
    // Compare module properties
    base_effect?: string;
    graph_type?: string;
    notes?: string;
    anti_synergies?: string[];
    // Build planner properties
    synergies_weapons?: string[];
    // Modal/chart properties
    detailed_description?: string;
    hidden_mechanics?: string[];
    scaling_tracks?: Record<string, ScalingTrack>;
    scaling_formula_type?: string;
    hyperbolic_constant?: number;
    max_stacks?: number;
    secondary_scaling?: number[] | { stat: string; values: number[] };
}

/**
 * Weapon upgrade definition
 */
export interface WeaponUpgrade {
    level: number;
    bonus: string;
    cost?: number;
}

/**
 * Weapon interface
 * Note: JSON uses snake_case (base_damage) not camelCase (baseDamage)
 */
export interface Weapon {
    id: string;
    name: string;
    description: string;
    tier: Tier;
    rarity?: Rarity; // Optional - not present in weapons.json
    image?: string;
    baseDamage?: number; // Optional - legacy, use base_damage
    attackSpeed?: number; // Optional - not in JSON
    range?: number;
    upgrades?: WeaponUpgrade[];
    scaling?: Scaling;
    tags?: string[];
    // JSON properties (snake_case)
    base_damage?: number;
    base_projectile_count?: number;
    attack_pattern?: string;
    upgradeable_stats?: string[] | string;
    unlock_requirement?: string;
    unlock_cost_silver?: number;
    unlocked_by_default?: boolean;
    best_for?: string[];
    synergies_items?: string[];
    synergies_tomes?: string[];
    synergies_characters?: string[];
    playstyle?: string;
    pros?: string[];
    cons?: string[];
    build_tips?: string;
}

/**
 * Tome interface
 * Note: JSON uses stat_affected/value_per_level, not effect/stackable
 */
export interface Tome {
    id: string;
    name: string;
    description: string;
    tier: Tier;
    rarity?: Rarity; // Optional - not present in tomes.json
    image?: string;
    effect?: string; // Optional - not in JSON, use stat_affected
    priority?: number;
    stackable?: boolean; // Optional - not in JSON
    tags?: string[];
    // JSON properties (snake_case)
    stat_affected?: string;
    value_per_level?: string | number;
    max_level?: number;
    value_cap?: number;
    unlocked_by_default?: boolean;
    unlock_requirement?: string;
    unlock_cost_silver?: number;
    synergies_items?: string[];
    synergies_weapons?: string[];
    synergies_characters?: string[];
    // Modal properties
    notes?: string;
    recommended_for?: string[];
}

/**
 * Character base stats
 */
export interface CharacterStats {
    health: number;
    damage: number;
    speed: number;
    luck?: number;
}

/**
 * Character interface
 * Note: JSON uses passive_ability, not passive; no baseStats in JSON
 */
export interface Character {
    id: string;
    name: string;
    description?: string; // Optional - not present in characters.json
    tier: Tier;
    rarity?: Rarity; // Optional - not present in characters.json
    image?: string;
    baseStats?: CharacterStats; // Optional - not in JSON
    passive?: string; // Optional - legacy, use passive_ability
    startingWeapon?: string; // Optional - legacy, use starting_weapon
    tags?: string[];
    // JSON properties (snake_case)
    passive_ability?: string;
    passive_description?: string;
    starting_weapon?: string;
    synergies_weapons?: string[];
    synergies_items?: string[];
    synergies_tomes?: string[];
    playstyle?: string;
    base_hp?: number;
    base_damage?: number;
    unlock_requirement?: string;
    unlock_cost_silver?: number;
    unlocked_by_default?: boolean;
    best_for?: string[];
    strengths?: string[];
    weaknesses?: string[];
    build_tips?: string;
}

/**
 * Shrine interface
 * Note: JSON uses description + activation/reward, not effect
 */
export interface Shrine {
    id: string;
    name: string;
    description: string;
    tier: Tier;
    image?: string;
    effect?: string; // Optional - not in JSON, use description
    cost?: number | string;
    tags?: string[];
    type?: 'stat_upgrade' | 'stat_upgrade_legendary' | 'combat' | 'utility' | 'risk_reward';
    // JSON properties
    icon?: string;
    reusable?: boolean;
    reward?: string;
    activation?: string;
    spawn_count?: string;
    map_icon?: string;
    best_for?: string[];
    synergies_items?: string[];
    strategy?: string;
    notes?: string;
}

/**
 * Stats/Mechanics interface
 */
export interface Stats {
    version?: string;
    last_updated?: string;
    mechanics?: Record<string, unknown>;
    breakpoints?: Record<string, unknown>;
}

/**
 * Data collection wrapper types
 */
export interface ItemsData {
    version: string;
    last_updated: string;
    items: Item[];
}

export interface WeaponsData {
    version: string;
    last_updated: string;
    weapons: Weapon[];
}

export interface TomesData {
    version: string;
    last_updated: string;
    tomes: Tome[];
}

export interface CharactersData {
    version: string;
    last_updated: string;
    characters: Character[];
}

export interface ShrinesData {
    version: string;
    last_updated: string;
    shrines: Shrine[];
}

/**
 * All game data combined
 */
export interface AllGameData {
    items?: ItemsData;
    weapons?: WeaponsData;
    tomes?: TomesData;
    characters?: CharactersData;
    shrines?: ShrinesData;
    stats?: Stats;
    changelog?: ChangelogData;
}

/**
 * Changelog patch interface
 * Note: The changelog module extends this with ExtendedPatch to add categories and other fields
 */
export interface ChangelogPatch {
    id: string;
    version: string;
    date: string;
    title: string;
    changes: string[];
    additions?: string[];
    fixes?: string[];
    removals?: string[];
}

/**
 * Changelog data
 */
export interface ChangelogData {
    version: string;
    last_updated: string;
    patches: ChangelogPatch[];
}

/**
 * Filter options
 */
export interface FilterOptions {
    search?: string;
    tier?: Tier | Tier[];
    rarity?: Rarity | Rarity[];
    category?: string;
    tags?: string[];
}

/**
 * Sort options
 */
export type SortBy = 'name' | 'tier' | 'rarity';

/**
 * View mode
 */
export type ViewMode = 'grid' | 'list';

/**
 * Entity types (union of all game entities)
 */
export type Entity = Item | Weapon | Tome | Character | Shrine;

/**
 * Filtered data is just an array of entities
 */
export type FilteredData = Entity[];

/**
 * Favorites state structure - maps entity type to array of item IDs
 */
export interface FavoritesState {
    items: string[];
    weapons: string[];
    tomes: string[];
    characters: string[];
    shrines: string[];
}

/**
 * Build state structure for build planner
 */
export interface Build {
    character: Character | null;
    weapon: Weapon | null;
    tomes: Tome[];
    items: Item[];
    name?: string;
    notes?: string;
}

/**
 * Entity type discriminator
 */
export type EntityType = 'items' | 'weapons' | 'tomes' | 'characters' | 'shrines';

const SINGULAR_TO_ENTITY_TYPE: Record<string, EntityType> = {
    item: 'items',
    weapon: 'weapons',
    tome: 'tomes',
    character: 'characters',
    shrine: 'shrines',
};

const VALID_ENTITY_TYPES: ReadonlySet<string> = new Set<string>(['items', 'weapons', 'tomes', 'characters', 'shrines']);

/**
 * Normalize a singular or plural entity type string to a plural EntityType.
 * Returns undefined if the input doesn't match any known entity type.
 */
export function normalizeEntityType(type: string): EntityType | undefined {
    if (VALID_ENTITY_TYPES.has(type)) {
        return type as EntityType;
    }
    return SINGULAR_TO_ENTITY_TYPE[type];
}

/**
 * Validation result
 */
export interface ValidationResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    zodError?: unknown;
}

/**
 * Theme type
 */
export type Theme = 'dark' | 'light';

/**
 * Web Vitals metric name
 */
export type MetricName = 'CLS' | 'FCP' | 'LCP' | 'TTFB' | 'INP';

/**
 * Web Vitals rating
 */
export type MetricRating = 'good' | 'needs-improvement' | 'poor' | 'unknown';

/**
 * Web Vitals metric
 */
export interface Metric {
    name: MetricName;
    value: number;
    rating: MetricRating;
    delta: number;
    id: string;
}

/**
 * Stored metric
 */
export interface StoredMetric {
    value: number;
    rating: MetricRating;
    formattedValue: string;
    delta: number;
    id: string;
}

// ========================================
// Type Guards
// ========================================

/**
 * Type guard to check if entity is an Item
 * Items have rarity + tier but NOT weapon/tome/character/shrine specific fields
 */
export function isItem(entity: Entity | ChangelogPatch): entity is Item {
    return (
        'rarity' in entity &&
        'tier' in entity &&
        !('base_damage' in entity) &&
        !('attack_pattern' in entity) &&
        !('stat_affected' in entity) &&
        !('passive_ability' in entity) &&
        !('activation' in entity)
    );
}

/**
 * Type guard to check if entity is a Weapon
 * Weapons have base_damage or attack_pattern (from JSON)
 */
export function isWeapon(entity: Entity | ChangelogPatch): entity is Weapon {
    return 'base_damage' in entity || 'attack_pattern' in entity;
}

/**
 * Type guard to check if entity is a Tome
 * Tomes have stat_affected or value_per_level (from JSON)
 */
export function isTome(entity: Entity | ChangelogPatch): entity is Tome {
    return 'stat_affected' in entity || 'value_per_level' in entity;
}

/**
 * Type guard to check if entity is a Character
 * Characters have passive_ability (from JSON)
 */
export function isCharacter(entity: Entity | ChangelogPatch): entity is Character {
    return 'passive_ability' in entity;
}

/**
 * Type guard to check if entity is a Shrine
 * Shrines have activation or reward fields (from JSON)
 */
export function isShrine(entity: Entity | ChangelogPatch): entity is Shrine {
    return 'activation' in entity || 'reward' in entity;
}

/**
 * Type guard to check if entity is a ChangelogPatch
 */
export function isChangelogPatch(entity: Entity | ChangelogPatch): entity is ChangelogPatch {
    return 'version' in entity && 'changes' in entity;
}

// ========================================
// DOM Element Type Guards
// ========================================

/**
 * Type guard to check if element is an HTMLInputElement
 */
export function isInputElement(element: Element | null): element is HTMLInputElement {
    return element !== null && element.tagName === 'INPUT';
}

/**
 * Type guard to check if element is an HTMLSelectElement
 */
export function isSelectElement(element: Element | null): element is HTMLSelectElement {
    return element !== null && element.tagName === 'SELECT';
}

/**
 * Type guard to check if element is an HTMLButtonElement
 */
export function isButtonElement(element: Element | null): element is HTMLButtonElement {
    return element !== null && element.tagName === 'BUTTON';
}

/**
 * Type guard to check if element is an HTMLCanvasElement
 */
export function isCanvasElement(element: Element | null): element is HTMLCanvasElement {
    return element !== null && element.tagName === 'CANVAS';
}

/**
 * Type guard to check if value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard to check if value is an array
 */
export function isArray<T>(value: unknown): value is T[] {
    return Array.isArray(value);
}

/**
 * Type guard to check if value is a string
 */
export function isString(value: unknown): value is string {
    return typeof value === 'string';
}

/**
 * Type guard to check if value is a number
 */
export function isNumber(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value);
}

// ========================================
// Global Declarations
// ========================================

/**
 * Build-time constants defined in vite.build.config.js
 */
declare const __APP_VERSION__: string;
declare const __CACHE_VERSION__: string;

/**
 * Global objects and functions available throughout the application
 */
declare global {
    const allData: AllGameData;
    const ToastManager:
        | {
              error: (message: string) => void;
              success: (message: string) => void;
              warning: (message: string) => void;
              info: (message: string) => void;
          }
        | undefined;

    /**
     * Window extensions for MegaBonk app
     * These are assigned at runtime by various modules
     */
    interface Window {
        // State (from store.ts)
        // Note: currentTab uses string for flexibility with both TabName and general strings
        currentTab?: string;
        filteredData?: FilteredData;
        allData?: AllGameData;
        currentBuild?: Build;
        compareItems?: string[];
        favorites?: FavoritesState;

        // CV functions (from computer-vision.ts, computer-vision-enhanced.ts)
        initCV?: (gameData: AllGameData) => void;
        initEnhancedCV?: (gameData: AllGameData) => void;
        detectItemsWithEnhancedCV?: (
            imageDataUrl: string,
            strategyName?: string,
            progressCallback?: (progress: number, status: string) => void
        ) => Promise<unknown>;
        resetEnhancedCVState?: () => void;

        // Additional CV detection functions (for browser testing and advanced usage)
        detectItemsWithCV?: (
            imageDataUrl: string,
            progressCallback?: (progress: number, status: string) => void,
            useWorkers?: boolean
        ) => Promise<unknown[]>;
        detectGridPositions?: (width: number, height: number, gridSize?: number) => unknown[];
        detectItemCounts?: (imageDataUrl: string, cells: unknown[]) => Promise<Map<string, number>>;
        loadImageToCanvas?: (
            imageDataUrl: string,
            timeoutMs?: number
        ) => Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; width: number; height: number }>;
        calculateSimilarity?: (imageData1: ImageData, imageData2: ImageData) => number;
        calculateIoU?: (box1: unknown, box2: unknown) => number;
        nonMaxSuppression?: (detections: unknown[], iouThreshold?: number) => unknown[];
        getAdaptiveIconSizes?: (width: number, height: number) => number[];
        extractCountRegion?: (cell: unknown) => unknown;
        detectHotbarRegion?: (
            ctx: CanvasRenderingContext2D,
            width: number,
            height: number
        ) => { topY: number; bottomY: number; confidence: number };
        detectIconEdges?: (ctx: CanvasRenderingContext2D, width: number, bandRegion: unknown) => number[];
        detectIconScale?: (
            ctx: CanvasRenderingContext2D,
            width: number,
            height: number
        ) => { iconSize: number; confidence: number; method: string };
        resizeImageData?: (imageData: ImageData, targetWidth: number, targetHeight: number) => ImageData | null;
        fitsGrid?: (value: number, gridStart: number, spacing: number, tolerance: number) => boolean;
        verifyGridPattern?: (detections: unknown[], expectedIconSize: number) => unknown;
        runEnsembleDetection?: (
            ctx: CanvasRenderingContext2D,
            width: number,
            height: number,
            items: unknown[],
            cell: unknown
        ) => Promise<unknown>;
        getCVMetrics?: () => unknown;
        getDetectionConfig?: (width?: number, height?: number) => unknown;

        // CV color functions
        extractDominantColors?: (imageData: ImageData) => string[];
        getDominantColor?: (imageData: ImageData) => string;
        calculateColorVariance?: (imageData: ImageData) => number;
        isEmptyCell?: (imageData: ImageData) => boolean;
        detectBorderRarity?: (imageData: ImageData) => string | null;

        // CV region functions
        detectUIRegions?: (ctx: CanvasRenderingContext2D, width: number, height: number) => unknown;
        detectScreenType?: (ctx: CanvasRenderingContext2D, width: number, height: number) => string;

        // CV cache functions
        clearDetectionCache?: () => void;

        // OCR functions (from ocr.ts)
        initOCR?: (gameData: AllGameData) => void;
        terminateOCRWorker?: () => Promise<void>;
        isOCRWorkerActive?: () => boolean;

        // Scan build functions (from scan-build.ts, scan-build-enhanced.ts)
        initScanBuild?: (gameData: AllGameData) => void;
        initEnhancedScanBuild?: (gameData: AllGameData) => void;
        handleEnhancedHybridDetect?: (imageDataUrl: string) => Promise<unknown>;
        compareStrategiesOnImage?: (imageDataUrl: string) => Promise<unknown>;

        // Advisor functions (from advisor.ts)
        initAdvisor?: (gameData: AllGameData) => void;
        applyScannedBuild?: (state: unknown) => void;

        // UI functions (from events.ts, renderers.ts)
        // Note: These use string for flexibility with both TabName and general strings
        switchTab?: (tabId: string) => void;
        renderTabContent?: (tabId: string) => void;
        renderGlobalSearchResults?: (results: unknown[], currentTab?: string, searchQuery?: string) => void;

        // Filter functions (from filters.ts)
        clearFilters?: () => void;
        toggleTextExpand?: (element: HTMLElement) => void;
        globalSearch?: (query: string, allData: AllGameData) => unknown[];

        // Offline UI functions (from offline-ui.ts)
        recordDataSync?: () => void;
        getLastSyncTime?: () => number | null;
        updateOfflineIndicator?: (isOffline: boolean) => void;

        // Skeleton loader functions (from skeleton-loader.ts)
        showSkeletonLoading?: (containerId: string, count?: number, includeGraphs?: boolean) => void;
        hideSkeletonLoading?: (containerId: string) => void;
        showTabSkeleton?: (tabName: string) => void;
        hideTabSkeleton?: (tabName: string) => void;

        // Data service functions (from data-service.ts)
        loadAllData?: () => Promise<void>;

        // Test utilities (from test-utils.ts)
        testUtils?: {
            calculateAccuracyMetrics?: (...args: unknown[]) => unknown;
            calculateF1Score?: (...args: unknown[]) => unknown;
            detectResolution?: (width: number, height: number) => unknown;
            detectUILayout?: (...args: unknown[]) => unknown;
            generateTestReport?: (...args: unknown[]) => unknown;
            runAutomatedTest?: (...args: unknown[]) => unknown;
            compareDetectionResults?: (...args: unknown[]) => unknown;
            getGridPositions?: (width: number, height: number) => unknown[];
        };
    }
}
