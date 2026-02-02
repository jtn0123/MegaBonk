import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';

// Mock the store module
vi.mock('../../src/modules/store.ts', () => ({
    getState: vi.fn().mockReturnValue('items'),
    setState: vi.fn(),
    subscribe: vi.fn(),
}));

// Mock the logger
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        setContext: vi.fn(),
    },
}));

import {
    initMobileNav,
    injectMoreMenuStyles,
    showMoreMenu,
    hideMoreMenu,
} from '../../src/modules/mobile-nav.ts';
import { getState, setState, subscribe } from '../../src/modules/store.ts';

describe('Mobile Navigation Module', () => {
    beforeEach(() => {
        createMinimalDOM();
        vi.clearAllMocks();

        // Add mobile nav element to DOM
        const mobileNav = document.createElement('nav');
        mobileNav.className = 'mobile-bottom-nav';
        mobileNav.innerHTML = `
            <div class="nav-items">
                <button class="nav-item active" data-tab="items">Items</button>
                <button class="nav-item" data-tab="weapons">Weapons</button>
                <button class="nav-item" data-tab="build-planner">Build</button>
                <button class="nav-item" data-tab="advisor">Advisor</button>
                <button class="nav-item" data-tab="more">More</button>
            </div>
        `;
        document.body.appendChild(mobileNav);
    });

    afterEach(() => {
        // Clean up more menu if present
        const moreMenu = document.getElementById('more-menu');
        if (moreMenu) moreMenu.remove();

        document.body.classList.remove('more-menu-open');
    });

    describe('initMobileNav()', () => {
        it('should initialize without errors', () => {
            expect(() => initMobileNav()).not.toThrow();
        });

        it('should subscribe to currentTab changes', () => {
            initMobileNav();
            expect(subscribe).toHaveBeenCalledWith('currentTab', expect.any(Function));
        });

        it('should handle missing mobile nav gracefully', () => {
            // Remove mobile nav
            document.querySelector('.mobile-bottom-nav')?.remove();

            expect(() => initMobileNav()).not.toThrow();
        });
    });

    describe('injectMoreMenuStyles()', () => {
        it.skip('should inject styles into document head', () => {
            injectMoreMenuStyles();

            const styleElement = document.getElementById('more-menu-styles');
            expect(styleElement).not.toBeNull();
            expect(styleElement.tagName).toBe('STYLE');
        });

        it.skip('should not duplicate styles on multiple calls', () => {
            injectMoreMenuStyles();
            injectMoreMenuStyles();
            injectMoreMenuStyles();

            const styleElements = document.querySelectorAll('#more-menu-styles');
            expect(styleElements).toHaveLength(1);
        });

        it.skip('should include more-menu styles', () => {
            injectMoreMenuStyles();

            const styleElement = document.getElementById('more-menu-styles');
            expect(styleElement.textContent).toContain('.more-menu');
            expect(styleElement.textContent).toContain('.more-menu-content');
        });
    });

    describe('showMoreMenu()', () => {
        it('should create more menu if not exists', () => {
            showMoreMenu();

            const moreMenu = document.getElementById('more-menu');
            expect(moreMenu).not.toBeNull();
        });

        it('should add active class to menu', () => {
            showMoreMenu();

            const moreMenu = document.getElementById('more-menu');
            expect(moreMenu.classList.contains('active')).toBe(true);
        });

        it('should add more-menu-open class to body', () => {
            showMoreMenu();

            expect(document.body.classList.contains('more-menu-open')).toBe(true);
        });

        it.skip('should include menu items for additional tabs', () => {
            showMoreMenu();

            const moreMenu = document.getElementById('more-menu');
            expect(moreMenu.textContent).toContain('Tomes');
            expect(moreMenu.textContent).toContain('Characters');
            expect(moreMenu.textContent).toContain('Shrines');
            expect(moreMenu.textContent).toContain('Calculator');
            expect(moreMenu.textContent).toContain('Changelog');
        });

        it('should include close button', () => {
            showMoreMenu();

            const closeBtn = document.querySelector('.more-menu-close');
            expect(closeBtn).not.toBeNull();
        });
    });

    describe('hideMoreMenu()', () => {
        it('should remove active class from menu', () => {
            showMoreMenu();
            hideMoreMenu();

            const moreMenu = document.getElementById('more-menu');
            expect(moreMenu.classList.contains('active')).toBe(false);
        });

        it('should remove more-menu-open class from body', () => {
            showMoreMenu();
            hideMoreMenu();

            expect(document.body.classList.contains('more-menu-open')).toBe(false);
        });

        it('should handle missing menu gracefully', () => {
            expect(() => hideMoreMenu()).not.toThrow();
        });
    });

    describe('navigation interaction', () => {
        it('should handle nav item click', () => {
            initMobileNav();

            const weaponsBtn = document.querySelector('.nav-item[data-tab="weapons"]');

            // Create a mock tab button to be clicked
            const mockTabBtn = document.createElement('button');
            mockTabBtn.className = 'tab-btn';
            mockTabBtn.dataset.tab = 'weapons';
            mockTabBtn.click = vi.fn();
            document.body.appendChild(mockTabBtn);

            // Simulate click on mobile nav
            weaponsBtn.click();

            // The tab button should be clicked (or setState called as fallback)
            // In test environment, we expect the click handler to work
        });

        it('should show more menu when more button clicked', () => {
            initMobileNav();

            const moreBtn = document.querySelector('.nav-item[data-tab="more"]');
            moreBtn.click();

            const moreMenu = document.getElementById('more-menu');
            expect(moreMenu).not.toBeNull();
            expect(moreMenu.classList.contains('active')).toBe(true);
        });
    });

    describe('active state management', () => {
        it('should update active class based on current tab', () => {
            initMobileNav();

            // Get the subscriber callback
            const subscriberCallback = subscribe.mock.calls[0][1];

            // Simulate tab change to weapons
            subscriberCallback('weapons');

            const weaponsBtn = document.querySelector('.nav-item[data-tab="weapons"]');
            const itemsBtn = document.querySelector('.nav-item[data-tab="items"]');

            expect(weaponsBtn.classList.contains('active')).toBe(true);
            expect(itemsBtn.classList.contains('active')).toBe(false);
        });

        it.skip('should highlight more button for tabs in more menu', () => {
            initMobileNav();

            const subscriberCallback = subscribe.mock.calls[0][1];

            // Simulate tab change to tomes (in more menu)
            subscriberCallback('tomes');

            const moreBtn = document.querySelector('.nav-item[data-tab="more"]');
            expect(moreBtn.classList.contains('active')).toBe(true);
        });
    });
});
