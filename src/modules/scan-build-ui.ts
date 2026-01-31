// ========================================
// MegaBonk Scan Build - UI Module
// ========================================
// Handles UI rendering, DOM manipulation, element creation
// ========================================

import type { Item, Tome, Character, Weapon, AllGameData } from '../types/index.ts';
import { escapeHtml } from './utils.ts';
import type { EventListenerManager } from './dom-utils.ts';

// Types for state callbacks
export interface SelectionState {
    selectedItems: Map<string, { item: Item; count: number }>;
    selectedTomes: Map<string, Tome>;
    selectedCharacter: Character | null;
    selectedWeapon: Weapon | null;
}

export type SelectionUpdateCallback = (state: SelectionState) => void;
export type ItemCountUpdateCallback = (item: Item, delta: number) => number;

/**
 * Display the uploaded image
 * Uses DOM manipulation instead of innerHTML to prevent XSS from malformed data URLs
 */
export function displayUploadedImage(
    uploadedImage: string,
    eventListenerManager: EventListenerManager,
    onClearImage: () => void
): void {
    const previewContainer = document.getElementById('scan-image-preview');
    if (!previewContainer || !uploadedImage) return;

    // Clear existing content safely
    previewContainer.innerHTML = '';

    // Create elements via DOM API to prevent XSS
    const wrapper = document.createElement('div');
    wrapper.className = 'scan-image-wrapper';

    const img = document.createElement('img');
    img.src = uploadedImage; // Set via property, not innerHTML
    img.alt = 'Uploaded build screenshot';
    img.className = 'scan-preview-image';

    const clearBtn = document.createElement('button');
    clearBtn.className = 'scan-clear-btn';
    clearBtn.id = 'scan-clear-image';
    clearBtn.setAttribute('aria-label', 'Clear image');
    clearBtn.textContent = '✕';

    wrapper.appendChild(img);
    wrapper.appendChild(clearBtn);
    previewContainer.appendChild(wrapper);

    previewContainer.style.display = 'block';

    // Show auto-detect button
    const autoDetectArea = document.getElementById('scan-auto-detect-area');
    if (autoDetectArea) {
        autoDetectArea.style.display = 'block';
    }

    // Attach clear button listener using centralized event manager for cleanup
    eventListenerManager.add(clearBtn, 'click', onClearImage);
}

/**
 * Clear uploaded image display and hide related areas
 */
export function clearImageDisplay(): void {
    const previewContainer = document.getElementById('scan-image-preview');
    if (previewContainer) {
        previewContainer.innerHTML = '';
        previewContainer.style.display = 'none';
    }

    const selectionContainer = document.getElementById('scan-selection-area');
    if (selectionContainer) {
        selectionContainer.style.display = 'none';
    }

    const autoDetectArea = document.getElementById('scan-auto-detect-area');
    if (autoDetectArea) {
        autoDetectArea.style.display = 'none';
    }

    const detectionInfo = document.getElementById('scan-detection-info');
    if (detectionInfo) {
        detectionInfo.style.display = 'none';
    }

    // Clear file input
    const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
    if (fileInput) {
        fileInput.value = '';
    }
}

/**
 * Show item selection grid
 */
export function showItemSelectionGrid(
    allData: AllGameData,
    onCharacterSelect: (character: Character) => void,
    onWeaponSelect: (weapon: Weapon) => void,
    onItemCountChange: ItemCountUpdateCallback,
    onTomeToggle: (tome: Tome, selected: boolean) => void,
    updateSummary: () => void
): void {
    const selectionContainer = document.getElementById('scan-selection-area');
    if (!selectionContainer) return;

    selectionContainer.style.display = 'block';

    // Create character/weapon selection
    createEntitySelection('character', allData.characters?.characters || [], entity => {
        onCharacterSelect(entity as Character);
        updateSummary();
    });
    createEntitySelection('weapon', allData.weapons?.weapons || [], entity => {
        onWeaponSelect(entity as Weapon);
        updateSummary();
    });

    // Create item selection grid
    createItemGrid(allData, onItemCountChange, updateSummary);

    // Create tome selection grid
    createTomeGrid(allData, onTomeToggle, updateSummary);

    // Update summary
    updateSummary();
}

/**
 * Create entity selection (character/weapon)
 */
function createEntitySelection(
    type: 'character' | 'weapon',
    entities: (Character | Weapon)[],
    onSelect: (entity: Character | Weapon) => void
): void {
    const container = document.getElementById(`scan-${type}-grid`);
    if (!container) return;

    container.innerHTML = '';

    entities.forEach((entity: Character | Weapon) => {
        const card = document.createElement('button');
        card.className = 'scan-entity-card';
        card.dataset.id = entity.id;
        card.innerHTML = `
            <div class="scan-entity-name">${escapeHtml(entity.name)}</div>
            <div class="scan-entity-tier tier-${escapeHtml(entity.tier.toLowerCase())}">${escapeHtml(entity.tier)}</div>
        `;

        card.addEventListener('click', () => {
            // Deselect all others
            container.querySelectorAll('.scan-entity-card').forEach(c => c.classList.remove('selected'));
            // Select this one
            card.classList.add('selected');
            onSelect(entity);
        });

        container.appendChild(card);
    });
}

/**
 * Create item selection grid
 */
function createItemGrid(
    allData: AllGameData,
    onItemCountChange: ItemCountUpdateCallback,
    updateSummary: () => void
): void {
    const container = document.getElementById('scan-item-grid');
    if (!container || !allData.items?.items) return;

    container.innerHTML = '';

    // Add search filter
    const searchBox = document.createElement('input');
    searchBox.type = 'search';
    searchBox.className = 'scan-search-input';
    searchBox.placeholder = '🔍 Search items...';
    searchBox.addEventListener('input', e => {
        const query = (e.target as HTMLInputElement).value.toLowerCase();
        filterItemGrid(query);
    });
    container.appendChild(searchBox);

    // Create grid container
    const gridContainer = document.createElement('div');
    gridContainer.className = 'scan-grid-items';
    gridContainer.id = 'scan-grid-items-container';

    allData.items.items.forEach(item => {
        const card = createItemCard(item, onItemCountChange, updateSummary);
        gridContainer.appendChild(card);
    });

    container.appendChild(gridContainer);
}

/**
 * Create individual item card
 */
function createItemCard(
    item: Item,
    onItemCountChange: ItemCountUpdateCallback,
    updateSummary: () => void
): HTMLElement {
    const card = document.createElement('div');
    card.className = 'scan-item-card';
    card.dataset.id = item.id;
    card.dataset.name = item.name.toLowerCase();

    // Item info
    const info = document.createElement('div');
    info.className = 'scan-item-info';
    info.innerHTML = `
        <div class="scan-item-name">${escapeHtml(item.name)}</div>
        <div class="scan-item-tier tier-${escapeHtml(item.tier.toLowerCase())}">${escapeHtml(item.tier)}</div>
    `;

    // Counter controls
    const controls = document.createElement('div');
    controls.className = 'scan-item-controls';

    const decrementBtn = document.createElement('button');
    decrementBtn.className = 'scan-count-btn';
    decrementBtn.textContent = '−';
    decrementBtn.setAttribute('aria-label', `Decrease ${item.name} count`);

    const countDisplay = document.createElement('span');
    countDisplay.className = 'scan-count-display';
    countDisplay.textContent = '0';

    const incrementBtn = document.createElement('button');
    incrementBtn.className = 'scan-count-btn';
    incrementBtn.textContent = '+';
    incrementBtn.setAttribute('aria-label', `Increase ${item.name} count`);

    const updateCount = (delta: number) => {
        const newCount = onItemCountChange(item, delta);
        countDisplay.textContent = newCount.toString();
        if (newCount === 0) {
            card.classList.remove('selected');
        } else {
            card.classList.add('selected');
        }
        updateSummary();
    };

    decrementBtn.addEventListener('click', () => updateCount(-1));
    incrementBtn.addEventListener('click', () => updateCount(1));

    controls.appendChild(decrementBtn);
    controls.appendChild(countDisplay);
    controls.appendChild(incrementBtn);

    card.appendChild(info);
    card.appendChild(controls);

    return card;
}

/**
 * Filter item grid by search query
 */
export function filterItemGrid(query: string): void {
    const gridContainer = document.getElementById('scan-grid-items-container');
    if (!gridContainer) return;

    const cards = gridContainer.querySelectorAll('.scan-item-card');
    cards.forEach(card => {
        const name = (card as HTMLElement).dataset.name || '';
        if (name.includes(query)) {
            (card as HTMLElement).style.display = 'flex';
        } else {
            (card as HTMLElement).style.display = 'none';
        }
    });
}

/**
 * Create tome selection grid
 */
function createTomeGrid(
    allData: AllGameData,
    onTomeToggle: (tome: Tome, selected: boolean) => void,
    updateSummary: () => void
): void {
    const container = document.getElementById('scan-tome-grid');
    if (!container || !allData.tomes?.tomes) return;

    container.innerHTML = '';

    allData.tomes.tomes.forEach(tome => {
        const card = document.createElement('button');
        card.className = 'scan-tome-card';
        card.dataset.id = tome.id;
        card.innerHTML = `
            <div class="scan-tome-name">${escapeHtml(tome.name)}</div>
            <div class="scan-tome-tier tier-${escapeHtml(tome.tier.toLowerCase())}">${escapeHtml(tome.tier)}</div>
        `;

        card.addEventListener('click', () => {
            const isSelected = card.classList.contains('selected');
            if (isSelected) {
                card.classList.remove('selected');
                onTomeToggle(tome, false);
            } else {
                card.classList.add('selected');
                onTomeToggle(tome, true);
            }
            updateSummary();
        });

        container.appendChild(card);
    });
}

/**
 * Highlight detected entity in the grid
 */
export function highlightDetectedEntity(type: 'character' | 'weapon' | 'tome', entityId: string): void {
    let gridId = '';
    switch (type) {
        case 'character':
            gridId = 'scan-character-grid';
            break;
        case 'weapon':
            gridId = 'scan-weapon-grid';
            break;
        case 'tome':
            gridId = 'scan-tome-grid';
            break;
    }

    const grid = document.getElementById(gridId);
    if (!grid) return;

    // Remove existing selections
    grid.querySelectorAll('.scan-entity-card, .scan-tome-card').forEach(card => {
        card.classList.remove('selected');
    });

    // Add selection to detected entity
    const card = grid.querySelector(`[data-id="${entityId}"]`);
    if (card) {
        card.classList.add('selected');
    }
}

/**
 * Update item card count display
 */
export function updateItemCardCount(itemId: string, count: number): void {
    const gridContainer = document.getElementById('scan-grid-items-container');
    if (!gridContainer) return;

    const card = gridContainer.querySelector(`[data-id="${itemId}"]`);
    if (!card) return;

    const countDisplay = card.querySelector('.scan-count-display');
    if (countDisplay) {
        countDisplay.textContent = count.toString();
    }

    card.classList.add('selected');
}

/**
 * Update selection summary display
 */
export function updateSelectionSummary(state: SelectionState): void {
    const summaryContainer = document.getElementById('scan-selection-summary');
    if (!summaryContainer) return;

    let html = '<h4>Selected Build State:</h4>';

    // Character
    if (state.selectedCharacter) {
        html += `<div class="scan-summary-item">👤 <strong>${escapeHtml(state.selectedCharacter.name)}</strong></div>`;
    }

    // Weapon
    if (state.selectedWeapon) {
        html += `<div class="scan-summary-item">⚔️ <strong>${escapeHtml(state.selectedWeapon.name)}</strong></div>`;
    }

    // Items
    if (state.selectedItems.size > 0) {
        html += '<div class="scan-summary-section"><strong>📦 Items:</strong><ul>';
        state.selectedItems.forEach(({ item, count }) => {
            html += `<li>${escapeHtml(item.name)} x${count}</li>`;
        });
        html += '</ul></div>';
    }

    // Tomes
    if (state.selectedTomes.size > 0) {
        html += '<div class="scan-summary-section"><strong>📚 Tomes:</strong><ul>';
        state.selectedTomes.forEach(tome => {
            html += `<li>${escapeHtml(tome.name)}</li>`;
        });
        html += '</ul></div>';
    }

    summaryContainer.innerHTML = html;

    // Show/hide apply button
    const applyBtn = document.getElementById('scan-apply-to-advisor');
    if (applyBtn) {
        applyBtn.style.display =
            state.selectedCharacter || state.selectedWeapon || state.selectedItems.size > 0 || state.selectedTomes.size > 0
                ? 'block'
                : 'none';
    }
}
