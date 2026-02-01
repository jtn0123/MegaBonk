// ========================================
// MegaBonk Build UI Module
// UI rendering, DOM updates, modals
// ========================================

import type { Character, Weapon, Tome, Item } from '../types/index.ts';
import { ToastManager } from './toast.ts';
import { allData } from './data-service.ts';
import { safeGetElementById, escapeHtml, safeQuerySelectorAll, safeSetValue } from './utils.ts';
import { BUILD_ITEMS_LIMIT } from './constants.ts';
import type { Build } from './store.ts';
import { calculateBuildStats, type CalculatedBuildStats } from './build-stats.ts';
import { detectSynergies } from './build-validation.ts';

// ========================================
// UI Rendering
// ========================================

/**
 * Render character select dropdown
 * Uses DocumentFragment to batch DOM operations
 */
export function renderCharacterSelect(): void {
    const charSelect = safeGetElementById('build-character') as HTMLSelectElement | null;
    if (!charSelect) return;
    
    charSelect.innerHTML = '<option value="">Select Character...</option>';
    
    if (allData.characters?.characters) {
        const fragment = document.createDocumentFragment();
        allData.characters.characters.forEach((char: Character) => {
            const option = document.createElement('option');
            option.value = char.id;
            option.textContent = `${char.name} (${char.tier} Tier)`;
            fragment.appendChild(option);
        });
        charSelect.appendChild(fragment);
    }
}

/**
 * Render weapon select dropdown
 * Uses DocumentFragment to batch DOM operations
 */
export function renderWeaponSelect(): void {
    const weaponSelect = safeGetElementById('build-weapon') as HTMLSelectElement | null;
    if (!weaponSelect) return;
    
    weaponSelect.innerHTML = '<option value="">Select Weapon...</option>';
    
    if (allData.weapons?.weapons) {
        const fragment = document.createDocumentFragment();
        allData.weapons.weapons.forEach((weapon: Weapon) => {
            const option = document.createElement('option');
            option.value = weapon.id;
            option.textContent = `${weapon.name} (${weapon.tier} Tier)`;
            fragment.appendChild(option);
        });
        weaponSelect.appendChild(fragment);
    }
}

/**
 * Render tomes selection checkboxes
 * Uses DocumentFragment to batch DOM operations
 */
export function renderTomesSelection(): void {
    const tomesSelection = safeGetElementById('tomes-selection');
    if (!tomesSelection) return;
    
    tomesSelection.innerHTML = '';
    
    if (allData.tomes?.tomes) {
        const fragment = document.createDocumentFragment();
        allData.tomes.tomes.forEach((tome: Tome) => {
            const label = document.createElement('label');
            // Security: Use escapeHtml to prevent XSS from compromised JSON data
            label.innerHTML = `<input type="checkbox" value="${escapeHtml(tome.id)}" class="tome-checkbox"> ${escapeHtml(tome.name)}`;
            fragment.appendChild(label);
        });
        tomesSelection.appendChild(fragment);
    }
}

/**
 * Render items selection checkboxes
 * Uses DocumentFragment to batch DOM operations
 */
export function renderItemsSelection(): void {
    const itemsSelection = safeGetElementById('items-selection');
    if (!itemsSelection) return;
    
    itemsSelection.innerHTML = '';
    
    if (allData.items?.items) {
        const fragment = document.createDocumentFragment();
        allData.items.items.slice(0, BUILD_ITEMS_LIMIT).forEach((item: Item) => {
            const label = document.createElement('label');
            // Security: Use escapeHtml to prevent XSS from compromised JSON data
            label.innerHTML = `<input type="checkbox" value="${escapeHtml(item.id)}" class="item-checkbox"> ${escapeHtml(item.name)} (${escapeHtml(item.tier)})`;
            fragment.appendChild(label);
        });
        itemsSelection.appendChild(fragment);
    }
}

/**
 * Render the build planner UI
 * Uses DocumentFragment to batch DOM operations and prevent layout thrashing
 */
export function renderBuildPlanner(): void {
    renderCharacterSelect();
    renderWeaponSelect();
    renderTomesSelection();
    renderItemsSelection();
}

/**
 * Render stats display
 * @param stats - Calculated stats to display
 */
export function renderStatsDisplay(stats: CalculatedBuildStats): void {
    const statsDisplay = safeGetElementById('build-stats');
    if (!statsDisplay) return;
    
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
}

/**
 * Render synergies display
 * @param synergies - Array of synergy messages
 */
export function renderSynergiesDisplay(synergies: string[]): void {
    const synergiesDisplay = safeGetElementById('build-synergies');
    if (!synergiesDisplay) return;
    
    synergiesDisplay.innerHTML =
        synergies.length > 0
            ? `<h4>🔗 Synergies Found:</h4><ul>${synergies.map((s: string) => `<li>${s}</li>`).join('')}</ul>`
            : '<p>Select character, weapon, and items to see synergies...</p>';
}

/**
 * Render placeholder when build is incomplete
 */
export function renderStatsPlaceholder(): void {
    const statsDisplay = safeGetElementById('build-stats');
    if (!statsDisplay) return;
    
    statsDisplay.innerHTML =
        '<p class="stats-placeholder">Select character and weapon to see calculated stats...</p>';
}

/**
 * Update the build analysis display (stats and synergies)
 * @param build - Current build state
 * @param onBuildUpdate - Callback when build state changes
 */
export function updateBuildDisplay(build: Build, onBuildUpdate?: () => void): void {
    // Calculate and display stats
    if (build.character && build.weapon) {
        const stats = calculateBuildStats(build);
        renderStatsDisplay(stats);
    } else {
        renderStatsPlaceholder();
    }
    
    // Detect and display synergies
    const synergyResult = detectSynergies(build);
    renderSynergiesDisplay(synergyResult.messages);
    
    // Notify of build update
    if (onBuildUpdate) {
        onBuildUpdate();
    }
}

// ========================================
// Checkbox/Selection State Management
// ========================================

/**
 * Set character selection in UI
 * @param charId - Character ID to select
 */
export function setCharacterSelection(charId: string): void {
    safeSetValue('build-character', charId);
}

/**
 * Set weapon selection in UI
 * @param weaponId - Weapon ID to select
 */
export function setWeaponSelection(weaponId: string): void {
    safeSetValue('build-weapon', weaponId);
}

/**
 * Set tome checkbox states
 * @param tomeIds - Array of tome IDs to check
 */
export function setTomeCheckboxes(tomeIds: string[]): void {
    const tomeCheckboxes = document.querySelectorAll('.tome-checkbox') as NodeListOf<HTMLInputElement>;
    const checkboxMap = new Map<string, HTMLInputElement>();
    tomeCheckboxes.forEach(cb => checkboxMap.set(cb.value, cb));
    
    tomeIds.forEach((tomeId: string) => {
        const checkbox = checkboxMap.get(tomeId);
        if (checkbox) checkbox.checked = true;
    });
}

/**
 * Set item checkbox states
 * @param itemIds - Array of item IDs to check
 */
export function setItemCheckboxes(itemIds: string[]): void {
    const itemCheckboxes = document.querySelectorAll('.item-checkbox') as NodeListOf<HTMLInputElement>;
    const checkboxMap = new Map<string, HTMLInputElement>();
    itemCheckboxes.forEach(cb => checkboxMap.set(cb.value, cb));
    
    itemIds.forEach((itemId: string) => {
        const checkbox = checkboxMap.get(itemId);
        if (checkbox) checkbox.checked = true;
    });
}

/**
 * Clear all selections in UI
 */
export function clearAllSelections(): void {
    safeSetValue('build-character', '');
    safeSetValue('build-weapon', '');
    safeQuerySelectorAll('.tome-checkbox').forEach((cb: Element) => ((cb as HTMLInputElement).checked = false));
    safeQuerySelectorAll('.item-checkbox').forEach((cb: Element) => ((cb as HTMLInputElement).checked = false));
}

/**
 * Get selected tome IDs from checkboxes
 * @returns Array of selected tome IDs
 */
export function getSelectedTomeIds(): string[] {
    return Array.from(safeQuerySelectorAll('.tome-checkbox:checked')).map(
        (cb: Element) => (cb as HTMLInputElement).value
    );
}

/**
 * Get selected item IDs from checkboxes
 * @returns Array of selected item IDs
 */
export function getSelectedItemIds(): string[] {
    return Array.from(safeQuerySelectorAll('.item-checkbox:checked')).map(
        (cb: Element) => (cb as HTMLInputElement).value
    );
}

// ========================================
// Clipboard Operations
// ========================================

/**
 * Copy text to clipboard with toast feedback
 * @param text - Text to copy
 * @param successMessage - Message to show on success
 */
export async function copyToClipboard(text: string, successMessage: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        ToastManager.success(successMessage);
        return true;
    } catch (err) {
        const error = err as Error;
        ToastManager.error(`Failed to copy to clipboard: ${error.message}`);
        return false;
    }
}

// ========================================
// Event Setup
// ========================================

/**
 * Setup build planner event listeners
 * @param onCharacterChange - Callback when character changes
 * @param onWeaponChange - Callback when weapon changes
 * @param onExport - Callback for export button
 * @param onShare - Callback for share button
 * @param onClear - Callback for clear button
 */
export function setupBuildPlannerEvents(
    onCharacterChange: (charId: string) => void,
    onWeaponChange: (weaponId: string) => void,
    onExport: () => void,
    onShare: () => void,
    onClear: () => void
): void {
    const charSelect = safeGetElementById('build-character');
    if (charSelect) {
        charSelect.addEventListener('change', (e: Event) => {
            const target = e.target as HTMLSelectElement;
            onCharacterChange(target.value);
        });
    }

    const weaponSelect = safeGetElementById('build-weapon');
    if (weaponSelect) {
        weaponSelect.addEventListener('change', (e: Event) => {
            const target = e.target as HTMLSelectElement;
            onWeaponChange(target.value);
        });
    }

    const exportBtn = safeGetElementById('export-build');
    if (exportBtn) {
        exportBtn.addEventListener('click', onExport);
    }

    const shareBtn = safeGetElementById('share-build-url');
    if (shareBtn) {
        shareBtn.addEventListener('click', onShare);
    }

    const clearBtn = safeGetElementById('clear-build');
    if (clearBtn) {
        clearBtn.addEventListener('click', onClear);
    }
}

/**
 * Setup tome and item checkbox change listeners
 * @param onSelectionChange - Callback when selection changes
 */
export function setupSelectionListeners(onSelectionChange: () => void): void {
    // Delegate to parent containers for efficiency
    const tomesSelection = safeGetElementById('tomes-selection');
    if (tomesSelection) {
        tomesSelection.addEventListener('change', onSelectionChange);
    }
    
    const itemsSelection = safeGetElementById('items-selection');
    if (itemsSelection) {
        itemsSelection.addEventListener('change', onSelectionChange);
    }
}
