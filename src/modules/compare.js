// ========================================
// MegaBonk Compare Mode Module
// ========================================

// Compare mode state
let compareItems = [];

/**
 * Toggle item in comparison list
 * @param {string} itemId - Item ID to toggle
 */
function toggleCompareItem(itemId) {
    const index = compareItems.indexOf(itemId);
    if (index > -1) {
        compareItems.splice(index, 1);
    } else {
        // Use constant instead of magic number
        const maxItems = typeof MAX_COMPARE_ITEMS !== 'undefined' ? MAX_COMPARE_ITEMS : 3;
        if (compareItems.length >= maxItems) {
            ToastManager.warning(`You can only compare up to ${maxItems} items at once. Remove an item first.`);
            return;
        }
        compareItems.push(itemId);
    }
    updateCompareButton();
}

/**
 * Update compare button visibility and state
 */
function updateCompareButton() {
    const compareBtn = safeGetElementById('compare-btn');
    if (!compareBtn) return;

    const countSpan = compareBtn.querySelector('.compare-count');
    if (countSpan) {
        countSpan.textContent = compareItems.length;
    }

    compareBtn.style.display = compareItems.length >= 2 ? 'block' : 'none';

    // Update checkboxes
    safeQuerySelectorAll('.compare-checkbox').forEach(cb => {
        const id = cb.dataset.id || cb.value;
        cb.checked = compareItems.includes(id);
    });
}

/**
 * Open the comparison modal
 */
function openCompareModal() {
    if (compareItems.length < 2) {
        ToastManager.warning('Select at least 2 items to compare!');
        return;
    }

    const items = compareItems.map(id =>
        allData.items?.items.find(item => item.id === id)
    ).filter(Boolean);

    const compareBody = safeGetElementById('compareBody');
    const modal = safeGetElementById('compareModal');
    if (!compareBody || !modal) return;

    // Filter items that have scaling data for the chart
    const chartableItems = items.filter(item =>
        item.scaling_per_stack && !item.one_and_done && item.graph_type !== 'flat'
    );

    // Build HTML with optional chart section
    let html = '';
    if (chartableItems.length >= 2) {
        html += `
            <div class="compare-chart-section">
                <h3>Scaling Comparison</h3>
                <div class="compare-chart-container">
                    <canvas id="compare-scaling-chart" class="scaling-chart"></canvas>
                </div>
            </div>
        `;
    }

    html += '<div class="compare-grid">';

    items.forEach(item => {
        html += `
            <div class="compare-column">
                <div class="compare-header">
                    <h3>${item.name}</h3>
                    <div class="item-badges">
                        <span class="badge rarity-${item.rarity}">${item.rarity}</span>
                        <span class="badge tier-${item.tier}">${item.tier} Tier</span>
                    </div>
                </div>

                <div class="compare-section">
                    <h4>Base Effect</h4>
                    <p>${item.base_effect}</p>
                </div>

                <div class="compare-section">
                    <h4>Stacking</h4>
                    <p class="${item.stacks_well ? 'positive' : 'negative'}">
                        ${item.stacks_well ? '✓ Stacks Well' : '✗ One-and-Done'}
                    </p>
                </div>

                <div class="compare-section">
                    <h4>Formula</h4>
                    <code class="formula-code">${item.formula}</code>
                </div>

                <div class="compare-section">
                    <h4>Scaling (1-10 stacks)</h4>
                    <div class="scaling-values">
                        ${item.scaling_per_stack.map((val, idx) =>
                            `<span class="scale-value">${idx + 1}: <strong>${val}${item.scaling_type.includes('chance') || item.scaling_type.includes('damage') ? '%' : ''}</strong></span>`
                        ).join('')}
                    </div>
                </div>

                ${item.synergies?.length ? `
                    <div class="compare-section">
                        <h4>Synergies</h4>
                        <div class="synergy-tags">
                            ${item.synergies.slice(0, 5).map(s => `<span class="synergy-tag">${s}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}

                ${item.anti_synergies?.length ? `
                    <div class="compare-section">
                        <h4>Anti-Synergies</h4>
                        <div class="antisynergy-tags">
                            ${item.anti_synergies.map(s => `<span class="antisynergy-tag">${s}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}

                <div class="compare-section">
                    <h4>Notes</h4>
                    <p class="notes">${item.notes}</p>
                </div>

                <button class="remove-compare-btn" data-remove-id="${item.id}">
                    Remove from Comparison
                </button>
            </div>
        `;
    });

    html += '</div>';
    compareBody.innerHTML = html;
    modal.style.display = 'block';
    // Trigger animation after display is set
    requestAnimationFrame(() => {
        modal.classList.add('active');
    });

    // Initialize compare chart after DOM is ready
    if (chartableItems.length >= 2) {
        setTimeout(() => {
            createCompareChart('compare-scaling-chart', chartableItems);
        }, 100);
    }
}

/**
 * Close compare modal with animation
 */
function closeCompareModal() {
    const modal = safeGetElementById('compareModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}

/**
 * Update compare display after item removal
 */
function updateCompareDisplay() {
    if (compareItems.length < 2) {
        closeCompareModal();
    } else {
        openCompareModal();
    }
}

/**
 * Clear all compare selections
 */
function clearCompare() {
    compareItems = [];
    updateCompareButton();
    closeCompareModal();
}

// ========================================
// Expose to global scope
// ========================================

// Bug fix #15: Provide getter instead of direct mutable reference
// This prevents external code from accidentally corrupting the array
window.getCompareItems = () => [...compareItems]; // Return a copy
window.compareItems = compareItems; // Keep for backward compatibility but prefer getter
window.toggleCompareItem = toggleCompareItem;
window.updateCompareButton = updateCompareButton;
window.openCompareModal = openCompareModal;
window.closeCompareModal = closeCompareModal;
window.updateCompareDisplay = updateCompareDisplay;
window.clearCompare = clearCompare;
