// ========================================
// MegaBonk Build Advisor Module
// ========================================
// Handles the UI and logic for the build recommendation feature
// ========================================

import type { Item, Tome, AllGameData } from '../types/index.ts';
import { recommendBestChoice, type BuildState, type ChoiceOption } from './recommendation.ts';
import { ToastManager } from './toast.ts';
import { logger } from './logger.ts';

// State
let allData: AllGameData = {};
let currentBuild: BuildState = {
    character: null,
    weapon: null,
    items: [],
    tomes: [],
};
let selectedItems: Map<string, Item> = new Map();
let selectedTomes: Map<string, Tome> = new Map();

/**
 * Initialize the advisor with game data
 */
export function initAdvisor(gameData: AllGameData): void {
    allData = gameData;

    // Populate character dropdown
    const characterSelect = document.getElementById('advisor-character') as HTMLSelectElement;
    if (characterSelect && gameData.characters?.characters) {
        gameData.characters.characters.forEach(char => {
            const option = document.createElement('option');
            option.value = char.id;
            option.textContent = char.name;
            characterSelect.appendChild(option);
        });
    }

    // Populate weapon dropdown
    const weaponSelect = document.getElementById('advisor-weapon') as HTMLSelectElement;
    if (weaponSelect && gameData.weapons?.weapons) {
        gameData.weapons.weapons.forEach(weapon => {
            const option = document.createElement('option');
            option.value = weapon.id;
            option.textContent = weapon.name;
            weaponSelect.appendChild(option);
        });
    }

    // Setup event listeners
    setupEventListeners();

    logger.info({
        operation: 'advisor.init',
        data: {
            charactersCount: gameData.characters?.characters.length || 0,
            weaponsCount: gameData.weapons?.weapons.length || 0,
            itemsCount: gameData.items?.items.length || 0,
        },
    });
}

/**
 * Setup all event listeners for the advisor
 */
function setupEventListeners(): void {
    // Character selection
    const characterSelect = document.getElementById('advisor-character') as HTMLSelectElement;
    characterSelect?.addEventListener('change', handleCharacterChange);

    // Weapon selection
    const weaponSelect = document.getElementById('advisor-weapon') as HTMLSelectElement;
    weaponSelect?.addEventListener('change', handleWeaponChange);

    // Add item button
    const addItemBtn = document.getElementById('add-current-item');
    addItemBtn?.addEventListener('click', () => showEntityModal('item'));

    // Add tome button
    const addTomeBtn = document.getElementById('add-current-tome');
    addTomeBtn?.addEventListener('click', () => showEntityModal('tome'));

    // Choice type selections (update entity dropdown when type changes)
    for (let i = 1; i <= 3; i++) {
        const typeSelect = document.getElementById(`choice-${i}-type`) as HTMLSelectElement;
        typeSelect?.addEventListener('change', e => handleChoiceTypeChange(i, (e.target as HTMLSelectElement).value));
    }

    // Get recommendation button
    const recommendBtn = document.getElementById('get-recommendation');
    recommendBtn?.addEventListener('click', handleGetRecommendation);
}

/**
 * Handle character selection change
 */
function handleCharacterChange(e: Event): void {
    const select = e.target as HTMLSelectElement;
    const characterId = select.value;

    if (!characterId) {
        currentBuild.character = null;
        return;
    }

    const character = allData.characters?.characters.find(c => c.id === characterId);
    if (character) {
        currentBuild.character = character;
        logger.info({
            operation: 'advisor.character_selected',
            data: { character: character.name },
        });
    }
}

/**
 * Handle weapon selection change
 */
function handleWeaponChange(e: Event): void {
    const select = e.target as HTMLSelectElement;
    const weaponId = select.value;

    if (!weaponId) {
        currentBuild.weapon = null;
        return;
    }

    const weapon = allData.weapons?.weapons.find(w => w.id === weaponId);
    if (weapon) {
        currentBuild.weapon = weapon;
        logger.info({
            operation: 'advisor.weapon_selected',
            data: { weapon: weapon.name },
        });
    }
}

/**
 * Show modal for selecting items/tomes
 */
function showEntityModal(type: 'item' | 'tome'): void {
    const entities = type === 'item' ? allData.items?.items : allData.tomes?.tomes;
    if (!entities) return;

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal advisor-entity-modal';
    modal.style.display = 'block';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => modal.remove();

    // Title
    const title = document.createElement('h3');
    title.textContent = `Select ${type === 'item' ? 'Item' : 'Tome'}`;

    // Entity list
    const listContainer = document.createElement('div');
    listContainer.className = 'advisor-entity-list';

    entities.forEach(entity => {
        const entityCard = document.createElement('button');
        entityCard.className = 'advisor-entity-card';
        entityCard.innerHTML = `
            <div class="entity-name">${entity.name}</div>
            <div class="entity-tier">${entity.tier}</div>
        `;
        entityCard.onclick = () => {
            addEntityToCurrentBuild(type, entity);
            modal.remove();
        };
        listContainer.appendChild(entityCard);
    });

    modalContent.appendChild(closeBtn);
    modalContent.appendChild(title);
    modalContent.appendChild(listContainer);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Close on outside click
    modal.addEventListener('click', e => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

/**
 * Add entity to current build
 */
function addEntityToCurrentBuild(type: 'item' | 'tome', entity: Item | Tome): void {
    if (type === 'item') {
        const item = entity as Item;
        selectedItems.set(item.id, item);
        currentBuild.items = Array.from(selectedItems.values());
    } else {
        const tome = entity as Tome;
        selectedTomes.set(tome.id, tome);
        currentBuild.tomes = Array.from(selectedTomes.values());
    }

    updateCurrentBuildDisplay();
    ToastManager.success(`Added ${entity.name}`);
}

/**
 * Update the display of current build items/tomes
 */
function updateCurrentBuildDisplay(): void {
    // Update items display
    const itemsContainer = document.getElementById('advisor-current-items');
    if (itemsContainer) {
        itemsContainer.innerHTML = '';

        selectedItems.forEach(item => {
            const chip = createEntityChip(item, () => {
                selectedItems.delete(item.id);
                currentBuild.items = Array.from(selectedItems.values());
                updateCurrentBuildDisplay();
            });
            itemsContainer.appendChild(chip);
        });

        // Re-add the add button
        const addBtn = document.createElement('button');
        addBtn.className = 'advisor-add-btn';
        addBtn.textContent = '+ Add Item';
        addBtn.onclick = () => showEntityModal('item');
        itemsContainer.appendChild(addBtn);
    }

    // Update tomes display
    const tomesContainer = document.getElementById('advisor-current-tomes');
    if (tomesContainer) {
        tomesContainer.innerHTML = '';

        selectedTomes.forEach(tome => {
            const chip = createEntityChip(tome, () => {
                selectedTomes.delete(tome.id);
                currentBuild.tomes = Array.from(selectedTomes.values());
                updateCurrentBuildDisplay();
            });
            tomesContainer.appendChild(chip);
        });

        // Re-add the add button
        const addBtn = document.createElement('button');
        addBtn.className = 'advisor-add-btn';
        addBtn.textContent = '+ Add Tome';
        addBtn.onclick = () => showEntityModal('tome');
        tomesContainer.appendChild(addBtn);
    }
}

/**
 * Create a chip element for an entity
 */
function createEntityChip(entity: Item | Tome, onRemove: () => void): HTMLElement {
    const chip = document.createElement('div');
    chip.className = 'advisor-chip';
    chip.innerHTML = `
        <span class="chip-name">${entity.name}</span>
        <button class="chip-remove" aria-label="Remove ${entity.name}">&times;</button>
    `;

    const removeBtn = chip.querySelector('.chip-remove') as HTMLButtonElement;
    removeBtn.onclick = onRemove;

    return chip;
}

/**
 * Handle choice type change (updates entity dropdown)
 */
function handleChoiceTypeChange(choiceNumber: number, type: string): void {
    const entitySelect = document.getElementById(`choice-${choiceNumber}-entity`) as HTMLSelectElement;
    if (!entitySelect) return;

    // Clear existing options
    entitySelect.innerHTML = '<option value="">Select...</option>';

    if (!type) return;

    // Populate based on type
    let entities: any[] = [];
    switch (type) {
        case 'item':
            entities = allData.items?.items || [];
            break;
        case 'weapon':
            entities = allData.weapons?.weapons || [];
            break;
        case 'tome':
            entities = allData.tomes?.tomes || [];
            break;
        case 'shrine':
            entities = allData.shrines?.shrines || [];
            break;
    }

    entities.forEach(entity => {
        const option = document.createElement('option');
        option.value = entity.id;
        option.textContent = `${entity.name} (${entity.tier})`;
        entitySelect.appendChild(option);
    });
}

/**
 * Handle get recommendation button click
 */
function handleGetRecommendation(): void {
    try {
        // Gather choices
        const choices: ChoiceOption[] = [];

        for (let i = 1; i <= 3; i++) {
            const typeSelect = document.getElementById(`choice-${i}-type`) as HTMLSelectElement;
            const entitySelect = document.getElementById(`choice-${i}-entity`) as HTMLSelectElement;

            const type = typeSelect?.value;
            const entityId = entitySelect?.value;

            if (!type || !entityId) {
                if (i <= 2) {
                    ToastManager.error(`Please select at least 2 choices`);
                    return;
                }
                continue;
            }

            // Find the entity
            let entity: any = null;
            switch (type) {
                case 'item':
                    entity = allData.items?.items.find(e => e.id === entityId);
                    break;
                case 'weapon':
                    entity = allData.weapons?.weapons.find(e => e.id === entityId);
                    break;
                case 'tome':
                    entity = allData.tomes?.tomes.find(e => e.id === entityId);
                    break;
                case 'shrine':
                    entity = allData.shrines?.shrines.find(e => e.id === entityId);
                    break;
            }

            if (entity) {
                choices.push({
                    type: type as 'item' | 'weapon' | 'tome' | 'shrine',
                    entity,
                });
            }
        }

        if (choices.length < 2) {
            ToastManager.error('Please select at least 2 choices to compare');
            return;
        }

        // Get recommendations
        const recommendations = recommendBestChoice(currentBuild, choices);

        // Display results
        displayRecommendations(recommendations);

        logger.info({
            operation: 'advisor.recommendation_generated',
            data: {
                choicesCount: choices.length,
                topChoice: recommendations[0]?.choice.entity.name,
            },
        });
    } catch (error) {
        logger.error({
            operation: 'advisor.recommendation_error',
            error: {
                name: (error as Error).name,
                message: (error as Error).message,
                module: 'advisor',
            },
        });
        ToastManager.error('Failed to generate recommendation. Please try again.');
    }
}

/**
 * Display recommendations
 */
function displayRecommendations(recommendations: any[]): void {
    const resultsDiv = document.getElementById('advisor-results');
    const resultsContent = document.getElementById('advisor-results-content');

    if (!resultsDiv || !resultsContent) return;

    resultsContent.innerHTML = '';

    if (recommendations.length === 0) {
        resultsContent.innerHTML = '<p>No recommendations available.</p>';
        resultsDiv.style.display = 'block';
        return;
    }

    // Display each recommendation
    recommendations.forEach((rec, index) => {
        const card = document.createElement('div');
        card.className = `advisor-result-card ${index === 0 ? 'top-recommendation' : ''}`;

        const entity = rec.choice.entity;
        const rank = index + 1;
        const emoji = rank === 1 ? '🎯' : rank === 2 ? '🥈' : '🥉';

        let html = `
            <div class="result-header">
                <div class="result-rank">${emoji} ${rank === 1 ? 'RECOMMENDED' : `#${rank}`}</div>
                <div class="result-title">${entity.name}</div>
                <div class="result-tier tier-${entity.tier.toLowerCase()}">${entity.tier}</div>
            </div>
            <div class="result-score">
                <strong>Score:</strong> ${Math.round(rec.score)} |
                <strong>Confidence:</strong> ${Math.round(rec.confidence * 100)}%
            </div>
        `;

        if (rec.reasoning.length > 0) {
            html += '<div class="result-section"><strong>Why?</strong><ul>';
            rec.reasoning.forEach((r: string) => {
                html += `<li>✓ ${r}</li>`;
            });
            html += '</ul></div>';
        }

        if (rec.synergies.length > 0) {
            html += '<div class="result-section"><strong>Synergies:</strong><ul>';
            rec.synergies.forEach((s: string) => {
                html += `<li class="synergy">• ${s}</li>`;
            });
            html += '</ul></div>';
        }

        if (rec.warnings.length > 0) {
            html += '<div class="result-section warnings"><strong>Warnings:</strong><ul>';
            rec.warnings.forEach((w: string) => {
                html += `<li class="warning">⚠️ ${w}</li>`;
            });
            html += '</ul></div>';
        }

        card.innerHTML = html;
        resultsContent.appendChild(card);
    });

    resultsDiv.style.display = 'block';

    // Scroll to results
    resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Reset advisor state
 */
export function resetAdvisor(): void {
    currentBuild = {
        character: null,
        weapon: null,
        items: [],
        tomes: [],
    };
    selectedItems.clear();
    selectedTomes.clear();

    // Reset UI
    const characterSelect = document.getElementById('advisor-character') as HTMLSelectElement;
    const weaponSelect = document.getElementById('advisor-weapon') as HTMLSelectElement;
    if (characterSelect) characterSelect.value = '';
    if (weaponSelect) weaponSelect.value = '';

    updateCurrentBuildDisplay();

    // Clear choices
    for (let i = 1; i <= 3; i++) {
        const typeSelect = document.getElementById(`choice-${i}-type`) as HTMLSelectElement;
        const entitySelect = document.getElementById(`choice-${i}-entity`) as HTMLSelectElement;
        if (typeSelect) typeSelect.value = '';
        if (entitySelect) entitySelect.value = '';
    }

    // Hide results
    const resultsDiv = document.getElementById('advisor-results');
    if (resultsDiv) resultsDiv.style.display = 'none';
}

// ========================================
// Global Assignments
// ========================================
// Expose initAdvisor globally for cross-module access
(window as any).initAdvisor = initAdvisor;
