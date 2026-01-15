/**
 * Real Integration Tests for Schema Validator Module
 * No mocking - tests actual Zod schema validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    validateItems,
    validateWeapons,
    validateTomes,
    validateCharacters,
    validateShrines,
    validateStats,
    validateAllData,
    validateData,
    schemas,
} from '../../src/modules/schema-validator.ts';

// Suppress logger output during tests
beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
});

// ========================================
// Test Fixtures
// ========================================

const validItem = {
    id: 'test_item',
    name: 'Test Item',
    rarity: 'rare' as const,
    tier: 'A' as const,
};

const validWeapon = {
    id: 'test_weapon',
    name: 'Test Weapon',
    tier: 'S' as const,
};

const validTome = {
    id: 'test_tome',
    name: 'Test Tome',
    tier: 'A' as const,
};

const validCharacter = {
    id: 'test_char',
    name: 'Test Character',
    tier: 'SS' as const,
};

const validShrine = {
    id: 'test_shrine',
    name: 'Test Shrine',
};

// ========================================
// validateItems Tests
// ========================================

describe('validateItems - Real Integration Tests', () => {
    it('should validate valid items data', () => {
        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
            items: [validItem],
        };

        const result = validateItems(data);

        expect(result.success).toBe(true);
        expect(result.data?.items).toHaveLength(1);
    });

    it('should fail for missing version', () => {
        const data = {
            last_updated: '2024-01-01',
            items: [validItem],
        };

        const result = validateItems(data);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid items data');
    });

    it('should fail for missing items array', () => {
        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
        };

        const result = validateItems(data);

        expect(result.success).toBe(false);
    });

    it('should fail for invalid item in array', () => {
        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
            items: [{ invalid: true }],
        };

        const result = validateItems(data);

        expect(result.success).toBe(false);
    });

    it('should validate item with all optional fields', () => {
        const fullItem = {
            ...validItem,
            unlocked_by_default: true,
            unlock_requirement: 'Complete tutorial',
            unlock_cost_silver: 1000,
            base_effect: '+10% damage',
            scaling_type: 'linear',
            stacking_behavior: 'additive',
            stacks_well: true,
            stack_cap: 5,
            formula: 'base * stacks',
            detailed_description: 'A detailed description',
            synergies: ['Other Item'],
            anti_synergies: ['Bad Item'],
            notes: 'Some notes',
            one_and_done: false,
            image: 'item.png',
        };

        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
            items: [fullItem],
        };

        const result = validateItems(data);

        expect(result.success).toBe(true);
    });

    it('should allow extra fields with passthrough', () => {
        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
            items: [validItem],
            total_items: 1,
            custom_field: 'allowed',
        };

        const result = validateItems(data);

        expect(result.success).toBe(true);
    });

    it('should validate all rarity values', () => {
        const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

        rarities.forEach(rarity => {
            const data = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                items: [{ ...validItem, rarity }],
            };

            const result = validateItems(data);
            expect(result.success).toBe(true);
        });
    });

    it('should validate all tier values', () => {
        const tiers = ['SS', 'S', 'A', 'B', 'C'];

        tiers.forEach(tier => {
            const data = {
                version: '1.0.0',
                last_updated: '2024-01-01',
                items: [{ ...validItem, tier }],
            };

            const result = validateItems(data);
            expect(result.success).toBe(true);
        });
    });

    it('should fail for invalid rarity', () => {
        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
            items: [{ ...validItem, rarity: 'invalid' }],
        };

        const result = validateItems(data);

        expect(result.success).toBe(false);
    });

    it('should fail for invalid tier', () => {
        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
            items: [{ ...validItem, tier: 'X' }],
        };

        const result = validateItems(data);

        expect(result.success).toBe(false);
    });
});

// ========================================
// validateWeapons Tests
// ========================================

describe('validateWeapons - Real Integration Tests', () => {
    it('should validate valid weapons data', () => {
        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
            weapons: [validWeapon],
        };

        const result = validateWeapons(data);

        expect(result.success).toBe(true);
        expect(result.data?.weapons).toHaveLength(1);
    });

    it('should fail for missing weapons array', () => {
        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
        };

        const result = validateWeapons(data);

        expect(result.success).toBe(false);
    });

    it('should validate weapon with optional fields', () => {
        const fullWeapon = {
            ...validWeapon,
            base_damage: 50,
            base_projectile_count: 1,
            attack_pattern: 'melee',
            upgradeable_stats: ['damage', 'speed'],
            unlock_requirement: 'Beat boss',
            unlock_cost_silver: 500,
            unlocked_by_default: false,
            description: 'A powerful weapon',
            best_for: ['ranged builds'],
            synergies_items: ['Fire Crystal'],
            synergies_tomes: ['Damage Tome'],
            synergies_characters: ['Fire Mage'],
            playstyle: 'aggressive',
            pros: ['High damage'],
            cons: ['Low speed'],
            image: 'weapon.png',
        };

        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
            weapons: [fullWeapon],
        };

        const result = validateWeapons(data);

        expect(result.success).toBe(true);
    });
});

// ========================================
// validateTomes Tests
// ========================================

describe('validateTomes - Real Integration Tests', () => {
    it('should validate valid tomes data', () => {
        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
            tomes: [validTome],
        };

        const result = validateTomes(data);

        expect(result.success).toBe(true);
        expect(result.data?.tomes).toHaveLength(1);
    });

    it('should fail for missing tomes array', () => {
        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
        };

        const result = validateTomes(data);

        expect(result.success).toBe(false);
    });

    it('should validate tome with optional fields', () => {
        const fullTome = {
            ...validTome,
            stat_affected: 'damage',
            value_per_level: '+5%',
            unlocked_by_default: true,
            unlock_requirement: null,
            unlock_cost_silver: 0,
            max_level: 10,
            description: 'Increases damage',
            priority: 1,
            recommended_for: ['damage builds'],
            synergies_items: ['Damage Crystal'],
            synergies_weapons: ['Fire Sword'],
            synergies_characters: ['Warrior'],
            notes: 'Best in slot',
            image: 'tome.png',
        };

        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
            tomes: [fullTome],
        };

        const result = validateTomes(data);

        expect(result.success).toBe(true);
    });
});

// ========================================
// validateCharacters Tests
// ========================================

describe('validateCharacters - Real Integration Tests', () => {
    it('should validate valid characters data', () => {
        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
            characters: [validCharacter],
        };

        const result = validateCharacters(data);

        expect(result.success).toBe(true);
        expect(result.data?.characters).toHaveLength(1);
    });

    it('should fail for missing characters array', () => {
        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
        };

        const result = validateCharacters(data);

        expect(result.success).toBe(false);
    });

    it('should validate character with optional fields', () => {
        const fullCharacter = {
            ...validCharacter,
            starting_weapon: 'Fire Staff',
            passive_ability: 'Inferno',
            passive_description: 'Burns enemies',
            unlock_requirement: 'Complete game',
            unlock_cost_silver: 2000,
            unlocked_by_default: false,
            playstyle: 'ranged',
            best_for: ['fire builds'],
            strengths: ['High AoE damage'],
            weaknesses: ['Low HP'],
            synergies_items: ['Fire Crystal'],
            synergies_tomes: ['Fire Tome'],
            synergies_weapons: ['Fire Staff'],
            build_tips: 'Stack fire damage',
            image: 'character.png',
        };

        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
            characters: [fullCharacter],
        };

        const result = validateCharacters(data);

        expect(result.success).toBe(true);
    });
});

// ========================================
// validateShrines Tests
// ========================================

describe('validateShrines - Real Integration Tests', () => {
    it('should validate valid shrines data', () => {
        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
            shrines: [validShrine],
        };

        const result = validateShrines(data);

        expect(result.success).toBe(true);
        expect(result.data?.shrines).toHaveLength(1);
    });

    it('should fail for missing shrines array', () => {
        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
        };

        const result = validateShrines(data);

        expect(result.success).toBe(false);
    });

    it('should validate shrine with optional fields', () => {
        const fullShrine = {
            ...validShrine,
            type: 'combat',
            icon: 'shrine_icon',
            description: 'A combat shrine',
            activation: 'interact',
            reward: 'Gold',
            reusable: true,
            spawn_count: '1-3',
            map_icon: 'map_shrine.png',
            best_for: ['farming'],
            synergies_items: ['Gold Finder'],
            strategy: 'Use early',
            notes: 'Good for gold',
            image: 'shrine.png',
        };

        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
            shrines: [fullShrine],
        };

        const result = validateShrines(data);

        expect(result.success).toBe(true);
    });
});

// ========================================
// validateStats Tests
// ========================================

describe('validateStats - Real Integration Tests', () => {
    it('should validate valid stats data', () => {
        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
        };

        const result = validateStats(data);

        expect(result.success).toBe(true);
    });

    it('should validate stats with mechanics', () => {
        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
            mechanics: {
                damage: { formula: 'base * multiplier' },
            },
        };

        const result = validateStats(data);

        expect(result.success).toBe(true);
    });

    it('should validate stats with breakpoints', () => {
        const data = {
            version: '1.0.0',
            breakpoints: {
                damage: [100, 200, 300],
            },
        };

        const result = validateStats(data);

        expect(result.success).toBe(true);
    });

    it('should validate empty stats object', () => {
        const data = {};

        const result = validateStats(data);

        expect(result.success).toBe(true);
    });
});

// ========================================
// validateAllData Tests
// ========================================

describe('validateAllData - Real Integration Tests', () => {
    it('should validate all data types', () => {
        const allData = {
            items: {
                version: '1.0.0',
                last_updated: '2024-01-01',
                items: [validItem],
            },
            weapons: {
                version: '1.0.0',
                last_updated: '2024-01-01',
                weapons: [validWeapon],
            },
            tomes: {
                version: '1.0.0',
                last_updated: '2024-01-01',
                tomes: [validTome],
            },
            characters: {
                version: '1.0.0',
                last_updated: '2024-01-01',
                characters: [validCharacter],
            },
            shrines: {
                version: '1.0.0',
                last_updated: '2024-01-01',
                shrines: [validShrine],
            },
            stats: {
                version: '1.0.0',
            },
        };

        const results = validateAllData(allData);

        expect(results.allValid).toBe(true);
        expect(results.items?.success).toBe(true);
        expect(results.weapons?.success).toBe(true);
        expect(results.tomes?.success).toBe(true);
        expect(results.characters?.success).toBe(true);
        expect(results.shrines?.success).toBe(true);
        expect(results.stats?.success).toBe(true);
    });

    it('should handle partial data', () => {
        const partialData = {
            items: {
                version: '1.0.0',
                last_updated: '2024-01-01',
                items: [validItem],
            },
        };

        const results = validateAllData(partialData);

        expect(results.items?.success).toBe(true);
        expect(results.weapons).toBeNull();
        expect(results.tomes).toBeNull();
    });

    it('should mark allValid false if any validation fails', () => {
        const invalidData = {
            items: {
                version: '1.0.0',
                last_updated: '2024-01-01',
                items: [{ invalid: true }], // Invalid item
            },
            weapons: {
                version: '1.0.0',
                last_updated: '2024-01-01',
                weapons: [validWeapon],
            },
        };

        const results = validateAllData(invalidData);

        expect(results.allValid).toBe(false);
        expect(results.items?.success).toBe(false);
        expect(results.weapons?.success).toBe(true);
    });

    it('should handle empty data object', () => {
        const results = validateAllData({});

        expect(results.allValid).toBe(true);
        expect(results.items).toBeNull();
        expect(results.weapons).toBeNull();
    });
});

// ========================================
// validateData Generic Tests
// ========================================

describe('validateData - Real Integration Tests', () => {
    it('should validate data against schema', () => {
        const data = {
            id: 'test',
            name: 'Test',
            tier: 'A' as const,
        };

        const result = validateData(data, schemas.Tome, 'tome');

        expect(result.success).toBe(true);
    });

    it('should return error for invalid data', () => {
        const data = {
            id: 123, // Should be string
            name: 'Test',
        };

        const result = validateData(data, schemas.Item, 'item');

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid item data');
    });

    it('should include Zod error for validation failures', () => {
        const data = {
            id: 123, // Invalid
        };

        const result = validateData(data, schemas.Item, 'item');

        expect(result.success).toBe(false);
        expect(result.zodError).toBeDefined();
    });
});

// ========================================
// Schemas Export Tests
// ========================================

describe('Schemas Export - Real Integration Tests', () => {
    it('should export Item schema', () => {
        expect(schemas.Item).toBeDefined();
    });

    it('should export Weapon schema', () => {
        expect(schemas.Weapon).toBeDefined();
    });

    it('should export Tome schema', () => {
        expect(schemas.Tome).toBeDefined();
    });

    it('should export Character schema', () => {
        expect(schemas.Character).toBeDefined();
    });

    it('should export Shrine schema', () => {
        expect(schemas.Shrine).toBeDefined();
    });

    it('should export Stats schema', () => {
        expect(schemas.Stats).toBeDefined();
    });

    it('should export data collection schemas', () => {
        expect(schemas.ItemsData).toBeDefined();
        expect(schemas.WeaponsData).toBeDefined();
        expect(schemas.TomesData).toBeDefined();
        expect(schemas.CharactersData).toBeDefined();
        expect(schemas.ShrinesData).toBeDefined();
    });
});

// ========================================
// Edge Cases
// ========================================

describe('Schema Validator Edge Cases', () => {
    it('should handle null values for nullable fields', () => {
        const item = {
            ...validItem,
            unlock_requirement: null,
            stack_cap: null,
        };

        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
            items: [item],
        };

        const result = validateItems(data);

        expect(result.success).toBe(true);
    });

    it('should handle empty arrays', () => {
        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
            items: [],
        };

        const result = validateItems(data);

        expect(result.success).toBe(true);
        expect(result.data?.items).toHaveLength(0);
    });

    it('should handle many items', () => {
        const items = Array.from({ length: 100 }, (_, i) => ({
            ...validItem,
            id: `item_${i}`,
            name: `Item ${i}`,
        }));

        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
            items,
        };

        const result = validateItems(data);

        expect(result.success).toBe(true);
        expect(result.data?.items).toHaveLength(100);
    });

    it('should handle unicode in strings', () => {
        const item = {
            ...validItem,
            name: '日本語アイテム 🔥',
            description: 'Unicode description: émojis 🎮',
        };

        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
            items: [item],
        };

        const result = validateItems(data);

        expect(result.success).toBe(true);
    });

    it('should handle very long strings', () => {
        const item = {
            ...validItem,
            detailed_description: 'A'.repeat(10000),
        };

        const data = {
            version: '1.0.0',
            last_updated: '2024-01-01',
            items: [item],
        };

        const result = validateItems(data);

        expect(result.success).toBe(true);
    });
});
