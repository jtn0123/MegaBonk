// ========================================
// Random Build Generator Module
// ========================================
// Generates random builds with optional constraints for fun/challenge runs
// ========================================

import { allData } from './data-service.ts';
import { escapeHtml, generateEntityImage } from './utils.ts';
import { logger } from './logger.ts';
import type { Item, Weapon, Tome, Character, Rarity, Tier } from '../types/index.ts';

// ========================================
// Types
// ========================================

interface BuildConstraints {
    maxRarity?: Rarity;
    maxTier?: Tier;
    noLegendary?: boolean;
    noSSItems?: boolean;
    onlyOneAndDone?: boolean;
    randomTomeCount?: boolean;
    challengeMode?: boolean; // B tier or lower only
}

interface RandomBuild {
    character: Character | null;
    weapon: Weapon | null;
    tomes: Tome[];
    items: Item[];
    constraints: BuildConstraints;
}

// ========================================
// Constants
// ========================================

const RARITY_LEVELS: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const TIER_LEVELS: Tier[] = ['C', 'B', 'A', 'S', 'SS'];

const DEFAULT_TOME_COUNT = 3;
const DEFAULT_ITEM_COUNT = 6;

// ========================================
// Utility Functions
// ========================================

/**
 * Get a random element from an array
 */
function randomElement<T>(array: T[]): T | null {
    if (array.length === 0) return null;
    const element = array[Math.floor(Math.random() * array.length)];
    return element !== undefined ? element : null;
}

/**
 * Get N random unique elements from an array
 */
function randomElements<T>(array: T[], count: number): T[] {
    if (array.length === 0) return [];
    const shuffled = [...array].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, array.length));
}

/**
 * Filter entities by rarity constraint
 */
function filterByRarity<T extends { rarity?: Rarity }>(items: T[], maxRarity?: Rarity, noLegendary?: boolean): T[] {
    let filtered = items;

    if (noLegendary) {
        filtered = filtered.filter(item => item.rarity !== 'legendary');
    }

    if (maxRarity) {
        const maxIndex = RARITY_LEVELS.indexOf(maxRarity);
        filtered = filtered.filter(item => {
            const itemIndex = RARITY_LEVELS.indexOf(item.rarity || 'common');
            return itemIndex <= maxIndex;
        });
    }

    return filtered;
}

/**
 * Filter entities by tier constraint
 */
function filterByTier<T extends { tier?: Tier }>(
    items: T[],
    maxTier?: Tier,
    noSS?: boolean,
    challengeMode?: boolean
): T[] {
    let filtered = items;

    if (noSS) {
        filtered = filtered.filter(item => item.tier !== 'SS');
    }

    if (challengeMode) {
        // Only B tier or lower
        filtered = filtered.filter(item => {
            const tier = item.tier || 'C';
            return tier === 'B' || tier === 'C';
        });
    } else if (maxTier) {
        const maxIndex = TIER_LEVELS.indexOf(maxTier);
        filtered = filtered.filter(item => {
            const itemIndex = TIER_LEVELS.indexOf(item.tier || 'C');
            return itemIndex <= maxIndex;
        });
    }

    return filtered;
}

// ========================================
// Build Generation
// ========================================

/**
 * Generate a random build with optional constraints
 */
export function generateRandomBuild(constraints: BuildConstraints = {}): RandomBuild {
    const {
        maxRarity,
        maxTier,
        noLegendary = false,
        noSSItems = false,
        onlyOneAndDone = false,
        randomTomeCount = false,
        challengeMode = false,
    } = constraints;

    // Get available data
    const characters = allData.characters?.characters || [];
    const weapons = allData.weapons?.weapons || [];
    const tomes = allData.tomes?.tomes || [];
    let items = allData.items?.items || [];

    // Apply item constraints
    items = filterByRarity(items, maxRarity, noLegendary);
    items = filterByTier(items, maxTier, noSSItems, challengeMode);

    if (onlyOneAndDone) {
        items = items.filter(item => item.one_and_done);
    }

    // Filter weapons and characters for challenge mode
    let filteredWeapons = challengeMode ? filterByTier(weapons, 'B', false, true) : weapons;

    let filteredCharacters = challengeMode ? filterByTier(characters, 'B', false, true) : characters;

    // Generate random selections
    const character = randomElement(filteredCharacters);
    const weapon = randomElement(filteredWeapons);

    // Tome count: random between 2-5 or fixed at 3
    const tomeCount = randomTomeCount
        ? Math.floor(Math.random() * 4) + 2 // 2-5
        : DEFAULT_TOME_COUNT;

    // Filter tomes for challenge mode
    const filteredTomes = challengeMode
        ? tomes.filter(t => (t.priority || 0) >= 3) // Lower priority tomes only
        : tomes;

    const selectedTomes = randomElements(filteredTomes, tomeCount);

    // Select items
    const selectedItems = randomElements(items, DEFAULT_ITEM_COUNT);

    logger.info({
        operation: 'random-build.generate',
        data: {
            constraints: Object.keys(constraints).filter(k => constraints[k as keyof BuildConstraints]),
            character: character?.name,
            weapon: weapon?.name,
            tomeCount: selectedTomes.length,
            itemCount: selectedItems.length,
        },
    });

    return {
        character: character as Character | null,
        weapon: weapon as Weapon | null,
        tomes: selectedTomes as Tome[],
        items: selectedItems as Item[],
        constraints,
    };
}

// ========================================
// UI Rendering
// ========================================

/**
 * Render the random build generator section
 */
export function renderRandomBuildSection(): string {
    return `
        <div class="random-build-section">
            <div class="random-build-header">
                <h3>🎲 Random Build Generator</h3>
            </div>

            <div class="random-build-constraints">
                <label class="constraint-toggle" data-constraint="noLegendary">
                    <input type="checkbox" name="noLegendary">
                    <span>No Legendary</span>
                </label>
                <label class="constraint-toggle" data-constraint="noSSItems">
                    <input type="checkbox" name="noSSItems">
                    <span>No SS Tier</span>
                </label>
                <label class="constraint-toggle" data-constraint="onlyOneAndDone">
                    <input type="checkbox" name="onlyOneAndDone">
                    <span>One-and-Done Only</span>
                </label>
                <label class="constraint-toggle" data-constraint="challengeMode">
                    <input type="checkbox" name="challengeMode">
                    <span>Challenge Mode (B/C only)</span>
                </label>
            </div>

            <button class="generate-random-btn" id="generate-random-build">
                <span class="dice-icon">🎲</span>
                <span>Generate Random Build</span>
            </button>

            <div class="random-build-result" id="random-build-result" style="display: none;">
                <h4>Your Random Build</h4>
                <div class="random-build-preview" id="random-build-preview">
                    <!-- Build preview will be rendered here -->
                </div>
                <div class="random-build-actions">
                    <button class="btn-secondary" id="apply-random-build">Apply to Build Planner</button>
                    <button class="btn-secondary" id="reroll-random-build">🎲 Reroll</button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render a generated build preview
 */
export function renderBuildPreview(build: RandomBuild): string {
    const slots: string[] = [];

    // Character slot
    if (build.character) {
        const imageHtml = generateEntityImage(build.character, build.character.name, 'slot-image');
        slots.push(`
            <div class="random-build-slot">
                <span class="slot-label">Character</span>
                ${imageHtml || '<span class="slot-icon">👤</span>'}
                <span class="slot-name">${escapeHtml(build.character.name)}</span>
            </div>
        `);
    }

    // Weapon slot
    if (build.weapon) {
        const imageHtml = generateEntityImage(build.weapon, build.weapon.name, 'slot-image');
        slots.push(`
            <div class="random-build-slot">
                <span class="slot-label">Weapon</span>
                ${imageHtml || '<span class="slot-icon">⚔️</span>'}
                <span class="slot-name">${escapeHtml(build.weapon.name)}</span>
            </div>
        `);
    }

    // Tome slots
    build.tomes.forEach((tome, index) => {
        const imageHtml = generateEntityImage(tome, tome.name, 'slot-image');
        slots.push(`
            <div class="random-build-slot">
                <span class="slot-label">Tome ${index + 1}</span>
                ${imageHtml || '<span class="slot-icon">📚</span>'}
                <span class="slot-name">${escapeHtml(tome.name)}</span>
            </div>
        `);
    });

    // Item slots
    build.items.forEach((item, index) => {
        const imageHtml = generateEntityImage(item, item.name, 'slot-image');
        slots.push(`
            <div class="random-build-slot">
                <span class="slot-label">Item ${index + 1}</span>
                ${imageHtml || '<span class="slot-icon">📦</span>'}
                <span class="slot-name">${escapeHtml(item.name)}</span>
            </div>
        `);
    });

    return slots.join('');
}

// ========================================
// Event Handling
// ========================================

let lastGeneratedBuild: RandomBuild | null = null;

// Boolean constraint keys that can be set from UI toggles
type BooleanConstraintKey = 'noLegendary' | 'noSSItems' | 'onlyOneAndDone' | 'randomTomeCount' | 'challengeMode';
const BOOLEAN_CONSTRAINT_KEYS: BooleanConstraintKey[] = [
    'noLegendary',
    'noSSItems',
    'onlyOneAndDone',
    'randomTomeCount',
    'challengeMode',
];

/**
 * Type guard to check if a string is a valid boolean constraint key
 */
function isBooleanConstraintKey(key: string): key is BooleanConstraintKey {
    return BOOLEAN_CONSTRAINT_KEYS.includes(key as BooleanConstraintKey);
}

/**
 * Get current constraints from UI
 */
function getConstraintsFromUI(): BuildConstraints {
    const constraints: BuildConstraints = {};

    const toggles = document.querySelectorAll('.constraint-toggle');
    toggles.forEach(toggle => {
        const checkbox = toggle.querySelector('input[type="checkbox"]') as HTMLInputElement;
        const constraintName = (toggle as HTMLElement).dataset.constraint;

        if (checkbox?.checked && constraintName && isBooleanConstraintKey(constraintName)) {
            constraints[constraintName] = true;
        }
    });

    return constraints;
}

/**
 * Handle generate button click
 */
function handleGenerate(): void {
    const generateBtn = document.getElementById('generate-random-build');
    const resultSection = document.getElementById('random-build-result');
    const previewContainer = document.getElementById('random-build-preview');

    if (!generateBtn || !resultSection || !previewContainer) return;

    // Add rolling animation
    generateBtn.classList.add('rolling');

    setTimeout(() => {
        // Generate the build
        const constraints = getConstraintsFromUI();
        lastGeneratedBuild = generateRandomBuild(constraints);

        // Check if we got a valid build (at least character or weapon)
        if (!lastGeneratedBuild.character && !lastGeneratedBuild.weapon) {
            // Show error message - constraints too restrictive
            previewContainer.innerHTML = `
                <div class="random-build-error">
                    <span class="error-icon">⚠️</span>
                    <p>No characters or weapons match your constraints.</p>
                    <p>Try loosening the filters (e.g., disable Challenge Mode).</p>
                </div>
            `;
            resultSection.style.display = 'block';
            generateBtn.classList.remove('rolling');

            logger.warn({
                operation: 'random-build.generate',
                error: { name: 'NoMatchError', message: 'No characters or weapons match constraints' },
                data: { constraints: Object.keys(constraints).filter(k => constraints[k as keyof BuildConstraints]) },
            });
            return;
        }

        // Render preview
        previewContainer.innerHTML = renderBuildPreview(lastGeneratedBuild);

        // Show result
        resultSection.style.display = 'block';

        // Remove animation
        generateBtn.classList.remove('rolling');
    }, 500);
}

/**
 * Handle apply to build planner
 */
async function handleApplyToBuildPlanner(): Promise<void> {
    if (!lastGeneratedBuild) return;

    try {
        // Import build planner module
        const { applyRandomBuild } = await import('./build-planner.ts');

        if (typeof applyRandomBuild === 'function') {
            applyRandomBuild(lastGeneratedBuild);

            // Switch to build planner tab
            const buildPlannerTab = document.querySelector('.tab-btn[data-tab="build-planner"]') as HTMLElement;
            buildPlannerTab?.click();
        }
    } catch (error) {
        logger.warn({
            operation: 'random-build.apply',
            error: { name: 'ImportError', message: 'Failed to apply build', module: 'random-build' },
        });
    }
}

/**
 * Setup event listeners for random build section
 */
export function setupRandomBuildHandlers(): void {
    const generateBtn = document.getElementById('generate-random-build');
    const rerollBtn = document.getElementById('reroll-random-build');
    const applyBtn = document.getElementById('apply-random-build');

    generateBtn?.addEventListener('click', handleGenerate);
    rerollBtn?.addEventListener('click', handleGenerate);
    applyBtn?.addEventListener('click', handleApplyToBuildPlanner);

    // Toggle button states
    const toggles = document.querySelectorAll('.constraint-toggle');
    toggles.forEach(toggle => {
        toggle.addEventListener('click', e => {
            const target = e.currentTarget as HTMLElement;
            const checkbox = target.querySelector('input[type="checkbox"]') as HTMLInputElement;

            // Toggle checkbox state
            if (e.target !== checkbox) {
                checkbox.checked = !checkbox.checked;
            }

            // Toggle active class
            target.classList.toggle('active', checkbox.checked);
        });
    });
}

// ========================================
// Export Types
// ========================================

export type { BuildConstraints, RandomBuild };
