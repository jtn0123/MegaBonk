// ========================================
// MegaBonk Modal Module
// ========================================

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

    if (!data) return;

    const modal = safeGetElementById('itemModal');
    const modalBody = safeGetElementById('modalBody');
    if (!modal || !modalBody) return;

    let content = `<h2>${data.name}</h2>`;

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
        const tabsHtml = trackKeys.map((key, idx) =>
            `<button class="scaling-tab ${idx === 0 ? 'active' : ''}" data-track="${key}" data-item-id="${data.id}">${data.scaling_tracks[key].stat}</button>`
        ).join('');

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
    const hiddenMechanicsHtml = data.hidden_mechanics?.length ? `
        <div class="hidden-mechanics">
            <h4><span class="hidden-mechanics-icon">⚡</span> Hidden Mechanics</h4>
            <ul>
                ${data.hidden_mechanics.map(m => `<li>${m}</li>`).join('')}
            </ul>
        </div>
    ` : '';

    // Hyperbolic scaling indicator
    const hyperbolicWarning = data.scaling_formula_type === 'hyperbolic' ? `
        <div class="hyperbolic-warning">
            <span class="warning-icon">⚠</span>
            <span>Hyperbolic Scaling: Displayed values have diminishing returns</span>
        </div>
    ` : '';

    const imageHtml = generateModalImage(data, data.name, 'item');

    const content = `
        ${imageHtml}
        <div class="item-badges">
            <span class="badge rarity-${data.rarity}">${data.rarity}</span>
            <span class="badge tier-${data.tier}">${data.tier} Tier</span>
        </div>
        ${data.one_and_done ? `
            <div class="one-and-done-warning">
                <span class="warning-icon">!</span>
                <span>One-and-Done: Additional copies provide no benefit</span>
            </div>
        ` : ''}
        ${hyperbolicWarning}
        ${(data.max_stacks || (data.stack_cap && data.stack_cap <= 100)) ? `
            <div class="stack-info">
                <strong>Stack Limit:</strong> ${data.max_stacks || data.stack_cap} stacks
            </div>
        ` : ''}
        <div class="item-effect" style="margin-top: 1rem;">${data.base_effect}</div>
        <p>${data.detailed_description}</p>
        ${hiddenMechanicsHtml}
        <div class="item-formula"><strong>Formula:</strong> ${data.formula}</div>
        ${graphHtml}
        ${data.synergies?.length ? `<div class="synergies-section"><h3>Synergies</h3><div class="synergy-list">${data.synergies.map(s => `<span class="synergy-tag">${s}</span>`).join('')}</div></div>` : ''}
        ${data.anti_synergies?.length ? `<div class="anti-synergies-section"><h3>Anti-Synergies</h3><div class="antisynergy-list">${data.anti_synergies.map(s => `<span class="antisynergy-tag">${s}</span>`).join('')}</div></div>` : ''}
    `;

    // Initialize chart after modal is displayed
    setTimeout(() => {
        if (hasScalingTracks) {
            // Initialize with first track
            const firstTrackKey = Object.keys(data.scaling_tracks)[0];
            const firstTrack = data.scaling_tracks[firstTrackKey];
            const effectiveCap = getEffectiveStackCap(data);
            const chartOptions = {
                scalingFormulaType: data.scaling_formula_type || 'linear',
                hyperbolicConstant: data.hyperbolic_constant || 1.0,
                maxStacks: data.max_stacks || null
            };
            createScalingChart(`modal-chart-${data.id}`, firstTrack.values, firstTrack.stat, data.scaling_type || '', true, null, effectiveCap, chartOptions);

            // Add tab click handlers
            setupScalingTabHandlers(data);
        } else if (showGraph) {
            const effectiveCap = getEffectiveStackCap(data);
            const chartOptions = {
                scalingFormulaType: data.scaling_formula_type || 'linear',
                hyperbolicConstant: data.hyperbolic_constant || 1.0,
                maxStacks: data.max_stacks || null
            };
            createScalingChart(`modal-chart-${data.id}`, data.scaling_per_stack, data.name, data.scaling_type || '', true, data.secondary_scaling || null, effectiveCap, chartOptions);
        }
    }, 100);

    return content;
}

/**
 * Setup tab click handlers for scaling tracks
 * @param {Object} data - Item data with scaling_tracks
 */
function setupScalingTabHandlers(data) {
    const tabs = document.querySelectorAll(`.scaling-tab[data-item-id="${data.id}"]`);
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active state
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Get track data and redraw chart
            const trackKey = tab.dataset.track;
            const track = data.scaling_tracks[trackKey];
            const effectiveCap = getEffectiveStackCap(data);
            const chartOptions = {
                scalingFormulaType: data.scaling_formula_type || 'linear',
                hyperbolicConstant: data.hyperbolic_constant || 1.0,
                maxStacks: data.max_stacks || null
            };
            createScalingChart(`modal-chart-${data.id}`, track.values, track.stat, data.scaling_type || '', true, null, effectiveCap, chartOptions);
        });
    });
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
        <p><strong>Upgradeable Stats:</strong> ${data.upgradeable_stats.join(', ')}</p>
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
    const graphHtml = progression ? `
        <div class="modal-graph-container">
            <canvas id="modal-tome-chart-${data.id}" class="scaling-chart"></canvas>
        </div>
    ` : '';

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
        <div class="item-notes"><strong>Recommended for:</strong> ${data.recommended_for.join(', ')}</div>
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
        ${data.best_for?.length ? `
            <div class="character-section">
                <h3>Best For</h3>
                <div class="tag-list">${data.best_for.map(b => `<span class="meta-tag">${b}</span>`).join('')}</div>
            </div>
        ` : ''}
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
            ${data.synergies_weapons?.length ? `
                <div class="synergy-group">
                    <h4>Weapons</h4>
                    <div class="synergy-list">${data.synergies_weapons.map(s => `<span class="synergy-tag">${s}</span>`).join('')}</div>
                </div>
            ` : ''}
            ${data.synergies_items?.length ? `
                <div class="synergy-group">
                    <h4>Items</h4>
                    <div class="synergy-list">${data.synergies_items.map(s => `<span class="synergy-tag">${s}</span>`).join('')}</div>
                </div>
            ` : ''}
            ${data.synergies_tomes?.length ? `
                <div class="synergy-group">
                    <h4>Tomes</h4>
                    <div class="synergy-list">${data.synergies_tomes.map(s => `<span class="synergy-tag">${s}</span>`).join('')}</div>
                </div>
            ` : ''}
        </div>
        ${data.build_tips ? `
            <div class="build-tips">
                <h3>Build Tips</h3>
                <p>${data.build_tips}</p>
            </div>
        ` : ''}
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
        ${data.activation ? `
            <div class="shrine-detail-section">
                <strong>Activation</strong>
                <p>${data.activation}</p>
            </div>
        ` : ''}
        ${data.spawn_count ? `
            <div class="shrine-detail-section">
                <strong>Spawn Rate</strong>
                <p>${data.spawn_count}</p>
            </div>
        ` : ''}
        ${data.best_for?.length ? `
            <div class="shrine-detail-section">
                <strong>Best For</strong>
                <div class="tag-list">${data.best_for.map(b => `<span class="meta-tag">${b}</span>`).join('')}</div>
            </div>
        ` : ''}
        ${data.synergies_items?.length ? `
            <div class="synergies-section">
                <h3>Item Synergies</h3>
                <div class="synergy-list">${data.synergies_items.map(s => `<span class="synergy-tag">${s}</span>`).join('')}</div>
            </div>
        ` : ''}
        ${data.strategy ? `
            <div class="shrine-strategy">
                <strong>Strategy</strong>
                <p>${data.strategy}</p>
            </div>
        ` : ''}
        ${data.notes ? `
            <div class="item-notes" style="margin-top: 1rem;">
                <em>${data.notes}</em>
            </div>
        ` : ''}
    `;
}

/**
 * Close the detail modal
 */
function closeModal() {
    const modal = safeGetElementById('itemModal');
    if (modal) modal.style.display = 'none';
}

// ========================================
// Expose to global scope
// ========================================

window.openDetailModal = openDetailModal;
window.closeModal = closeModal;
