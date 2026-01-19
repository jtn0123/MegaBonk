// ========================================
// Mobile Bottom Navigation Module
// ========================================
// Provides a thumb-friendly bottom navigation for mobile users
// ========================================

import { getState, setState, subscribe, type TabName } from './store.ts';
import { safeGetElementById, safeQuerySelector, safeQuerySelectorAll } from './utils.ts';
import { logger } from './logger.ts';

// ========================================
// Types
// ========================================

interface MoreMenuState {
    isOpen: boolean;
}

// ========================================
// Constants
// ========================================

const MORE_MENU_TABS = ['tomes', 'characters', 'shrines', 'calculator', 'changelog'];

// ========================================
// State
// ========================================

let moreMenuState: MoreMenuState = { isOpen: false };

// ========================================
// More Menu Component
// ========================================

/**
 * Create the "More" menu popup HTML
 */
function createMoreMenu(): HTMLElement {
    const menu = document.createElement('div');
    menu.id = 'more-menu';
    menu.className = 'more-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Additional tabs');

    menu.innerHTML = `
        <div class="more-menu-backdrop"></div>
        <div class="more-menu-content">
            <div class="more-menu-header">
                <span>More Options</span>
                <button class="more-menu-close" aria-label="Close menu">&times;</button>
            </div>
            <div class="more-menu-items">
                <button class="more-menu-item" data-tab="tomes" role="menuitem">
                    <span class="menu-icon">📚</span>
                    <span>Tomes</span>
                </button>
                <button class="more-menu-item" data-tab="characters" role="menuitem">
                    <span class="menu-icon">👤</span>
                    <span>Characters</span>
                </button>
                <button class="more-menu-item" data-tab="shrines" role="menuitem">
                    <span class="menu-icon">⛩️</span>
                    <span>Shrines</span>
                </button>
                <button class="more-menu-item" data-tab="calculator" role="menuitem">
                    <span class="menu-icon">🧮</span>
                    <span>Calculator</span>
                </button>
                <button class="more-menu-item" data-tab="changelog" role="menuitem">
                    <span class="menu-icon">📋</span>
                    <span>Changelog</span>
                </button>
            </div>
        </div>
    `;

    return menu;
}

/**
 * Show the more menu
 */
function showMoreMenu(): void {
    let menu = safeGetElementById('more-menu');

    if (!menu) {
        menu = createMoreMenu();
        document.body.appendChild(menu);

        // Add event listeners
        const backdrop = menu.querySelector('.more-menu-backdrop');
        const closeBtn = menu.querySelector('.more-menu-close');

        backdrop?.addEventListener('click', hideMoreMenu);
        closeBtn?.addEventListener('click', hideMoreMenu);

        // Add menu item listeners
        const items = menu.querySelectorAll('.more-menu-item');
        items.forEach(item => {
            item.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const tab = target.dataset.tab;
                if (tab) {
                    switchTab(tab);
                    hideMoreMenu();
                }
            });
        });
    }

    moreMenuState.isOpen = true;
    menu.classList.add('active');
    document.body.classList.add('more-menu-open');
}

/**
 * Hide the more menu
 */
function hideMoreMenu(): void {
    const menu = safeGetElementById('more-menu');
    if (menu) {
        moreMenuState.isOpen = false;
        menu.classList.remove('active');
        document.body.classList.remove('more-menu-open');
    }
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

    navItems.forEach(item => {
        const btn = item as HTMLElement;
        const tab = btn.dataset.tab;

        // Check if current tab is in the "more" menu
        const isMoreTab = MORE_MENU_TABS.includes(currentTab);

        if (tab === 'more' && isMoreTab) {
            btn.classList.add('active');
        } else if (tab === currentTab) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
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
        showMoreMenu();
    } else if (tab) {
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
            data: { reason: 'mobile_nav_not_found' }
        });
        return;
    }

    // Add click listener using event delegation
    mobileNav.addEventListener('click', handleNavClick);

    // Subscribe to tab changes to update nav state
    subscribe('currentTab', (newTab) => {
        updateMobileNavState(newTab as string);
    });

    // Initialize with current tab
    const currentTab = getState('currentTab');
    if (currentTab) {
        updateMobileNavState(currentTab as string);
    }

    logger.info({
        operation: 'mobile-nav.init',
        data: { status: 'initialized' }
    });
}

// ========================================
// CSS Injection for More Menu
// ========================================

/**
 * Inject additional CSS for the more menu
 */
export function injectMoreMenuStyles(): void {
    const styleId = 'more-menu-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        .more-menu {
            display: none;
            position: fixed;
            inset: 0;
            z-index: 200;
        }

        .more-menu.active {
            display: block;
        }

        .more-menu-backdrop {
            position: absolute;
            inset: 0;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(2px);
        }

        .more-menu-content {
            position: absolute;
            bottom: 70px;
            left: 50%;
            transform: translateX(-50%);
            width: 90%;
            max-width: 320px;
            background: var(--bg-elevated);
            border-radius: 12px;
            box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
            overflow: hidden;
            animation: slideUp 0.2s ease-out;
        }

        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateX(-50%) translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
        }

        .more-menu-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            border-bottom: 1px solid var(--bg-subtle);
            font-weight: 600;
            color: var(--text-secondary);
        }

        .more-menu-close {
            background: transparent;
            border: none;
            color: var(--text-secondary);
            font-size: 1.5rem;
            cursor: pointer;
            padding: 0.25rem;
            line-height: 1;
        }

        .more-menu-close:hover {
            color: var(--accent);
        }

        .more-menu-items {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 0.5rem;
            padding: 1rem;
        }

        .more-menu-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.5rem;
            padding: 1rem 0.5rem;
            background: var(--bg-subtle);
            border: none;
            border-radius: 8px;
            color: var(--text-primary);
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 0.8rem;
        }

        .more-menu-item:hover {
            background: var(--accent);
            color: white;
        }

        .more-menu-item .menu-icon {
            font-size: 1.5rem;
        }

        body.more-menu-open {
            overflow: hidden;
        }

        [data-theme='light'] .more-menu-content {
            box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
        }

        [data-theme='light'] .more-menu-backdrop {
            background: rgba(0, 0, 0, 0.3);
        }
    `;

    document.head.appendChild(style);
}

// Export for initialization
export { hideMoreMenu, showMoreMenu };
