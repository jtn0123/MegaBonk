// ========================================
// MegaBonk Modal Module
// ========================================

// WeakMap to track tab click handlers per container (prevents memory leaks)
const tabHandlers = new WeakMap();

// Focus trap state for modal accessibility
let focusTrapActive = false;
let focusableElements = [];
let firstFocusableElement = null;
let lastFocusableElement = null;

/**
 * Handle Tab key press for focus trap
 * @param {KeyboardEvent} e - Keyboard event
 */
function handleFocusTrap(e) {
    if (!focusTrapActive) return;

    if (e.key === 'Tab') {
        if (e.shiftKey) {
            // Shift + Tab
            if (document.activeElement === firstFocusableElement) {
                e.preventDefault();
                lastFocusableElement?.focus();
            }
        } else {
            // Tab
            if (document.activeElement === lastFocusableElement) {
                e.preventDefault();
                firstFocusableElement?.focus();
            }
        }
    }
}

/**
 * Activate focus trap for modal
 * @param {HTMLElement} modal - Modal element
 */
function activateFocusTrap(modal) {
    // Get all focusable elements
    const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    focusableElements = Array.from(modal.querySelectorAll(focusableSelectors));

    if (focusableElements.length > 0) {
        firstFocusableElement = focusableElements[0];
        lastFocusableElement = focusableElements[focusableElements.length - 1];

        // Focus first element (close button)
        firstFocusableElement?.focus();
    }

    focusTrapActive = true;
    document.addEventListener('keydown', handleFocusTrap);
}

/**
 * Deactivate focus trap
 */
function deactivateFocusTrap() {
    focusTrapActive = false;
    document.removeEventListener('keydown', handleFocusTrap);
    focusableElements = [];
    firstFocusableElement = null;
    lastFocusableElement = null;
}

/**
 * Open detail modal for any entity type
 * @param {string} type - Entity type (item, weapon, tome, character, shrine)
 * @param {string} id - Entity ID
 */
function openDetailModal(type, id) {
    let data;
    switch (type) {
        case 'item':
            data = allData.items?.items.find(i => i.id === id);
            break;
        case 'weapon':
            data = allData.weapons?.weapons.find(w => w.id === id);
            break;
        case 'tome':
            data = allData.tomes?.tomes.find(t => t.id === id);
            break;
        case 'character':
            data = allData.characters?.characters.find(c => c.id === id);
            break;
        case 'shrine':
            data = allData.shrines?.shrines.find(s => s.id === id);
            break;
    }

    // Bug fix #11: Show error toast instead of failing silently
    if (!data) {
        ToastManager.error(`Could not find ${type} with ID: ${id}`);
        return;
    }

    const modal = safeGetElementById('itemModal');
    const modalBody = safeGetElementById('modalBody');
    if (!modal || !modalBody) return;

    let content = `<h2 id="modal-title">${data.name}</h2>`;

    if (type === 'item') {
        content += renderItemModal(data);
    } else if (type === 'weapon') {
        content += renderWeaponModal(data);
    } else if (type === 'tome') {
        content += renderTomeModal(data);
    } else if (type === 'character') {
        content += renderCharacterModal(data);
    } else if (type === 'shrine') {
        content += renderShrineModal(data);
    }

    modalBody.innerHTML = content;
    modal.style.display = 'block';
    // Trigger animation after display is set
    requestAnimationFrame(() => {
        modal.classList.add('active');

        // Activate focus trap for accessibility
        activateFocusTrap(modal);
    });
}

/**
 * Render item modal content
 * @param {Object} data - Item data
 * @returns {string} HTML content
 */
function renderItemModal(data) {
    const showGraph = data.scaling_per_stack && !data.one_and_done && data.graph_type !== 'flat';
    const hasScalingTracks = data.scaling_tracks && Object.keys(data.scaling_tracks).length > 0;

    // Generate scaling tracks tabs if item has multiple tracks
    let graphHtml = '';
    if (hasScalingTracks) {
        const trackKeys = Object.keys(data.scaling_tracks);
        const tabsHtml = trackKeys
            .map(
                (key, idx) =>
                    `<button class="scaling-tab ${idx === 0 ? 'active' : ''}" data-track="${key}" data-item-id="${data.id}">${data.scaling_tracks[key].stat}</button>`
            )
            .join('');

        graphHtml = `
            <div class="scaling-tracks-container">
                <div class="scaling-tabs">${tabsHtml}</div>
                <div class="modal-graph-container">
                    <canvas id="modal-chart-${data.id}" class="scaling-chart"></canvas>
                </div>
            </div>
        `;
    } else if (showGraph) {
        graphHtml = `
            <div class="modal-graph-container">
                <canvas id="modal-chart-${data.id}" class="scaling-chart"></canvas>
            </div>
        `;
    }

    // Hidden mechanics section (prominent)
    const hiddenMechanicsHtml = data.hidden_mechanics?.length
        ? `
        <div class="hidden-mechanics">
            <h4><span class="hidden-mechanics-icon">⚡</span> Hidden Mechanics</h4>
            <ul>
                ${data.hidden_mechanics.map(m => `<li>${m}</li>`).join('')}
            </ul>
        </div>
    `
        : '';

    // Hyperbolic scaling indicator
    const hyperbolicWarning =
        data.scaling_formula_type === 'hyperbolic'
            ? `
        <div class="hyperbolic-warning">
            <span class="warning-icon">⚠</span>
            <span>Hyperbolic Scaling: Displayed values have diminishing returns</span>
        </div>
    `
            : '';

    const imageHtml = generateModalImage(data, data.name, 'item');

    const content = `
        ${imageHtml}
        <div class="item-badges">
            <span class="badge rarity-${data.rarity}">${data.rarity}</span>
            <span class="badge tier-${data.tier}">${data.tier} Tier</span>
        </div>
        ${
            data.one_and_done
                ? `
            <div class="one-and-done-warning">
                <span class="warning-icon">!</span>
                <span>One-and-Done: Additional copies provide no benefit</span>
            </div>
        `
                : ''
        }
        ${hyperbolicWarning}
        ${
            data.max_stacks || (data.stack_cap && data.stack_cap <= 100)
                ? `
            <div class="stack-info">
                <strong>Stack Limit:</strong> ${data.max_stacks || data.stack_cap} stacks
            </div>
        `
                : ''
        }
        <div class="item-effect" style="margin-top: 1rem;">${data.base_effect}</div>
        <p>${data.detailed_description}</p>
        ${hiddenMechanicsHtml}
        <div class="item-formula"><strong>Formula:</strong> ${data.formula}</div>
        ${graphHtml}
        ${data.synergies?.length ? `<div class="synergies-section"><h3>Synergies</h3><div class="synergy-list">${data.synergies.map(s => `<span class="synergy-tag">${s}</span>`).join('')}</div></div>` : ''}
        ${data.anti_synergies?.length ? `<div class="anti-synergies-section"><h3>Anti-Synergies</h3><div class="antisynergy-list">${data.anti_synergies.map(s => `<span class="antisynergy-tag">${s}</span>`).join('')}</div></div>` : ''}
    `;

    // Bug fix #10: Use requestAnimationFrame for more reliable chart initialization
    // Initialize chart after modal is displayed and DOM is ready
    let initAttempts = 0;
    const MAX_INIT_ATTEMPTS = 50; // Prevent infinite loop - ~830ms max wait
    const initChart = () => {
        // Check if modal is still active before continuing
        const modal = safeGetElementById('itemModal');
        if (!modal || !modal.classList.contains('active')) {
            return; // Modal closed, stop trying
        }

        const canvas = document.getElementById(`modal-chart-${data.id}`);
        if (!canvas) {
            initAttempts++;
            if (initAttempts < MAX_INIT_ATTEMPTS) {
                // Canvas not ready yet, try again
                requestAnimationFrame(initChart);
            }
            // If max attempts reached, silently give up (modal may have closed)
            return;
        }

        if (hasScalingTracks) {
            // Initialize with first track
            const firstTrackKey = Object.keys(data.scaling_tracks)[0];
            const firstTrack = data.scaling_tracks[firstTrackKey];
            const effectiveCap = getEffectiveStackCap(data);
            const chartOptions = {
                scalingFormulaType: data.scaling_formula_type || 'linear',
                hyperbolicConstant: data.hyperbolic_constant || 1.0,
                maxStacks: data.max_stacks || null,
            };
            createScalingChart(
                `modal-chart-${data.id}`,
                firstTrack.values,
                firstTrack.stat,
                data.scaling_type || '',
                true,
                null,
                effectiveCap,
                chartOptions
            );

            // Add tab click handlers
            setupScalingTabHandlers(data);
        } else if (showGraph) {
            const effectiveCap = getEffectiveStackCap(data);
            const chartOptions = {
                scalingFormulaType: data.scaling_formula_type || 'linear',
                hyperbolicConstant: data.hyperbolic_constant || 1.0,
                maxStacks: data.max_stacks || null,
            };
            createScalingChart(
                `modal-chart-${data.id}`,
                data.scaling_per_stack,
                data.name,
                data.scaling_type || '',
                true,
                data.secondary_scaling || null,
                effectiveCap,
                chartOptions
            );
        }
    };
    requestAnimationFrame(initChart);

    return content;
}

/**
 * Setup tab click handlers for scaling tracks using event delegation
 * Bug fix #7: Use event delegation instead of adding listeners to each tab
 * @param {Object} data - Item data with scaling_tracks
 */
function setupScalingTabHandlers(data) {
    // Use event delegation on the container to avoid memory leaks
    const container = document.querySelector(`.scaling-tabs`);
    if (!container) return;

    // Store handler reference for potential cleanup
    const handleTabClick = e => {
        const tab = e.target.closest(`.scaling-tab[data-item-id="${data.id}"]`);
        if (!tab) return;

        // Update active state
        const tabs = container.querySelectorAll(`.scaling-tab[data-item-id="${data.id}"]`);
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Get track data and redraw chart
        const trackKey = tab.dataset.track;
        const track = data.scaling_tracks[trackKey];
        const effectiveCap = getEffectiveStackCap(data);
        const chartOptions = {
            scalingFormulaType: data.scaling_formula_type || 'linear',
            hyperbolicConstant: data.hyperbolic_constant || 1.0,
            maxStacks: data.max_stacks || null,
        };
        createScalingChart(
            `modal-chart-${data.id}`,
            track.values,
            track.stat,
            data.scaling_type || '',
            true,
            null,
            effectiveCap,
            chartOptions
        );
    };

    // Remove any existing handler before adding new one
    const existingHandler = tabHandlers.get(container);
    if (existingHandler) {
        container.removeEventListener('click', existingHandler);
    }
    tabHandlers.set(container, handleTabClick);
    container.addEventListener('click', handleTabClick);
}

/**
 * Render weapon modal content
 * @param {Object} data - Weapon data
 * @returns {string} HTML content
 */
function renderWeaponModal(data) {
    return `
        <p><strong>Attack Pattern:</strong> ${data.attack_pattern}</p>
        <p>${data.description}</p>
        <p><strong>Upgradeable Stats:</strong> ${Array.isArray(data.upgradeable_stats) ? data.upgradeable_stats.join(', ') : 'None'}</p>
        <p><strong>Build Tips:</strong> ${data.build_tips}</p>
    `;
}

/**
 * Render tome modal content
 * @param {Object} data - Tome data
 * @returns {string} HTML content
 */
function renderTomeModal(data) {
    const progression = calculateTomeProgression(data);
    const graphHtml = progression
        ? `
        <div class="modal-graph-container">
            <canvas id="modal-tome-chart-${data.id}" class="scaling-chart"></canvas>
        </div>
    `
        : '';

    const content = `
        <div class="item-badges">
            <span class="badge tier-${data.tier}">${data.tier} Tier</span>
            <span class="badge" style="background: var(--bg-dark);">Priority: ${data.priority}</span>
        </div>
        <div class="tome-effect" style="margin-top: 1rem;">
            <strong>Stat:</strong> ${data.stat_affected}<br>
            <strong>Per Level:</strong> ${data.value_per_level}
        </div>
        <p>${data.description}</p>
        ${graphHtml}
        ${data.notes ? `<div class="item-formula">${data.notes}</div>` : ''}
        <div class="item-notes"><strong>Recommended for:</strong> ${Array.isArray(data.recommended_for) ? data.recommended_for.join(', ') : 'General use'}</div>
    `;

    // Initialize chart after modal is displayed
    if (progression) {
        setTimeout(() => {
            createScalingChart(`modal-tome-chart-${data.id}`, progression, data.name, data.stat_affected || '', true);
        }, 100);
    }

    return content;
}

/**
 * Render character modal content
 * @param {Object} data - Character data
 * @returns {string} HTML content
 */
function renderCharacterModal(data) {
    const imageHtml = generateModalImage(data, data.name, 'character');

    return `
        ${imageHtml}
        <div class="item-badges">
            <span class="badge tier-${data.tier}">${data.tier} Tier</span>
            <span class="badge">${data.playstyle}</span>
        </div>
        <div class="character-passive">
            <strong>${data.passive_ability}</strong>
            <p>${data.passive_description}</p>
        </div>
        <div class="character-meta">
            <div><strong>Starting Weapon:</strong> ${data.starting_weapon}</div>
            <div><strong>Base HP:</strong> ${data.base_hp} | <strong>Base Damage:</strong> ${data.base_damage}</div>
            ${data.unlock_requirement ? `<div><strong>Unlock:</strong> ${data.unlock_requirement}</div>` : ''}
        </div>
        ${
            data.best_for?.length
                ? `
            <div class="character-section">
                <h3>Best For</h3>
                <div class="tag-list">${data.best_for.map(b => `<span class="meta-tag">${b}</span>`).join('')}</div>
            </div>
        `
                : ''
        }
        <div class="strengths-weaknesses">
            <div class="strengths">
                <h4>Strengths</h4>
                <ul>${data.strengths?.map(s => `<li>${s}</li>`).join('') || '<li>None listed</li>'}</ul>
            </div>
            <div class="weaknesses">
                <h4>Weaknesses</h4>
                <ul>${data.weaknesses?.map(w => `<li>${w}</li>`).join('') || '<li>None listed</li>'}</ul>
            </div>
        </div>
        <div class="synergies-section">
            <h3>Synergies</h3>
            ${
                data.synergies_weapons?.length
                    ? `
                <div class="synergy-group">
                    <h4>Weapons</h4>
                    <div class="synergy-list">${data.synergies_weapons.map(s => `<span class="synergy-tag">${s}</span>`).join('')}</div>
                </div>
            `
                    : ''
            }
            ${
                data.synergies_items?.length
                    ? `
                <div class="synergy-group">
                    <h4>Items</h4>
                    <div class="synergy-list">${data.synergies_items.map(s => `<span class="synergy-tag">${s}</span>`).join('')}</div>
                </div>
            `
                    : ''
            }
            ${
                data.synergies_tomes?.length
                    ? `
                <div class="synergy-group">
                    <h4>Tomes</h4>
                    <div class="synergy-list">${data.synergies_tomes.map(s => `<span class="synergy-tag">${s}</span>`).join('')}</div>
                </div>
            `
                    : ''
            }
        </div>
        ${
            data.build_tips
                ? `
            <div class="build-tips">
                <h3>Build Tips</h3>
                <p>${data.build_tips}</p>
            </div>
        `
                : ''
        }
    `;
}

/**
 * Render shrine modal content
 * @param {Object} data - Shrine data
 * @returns {string} HTML content
 */
function renderShrineModal(data) {
    return `
        <div class="shrine-modal-header">
            <span class="shrine-icon-modal">${data.icon}</span>
            <div class="item-badges">
                <span class="badge">${data.type.replace('_', ' ')}</span>
                ${data.reusable ? '<span class="badge">Reusable</span>' : '<span class="badge">One-time</span>'}
            </div>
        </div>
        <div class="shrine-description-full">
            <p>${data.description}</p>
        </div>
        <div class="shrine-detail-section">
            <strong>Reward</strong>
            <p>${data.reward}</p>
        </div>
        ${
            data.activation
                ? `
            <div class="shrine-detail-section">
                <strong>Activation</strong>
                <p>${data.activation}</p>
            </div>
        `
                : ''
        }
        ${
            data.spawn_count
                ? `
            <div class="shrine-detail-section">
                <strong>Spawn Rate</strong>
                <p>${data.spawn_count}</p>
            </div>
        `
                : ''
        }
        ${
            data.best_for?.length
                ? `
            <div class="shrine-detail-section">
                <strong>Best For</strong>
                <div class="tag-list">${data.best_for.map(b => `<span class="meta-tag">${b}</span>`).join('')}</div>
            </div>
        `
                : ''
        }
        ${
            data.synergies_items?.length
                ? `
            <div class="synergies-section">
                <h3>Item Synergies</h3>
                <div class="synergy-list">${data.synergies_items.map(s => `<span class="synergy-tag">${s}</span>`).join('')}</div>
            </div>
        `
                : ''
        }
        ${
            data.strategy
                ? `
            <div class="shrine-strategy">
                <strong>Strategy</strong>
                <p>${data.strategy}</p>
            </div>
        `
                : ''
        }
        ${
            data.notes
                ? `
            <div class="item-notes" style="margin-top: 1rem;">
                <em>${data.notes}</em>
            </div>
        `
                : ''
        }
    `;
}

/**
 * Close the detail modal with animation
 */
function closeModal() {
    const modal = safeGetElementById('itemModal');
    if (modal) {
        // Deactivate focus trap before closing
        deactivateFocusTrap();

        modal.classList.remove('active');
        // Wait for animation to complete before hiding
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}

// ========================================
// Expose to global scope
// ========================================

window.openDetailModal = openDetailModal;
window.closeModal = closeModal;
