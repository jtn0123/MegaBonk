// ========================================
// MegaBonk Build Planner Module
// ========================================

import { ToastManager } from './toast.js';
import { allData } from './data-service.js';
import { safeGetElementById } from './utils.js';
// Build planner state
let currentBuild = {
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

// Build templates - uses valid IDs from data files
// Character passives: CL4NK=Crit, Sir Oofie=Armor, Monke=HP, Bandit=Attack Speed, Ogre=Damage
export const BUILD_TEMPLATES = {
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
};

// ========================================
// Build History Management
// ========================================

/**
 * Get build history from localStorage
 * @returns {Array} Build history array
 */
export function getBuildHistory() {
    try {
        const history = localStorage.getItem(BUILD_HISTORY_KEY);
        return history ? JSON.parse(history) : [];
    } catch (error) {
        console.error('[Build History] Failed to load:', error);
        return [];
    }
}

/**
 * Save current build to history
 */
export function saveBuildToHistory() {
    if (!currentBuild.character && !currentBuild.weapon) {
        ToastManager.warning('Build must have at least a character or weapon');
        return;
    }

    try {
        let history = getBuildHistory();

        const buildData = {
            name: currentBuild.name || `Build ${new Date().toLocaleString()}`,
            notes: currentBuild.notes || '',
            timestamp: Date.now(),
            character: currentBuild.character?.id,
            weapon: currentBuild.weapon?.id,
            tomes: currentBuild.tomes.map(t => t.id),
            items: currentBuild.items.map(i => i.id),
        };

        // Add to front of history
        history.unshift(buildData);

        // Keep only MAX_BUILD_HISTORY builds
        history = history.slice(0, MAX_BUILD_HISTORY);

        localStorage.setItem(BUILD_HISTORY_KEY, JSON.stringify(history));
        ToastManager.success(`Build "${buildData.name}" saved to history!`);
    } catch (error) {
        console.error('[Build History] Failed to save:', error);
        ToastManager.error('Failed to save build to history');
    }
}

/**
 * Load a build from history
 * @param {number} index - Index in history array
 */
export function loadBuildFromHistory(index) {
    try {
        const history = getBuildHistory();
        if (index < 0 || index >= history.length) {
            ToastManager.error('Build not found in history');
            return;
        }

        const buildData = history[index];
        loadBuildFromData(buildData);
        ToastManager.success(`Loaded "${buildData.name}" from history`);
    } catch (error) {
        console.error('[Build History] Failed to load build:', error);
        ToastManager.error('Failed to load build from history');
    }
}

/**
 * Delete a build from history
 * @param {number} index - Index in history array
 */
export function deleteBuildFromHistory(index) {
    try {
        let history = getBuildHistory();
        if (index < 0 || index >= history.length) {
            ToastManager.error('Build not found in history');
            return;
        }

        const buildName = history[index].name;
        history.splice(index, 1);

        localStorage.setItem(BUILD_HISTORY_KEY, JSON.stringify(history));
        ToastManager.success(`Deleted "${buildName}" from history`);

        // Refresh history display if it's open
        if (typeof showBuildHistoryModal === 'function') {
            showBuildHistoryModal();
        }
    } catch (error) {
        console.error('[Build History] Failed to delete:', error);
        ToastManager.error('Failed to delete build from history');
    }
}

/**
 * Clear all build history
 */
export function clearBuildHistory() {
    try {
        localStorage.removeItem(BUILD_HISTORY_KEY);
        ToastManager.success('Build history cleared');
    } catch (error) {
        console.error('[Build History] Failed to clear:', error);
        ToastManager.error('Failed to clear build history');
    }
}

// ========================================
// Build Templates
// ========================================

/**
 * Load a build template
 * @param {string} templateId - Template identifier
 */
export function loadBuildTemplate(templateId) {
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
        console.error('[Build Templates] Failed to load:', error);
        ToastManager.error('Failed to load template');
    }
}

// ========================================
// Build Import/Export/Load
// ========================================

/**
 * Load build from data object
 * @param {Object} buildData - Build data with character, weapon, tomes, items IDs
 */
export function loadBuildFromData(buildData) {
    // Clear current build first
    clearBuild();

    // Load character
    if (buildData.character && allData.characters) {
        const char = allData.characters.characters.find(c => c.id === buildData.character);
        if (char) {
            currentBuild.character = char;
            safeSetValue('build-character', char.id);
        }
    }

    // Load weapon
    if (buildData.weapon && allData.weapons) {
        const weapon = allData.weapons.weapons.find(w => w.id === buildData.weapon);
        if (weapon) {
            currentBuild.weapon = weapon;
            safeSetValue('build-weapon', weapon.id);
        }
    }

    // Load tomes
    if (buildData.tomes && Array.isArray(buildData.tomes) && allData.tomes) {
        buildData.tomes.forEach(tomeId => {
            const tome = allData.tomes.tomes.find(t => t.id === tomeId);
            if (tome) {
                const checkbox = document.querySelector(`.tome-checkbox[value="${tomeId}"]`);
                if (checkbox) checkbox.checked = true;
            }
        });
    }

    // Load items
    if (buildData.items && Array.isArray(buildData.items) && allData.items) {
        buildData.items.forEach(itemId => {
            const item = allData.items.items.find(i => i.id === itemId);
            if (item) {
                const checkbox = document.querySelector(`.item-checkbox[value="${itemId}"]`);
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
 * @param {string} jsonString - JSON string containing build data
 */
export function importBuild(jsonString) {
    try {
        const buildData = JSON.parse(jsonString);
        loadBuildFromData(buildData);
        ToastManager.success('Build imported successfully!');
    } catch (error) {
        console.error('[Build Import] Failed:', error);
        ToastManager.error('Invalid build data. Please check the format.');
    }
}

/**
 * Render the build planner UI
 */
export function renderBuildPlanner() {
    const charSelect = safeGetElementById('build-character');
    if (charSelect) {
        charSelect.innerHTML = '<option value="">Select Character...</option>';
        if (allData.characters) {
            allData.characters.characters.forEach(char => {
                const option = document.createElement('option');
                option.value = char.id;
                option.textContent = `${char.name} (${char.tier} Tier)`;
                charSelect.appendChild(option);
            });
        }
    }

    const weaponSelect = safeGetElementById('build-weapon');
    if (weaponSelect) {
        weaponSelect.innerHTML = '<option value="">Select Weapon...</option>';
        if (allData.weapons) {
            allData.weapons.weapons.forEach(weapon => {
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
        if (allData.tomes) {
            allData.tomes.tomes.forEach(tome => {
                const label = document.createElement('label');
                label.innerHTML = `<input type="checkbox" value="${tome.id}" class="tome-checkbox"> ${tome.name}`;
                tomesSelection.appendChild(label);
            });
        }
    }

    const itemsSelection = safeGetElementById('items-selection');
    if (itemsSelection) {
        itemsSelection.innerHTML = '';
        if (allData.items) {
            // Use constant instead of magic number
            const limit = typeof BUILD_ITEMS_LIMIT !== 'undefined' ? BUILD_ITEMS_LIMIT : 40;
            allData.items.items.slice(0, limit).forEach(item => {
                const label = document.createElement('label');
                label.innerHTML = `<input type="checkbox" value="${item.id}" class="item-checkbox"> ${item.name} (${item.tier})`;
                itemsSelection.appendChild(label);
            });
        }
    }
}

/**
 * Setup build planner event listeners
 */
export function setupBuildPlannerEvents() {
    const charSelect = safeGetElementById('build-character');
    if (charSelect) {
        charSelect.addEventListener('change', e => {
            const charId = e.target.value;
            currentBuild.character = allData.characters?.characters.find(c => c.id === charId);
            updateBuildAnalysis();
        });
    }

    const weaponSelect = safeGetElementById('build-weapon');
    if (weaponSelect) {
        weaponSelect.addEventListener('change', e => {
            const weaponId = e.target.value;
            currentBuild.weapon = allData.weapons?.weapons.find(w => w.id === weaponId);
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
 * @returns {Object} Calculated stats
 */
export function calculateBuildStats() {
    // Use DEFAULT_BUILD_STATS from constants if available
    const stats =
        typeof DEFAULT_BUILD_STATS !== 'undefined'
            ? { ...DEFAULT_BUILD_STATS }
            : {
                  damage: 100,
                  hp: 100,
                  crit_chance: 5,
                  crit_damage: 150,
                  attack_speed: 100,
                  movement_speed: 100,
                  armor: 0,
                  evasion_internal: 0,
                  projectiles: 1,
              };

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

    // Bug fix #5: Use parseFloat instead of parseInt for decimal damage values
    if (currentBuild.weapon) {
        stats.damage += parseFloat(currentBuild.weapon.base_damage) || 0;
    }

    currentBuild.tomes.forEach(tome => {
        const tomeLevel = 5;
        // Bug fix #13: Use proper regex that won't match invalid numbers like "1.2.3"
        // Bug fix: Add safety check for value_per_level before calling match()
        const valueStr = tome.value_per_level || '';
        const value = parseFloat(valueStr.toString().match(/\d+(?:\.\d+)?/)?.[0] || 0) || 0;
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

    // Apply item effects using ITEM_EFFECTS constant if available
    currentBuild.items.forEach(item => {
        const effect = typeof ITEM_EFFECTS !== 'undefined' ? ITEM_EFFECTS[item.id] : null;
        if (effect) {
            if (effect.type === 'add') {
                stats[effect.stat] += effect.value;
            } else if (effect.type === 'multiply') {
                stats[effect.stat] *= effect.value;
            } else if (effect.type === 'hp_percent') {
                // Special: damage based on HP percentage
                stats[effect.stat] += (stats.hp / 100) * effect.value;
            }
        }
    });

    // Bug fix: Prevent division by zero in evasion formula if evasion_internal is <= -100
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
export function updateBuildAnalysis() {
    const selectedTomes = Array.from(safeQuerySelectorAll('.tome-checkbox:checked')).map(cb => cb.value);
    currentBuild.tomes = selectedTomes.map(id => allData.tomes?.tomes.find(t => t.id === id)).filter(Boolean);

    const selectedItems = Array.from(safeQuerySelectorAll('.item-checkbox:checked')).map(cb => cb.value);
    currentBuild.items = selectedItems.map(id => allData.items?.items.find(i => i.id === id)).filter(Boolean);

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
    // Bug fix: Escape HTML in synergy messages for defense in depth
    let synergies = [];
    if (currentBuild.character && currentBuild.weapon) {
        if (currentBuild.character.synergies_weapons?.includes(currentBuild.weapon.name)) {
            synergies.push(
                `✓ ${escapeHtml(currentBuild.character.name)} synergizes with ${escapeHtml(currentBuild.weapon.name)}!`
            );
        }
    }

    currentBuild.items.forEach(item => {
        if (currentBuild.weapon && item.synergies_weapons?.includes(currentBuild.weapon.name)) {
            synergies.push(`✓ ${escapeHtml(item.name)} works great with ${escapeHtml(currentBuild.weapon.name)}`);
        }
    });

    synergiesDisplay.innerHTML =
        synergies.length > 0
            ? `<h4>🔗 Synergies Found:</h4><ul>${synergies.map(s => `<li>${s}</li>`).join('')}</ul>`
            : '<p>Select character, weapon, and items to see synergies...</p>';

    // Update URL with current build
    updateBuildURL();
}

/**
 * Export build to clipboard
 */
export function exportBuild() {
    const buildCode = JSON.stringify({
        character: currentBuild.character?.id,
        weapon: currentBuild.weapon?.id,
        tomes: currentBuild.tomes.map(t => t.id),
        items: currentBuild.items.map(i => i.id),
    });

    navigator.clipboard
        .writeText(buildCode)
        .then(() => {
            ToastManager.success('Build code copied to clipboard!');
        })
        .catch(err => {
            ToastManager.error(`Failed to copy to clipboard: ${err.message}`);
            console.error('Clipboard error:', err);
        });
}

/**
 * Share build via URL - encode build to URL hash
 */
export function shareBuildURL() {
    const buildData = {
        c: currentBuild.character?.id,
        w: currentBuild.weapon?.id,
        t: currentBuild.tomes.map(t => t.id),
        i: currentBuild.items.map(i => i.id),
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
        .catch(err => {
            ToastManager.error(`Failed to copy link: ${err.message}`);
            console.error('Clipboard error:', err);
        });
}

/**
 * Load build from URL hash
 */
export function loadBuildFromURL() {
    const hash = window.location.hash;
    if (!hash || !hash.includes('build=')) return false;

    try {
        const encoded = hash.split('build=')[1];
        const decoded = JSON.parse(atob(encoded));

        // Load character
        if (decoded.c && allData.characters) {
            const char = allData.characters.characters.find(c => c.id === decoded.c);
            if (char) {
                currentBuild.character = char;
                safeSetValue('build-character', char.id);
            }
        }

        // Load weapon
        if (decoded.w && allData.weapons) {
            const weapon = allData.weapons.weapons.find(w => w.id === decoded.w);
            if (weapon) {
                currentBuild.weapon = weapon;
                safeSetValue('build-weapon', weapon.id);
            }
        }

        // Load tomes
        if (decoded.t && Array.isArray(decoded.t) && allData.tomes) {
            currentBuild.tomes = decoded.t.map(id => allData.tomes.tomes.find(t => t.id === id)).filter(Boolean);
            currentBuild.tomes.forEach(tome => {
                const checkbox = document.querySelector(`.tome-checkbox[value="${tome.id}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }

        // Load items
        if (decoded.i && Array.isArray(decoded.i) && allData.items) {
            currentBuild.items = decoded.i.map(id => allData.items.items.find(item => item.id === id)).filter(Boolean);
            currentBuild.items.forEach(item => {
                const checkbox = document.querySelector(`.item-checkbox[value="${item.id}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }

        updateBuildAnalysis();
        ToastManager.success('Build loaded from URL!');
        return true;
    } catch (error) {
        console.error('Failed to load build from URL:', error);
        ToastManager.error('Invalid build link');
        return false;
    }
}

/**
 * Update URL with current build (without page reload)
 */
export function updateBuildURL() {
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

    const buildData = {
        c: currentBuild.character?.id,
        w: currentBuild.weapon?.id,
        t: currentBuild.tomes.map(t => t.id),
        i: currentBuild.items.map(i => i.id),
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
export function clearBuild() {
    currentBuild = { character: null, weapon: null, tomes: [], items: [] };
    safeSetValue('build-character', '');
    safeSetValue('build-weapon', '');
    safeQuerySelectorAll('.tome-checkbox').forEach(cb => (cb.checked = false));
    safeQuerySelectorAll('.item-checkbox').forEach(cb => (cb.checked = false));
    updateBuildAnalysis();
}

// ========================================
// Exported API
// ========================================

/**
 * Get current build (returns a shallow copy to prevent state corruption)
 * @returns {Object} Current build state
 */
export function getCurrentBuild() {
    return { ...currentBuild };
}

// Export currentBuild for direct access (use with caution)
export { currentBuild };
