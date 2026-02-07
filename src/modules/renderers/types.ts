// ========================================
// Extended Type Definitions for Actual Data
// ========================================

import type {
    Item as BaseItem,
    Weapon as BaseWeapon,
    Tome as BaseTome,
    Character as BaseCharacter,
    Shrine as BaseShrine,
} from '../../types/index.ts';

/**
 * Extended Item interface matching actual data structure
 */
export interface Item extends BaseItem {
    base_effect: string;
    detailed_description: string;
    one_and_done?: boolean;
    stacks_well?: boolean;
    scaling_per_stack?: number[];
    graph_type?: string;
}

/**
 * Extended Weapon interface matching actual data structure
 */
export interface Weapon extends BaseWeapon {
    attack_pattern: string;
    upgradeable_stats?: string[];
}

/**
 * Extended Tome interface matching actual data structure
 */
export interface Tome extends BaseTome {
    stat_affected: string;
    value_per_level: string;
    priority: number;
}

/**
 * Extended Character interface matching actual data structure
 */
export interface Character extends BaseCharacter {
    passive_ability: string;
    passive_description: string;
    starting_weapon: string;
    playstyle: string;
}

/**
 * Extended Shrine interface matching actual data structure
 */
export interface Shrine extends BaseShrine {
    icon: string;
    type: 'stat_upgrade' | 'combat' | 'utility' | 'risk_reward';
    reward: string;
    reusable: boolean;
}
