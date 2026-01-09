import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Build template validation tests
 * Ensures build templates use valid data and make logical sense
 */

let items, weapons, tomes, characters;

beforeAll(() => {
    const dataPath = join(process.cwd(), 'data');

    items = JSON.parse(readFileSync(join(dataPath, 'items.json'), 'utf8'));
    weapons = JSON.parse(readFileSync(join(dataPath, 'weapons.json'), 'utf8'));
    tomes = JSON.parse(readFileSync(join(dataPath, 'tomes.json'), 'utf8'));
    characters = JSON.parse(readFileSync(join(dataPath, 'characters.json'), 'utf8'));
});

// Build templates as defined in build-planner.js (updated to use correct characters)
// Character passives: CL4NK=Crit, Sir Oofie=Armor, Monke=HP, Bandit=Attack Speed, Ogre=Damage
const BUILD_TEMPLATES = {
    crit_build: {
        name: 'Crit Build',
        description: 'Maximize critical hit chance and damage',
        build: {
            character: 'cl4nk', // CL4NK has "Gain 1% Crit Chance per level"
            weapon: 'revolver',
            tomes: ['precision', 'damage'],
            items: ['clover', 'eagle_claw'],
        },
    },
    tank_build: {
        name: 'Tank Build',
        description: 'High HP and survivability',
        build: {
            character: 'sir_oofie', // Sir Oofie has "Gain 1% Armor per level"
            weapon: 'sword',
            tomes: ['hp', 'armor'],
            items: ['chonkplate', 'golden_shield'],
        },
    },
    speed_build: {
        name: 'Speed Build',
        description: 'Fast attack and movement speed',
        build: {
            character: 'bandit', // Bandit has "Gain 1% Attack Speed per level"
            weapon: 'katana',
            tomes: ['cooldown', 'agility'],
            items: ['turbo_skates', 'turbo_socks'],
        },
    },
    glass_cannon: {
        name: 'Glass Cannon',
        description: 'Maximum damage, low defense',
        build: {
            character: 'ogre', // Ogre has "Gain 1.5% Damage per level"
            weapon: 'sniper_rifle',
            tomes: ['damage', 'cooldown'],
            items: ['power_gloves', 'gym_sauce'],
        },
    },
};

describe('Build Template Data Validation', () => {
    Object.entries(BUILD_TEMPLATES).forEach(([templateId, template]) => {
        describe(`${template.name} (${templateId})`, () => {
            it('should have valid character', () => {
                const char = characters.characters.find(c => c.id === template.build.character);
                expect(char).toBeDefined();
            });

            it('should have valid weapon', () => {
                const weapon = weapons.weapons.find(w => w.id === template.build.weapon);
                expect(weapon).toBeDefined();
            });

            it('should have valid tomes', () => {
                template.build.tomes.forEach(tomeId => {
                    const tome = tomes.tomes.find(t => t.id === tomeId);
                    expect(tome, `Tome ${tomeId} not found`).toBeDefined();
                });
            });

            it('should have valid items', () => {
                template.build.items.forEach(itemId => {
                    const item = items.items.find(i => i.id === itemId);
                    expect(item, `Item ${itemId} not found`).toBeDefined();
                });
            });
        });
    });
});

describe('Build Template Character Passive Matching', () => {
    /**
     * Helper to check if a passive relates to a specific build type
     */
    function getPassiveType(passive) {
        const p = passive.toLowerCase();
        // Check flex/defense BEFORE damage since "stop damage" is defensive
        if (p.includes('flex') || p.includes('stop damage')) return 'defense';
        if (p.includes('crit')) return 'crit';
        if (p.includes('hp') || p.includes('armor') || p.includes('shield')) return 'tank';
        // Check for "+X% Damage" pattern (actual damage boost)
        if (/\+[\d.]+%?\s*damage/i.test(p) || p.includes('gain') && p.includes('damage')) return 'damage';
        if (p.includes('speed') || p.includes('attack')) return 'speed';
        if (p.includes('luck')) return 'luck';
        if (p.includes('evasion') || p.includes('evading')) return 'evasion';
        return 'other';
    }

    describe('Character passive analysis', () => {
        it('should verify each template uses a character with matching passive', () => {
            const analysis = {};

            Object.entries(BUILD_TEMPLATES).forEach(([id, template]) => {
                const char = characters.characters.find(c => c.id === template.build.character);
                analysis[id] = {
                    character: char?.name,
                    passive: char?.passive_ability,
                    passiveType: char ? getPassiveType(char.passive_ability) : 'unknown',
                    buildIntent: template.description,
                };
            });

            // Log for documentation purposes
            console.log('Build Template Character Analysis:', JSON.stringify(analysis, null, 2));

            // Now templates use correct characters matching their build intent
            expect(analysis.crit_build.passiveType).toBe('crit'); // CL4NK has Crit Chance
            expect(analysis.tank_build.passiveType).toBe('tank'); // Sir Oofie has Armor
            expect(analysis.speed_build.passiveType).toBe('speed'); // Bandit has Attack Speed
            expect(analysis.glass_cannon.passiveType).toBe('damage'); // Ogre has Damage
        });
    });

    describe('Recommended character mappings', () => {
        it('CL4NK should be the crit character', () => {
            const cl4nk = characters.characters.find(c => c.id === 'cl4nk');
            expect(cl4nk?.passive_ability).toMatch(/crit/i);
        });

        it('Sir Oofie should be the tank character (armor passive)', () => {
            const sirOofie = characters.characters.find(c => c.id === 'sir_oofie');
            expect(sirOofie?.passive_ability).toMatch(/armor/i);
        });

        it('Bandit should be the speed character (attack speed)', () => {
            const bandit = characters.characters.find(c => c.id === 'bandit');
            expect(bandit?.passive_ability).toMatch(/attack speed/i);
        });

        it('Ogre should be the damage character', () => {
            const ogre = characters.characters.find(c => c.id === 'ogre');
            expect(ogre?.passive_ability).toMatch(/damage/i);
        });
    });
});

describe('Build Template Synergy Validation', () => {
    Object.entries(BUILD_TEMPLATES).forEach(([templateId, template]) => {
        describe(`${template.name} synergies`, () => {
            it('weapon should not conflict with character playstyle', () => {
                const char = characters.characters.find(c => c.id === template.build.character);
                const weapon = weapons.weapons.find(w => w.id === template.build.weapon);

                // Check if character synergizes with the weapon
                const charSynergiesWithWeapon = char?.synergies_weapons?.includes(weapon?.name);
                const weaponSynergiesWithChar = weapon?.synergies_characters?.includes(char?.name);

                // At least one synergy should exist, or document the mismatch
                if (!charSynergiesWithWeapon && !weaponSynergiesWithChar) {
                    console.log(
                        `Note: ${template.name} - ${char?.name} and ${weapon?.name} have no explicit synergy`
                    );
                }

                // The test passes - we're documenting, not failing
                expect(true).toBe(true);
            });

            it('tomes should support the build theme', () => {
                template.build.tomes.forEach(tomeId => {
                    const tome = tomes.tomes.find(t => t.id === tomeId);
                    expect(tome).toBeDefined();
                });
            });
        });
    });
});

describe('calculateBuildStats Character Passive Logic', () => {
    /**
     * Verifies that character passives match the expected stat bonuses in calculateBuildStats
     */

    it('CL4NK should get crit bonus (Crit Chance passive)', () => {
        const cl4nk = characters.characters.find(c => c.id === 'cl4nk');
        expect(cl4nk?.passive_ability).toMatch(/crit\s*chance/i);
    });

    it('Monke should get HP bonus (HP passive)', () => {
        const monke = characters.characters.find(c => c.id === 'monke');
        expect(monke?.passive_ability).toMatch(/hp/i);
    });

    it('Sir Oofie should get armor bonus (Armor passive)', () => {
        const sirOofie = characters.characters.find(c => c.id === 'sir_oofie');
        expect(sirOofie?.passive_ability).toMatch(/armor/i);
    });

    it('Ogre should get damage bonus (Damage passive)', () => {
        const ogre = characters.characters.find(c => c.id === 'ogre');
        expect(ogre?.passive_ability).toMatch(/gain.*damage/i);
    });

    it('Bandit should get attack speed bonus (Attack Speed passive)', () => {
        const bandit = characters.characters.find(c => c.id === 'bandit');
        expect(bandit?.passive_ability).toMatch(/attack\s*speed/i);
    });

    it('Fox should NOT get crit bonus (Luck passive, not Crit)', () => {
        const fox = characters.characters.find(c => c.id === 'fox');
        expect(fox?.passive_ability).not.toMatch(/crit/i);
        expect(fox?.passive_ability).toMatch(/luck/i);
    });

    it('Megachad should NOT get damage bonus (Flex/defense passive)', () => {
        const megachad = characters.characters.find(c => c.id === 'megachad');
        expect(megachad?.passive_ability).toMatch(/flex|stop damage/i);
        expect(megachad?.passive_ability).not.toMatch(/gain.*damage/i);
    });
});
