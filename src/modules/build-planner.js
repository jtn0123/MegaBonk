// ========================================
// MegaBonk Build Planner Module
// ========================================

// Build planner state
let currentBuild = {
    character: null,
    weapon: null,
    tomes: [],
    items: []
};

/**
 * Render the build planner UI
 */
function renderBuildPlanner() {
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
function setupBuildPlannerEvents() {
    const charSelect = safeGetElementById('build-character');
    if (charSelect) {
        charSelect.addEventListener('change', (e) => {
            const charId = e.target.value;
            currentBuild.character = allData.characters?.characters.find(c => c.id === charId);
            updateBuildAnalysis();
        });
    }

    const weaponSelect = safeGetElementById('build-weapon');
    if (weaponSelect) {
        weaponSelect.addEventListener('change', (e) => {
            const weaponId = e.target.value;
            currentBuild.weapon = allData.weapons?.weapons.find(w => w.id === weaponId);
            updateBuildAnalysis();
        });
    }

    const exportBtn = safeGetElementById('export-build');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportBuild);
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
function calculateBuildStats() {
    // Use DEFAULT_BUILD_STATS from constants if available
    const stats = typeof DEFAULT_BUILD_STATS !== 'undefined'
        ? { ...DEFAULT_BUILD_STATS }
        : {
            damage: 100, hp: 100, crit_chance: 5, crit_damage: 150,
            attack_speed: 100, movement_speed: 100, armor: 0,
            evasion_internal: 0, projectiles: 1
        };

    // Bug fix #4: Use more specific matching instead of fragile includes()
    // Check for specific passive keywords that grant bonuses
    if (currentBuild.character) {
        const passive = currentBuild.character.passive_ability || '';
        // Match specific patterns to avoid false positives
        if (/\+\d+%?\s*Crit(ical)?\s*Chance/i.test(passive) ||
            currentBuild.character.id === 'fox') { // Fox has crit passive
            stats.crit_chance += 50;
        }
        if (/\+\d+%?\s*(Max\s*)?HP/i.test(passive) ||
            currentBuild.character.id === 'ogre') { // Ogre has HP passive
            stats.hp += 50;
        }
        if (/\+\d+%?\s*Damage/i.test(passive) ||
            currentBuild.character.id === 'megachad') { // Megachad has damage passive
            stats.damage += 20;
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
        else if (tome.stat_affected === 'Crit Chance' || tome.id === 'precision') stats.crit_chance += value * tomeLevel * 100;
        else if (tome.stat_affected === 'Crit Damage') stats.crit_damage += value * tomeLevel * 100;
        else if (tome.stat_affected === 'HP' || tome.id === 'vitality') stats.hp += value * tomeLevel * 100;
        else if (tome.stat_affected === 'Attack Speed' || tome.id === 'cooldown') stats.attack_speed += value * tomeLevel * 100;
        else if (tome.stat_affected === 'Movement Speed' || tome.id === 'agility') stats.movement_speed += value * tomeLevel * 100;
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

    stats.evasion = Math.round((stats.evasion_internal / (1 + stats.evasion_internal / 100)) * 100) / 100;
    stats.overcrit = stats.crit_chance > 100;
    return stats;
}

/**
 * Update build analysis display
 */
function updateBuildAnalysis() {
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
        statsDisplay.innerHTML = '<p class="stats-placeholder">Select character and weapon to see calculated stats...</p>';
    }

    // Synergy detection
    // Bug fix: Escape HTML in synergy messages for defense in depth
    let synergies = [];
    if (currentBuild.character && currentBuild.weapon) {
        if (currentBuild.character.synergies_weapons?.includes(currentBuild.weapon.name)) {
            synergies.push(`✓ ${escapeHtml(currentBuild.character.name)} synergizes with ${escapeHtml(currentBuild.weapon.name)}!`);
        }
    }

    currentBuild.items.forEach(item => {
        if (currentBuild.weapon && item.synergies_weapons?.includes(currentBuild.weapon.name)) {
            synergies.push(`✓ ${escapeHtml(item.name)} works great with ${escapeHtml(currentBuild.weapon.name)}`);
        }
    });

    synergiesDisplay.innerHTML = synergies.length > 0
        ? `<h4>🔗 Synergies Found:</h4><ul>${synergies.map(s => `<li>${s}</li>`).join('')}</ul>`
        : '<p>Select character, weapon, and items to see synergies...</p>';
}

/**
 * Export build to clipboard
 */
function exportBuild() {
    const buildCode = JSON.stringify({
        character: currentBuild.character?.id,
        weapon: currentBuild.weapon?.id,
        tomes: currentBuild.tomes.map(t => t.id),
        items: currentBuild.items.map(i => i.id)
    });

    navigator.clipboard.writeText(buildCode).then(() => {
        ToastManager.success('Build code copied to clipboard!');
    });
}

/**
 * Clear the current build
 */
function clearBuild() {
    currentBuild = { character: null, weapon: null, tomes: [], items: [] };
    safeSetValue('build-character', '');
    safeSetValue('build-weapon', '');
    safeQuerySelectorAll('.tome-checkbox').forEach(cb => cb.checked = false);
    safeQuerySelectorAll('.item-checkbox').forEach(cb => cb.checked = false);
    updateBuildAnalysis();
}

// ========================================
// Expose to global scope
// ========================================

// Bug fix #15: Provide getter instead of direct mutable reference
window.getCurrentBuild = () => ({ ...currentBuild }); // Return a shallow copy
window.currentBuild = currentBuild; // Keep for backward compatibility
window.renderBuildPlanner = renderBuildPlanner;
window.setupBuildPlannerEvents = setupBuildPlannerEvents;
window.calculateBuildStats = calculateBuildStats;
window.updateBuildAnalysis = updateBuildAnalysis;
window.exportBuild = exportBuild;
window.clearBuild = clearBuild;
