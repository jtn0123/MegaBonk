// ========================================
// Mobile Bottom Navigation Module
// ========================================
// Provides a thumb-friendly bottom navigation for mobile users
// with an accessible slide-up "More" drawer
// ========================================

import { getState, setState, subscribe, type TabName } from './store.ts';
import { safeGetElementById, safeQuerySelector, safeQuerySelectorAll } from './utils.ts';
import { logger } from './logger.ts';

// ========================================
// Types
// ========================================

interface MoreMenuConfig {
    tab: string;
    label: string;
    icon: string;
}

// ========================================
// Constants
// ========================================

const MORE_MENU_TABS: MoreMenuConfig[] = [
    { tab: 'build-planner', label: 'Build', icon: '🛠️' },
    { tab: 'advisor', label: 'Advisor', icon: '🤖' },
    { tab: 'characters', label: 'Characters', icon: '👤' },
    { tab: 'calculator', label: 'Calculator', icon: '🧮' },
    { tab: 'changelog', label: 'Changelog', icon: '📋' },
    { tab: 'about', label: 'About', icon: 'ℹ️' },
];

const MORE_TAB_NAMES = MORE_MENU_TABS.map(t => t.tab);

// ========================================
// State
// ========================================

let isMenuOpen = false;
let previouslyFocusedElement: HTMLElement | null = null;
let focusableElements: HTMLElement[] = [];

// ========================================
// More Menu Component
// ========================================

/**
 * Create the "More" menu drawer HTML
 */
function createMoreMenu(): HTMLElement {
    const menu = document.createElement('div');
    menu.id = 'more-menu';
    menu.className = 'more-menu';
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-modal', 'true');
    menu.setAttribute('aria-label', 'Additional navigation tabs');

    const currentTab = getState('currentTab');

    menu.innerHTML = `
        <div class="more-menu-backdrop" aria-hidden="true"></div>
        <div class="more-menu-drawer" role="document">
            <div class="more-menu-handle" aria-hidden="true"></div>
            <div class="more-menu-header">
                <span class="more-menu-title" id="more-menu-title">More Options</span>
                <button class="more-menu-close" aria-label="Close menu" type="button">
                    <span aria-hidden="true">×</span>
                </button>
            </div>
            <div class="more-menu-items" role="menu" aria-labelledby="more-menu-title">
                ${MORE_MENU_TABS.map(
                    ({ tab, label, icon }) => `
                    <button 
                        class="more-menu-item${currentTab === tab ? ' current' : ''}" 
                        data-tab="${tab}" 
                        role="menuitem"
                        tabindex="0"
                        aria-current="${currentTab === tab ? 'page' : 'false'}"
                    >
                        <span class="menu-icon" aria-hidden="true">${icon}</span>
                        <span class="menu-label">${label}</span>
                    </button>
                `
                ).join('')}
            </div>
        </div>
    `;

    return menu;
}

/**
 * Update menu items to reflect current tab
 */
function updateMenuItems(currentTab: string): void {
    const menu = safeGetElementById('more-menu');
    if (!menu) return;

    const items = menu.querySelectorAll('.more-menu-item');
    items.forEach(item => {
        const btn = item as HTMLElement;
        const tab = btn.dataset.tab;
        const isCurrent = tab === currentTab;

        btn.classList.toggle('current', isCurrent);
        btn.setAttribute('aria-current', isCurrent ? 'page' : 'false');
    });
}

/**
 * Get all focusable elements within the menu
 */
function getFocusableElements(): HTMLElement[] {
    const menu = safeGetElementById('more-menu');
    if (!menu) return [];

    return Array.from(
        menu.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex]:not([tabindex="-1"])')
    ).filter(el => el.offsetParent !== null); // Filter out hidden elements
}

/**
 * Trap focus within the menu
 */
function handleFocusTrap(e: KeyboardEvent): void {
    if (e.key !== 'Tab' || !isMenuOpen) return;

    focusableElements = getFocusableElements();
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
        // Shift + Tab: moving backwards
        if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
        }
    } else {
        // Tab: moving forwards
        if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
        }
    }
}

/**
 * Handle keyboard navigation within menu
 */
function handleKeyboardNavigation(e: KeyboardEvent): void {
    if (!isMenuOpen) return;

    const menu = safeGetElementById('more-menu');
    if (!menu) return;

    switch (e.key) {
        case 'Escape':
            e.preventDefault();
            hideMoreMenu();
            break;

        case 'ArrowDown':
        case 'ArrowRight': {
            e.preventDefault();
            const items = Array.from(menu.querySelectorAll('.more-menu-item')) as HTMLElement[];
            const currentIndex = items.findIndex(item => item === document.activeElement);
            const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
            items[nextIndex]?.focus();
            break;
        }

        case 'ArrowUp':
        case 'ArrowLeft': {
            e.preventDefault();
            const items = Array.from(menu.querySelectorAll('.more-menu-item')) as HTMLElement[];
            const currentIndex = items.findIndex(item => item === document.activeElement);
            const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
            items[prevIndex]?.focus();
            break;
        }

        case 'Home': {
            e.preventDefault();
            const items = menu.querySelectorAll('.more-menu-item');
            (items[0] as HTMLElement)?.focus();
            break;
        }

        case 'End': {
            e.preventDefault();
            const items = menu.querySelectorAll('.more-menu-item');
            (items[items.length - 1] as HTMLElement)?.focus();
            break;
        }
    }
}

/**
 * Show the more menu with animation
 */
function showMoreMenu(): void {
    // Save the currently focused element to restore later
    previouslyFocusedElement = document.activeElement as HTMLElement;

    let menu = safeGetElementById('more-menu');

    if (!menu) {
        menu = createMoreMenu();
        document.body.appendChild(menu);
        setupMenuEventListeners(menu);
    } else {
        // Update items in case current tab changed
        const currentTab = getState('currentTab');
        if (currentTab) {
            updateMenuItems(currentTab);
        }
    }

    isMenuOpen = true;
    menu.classList.add('active');
    document.body.classList.add('more-menu-open');

    // Add keyboard event listeners
    document.addEventListener('keydown', handleKeyboardNavigation);
    document.addEventListener('keydown', handleFocusTrap);

    // Focus the first menu item after animation
    requestAnimationFrame(() => {
        const firstItem = menu!.querySelector('.more-menu-item') as HTMLElement;
        firstItem?.focus();
    });

    logger.debug({
        operation: 'mobile-nav.more-menu',
        data: { action: 'open' },
    });
}

/**
 * Hide the more menu
 */
function hideMoreMenu(): void {
    const menu = safeGetElementById('more-menu');
    if (!menu) return;

    isMenuOpen = false;
    menu.classList.remove('active');
    document.body.classList.remove('more-menu-open');

    // Remove keyboard event listeners
    document.removeEventListener('keydown', handleKeyboardNavigation);
    document.removeEventListener('keydown', handleFocusTrap);

    // Restore focus to the previously focused element (the More button)
    if (previouslyFocusedElement) {
        previouslyFocusedElement.focus();
        previouslyFocusedElement = null;
    }

    logger.debug({
        operation: 'mobile-nav.more-menu',
        data: { action: 'close' },
    });
}

/**
 * Toggle the more menu
 */
function toggleMoreMenu(): void {
    if (isMenuOpen) {
        hideMoreMenu();
    } else {
        showMoreMenu();
    }
}

/**
 * Setup event listeners for the menu
 */
function setupMenuEventListeners(menu: HTMLElement): void {
    // Backdrop click to close
    const backdrop = menu.querySelector('.more-menu-backdrop');
    backdrop?.addEventListener('click', hideMoreMenu);

    // Close button click
    const closeBtn = menu.querySelector('.more-menu-close');
    closeBtn?.addEventListener('click', hideMoreMenu);

    // Menu item clicks - use event delegation
    const itemsContainer = menu.querySelector('.more-menu-items');
    itemsContainer?.addEventListener('click', (e: Event) => {
        const target = e.target as HTMLElement;
        const item = target.closest('.more-menu-item') as HTMLElement | null;

        if (item) {
            const tab = item.dataset.tab;
            if (tab) {
                switchTab(tab);
                hideMoreMenu();
            }
        }
    });

    // Handle Enter/Space on menu items for keyboard users
    itemsContainer?.addEventListener('keydown', (e: Event) => {
        const keyEvent = e as KeyboardEvent;
        if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
            const target = keyEvent.target as HTMLElement;
            if (target.classList.contains('more-menu-item')) {
                keyEvent.preventDefault();
                const tab = target.dataset.tab;
                if (tab) {
                    switchTab(tab);
                    hideMoreMenu();
                }
            }
        }
    });
}

// ========================================
// Tab Switching
// ========================================

/**
 * Switch to a tab (triggers existing tab system)
 */
function switchTab(tabName: string): void {
    // Find and click the corresponding tab button in the main nav
    const tabBtn = safeQuerySelector(`.tab-btn[data-tab="${tabName}"]`) as HTMLElement | null;

    if (tabBtn) {
        tabBtn.click();
    } else {
        // Fallback: directly set state and trigger render
        setState('currentTab', tabName as TabName);
    }
}

/**
 * Update mobile nav active state based on current tab
 */
function updateMobileNavState(currentTab: string): void {
    const navItems = safeQuerySelectorAll('.mobile-bottom-nav .nav-item');

    // Check if current tab is in the "more" menu
    const isMoreTab = MORE_TAB_NAMES.includes(currentTab);
    const currentMoreTab = isMoreTab ? MORE_MENU_TABS.find(t => t.tab === currentTab) : null;

    navItems.forEach(item => {
        const btn = item as HTMLElement;
        const tab = btn.dataset.tab;

        if (tab === 'more') {
            // Update the More button to show current tab if viewing a More tab
            const iconSpan = btn.querySelector('.nav-icon');
            const labelSpan = btn.querySelector('span:not(.nav-icon)');

            if (isMoreTab && currentMoreTab) {
                // Show current tab's icon and label
                if (iconSpan) iconSpan.textContent = currentMoreTab.icon;
                if (labelSpan) labelSpan.textContent = currentMoreTab.label;
                btn.classList.add('active');
                btn.setAttribute('aria-label', `${currentMoreTab.label} (tap for more options)`);
            } else {
                // Reset to default More button
                if (iconSpan) iconSpan.textContent = '≡';
                if (labelSpan) labelSpan.textContent = 'More';
                btn.classList.remove('active');
                btn.setAttribute('aria-label', 'More tabs');
            }
            btn.setAttribute('aria-expanded', 'false');
        } else if (tab === currentTab) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Also update menu items if menu exists
    updateMenuItems(currentTab);
}

// ========================================
// Event Handlers
// ========================================

/**
 * Handle mobile nav item clicks
 */
function handleNavClick(e: Event): void {
    const target = e.target as HTMLElement;
    const navItem = target.closest('.nav-item') as HTMLElement | null;

    if (!navItem) return;

    const tab = navItem.dataset.tab;

    if (tab === 'more') {
        toggleMoreMenu();
    } else if (tab) {
        // Close menu if open when switching to a main nav tab
        if (isMenuOpen) {
            hideMoreMenu();
        }
        switchTab(tab);
    }
}

// ========================================
// Initialization
// ========================================

/**
 * Initialize mobile bottom navigation
 */
export function initMobileNav(): void {
    const mobileNav = safeQuerySelector('.mobile-bottom-nav');

    if (!mobileNav) {
        logger.warn({
            operation: 'mobile-nav.init',
            data: { reason: 'mobile_nav_not_found' },
        });
        return;
    }

    // Add click listener using event delegation
    mobileNav.addEventListener('click', handleNavClick);

    // Setup aria-expanded on the More button
    const moreBtn = mobileNav.querySelector('[data-tab="more"]');
    if (moreBtn) {
        moreBtn.setAttribute('aria-expanded', 'false');
        moreBtn.setAttribute('aria-haspopup', 'dialog');
    }

    // Subscribe to tab changes to update nav state
    subscribe('currentTab', newTab => {
        updateMobileNavState(newTab as string);
    });

    // Initialize with current tab
    const currentTab = getState('currentTab');
    if (currentTab) {
        updateMobileNavState(currentTab as string);
    }

    logger.info({
        operation: 'mobile-nav.init',
        data: { status: 'initialized' },
    });
}

// Export for external use
export { hideMoreMenu, showMoreMenu, toggleMoreMenu };
