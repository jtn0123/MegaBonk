// ========================================
// MegaBonk Modal Module
// ========================================

import { allData } from './data-service.ts';
import { ToastManager } from './toast.ts';
import { safeGetElementById, generateModalImage } from './utils.ts';
import type { Tier, Rarity, EntityType } from '../types/index.ts';

// ========================================
// Extended Type Definitions for Modal Data
// ========================================

/**
 * Scaling track definition for items with multiple scaling paths
 */
interface ScalingTrack {
    stat: string;
    values: number[];
}

/**
 * Chart options for scaling visualization
 */
interface ChartOptions {
    scalingFormulaType: string;
    hyperbolicConstant: number;
    maxStacks: number;
}

/**
 * Extended Item interface with all properties used in modal
 */
interface ModalItem {
    id: string;
    name: string;
    rarity: Rarity;
    tier: Tier;
    image?: string;
    description?: string; // Added for compatibility with ChartableItem
    base_effect: string;
    detailed_description: string;
    formula: string;
    scaling_per_stack?: number[];
    one_and_done?: boolean;
    graph_type?: string;
    scaling_tracks?: Record<string, ScalingTrack>;
    hidden_mechanics?: string[];
    scaling_formula_type?: string;
    hyperbolic_constant?: number;
    max_stacks?: number;
    stack_cap?: number;
    scaling_type?: string;
    secondary_scaling?: number[];
    synergies?: string[];
    anti_synergies?: string[];
}

/**
 * Extended Weapon interface with modal-specific properties
 */
interface ModalWeapon {
    id: string;
    name: string;
    attack_pattern: string;
    description: string;
    upgradeable_stats: string[] | string;
    build_tips: string;
}

/**
 * Extended Tome interface with modal-specific properties
 */
interface ModalTome {
    id: string;
    name: string;
    tier: Tier;
    rarity?: Rarity; // Added for compatibility with ChartableTome/Tome
    stat_affected: string;
    value_per_level: string | number;
    description: string;
    effect?: string; // Added for compatibility with Tome
    notes?: string;
    recommended_for?: string[];
    priority: number;
}

/**
 * Extended Character interface with modal-specific properties
 */
interface ModalCharacter {
    id: string;
    name: string;
    image?: string;
    tier: Tier;
    playstyle: string;
    passive_ability: string;
    passive_description: string;
    starting_weapon: string;
    base_hp: number;
    base_damage: number;
    unlock_requirement?: string;
    best_for?: string[];
    strengths?: string[];
    weaknesses?: string[];
    synergies_weapons?: string[];
    synergies_items?: string[];
    synergies_tomes?: string[];
    build_tips?: string;
}

/**
 * Extended Shrine interface with modal-specific properties
 */
interface ModalShrine {
    id: string;
    name: string;
    icon: string;
    type: string;
    reusable: boolean;
    description: string;
    reward: string;
    activation?: string;
    spawn_count?: string;
    best_for?: string[];
    synergies_items?: string[];
    strategy?: string;
    notes?: string;
}

/**
 * Union type of all modal entity types
 */
type ModalEntity = ModalItem | ModalWeapon | ModalTome | ModalCharacter | ModalShrine;

// ========================================
// Focus Trap State
// ========================================

// WeakMap to track tab click handlers per container (prevents memory leaks)
const tabHandlers = new WeakMap<HTMLElement, (e: Event) => void>();

// Track current modal session to cancel stale chart initializations
let currentModalSessionId = 0;

// Focus trap state for modal accessibility
let focusTrapActive = false;
let focusableElements: Element[] = [];
let firstFocusableElement: Element | null | undefined = null;
let lastFocusableElement: Element | null | undefined = null;

/**
 * Handle Tab key press for focus trap
 * @param e - Keyboard event
 */
function handleFocusTrap(e: KeyboardEvent): void {
    if (!focusTrapActive) return;

    if (e.key === 'Tab') {
        if (e.shiftKey) {
            // Shift + Tab
            if (document.activeElement === firstFocusableElement) {
                e.preventDefault();
                (lastFocusableElement as HTMLElement)?.focus();
            }
        } else {
            // Tab
            if (document.activeElement === lastFocusableElement) {
                e.preventDefault();
                (firstFocusableElement as HTMLElement)?.focus();
            }
        }
    }
}

/**
 * Activate focus trap for modal
 * @param modal - Modal element
 */
function activateFocusTrap(modal: HTMLElement): void {
    // Get all focusable elements
    const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    focusableElements = Array.from(modal.querySelectorAll(focusableSelectors));

    if (focusableElements.length > 0) {
        firstFocusableElement = focusableElements[0];
        lastFocusableElement = focusableElements[focusableElements.length - 1];

        // Focus first element (close button)
        (firstFocusableElement as HTMLElement)?.focus();
    }

    focusTrapActive = true;
    document.addEventListener('keydown', handleFocusTrap);
}

/**
 * Deactivate focus trap
 */
function deactivateFocusTrap(): void {
    focusTrapActive = false;
    document.removeEventListener('keydown', handleFocusTrap);
    focusableElements = [];
    firstFocusableElement = null;
    lastFocusableElement = null;
}

/**
 * Open detail modal for any entity type
 * @param type - Entity type (items, weapons, tomes, characters, shrines)
 * @param id - Entity ID
 */
export async function openDetailModal(type: EntityType, id: string): Promise<void> {
    let data: ModalEntity | undefined;
    switch (type) {
        case 'items':
            data = allData.items?.items.find(i => i.id === id) as ModalItem | undefined;
            break;
        case 'weapons':
            data = allData.weapons?.weapons.find(w => w.id === id) as ModalWeapon | undefined;
            break;
        case 'tomes':
            data = allData.tomes?.tomes.find(t => t.id === id) as ModalTome | undefined;
            break;
        case 'characters':
            data = allData.characters?.characters.find(c => c.id === id) as ModalCharacter | undefined;
            break;
        case 'shrines':
            data = allData.shrines?.shrines.find(s => s.id === id) as ModalShrine | undefined;
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

    if (type === 'items') {
        content += renderItemModal(data as ModalItem);
    } else if (type === 'weapons') {
        content += renderWeaponModal(data as ModalWeapon);
    } else if (type === 'tomes') {
        content += await renderTomeModal(data as ModalTome);
    } else if (type === 'characters') {
        content += renderCharacterModal(data as ModalCharacter);
    } else if (type === 'shrines') {
        content += renderShrineModal(data as ModalShrine);
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
 * @param data - Item data
 * @returns HTML content
 */
function renderItemModal(data: ModalItem): string {
    const showGraph = data.scaling_per_stack && !data.one_and_done && data.graph_type !== 'flat';
    const hasScalingTracks = data.scaling_tracks && Object.keys(data.scaling_tracks).length > 0;

    // Generate scaling tracks tabs if item has multiple tracks
    let graphHtml = '';
    if (hasScalingTracks) {
        const trackKeys = Object.keys(data.scaling_tracks!);
        const tabsHtml = trackKeys
            .map(
                (key, idx) =>
                    `<button class="scaling-tab ${idx === 0 ? 'active' : ''}" data-track="${key}" data-item-id="${data.id}">${data.scaling_tracks![key]?.stat || key}</button>`
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

    const imageHtml = generateModalImage(data as any, data.name, 'item');

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
    // Bug fix: Use session ID to cancel stale initialization attempts when modal changes
    currentModalSessionId++;
    const sessionId = currentModalSessionId;
    let initAttempts = 0;
    const MAX_INIT_ATTEMPTS = 50; // Prevent infinite loop - ~830ms max wait
    const initChart = async (): Promise<void> => {
        // Check if this initialization is still valid (modal wasn't reopened with different content)
        if (sessionId !== currentModalSessionId) {
            return; // Stale initialization, abort
        }

        // Check if modal is still active before continuing
        const modal = safeGetElementById('itemModal');
        if (!modal || !modal.classList.contains('active')) {
            return; // Modal closed, stop trying
        }

        const canvas = document.getElementById(`modal-chart-${data.id}`) as HTMLCanvasElement | null;
        if (!canvas) {
            initAttempts++;
            if (initAttempts < MAX_INIT_ATTEMPTS) {
                // Canvas not ready yet, try again
                requestAnimationFrame(initChart);
            }
            // If max attempts reached, silently give up (modal may have closed)
            return;
        }

        // Dynamically import chart functions only when needed
        const { getEffectiveStackCap, createScalingChart } = await import('./charts.js');

        if (hasScalingTracks) {
            // Initialize with first track
            const firstTrackKey = Object.keys(data.scaling_tracks!)[0];
            const firstTrack = firstTrackKey ? data.scaling_tracks![firstTrackKey] : undefined;
            const effectiveCap = getEffectiveStackCap(data);
            const chartOptions: ChartOptions = {
                scalingFormulaType: data.scaling_formula_type || 'linear',
                hyperbolicConstant: data.hyperbolic_constant || 1.0,
                maxStacks: data.max_stacks || 0,
            };
            if (firstTrack) {
                createScalingChart(
                    `modal-chart-${data.id}`,
                    firstTrack.values,
                    firstTrack.stat,
                    data.scaling_type || '',
                    true,
                    undefined,
                    effectiveCap,
                    chartOptions
                );
            }

            // Add tab click handlers
            setupScalingTabHandlers(data);
        } else if (showGraph) {
            const effectiveCap = getEffectiveStackCap(data);
            const chartOptions: ChartOptions = {
                scalingFormulaType: data.scaling_formula_type || 'linear',
                hyperbolicConstant: data.hyperbolic_constant || 1.0,
                maxStacks: data.max_stacks || 0,
            };
            createScalingChart(
                `modal-chart-${data.id}`,
                data.scaling_per_stack!,
                data.name,
                data.scaling_type || '',
                true,
                data.secondary_scaling || undefined,
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
 * @param data - Item data with scaling_tracks
 */
function setupScalingTabHandlers(data: ModalItem): void {
    // Use event delegation on the container to avoid memory leaks
    const container = document.querySelector('.scaling-tabs') as HTMLElement | null;
    if (!container) return;

    // Store handler reference for potential cleanup
    const handleTabClick = async (e: Event): Promise<void> => {
        const target = e.target as HTMLElement;
        const tab = target.closest(`.scaling-tab[data-item-id="${data.id}"]`) as HTMLButtonElement | null;
        if (!tab) return;

        // Update active state
        const tabs = container.querySelectorAll(`.scaling-tab[data-item-id="${data.id}"]`);
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Dynamically import chart functions
        const { getEffectiveStackCap, createScalingChart } = await import('./charts.js');

        // Get track data and redraw chart
        const trackKey = tab.dataset.track!;
        const track = trackKey ? data.scaling_tracks![trackKey] : undefined;
        if (!track) return;

        const effectiveCap = getEffectiveStackCap(data);
        const chartOptions: ChartOptions = {
            scalingFormulaType: data.scaling_formula_type || 'linear',
            hyperbolicConstant: data.hyperbolic_constant || 1.0,
            maxStacks: data.max_stacks || 0,
        };
        createScalingChart(
            `modal-chart-${data.id}`,
            track.values,
            track.stat,
            data.scaling_type || '',
            true,
            undefined,
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
 * @param data - Weapon data
 * @returns HTML content
 */
function renderWeaponModal(data: ModalWeapon): string {
    return `
        <p><strong>Attack Pattern:</strong> ${data.attack_pattern}</p>
        <p>${data.description}</p>
        <p><strong>Upgradeable Stats:</strong> ${Array.isArray(data.upgradeable_stats) ? data.upgradeable_stats.join(', ') : 'None'}</p>
        <p><strong>Build Tips:</strong> ${data.build_tips}</p>
    `;
}

/**
 * Render tome modal content
 * @param data - Tome data
 * @returns HTML content
 */
async function renderTomeModal(data: ModalTome): Promise<string> {
    // Dynamically import chart functions
    const { calculateTomeProgression, createScalingChart } = await import('./charts.js');

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
 * @param data - Character data
 * @returns HTML content
 */
function renderCharacterModal(data: ModalCharacter): string {
    const imageHtml = generateModalImage(data as any, data.name, 'character');

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
 * @param data - Shrine data
 * @returns HTML content
 */
function renderShrineModal(data: ModalShrine): string {
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
export function closeModal(): void {
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
// Exported functions:
// - openDetailModal(type, id)
// - closeModal()
// ========================================
