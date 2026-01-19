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
 */
export interface Weapon {
    id: string;
    name: string;
    description: string;
    tier: Tier;
    rarity: Rarity;
    image?: string;
    baseDamage: number;
    attackSpeed: number;
    range?: number;
    upgrades?: WeaponUpgrade[];
    scaling?: Scaling;
    tags?: string[];
    // Build planner properties (snake_case from JSON)
    base_damage?: number;
    base_projectile_count?: number;
    attack_pattern?: string;
    upgradeable_stats?: string[] | string;
    unlock_requirement?: string;
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
 */
export interface Tome {
    id: string;
    name: string;
    description: string;
    tier: Tier;
    rarity: Rarity;
    image?: string;
    effect: string;
    priority?: number;
    stackable?: boolean;
    tags?: string[];
    // Build planner properties
    stat_affected?: string;
    value_per_level?: string | number;
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
 */
export interface Character {
    id: string;
    name: string;
    description: string;
    tier: Tier;
    rarity: Rarity;
    image?: string;
    baseStats: CharacterStats;
    passive: string;
    startingWeapon?: string;
    tags?: string[];
    // Build planner properties
    passive_ability?: string;
    synergies_weapons?: string[];
    synergies_items?: string[];
    // Modal properties
    passive_description?: string;
    starting_weapon?: string;
    playstyle?: string;
    base_hp?: number;
    base_damage?: number;
    unlock_requirement?: string;
    best_for?: string[];
    strengths?: string[];
    weaknesses?: string[];
    synergies_tomes?: string[];
    build_tips?: string;
}

/**
 * Shrine interface
 */
export interface Shrine {
    id: string;
    name: string;
    description: string;
    tier: Tier;
    image?: string;
    effect: string;
    cost?: number | string;
    tags?: string[];
    type?: 'stat_upgrade' | 'combat' | 'utility' | 'risk_reward';
    // Modal properties
    icon?: string;
    reusable?: boolean;
    reward?: string;
    activation?: string;
    spawn_count?: string;
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
 */
export function isItem(entity: Entity | ChangelogPatch): entity is Item {
    return (
        'rarity' in entity &&
        'tier' in entity &&
        !('baseDamage' in entity) &&
        !('effect' in entity) &&
        !('baseStats' in entity)
    );
}

/**
 * Type guard to check if entity is a Weapon
 */
export function isWeapon(entity: Entity | ChangelogPatch): entity is Weapon {
    return 'baseDamage' in entity || 'attackSpeed' in entity;
}

/**
 * Type guard to check if entity is a Tome
 */
export function isTome(entity: Entity | ChangelogPatch): entity is Tome {
    return 'effect' in entity && 'stackable' in entity;
}

/**
 * Type guard to check if entity is a Character
 */
export function isCharacter(entity: Entity | ChangelogPatch): entity is Character {
    return 'baseStats' in entity || 'passive' in entity;
}

/**
 * Type guard to check if entity is a Shrine
 */
export function isShrine(entity: Entity | ChangelogPatch): entity is Shrine {
    return 'effect' in entity && !('stackable' in entity) && !('baseDamage' in entity);
}

/**
 * Type guard to check if entity is a ChangelogPatch
 */
export function isChangelogPatch(entity: Entity | ChangelogPatch): entity is ChangelogPatch {
    return 'version' in entity && 'changes' in entity;
}

// ========================================
// Global Declarations
// ========================================

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

        // OCR functions (from ocr.ts)
        initOCR?: (gameData: AllGameData) => void;

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
        renderGlobalSearchResults?: (results: unknown[]) => void;

        // Filter functions (from filters.ts)
        clearFilters?: () => void;
        toggleTextExpand?: (element: HTMLElement) => void;
        globalSearch?: (query: string, allData: AllGameData) => unknown[];

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
