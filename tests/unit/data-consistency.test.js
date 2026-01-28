import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Data consistency tests - validates cross-references and data integrity
 * These tests load the actual data files to ensure consistency
 */

let items, weapons, tomes, characters, shrines;
let itemIds, weaponIds, tomeIds, charIds;
let itemNames, weaponNames, tomeNames, charNames;

beforeAll(() => {
    const dataPath = join(process.cwd(), 'data');

    items = JSON.parse(readFileSync(join(dataPath, 'items.json'), 'utf8'));
    weapons = JSON.parse(readFileSync(join(dataPath, 'weapons.json'), 'utf8'));
    tomes = JSON.parse(readFileSync(join(dataPath, 'tomes.json'), 'utf8'));
    characters = JSON.parse(readFileSync(join(dataPath, 'characters.json'), 'utf8'));
    shrines = JSON.parse(readFileSync(join(dataPath, 'shrines.json'), 'utf8'));

    itemIds = new Set(items.items.map(i => i.id));
    weaponIds = new Set(weapons.weapons.map(w => w.id));
    tomeIds = new Set(tomes.tomes.map(t => t.id));
    charIds = new Set(characters.characters.map(c => c.id));

    itemNames = new Set(items.items.map(i => i.name));
    weaponNames = new Set(weapons.weapons.map(w => w.name));
    tomeNames = new Set(tomes.tomes.map(t => t.name));
    charNames = new Set(characters.characters.map(c => c.name));
});

describe('Data File Metadata', () => {
    describe('Version Consistency', () => {
        it('should have matching versions across core data files', () => {
            // All data files should have the same version for consistency
            const versions = [weapons.version, tomes.version, characters.version];

            // Check that weapon/tome/character versions match
            expect(new Set(versions).size).toBe(1);
        });

        it('should have valid version format', () => {
            [items, weapons, tomes, characters].forEach(data => {
                expect(data.version).toMatch(/^\d+\.\d+\.\d+$/);
            });
        });

        it('should have valid last_updated date format', () => {
            [items, weapons, tomes, characters].forEach(data => {
                expect(data.last_updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            });
        });
    });

    describe('Total Count Validation', () => {
        it('items total_items should match actual count', () => {
            expect(items.total_items).toBe(items.items.length);
        });

        it('weapons total_weapons should match actual count', () => {
            expect(weapons.total_weapons).toBe(weapons.weapons.length);
        });

        it('tomes total_tomes should match actual count', () => {
            expect(tomes.total_tomes).toBe(tomes.tomes.length);
        });
    });
});

describe('Unique ID Validation', () => {
    it('all items should have unique IDs', () => {
        const ids = items.items.map(i => i.id);
        const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
        expect(dupes).toEqual([]);
    });

    it('all weapons should have unique IDs', () => {
        const ids = weapons.weapons.map(w => w.id);
        const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
        expect(dupes).toEqual([]);
    });

    it('all tomes should have unique IDs', () => {
        const ids = tomes.tomes.map(t => t.id);
        const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
        expect(dupes).toEqual([]);
    });

    it('all characters should have unique IDs', () => {
        const ids = characters.characters.map(c => c.id);
        const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
        expect(dupes).toEqual([]);
    });
});

describe('Required Fields Validation', () => {
    describe('Items', () => {
        it('all items should have required fields', () => {
            items.items.forEach(item => {
                expect(item.id, `Item ${item.name || 'unknown'} missing id`).toBeTruthy();
                expect(item.name, `Item ${item.id} missing name`).toBeTruthy();
                expect(item.tier, `Item ${item.name} missing tier`).toBeTruthy();
                expect(item.rarity, `Item ${item.name} missing rarity`).toBeTruthy();
            });
        });

        it('all items should have valid tier values', () => {
            const validTiers = ['SS', 'S', 'A', 'B', 'C'];
            items.items.forEach(item => {
                expect(validTiers).toContain(item.tier);
            });
        });

        it('all items should have valid rarity values', () => {
            const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
            items.items.forEach(item => {
                expect(validRarities).toContain(item.rarity);
            });
        });
    });

    describe('Weapons', () => {
        it('all weapons should have required fields', () => {
            weapons.weapons.forEach(weapon => {
                expect(weapon.id, `Weapon ${weapon.name || 'unknown'} missing id`).toBeTruthy();
                expect(weapon.name, `Weapon ${weapon.id} missing name`).toBeTruthy();
                expect(weapon.tier, `Weapon ${weapon.name} missing tier`).toBeTruthy();
                expect(weapon.base_damage, `Weapon ${weapon.name} missing base_damage`).toBeDefined();
            });
        });
    });

    describe('Characters', () => {
        it('all characters should have required fields', () => {
            characters.characters.forEach(char => {
                expect(char.id, `Character ${char.name || 'unknown'} missing id`).toBeTruthy();
                expect(char.name, `Character ${char.id} missing name`).toBeTruthy();
                expect(char.tier, `Character ${char.name} missing tier`).toBeTruthy();
                expect(char.starting_weapon, `Character ${char.name} missing starting_weapon`).toBeTruthy();
                expect(char.passive_ability, `Character ${char.name} missing passive_ability`).toBeTruthy();
            });
        });
    });

    describe('Tomes', () => {
        it('all tomes should have required fields', () => {
            tomes.tomes.forEach(tome => {
                expect(tome.id, `Tome ${tome.name || 'unknown'} missing id`).toBeTruthy();
                expect(tome.name, `Tome ${tome.id} missing name`).toBeTruthy();
                expect(tome.tier, `Tome ${tome.name} missing tier`).toBeTruthy();
                expect(tome.stat_affected, `Tome ${tome.name} missing stat_affected`).toBeTruthy();
            });
        });
    });
});

describe('Cross-Reference Validation', () => {
    describe('Character Starting Weapons', () => {
        it('all character starting_weapons should exist in weapons.json', () => {
            const invalidStartingWeapons = [];

            characters.characters.forEach(char => {
                // starting_weapon now uses snake_case IDs
                if (!weaponIds.has(char.starting_weapon)) {
                    invalidStartingWeapons.push({
                        character: char.name,
                        weapon: char.starting_weapon,
                    });
                }
            });

            expect(invalidStartingWeapons).toEqual([]);
        });
    });

    describe('Weapon Synergies', () => {
        it('weapon synergies_characters should reference valid character names', () => {
            const invalid = [];

            weapons.weapons.forEach(weapon => {
                (weapon.synergies_characters || []).forEach(syn => {
                    // Skip generic references
                    if (syn.includes('All ')) return;

                    if (!charNames.has(syn)) {
                        invalid.push({
                            weapon: weapon.name,
                            reference: syn,
                        });
                    }
                });
            });

            expect(invalid).toEqual([]);
        });
    });

    describe('Character Synergies', () => {
        it('character synergies_weapons should reference valid weapon IDs', () => {
            const invalid = [];

            characters.characters.forEach(char => {
                (char.synergies_weapons || []).forEach(syn => {
                    // synergies_weapons now uses snake_case IDs
                    if (!weaponIds.has(syn)) {
                        invalid.push({
                            character: char.name,
                            reference: syn,
                        });
                    }
                });
            });

            expect(invalid).toEqual([]);
        });
    });

    describe('Tome Synergies', () => {
        it('tome synergies_weapons should reference valid weapon IDs', () => {
            const invalid = [];

            tomes.tomes.forEach(tome => {
                (tome.synergies_weapons || []).forEach(syn => {
                    // synergies_weapons now uses snake_case IDs
                    if (!weaponIds.has(syn)) {
                        invalid.push({
                            tome: tome.name,
                            reference: syn,
                        });
                    }
                });
            });

            expect(invalid).toEqual([]);
        });
    });
});

describe('Build Templates Validation', () => {
    // These match the BUILD_TEMPLATES in build-planner.js (updated)
    // Character passives: CL4NK=Crit, Sir Oofie=Armor, Monke=HP, Bandit=Attack Speed, Ogre=Damage
    const BUILD_TEMPLATES = {
        crit_build: {
            character: 'cl4nk', // CL4NK has "Gain 1% Crit Chance per level"
            weapon: 'revolver',
            tomes: ['precision', 'damage'],
            items: ['clover', 'eagle_claw'],
        },
        tank_build: {
            character: 'sir_oofie', // Sir Oofie has "Gain 1% Armor per level"
            weapon: 'sword',
            tomes: ['hp', 'armor'],
            items: ['chonkplate', 'golden_shield'],
        },
        speed_build: {
            character: 'bandit', // Bandit has "Gain 1% Attack Speed per level"
            weapon: 'katana',
            tomes: ['cooldown', 'agility'],
            items: ['turbo_skates', 'turbo_socks'],
        },
        glass_cannon: {
            character: 'ogre', // Ogre has "Gain 1.5% Damage per level"
            weapon: 'sniper_rifle',
            tomes: ['damage', 'cooldown'],
            items: ['power_gloves', 'gym_sauce'],
        },
    };

    describe('Template Character IDs', () => {
        Object.entries(BUILD_TEMPLATES).forEach(([name, template]) => {
            it(`${name} should reference valid character ID`, () => {
                expect(charIds.has(template.character)).toBe(true);
            });
        });
    });

    describe('Template Weapon IDs', () => {
        Object.entries(BUILD_TEMPLATES).forEach(([name, template]) => {
            it(`${name} should reference valid weapon ID`, () => {
                expect(weaponIds.has(template.weapon)).toBe(true);
            });
        });
    });

    describe('Template Tome IDs', () => {
        Object.entries(BUILD_TEMPLATES).forEach(([name, template]) => {
            template.tomes.forEach(tomeId => {
                it(`${name} tome "${tomeId}" should be valid`, () => {
                    expect(tomeIds.has(tomeId)).toBe(true);
                });
            });
        });
    });

    describe('Template Item IDs', () => {
        Object.entries(BUILD_TEMPLATES).forEach(([name, template]) => {
            template.items.forEach(itemId => {
                it(`${name} item "${itemId}" should be valid`, () => {
                    expect(itemIds.has(itemId)).toBe(true);
                });
            });
        });
    });

    describe('Template Character-Build Logic Consistency', () => {
        it('crit_build should use a character with crit-related passive', () => {
            const char = characters.characters.find(c => c.id === BUILD_TEMPLATES.crit_build.character);

            // CL4NK has Crit Chance passive - correct match
            expect(char).toBeDefined();
            expect(char.passive_ability).toMatch(/crit/i);
        });

        it('tank_build should use a character with tank-related passive', () => {
            const char = characters.characters.find(c => c.id === BUILD_TEMPLATES.tank_build.character);

            // Sir Oofie has Armor passive - correct match for tank
            expect(char).toBeDefined();
            expect(char.passive_ability).toMatch(/armor/i);
        });

        it('speed_build should use a character with speed-related passive', () => {
            const char = characters.characters.find(c => c.id === BUILD_TEMPLATES.speed_build.character);

            // Bandit has Attack Speed passive - correct match
            expect(char).toBeDefined();
            expect(char.passive_ability).toMatch(/attack\s*speed/i);
        });

        it('glass_cannon should use a character with damage-related passive', () => {
            const char = characters.characters.find(c => c.id === BUILD_TEMPLATES.glass_cannon.character);

            // Ogre has Damage passive - correct match
            expect(char).toBeDefined();
            expect(char.passive_ability).toMatch(/damage/i);
        });
    });
});

describe('Item Scaling Data Integrity', () => {
    it('items with scaling_per_stack should have appropriate array length', () => {
        const issues = [];

        items.items.forEach(item => {
            if (item.scaling_per_stack && !Array.isArray(item.scaling_per_stack)) {
                issues.push(`${item.name}: scaling_per_stack is not an array`);
            }
            // One-and-done items should have exactly 1 value (no stacking benefit)
            // Stackable items should have 10 values for visualization
            if (item.scaling_per_stack) {
                const expectedLength = item.one_and_done === true ? 1 : 10;
                if (item.scaling_per_stack.length !== expectedLength) {
                    issues.push(
                        `${item.name}: scaling_per_stack has ${item.scaling_per_stack.length} values, expected ${expectedLength}`
                    );
                }
            }
        });

        expect(issues).toEqual([]);
    });

    it('one_and_done items should have stacking_behavior of "no_benefit"', () => {
        const inconsistent = [];

        items.items.forEach(item => {
            if (item.one_and_done === true && item.stacking_behavior !== 'no_benefit') {
                inconsistent.push({
                    item: item.name,
                    stacking_behavior: item.stacking_behavior,
                });
            }
        });

        expect(inconsistent).toEqual([]);
    });

    it('items with stacks_well:true should not be one_and_done', () => {
        const inconsistent = [];

        items.items.forEach(item => {
            if (item.stacks_well === true && item.one_and_done === true) {
                inconsistent.push(item.name);
            }
        });

        expect(inconsistent).toEqual([]);
    });
});

describe('Image Path Validation', () => {
    it('all items should have image path', () => {
        const missing = items.items.filter(i => !i.image).map(i => i.name);
        expect(missing).toEqual([]);
    });

    it('all weapons should have image path', () => {
        const missing = weapons.weapons.filter(w => !w.image).map(w => w.name);
        expect(missing).toEqual([]);
    });

    it('all characters should have image path', () => {
        const missing = characters.characters.filter(c => !c.image).map(c => c.name);
        expect(missing).toEqual([]);
    });

    it('all tomes should have image path', () => {
        const missing = tomes.tomes.filter(t => !t.image).map(t => t.name);
        expect(missing).toEqual([]);
    });
});
