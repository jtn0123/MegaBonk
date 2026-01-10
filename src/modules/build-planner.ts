// ========================================
// MegaBonk Build Planner Module
// ========================================

import type { Character, Weapon, Tome, Item } from '../types/index.ts';
import { ToastManager } from './toast.ts';
import { allData } from './data-service.ts';
import { safeGetElementById, escapeHtml, safeQuerySelectorAll, safeSetValue } from './utils.ts';
import { BUILD_ITEMS_LIMIT, DEFAULT_BUILD_STATS, ITEM_EFFECTS, type BuildStats, type ItemEffect } from './constants.ts';

// ========================================
// Type Definitions
// ========================================

/**
 * Extended build stats with calculated properties
 */
interface CalculatedBuildStats extends BuildStats {
    evasion: number;
    overcrit: boolean;
}

/**
 * Build state structure
 */
interface Build {
    character: Character | null;
    weapon: Weapon | null;
    tomes: Tome[];
    items: Item[];
    name?: string;
    notes?: string;
}

/**
 * Build data for serialization (with IDs only)
 */
interface BuildData {
    character?: string;
    weapon?: string;
    tomes?: string[];
    items?: string[];
    name?: string;
    notes?: string;
    timestamp?: number;
}

/**
 * URL-encoded build data (abbreviated keys)
 */
interface URLBuildData {
    c?: string;
    w?: string;
    t?: string[];
    i?: string[];
}

/**
 * Build template structure
 */
interface BuildTemplate {
    name: string;
    description: string;
    build: BuildData;
}

/**
 * Build templates type
 */
type BuildTemplatesMap = Record<string, BuildTemplate>;

/**
 * Global function declarations
 */
declare global {
    function showBuildHistoryModal(): void;
}

// ========================================
// State
// ========================================

// Build planner state
let currentBuild: Build = {
    character: null,
    weapon: null,
    tomes: [],
    items: [],
    name: '',
    notes: '',
};

// Build history management
const BUILD_HISTORY_KEY = 'megabonk_build_history';
const MAX_BUILD_HISTORY = 20;

// ========================================
// Build Templates
// ========================================

// Build templates - uses valid IDs from data files
// Character passives: CL4NK=Crit, Sir Oofie=Armor, Monke=HP, Bandit=Attack Speed, Ogre=Damage
export const BUILD_TEMPLATES: Readonly<BuildTemplatesMap> = Object.freeze({
    crit_build: {
        name: '🎯 Crit Build',
        description: 'Maximize critical hit chance and damage',
        build: {
            character: 'cl4nk', // CL4NK has "Gain 1% Crit Chance per level"
            weapon: 'revolver',
            tomes: ['precision', 'damage'],
            items: ['clover', 'eagle_claw'],
        },
    },
    tank_build: {
        name: '🛡️ Tank Build',
        description: 'High HP and survivability',
        build: {
            character: 'sir_oofie', // Sir Oofie has "Gain 1% Armor per level"
            weapon: 'sword',
            tomes: ['hp', 'armor'],
            items: ['chonkplate', 'golden_shield'],
        },
    },
    speed_build: {
        name: '⚡ Speed Build',
        description: 'Fast attack and movement speed',
        build: {
            character: 'bandit', // Bandit has "Gain 1% Attack Speed per level"
            weapon: 'katana',
            tomes: ['cooldown', 'agility'],
            items: ['turbo_skates', 'turbo_socks'],
        },
    },
    glass_cannon: {
        name: '💥 Glass Cannon',
        description: 'Maximum damage, low defense',
        build: {
            character: 'ogre', // Ogre has "Gain 1.5% Damage per level"
            weapon: 'sniper_rifle',
            tomes: ['damage', 'cooldown'],
            items: ['power_gloves', 'gym_sauce'],
        },
    },
});

// ========================================
// Build History Management
// ========================================

/**
 * Get build history from localStorage
 * @returns Build history array
 */
export function getBuildHistory(): BuildData[] {
    try {
        const history = localStorage.getItem(BUILD_HISTORY_KEY);
        return history ? (JSON.parse(history) as BuildData[]) : [];
    } catch (error) {
        // Toast handles user feedback
        return [];
    }
}

/**
 * Save current build to history
 */
export function saveBuildToHistory(): void {
    if (!currentBuild.character && !currentBuild.weapon) {
        ToastManager.warning('Build must have at least a character or weapon');
        return;
    }

    try {
        let history = getBuildHistory();

        const buildData: BuildData = {
            name: currentBuild.name || `Build ${new Date().toLocaleString()}`,
            notes: currentBuild.notes || '',
            timestamp: Date.now(),
            character: currentBuild.character?.id,
            weapon: currentBuild.weapon?.id,
            tomes: currentBuild.tomes.map((t: Tome) => t.id),
            items: currentBuild.items.map((i: Item) => i.id),
        };

        // Add to front of history
        history.unshift(buildData);

        // Keep only MAX_BUILD_HISTORY builds
        history = history.slice(0, MAX_BUILD_HISTORY);

        localStorage.setItem(BUILD_HISTORY_KEY, JSON.stringify(history));
        ToastManager.success(`Build "${buildData.name}" saved to history!`);
    } catch (error) {
        // Toast handles user feedback
        ToastManager.error('Failed to save build to history');
    }
}

/**
 * Load a build from history
 * @param index - Index in history array
 */
export function loadBuildFromHistory(index: number): void {
    try {
        const history = getBuildHistory();
        if (index < 0 || index >= history.length) {
            ToastManager.error('Build not found in history');
            return;
        }

        const buildData = history[index];
        if (!buildData) {
            ToastManager.error('Build not found in history');
            return;
        }
        loadBuildFromData(buildData);
        ToastManager.success(`Loaded "${buildData.name || 'Build'}" from history`);
    } catch (error) {
        // Toast handles user feedback
        ToastManager.error('Failed to load build from history');
    }
}

/**
 * Delete a build from history
 * @param index - Index in history array
 */
export function deleteBuildFromHistory(index: number): void {
    try {
        let history = getBuildHistory();
        if (index < 0 || index >= history.length) {
            ToastManager.error('Build not found in history');
            return;
        }

        const buildName = history[index]?.name || 'Build';
        history.splice(index, 1);

        localStorage.setItem(BUILD_HISTORY_KEY, JSON.stringify(history));
        ToastManager.success(`Deleted "${buildName}" from history`);

        // Refresh history display if it's open
        if (typeof showBuildHistoryModal === 'function') {
            showBuildHistoryModal();
        }
    } catch (error) {
        // Toast handles user feedback
        ToastManager.error('Failed to delete build from history');
    }
}

/**
 * Clear all build history
 */
export function clearBuildHistory(): void {
    try {
        localStorage.removeItem(BUILD_HISTORY_KEY);
        ToastManager.success('Build history cleared');
    } catch (error) {
        // Toast handles user feedback
        ToastManager.error('Failed to clear build history');
    }
}

// ========================================
// Build Templates
// ========================================

/**
 * Load a build template
 * @param templateId - Template identifier
 */
export function loadBuildTemplate(templateId: string): void {
    const template = BUILD_TEMPLATES[templateId];
    if (!template) {
        ToastManager.error('Template not found');
        return;
    }

    try {
        currentBuild.name = template.name;
        currentBuild.notes = template.description;

        loadBuildFromData(template.build);
        ToastManager.success(`Loaded template: ${template.name}`);
    } catch (error) {
        // Toast handles user feedback
        ToastManager.error('Failed to load template');
    }
}

// ========================================
// Build Import/Export/Load
// ========================================

/**
 * Load build from data object
 * @param buildData - Build data with character, weapon, tomes, items IDs
 */
export function loadBuildFromData(buildData: BuildData): void {
    // Clear current build first
    clearBuild();

    // Load character
    if (buildData.character && allData.characters) {
        const char = allData.characters.characters.find((c: Character) => c.id === buildData.character);
        if (char) {
            currentBuild.character = char;
            safeSetValue('build-character', char.id);
        }
    }

    // Load weapon
    if (buildData.weapon && allData.weapons) {
        const weapon = allData.weapons.weapons.find((w: Weapon) => w.id === buildData.weapon);
        if (weapon) {
            currentBuild.weapon = weapon;
            safeSetValue('build-weapon', weapon.id);
        }
    }

    // Load tomes
    if (buildData.tomes && Array.isArray(buildData.tomes) && allData.tomes?.tomes) {
        buildData.tomes.forEach((tomeId: string) => {
            const tome = allData.tomes!.tomes.find((t: Tome) => t.id === tomeId);
            if (tome) {
                const checkbox = document.querySelector(`.tome-checkbox[value="${tomeId}"]`) as HTMLInputElement | null;
                if (checkbox) checkbox.checked = true;
            }
        });
    }

    // Load items
    if (buildData.items && Array.isArray(buildData.items) && allData.items?.items) {
        buildData.items.forEach((itemId: string) => {
            const item = allData.items!.items.find((i: Item) => i.id === itemId);
            if (item) {
                const checkbox = document.querySelector(`.item-checkbox[value="${itemId}"]`) as HTMLInputElement | null;
                if (checkbox) checkbox.checked = true;
            }
        });
    }

    // Load name and notes if available
    if (buildData.name) currentBuild.name = buildData.name;
    if (buildData.notes) currentBuild.notes = buildData.notes;

    updateBuildAnalysis();
}

/**
 * Import build from JSON string
 * @param jsonString - JSON string containing build data
 */
export function importBuild(jsonString: string): void {
    try {
        const buildData = JSON.parse(jsonString) as BuildData;
        loadBuildFromData(buildData);
        ToastManager.success('Build imported successfully!');
    } catch (error) {
        // Toast handles user feedback
        ToastManager.error('Invalid build data. Please check the format.');
    }
}

/**
 * Render the build planner UI
 */
export function renderBuildPlanner(): void {
    const charSelect = safeGetElementById('build-character') as HTMLSelectElement | null;
    if (charSelect) {
        charSelect.innerHTML = '<option value="">Select Character...</option>';
        if (allData.characters) {
            allData.characters.characters.forEach((char: Character) => {
                const option = document.createElement('option');
                option.value = char.id;
                option.textContent = `${char.name} (${char.tier} Tier)`;
                charSelect.appendChild(option);
            });
        }
    }

    const weaponSelect = safeGetElementById('build-weapon') as HTMLSelectElement | null;
    if (weaponSelect) {
        weaponSelect.innerHTML = '<option value="">Select Weapon...</option>';
        if (allData.weapons) {
            allData.weapons.weapons.forEach((weapon: Weapon) => {
                const option = document.createElement('option');
                option.value = weapon.id;
                option.textContent = `${weapon.name} (${weapon.tier} Tier)`;
                weaponSelect.appendChild(option);
            });
        }
    }

    const tomesSelection = safeGetElementById('tomes-selection');
    if (tomesSelection) {
        tomesSelection.innerHTML = '';
        if (allData.tomes?.tomes) {
            allData.tomes.tomes.forEach((tome: Tome) => {
                const label = document.createElement('label');
                // Security: Use escapeHtml to prevent XSS from compromised JSON data
                label.innerHTML = `<input type="checkbox" value="${escapeHtml(tome.id)}" class="tome-checkbox"> ${escapeHtml(tome.name)}`;
                tomesSelection.appendChild(label);
            });
        }
    }

    const itemsSelection = safeGetElementById('items-selection');
    if (itemsSelection) {
        itemsSelection.innerHTML = '';
        if (allData.items?.items) {
            allData.items.items.slice(0, BUILD_ITEMS_LIMIT).forEach((item: Item) => {
                const label = document.createElement('label');
                // Security: Use escapeHtml to prevent XSS from compromised JSON data
                label.innerHTML = `<input type="checkbox" value="${escapeHtml(item.id)}" class="item-checkbox"> ${escapeHtml(item.name)} (${escapeHtml(item.tier)})`;
                itemsSelection.appendChild(label);
            });
        }
    }
}

/**
 * Setup build planner event listeners
 */
export function setupBuildPlannerEvents(): void {
    const charSelect = safeGetElementById('build-character');
    if (charSelect) {
        charSelect.addEventListener('change', (e: Event) => {
            const target = e.target as HTMLSelectElement;
            const charId = target.value;
            currentBuild.character = allData.characters?.characters.find((c: Character) => c.id === charId) || null;
            updateBuildAnalysis();
        });
    }

    const weaponSelect = safeGetElementById('build-weapon');
    if (weaponSelect) {
        weaponSelect.addEventListener('change', (e: Event) => {
            const target = e.target as HTMLSelectElement;
            const weaponId = target.value;
            currentBuild.weapon = allData.weapons?.weapons.find((w: Weapon) => w.id === weaponId) || null;
            updateBuildAnalysis();
        });
    }

    const exportBtn = safeGetElementById('export-build');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportBuild);
    }

    const shareBtn = safeGetElementById('share-build-url');
    if (shareBtn) {
        shareBtn.addEventListener('click', shareBuildURL);
    }

    const clearBtn = safeGetElementById('clear-build');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearBuild);
    }
}

/**
 * Calculate build statistics
 * @returns Calculated stats
 */
export function calculateBuildStats(): CalculatedBuildStats {
    const stats: CalculatedBuildStats = { ...DEFAULT_BUILD_STATS, evasion: 0, overcrit: false };

    // Apply character passive bonuses based on passive_ability text
    // Character passives from data: CL4NK=Crit, Sir Oofie=Armor, Monke=HP, Bandit=Attack Speed, Ogre=Damage
    if (currentBuild.character) {
        const passive = currentBuild.character.passive_ability || '';
        const charId = currentBuild.character.id;

        // Crit Chance passive (CL4NK: "Gain 1% Crit Chance per level")
        if (/crit\s*chance/i.test(passive) || charId === 'cl4nk') {
            stats.crit_chance += 50;
        }
        // HP passive (Monke: "+2 Max HP per level")
        if (/\+\d+.*max\s*hp/i.test(passive) || charId === 'monke') {
            stats.hp += 50;
        }
        // Armor passive (Sir Oofie: "Gain 1% Armor per level")
        if (/armor/i.test(passive) || charId === 'sir_oofie') {
            stats.armor += 50;
        }
        // Damage passive (Ogre: "Gain 1.5% Damage per level")
        if (/gain.*damage/i.test(passive) || charId === 'ogre') {
            stats.damage += 20;
        }
        // Attack Speed passive (Bandit: "Gain 1% Attack Speed per level")
        if (/attack\s*speed/i.test(passive) || charId === 'bandit') {
            stats.attack_speed += 50;
        }
    }

    // Use parseFloat instead of parseInt for decimal damage values
    if (currentBuild.weapon) {
        const baseDamage = currentBuild.weapon.base_damage ?? currentBuild.weapon.baseDamage;
        stats.damage += parseFloat(String(baseDamage)) || 0;
    }

    currentBuild.tomes.forEach((tome: Tome) => {
        const tomeLevel = 5;
        // Use proper regex that won't match invalid numbers like "1.2.3"
        // Add safety check for value_per_level before calling match()
        const valueStr = tome.value_per_level || '';
        const value = parseFloat(String(valueStr).match(/\d+(?:\.\d+)?/)?.[0] || '0') || 0;
        if (tome.stat_affected === 'Damage') stats.damage += value * tomeLevel * 100;
        else if (tome.stat_affected === 'Crit Chance' || tome.id === 'precision')
            stats.crit_chance += value * tomeLevel * 100;
        else if (tome.stat_affected === 'Crit Damage') stats.crit_damage += value * tomeLevel * 100;
        else if (tome.stat_affected === 'HP' || tome.id === 'vitality') stats.hp += value * tomeLevel * 100;
        else if (tome.stat_affected === 'Attack Speed' || tome.id === 'cooldown')
            stats.attack_speed += value * tomeLevel * 100;
        else if (tome.stat_affected === 'Movement Speed' || tome.id === 'agility')
            stats.movement_speed += value * tomeLevel * 100;
        else if (tome.id === 'armor') stats.armor += value * tomeLevel * 100;
    });

    // Apply item effects using ITEM_EFFECTS constant
    currentBuild.items.forEach((item: Item) => {
        const effect: ItemEffect | undefined = ITEM_EFFECTS[item.id];
        if (effect) {
            const statKey = effect.stat;
            if (effect.type === 'add') {
                stats[statKey] += effect.value;
            } else if (effect.type === 'multiply') {
                stats[statKey] *= effect.value;
            } else if (effect.type === 'hp_percent') {
                // Special: damage based on HP percentage
                stats[statKey] += (stats.hp / 100) * effect.value;
            }
        }
    });

    // Prevent division by zero in evasion formula if evasion_internal is <= -100
    // Formula: evasion = internal / (1 + internal/100)
    // Clamp evasion_internal to prevent negative or zero denominator
    const clampedEvasionInternal = Math.max(stats.evasion_internal, -99);
    stats.evasion = Math.round((clampedEvasionInternal / (1 + clampedEvasionInternal / 100)) * 100) / 100;
    stats.overcrit = stats.crit_chance > 100;
    return stats;
}

/**
 * Update build analysis display
 */
export function updateBuildAnalysis(): void {
    const selectedTomes = Array.from(safeQuerySelectorAll('.tome-checkbox:checked')).map(
        (cb: Element) => (cb as HTMLInputElement).value
    );
    if (allData.tomes?.tomes) {
        currentBuild.tomes = selectedTomes
            .map((id: string) => allData.tomes!.tomes.find((t: Tome) => t.id === id))
            .filter((t): t is Tome => t !== undefined);
    } else {
        currentBuild.tomes = [];
    }

    const selectedItems = Array.from(safeQuerySelectorAll('.item-checkbox:checked')).map(
        (cb: Element) => (cb as HTMLInputElement).value
    );
    if (allData.items?.items) {
        currentBuild.items = selectedItems
            .map((id: string) => allData.items!.items.find((i: Item) => i.id === id))
            .filter((i): i is Item => i !== undefined);
    } else {
        currentBuild.items = [];
    }

    const synergiesDisplay = safeGetElementById('build-synergies');
    const statsDisplay = safeGetElementById('build-stats');
    if (!synergiesDisplay || !statsDisplay) return;

    // Calculate and display stats
    if (currentBuild.character && currentBuild.weapon) {
        const stats = calculateBuildStats();
        statsDisplay.innerHTML = `
            <div class="stat-card"><div class="stat-icon">⚔️</div><div class="stat-info"><div class="stat-label">Total Damage</div><div class="stat-value">${stats.damage.toFixed(0)}%</div></div></div>
            <div class="stat-card"><div class="stat-icon">❤️</div><div class="stat-info"><div class="stat-label">Max HP</div><div class="stat-value">${stats.hp.toFixed(0)}</div></div></div>
            <div class="stat-card ${stats.overcrit ? 'stat-overcrit' : ''}"><div class="stat-icon">💥</div><div class="stat-info"><div class="stat-label">Crit Chance${stats.overcrit ? ' (OVERCRIT!)' : ''}</div><div class="stat-value">${stats.crit_chance.toFixed(1)}%</div></div></div>
            <div class="stat-card"><div class="stat-icon">🎯</div><div class="stat-info"><div class="stat-label">Crit Damage</div><div class="stat-value">${stats.crit_damage.toFixed(0)}%</div></div></div>
            <div class="stat-card"><div class="stat-icon">⚡</div><div class="stat-info"><div class="stat-label">Attack Speed</div><div class="stat-value">${stats.attack_speed.toFixed(0)}%</div></div></div>
            <div class="stat-card"><div class="stat-icon">👟</div><div class="stat-info"><div class="stat-label">Movement Speed</div><div class="stat-value">${stats.movement_speed.toFixed(0)}%</div></div></div>
            <div class="stat-card"><div class="stat-icon">🛡️</div><div class="stat-info"><div class="stat-label">Armor</div><div class="stat-value">${stats.armor.toFixed(0)}</div></div></div>
            <div class="stat-card"><div class="stat-icon">💨</div><div class="stat-info"><div class="stat-label">Evasion</div><div class="stat-value">${stats.evasion.toFixed(1)}%</div></div></div>
            <div class="stat-card"><div class="stat-icon">🎯</div><div class="stat-info"><div class="stat-label">Projectiles</div><div class="stat-value">${stats.projectiles}</div></div></div>
        `;
    } else {
        statsDisplay.innerHTML =
            '<p class="stats-placeholder">Select character and weapon to see calculated stats...</p>';
    }

    // Synergy detection
    // Escape HTML in synergy messages for defense in depth
    const synergies: string[] = [];
    if (currentBuild.character && currentBuild.weapon) {
        if (currentBuild.character.synergies_weapons?.includes(currentBuild.weapon.name)) {
            synergies.push(
                `✓ ${escapeHtml(currentBuild.character.name)} synergizes with ${escapeHtml(currentBuild.weapon.name)}!`
            );
        }
    }

    currentBuild.items.forEach((item: Item) => {
        if (currentBuild.weapon && item.synergies_weapons?.includes(currentBuild.weapon.name)) {
            synergies.push(`✓ ${escapeHtml(item.name)} works great with ${escapeHtml(currentBuild.weapon.name)}`);
        }
    });

    synergiesDisplay.innerHTML =
        synergies.length > 0
            ? `<h4>🔗 Synergies Found:</h4><ul>${synergies.map((s: string) => `<li>${s}</li>`).join('')}</ul>`
            : '<p>Select character, weapon, and items to see synergies...</p>';

    // Update URL with current build
    updateBuildURL();
}

/**
 * Export build to clipboard
 */
export function exportBuild(): void {
    const buildCode = JSON.stringify({
        character: currentBuild.character?.id,
        weapon: currentBuild.weapon?.id,
        tomes: currentBuild.tomes.map((t: Tome) => t.id),
        items: currentBuild.items.map((i: Item) => i.id),
    });

    navigator.clipboard
        .writeText(buildCode)
        .then(() => {
            ToastManager.success('Build code copied to clipboard!');
        })
        .catch((err: Error) => {
            ToastManager.error(`Failed to copy to clipboard: ${err.message}`);
        });
}

/**
 * Share build via URL - encode build to URL hash
 */
export function shareBuildURL(): void {
    const buildData: URLBuildData = {
        c: currentBuild.character?.id,
        w: currentBuild.weapon?.id,
        t: currentBuild.tomes.map((t: Tome) => t.id),
        i: currentBuild.items.map((i: Item) => i.id),
    };

    // Remove empty fields
    if (!buildData.c) delete buildData.c;
    if (!buildData.w) delete buildData.w;
    if (!buildData.t || buildData.t.length === 0) delete buildData.t;
    if (!buildData.i || buildData.i.length === 0) delete buildData.i;

    const encoded = btoa(JSON.stringify(buildData));
    const url = `${window.location.origin}${window.location.pathname}#build=${encoded}`;

    navigator.clipboard
        .writeText(url)
        .then(() => {
            ToastManager.success('Build link copied to clipboard! Share it with friends.');
        })
        .catch((err: Error) => {
            ToastManager.error(`Failed to copy link: ${err.message}`);
        });
}

/**
 * Load build from URL hash
 */
export function loadBuildFromURL(): boolean {
    const hash = window.location.hash;
    if (!hash || !hash.includes('build=')) return false;

    try {
        const encoded = hash.split('build=')[1];
        if (!encoded) {
            ToastManager.error('Invalid build link');
            return false;
        }
        const decoded = JSON.parse(atob(encoded)) as URLBuildData;

        // Load character
        if (decoded.c && allData.characters) {
            const char = allData.characters.characters.find((c: Character) => c.id === decoded.c);
            if (char) {
                currentBuild.character = char;
                safeSetValue('build-character', char.id);
            }
        }

        // Load weapon
        if (decoded.w && allData.weapons) {
            const weapon = allData.weapons.weapons.find((w: Weapon) => w.id === decoded.w);
            if (weapon) {
                currentBuild.weapon = weapon;
                safeSetValue('build-weapon', weapon.id);
            }
        }

        // Load tomes
        if (decoded.t && Array.isArray(decoded.t) && allData.tomes?.tomes) {
            currentBuild.tomes = decoded.t
                .map((id: string) => allData.tomes!.tomes.find((t: Tome) => t.id === id))
                .filter((t): t is Tome => t !== undefined);
            currentBuild.tomes.forEach((tome: Tome) => {
                const checkbox = document.querySelector(
                    `.tome-checkbox[value="${tome.id}"]`
                ) as HTMLInputElement | null;
                if (checkbox) checkbox.checked = true;
            });
        }

        // Load items
        if (decoded.i && Array.isArray(decoded.i) && allData.items?.items) {
            currentBuild.items = decoded.i
                .map((id: string) => allData.items!.items.find((item: Item) => item.id === id))
                .filter((i): i is Item => i !== undefined);
            currentBuild.items.forEach((item: Item) => {
                const checkbox = document.querySelector(
                    `.item-checkbox[value="${item.id}"]`
                ) as HTMLInputElement | null;
                if (checkbox) checkbox.checked = true;
            });
        }

        updateBuildAnalysis();
        ToastManager.success('Build loaded from URL!');
        return true;
    } catch (error) {
        // Toast handles user feedback
        ToastManager.error('Invalid build link');
        return false;
    }
}

/**
 * Update URL with current build (without page reload)
 */
export function updateBuildURL(): void {
    if (
        !currentBuild.character &&
        !currentBuild.weapon &&
        currentBuild.tomes.length === 0 &&
        currentBuild.items.length === 0
    ) {
        // Empty build, remove hash
        if (window.location.hash) {
            history.replaceState(null, '', window.location.pathname);
        }
        return;
    }

    const buildData: URLBuildData = {
        c: currentBuild.character?.id,
        w: currentBuild.weapon?.id,
        t: currentBuild.tomes.map((t: Tome) => t.id),
        i: currentBuild.items.map((i: Item) => i.id),
    };

    // Remove empty fields
    if (!buildData.c) delete buildData.c;
    if (!buildData.w) delete buildData.w;
    if (!buildData.t || buildData.t.length === 0) delete buildData.t;
    if (!buildData.i || buildData.i.length === 0) delete buildData.i;

    const encoded = btoa(JSON.stringify(buildData));
    history.replaceState(null, '', `#build=${encoded}`);
}

/**
 * Clear the current build
 */
export function clearBuild(): void {
    currentBuild = { character: null, weapon: null, tomes: [], items: [] };
    safeSetValue('build-character', '');
    safeSetValue('build-weapon', '');
    safeQuerySelectorAll('.tome-checkbox').forEach((cb: Element) => ((cb as HTMLInputElement).checked = false));
    safeQuerySelectorAll('.item-checkbox').forEach((cb: Element) => ((cb as HTMLInputElement).checked = false));
    updateBuildAnalysis();
}

// ========================================
// Exported API
// ========================================

/**
 * Get current build (returns a shallow copy to prevent state corruption)
 * @returns Current build state
 */
export function getCurrentBuild(): Build {
    return { ...currentBuild };
}

// Export currentBuild for direct access (use with caution)
export { currentBuild };
