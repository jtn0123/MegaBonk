// ========================================
// MegaBonk Breakpoint Calculator Module
// ========================================

/**
 * Populate calculator item select dropdown
 */
function populateCalculatorItems() {
    const select = safeGetElementById('calc-item-select');
    if (!select || !allData.items) return;

    select.innerHTML = '<option value="">Choose an item...</option>';

    allData.items.items.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = `${item.name} - ${item.base_effect}`;
        select.appendChild(option);
    });
}

/**
 * Calculate breakpoint for selected item and target
 */
function calculateBreakpoint() {
    const itemId = safeGetElementById('calc-item-select')?.value;
    const target = parseFloat(safeGetElementById('calc-target')?.value);
    const resultDiv = safeGetElementById('calc-result');

    if (!itemId || !target) {
        ToastManager.warning('Please select an item and enter a target value!');
        return;
    }

    const item = allData.items?.items.find(i => i.id === itemId);
    if (!item) return;

    // Calculate stacks needed
    let stacksNeeded = 0;
    const perStack = item.scaling_per_stack[0]; // Value per stack from first entry

    if (perStack > 0) {
        stacksNeeded = Math.ceil(target / perStack);
    }

    // Cap checks
    if (item.stack_cap && stacksNeeded > item.stack_cap) {
        stacksNeeded = item.stack_cap;
    }

    // Display result
    if (resultDiv) {
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
            <div class="calc-result-content">
                <h3>📊 Calculation Result</h3>
                <div class="result-main">
                    <div class="result-item">
                        <div class="result-label">Item:</div>
                        <div class="result-value"><strong>${item.name}</strong></div>
                    </div>
                    <div class="result-item">
                        <div class="result-label">Target Value:</div>
                        <div class="result-value"><strong>${target}${item.scaling_type.includes('chance') || item.scaling_type.includes('percentage') ? '%' : ''}</strong></div>
                    </div>
                    <div class="result-item highlight">
                        <div class="result-label">Stacks Needed:</div>
                        <div class="result-value large"><strong>${stacksNeeded}</strong></div>
                    </div>
                </div>

                <div class="result-details">
                    <p><strong>Formula:</strong> ${item.formula}</p>
                    <p><strong>Per Stack:</strong> +${perStack}${item.scaling_type.includes('chance') || item.scaling_type.includes('percentage') ? '%' : ''}</p>
                    ${item.stack_cap ? `<p class="warning">⚠️ Note: This item caps at ${item.stack_cap} stacks</p>` : ''}
                    ${item.one_and_done ? `<p class="warning">⚠️ Note: This is a one-and-done item - additional copies provide no benefit!</p>` : ''}
                    ${!item.stacks_well ? `<p class="warning">⚠️ Note: This item has diminishing returns or limited stacking</p>` : ''}
                </div>

                <div class="result-graph">
                    <h4>Scaling Visualization (1-10 stacks)</h4>
                    <div class="mini-bar-graph">
                        ${item.scaling_per_stack.map((val, idx) => {
                            const height = (val / Math.max(...item.scaling_per_stack)) * 100;
                            const isTarget = (idx + 1) === stacksNeeded;
                            return `<div class="bar-container">
                                <div class="bar ${isTarget ? 'target-bar' : ''}" style="height: ${height}%"></div>
                                <span class="bar-label">${idx + 1}</span>
                            </div>`;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    }
}

/**
 * Quick calculate from breakpoint cards
 * @param {string} itemId - Item ID
 * @param {number} target - Target value
 */
function quickCalc(itemId, target) {
    safeSetValue('calc-item-select', itemId);
    safeSetValue('calc-target', target);
    calculateBreakpoint();

    // Switch to calculator tab
    switchTab('calculator');
}

// ========================================
// Expose to global scope
// ========================================

window.populateCalculatorItems = populateCalculatorItems;
window.calculateBreakpoint = calculateBreakpoint;
window.quickCalc = quickCalc;
