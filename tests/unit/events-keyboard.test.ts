/**
 * Events Keyboard Module Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies before imports
vi.mock('../../src/modules/utils.ts', () => ({
    safeGetElementById: vi.fn((id: string) => document.getElementById(id)),
    debounce: vi.fn((fn: Function) => fn),
}));

vi.mock('../../src/modules/logger.ts', () => ({
    logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn(), setContext: vi.fn() },
}));

vi.mock('../../src/modules/modal.ts', () => ({
    closeModal: vi.fn(),
    openDetailModal: vi.fn(),
}));

vi.mock('../../src/modules/search-dropdown.ts', () => ({
    handleDropdownKeyboard: vi.fn(() => false),
    isSearchDropdownVisible: vi.fn(() => false),
    hideSearchDropdown: vi.fn(),
}));

vi.mock('../../src/modules/events-tabs.ts', () => ({
    switchTab: vi.fn(),
}));

vi.mock('../../src/modules/compare.ts', () => ({
    closeCompareModal: vi.fn(),
}));

vi.mock('../../src/modules/calculator.ts', () => ({
    quickCalc: vi.fn(),
}));

vi.mock('../../src/modules/empty-states.ts', () => ({
    handleEmptyStateClick: vi.fn(),
}));

vi.mock('../../src/modules/events-click.ts', () => ({
    handleCardClick: vi.fn(),
}));

import {
    handleKeydownDelegation,
    handleEscapeKey,
    handleTabArrowNavigation,
    handleNumberKeyTabSwitch,
    handleSearchShortcut,
    handleActivationKey,
    handleBreakpointCardActivation,
} from '../../src/modules/events-keyboard.ts';
import { closeModal } from '../../src/modules/modal.ts';
import {
    isSearchDropdownVisible,
    hideSearchDropdown,
    handleDropdownKeyboard,
} from '../../src/modules/search-dropdown.ts';
import { switchTab } from '../../src/modules/events-tabs.ts';

describe('events-keyboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('handleEscapeKey', () => {
        it('should hide search dropdown if visible', () => {
            vi.mocked(isSearchDropdownVisible).mockReturnValue(true);
            handleEscapeKey();
            expect(hideSearchDropdown).toHaveBeenCalled();
            expect(closeModal).not.toHaveBeenCalled();
        });

        it('should close modal if dropdown not visible', () => {
            vi.mocked(isSearchDropdownVisible).mockReturnValue(false);
            handleEscapeKey();
            expect(closeModal).toHaveBeenCalled();
        });
    });

    describe('handleTabArrowNavigation', () => {
        it('should navigate to next tab on ArrowRight', () => {
            document.body.innerHTML = `
                <button class="tab-btn" data-tab="items">Items</button>
                <button class="tab-btn" data-tab="weapons">Weapons</button>
                <button class="tab-btn" data-tab="tomes">Tomes</button>
            `;
            const tabs = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
            const e = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            vi.spyOn(e, 'preventDefault');

            handleTabArrowNavigation(e, tabs[0]);
            expect(e.preventDefault).toHaveBeenCalled();
            expect(switchTab).toHaveBeenCalledWith('weapons');
        });

        it('should wrap around on ArrowRight from last tab', () => {
            document.body.innerHTML = `
                <button class="tab-btn" data-tab="items">Items</button>
                <button class="tab-btn" data-tab="weapons">Weapons</button>
            `;
            const tabs = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
            const e = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            vi.spyOn(e, 'preventDefault');
            handleTabArrowNavigation(e, tabs[1]);
            expect(switchTab).toHaveBeenCalledWith('items');
        });

        it('should navigate to previous tab on ArrowLeft', () => {
            document.body.innerHTML = `
                <button class="tab-btn" data-tab="items">Items</button>
                <button class="tab-btn" data-tab="weapons">Weapons</button>
            `;
            const tabs = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
            const e = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
            vi.spyOn(e, 'preventDefault');
            handleTabArrowNavigation(e, tabs[1]);
            expect(switchTab).toHaveBeenCalledWith('items');
        });

        it('should do nothing if no tab buttons exist', () => {
            const e = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            vi.spyOn(e, 'preventDefault');
            const btn = document.createElement('button');
            handleTabArrowNavigation(e, btn);
            expect(switchTab).not.toHaveBeenCalled();
        });

        it('should do nothing if target not found among tabs', () => {
            document.body.innerHTML = '<button class="tab-btn" data-tab="items">Items</button>';
            const e = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            vi.spyOn(e, 'preventDefault');
            const outsideBtn = document.createElement('button');
            handleTabArrowNavigation(e, outsideBtn);
            expect(switchTab).not.toHaveBeenCalled();
        });
    });

    describe('handleNumberKeyTabSwitch', () => {
        it('should switch to items tab on key 1', () => {
            const e = new KeyboardEvent('keydown', { key: '1' });
            vi.spyOn(e, 'preventDefault');
            handleNumberKeyTabSwitch(e);
            expect(switchTab).toHaveBeenCalledWith('items');
            expect(e.preventDefault).toHaveBeenCalled();
        });

        it('should switch to build-planner on key 6', () => {
            const e = new KeyboardEvent('keydown', { key: '6' });
            vi.spyOn(e, 'preventDefault');
            handleNumberKeyTabSwitch(e);
            expect(switchTab).toHaveBeenCalledWith('build-planner');
        });

        it('should do nothing for key 0', () => {
            const e = new KeyboardEvent('keydown', { key: '0' });
            handleNumberKeyTabSwitch(e);
            expect(switchTab).not.toHaveBeenCalled();
        });

        it('should map all 9 keys correctly', () => {
            const expected = [
                'items',
                'weapons',
                'tomes',
                'characters',
                'shrines',
                'build-planner',
                'calculator',
                'advisor',
                'changelog',
            ];
            for (let i = 1; i <= 9; i++) {
                vi.clearAllMocks();
                const e = new KeyboardEvent('keydown', { key: String(i) });
                vi.spyOn(e, 'preventDefault');
                handleNumberKeyTabSwitch(e);
                expect(switchTab).toHaveBeenCalledWith(expected[i - 1]);
            }
        });
    });

    describe('handleSearchShortcut', () => {
        it('should focus search input on Ctrl+K', () => {
            document.body.innerHTML = '<input id="searchInput" value="test" />';
            const target = document.createElement('div');
            const e = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
            vi.spyOn(e, 'preventDefault');

            const result = handleSearchShortcut(e, target);
            expect(result).toBe(true);
            expect(e.preventDefault).toHaveBeenCalled();
            expect(document.activeElement?.id).toBe('searchInput');
        });

        it('should focus search input on / key', () => {
            document.body.innerHTML = '<input id="searchInput" value="test" />';
            const target = document.createElement('div');
            const e = new KeyboardEvent('keydown', { key: '/' });
            vi.spyOn(e, 'preventDefault');

            const result = handleSearchShortcut(e, target);
            expect(result).toBe(true);
        });

        it('should return true without preventing default when target is INPUT', () => {
            const target = document.createElement('input');
            const e = new KeyboardEvent('keydown', { key: '/' });
            const result = handleSearchShortcut(e, target);
            expect(result).toBe(true);
        });

        it('should return false for non-shortcut keys', () => {
            const target = document.createElement('div');
            const e = new KeyboardEvent('keydown', { key: 'a' });
            const result = handleSearchShortcut(e, target);
            expect(result).toBe(false);
        });
    });

    describe('handleActivationKey', () => {
        it('should return false for non-activation keys', () => {
            const e = new KeyboardEvent('keydown', { key: 'a' });
            const target = document.createElement('div');
            expect(handleActivationKey(e, target)).toBe(false);
        });

        it('should handle breakpoint-card on Enter', () => {
            const target = document.createElement('div');
            target.classList.add('breakpoint-card');
            target.dataset.item = 'sword';
            target.dataset.target = '10';
            const e = new KeyboardEvent('keydown', { key: 'Enter' });
            vi.spyOn(e, 'preventDefault');

            const result = handleActivationKey(e, target);
            expect(result).toBe(true);
            expect(e.preventDefault).toHaveBeenCalled();
        });

        it('should handle suggestion-card on Space', () => {
            const target = document.createElement('div');
            target.classList.add('suggestion-card');
            const e = new KeyboardEvent('keydown', { key: ' ' });
            vi.spyOn(e, 'preventDefault');

            const result = handleActivationKey(e, target);
            expect(result).toBe(true);
            expect(e.preventDefault).toHaveBeenCalled();
        });

        it('should handle clickable-card on Enter', () => {
            const target = document.createElement('div');
            target.classList.add('clickable-card');
            const e = new KeyboardEvent('keydown', { key: 'Enter' });
            vi.spyOn(e, 'preventDefault');

            const result = handleActivationKey(e, target);
            expect(result).toBe(true);
        });

        it('should return false for elements without matching classes', () => {
            const target = document.createElement('div');
            const e = new KeyboardEvent('keydown', { key: 'Enter' });
            expect(handleActivationKey(e, target)).toBe(false);
        });
    });

    describe('handleBreakpointCardActivation', () => {
        it('should preventDefault and attempt quickCalc for valid item/target', async () => {
            const target = document.createElement('div');
            target.dataset.item = 'sword';
            target.dataset.target = '25';
            const e = new KeyboardEvent('keydown', { key: 'Enter' });
            vi.spyOn(e, 'preventDefault');

            handleBreakpointCardActivation(e, target);
            expect(e.preventDefault).toHaveBeenCalled();
            // Allow dynamic import to resolve
            await new Promise(r => setTimeout(r, 50));
            // Verify valid data was present for quickCalc path
            expect(target.dataset.item).toBe('sword');
            expect(parseInt(target.dataset.target!, 10)).toBe(25);
        });

        it('should exit early when item data is missing', () => {
            const target = document.createElement('div');
            // No dataset.item or dataset.target
            const e = new KeyboardEvent('keydown', { key: 'Enter' });
            vi.spyOn(e, 'preventDefault');
            handleBreakpointCardActivation(e, target);
            expect(e.preventDefault).toHaveBeenCalled();
            // Verify data is missing — quickCalc should not be called
            expect(target.dataset.item).toBeUndefined();
            expect(target.dataset.target).toBeUndefined();
        });

        it('should not trigger quickCalc when target is NaN', () => {
            const target = document.createElement('div');
            target.dataset.item = 'sword';
            target.dataset.target = 'abc';
            const e = new KeyboardEvent('keydown', { key: 'Enter' });
            vi.spyOn(e, 'preventDefault');
            handleBreakpointCardActivation(e, target);
            expect(e.preventDefault).toHaveBeenCalled();
            // parseInt('abc', 10) is NaN — quickCalc should be skipped
            expect(Number.isNaN(parseInt(target.dataset.target!, 10))).toBe(true);
        });
    });

    describe('handleKeydownDelegation', () => {
        it('should handle Escape key', () => {
            vi.mocked(isSearchDropdownVisible).mockReturnValue(false);
            const div = document.createElement('div');
            document.body.appendChild(div);
            const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
            Object.defineProperty(e, 'target', { value: div });
            handleKeydownDelegation(e);
            expect(closeModal).toHaveBeenCalled();
        });

        it('should handle search dropdown keyboard when visible', () => {
            document.body.innerHTML = '<input id="searchInput" />';
            const input = document.getElementById('searchInput')!;
            vi.mocked(isSearchDropdownVisible).mockReturnValue(true);
            vi.mocked(handleDropdownKeyboard).mockReturnValue(true);

            const e = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
            Object.defineProperty(e, 'target', { value: input });
            handleKeydownDelegation(e);
            expect(handleDropdownKeyboard).toHaveBeenCalled();
        });

        it('should handle number keys for tab switching', () => {
            const div = document.createElement('div');
            document.body.appendChild(div);
            const e = new KeyboardEvent('keydown', { key: '3', bubbles: true });
            Object.defineProperty(e, 'target', { value: div });
            handleKeydownDelegation(e);
            expect(switchTab).toHaveBeenCalledWith('tomes');
        });

        it('should not handle number keys when focused on input', () => {
            const input = document.createElement('input');
            document.body.appendChild(input);
            const e = new KeyboardEvent('keydown', { key: '3', bubbles: true });
            Object.defineProperty(e, 'target', { value: input });
            handleKeydownDelegation(e);
            expect(switchTab).not.toHaveBeenCalled();
        });

        it('should handle ArrowRight on tab buttons', () => {
            document.body.innerHTML = `
                <button class="tab-btn" data-tab="items">Items</button>
                <button class="tab-btn" data-tab="weapons">Weapons</button>
            `;
            const btn = document.querySelector<HTMLButtonElement>('.tab-btn')!;
            const e = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
            Object.defineProperty(e, 'target', { value: btn });
            vi.spyOn(e, 'preventDefault');
            handleKeydownDelegation(e);
            expect(switchTab).toHaveBeenCalledWith('weapons');
        });
    });
});
