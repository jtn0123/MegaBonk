/* global setTimeout */
/* ========================================
 * CV Validator - Item Reference
 * Sidebar item browser
 * ======================================== */

import { CONFIG, CSS_CLASSES } from './config.js';
import { state } from './state.js';
import { log, LOG_LEVELS, showToast, filterItems } from './utils.js';
import { getAllItems } from './data-loader.js';

// DOM element references
let elements = {};

// ========================================
// Initialization
// ========================================

export function initItemReference(domElements) {
    elements = domElements;

    // Filter buttons
    elements.filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.filterButtons.forEach(b => b.classList.remove(CSS_CLASSES.ACTIVE));
            btn.classList.add(CSS_CLASSES.ACTIVE);
            state.currentFilter = btn.dataset.rarity;
            populateItemReference();
        });
    });

    // Search input
    elements.searchInput.addEventListener('input', e => {
        state.searchQuery = e.target.value;
        populateItemReference();
    });
}

// ========================================
// Populate Item Reference List
// ========================================

export function populateItemReference() {
    const allItems = getAllItems();
    if (!allItems.length) return;

    elements.list.innerHTML = '';
    let count = 0;

    // Sort items by name
    const sortedItems = [...allItems].sort((a, b) => a.name.localeCompare(b.name));

    // Filter items
    const filteredItems = filterItems(sortedItems, state.currentFilter, state.searchQuery);

    for (const item of filteredItems) {
        const div = document.createElement('div');
        div.className = 'ref-item';
        div.dataset.name = item.name;
        div.title = `${item.name} (${item.rarity})\nClick to copy name`;

        if (item.image) {
            const img = document.createElement('img');
            img.src = CONFIG.PATHS.imagesBase + item.image;
            img.alt = item.name;
            img.onerror = () => {
                img.style.display = 'none';
            };
            div.appendChild(img);
        }

        const nameSpan = document.createElement('span');
        nameSpan.className = 'name';
        nameSpan.textContent = item.name;
        div.appendChild(nameSpan);

        const rarityDot = document.createElement('span');
        rarityDot.className = `rarity-dot rarity-${item.rarity}`;
        div.appendChild(rarityDot);

        div.addEventListener('click', () => copyItemName(item.name, div));

        elements.list.appendChild(div);
        count++;
    }

    elements.count.textContent = count;
}

// ========================================
// Copy Item Name to Clipboard
// ========================================

function copyItemName(name, element) {
    navigator.clipboard
        .writeText(name)
        .then(() => {
            // Show visual feedback
            element.classList.add(CSS_CLASSES.COPIED);
            setTimeout(() => element.classList.remove(CSS_CLASSES.COPIED), 500);

            // Show toast
            showToast(`Copied: "${name}"`);

            log(`Copied item name: ${name}`, LOG_LEVELS.SUCCESS);
        })
        .catch(err => {
            log(`Failed to copy: ${err.message}`, LOG_LEVELS.ERROR);
        });
}
