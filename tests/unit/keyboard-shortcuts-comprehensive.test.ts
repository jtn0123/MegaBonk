/**
 * @vitest-environment jsdom
 * Keyboard Shortcuts Module - Comprehensive Coverage Tests
 * Target: >60% coverage for keyboard-shortcuts.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';
import {
    setupKeyboardShortcuts,
    cleanupKeyboardShortcuts,
    showShortcutsModal,
    getAllShortcuts,
} from '../../src/modules/keyboard-shortcuts.ts';

describe('Keyboard Shortcuts Module - Comprehensive Coverage', () => {
    beforeEach(() => {
        createMinimalDOM();
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanupKeyboardShortcuts();
        // Clean up any modals
        const modal = document.getElementById('shortcuts-modal');
        if (modal) modal.remove();
    });

    // ========================================
    // getAllShortcuts Tests
    // ========================================
    describe('getAllShortcuts', () => {
        it('should return all shortcut categories', () => {
            const shortcuts = getAllShortcuts();

            expect(Array.isArray(shortcuts)).toBe(true);
            expect(shortcuts.length).toBe(5); // Navigation, Search & Filter, View, Modal, Help
        });

        it('should include Navigation category with 8 tab shortcuts', () => {
            const shortcuts = getAllShortcuts();
            const navigation = shortcuts.find(cat => cat.category === 'Navigation');

            expect(navigation).toBeDefined();
            expect(navigation!.shortcuts.length).toBe(8);
            expect(navigation!.shortcuts[0].keys).toContain('1');
            expect(navigation!.shortcuts[0].description).toContain('Items');
        });

        it('should include Search & Filter category', () => {
            const shortcuts = getAllShortcuts();
            const searchFilter = shortcuts.find(cat => cat.category === 'Search & Filter');

            expect(searchFilter).toBeDefined();
            expect(searchFilter!.shortcuts.some(s => s.keys.includes('/'))).toBe(true);
            expect(searchFilter!.shortcuts.some(s => s.description.includes('Focus search'))).toBe(true);
        });

        it('should include View category with view toggles', () => {
            const shortcuts = getAllShortcuts();
            const view = shortcuts.find(cat => cat.category === 'View');

            expect(view).toBeDefined();
            expect(view!.shortcuts.some(s => s.keys.includes('G'))).toBe(true);
            expect(view!.shortcuts.some(s => s.keys.includes('L'))).toBe(true);
            expect(view!.shortcuts.some(s => s.keys.includes('C'))).toBe(true);
            expect(view!.shortcuts.some(s => s.keys.includes('T'))).toBe(true);
        });

        it('should include Modal category', () => {
            const shortcuts = getAllShortcuts();
            const modal = shortcuts.find(cat => cat.category === 'Modal');

            expect(modal).toBeDefined();
            expect(modal!.shortcuts.some(s => s.keys.includes('Escape'))).toBe(true);
            expect(modal!.shortcuts.some(s => s.keys.includes('Enter'))).toBe(true);
        });

        it('should include Help category', () => {
            const shortcuts = getAllShortcuts();
            const help = shortcuts.find(cat => cat.category === 'Help');

            expect(help).toBeDefined();
            expect(help!.shortcuts.some(s => s.keys.includes('?'))).toBe(true);
        });

        it('should have valid shortcut structure for all shortcuts', () => {
            const shortcuts = getAllShortcuts();

            shortcuts.forEach(category => {
                expect(typeof category.category).toBe('string');
                expect(Array.isArray(category.shortcuts)).toBe(true);

                category.shortcuts.forEach(shortcut => {
                    expect(Array.isArray(shortcut.keys)).toBe(true);
                    expect(shortcut.keys.length).toBeGreaterThan(0);
                    expect(typeof shortcut.description).toBe('string');
                    expect(shortcut.description.length).toBeGreaterThan(0);
                });
            });
        });

        it('should be frozen (immutable)', () => {
            const shortcuts = getAllShortcuts();
            expect(Object.isFrozen(shortcuts)).toBe(true);
        });

        it('should return consistent results on multiple calls', () => {
            const shortcuts1 = getAllShortcuts();
            const shortcuts2 = getAllShortcuts();

            expect(shortcuts1).toBe(shortcuts2);
        });
    });

    // ========================================
    // showShortcutsModal Tests
    // ========================================
    describe('showShortcutsModal', () => {
        afterEach(() => {
            const modal = document.getElementById('shortcuts-modal');
            if (modal) modal.remove();
        });

        it('should create modal with correct id', () => {
            showShortcutsModal();
            
            const modal = document.getElementById('shortcuts-modal');
            expect(modal).not.toBeNull();
        });

        it('should have modal and shortcuts-modal classes', () => {
            showShortcutsModal();
            
            const modal = document.getElementById('shortcuts-modal');
            expect(modal?.classList.contains('modal')).toBe(true);
            expect(modal?.classList.contains('shortcuts-modal')).toBe(true);
        });

        it('should toggle (remove) modal when called twice', () => {
            showShortcutsModal();
            expect(document.getElementById('shortcuts-modal')).not.toBeNull();

            showShortcutsModal();
            expect(document.getElementById('shortcuts-modal')).toBeNull();
        });

        it('should include modal header with keyboard icon and title', () => {
            showShortcutsModal();
            
            const header = document.querySelector('.modal-header');
            expect(header).not.toBeNull();
            expect(header?.textContent).toContain('Keyboard Shortcuts');
            expect(header?.textContent).toContain('⌨️');
        });

        it('should include subtitle in header', () => {
            showShortcutsModal();
            
            const subtitle = document.querySelector('.modal-subtitle');
            expect(subtitle).not.toBeNull();
            expect(subtitle?.textContent).toContain('Navigate faster');
        });

        it('should include close button', () => {
            showShortcutsModal();
            
            const closeBtn = document.getElementById('shortcuts-modal-close');
            expect(closeBtn).not.toBeNull();
            expect(closeBtn?.textContent).toBe('×');
        });

        it('should include all shortcut categories', () => {
            showShortcutsModal();
            
            const categories = document.querySelectorAll('.shortcuts-category');
            expect(categories.length).toBe(getAllShortcuts().length);
        });

        it('should display category titles', () => {
            showShortcutsModal();
            
            const titles = document.querySelectorAll('.shortcuts-category-title');
            const titleTexts = Array.from(titles).map(t => t.textContent);

            expect(titleTexts).toContain('Navigation');
            expect(titleTexts).toContain('Search & Filter');
            expect(titleTexts).toContain('View');
            expect(titleTexts).toContain('Modal');
            expect(titleTexts).toContain('Help');
        });

        it('should display shortcut keys in kbd elements', () => {
            showShortcutsModal();
            
            const kbdElements = document.querySelectorAll('kbd.shortcut-key');
            expect(kbdElements.length).toBeGreaterThan(0);

            const keyTexts = Array.from(kbdElements).map(k => k.textContent);
            expect(keyTexts).toContain('1');
            expect(keyTexts).toContain('/');
            expect(keyTexts).toContain('Escape');
            expect(keyTexts).toContain('?');
        });

        it('should display shortcut descriptions', () => {
            showShortcutsModal();
            
            const descriptions = document.querySelectorAll('.shortcut-description');
            expect(descriptions.length).toBeGreaterThan(0);

            const descTexts = Array.from(descriptions).map(d => d.textContent);
            expect(descTexts.some(d => d?.includes('Items tab'))).toBe(true);
            expect(descTexts.some(d => d?.includes('search'))).toBe(true);
        });

        it('should display key separators for multi-key shortcuts', () => {
            showShortcutsModal();
            
            const separators = document.querySelectorAll('.key-separator');
            expect(separators.length).toBeGreaterThan(0);
            expect(separators[0].textContent).toBe('+');
        });

        it('should include footer with tip', () => {
            showShortcutsModal();
            
            const footer = document.querySelector('.modal-footer');
            expect(footer).not.toBeNull();

            const tip = document.querySelector('.shortcuts-tip');
            expect(tip).not.toBeNull();
            expect(tip?.textContent).toContain('💡');
            expect(tip?.textContent).toContain('?');
        });

        it('should close modal when close button is clicked', () => {
            showShortcutsModal();
            
            const closeBtn = document.getElementById('shortcuts-modal-close');
            closeBtn?.click();

            expect(document.getElementById('shortcuts-modal')).toBeNull();
        });

        it('should close modal when backdrop is clicked', () => {
            showShortcutsModal();
            
            const modal = document.getElementById('shortcuts-modal');
            const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
            Object.defineProperty(clickEvent, 'target', { value: modal });
            modal?.dispatchEvent(clickEvent);

            expect(document.getElementById('shortcuts-modal')).toBeNull();
        });

        it('should not close modal when modal content is clicked', () => {
            showShortcutsModal();
            
            const content = document.querySelector('.shortcuts-modal-content');
            const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
            Object.defineProperty(clickEvent, 'target', { value: content });
            content?.dispatchEvent(clickEvent);

            expect(document.getElementById('shortcuts-modal')).not.toBeNull();
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

        it('should add show class on next animation frame', async () => {
            showShortcutsModal();
            
            // Wait for requestAnimationFrame
            await new Promise(resolve => requestAnimationFrame(resolve));
            
            const modal = document.getElementById('shortcuts-modal');
            expect(modal?.classList.contains('show')).toBe(true);
        });
    });

    // ========================================
    // setupKeyboardShortcuts Tests
    // ========================================
    describe('setupKeyboardShortcuts', () => {
        beforeEach(() => {
            setupKeyboardShortcuts();
        });

        describe('input field exclusion', () => {
            it('should ignore shortcuts when focused on input', () => {
                const searchInput = document.getElementById('searchInput') as HTMLInputElement;
                searchInput.focus();

                const tabBtn = document.querySelector('[data-tab="items"]') as HTMLElement;
                const clickSpy = vi.spyOn(tabBtn, 'click');

                const event = new KeyboardEvent('keydown', { key: '1', bubbles: true });
                searchInput.dispatchEvent(event);

                expect(clickSpy).not.toHaveBeenCalled();
            });

            it('should ignore shortcuts when focused on textarea', () => {
                const textarea = document.createElement('textarea');
                document.body.appendChild(textarea);
                textarea.focus();

                const event = new KeyboardEvent('keydown', { key: 'g', bubbles: true });
                textarea.dispatchEvent(event);

                textarea.remove();
            });

            it('should ignore shortcuts when focused on select', () => {
                const select = document.createElement('select');
                document.body.appendChild(select);
                select.focus();

                const tabBtn = document.querySelector('[data-tab="items"]') as HTMLElement;
                const clickSpy = vi.spyOn(tabBtn, 'click');

                const event = new KeyboardEvent('keydown', { key: '1', bubbles: true });
                select.dispatchEvent(event);

                expect(clickSpy).not.toHaveBeenCalled();
                select.remove();
            });
        });

        describe('tab navigation (1-9)', () => {
            it('should switch to items tab on key 1', () => {
                const tabBtn = document.querySelector('[data-tab="items"]') as HTMLElement;
                const clickSpy = vi.spyOn(tabBtn, 'click');

                document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));

                expect(clickSpy).toHaveBeenCalled();
            });

            it('should switch to weapons tab on key 2', () => {
                const tabBtn = document.querySelector('[data-tab="weapons"]') as HTMLElement;
                const clickSpy = vi.spyOn(tabBtn, 'click');

                document.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }));

                expect(clickSpy).toHaveBeenCalled();
            });

            it('should switch to tomes tab on key 3', () => {
                const tabBtn = document.querySelector('[data-tab="tomes"]') as HTMLElement;
                const clickSpy = vi.spyOn(tabBtn, 'click');

                document.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true }));

                expect(clickSpy).toHaveBeenCalled();
            });

            it('should switch to characters tab on key 4', () => {
                const tabBtn = document.querySelector('[data-tab="characters"]') as HTMLElement;
                const clickSpy = vi.spyOn(tabBtn, 'click');

                document.dispatchEvent(new KeyboardEvent('keydown', { key: '4', bubbles: true }));

                expect(clickSpy).toHaveBeenCalled();
            });

            it('should switch to shrines tab on key 5', () => {
                const tabBtn = document.querySelector('[data-tab="shrines"]') as HTMLElement;
                const clickSpy = vi.spyOn(tabBtn, 'click');

                document.dispatchEvent(new KeyboardEvent('keydown', { key: '5', bubbles: true }));

                expect(clickSpy).toHaveBeenCalled();
            });

            it('should switch to build-planner tab on key 6', () => {
                const tabBtn = document.querySelector('[data-tab="build-planner"]') as HTMLElement;
                const clickSpy = vi.spyOn(tabBtn, 'click');

                document.dispatchEvent(new KeyboardEvent('keydown', { key: '6', bubbles: true }));

                expect(clickSpy).toHaveBeenCalled();
            });

            it('should switch to calculator tab on key 7', () => {
                const tabBtn = document.querySelector('[data-tab="calculator"]') as HTMLElement;
                const clickSpy = vi.spyOn(tabBtn, 'click');

                document.dispatchEvent(new KeyboardEvent('keydown', { key: '7', bubbles: true }));

                expect(clickSpy).toHaveBeenCalled();
            });

            it('should handle key 8 for advisor tab', () => {
                // Add advisor tab button if not present
                const existingBtn = document.querySelector('[data-tab="advisor"]');
                if (!existingBtn) {
                    const advisorBtn = document.createElement('button');
                    advisorBtn.className = 'tab-btn';
                    advisorBtn.setAttribute('data-tab', 'advisor');
                    document.querySelector('.tab-buttons')?.appendChild(advisorBtn);
                }

                const tabBtn = document.querySelector('[data-tab="advisor"]') as HTMLElement;
                const clickSpy = vi.spyOn(tabBtn, 'click');

                document.dispatchEvent(new KeyboardEvent('keydown', { key: '8', bubbles: true }));

                expect(clickSpy).toHaveBeenCalled();
            });

            it('should handle key 9 for changelog tab', () => {
                // Add changelog tab button if not present
                const existingBtn = document.querySelector('[data-tab="changelog"]');
                if (!existingBtn) {
                    const changelogBtn = document.createElement('button');
                    changelogBtn.className = 'tab-btn';
                    changelogBtn.setAttribute('data-tab', 'changelog');
                    document.querySelector('.tab-buttons')?.appendChild(changelogBtn);
                }

                const tabBtn = document.querySelector('[data-tab="changelog"]') as HTMLElement;
                const clickSpy = vi.spyOn(tabBtn, 'click');

                document.dispatchEvent(new KeyboardEvent('keydown', { key: '9', bubbles: true }));

                expect(clickSpy).toHaveBeenCalled();
            });

            it('should not trigger tab switch with Ctrl modifier', () => {
                const tabBtn = document.querySelector('[data-tab="items"]') as HTMLElement;
                const clickSpy = vi.spyOn(tabBtn, 'click');

                document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', ctrlKey: true, bubbles: true }));

                expect(clickSpy).not.toHaveBeenCalled();
            });

            it('should not trigger tab switch with Meta modifier', () => {
                const tabBtn = document.querySelector('[data-tab="items"]') as HTMLElement;
                const clickSpy = vi.spyOn(tabBtn, 'click');

                document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', metaKey: true, bubbles: true }));

                expect(clickSpy).not.toHaveBeenCalled();
            });
        });

        describe('search focus', () => {
            it('should focus search on / key', () => {
                const searchInput = document.getElementById('searchInput') as HTMLInputElement;
                const focusSpy = vi.spyOn(searchInput, 'focus');

                document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));

                expect(focusSpy).toHaveBeenCalled();
            });

            it('should focus search on Ctrl+F', () => {
                const searchInput = document.getElementById('searchInput') as HTMLInputElement;
                const focusSpy = vi.spyOn(searchInput, 'focus');

                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true }));

                expect(focusSpy).toHaveBeenCalled();
            });

            it('should select search text when focusing', () => {
                const searchInput = document.getElementById('searchInput') as HTMLInputElement;
                searchInput.value = 'existing query';
                const selectSpy = vi.spyOn(searchInput, 'select');

                document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));

                expect(selectSpy).toHaveBeenCalled();
            });
        });

        describe('clear filters (Ctrl+K)', () => {
            it('should click clear filters button on Ctrl+K', () => {
                const clearBtn = document.createElement('button');
                clearBtn.setAttribute('onclick', 'clearFilters()');
                document.body.appendChild(clearBtn);

                const clickSpy = vi.spyOn(clearBtn, 'click');

                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));

                expect(clickSpy).toHaveBeenCalled();
                clearBtn.remove();
            });
        });

        describe('Escape key', () => {
            it('should clear search input and blur on Escape', () => {
                const searchInput = document.getElementById('searchInput') as HTMLInputElement;
                searchInput.value = 'test query';
                searchInput.focus();

                const blurSpy = vi.spyOn(searchInput, 'blur');

                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

                expect(searchInput.value).toBe('');
                expect(blurSpy).toHaveBeenCalled();
            });

            it('should dispatch input event when clearing search', () => {
                const searchInput = document.getElementById('searchInput') as HTMLInputElement;
                searchInput.value = 'test';

                let inputEventFired = false;
                searchInput.addEventListener('input', () => {
                    inputEventFired = true;
                });

                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

                expect(inputEventFired).toBe(true);
            });

            it('should not act if search input is already empty', () => {
                const searchInput = document.getElementById('searchInput') as HTMLInputElement;
                searchInput.value = '';

                const blurSpy = vi.spyOn(searchInput, 'blur');

                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

                expect(blurSpy).not.toHaveBeenCalled();
            });
        });

        describe('view toggles', () => {
            beforeEach(() => {
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

            it('should toggle grid view on lowercase g key', () => {
                const gridBtn = document.querySelector('[data-view="grid"]') as HTMLElement;
                const clickSpy = vi.spyOn(gridBtn, 'click');

                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }));

                expect(clickSpy).toHaveBeenCalled();
            });

            it('should toggle grid view on uppercase G key', () => {
                const gridBtn = document.querySelector('[data-view="grid"]') as HTMLElement;
                const clickSpy = vi.spyOn(gridBtn, 'click');

                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'G', bubbles: true }));

                expect(clickSpy).toHaveBeenCalled();
            });

            it('should toggle list view on lowercase l key', () => {
                const listBtn = document.querySelector('[data-view="list"]') as HTMLElement;
                const clickSpy = vi.spyOn(listBtn, 'click');

                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', bubbles: true }));

                expect(clickSpy).toHaveBeenCalled();
            });

            it('should toggle list view on uppercase L key', () => {
                const listBtn = document.querySelector('[data-view="list"]') as HTMLElement;
                const clickSpy = vi.spyOn(listBtn, 'click');

                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'L', bubbles: true }));

                expect(clickSpy).toHaveBeenCalled();
            });

            it('should toggle compare mode on lowercase c key', () => {
                const compareBtn = document.getElementById('compare-mode-toggle') as HTMLElement;
                const clickSpy = vi.spyOn(compareBtn, 'click');

                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));

                expect(clickSpy).toHaveBeenCalled();
            });

            it('should toggle compare mode on uppercase C key', () => {
                const compareBtn = document.getElementById('compare-mode-toggle') as HTMLElement;
                const clickSpy = vi.spyOn(compareBtn, 'click');

                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'C', bubbles: true }));

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

            it('should toggle theme on lowercase t key', () => {
                const themeBtn = document.getElementById('theme-toggle') as HTMLElement;
                const clickSpy = vi.spyOn(themeBtn, 'click');

                document.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));

                expect(clickSpy).toHaveBeenCalled();
            });

            it('should toggle theme on uppercase T key', () => {
                const themeBtn = document.getElementById('theme-toggle') as HTMLElement;
                const clickSpy = vi.spyOn(themeBtn, 'click');

                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'T', bubbles: true }));

                expect(clickSpy).toHaveBeenCalled();
            });
        });

        describe('help modal', () => {
            afterEach(() => {
                const modal = document.getElementById('shortcuts-modal');
                if (modal) modal.remove();
            });

            it('should show shortcuts modal on ? key', () => {
                document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));

                expect(document.getElementById('shortcuts-modal')).not.toBeNull();
            });

            it('should show shortcuts modal on Shift+?', () => {
                document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true, bubbles: true }));

                expect(document.getElementById('shortcuts-modal')).not.toBeNull();
            });
        });

        describe('prevent default behavior', () => {
            it('should prevent default on / key', () => {
                const event = new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true });
                const preventSpy = vi.spyOn(event, 'preventDefault');

                document.dispatchEvent(event);

                expect(preventSpy).toHaveBeenCalled();
            });

            it('should prevent default on number keys', () => {
                const event = new KeyboardEvent('keydown', { key: '1', bubbles: true, cancelable: true });
                const preventSpy = vi.spyOn(event, 'preventDefault');

                document.dispatchEvent(event);

                expect(preventSpy).toHaveBeenCalled();
            });

            it('should prevent default on ? key', () => {
                const event = new KeyboardEvent('keydown', { key: '?', bubbles: true, cancelable: true });
                const preventSpy = vi.spyOn(event, 'preventDefault');

                document.dispatchEvent(event);

                expect(preventSpy).toHaveBeenCalled();
            });
        });
    });

    // ========================================
    // cleanupKeyboardShortcuts Tests
    // ========================================
    describe('cleanupKeyboardShortcuts', () => {
        it('should remove keydown event listener', () => {
            setupKeyboardShortcuts();

            const tabBtn = document.querySelector('[data-tab="items"]') as HTMLElement;
            const clickSpy = vi.spyOn(tabBtn, 'click');

            // Verify handler is active
            document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
            expect(clickSpy).toHaveBeenCalledTimes(1);

            // Clean up
            cleanupKeyboardShortcuts();

            // Handler should not fire
            document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
            expect(clickSpy).toHaveBeenCalledTimes(1);
        });

        it('should be safe to call multiple times', () => {
            setupKeyboardShortcuts();

            expect(() => {
                cleanupKeyboardShortcuts();
                cleanupKeyboardShortcuts();
                cleanupKeyboardShortcuts();
            }).not.toThrow();
        });

        it('should be safe to call before setup', () => {
            expect(() => cleanupKeyboardShortcuts()).not.toThrow();
        });

        it('should allow re-setup after cleanup', () => {
            setupKeyboardShortcuts();
            cleanupKeyboardShortcuts();
            setupKeyboardShortcuts();

            const tabBtn = document.querySelector('[data-tab="items"]') as HTMLElement;
            const clickSpy = vi.spyOn(tabBtn, 'click');

            document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));

            expect(clickSpy).toHaveBeenCalled();
        });
    });

    // ========================================
    // Multiple setup calls
    // ========================================
    describe('Multiple setup calls', () => {
        it('should not stack handlers when called multiple times', () => {
            setupKeyboardShortcuts();
            setupKeyboardShortcuts();
            setupKeyboardShortcuts();

            const tabBtn = document.querySelector('[data-tab="items"]') as HTMLElement;
            const clickSpy = vi.spyOn(tabBtn, 'click');

            document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));

            expect(clickSpy).toHaveBeenCalledTimes(1);
        });
    });

    // ========================================
    // Edge Cases
    // ========================================
    describe('Edge Cases', () => {
        beforeEach(() => {
            setupKeyboardShortcuts();
        });

        it('should handle missing search input gracefully', () => {
            const searchInput = document.getElementById('searchInput');
            searchInput?.remove();

            expect(() => {
                document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
            }).not.toThrow();
        });

        it('should handle missing tab button gracefully', () => {
            const tabBtn = document.querySelector('[data-tab="items"]');
            tabBtn?.remove();

            expect(() => {
                document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
            }).not.toThrow();
        });

        it('should handle missing theme button gracefully', () => {
            expect(() => {
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
            }).not.toThrow();
        });

        it('should handle missing grid button gracefully', () => {
            expect(() => {
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }));
            }).not.toThrow();
        });

        it('should handle missing list button gracefully', () => {
            expect(() => {
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', bubbles: true }));
            }).not.toThrow();
        });

        it('should handle missing compare button gracefully', () => {
            expect(() => {
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));
            }).not.toThrow();
        });

        it('should handle missing clear filters button gracefully', () => {
            expect(() => {
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
            }).not.toThrow();
        });

        it('should handle target without matches method', () => {
            // Create a mock event with a target that doesn't have matches
            const event = new KeyboardEvent('keydown', { key: '1', bubbles: true });
            
            // This tests the null check for target and target.matches
            expect(() => document.dispatchEvent(event)).not.toThrow();
        });
    });
});
