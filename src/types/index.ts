// ========================================
// MegaBonk Type Definitions
// ========================================
// Central type definitions for the entire application
// ========================================

/**
 * Rarity types
 */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

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
}
