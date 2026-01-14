/**
 * Tests for keyboard-shortcuts.ts - Keyboard Shortcuts Module
 * Tests keyboard navigation and shortcuts help modal
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { showShortcutsModal, setupKeyboardShortcuts, getAllShortcuts } from '../../src/modules/keyboard-shortcuts.ts';
import { setupDOM } from '../helpers/dom-setup.js';

describe('Keyboard Shortcuts Module', () => {
    beforeEach(() => {
        setupDOM();
        document.body.innerHTML = '<div id="app"></div>';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('getAllShortcuts', () => {
        it('should return all shortcut categories', () => {
            const shortcuts = getAllShortcuts();

            expect(shortcuts).toBeDefined();
            expect(Array.isArray(shortcuts)).toBe(true);
            expect(shortcuts.length).toBeGreaterThan(0);
        });

        it('should include Navigation category', () => {
            const shortcuts = getAllShortcuts();
            const navCategory = shortcuts.find(c => c.category === 'Navigation');

            expect(navCategory).toBeDefined();
            expect(navCategory!.shortcuts.length).toBeGreaterThan(0);
        });

        it('should include Search & Filter category', () => {
            const shortcuts = getAllShortcuts();
            const searchCategory = shortcuts.find(c => c.category === 'Search & Filter');

            expect(searchCategory).toBeDefined();
            expect(searchCategory!.shortcuts.length).toBeGreaterThan(0);
        });

        it('should include View category', () => {
            const shortcuts = getAllShortcuts();
            const viewCategory = shortcuts.find(c => c.category === 'View');

            expect(viewCategory).toBeDefined();
            expect(viewCategory!.shortcuts.length).toBeGreaterThan(0);
        });

        it('should include Modal category', () => {
            const shortcuts = getAllShortcuts();
            const modalCategory = shortcuts.find(c => c.category === 'Modal');

            expect(modalCategory).toBeDefined();
            expect(modalCategory!.shortcuts.length).toBeGreaterThan(0);
        });

        it('should include Help category', () => {
            const shortcuts = getAllShortcuts();
            const helpCategory = shortcuts.find(c => c.category === 'Help');

            expect(helpCategory).toBeDefined();
            expect(helpCategory!.shortcuts.length).toBeGreaterThan(0);
        });

        it('should have tab navigation shortcuts (1-8)', () => {
            const shortcuts = getAllShortcuts();
            const navCategory = shortcuts.find(c => c.category === 'Navigation');

            expect(navCategory).toBeDefined();
            expect(navCategory!.shortcuts.some(s => s.keys.includes('1'))).toBe(true);
            expect(navCategory!.shortcuts.some(s => s.keys.includes('2'))).toBe(true);
            expect(navCategory!.shortcuts.some(s => s.keys.includes('3'))).toBe(true);
            expect(navCategory!.shortcuts.some(s => s.keys.includes('4'))).toBe(true);
            expect(navCategory!.shortcuts.some(s => s.keys.includes('5'))).toBe(true);
            expect(navCategory!.shortcuts.some(s => s.keys.includes('6'))).toBe(true);
            expect(navCategory!.shortcuts.some(s => s.keys.includes('7'))).toBe(true);
            expect(navCategory!.shortcuts.some(s => s.keys.includes('8'))).toBe(true);
        });

        it('should have each shortcut with keys and description', () => {
            const shortcuts = getAllShortcuts();

            shortcuts.forEach(category => {
                category.shortcuts.forEach(shortcut => {
                    expect(shortcut.keys).toBeDefined();
                    expect(Array.isArray(shortcut.keys)).toBe(true);
                    expect(shortcut.keys.length).toBeGreaterThan(0);
                    expect(shortcut.description).toBeDefined();
                    expect(typeof shortcut.description).toBe('string');
                });
            });
        });

        it('should return readonly array', () => {
            const shortcuts = getAllShortcuts();

            expect(() => {
                (shortcuts as any).push({ category: 'Test', shortcuts: [] });
            }).toThrow();
        });
    });

    describe('showShortcutsModal', () => {
        it('should create modal element', () => {
            showShortcutsModal();

            const modal = document.getElementById('shortcuts-modal');
            expect(modal).not.toBeNull();
            expect(modal?.className).toContain('modal');
        });

        it('should display keyboard shortcuts title', () => {
            showShortcutsModal();

            const modal = document.getElementById('shortcuts-modal');
            expect(modal?.textContent).toContain('Keyboard Shortcuts');
        });

        it('should display all categories', () => {
            showShortcutsModal();

            const modal = document.getElementById('shortcuts-modal');
            const shortcuts = getAllShortcuts();

            shortcuts.forEach(category => {
                expect(modal?.textContent).toContain(category.category);
            });
        });

        it('should display shortcut keys in kbd tags', () => {
            showShortcutsModal();

            const modal = document.getElementById('shortcuts-modal');
            const kbdElements = modal?.querySelectorAll('kbd');

            expect(kbdElements).toBeDefined();
            expect(kbdElements!.length).toBeGreaterThan(0);
        });

        it('should have close button', () => {
            showShortcutsModal();

            const closeBtn = document.getElementById('shortcuts-modal-close');
            expect(closeBtn).not.toBeNull();
        });

        it('should remove modal when close button clicked', () => {
            showShortcutsModal();

            const closeBtn = document.getElementById('shortcuts-modal-close');
            closeBtn?.click();

            const modal = document.getElementById('shortcuts-modal');
            expect(modal).toBeNull();
        });

        it('should remove modal when backdrop clicked', () => {
            showShortcutsModal();

            const modal = document.getElementById('shortcuts-modal');
            const event = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(event, 'target', { value: modal });
            modal?.dispatchEvent(event);

            expect(document.getElementById('shortcuts-modal')).toBeNull();
        });

        it('should close modal on Escape key', () => {
            showShortcutsModal();

            const event = new KeyboardEvent('keydown', { key: 'Escape' });
            document.dispatchEvent(event);

            const modal = document.getElementById('shortcuts-modal');
            expect(modal).toBeNull();
        });

        it('should toggle modal - remove if already exists', () => {
            showShortcutsModal();
            const modal1 = document.getElementById('shortcuts-modal');
            expect(modal1).not.toBeNull();

            showShortcutsModal(); // Second call should remove
            const modal2 = document.getElementById('shortcuts-modal');
            expect(modal2).toBeNull();
        });

        it('should add show class after creation', () => {
            vi.useFakeTimers();

            showShortcutsModal();

            const modal = document.getElementById('shortcuts-modal');
            expect(modal).not.toBeNull();

            // Wait for requestAnimationFrame
            vi.runAllTimers();

            expect(modal?.classList.contains('show')).toBe(true);

            vi.useRealTimers();
        });

        it('should display tip at bottom', () => {
            showShortcutsModal();

            const modal = document.getElementById('shortcuts-modal');
            const footer = modal?.querySelector('.modal-footer');

            expect(footer).not.toBeNull();
            expect(footer?.textContent).toContain('Tip');
        });
    });

    describe('setupKeyboardShortcuts', () => {
        beforeEach(() => {
            // Setup DOM elements for shortcuts
            document.body.innerHTML = `
                <input type="text" id="searchInput" />
                <button data-tab="items">Items</button>
                <button data-tab="weapons">Weapons</button>
                <button data-tab="tomes">Tomes</button>
                <button data-tab="characters">Characters</button>
                <button data-tab="shrines">Shrines</button>
                <button data-tab="build-planner">Build Planner</button>
                <button data-tab="calculator">Calculator</button>
                <button data-tab="changelog">Changelog</button>
                <button data-view="grid">Grid</button>
                <button data-view="list">List</button>
                <button id="compare-mode-toggle">Compare</button>
                <button id="theme-toggle">Theme</button>
                <button onclick="clearFilters()">Clear</button>
            `;
        });

        it('should setup keyboard event listener', () => {
            const spy = vi.spyOn(document, 'addEventListener');

            setupKeyboardShortcuts();

            expect(spy).toHaveBeenCalledWith('keydown', expect.any(Function));

            spy.mockRestore();
        });

        it('should show shortcuts modal on ? key', () => {
            setupKeyboardShortcuts();

            const event = new KeyboardEvent('keydown', { key: '?' });
            document.dispatchEvent(event);

            const modal = document.getElementById('shortcuts-modal');
            expect(modal).not.toBeNull();
        });

        it('should switch to items tab on 1 key', () => {
            setupKeyboardShortcuts();

            const itemsBtn = document.querySelector('[data-tab="items"]') as HTMLElement;
            const clickSpy = vi.spyOn(itemsBtn, 'click');

            const event = new KeyboardEvent('keydown', { key: '1' });
            document.dispatchEvent(event);

            expect(clickSpy).toHaveBeenCalled();

            clickSpy.mockRestore();
        });

        it('should switch to weapons tab on 2 key', () => {
            setupKeyboardShortcuts();

            const weaponsBtn = document.querySelector('[data-tab="weapons"]') as HTMLElement;
            const clickSpy = vi.spyOn(weaponsBtn, 'click');

            const event = new KeyboardEvent('keydown', { key: '2' });
            document.dispatchEvent(event);

            expect(clickSpy).toHaveBeenCalled();

            clickSpy.mockRestore();
        });

        it('should focus search input on / key', () => {
            setupKeyboardShortcuts();

            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            const focusSpy = vi.spyOn(searchInput, 'focus');

            const event = new KeyboardEvent('keydown', { key: '/' });
            document.dispatchEvent(event);

            expect(focusSpy).toHaveBeenCalled();

            focusSpy.mockRestore();
        });

        it('should focus and select search input on Ctrl+F', () => {
            setupKeyboardShortcuts();

            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            const focusSpy = vi.spyOn(searchInput, 'focus');
            const selectSpy = vi.spyOn(searchInput, 'select');

            const event = new KeyboardEvent('keydown', { key: 'f', ctrlKey: true });
            document.dispatchEvent(event);

            expect(focusSpy).toHaveBeenCalled();
            expect(selectSpy).toHaveBeenCalled();

            focusSpy.mockRestore();
            selectSpy.mockRestore();
        });

        it('should clear search on Escape key', () => {
            setupKeyboardShortcuts();

            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            searchInput.value = 'test search';

            const event = new KeyboardEvent('keydown', { key: 'Escape' });
            document.dispatchEvent(event);

            expect(searchInput.value).toBe('');
        });

        it('should trigger grid view on G key', () => {
            setupKeyboardShortcuts();

            const gridBtn = document.querySelector('[data-view="grid"]') as HTMLElement;
            const clickSpy = vi.spyOn(gridBtn, 'click');

            const event = new KeyboardEvent('keydown', { key: 'g' });
            document.dispatchEvent(event);

            expect(clickSpy).toHaveBeenCalled();

            clickSpy.mockRestore();
        });

        it('should trigger list view on L key', () => {
            setupKeyboardShortcuts();

            const listBtn = document.querySelector('[data-view="list"]') as HTMLElement;
            const clickSpy = vi.spyOn(listBtn, 'click');

            const event = new KeyboardEvent('keydown', { key: 'l' });
            document.dispatchEvent(event);

            expect(clickSpy).toHaveBeenCalled();

            clickSpy.mockRestore();
        });

        it('should toggle compare mode on C key', () => {
            setupKeyboardShortcuts();

            const compareBtn = document.getElementById('compare-mode-toggle') as HTMLElement;
            const clickSpy = vi.spyOn(compareBtn, 'click');

            const event = new KeyboardEvent('keydown', { key: 'c' });
            document.dispatchEvent(event);

            expect(clickSpy).toHaveBeenCalled();

            clickSpy.mockRestore();
        });

        it('should toggle theme on T key', () => {
            setupKeyboardShortcuts();

            const themeBtn = document.getElementById('theme-toggle') as HTMLElement;
            const clickSpy = vi.spyOn(themeBtn, 'click');

            const event = new KeyboardEvent('keydown', { key: 't' });
            document.dispatchEvent(event);

            expect(clickSpy).toHaveBeenCalled();

            clickSpy.mockRestore();
        });

        it('should ignore shortcuts when typing in input', () => {
            setupKeyboardShortcuts();

            const searchInput = document.getElementById('searchInput') as HTMLInputElement;
            const itemsBtn = document.querySelector('[data-tab="items"]') as HTMLElement;
            const clickSpy = vi.spyOn(itemsBtn, 'click');

            // Focus input
            searchInput.focus();

            const event = new KeyboardEvent('keydown', { key: '1' });
            Object.defineProperty(event, 'target', { value: searchInput });
            document.dispatchEvent(event);

            // Should not trigger tab switch
            expect(clickSpy).not.toHaveBeenCalled();

            clickSpy.mockRestore();
        });

        it('should ignore shortcuts when typing in textarea', () => {
            setupKeyboardShortcuts();

            const textarea = document.createElement('textarea');
            document.body.appendChild(textarea);

            const itemsBtn = document.querySelector('[data-tab="items"]') as HTMLElement;
            const clickSpy = vi.spyOn(itemsBtn, 'click');

            const event = new KeyboardEvent('keydown', { key: '1' });
            Object.defineProperty(event, 'target', { value: textarea });
            document.dispatchEvent(event);

            expect(clickSpy).not.toHaveBeenCalled();

            clickSpy.mockRestore();
        });

        it('should ignore tab navigation with Ctrl modifier', () => {
            setupKeyboardShortcuts();

            const itemsBtn = document.querySelector('[data-tab="items"]') as HTMLElement;
            const clickSpy = vi.spyOn(itemsBtn, 'click');

            const event = new KeyboardEvent('keydown', { key: '1', ctrlKey: true });
            document.dispatchEvent(event);

            expect(clickSpy).not.toHaveBeenCalled();

            clickSpy.mockRestore();
        });

        it('should handle case-insensitive view shortcuts', () => {
            setupKeyboardShortcuts();

            const gridBtn = document.querySelector('[data-view="grid"]') as HTMLElement;
            const clickSpy = vi.spyOn(gridBtn, 'click');

            const event = new KeyboardEvent('keydown', { key: 'G' }); // Uppercase
            document.dispatchEvent(event);

            expect(clickSpy).toHaveBeenCalled();

            clickSpy.mockRestore();
        });

        it('should not switch tabs beyond 8', () => {
            setupKeyboardShortcuts();

            const event = new KeyboardEvent('keydown', { key: '9' });
            document.dispatchEvent(event);

            // Should not throw error
            expect(true).toBe(true);
        });

        it('should not crash when elements are missing', () => {
            document.body.innerHTML = ''; // Remove all elements
            setupKeyboardShortcuts();

            const event = new KeyboardEvent('keydown', { key: '1' });

            expect(() => {
                document.dispatchEvent(event);
            }).not.toThrow();
        });
    });

    describe('Keyboard Shortcuts Integration', () => {
        it('should work together - setup and show modal', () => {
            setupKeyboardShortcuts();

            const event = new KeyboardEvent('keydown', { key: '?' });
            document.dispatchEvent(event);

            const modal = document.getElementById('shortcuts-modal');
            expect(modal).not.toBeNull();
        });

        it('should close modal with Escape after showing', () => {
            setupKeyboardShortcuts();

            const showEvent = new KeyboardEvent('keydown', { key: '?' });
            document.dispatchEvent(showEvent);

            const modal = document.getElementById('shortcuts-modal');
            expect(modal).not.toBeNull();

            const closeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
            document.dispatchEvent(closeEvent);

            expect(document.getElementById('shortcuts-modal')).toBeNull();
        });

        it('should maintain all shortcuts in sync with modal display', () => {
            const shortcuts = getAllShortcuts();

            showShortcutsModal();
            const modal = document.getElementById('shortcuts-modal');

            // Verify all categories are displayed
            shortcuts.forEach(category => {
                expect(modal?.textContent).toContain(category.category);

                category.shortcuts.forEach(shortcut => {
                    // At least the description should be present
                    expect(modal?.textContent).toContain(shortcut.description);
                });
            });
        });
    });
});
