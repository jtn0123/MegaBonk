// ========================================
// MegaBonk Scan Build Module
// ========================================
// Handles image upload and manual item identification for build recognition
// ========================================

import type { Item, Tome, AllGameData, Character, Weapon } from '../types/index.ts';
import { ToastManager } from './toast.ts';
import { logger } from './logger.ts';

// State
let allData: AllGameData = {};
let uploadedImage: string | null = null;
let selectedItems: Map<string, { item: Item; count: number }> = new Map();
let selectedTomes: Map<string, Tome> = new Map();
let selectedCharacter: Character | null = null;
let selectedWeapon: Weapon | null = null;

// Callbacks for when build state is updated
type BuildStateCallback = (state: {
    character: Character | null;
    weapon: Weapon | null;
    items: Item[];
    tomes: Tome[];
}) => void;

let onBuildStateChange: BuildStateCallback | null = null;

/**
 * Initialize the scan build module with game data
 */
export function initScanBuild(gameData: AllGameData, stateChangeCallback?: BuildStateCallback): void {
    allData = gameData;
    if (stateChangeCallback) {
        onBuildStateChange = stateChangeCallback;
    }

    setupEventListeners();

    logger.info({
        operation: 'scan_build.init',
        data: {
            itemsCount: gameData.items?.items.length || 0,
        },
    });
}

/**
 * Setup event listeners for scan build UI
 */
function setupEventListeners(): void {
    // Upload/Camera button
    const uploadBtn = document.getElementById('scan-upload-btn');
    uploadBtn?.addEventListener('click', handleUploadClick);

    // File input change
    const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
    fileInput?.addEventListener('change', handleFileSelect);

    // Clear image button
    const clearBtn = document.getElementById('scan-clear-image');
    clearBtn?.addEventListener('click', clearUploadedImage);

    // Apply to advisor button
    const applyBtn = document.getElementById('scan-apply-to-advisor');
    applyBtn?.addEventListener('click', applyToAdvisor);
}

/**
 * Handle upload button click - trigger file input
 */
function handleUploadClick(): void {
    const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
    fileInput?.click();
}

/**
 * Handle file selection
 */
async function handleFileSelect(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
        ToastManager.error('Please select an image file');
        return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        ToastManager.error('Image size must be less than 10MB');
        return;
    }

    try {
        // Read file as data URL
        const reader = new FileReader();
        reader.onload = event => {
            uploadedImage = event.target?.result as string;
            displayUploadedImage();
            showItemSelectionGrid();
            ToastManager.success('Image uploaded! Now select the items you see');
        };
        reader.onerror = () => {
            ToastManager.error('Failed to read image file');
        };
        reader.readAsDataURL(file);

        logger.info({
            operation: 'scan_build.image_uploaded',
            data: {
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
            },
        });
    } catch (error) {
        logger.error({
            operation: 'scan_build.upload_error',
            error: {
                name: (error as Error).name,
                message: (error as Error).message,
            },
        });
        ToastManager.error('Failed to upload image');
    }
}

/**
 * Display the uploaded image
 */
function displayUploadedImage(): void {
    const previewContainer = document.getElementById('scan-image-preview');
    if (!previewContainer || !uploadedImage) return;

    previewContainer.innerHTML = `
        <div class="scan-image-wrapper">
            <img src="${uploadedImage}" alt="Uploaded build screenshot" class="scan-preview-image" />
            <button class="scan-clear-btn" id="scan-clear-image" aria-label="Clear image">✕</button>
        </div>
    `;

    previewContainer.style.display = 'block';

    // Re-attach clear button listener
    const clearBtn = document.getElementById('scan-clear-image');
    clearBtn?.addEventListener('click', clearUploadedImage);
}

/**
 * Clear uploaded image and reset state
 */
function clearUploadedImage(): void {
    uploadedImage = null;
    selectedItems.clear();
    selectedTomes.clear();
    selectedCharacter = null;
    selectedWeapon = null;

    const previewContainer = document.getElementById('scan-image-preview');
    if (previewContainer) {
        previewContainer.innerHTML = '';
        previewContainer.style.display = 'none';
    }

    const selectionContainer = document.getElementById('scan-selection-area');
    if (selectionContainer) {
        selectionContainer.style.display = 'none';
    }

    // Clear file input
    const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
    if (fileInput) {
        fileInput.value = '';
    }

    ToastManager.info('Image cleared');
}

/**
 * Show item selection grid
 */
function showItemSelectionGrid(): void {
    const selectionContainer = document.getElementById('scan-selection-area');
    if (!selectionContainer) return;

    selectionContainer.style.display = 'block';

    // Create character/weapon selection
    createEntitySelection('character', allData.characters?.characters || []);
    createEntitySelection('weapon', allData.weapons?.weapons || []);

    // Create item selection grid
    createItemGrid();

    // Create tome selection grid
    createTomeGrid();

    // Update summary
    updateSelectionSummary();
}

/**
 * Create entity selection (character/weapon)
 */
function createEntitySelection(type: 'character' | 'weapon', entities: any[]): void {
    const container = document.getElementById(`scan-${type}-grid`);
    if (!container) return;

    container.innerHTML = '';

    entities.forEach(entity => {
        const card = document.createElement('button');
        card.className = 'scan-entity-card';
        card.dataset.id = entity.id;
        card.innerHTML = `
            <div class="scan-entity-name">${entity.name}</div>
            <div class="scan-entity-tier tier-${entity.tier.toLowerCase()}">${entity.tier}</div>
        `;

        card.addEventListener('click', () => {
            // Deselect all others
            container.querySelectorAll('.scan-entity-card').forEach(c => c.classList.remove('selected'));
            // Select this one
            card.classList.add('selected');

            if (type === 'character') {
                selectedCharacter = entity;
            } else {
                selectedWeapon = entity;
            }

            updateSelectionSummary();
        });

        container.appendChild(card);
    });
}

/**
 * Create item selection grid
 */
function createItemGrid(): void {
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
        const card = createItemCard(item);
        gridContainer.appendChild(card);
    });

    container.appendChild(gridContainer);
}

/**
 * Create individual item card
 */
function createItemCard(item: Item): HTMLElement {
    const card = document.createElement('div');
    card.className = 'scan-item-card';
    card.dataset.id = item.id;
    card.dataset.name = item.name.toLowerCase();

    // Item info
    const info = document.createElement('div');
    info.className = 'scan-item-info';
    info.innerHTML = `
        <div class="scan-item-name">${item.name}</div>
        <div class="scan-item-tier tier-${item.tier.toLowerCase()}">${item.tier}</div>
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

    decrementBtn.addEventListener('click', () => {
        updateItemCount(item, -1, countDisplay, card);
    });

    incrementBtn.addEventListener('click', () => {
        updateItemCount(item, 1, countDisplay, card);
    });

    controls.appendChild(decrementBtn);
    controls.appendChild(countDisplay);
    controls.appendChild(incrementBtn);

    card.appendChild(info);
    card.appendChild(controls);

    return card;
}

/**
 * Update item count
 */
function updateItemCount(item: Item, delta: number, display: HTMLElement, card: HTMLElement): void {
    const current = selectedItems.get(item.id);
    const currentCount = current?.count || 0;
    const newCount = Math.max(0, Math.min(99, currentCount + delta)); // Cap at 99

    if (newCount === 0) {
        selectedItems.delete(item.id);
        card.classList.remove('selected');
    } else {
        selectedItems.set(item.id, { item, count: newCount });
        card.classList.add('selected');
    }

    display.textContent = newCount.toString();
    updateSelectionSummary();
}

/**
 * Filter item grid by search query
 */
function filterItemGrid(query: string): void {
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
function createTomeGrid(): void {
    const container = document.getElementById('scan-tome-grid');
    if (!container || !allData.tomes?.tomes) return;

    container.innerHTML = '';

    allData.tomes.tomes.forEach(tome => {
        const card = document.createElement('button');
        card.className = 'scan-tome-card';
        card.dataset.id = tome.id;
        card.innerHTML = `
            <div class="scan-tome-name">${tome.name}</div>
            <div class="scan-tome-tier tier-${tome.tier.toLowerCase()}">${tome.tier}</div>
        `;

        card.addEventListener('click', () => {
            if (selectedTomes.has(tome.id)) {
                selectedTomes.delete(tome.id);
                card.classList.remove('selected');
            } else {
                selectedTomes.set(tome.id, tome);
                card.classList.add('selected');
            }
            updateSelectionSummary();
        });

        container.appendChild(card);
    });
}

/**
 * Update selection summary display
 */
function updateSelectionSummary(): void {
    const summaryContainer = document.getElementById('scan-selection-summary');
    if (!summaryContainer) return;

    let html = '<h4>Selected Build State:</h4>';

    // Character
    if (selectedCharacter) {
        html += `<div class="scan-summary-item">👤 <strong>${selectedCharacter.name}</strong></div>`;
    }

    // Weapon
    if (selectedWeapon) {
        html += `<div class="scan-summary-item">⚔️ <strong>${selectedWeapon.name}</strong></div>`;
    }

    // Items
    if (selectedItems.size > 0) {
        html += '<div class="scan-summary-section"><strong>📦 Items:</strong><ul>';
        selectedItems.forEach(({ item, count }) => {
            html += `<li>${item.name} x${count}</li>`;
        });
        html += '</ul></div>';
    }

    // Tomes
    if (selectedTomes.size > 0) {
        html += '<div class="scan-summary-section"><strong>📚 Tomes:</strong><ul>';
        selectedTomes.forEach(tome => {
            html += `<li>${tome.name}</li>`;
        });
        html += '</ul></div>';
    }

    summaryContainer.innerHTML = html;

    // Show/hide apply button
    const applyBtn = document.getElementById('scan-apply-to-advisor');
    if (applyBtn) {
        applyBtn.style.display =
            selectedCharacter || selectedWeapon || selectedItems.size > 0 || selectedTomes.size > 0 ? 'block' : 'none';
    }
}

/**
 * Apply selections to the main advisor
 */
function applyToAdvisor(): void {
    // Convert items map to array (expand counts)
    const items: Item[] = [];
    selectedItems.forEach(({ item, count }) => {
        for (let i = 0; i < count; i++) {
            items.push(item);
        }
    });

    const buildState = {
        character: selectedCharacter,
        weapon: selectedWeapon,
        items,
        tomes: Array.from(selectedTomes.values()),
    };

    // Use callback if provided
    if (onBuildStateChange) {
        onBuildStateChange(buildState);
    }

    // Also call the global applyScannedBuild function if available
    const applyScannedBuild = (window as any).applyScannedBuild;
    if (typeof applyScannedBuild === 'function') {
        applyScannedBuild(buildState);
    }

    ToastManager.success('Build state applied to advisor!');

    logger.info({
        operation: 'scan_build.applied_to_advisor',
        data: {
            character: selectedCharacter?.name,
            weapon: selectedWeapon?.name,
            itemsCount: items.length,
            tomesCount: buildState.tomes.length,
        },
    });

    // Scroll to advisor section
    setTimeout(() => {
        const advisorSection = document.getElementById('advisor-current-build-section');
        advisorSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

/**
 * Get current scan state
 */
export function getScanState() {
    return {
        character: selectedCharacter,
        weapon: selectedWeapon,
        items: Array.from(selectedItems.entries()).map(([id, data]) => ({
            id,
            name: data.item.name,
            count: data.count,
        })),
        tomes: Array.from(selectedTomes.values()).map(t => ({ id: t.id, name: t.name })),
    };
}

// ========================================
// Global Assignments
// ========================================
(window as any).initScanBuild = initScanBuild;
