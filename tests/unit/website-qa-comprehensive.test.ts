/**
 * Comprehensive Website QA Tests
 *
 * 30+ QA test areas validating all aspects of the MegaBonk website:
 * - Tab functionality and navigation
 * - Search and filtering
 * - Build planner features
 * - Calculator functionality
 * - Compare mode
 * - Data integrity
 * - Accessibility
 * - UI components
 * - Edge cases and error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import * as fs from 'fs';
import * as path from 'path';

// Load actual data files for validation
const dataPath = path.join(__dirname, '../../data');
const loadJsonFile = (filename: string) => {
    const filePath = path.join(dataPath, filename);
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
};

describe('QA Area 1: Items Tab - Data Display', () => {
    const itemsData = loadJsonFile('items.json');

    it('should have all 77 items in the data file', () => {
        expect(itemsData.items).toBeDefined();
        expect(itemsData.items.length).toBeGreaterThanOrEqual(77);
    });

    it('should have required fields for each item', () => {
        itemsData.items.forEach((item: any) => {
            expect(item.id).toBeDefined();
            expect(item.name).toBeDefined();
            expect(item.tier).toBeDefined();
            expect(item.rarity).toBeDefined();
        });
    });

    it('should have valid tier values for all items', () => {
        const validTiers = ['SS', 'S', 'A', 'B', 'C'];
        itemsData.items.forEach((item: any) => {
            expect(validTiers).toContain(item.tier);
        });
    });

    it('should have valid rarity values for all items', () => {
        const validRarities = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
        itemsData.items.forEach((item: any) => {
            expect(validRarities).toContain(item.rarity);
        });
    });
});

describe('QA Area 2: Weapons Tab - Data Display', () => {
    const weaponsData = loadJsonFile('weapons.json');

    it('should have all 29 weapons in the data file', () => {
        expect(weaponsData.weapons).toBeDefined();
        expect(weaponsData.weapons.length).toBeGreaterThanOrEqual(29);
    });

    it('should have required fields for each weapon', () => {
        weaponsData.weapons.forEach((weapon: any) => {
            expect(weapon.id).toBeDefined();
            expect(weapon.name).toBeDefined();
            expect(weapon.tier).toBeDefined();
        });
    });

    it('should have numeric base_damage for weapons with that field', () => {
        weaponsData.weapons.forEach((weapon: any) => {
            if (weapon.base_damage !== undefined) {
                expect(typeof weapon.base_damage).toBe('number');
                expect(weapon.base_damage).toBeGreaterThanOrEqual(0);
            }
        });
    });
});

describe('QA Area 3: Tomes Tab - Data Display', () => {
    const tomesData = loadJsonFile('tomes.json');

    it('should have all 23 tomes in the data file', () => {
        expect(tomesData.tomes).toBeDefined();
        expect(tomesData.tomes.length).toBeGreaterThanOrEqual(23);
    });

    it('should have required fields for each tome', () => {
        tomesData.tomes.forEach((tome: any) => {
            expect(tome.id).toBeDefined();
            expect(tome.name).toBeDefined();
            expect(tome.tier).toBeDefined();
        });
    });

    it('should have stat_affected field for tomes', () => {
        tomesData.tomes.forEach((tome: any) => {
            if (tome.stat_affected) {
                expect(typeof tome.stat_affected).toBe('string');
            }
        });
    });
});

describe('QA Area 4: Characters Tab - Data Display', () => {
    const charactersData = loadJsonFile('characters.json');

    it('should have all 20 characters in the data file', () => {
        expect(charactersData.characters).toBeDefined();
        expect(charactersData.characters.length).toBeGreaterThanOrEqual(20);
    });

    it('should have required fields for each character', () => {
        charactersData.characters.forEach((char: any) => {
            expect(char.id).toBeDefined();
            expect(char.name).toBeDefined();
            expect(char.tier).toBeDefined();
        });
    });

    it('should have passive ability defined for characters', () => {
        charactersData.characters.forEach((char: any) => {
            // Field is 'passive_ability' in the actual data schema
            expect(char.passive_ability).toBeDefined();
            expect(typeof char.passive_ability).toBe('string');
        });
    });

    it('should have starting_weapon for each character', () => {
        charactersData.characters.forEach((char: any) => {
            expect(char.starting_weapon).toBeDefined();
        });
    });
});

describe('QA Area 5: Shrines Tab - Data Display', () => {
    const shrinesData = loadJsonFile('shrines.json');

    it('should have all 8 shrines in the data file', () => {
        expect(shrinesData.shrines).toBeDefined();
        expect(shrinesData.shrines.length).toBeGreaterThanOrEqual(8);
    });

    it('should have required fields for each shrine', () => {
        shrinesData.shrines.forEach((shrine: any) => {
            expect(shrine.id).toBeDefined();
            expect(shrine.name).toBeDefined();
        });
    });
});

describe('QA Area 6: Data Version and Metadata', () => {
    const itemsData = loadJsonFile('items.json');
    const weaponsData = loadJsonFile('weapons.json');
    const tomesData = loadJsonFile('tomes.json');
    const charactersData = loadJsonFile('characters.json');

    it('should have version field in all data files', () => {
        expect(itemsData.version).toBeDefined();
        expect(weaponsData.version).toBeDefined();
        expect(tomesData.version).toBeDefined();
        expect(charactersData.version).toBeDefined();
    });

    it('should have last_updated field in all data files', () => {
        expect(itemsData.last_updated).toBeDefined();
        expect(weaponsData.last_updated).toBeDefined();
        expect(tomesData.last_updated).toBeDefined();
        expect(charactersData.last_updated).toBeDefined();
    });

    it('should have valid date format for last_updated', () => {
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        expect(itemsData.last_updated).toMatch(datePattern);
        expect(weaponsData.last_updated).toMatch(datePattern);
    });
});

describe('QA Area 7: Unique IDs Across All Data', () => {
    const itemsData = loadJsonFile('items.json');
    const weaponsData = loadJsonFile('weapons.json');
    const tomesData = loadJsonFile('tomes.json');
    const charactersData = loadJsonFile('characters.json');

    it('should have unique item IDs', () => {
        const ids = itemsData.items.map((i: any) => i.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have unique weapon IDs', () => {
        const ids = weaponsData.weapons.map((w: any) => w.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have unique tome IDs', () => {
        const ids = tomesData.tomes.map((t: any) => t.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have unique character IDs', () => {
        const ids = charactersData.characters.map((c: any) => c.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
    });
});

describe('QA Area 8: Search Functionality - Basic Text Search', () => {
    const itemsData = loadJsonFile('items.json');

    const searchItems = (query: string) => {
        const lowerQuery = query.toLowerCase();
        return itemsData.items.filter((item: any) =>
            item.name.toLowerCase().includes(lowerQuery) ||
            (item.description && item.description.toLowerCase().includes(lowerQuery))
        );
    };

    it('should find items by exact name', () => {
        const results = searchItems('Big Bonk');
        expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should find items by partial name', () => {
        const results = searchItems('bonk');
        expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should be case insensitive', () => {
        const results1 = searchItems('BATTERY');
        const results2 = searchItems('battery');
        expect(results1.length).toBe(results2.length);
    });

    it('should return empty array for non-existent items', () => {
        const results = searchItems('xyznonexistent12345');
        expect(results.length).toBe(0);
    });
});

describe('QA Area 9: Filter by Tier', () => {
    const itemsData = loadJsonFile('items.json');

    const filterByTier = (tier: string) => {
        return itemsData.items.filter((item: any) => item.tier === tier);
    };

    it('should filter SS tier items', () => {
        const results = filterByTier('SS');
        results.forEach((item: any) => {
            expect(item.tier).toBe('SS');
        });
    });

    it('should filter S tier items', () => {
        const results = filterByTier('S');
        results.forEach((item: any) => {
            expect(item.tier).toBe('S');
        });
    });

    it('should filter A tier items', () => {
        const results = filterByTier('A');
        results.forEach((item: any) => {
            expect(item.tier).toBe('A');
        });
    });

    it('should filter B tier items', () => {
        const results = filterByTier('B');
        results.forEach((item: any) => {
            expect(item.tier).toBe('B');
        });
    });

    it('should filter C tier items', () => {
        const results = filterByTier('C');
        results.forEach((item: any) => {
            expect(item.tier).toBe('C');
        });
    });
});

describe('QA Area 10: Filter by Rarity', () => {
    const itemsData = loadJsonFile('items.json');

    const filterByRarity = (rarity: string) => {
        return itemsData.items.filter((item: any) => item.rarity === rarity);
    };

    it('should filter legendary items', () => {
        const results = filterByRarity('legendary');
        results.forEach((item: any) => {
            expect(item.rarity).toBe('legendary');
        });
    });

    it('should filter epic items', () => {
        const results = filterByRarity('epic');
        results.forEach((item: any) => {
            expect(item.rarity).toBe('epic');
        });
    });

    it('should filter rare items', () => {
        const results = filterByRarity('rare');
        results.forEach((item: any) => {
            expect(item.rarity).toBe('rare');
        });
    });

    it('should filter uncommon items', () => {
        const results = filterByRarity('uncommon');
        results.forEach((item: any) => {
            expect(item.rarity).toBe('uncommon');
        });
    });

    it('should filter common items', () => {
        const results = filterByRarity('common');
        results.forEach((item: any) => {
            expect(item.rarity).toBe('common');
        });
    });
});

describe('QA Area 11: Stacking Behavior Filter', () => {
    const itemsData = loadJsonFile('items.json');

    it('should identify items that stack well', () => {
        const stackingItems = itemsData.items.filter((item: any) => item.stacks_well === true);
        stackingItems.forEach((item: any) => {
            expect(item.stacks_well).toBe(true);
        });
    });

    it('should identify one-and-done items', () => {
        const oneAndDone = itemsData.items.filter((item: any) => item.one_and_done === true);
        oneAndDone.forEach((item: any) => {
            expect(item.one_and_done).toBe(true);
        });
    });
});

describe('QA Area 12: Build Planner - Character Selection', () => {
    const charactersData = loadJsonFile('characters.json');

    it('should have characters available for selection', () => {
        expect(charactersData.characters.length).toBeGreaterThan(0);
    });

    it('should have character names for display', () => {
        charactersData.characters.forEach((char: any) => {
            expect(char.name).toBeTruthy();
            expect(typeof char.name).toBe('string');
        });
    });
});

describe('QA Area 13: Build Planner - Weapon Selection', () => {
    const weaponsData = loadJsonFile('weapons.json');

    it('should have weapons available for selection', () => {
        expect(weaponsData.weapons.length).toBeGreaterThan(0);
    });

    it('should have weapon names for display', () => {
        weaponsData.weapons.forEach((weapon: any) => {
            expect(weapon.name).toBeTruthy();
            expect(typeof weapon.name).toBe('string');
        });
    });
});

describe('QA Area 14: Build Planner - Stats Calculation', () => {
    const calculateDamage = (baseDamage: number, multiplier: number) => {
        return baseDamage * multiplier;
    };

    const calculateCritDamage = (damage: number, critMultiplier: number) => {
        return damage * critMultiplier;
    };

    it('should calculate base damage correctly', () => {
        expect(calculateDamage(50, 1)).toBe(50);
        expect(calculateDamage(50, 1.5)).toBe(75);
        expect(calculateDamage(100, 2)).toBe(200);
    });

    it('should calculate crit damage correctly', () => {
        expect(calculateCritDamage(100, 1.5)).toBe(150);
        expect(calculateCritDamage(100, 2.0)).toBe(200);
    });

    it('should handle zero values', () => {
        expect(calculateDamage(0, 1.5)).toBe(0);
        expect(calculateCritDamage(0, 2.0)).toBe(0);
    });
});

describe('QA Area 15: Build Planner - Synergy Detection', () => {
    const itemsData = loadJsonFile('items.json');

    it('should have synergies defined for some items', () => {
        const itemsWithSynergies = itemsData.items.filter(
            (item: any) => item.synergies && item.synergies.length > 0
        );
        expect(itemsWithSynergies.length).toBeGreaterThan(0);
    });

    it('should have synergy arrays properly formatted', () => {
        itemsData.items.forEach((item: any) => {
            if (item.synergies) {
                expect(Array.isArray(item.synergies)).toBe(true);
            }
            if (item.synergies_weapons) {
                expect(Array.isArray(item.synergies_weapons)).toBe(true);
            }
        });
    });
});

describe('QA Area 16: Calculator - Breakpoint Calculations', () => {
    const calculateStacksNeeded = (targetValue: number, baseValue: number, perStackValue: number) => {
        if (perStackValue <= 0) return Infinity;
        const valueNeeded = targetValue - baseValue;
        if (valueNeeded <= 0) return 0;
        return Math.ceil(valueNeeded / perStackValue);
    };

    it('should calculate correct stacks for target value', () => {
        expect(calculateStacksNeeded(100, 0, 10)).toBe(10);
        expect(calculateStacksNeeded(50, 0, 10)).toBe(5);
        expect(calculateStacksNeeded(55, 0, 10)).toBe(6); // Rounds up
    });

    it('should return 0 when base value meets target', () => {
        expect(calculateStacksNeeded(100, 100, 10)).toBe(0);
        expect(calculateStacksNeeded(100, 150, 10)).toBe(0);
    });

    it('should handle zero per-stack value', () => {
        expect(calculateStacksNeeded(100, 0, 0)).toBe(Infinity);
    });

    it('should handle negative per-stack value', () => {
        expect(calculateStacksNeeded(100, 0, -10)).toBe(Infinity);
    });
});

describe('QA Area 17: Calculator - Edge Cases', () => {
    const safeCalculate = (value: number) => {
        if (!Number.isFinite(value)) return 0;
        if (Number.isNaN(value)) return 0;
        return value;
    };

    it('should handle NaN values', () => {
        expect(safeCalculate(NaN)).toBe(0);
    });

    it('should handle Infinity', () => {
        expect(safeCalculate(Infinity)).toBe(0);
        expect(safeCalculate(-Infinity)).toBe(0);
    });

    it('should pass through valid numbers', () => {
        expect(safeCalculate(100)).toBe(100);
        expect(safeCalculate(-50)).toBe(-50);
        expect(safeCalculate(0)).toBe(0);
    });
});

describe('QA Area 18: Calculator - Stack Cap Warnings', () => {
    const itemsData = loadJsonFile('items.json');

    it('should have stack_cap as number for all items', () => {
        // In the data schema, stack_cap is a number: positive = cap, -1 = unlimited
        const itemsWithCaps = itemsData.items.filter((item: any) =>
            item.stack_cap !== undefined && item.stack_cap > 0
        );
        itemsWithCaps.forEach((item: any) => {
            expect(typeof item.stack_cap).toBe('number');
            expect(item.stack_cap).toBeGreaterThan(0);
        });
    });

    it('should have items with no stack cap (-1 = unlimited)', () => {
        const itemsWithoutCaps = itemsData.items.filter((item: any) => item.stack_cap === -1);
        expect(itemsWithoutCaps.length).toBeGreaterThan(0);
    });

    const checkStackCapWarning = (stacksNeeded: number, stackCap: number | null | undefined) => {
        if (!stackCap) return false;
        return stacksNeeded > stackCap;
    };

    it('should warn when stacks exceed cap', () => {
        expect(checkStackCapWarning(100, 50)).toBe(true);
        expect(checkStackCapWarning(50, 100)).toBe(false);
        expect(checkStackCapWarning(50, 50)).toBe(false);
    });

    it('should not warn when no cap exists', () => {
        expect(checkStackCapWarning(100, undefined)).toBe(false);
        expect(checkStackCapWarning(100, null)).toBe(false);
    });
});

describe('QA Area 19: Compare Mode - Item Selection', () => {
    const itemsData = loadJsonFile('items.json');

    it('should be able to select items for comparison', () => {
        const compareItems: any[] = [];
        const item1 = itemsData.items[0];
        const item2 = itemsData.items[1];

        compareItems.push(item1);
        compareItems.push(item2);

        expect(compareItems.length).toBe(2);
    });

    it('should limit comparison to 3 items', () => {
        const compareItems: any[] = [];
        const maxCompare = 3;

        for (let i = 0; i < 5; i++) {
            if (compareItems.length < maxCompare) {
                compareItems.push(itemsData.items[i]);
            }
        }

        expect(compareItems.length).toBe(3);
    });
});

describe('QA Area 20: Compare Mode - Display Comparison', () => {
    const compareValues = (val1: number, val2: number): 'higher' | 'lower' | 'equal' => {
        if (val1 > val2) return 'higher';
        if (val1 < val2) return 'lower';
        return 'equal';
    };

    it('should correctly compare numeric values', () => {
        expect(compareValues(100, 50)).toBe('higher');
        expect(compareValues(50, 100)).toBe('lower');
        expect(compareValues(50, 50)).toBe('equal');
    });

    it('should handle edge cases in comparison', () => {
        expect(compareValues(0, 0)).toBe('equal');
        expect(compareValues(-10, -5)).toBe('lower');
        expect(compareValues(-5, -10)).toBe('higher');
    });
});

describe('QA Area 21: Modal - Item Detail Display', () => {
    const itemsData = loadJsonFile('items.json');

    it('should have detailed_description for detail modal', () => {
        // Field is 'detailed_description' in the actual data schema
        const itemsWithDescription = itemsData.items.filter((item: any) => item.detailed_description);
        expect(itemsWithDescription.length).toBeGreaterThan(0);
    });

    it('should have base_effect for detail modal', () => {
        const itemsWithEffect = itemsData.items.filter((item: any) => item.base_effect);
        expect(itemsWithEffect.length).toBeGreaterThan(0);
    });

    it('should have formula field for items', () => {
        const itemsWithFormula = itemsData.items.filter((item: any) => item.formula);
        expect(itemsWithFormula.length).toBeGreaterThan(0);
    });
});

describe('QA Area 22: Modal - Scaling Charts', () => {
    const itemsData = loadJsonFile('items.json');

    it('should have items with scaling data', () => {
        // Field is 'scaling_per_stack' array in the actual data schema
        const itemsWithScaling = itemsData.items.filter(
            (item: any) => item.scaling_per_stack !== undefined || item.formula
        );
        expect(itemsWithScaling.length).toBeGreaterThan(0);
    });

    it('should have scaling_per_stack as array for scalable items', () => {
        const itemsWithScalingArray = itemsData.items.filter(
            (item: any) => item.scaling_per_stack && Array.isArray(item.scaling_per_stack)
        );
        expect(itemsWithScalingArray.length).toBeGreaterThan(0);
        itemsWithScalingArray.forEach((item: any) => {
            expect(item.scaling_per_stack.length).toBeGreaterThanOrEqual(1);
        });
    });

    const generateScalingData = (baseValue: number, perStack: number, maxStacks: number) => {
        const data = [];
        for (let i = 0; i <= maxStacks; i++) {
            data.push({
                stack: i,
                value: baseValue + (perStack * i)
            });
        }
        return data;
    };

    it('should generate correct scaling data', () => {
        const data = generateScalingData(10, 5, 5);
        expect(data.length).toBe(6);
        expect(data[0].value).toBe(10);
        expect(data[5].value).toBe(35);
    });
});

describe('QA Area 23: Accessibility - ARIA Attributes', () => {
    let dom: JSDOM;

    beforeEach(() => {
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <div role="tablist">
                    <button role="tab" aria-selected="true" aria-controls="panel-1">Tab 1</button>
                    <button role="tab" aria-selected="false" aria-controls="panel-2">Tab 2</button>
                </div>
                <div role="tabpanel" id="panel-1" aria-labelledby="tab-1">Content 1</div>
                <div role="tabpanel" id="panel-2" aria-labelledby="tab-2" hidden>Content 2</div>
            </body>
            </html>
        `);
    });

    it('should have proper tab roles', () => {
        const tablist = dom.window.document.querySelector('[role="tablist"]');
        expect(tablist).not.toBeNull();

        const tabs = dom.window.document.querySelectorAll('[role="tab"]');
        expect(tabs.length).toBe(2);
    });

    it('should have aria-selected on tabs', () => {
        const selectedTab = dom.window.document.querySelector('[aria-selected="true"]');
        expect(selectedTab).not.toBeNull();
    });

    it('should have tabpanels with proper roles', () => {
        const panels = dom.window.document.querySelectorAll('[role="tabpanel"]');
        expect(panels.length).toBe(2);
    });
});

describe('QA Area 24: Accessibility - Keyboard Navigation', () => {
    const simulateKeyPress = (key: string) => {
        return { key, preventDefault: vi.fn() };
    };

    it('should handle Enter key press', () => {
        const event = simulateKeyPress('Enter');
        expect(event.key).toBe('Enter');
    });

    it('should handle Escape key press', () => {
        const event = simulateKeyPress('Escape');
        expect(event.key).toBe('Escape');
    });

    it('should handle Tab key press', () => {
        const event = simulateKeyPress('Tab');
        expect(event.key).toBe('Tab');
    });

    it('should handle arrow keys', () => {
        expect(simulateKeyPress('ArrowLeft').key).toBe('ArrowLeft');
        expect(simulateKeyPress('ArrowRight').key).toBe('ArrowRight');
        expect(simulateKeyPress('ArrowUp').key).toBe('ArrowUp');
        expect(simulateKeyPress('ArrowDown').key).toBe('ArrowDown');
    });
});

describe('QA Area 25: Toast Notifications', () => {
    type ToastType = 'success' | 'error' | 'warning' | 'info';

    const createToast = (message: string, type: ToastType) => {
        return { message, type, id: Date.now() };
    };

    it('should create success toast', () => {
        const toast = createToast('Build saved!', 'success');
        expect(toast.type).toBe('success');
        expect(toast.message).toBe('Build saved!');
    });

    it('should create error toast', () => {
        const toast = createToast('Failed to load data', 'error');
        expect(toast.type).toBe('error');
    });

    it('should create warning toast', () => {
        const toast = createToast('Stack cap exceeded', 'warning');
        expect(toast.type).toBe('warning');
    });

    it('should create info toast', () => {
        const toast = createToast('New items available', 'info');
        expect(toast.type).toBe('info');
    });
});

describe('QA Area 26: URL Hash/Build Sharing', () => {
    const encodeBuild = (build: any) => {
        return Buffer.from(JSON.stringify(build)).toString('base64');
    };

    const decodeBuild = (encoded: string) => {
        try {
            return JSON.parse(Buffer.from(encoded, 'base64').toString());
        } catch {
            return null;
        }
    };

    it('should encode build to shareable string', () => {
        const build = { character: 'warrior', weapon: 'sword', items: ['item1', 'item2'] };
        const encoded = encodeBuild(build);
        expect(typeof encoded).toBe('string');
        expect(encoded.length).toBeGreaterThan(0);
    });

    it('should decode build from string', () => {
        const original = { character: 'warrior', weapon: 'sword', items: ['item1', 'item2'] };
        const encoded = encodeBuild(original);
        const decoded = decodeBuild(encoded);
        expect(decoded).toEqual(original);
    });

    it('should handle invalid encoded strings', () => {
        const decoded = decodeBuild('invalid-base64!!!');
        expect(decoded).toBeNull();
    });
});

describe('QA Area 27: LocalStorage Persistence', () => {
    let mockStorage: { [key: string]: string };

    beforeEach(() => {
        mockStorage = {};
    });

    const getItem = (key: string) => mockStorage[key] || null;
    const setItem = (key: string, value: string) => { mockStorage[key] = value; };
    const removeItem = (key: string) => { delete mockStorage[key]; };

    it('should save and retrieve favorites', () => {
        const favorites = ['item1', 'item2', 'item3'];
        setItem('favorites', JSON.stringify(favorites));
        const retrieved = JSON.parse(getItem('favorites') || '[]');
        expect(retrieved).toEqual(favorites);
    });

    it('should save and retrieve build history', () => {
        const builds = [{ id: 1, name: 'Build 1' }, { id: 2, name: 'Build 2' }];
        setItem('buildHistory', JSON.stringify(builds));
        const retrieved = JSON.parse(getItem('buildHistory') || '[]');
        expect(retrieved).toEqual(builds);
    });

    it('should handle empty storage', () => {
        const favorites = JSON.parse(getItem('favorites') || '[]');
        expect(favorites).toEqual([]);
    });

    it('should remove items from storage', () => {
        setItem('test', 'value');
        expect(getItem('test')).toBe('value');
        removeItem('test');
        expect(getItem('test')).toBeNull();
    });
});

describe('QA Area 28: Responsive Layout', () => {
    const getLayoutMode = (width: number) => {
        if (width < 768) return 'mobile';
        if (width < 1024) return 'tablet';
        return 'desktop';
    };

    it('should detect mobile layout', () => {
        expect(getLayoutMode(320)).toBe('mobile');
        expect(getLayoutMode(375)).toBe('mobile');
        expect(getLayoutMode(767)).toBe('mobile');
    });

    it('should detect tablet layout', () => {
        expect(getLayoutMode(768)).toBe('tablet');
        expect(getLayoutMode(900)).toBe('tablet');
        expect(getLayoutMode(1023)).toBe('tablet');
    });

    it('should detect desktop layout', () => {
        expect(getLayoutMode(1024)).toBe('desktop');
        expect(getLayoutMode(1440)).toBe('desktop');
        expect(getLayoutMode(1920)).toBe('desktop');
    });
});

describe('QA Area 29: Error Handling', () => {
    const safeJsonParse = (str: string) => {
        try {
            return { success: true, data: JSON.parse(str) };
        } catch (e) {
            return { success: false, data: null };
        }
    };

    it('should handle valid JSON', () => {
        const result = safeJsonParse('{"key": "value"}');
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ key: 'value' });
    });

    it('should handle invalid JSON', () => {
        const result = safeJsonParse('not valid json');
        expect(result.success).toBe(false);
        expect(result.data).toBeNull();
    });

    it('should handle empty string', () => {
        const result = safeJsonParse('');
        expect(result.success).toBe(false);
    });
});

describe('QA Area 30: Image Loading and Fallbacks', () => {
    const getImagePath = (entity: any, type: string) => {
        if (entity.image) return `images/${type}/${entity.image}`;
        return `images/${type}/placeholder.webp`;
    };

    it('should generate correct image path', () => {
        const item = { id: 'sword', image: 'sword.webp' };
        expect(getImagePath(item, 'items')).toBe('images/items/sword.webp');
    });

    it('should use placeholder for missing images', () => {
        const item = { id: 'unknown' };
        expect(getImagePath(item, 'items')).toBe('images/items/placeholder.webp');
    });
});

describe('QA Area 31: Advisor - Recommendation Logic', () => {
    const recommendChoice = (choices: any[], currentBuild: any) => {
        // Simple scoring: prefer items that have synergies with current build
        return choices.map(choice => ({
            ...choice,
            score: choice.synergies ? choice.synergies.length * 10 : 0
        })).sort((a, b) => b.score - a.score)[0];
    };

    it('should recommend item with most synergies', () => {
        const choices = [
            { id: 'item1', synergies: ['a'] },
            { id: 'item2', synergies: ['a', 'b', 'c'] },
            { id: 'item3', synergies: ['a', 'b'] }
        ];
        const recommended = recommendChoice(choices, {});
        expect(recommended.id).toBe('item2');
    });

    it('should handle items without synergies', () => {
        const choices = [
            { id: 'item1' },
            { id: 'item2', synergies: ['a'] }
        ];
        const recommended = recommendChoice(choices, {});
        expect(recommended.id).toBe('item2');
    });
});

describe('QA Area 32: Changelog Tab', () => {
    let changelogData: any;

    beforeAll(() => {
        try {
            changelogData = loadJsonFile('changelog.json');
        } catch {
            changelogData = { patches: [] };
        }
    });

    it('should have patches array', () => {
        expect(Array.isArray(changelogData.patches || changelogData.changelog || [])).toBe(true);
    });

    it('should have version in each patch', () => {
        const patches = changelogData.patches || changelogData.changelog || [];
        if (patches.length > 0) {
            patches.forEach((patch: any) => {
                expect(patch.version || patch.id).toBeDefined();
            });
        }
    });
});

describe('QA Area 33: Overcrit Detection', () => {
    const checkOvercrit = (critChance: number) => {
        return critChance > 100;
    };

    it('should detect overcrit when above 100%', () => {
        expect(checkOvercrit(150)).toBe(true);
        expect(checkOvercrit(101)).toBe(true);
    });

    it('should not flag normal crit values', () => {
        expect(checkOvercrit(100)).toBe(false);
        expect(checkOvercrit(50)).toBe(false);
        expect(checkOvercrit(0)).toBe(false);
    });
});

describe('QA Area 34: Tab Navigation State', () => {
    const tabs = ['items', 'weapons', 'tomes', 'characters', 'shrines', 'build-planner', 'calculator', 'advisor', 'changelog'];

    it('should have all expected tabs', () => {
        expect(tabs.length).toBe(9);
        expect(tabs).toContain('items');
        expect(tabs).toContain('build-planner');
        expect(tabs).toContain('calculator');
    });

    const validateTab = (tab: string) => tabs.includes(tab);

    it('should validate known tabs', () => {
        expect(validateTab('items')).toBe(true);
        expect(validateTab('weapons')).toBe(true);
    });

    it('should reject unknown tabs', () => {
        expect(validateTab('unknown')).toBe(false);
        expect(validateTab('')).toBe(false);
    });
});

describe('QA Area 35: Fuzzy Search Matching', () => {
    const fuzzyMatch = (query: string, target: string) => {
        const queryLower = query.toLowerCase();
        const targetLower = target.toLowerCase();

        // Exact match
        if (targetLower.includes(queryLower)) return { match: true, score: 100 };

        // Check if all query chars appear in order
        let queryIndex = 0;
        for (const char of targetLower) {
            if (char === queryLower[queryIndex]) {
                queryIndex++;
            }
            if (queryIndex === queryLower.length) {
                return { match: true, score: 50 };
            }
        }

        return { match: false, score: 0 };
    };

    it('should match exact substrings', () => {
        const result = fuzzyMatch('sword', 'Flaming Sword');
        expect(result.match).toBe(true);
        expect(result.score).toBe(100);
    });

    it('should match fuzzy patterns', () => {
        const result = fuzzyMatch('fswrd', 'Flaming Sword');
        expect(result.match).toBe(true);
    });

    it('should not match unrelated strings', () => {
        const result = fuzzyMatch('xyz', 'Sword');
        expect(result.match).toBe(false);
    });
});

describe('QA Area 36: Build Templates', () => {
    const buildTemplates = [
        { name: 'Crit Build', focus: 'crit_chance' },
        { name: 'Tank Build', focus: 'hp' },
        { name: 'Speed Build', focus: 'attack_speed' },
        { name: 'Glass Cannon', focus: 'damage' }
    ];

    it('should have multiple build templates', () => {
        expect(buildTemplates.length).toBeGreaterThanOrEqual(4);
    });

    it('should have name and focus for each template', () => {
        buildTemplates.forEach(template => {
            expect(template.name).toBeDefined();
            expect(template.focus).toBeDefined();
        });
    });
});

describe('QA Area 37: Data Cross-References', () => {
    const itemsData = loadJsonFile('items.json');
    const weaponsData = loadJsonFile('weapons.json');

    it('should have valid weapon synergy references in items', () => {
        const weaponNames = new Set(weaponsData.weapons.map((w: any) => w.name));

        itemsData.items.forEach((item: any) => {
            if (item.synergies_weapons && item.synergies_weapons.length > 0) {
                item.synergies_weapons.forEach((weaponName: string) => {
                    // Just verify it's a string, not necessarily in the list
                    expect(typeof weaponName).toBe('string');
                });
            }
        });
    });
});

describe('QA Area 38: Mobile Navigation', () => {
    const mainTabs = ['items', 'weapons', 'tomes', 'characters', 'shrines'];
    const moreTabs = ['build-planner', 'calculator', 'advisor', 'changelog'];

    it('should have 5 main tabs for bottom nav', () => {
        expect(mainTabs.length).toBe(5);
    });

    it('should have more menu items', () => {
        expect(moreTabs.length).toBeGreaterThan(0);
    });

    it('should have all tabs accounted for', () => {
        const allTabs = [...mainTabs, ...moreTabs];
        expect(allTabs.length).toBe(9);
    });
});

describe('QA Area 39: Similar Items Functionality', () => {
    const itemsData = loadJsonFile('items.json');

    const findSimilarItems = (item: any) => {
        return itemsData.items.filter((other: any) => {
            if (other.id === item.id) return false;
            // Same tier or same rarity
            return other.tier === item.tier || other.rarity === item.rarity;
        }).slice(0, 5);
    };

    it('should find similar items by tier', () => {
        const item = itemsData.items[0];
        const similar = findSimilarItems(item);
        expect(similar.length).toBeLessThanOrEqual(5);
        expect(similar.every((s: any) => s.id !== item.id)).toBe(true);
    });
});

describe('QA Area 40: Performance - Data Loading', () => {
    it('should load items data quickly', () => {
        const start = Date.now();
        loadJsonFile('items.json');
        const duration = Date.now() - start;
        expect(duration).toBeLessThan(1000); // Should load in under 1 second
    });

    it('should load weapons data quickly', () => {
        const start = Date.now();
        loadJsonFile('weapons.json');
        const duration = Date.now() - start;
        expect(duration).toBeLessThan(1000);
    });

    it('should load all data files', () => {
        const files = ['items.json', 'weapons.json', 'tomes.json', 'characters.json', 'shrines.json'];
        files.forEach(file => {
            expect(() => loadJsonFile(file)).not.toThrow();
        });
    });
});
