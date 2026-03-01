// ========================================
// Keyboard Event Handlers
// Extracted from events-core.ts for modularity
// ========================================

import { safeGetElementById } from './utils.ts';
import { logger } from './logger.ts';
import { closeModal } from './modal.ts';
import {
    handleDropdownKeyboard,
    isSearchDropdownVisible,
    hideSearchDropdown,
} from './search-dropdown.ts';
import { type TabName } from './store.ts';
import { switchTab } from './events-tabs.ts';

// handleCardClick is used in handleActivationKey - imported dynamically to avoid circular deps

/**
 * Handle Escape key to close modals and dropdowns
 */
export function handleEscapeKey(): void {
    if (isSearchDropdownVisible()) {
        hideSearchDropdown();
        return;
    }
    closeModal();
    import('./compare.ts')
        .then(({ closeCompareModal }) => closeCompareModal())
        .catch(err => {
            logger.warn({
                operation: 'import.compare',
                error: { name: 'ImportError', message: err.message },
            });
            const compareModal = safeGetElementById('compareModal');
            if (compareModal) {
                compareModal.style.display = 'none';
                compareModal.classList.remove('active');
            }
        });
}

/**
 * Handle arrow key navigation between tabs
 */
export function handleTabArrowNavigation(e: KeyboardEvent, target: HTMLButtonElement): void {
    e.preventDefault();
    const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.tab-btn'));
    if (tabButtons.length === 0) return;
    const currentIndex = tabButtons.indexOf(target);
    if (currentIndex === -1) return;

    const nextIndex =
        e.key === 'ArrowRight'
            ? (currentIndex + 1) % tabButtons.length
            : (currentIndex - 1 + tabButtons.length) % tabButtons.length;

    const nextTab = tabButtons[nextIndex];
    if (nextTab) {
        nextTab.focus();
        const tabName = (nextTab.dataset.tab ?? null) as TabName | null;
        if (tabName && typeof switchTab === 'function') {
            switchTab(tabName);
        }
    }
}

/**
 * Handle number key shortcuts for tab switching
 */
export function handleNumberKeyTabSwitch(e: KeyboardEvent): void {
    const tabMap: Record<string, TabName> = {
        1: 'items',
        2: 'weapons',
        3: 'tomes',
        4: 'characters',
        5: 'shrines',
        6: 'build-planner',
        7: 'calculator',
        8: 'advisor',
        9: 'changelog',
    };
    const tabName = tabMap[e.key];
    if (tabName && typeof switchTab === 'function') {
        e.preventDefault();
        switchTab(tabName);
    }
}

/**
 * Handle Enter/Space activation on breakpoint cards
 */
export function handleBreakpointCardActivation(e: KeyboardEvent, target: HTMLElement): void {
    e.preventDefault();
    const itemId = target.dataset.item;
    const targetVal = target.dataset.target;
    if (itemId && targetVal) {
        const parsedTarget = Number.parseInt(targetVal, 10);
        if (!Number.isNaN(parsedTarget)) {
            import('./calculator.ts')
                .then(({ quickCalc }) => quickCalc(itemId, parsedTarget))
                .catch(err => {
                    logger.warn({
                        operation: 'import.calculator',
                        error: { name: 'ImportError', message: err.message },
                    });
                });
        }
    }
}

/**
 * Handle keyboard events for navigation, shortcuts, and accessibility
 */
export function handleSearchShortcut(e: KeyboardEvent, target: HTMLElement): boolean {
    if (!((e.ctrlKey && e.key === 'k') || e.key === '/')) return false;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return true;
    e.preventDefault();
    const searchInput = safeGetElementById('searchInput') as HTMLInputElement | null;
    if (searchInput) { searchInput.focus(); searchInput.select(); }
    return true;
}

export function handleActivationKey(e: KeyboardEvent, target: HTMLElement): boolean {
    if (e.key !== 'Enter' && e.key !== ' ') return false;

    if (target.classList.contains('breakpoint-card')) {
        handleBreakpointCardActivation(e, target);
        return true;
    }
    if (target.classList.contains('suggestion-card')) {
        e.preventDefault();
        import('./empty-states.ts')
            .then(({ handleEmptyStateClick }) => handleEmptyStateClick(target))
            .catch(err => logger.warn({ operation: 'import.empty-states', error: { name: 'ImportError', message: err.message } }));
        return true;
    }
    if (target.classList.contains('clickable-card')) {
        e.preventDefault();
        import('./events-click.ts')
            .then(({ handleCardClick }) => handleCardClick(target))
            .catch(err => logger.warn({ operation: 'import.events-click', error: { name: 'ImportError', message: err.message } }));
        return true;
    }
    return false;
}

export function handleKeydownDelegation(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;

    if (target.id === 'searchInput' && isSearchDropdownVisible() && handleDropdownKeyboard(e)) return;
    if (e.key === 'Escape') { handleEscapeKey(); return; }
    if (handleSearchShortcut(e, target)) return;

    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && target.classList.contains('tab-btn')) {
        handleTabArrowNavigation(e, target as HTMLButtonElement);
        return;
    }

    if (e.key >= '1' && e.key <= '9' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') handleNumberKeyTabSwitch(e);
        return;
    }

    handleActivationKey(e, target);
}
