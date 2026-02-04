// ========================================
// MegaBonk Modal Core Module
// Core modal infrastructure, open/close, event handling
// ========================================

import { allData } from './data-service.ts';
import { ToastManager } from './toast.ts';
import { safeGetElementById } from './utils.ts';
import { onModalOpened } from './recently-viewed.ts';
import { renderSimilarItemsSection, setupSimilarItemsHandlers } from './similar-items.ts';
import type { EntityType, Item, Weapon, Tome, Character, Shrine } from '../types/index.ts';

// Import entity-specific renderers
import { renderItemModal } from './modal-items.ts';
import { renderWeaponModal } from './modal-weapons.ts';
import { renderCharacterModal } from './modal-characters.ts';
import { renderTomeModal, renderShrineModal } from './modal-entities.ts';

// ========================================
// Type Definitions
// ========================================

/**
 * Chart options for scaling visualization
 */
export interface ChartOptions {
    scalingFormulaType: string;
    hyperbolicConstant: number;
    maxStacks: number;
}

/**
 * Union type of all modal entity types
 */
export type ModalEntity = Item | Weapon | Tome | Character | Shrine;

// ========================================
// Chart Module Cache
// ========================================
// Cache the chart module import to avoid repeated async import overhead
// ES modules are already cached by the browser, but this avoids the async/await overhead
type ChartModule = typeof import('./charts.ts');
let cachedChartModule: ChartModule | null = null;

// Track close timeout to cancel if modal is reopened quickly
let modalCloseTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Get the cached chart module or load it
 * @returns Promise resolving to the chart module
 */
export async function getChartModule(): Promise<ChartModule | null> {
    if (cachedChartModule) {
        return cachedChartModule;
    }
    try {
        cachedChartModule = await import('./charts.ts');
        return cachedChartModule;
    } catch {
        return null;
    }
}

// ========================================
// Focus Trap State
// ========================================

// WeakMap to track tab click handlers per container (prevents memory leaks)
export const tabHandlers = new WeakMap<HTMLElement, (e: Event) => void>();

// Track current modal session to cancel stale chart initializations
let _currentModalSessionId = 0;

export function getCurrentModalSessionId(): number {
    return _currentModalSessionId;
}

export function incrementModalSessionId(): number {
    _currentModalSessionId++;
    return _currentModalSessionId;
}

// Focus trap state for modal accessibility
let focusTrapActive = false;
let focusableElements: Element[] = [];
let firstFocusableElement: Element | null | undefined = null;
let lastFocusableElement: Element | null | undefined = null;

// MutationObserver for cleanup on abnormal modal removal
let modalObserver: MutationObserver | null = null;

/**
 * Handle keyboard events for modal (focus trap + Escape to close)
 * @param e - Keyboard event
 */
function handleModalKeydown(e: KeyboardEvent): void {
    if (!focusTrapActive) return;

    // Guard: Check if modal element still exists in DOM and is active
    // This prevents stale listeners from causing errors on abnormal modal close
    const modal = safeGetElementById('itemModal');
    if (!modal || !modal.classList.contains('active')) {
        deactivateFocusTrap(); // Clean up stale listener
        return;
    }

    // Handle Escape key to close modal
    if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
        return;
    }

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
export function activateFocusTrap(modal: HTMLElement): void {
    // Get all focusable elements
    const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    focusableElements = Array.from(modal.querySelectorAll(focusableSelectors));

    if (focusableElements.length > 0) {
        firstFocusableElement = focusableElements[0];
        lastFocusableElement = focusableElements[focusableElements.length - 1];

        // Focus the modal title for better screen reader context
        // Make title programmatically focusable and focus it
        const modalTitle = modal.querySelector('#modal-title, h2') as HTMLElement | null;
        if (modalTitle) {
            modalTitle.tabIndex = -1;
            modalTitle.focus();
        } else {
            // Fallback to first focusable element if no title
            (firstFocusableElement as HTMLElement)?.focus();
        }
    }

    focusTrapActive = true;
    document.addEventListener('keydown', handleModalKeydown);

    // Setup MutationObserver to cleanup if modal is removed abnormally
    // This prevents state leaks if modal closes without calling deactivateFocusTrap
    if (modalObserver) {
        modalObserver.disconnect();
    }
    modalObserver = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            // Check if modal was removed from DOM
            if (mutation.type === 'childList') {
                for (const removed of mutation.removedNodes) {
                    if (removed === modal || (removed instanceof Element && removed.contains(modal))) {
                        deactivateFocusTrap();
                        return;
                    }
                }
            }
            // Check if modal display was set to none or active class removed
            if (mutation.type === 'attributes' && mutation.target === modal) {
                const modalEl = modal as HTMLElement;
                if (modalEl.style.display === 'none' || !modalEl.classList.contains('active')) {
                    deactivateFocusTrap();
                    return;
                }
            }
        }
    });

    // Observe the modal's parent and the modal itself for changes
    if (modal.parentNode) {
        modalObserver.observe(modal.parentNode, { childList: true });
    }
    modalObserver.observe(modal, { attributes: true, attributeFilter: ['style', 'class'] });
}

/**
 * Deactivate focus trap and cleanup all associated state
 */
export function deactivateFocusTrap(): void {
    focusTrapActive = false;
    document.removeEventListener('keydown', handleModalKeydown);
    focusableElements = [];
    firstFocusableElement = null;
    lastFocusableElement = null;

    // Cleanup MutationObserver
    if (modalObserver) {
        modalObserver.disconnect();
        modalObserver = null;
    }
}

/**
 * Open detail modal for any entity type
 * @param type - Entity type (items, weapons, tomes, characters, shrines)
 * @param id - Entity ID
 */
export async function openDetailModal(type: EntityType, id: string): Promise<void> {
    let data: ModalEntity | undefined;

    // Bug fix: Add explicit null guards before .find() to prevent TypeError
    // when data arrays are not yet loaded
    switch (type) {
        case 'items': {
            const itemsArray = allData.items?.items;
            data = itemsArray ? itemsArray.find(i => i.id === id) : undefined;
            break;
        }
        case 'weapons': {
            const weaponsArray = allData.weapons?.weapons;
            data = weaponsArray ? weaponsArray.find(w => w.id === id) : undefined;
            break;
        }
        case 'tomes': {
            const tomesArray = allData.tomes?.tomes;
            data = tomesArray ? tomesArray.find(t => t.id === id) : undefined;
            break;
        }
        case 'characters': {
            const charsArray = allData.characters?.characters;
            data = charsArray ? charsArray.find(c => c.id === id) : undefined;
            break;
        }
        case 'shrines': {
            const shrinesArray = allData.shrines?.shrines;
            data = shrinesArray ? shrinesArray.find(s => s.id === id) : undefined;
            break;
        }
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
        content += renderItemModal(data as Item);
    } else if (type === 'weapons') {
        content += renderWeaponModal(data as Weapon);
    } else if (type === 'tomes') {
        content += await renderTomeModal(data as Tome);
    } else if (type === 'characters') {
        content += renderCharacterModal(data as Character);
    } else if (type === 'shrines') {
        content += renderShrineModal(data as Shrine);
    }

    // Add similar items section (for items, weapons, tomes, characters)
    if (type !== 'shrines') {
        content += renderSimilarItemsSection(type, id);
    }

    modalBody.innerHTML = content;
    
    // Cancel any pending close timeout to prevent race condition
    if (modalCloseTimeout) {
        clearTimeout(modalCloseTimeout);
        modalCloseTimeout = null;
    }
    
    modal.style.display = 'block';

    // Track this view in recently viewed
    onModalOpened(type, id);

    // Trigger animation after display is set
    requestAnimationFrame(() => {
        modal.classList.add('active');
        // Prevent body scroll on mobile when modal is open
        document.body.classList.add('modal-open');

        // Activate focus trap for accessibility
        activateFocusTrap(modal);

        // Setup handlers for similar items
        setupSimilarItemsHandlers(modalBody);
    });
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
        // Re-enable body scroll on mobile
        document.body.classList.remove('modal-open');
        // Wait for animation to complete before hiding
        // Store timeout reference so it can be cancelled if modal is reopened
        modalCloseTimeout = setTimeout(() => {
            modal.style.display = 'none';
            modalCloseTimeout = null;
        }, 300);
    }
}
