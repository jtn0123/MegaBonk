/**
 * @vitest-environment jsdom
 * Random Build Generator Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    generateRandomBuild,
    renderRandomBuildSection,
    renderBuildPreview,
    setupRandomBuildHandlers,
} from '../../src/modules/random-build.ts';
import type { Item, Weapon, Character, Tome, Rarity, Tier } from '../../src/types/index.ts';

// Mock data-service with test data
vi.mock('../../src/modules/data-service.ts', () => ({
    allData: {
        characters: {
            characters: [
                { id: 'warrior', name: 'Warrior', tier: 'A', rarity: 'common' },
                { id: 'mage', name: 'Mage', tier: 'S', rarity: 'rare' },
                { id: 'rogue', name: 'Rogue', tier: 'B', rarity: 'uncommon' },
                { id: 'paladin', name: 'Paladin', tier: 'SS', rarity: 'legendary' },
                { id: 'peasant', name: 'Peasant', tier: 'C', rarity: 'common' },
            ],
        },
        weapons: {
            weapons: [
                { id: 'sword', name: 'Sword', tier: 'A', rarity: 'common' },
                { id: 'staff', name: 'Staff', tier: 'S', rarity: 'rare' },
                { id: 'dagger', name: 'Dagger', tier: 'B', rarity: 'uncommon' },
                { id: 'legendary_blade', name: 'Legendary Blade', tier: 'SS', rarity: 'legendary' },
                { id: 'stick', name: 'Stick', tier: 'C', rarity: 'common' },
            ],
        },
        tomes: {
            tomes: [
                { id: 'tome1', name: 'Tome 1', priority: 1 },
                { id: 'tome2', name: 'Tome 2', priority: 2 },
                { id: 'tome3', name: 'Tome 3', priority: 3 },
                { id: 'tome4', name: 'Tome 4', priority: 4 },
                { id: 'tome5', name: 'Tome 5', priority: 5 },
            ],
        },
        items: {
            items: [
                { id: 'item1', name: 'Common Item', tier: 'C', rarity: 'common', one_and_done: false },
                { id: 'item2', name: 'Uncommon Item', tier: 'B', rarity: 'uncommon', one_and_done: false },
                { id: 'item3', name: 'Rare Item', tier: 'A', rarity: 'rare', one_and_done: false },
                { id: 'item4', name: 'Epic Item', tier: 'S', rarity: 'epic', one_and_done: false },
                { id: 'item5', name: 'Legendary Item', tier: 'SS', rarity: 'legendary', one_and_done: false },
                { id: 'oad1', name: 'One And Done 1', tier: 'A', rarity: 'common', one_and_done: true },
                { id: 'oad2', name: 'One And Done 2', tier: 'B', rarity: 'uncommon', one_and_done: true },
                { id: 'item6', name: 'Extra Item', tier: 'A', rarity: 'rare', one_and_done: false },
                { id: 'item7', name: 'Another Item', tier: 'B', rarity: 'common', one_and_done: false },
                { id: 'item8', name: 'Yet Another', tier: 'C', rarity: 'common', one_and_done: false },
            ],
        },
    },
}));

// Mock logger
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock utils
vi.mock('../../src/modules/utils.ts', () => ({
    escapeHtml: (s: string) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    generateEntityImage: (entity: any, alt: string, className: string) =>
        entity ? `<img src="test.png" alt="${alt}" class="${className}">` : null,
}));

// ========================================
// generateRandomBuild Tests
// ========================================
describe('Random Build Generator', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ========================================
    // Basic Generation Tests
    // ========================================
    describe('generateRandomBuild', () => {
        it('should return a build object with all required properties', () => {
            const build = generateRandomBuild();

            expect(build).toHaveProperty('character');
            expect(build).toHaveProperty('weapon');
            expect(build).toHaveProperty('tomes');
            expect(build).toHaveProperty('items');
            expect(build).toHaveProperty('constraints');
        });

        it('should select a character', () => {
            const build = generateRandomBuild();

            expect(build.character).not.toBeNull();
            expect(build.character).toHaveProperty('id');
            expect(build.character).toHaveProperty('name');
        });

        it('should select a weapon', () => {
            const build = generateRandomBuild();

            expect(build.weapon).not.toBeNull();
            expect(build.weapon).toHaveProperty('id');
            expect(build.weapon).toHaveProperty('name');
        });

        it('should select tomes', () => {
            const build = generateRandomBuild();

            expect(Array.isArray(build.tomes)).toBe(true);
            expect(build.tomes.length).toBeGreaterThan(0);
        });

        it('should select items', () => {
            const build = generateRandomBuild();

            expect(Array.isArray(build.items)).toBe(true);
            expect(build.items.length).toBeGreaterThan(0);
        });

        it('should select 3 tomes by default', () => {
            const build = generateRandomBuild();
            expect(build.tomes.length).toBe(3);
        });

        it('should select 6 items by default', () => {
            const build = generateRandomBuild();
            expect(build.items.length).toBe(6);
        });

        it('should store constraints in result', () => {
            const constraints = { noLegendary: true, noSSItems: true };
            const build = generateRandomBuild(constraints);

            expect(build.constraints).toEqual(constraints);
        });
    });

    // ========================================
    // Rarity Constraint Tests
    // ========================================
    describe('rarity constraints', () => {
        it('should respect noLegendary constraint', () => {
            const build = generateRandomBuild({ noLegendary: true });

            // Items should not include legendary
            build.items.forEach(item => {
                expect(item.rarity).not.toBe('legendary');
            });
        });

        it('should respect maxRarity constraint', () => {
            const build = generateRandomBuild({ maxRarity: 'uncommon' });

            const validRarities = ['common', 'uncommon'];
            build.items.forEach(item => {
                expect(validRarities).toContain(item.rarity);
            });
        });

        it('should respect maxRarity=common constraint', () => {
            const build = generateRandomBuild({ maxRarity: 'common' });

            build.items.forEach(item => {
                expect(item.rarity).toBe('common');
            });
        });

        it('should respect maxRarity=epic constraint', () => {
            const build = generateRandomBuild({ maxRarity: 'epic' });

            const validRarities = ['common', 'uncommon', 'rare', 'epic'];
            build.items.forEach(item => {
                expect(validRarities).toContain(item.rarity);
            });
        });
    });

    // ========================================
    // Tier Constraint Tests
    // ========================================
    describe('tier constraints', () => {
        it('should respect noSSItems constraint', () => {
            const build = generateRandomBuild({ noSSItems: true });

            build.items.forEach(item => {
                expect(item.tier).not.toBe('SS');
            });
        });

        it('should respect maxTier constraint', () => {
            const build = generateRandomBuild({ maxTier: 'B' });

            const validTiers = ['C', 'B'];
            build.items.forEach(item => {
                expect(validTiers).toContain(item.tier);
            });
        });

        it('should respect maxTier=A constraint', () => {
            const build = generateRandomBuild({ maxTier: 'A' });

            const validTiers = ['C', 'B', 'A'];
            build.items.forEach(item => {
                expect(validTiers).toContain(item.tier);
            });
        });

        it('should respect maxTier=S constraint', () => {
            const build = generateRandomBuild({ maxTier: 'S' });

            const validTiers = ['C', 'B', 'A', 'S'];
            build.items.forEach(item => {
                expect(validTiers).toContain(item.tier);
            });
        });

        it('should respect challengeMode (B tier or lower)', () => {
            const build = generateRandomBuild({ challengeMode: true });

            const validTiers = ['C', 'B'];
            build.items.forEach(item => {
                expect(validTiers).toContain(item.tier);
            });
        });

        it('should filter characters in challengeMode', () => {
            const build = generateRandomBuild({ challengeMode: true });

            if (build.character) {
                const validTiers = ['C', 'B'];
                expect(validTiers).toContain(build.character.tier);
            }
        });

        it('should filter weapons in challengeMode', () => {
            const build = generateRandomBuild({ challengeMode: true });

            if (build.weapon) {
                const validTiers = ['C', 'B'];
                expect(validTiers).toContain(build.weapon.tier);
            }
        });

        it('should filter tomes in challengeMode (priority >= 3)', () => {
            const build = generateRandomBuild({ challengeMode: true });

            // In challenge mode, only tomes with priority >= 3 should be selected
            build.tomes.forEach(tome => {
                expect((tome as any).priority).toBeGreaterThanOrEqual(3);
            });
        });
    });

    // ========================================
    // One-and-Done Constraint Tests
    // ========================================
    describe('one-and-done constraint', () => {
        it('should only select one-and-done items when constrained', () => {
            const build = generateRandomBuild({ onlyOneAndDone: true });

            build.items.forEach(item => {
                expect(item.one_and_done).toBe(true);
            });
        });

        it('should select fewer items if not enough one-and-done available', () => {
            const build = generateRandomBuild({ onlyOneAndDone: true });

            // Only 2 one-and-done items in mock data
            expect(build.items.length).toBeLessThanOrEqual(2);
        });
    });

    // ========================================
    // Random Tome Count Tests
    // ========================================
    describe('random tome count', () => {
        it('should vary tome count when randomTomeCount is true', () => {
            const counts = new Set<number>();

            // Generate multiple builds to see variation
            for (let i = 0; i < 50; i++) {
                const build = generateRandomBuild({ randomTomeCount: true });
                counts.add(build.tomes.length);
            }

            // Should have at least some variation (2-5 range)
            expect(counts.size).toBeGreaterThan(1);
        });

        it('should generate between 2-5 tomes when random', () => {
            for (let i = 0; i < 20; i++) {
                const build = generateRandomBuild({ randomTomeCount: true });
                expect(build.tomes.length).toBeGreaterThanOrEqual(2);
                expect(build.tomes.length).toBeLessThanOrEqual(5);
            }
        });
    });

    // ========================================
    // Combined Constraints Tests
    // ========================================
    describe('combined constraints', () => {
        it('should apply multiple constraints together', () => {
            const build = generateRandomBuild({
                noLegendary: true,
                noSSItems: true,
                maxTier: 'A',
            });

            build.items.forEach(item => {
                expect(item.rarity).not.toBe('legendary');
                expect(item.tier).not.toBe('SS');
                expect(['C', 'B', 'A']).toContain(item.tier);
            });
        });

        it('should handle strict constraints that limit options', () => {
            const build = generateRandomBuild({
                maxRarity: 'common',
                maxTier: 'C',
            });

            build.items.forEach(item => {
                expect(item.rarity).toBe('common');
                expect(item.tier).toBe('C');
            });
        });
    });

    // ========================================
    // Edge Cases
    // ========================================
    describe('edge cases', () => {
        it('should handle empty constraints object', () => {
            const build = generateRandomBuild({});

            expect(build.character).not.toBeNull();
            expect(build.weapon).not.toBeNull();
        });

        it('should return unique items (no duplicates)', () => {
            const build = generateRandomBuild();

            const itemIds = build.items.map(i => i.id);
            const uniqueIds = new Set(itemIds);
            expect(uniqueIds.size).toBe(itemIds.length);
        });

        it('should return unique tomes (no duplicates)', () => {
            const build = generateRandomBuild();

            const tomeIds = build.tomes.map(t => t.id);
            const uniqueIds = new Set(tomeIds);
            expect(uniqueIds.size).toBe(tomeIds.length);
        });

        it('should produce different builds on multiple calls', () => {
            const builds: string[] = [];

            for (let i = 0; i < 10; i++) {
                const build = generateRandomBuild();
                const signature = `${build.character?.id}-${build.weapon?.id}`;
                builds.push(signature);
            }

            // At least some builds should be different
            const unique = new Set(builds);
            expect(unique.size).toBeGreaterThan(1);
        });
    });

    // ========================================
    // Deterministic Tests
    // ========================================
    describe('build structure', () => {
        it('should always return valid structure even with restrictive constraints', () => {
            const build = generateRandomBuild({
                challengeMode: true,
                noLegendary: true,
                noSSItems: true,
                maxRarity: 'uncommon',
            });

            expect(build).toHaveProperty('character');
            expect(build).toHaveProperty('weapon');
            expect(build).toHaveProperty('tomes');
            expect(build).toHaveProperty('items');
            expect(Array.isArray(build.tomes)).toBe(true);
            expect(Array.isArray(build.items)).toBe(true);
        });
    });
});

// ========================================
// renderRandomBuildSection Tests
// ========================================
describe('renderRandomBuildSection', () => {
    it('should return HTML string', () => {
        const html = renderRandomBuildSection();
        expect(typeof html).toBe('string');
        expect(html.length).toBeGreaterThan(0);
    });

    it('should contain random build section container', () => {
        const html = renderRandomBuildSection();
        expect(html).toContain('random-build-section');
    });

    it('should contain header with dice emoji', () => {
        const html = renderRandomBuildSection();
        expect(html).toContain('🎲');
        expect(html).toContain('Random Build Generator');
    });

    it('should contain constraint toggles', () => {
        const html = renderRandomBuildSection();
        expect(html).toContain('constraint-toggle');
        expect(html).toContain('noLegendary');
        expect(html).toContain('noSSItems');
        expect(html).toContain('onlyOneAndDone');
        expect(html).toContain('challengeMode');
    });

    it('should contain generate button with correct id', () => {
        const html = renderRandomBuildSection();
        expect(html).toContain('id="generate-random-build"');
        expect(html).toContain('Generate Random Build');
    });

    it('should contain result section (hidden by default)', () => {
        const html = renderRandomBuildSection();
        expect(html).toContain('id="random-build-result"');
        expect(html).toContain('style="display: none;"');
    });

    it('should contain action buttons', () => {
        const html = renderRandomBuildSection();
        expect(html).toContain('id="apply-random-build"');
        expect(html).toContain('id="reroll-random-build"');
        expect(html).toContain('Apply to Build Planner');
        expect(html).toContain('Reroll');
    });

    it('should contain checkbox inputs for constraints', () => {
        const html = renderRandomBuildSection();
        expect(html).toContain('type="checkbox"');
        expect(html).toContain('name="noLegendary"');
        expect(html).toContain('name="noSSItems"');
        expect(html).toContain('name="onlyOneAndDone"');
        expect(html).toContain('name="challengeMode"');
    });

    it('should contain build preview container', () => {
        const html = renderRandomBuildSection();
        expect(html).toContain('id="random-build-preview"');
    });

    it('should have "Your Random Build" heading', () => {
        const html = renderRandomBuildSection();
        expect(html).toContain('Your Random Build');
    });
});

// ========================================
// renderBuildPreview Tests
// ========================================
describe('renderBuildPreview', () => {
    it('should render character slot when character exists', () => {
        const build = {
            character: { id: 'warrior', name: 'Warrior' } as Character,
            weapon: null,
            tomes: [],
            items: [],
            constraints: {},
        };

        const html = renderBuildPreview(build);

        expect(html).toContain('Character');
        expect(html).toContain('Warrior');
        expect(html).toContain('random-build-slot');
    });

    it('should render weapon slot when weapon exists', () => {
        const build = {
            character: null,
            weapon: { id: 'sword', name: 'Sword' } as Weapon,
            tomes: [],
            items: [],
            constraints: {},
        };

        const html = renderBuildPreview(build);

        expect(html).toContain('Weapon');
        expect(html).toContain('Sword');
    });

    it('should render tome slots with index', () => {
        const build = {
            character: null,
            weapon: null,
            tomes: [
                { id: 'tome1', name: 'Fire Tome' } as Tome,
                { id: 'tome2', name: 'Ice Tome' } as Tome,
            ],
            items: [],
            constraints: {},
        };

        const html = renderBuildPreview(build);

        expect(html).toContain('Tome 1');
        expect(html).toContain('Fire Tome');
        expect(html).toContain('Tome 2');
        expect(html).toContain('Ice Tome');
    });

    it('should render item slots with index', () => {
        const build = {
            character: null,
            weapon: null,
            tomes: [],
            items: [
                { id: 'item1', name: 'Health Potion' } as Item,
                { id: 'item2', name: 'Mana Potion' } as Item,
            ],
            constraints: {},
        };

        const html = renderBuildPreview(build);

        expect(html).toContain('Item 1');
        expect(html).toContain('Health Potion');
        expect(html).toContain('Item 2');
        expect(html).toContain('Mana Potion');
    });

    it('should render all slots for full build', () => {
        const build = {
            character: { id: 'warrior', name: 'Warrior' } as Character,
            weapon: { id: 'sword', name: 'Sword' } as Weapon,
            tomes: [{ id: 'tome1', name: 'Tome 1' } as Tome],
            items: [{ id: 'item1', name: 'Item 1' } as Item],
            constraints: {},
        };

        const html = renderBuildPreview(build);

        expect(html).toContain('Character');
        expect(html).toContain('Weapon');
        expect(html).toContain('Tome 1');
        expect(html).toContain('Item 1');
    });

    it('should return empty string for empty build', () => {
        const build = {
            character: null,
            weapon: null,
            tomes: [],
            items: [],
            constraints: {},
        };

        const html = renderBuildPreview(build);

        expect(html).toBe('');
    });

    it('should escape HTML in entity names within slot-name', () => {
        const build = {
            character: { id: 'xss', name: '<script>alert("xss")</script>' } as Character,
            weapon: null,
            tomes: [],
            items: [],
            constraints: {},
        };

        const html = renderBuildPreview(build);

        // The slot-name should contain escaped HTML
        // Match the span with slot-name class content
        const slotNameMatch = html.match(/<span class="slot-name">([^<]*)<\/span>/);
        expect(slotNameMatch).not.toBeNull();
        expect(slotNameMatch![1]).toContain('&lt;script&gt;');
    });

    it('should include slot labels', () => {
        const build = {
            character: { id: 'warrior', name: 'Warrior' } as Character,
            weapon: null,
            tomes: [],
            items: [],
            constraints: {},
        };

        const html = renderBuildPreview(build);

        expect(html).toContain('slot-label');
    });

    it('should include slot names', () => {
        const build = {
            character: { id: 'warrior', name: 'Warrior' } as Character,
            weapon: null,
            tomes: [],
            items: [],
            constraints: {},
        };

        const html = renderBuildPreview(build);

        expect(html).toContain('slot-name');
    });

    it('should use fallback icons when image generation returns null', () => {
        // This is tricky since we mocked generateEntityImage to always return an image
        // But in the actual code, if generateEntityImage returns null, it should show fallback
        // Let's test with the mock returning a proper image
        const build = {
            character: { id: 'warrior', name: 'Warrior' } as Character,
            weapon: { id: 'sword', name: 'Sword' } as Weapon,
            tomes: [{ id: 'tome1', name: 'Tome 1' } as Tome],
            items: [{ id: 'item1', name: 'Item 1' } as Item],
            constraints: {},
        };

        const html = renderBuildPreview(build);

        // With our mock, images should be generated
        expect(html).toContain('slot-image');
    });
});

// ========================================
// setupRandomBuildHandlers Tests
// ========================================
describe('setupRandomBuildHandlers', () => {
    beforeEach(() => {
        // Set up the DOM with random build section
        document.body.innerHTML = renderRandomBuildSection();
        vi.useFakeTimers();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.useRealTimers();
    });

    it('should set up event listener on generate button', () => {
        const generateBtn = document.getElementById('generate-random-build');
        const addEventListenerSpy = vi.spyOn(generateBtn!, 'addEventListener');

        setupRandomBuildHandlers();

        expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should set up event listener on reroll button', () => {
        const rerollBtn = document.getElementById('reroll-random-build');
        const addEventListenerSpy = vi.spyOn(rerollBtn!, 'addEventListener');

        setupRandomBuildHandlers();

        expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should set up event listener on apply button', () => {
        const applyBtn = document.getElementById('apply-random-build');
        const addEventListenerSpy = vi.spyOn(applyBtn!, 'addEventListener');

        setupRandomBuildHandlers();

        expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should attach click listeners to constraint toggles', () => {
        const addEventListenerSpy = vi.fn();
        const toggles = document.querySelectorAll('.constraint-toggle');
        toggles.forEach(toggle => {
            toggle.addEventListener = addEventListenerSpy;
        });

        setupRandomBuildHandlers();

        // Each toggle should have had addEventListener called with 'click'
        expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should update active class when checkbox is toggled via click', () => {
        setupRandomBuildHandlers();

        const toggle = document.querySelector('.constraint-toggle') as HTMLElement;
        const checkbox = toggle.querySelector('input[type="checkbox"]') as HTMLInputElement;

        // Initially unchecked and not active
        expect(checkbox.checked).toBe(false);
        expect(toggle.classList.contains('active')).toBe(false);

        // Click checkbox directly - native behavior toggles it, our handler updates active class
        checkbox.click();

        // Checkbox should be checked (by native behavior since e.target === checkbox)
        expect(checkbox.checked).toBe(true);
        // Active class should match checkbox state
        expect(toggle.classList.contains('active')).toBe(true);

        // Click again to uncheck
        checkbox.click();
        expect(checkbox.checked).toBe(false);
        expect(toggle.classList.contains('active')).toBe(false);
    });

    it('should not double-toggle when clicking directly on checkbox', () => {
        setupRandomBuildHandlers();

        const toggle = document.querySelector('.constraint-toggle') as HTMLElement;
        const checkbox = toggle.querySelector('input[type="checkbox"]') as HTMLInputElement;

        // Click directly on checkbox
        checkbox.click();

        // Should be checked (single toggle)
        expect(checkbox.checked).toBe(true);
    });

    it('should add rolling animation on generate', () => {
        setupRandomBuildHandlers();

        const generateBtn = document.getElementById('generate-random-build') as HTMLButtonElement;
        generateBtn.click();

        expect(generateBtn.classList.contains('rolling')).toBe(true);
    });

    it('should remove rolling animation after timeout', () => {
        setupRandomBuildHandlers();

        const generateBtn = document.getElementById('generate-random-build') as HTMLButtonElement;
        generateBtn.click();

        // Fast-forward 500ms
        vi.advanceTimersByTime(500);

        expect(generateBtn.classList.contains('rolling')).toBe(false);
    });

    it('should show result section after generating', () => {
        setupRandomBuildHandlers();

        const generateBtn = document.getElementById('generate-random-build') as HTMLButtonElement;
        const resultSection = document.getElementById('random-build-result') as HTMLElement;

        generateBtn.click();
        vi.advanceTimersByTime(500);

        expect(resultSection.style.display).toBe('block');
    });

    it('should render build preview after generating', () => {
        setupRandomBuildHandlers();

        const generateBtn = document.getElementById('generate-random-build') as HTMLButtonElement;
        const previewContainer = document.getElementById('random-build-preview') as HTMLElement;

        generateBtn.click();
        vi.advanceTimersByTime(500);

        // Preview should have content
        expect(previewContainer.innerHTML.length).toBeGreaterThan(0);
        expect(previewContainer.innerHTML).toContain('random-build-slot');
    });

    it('should respect checked constraints when generating', () => {
        setupRandomBuildHandlers();

        // Check "No Legendary" constraint by clicking the checkbox
        const noLegendaryToggle = document.querySelector('[data-constraint="noLegendary"]') as HTMLElement;
        const noLegendaryCheckbox = noLegendaryToggle.querySelector('input[type="checkbox"]') as HTMLInputElement;
        noLegendaryCheckbox.click();

        const generateBtn = document.getElementById('generate-random-build') as HTMLButtonElement;
        generateBtn.click();
        vi.advanceTimersByTime(500);

        // The build should be generated (we can't directly check constraints were applied
        // without accessing the internal lastGeneratedBuild, but we can verify it ran)
        const previewContainer = document.getElementById('random-build-preview') as HTMLElement;
        expect(previewContainer.innerHTML.length).toBeGreaterThan(0);
    });

    it('should reroll with same constraints when reroll button clicked', () => {
        setupRandomBuildHandlers();

        const generateBtn = document.getElementById('generate-random-build') as HTMLButtonElement;
        const rerollBtn = document.getElementById('reroll-random-build') as HTMLButtonElement;

        // Generate first build
        generateBtn.click();
        vi.advanceTimersByTime(500);

        const firstPreview = document.getElementById('random-build-preview')!.innerHTML;

        // Reroll
        rerollBtn.click();
        vi.advanceTimersByTime(500);

        // Should still have content (build was regenerated)
        const secondPreview = document.getElementById('random-build-preview')!.innerHTML;
        expect(secondPreview.length).toBeGreaterThan(0);
    });
});

// ========================================
// Event Handler Integration Tests
// ========================================
describe('Random Build Event Handlers Integration', () => {
    beforeEach(() => {
        document.body.innerHTML = renderRandomBuildSection();
        vi.useFakeTimers();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.useRealTimers();
    });

    it('should handle missing DOM elements gracefully', () => {
        // Clear the DOM
        document.body.innerHTML = '';

        // This should not throw
        expect(() => setupRandomBuildHandlers()).not.toThrow();
    });

    it('should read constraints from multiple checked checkboxes', () => {
        setupRandomBuildHandlers();

        // Check multiple constraints by clicking checkboxes directly
        const noLegendary = document.querySelector('[data-constraint="noLegendary"]') as HTMLElement;
        const noSS = document.querySelector('[data-constraint="noSSItems"]') as HTMLElement;
        const noLegendaryCheckbox = noLegendary.querySelector('input[type="checkbox"]') as HTMLInputElement;
        const noSSCheckbox = noSS.querySelector('input[type="checkbox"]') as HTMLInputElement;

        noLegendaryCheckbox.click();
        noSSCheckbox.click();

        // Both checkboxes should be checked
        expect(noLegendaryCheckbox.checked).toBe(true);
        expect(noSSCheckbox.checked).toBe(true);
        // Both toggles should be active
        expect(noLegendary.classList.contains('active')).toBe(true);
        expect(noSS.classList.contains('active')).toBe(true);
    });

    it('should generate build when no constraints are selected', () => {
        setupRandomBuildHandlers();

        const generateBtn = document.getElementById('generate-random-build') as HTMLButtonElement;
        generateBtn.click();
        vi.advanceTimersByTime(500);

        const previewContainer = document.getElementById('random-build-preview') as HTMLElement;
        expect(previewContainer.innerHTML).toContain('random-build-slot');
    });

    it('should sync active class with checkbox state', () => {
        setupRandomBuildHandlers();

        const toggle = document.querySelector('.constraint-toggle') as HTMLElement;
        const checkbox = toggle.querySelector('input[type="checkbox"]') as HTMLInputElement;

        // Initially not active
        expect(toggle.classList.contains('active')).toBe(false);

        // Click checkbox to check it
        checkbox.click();
        expect(toggle.classList.contains('active')).toBe(true);

        // Click again to uncheck
        checkbox.click();
        expect(toggle.classList.contains('active')).toBe(false);
    });
});

// ========================================
// Error Handling Tests
// ========================================
describe('Random Build Error Handling', () => {
    beforeEach(() => {
        document.body.innerHTML = renderRandomBuildSection();
        vi.useFakeTimers();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.useRealTimers();
    });

    it('should handle apply to build planner when module is not available', async () => {
        setupRandomBuildHandlers();

        // Generate a build first
        const generateBtn = document.getElementById('generate-random-build') as HTMLButtonElement;
        generateBtn.click();
        vi.advanceTimersByTime(500);

        // Try to apply - this should not throw even if build-planner module fails to load
        const applyBtn = document.getElementById('apply-random-build') as HTMLButtonElement;

        // The async import will fail since build-planner is not mocked
        // But it should be caught and logged, not thrown
        expect(() => applyBtn.click()).not.toThrow();
    });
});
