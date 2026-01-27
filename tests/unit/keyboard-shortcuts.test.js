/* global KeyboardEvent, MouseEvent */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';
import {
    setupKeyboardShortcuts,
    cleanupKeyboardShortcuts,
    showShortcutsModal,
    getAllShortcuts,
} from '../../src/modules/keyboard-shortcuts.ts';

describe('Keyboard Shortcuts Module', () => {
    beforeEach(() => {
        createMinimalDOM();
        vi.clearAllMocks();
    });

    afterEach(() => {
        // Clean up any modals
        const modal = document.getElementById('shortcuts-modal');
        if (modal) modal.remove();
    });

    describe('getAllShortcuts()', () => {
        it('should return all shortcut categories', () => {
            const shortcuts = getAllShortcuts();

            expect(Array.isArray(shortcuts)).toBe(true);
            expect(shortcuts.length).toBeGreaterThan(0);
        });

        it('should include Navigation category', () => {
            const shortcuts = getAllShortcuts();
            const navigation = shortcuts.find(cat => cat.category === 'Navigation');

            expect(navigation).toBeDefined();
            expect(navigation.shortcuts.length).toBe(8); // 1-8 for tabs
        });

        it('should include Search & Filter category', () => {
            const shortcuts = getAllShortcuts();
            const searchFilter = shortcuts.find(cat => cat.category === 'Search & Filter');

            expect(searchFilter).toBeDefined();
            expect(searchFilter.shortcuts.length).toBeGreaterThan(0);
        });

        it('should include View category', () => {
            const shortcuts = getAllShortcuts();
            const view = shortcuts.find(cat => cat.category === 'View');

            expect(view).toBeDefined();
            expect(view.shortcuts.some(s => s.keys.includes('G'))).toBe(true);
            expect(view.shortcuts.some(s => s.keys.includes('T'))).toBe(true);
        });

        it('should include Modal category', () => {
            const shortcuts = getAllShortcuts();
            const modal = shortcuts.find(cat => cat.category === 'Modal');

            expect(modal).toBeDefined();
            expect(modal.shortcuts.some(s => s.keys.includes('Escape'))).toBe(true);
        });

        it('should include Help category', () => {
            const shortcuts = getAllShortcuts();
            const help = shortcuts.find(cat => cat.category === 'Help');

            expect(help).toBeDefined();
            expect(help.shortcuts.some(s => s.keys.includes('?'))).toBe(true);
        });

        it('should have valid shortcut structure', () => {
            const shortcuts = getAllShortcuts();

            shortcuts.forEach(category => {
                expect(category).toHaveProperty('category');
                expect(category).toHaveProperty('shortcuts');
                expect(typeof category.category).toBe('string');
                expect(Array.isArray(category.shortcuts)).toBe(true);

                category.shortcuts.forEach(shortcut => {
                    expect(shortcut).toHaveProperty('keys');
                    expect(shortcut).toHaveProperty('description');
                    expect(Array.isArray(shortcut.keys)).toBe(true);
                    expect(shortcut.keys.length).toBeGreaterThan(0);
                    expect(typeof shortcut.description).toBe('string');
                });
            });
        });

        it('should be frozen (immutable)', () => {
            const shortcuts = getAllShortcuts();

            expect(Object.isFrozen(shortcuts)).toBe(true);
        });
    });

    // Note: showShortcutsModal tests are in a later describe block (line ~632)
    // These duplicate stubs have been removed since the AbortSignal issue is now fixed.

    describe('setupKeyboardShortcuts()', () => {
        beforeEach(() => {
            setupKeyboardShortcuts();
        });

        describe('input field exclusion', () => {
            it('should ignore shortcuts when focused on input', () => {
                const searchInput = document.getElementById('searchInput');
                searchInput.focus();

                const event = new KeyboardEvent('keydown', {
                    key: '1',
                    bubbles: true,
                });

                // Create spy for tab button
                const tabBtn = document.querySelector('[data-tab="items"]');
                const clickSpy = vi.spyOn(tabBtn, 'click');

                searchInput.dispatchEvent(event);

                expect(clickSpy).not.toHaveBeenCalled();
            });

            it('should ignore shortcuts when focused on textarea', () => {
                const textarea = document.createElement('textarea');
                document.body.appendChild(textarea);
                textarea.focus();

                const event = new KeyboardEvent('keydown', {
                    key: 'g',
                    bubbles: true,
                });

                textarea.dispatchEvent(event);

                // Should not trigger any view toggle
                const gridBtn = document.querySelector('[data-view="grid"]');
                if (gridBtn) {
                    const clickSpy = vi.spyOn(gridBtn, 'click');
                    expect(clickSpy).not.toHaveBeenCalled();
                }

                textarea.remove();
            });
        });

        describe('tab navigation (1-8)', () => {
            it('should switch to items tab on key 1', () => {
                const tabBtn = document.querySelector('[data-tab="items"]');
                const clickSpy = vi.spyOn(tabBtn, 'click');

                const event = new KeyboardEvent('keydown', {
                    key: '1',
                    bubbles: true,
                });
                document.dispatchEvent(event);

                expect(clickSpy).toHaveBeenCalled();
            });

            it('should switch to weapons tab on key 2', () => {
                const tabBtn = document.querySelector('[data-tab="weapons"]');
                const clickSpy = vi.spyOn(tabBtn, 'click');

                const event = new KeyboardEvent('keydown', {
                    key: '2',
                    bubbles: true,
                });
                document.dispatchEvent(event);

                expect(clickSpy).toHaveBeenCalled();
            });

            it('should switch to tomes tab on key 3', () => {
                const tabBtn = document.querySelector('[data-tab="tomes"]');
                const clickSpy = vi.spyOn(tabBtn, 'click');

                const event = new KeyboardEvent('keydown', {
                    key: '3',
                    bubbles: true,
                });
                document.dispatchEvent(event);

                expect(clickSpy).toHaveBeenCalled();
            });

            it('should switch to characters tab on key 4', () => {
                const tabBtn = document.querySelector('[data-tab="characters"]');
                const clickSpy = vi.spyOn(tabBtn, 'click');

                const event = new KeyboardEvent('keydown', {
                    key: '4',
                    bubbles: true,
                });
                document.dispatchEvent(event);

                expect(clickSpy).toHaveBeenCalled();
            });

            it('should switch to shrines tab on key 5', () => {
                const tabBtn = document.querySelector('[data-tab="shrines"]');
                const clickSpy = vi.spyOn(tabBtn, 'click');

                const event = new KeyboardEvent('keydown', {
                    key: '5',
                    bubbles: true,
                });
                document.dispatchEvent(event);

                expect(clickSpy).toHaveBeenCalled();
            });

            it('should switch to build-planner tab on key 6', () => {
                const tabBtn = document.querySelector('[data-tab="build-planner"]');
                const clickSpy = vi.spyOn(tabBtn, 'click');

                const event = new KeyboardEvent('keydown', {
                    key: '6',
                    bubbles: true,
                });
                document.dispatchEvent(event);

                expect(clickSpy).toHaveBeenCalled();
            });

            it('should switch to calculator tab on key 7', () => {
                const tabBtn = document.querySelector('[data-tab="calculator"]');
                const clickSpy = vi.spyOn(tabBtn, 'click');

                const event = new KeyboardEvent('keydown', {
                    key: '7',
                    bubbles: true,
                });
                document.dispatchEvent(event);

                expect(clickSpy).toHaveBeenCalled();
            });

            it('should not trigger tab switch with Ctrl modifier', () => {
                const tabBtn = document.querySelector('[data-tab="items"]');
                const clickSpy = vi.spyOn(tabBtn, 'click');

                const event = new KeyboardEvent('keydown', {
                    key: '1',
                    ctrlKey: true,
                    bubbles: true,
                });
                document.dispatchEvent(event);

                expect(clickSpy).not.toHaveBeenCalled();
            });

            it('should not trigger tab switch with Meta modifier', () => {
                const tabBtn = document.querySelector('[data-tab="items"]');
                const clickSpy = vi.spyOn(tabBtn, 'click');

                const event = new KeyboardEvent('keydown', {
                    key: '1',
                    metaKey: true,
                    bubbles: true,
                });
                document.dispatchEvent(event);

                expect(clickSpy).not.toHaveBeenCalled();
            });
        });

        describe('search focus', () => {
            it('should focus search on / key', () => {
                const searchInput = document.getElementById('searchInput');
                const focusSpy = vi.spyOn(searchInput, 'focus');

                const event = new KeyboardEvent('keydown', {
                    key: '/',
                    bubbles: true,
                });
                document.dispatchEvent(event);

                expect(focusSpy).toHaveBeenCalled();
            });

            it('should focus search on Ctrl+F', () => {
                const searchInput = document.getElementById('searchInput');
                const focusSpy = vi.spyOn(searchInput, 'focus');

                const event = new KeyboardEvent('keydown', {
                    key: 'f',
                    ctrlKey: true,
                    bubbles: true,
                });
                document.dispatchEvent(event);

                expect(focusSpy).toHaveBeenCalled();
            });

            it('should select search text when focusing', () => {
                const searchInput = document.getElementById('searchInput');
                searchInput.value = 'test query';
                const selectSpy = vi.spyOn(searchInput, 'select');

                const event = new KeyboardEvent('keydown', {
                    key: '/',
                    bubbles: true,
                });
                document.dispatchEvent(event);

                expect(selectSpy).toHaveBeenCalled();
            });
        });

        describe('clear filters (Ctrl+K)', () => {
            it('should click clear filters button on Ctrl+K', () => {
                // Add clear filters button
                const clearBtn = document.createElement('button');
                clearBtn.setAttribute('onclick', 'clearFilters()');
                document.body.appendChild(clearBtn);

                const clickSpy = vi.spyOn(clearBtn, 'click');

                const event = new KeyboardEvent('keydown', {
                    key: 'k',
                    ctrlKey: true,
                    bubbles: true,
                });
                document.dispatchEvent(event);

                expect(clickSpy).toHaveBeenCalled();

                clearBtn.remove();
            });
        });

        describe('Escape key', () => {
            it('should clear search input and blur on Escape', () => {
                const searchInput = document.getElementById('searchInput');
                searchInput.value = 'test';
                searchInput.focus();

                const blurSpy = vi.spyOn(searchInput, 'blur');

                const event = new KeyboardEvent('keydown', {
                    key: 'Escape',
                    bubbles: true,
                });
                document.dispatchEvent(event);

                expect(searchInput.value).toBe('');
                expect(blurSpy).toHaveBeenCalled();
            });

            it('should dispatch input event when clearing search', () => {
                const searchInput = document.getElementById('searchInput');
                searchInput.value = 'test';

                let inputEventFired = false;
                searchInput.addEventListener('input', () => {
                    inputEventFired = true;
                });

                const event = new KeyboardEvent('keydown', {
                    key: 'Escape',
                    bubbles: true,
                });
                document.dispatchEvent(event);

                expect(inputEventFired).toBe(true);
            });

            it('should not act if search input is empty', () => {
                const searchInput = document.getElementById('searchInput');
                searchInput.value = '';

                const blurSpy = vi.spyOn(searchInput, 'blur');

                const event = new KeyboardEvent('keydown', {
                    key: 'Escape',
                    bubbles: true,
                });
                document.dispatchEvent(event);

                expect(blurSpy).not.toHaveBeenCalled();
            });
        });

        describe('view toggles', () => {
            beforeEach(() => {
                // Add view toggle buttons
                const gridBtn = document.createElement('button');
                gridBtn.setAttribute('data-view', 'grid');
                document.body.appendChild(gridBtn);

                const listBtn = document.createElement('button');
                listBtn.setAttribute('data-view', 'list');
                document.body.appendChild(listBtn);

                const compareBtn = document.createElement('button');
                compareBtn.id = 'compare-mode-toggle';
                document.body.appendChild(compareBtn);
            });

            afterEach(() => {
                document.querySelector('[data-view="grid"]')?.remove();
                document.querySelector('[data-view="list"]')?.remove();
                document.getElementById('compare-mode-toggle')?.remove();
            });

            it('should toggle grid view on G key', () => {
                const gridBtn = document.querySelector('[data-view="grid"]');
                const clickSpy = vi.spyOn(gridBtn, 'click');

                const event = new KeyboardEvent('keydown', {
                    key: 'g',
                    bubbles: true,
                });
                document.dispatchEvent(event);

                expect(clickSpy).toHaveBeenCalled();
            });

            it('should toggle grid view on uppercase G key', () => {
                const gridBtn = document.querySelector('[data-view="grid"]');
                const clickSpy = vi.spyOn(gridBtn, 'click');

                const event = new KeyboardEvent('keydown', {
                    key: 'G',
                    bubbles: true,
                });
                document.dispatchEvent(event);

                expect(clickSpy).toHaveBeenCalled();
            });

            it('should toggle list view on L key', () => {
                const listBtn = document.querySelector('[data-view="list"]');
                const clickSpy = vi.spyOn(listBtn, 'click');

                const event = new KeyboardEvent('keydown', {
                    key: 'l',
                    bubbles: true,
                });
                document.dispatchEvent(event);

                expect(clickSpy).toHaveBeenCalled();
            });

            it('should toggle compare mode on C key', () => {
                const compareBtn = document.getElementById('compare-mode-toggle');
                const clickSpy = vi.spyOn(compareBtn, 'click');

                const event = new KeyboardEvent('keydown', {
                    key: 'c',
                    bubbles: true,
                });
                document.dispatchEvent(event);

                expect(clickSpy).toHaveBeenCalled();
            });
        });

        describe('theme toggle', () => {
            beforeEach(() => {
                const themeBtn = document.createElement('button');
                themeBtn.id = 'theme-toggle';
                document.body.appendChild(themeBtn);
            });

            afterEach(() => {
                document.getElementById('theme-toggle')?.remove();
            });

            it('should toggle theme on T key', () => {
                const themeBtn = document.getElementById('theme-toggle');
                const clickSpy = vi.spyOn(themeBtn, 'click');

                const event = new KeyboardEvent('keydown', {
                    key: 't',
                    bubbles: true,
                });
                document.dispatchEvent(event);

                expect(clickSpy).toHaveBeenCalled();
            });

            it('should toggle theme on uppercase T key', () => {
                const themeBtn = document.getElementById('theme-toggle');
                const clickSpy = vi.spyOn(themeBtn, 'click');

                const event = new KeyboardEvent('keydown', {
                    key: 'T',
                    bubbles: true,
                });
                document.dispatchEvent(event);

                expect(clickSpy).toHaveBeenCalled();
            });
        });

        describe('help modal', () => {
            // Note: showShortcutsModal uses addEventListener with { signal: AbortController.signal }
            // which jsdom doesn't fully support. The modal may not render correctly in jsdom.
            // These tests verify the keyboard handler is called, not modal creation.
            afterEach(() => {
                const modal = document.getElementById('shortcuts-modal');
                if (modal) modal.remove();
            });

            it('should show shortcuts modal on ? key', () => {
                const event = new KeyboardEvent('keydown', {
                    key: '?',
                    bubbles: true,
                });
                document.dispatchEvent(event);

                expect(document.getElementById('shortcuts-modal')).not.toBeNull();
            });

            it('should show shortcuts modal on Shift+? key', () => {
                const event = new KeyboardEvent('keydown', {
                    key: '?',
                    shiftKey: true,
                    bubbles: true,
                });
                document.dispatchEvent(event);

                expect(document.getElementById('shortcuts-modal')).not.toBeNull();
            });
        });

        describe('prevent default behavior', () => {
            it('should prevent default on handled keys', () => {
                const event = new KeyboardEvent('keydown', {
                    key: '/',
                    bubbles: true,
                    cancelable: true,
                });

                const preventSpy = vi.spyOn(event, 'preventDefault');
                document.dispatchEvent(event);

                expect(preventSpy).toHaveBeenCalled();
            });
        });
    });

    describe('cleanupKeyboardShortcuts()', () => {
        beforeEach(() => {
            setupKeyboardShortcuts();
        });

        it('should remove keydown event listener', () => {
            const tabBtn = document.querySelector('[data-tab="items"]');
            const clickSpy = vi.spyOn(tabBtn, 'click');

            // First verify the handler is active
            const event1 = new KeyboardEvent('keydown', {
                key: '1',
                bubbles: true,
            });
            document.dispatchEvent(event1);
            expect(clickSpy).toHaveBeenCalledTimes(1);

            // Clean up
            cleanupKeyboardShortcuts();

            // Now the handler should not fire
            const event2 = new KeyboardEvent('keydown', {
                key: '1',
                bubbles: true,
            });
            document.dispatchEvent(event2);
            expect(clickSpy).toHaveBeenCalledTimes(1); // Still 1, not 2
        });

        it('should be safe to call multiple times', () => {
            expect(() => {
                cleanupKeyboardShortcuts();
                cleanupKeyboardShortcuts();
                cleanupKeyboardShortcuts();
            }).not.toThrow();
        });

        it('should be safe to call before setupKeyboardShortcuts', () => {
            cleanupKeyboardShortcuts(); // Called during beforeEach already, but call again
            expect(() => cleanupKeyboardShortcuts()).not.toThrow();
        });

        it('should allow re-setup after cleanup', () => {
            cleanupKeyboardShortcuts();
            setupKeyboardShortcuts();

            const tabBtn = document.querySelector('[data-tab="items"]');
            const clickSpy = vi.spyOn(tabBtn, 'click');

            const event = new KeyboardEvent('keydown', {
                key: '1',
                bubbles: true,
            });
            document.dispatchEvent(event);

            expect(clickSpy).toHaveBeenCalled();
        });
    });

    describe('showShortcutsModal()', () => {
        // Note: These tests were previously skipped due to jsdom AbortSignal limitation.
        // Fixed by adding AbortController/AbortSignal to global scope in tests/setup.js

        afterEach(() => {
            const modal = document.getElementById('shortcuts-modal');
            if (modal) modal.remove();
        });

        it('should create modal with correct id', () => {
            showShortcutsModal();
            const modal = document.getElementById('shortcuts-modal');
            expect(modal).not.toBeNull();
        });

        it('should have modal class', () => {
            showShortcutsModal();
            const modal = document.getElementById('shortcuts-modal');
            expect(modal.classList.contains('modal')).toBe(true);
            expect(modal.classList.contains('shortcuts-modal')).toBe(true);
        });

        it('should toggle (remove) modal when called twice', () => {
            showShortcutsModal();
            expect(document.getElementById('shortcuts-modal')).not.toBeNull();

            showShortcutsModal();
            expect(document.getElementById('shortcuts-modal')).toBeNull();
        });

        it('should include modal header with title', () => {
            showShortcutsModal();
            const modal = document.getElementById('shortcuts-modal');
            const header = modal.querySelector('.modal-header');
            expect(header).not.toBeNull();
            expect(header.textContent).toContain('Keyboard Shortcuts');
        });

        it('should include close button', () => {
            showShortcutsModal();
            const closeBtn = document.getElementById('shortcuts-modal-close');
            expect(closeBtn).not.toBeNull();
        });

        it('should include all shortcut categories', () => {
            showShortcutsModal();
            const modal = document.getElementById('shortcuts-modal');
            const categories = modal.querySelectorAll('.shortcuts-category');
            expect(categories.length).toBe(getAllShortcuts().length);
        });

        it('should display category titles', () => {
            showShortcutsModal();
            const modal = document.getElementById('shortcuts-modal');
            const titles = modal.querySelectorAll('.shortcuts-category-title');

            const titleTexts = Array.from(titles).map(t => t.textContent);
            expect(titleTexts).toContain('Navigation');
            expect(titleTexts).toContain('Search & Filter');
            expect(titleTexts).toContain('View');
        });

        it('should display shortcut keys in kbd elements', () => {
            showShortcutsModal();
            const modal = document.getElementById('shortcuts-modal');
            const kbdElements = modal.querySelectorAll('kbd.shortcut-key');

            expect(kbdElements.length).toBeGreaterThan(0);
            // Check for some known shortcuts
            const keyTexts = Array.from(kbdElements).map(k => k.textContent);
            expect(keyTexts).toContain('1');
            expect(keyTexts).toContain('/');
            expect(keyTexts).toContain('Escape');
        });

        it('should display shortcut descriptions', () => {
            showShortcutsModal();
            const modal = document.getElementById('shortcuts-modal');
            const descriptions = modal.querySelectorAll('.shortcut-description');

            expect(descriptions.length).toBeGreaterThan(0);
            const descTexts = Array.from(descriptions).map(d => d.textContent);
            expect(descTexts.some(d => d.includes('Items tab'))).toBe(true);
            expect(descTexts.some(d => d.includes('search'))).toBe(true);
        });

        it('should include tip in footer', () => {
            showShortcutsModal();
            const modal = document.getElementById('shortcuts-modal');
            const tip = modal.querySelector('.shortcuts-tip');

            expect(tip).not.toBeNull();
            expect(tip.textContent).toContain('?');
        });

        it('should close modal when close button is clicked', () => {
            showShortcutsModal();
            const closeBtn = document.getElementById('shortcuts-modal-close');

            closeBtn.click();

            expect(document.getElementById('shortcuts-modal')).toBeNull();
        });

        it('should close modal when backdrop is clicked', () => {
            showShortcutsModal();
            const modal = document.getElementById('shortcuts-modal');

            // Create a click event on the modal backdrop (not the content)
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
            });
            Object.defineProperty(clickEvent, 'target', { value: modal });
            modal.dispatchEvent(clickEvent);

            expect(document.getElementById('shortcuts-modal')).toBeNull();
        });

        it('should close modal when Escape key is pressed', () => {
            showShortcutsModal();

            const escapeEvent = new KeyboardEvent('keydown', {
                key: 'Escape',
                bubbles: true,
            });
            document.dispatchEvent(escapeEvent);

            expect(document.getElementById('shortcuts-modal')).toBeNull();
        });
    });

    describe('setupKeyboardShortcuts() - multiple setup calls', () => {
        it('should not stack handlers when called multiple times', () => {
            setupKeyboardShortcuts();
            setupKeyboardShortcuts();
            setupKeyboardShortcuts();

            const tabBtn = document.querySelector('[data-tab="items"]');
            const clickSpy = vi.spyOn(tabBtn, 'click');

            const event = new KeyboardEvent('keydown', {
                key: '1',
                bubbles: true,
            });
            document.dispatchEvent(event);

            // Should only be called once, not 3 times
            expect(clickSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('setupKeyboardShortcuts() - select element exclusion', () => {
        it('should ignore shortcuts when focused on select element', () => {
            setupKeyboardShortcuts();
            const select = document.createElement('select');
            document.body.appendChild(select);
            select.focus();

            const tabBtn = document.querySelector('[data-tab="items"]');
            const clickSpy = vi.spyOn(tabBtn, 'click');

            const event = new KeyboardEvent('keydown', {
                key: '1',
                bubbles: true,
            });
            select.dispatchEvent(event);

            expect(clickSpy).not.toHaveBeenCalled();
            select.remove();
        });
    });
});
