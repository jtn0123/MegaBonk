/**
 * Events Click Module Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../src/modules/toast.ts', () => ({
    ToastManager: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
    },
}));

vi.mock('../../src/modules/logger.ts', () => ({
    logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn(), setContext: vi.fn() },
}));

vi.mock('../../src/modules/modal.ts', () => ({
    openDetailModal: vi.fn(),
}));

vi.mock('../../src/modules/favorites.ts', () => ({
    toggleFavorite: vi.fn(() => true),
}));

vi.mock('../../src/modules/store.ts', () => ({
    getState: vi.fn(),
    setState: vi.fn(),
    resetStore: vi.fn(),
}));

vi.mock('../../src/types/index.ts', () => ({
    normalizeEntityType: vi.fn((t: string) => t),
}));

vi.mock('../../src/modules/compare.ts', () => ({
    toggleCompareItem: vi.fn(),
    updateCompareDisplay: vi.fn(),
}));

import {
    handleViewDetailsClick,
    handleCardClick,
    handleCompareCheckboxClick,
    handleRemoveCompareClick,
    handleBreakpointCardClick,
    handleFavoriteClick,
} from '../../src/modules/events-click.ts';
import { openDetailModal } from '../../src/modules/modal.ts';
import { toggleFavorite } from '../../src/modules/favorites.ts';
import { ToastManager } from '../../src/modules/toast.ts';

describe('events-click', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('handleViewDetailsClick', () => {
        it('should open detail modal with type and id', () => {
            const btn = document.createElement('button');
            btn.dataset.type = 'items';
            btn.dataset.id = 'sword';
            handleViewDetailsClick(btn);
            expect(openDetailModal).toHaveBeenCalledWith('items', 'sword');
        });

        it('should do nothing without type or id', () => {
            const btn = document.createElement('button');
            handleViewDetailsClick(btn);
            expect(openDetailModal).not.toHaveBeenCalled();
        });

        it('should do nothing with only type', () => {
            const btn = document.createElement('button');
            btn.dataset.type = 'items';
            handleViewDetailsClick(btn);
            expect(openDetailModal).not.toHaveBeenCalled();
        });
    });

    describe('handleCardClick', () => {
        it('should open modal for item card with entity data', () => {
            document.body.innerHTML = `
                <div class="item-card" data-entity-type="items" data-entity-id="sword">
                    <span class="inner">Click me</span>
                </div>
            `;
            const inner = document.querySelector('.inner')!;
            handleCardClick(inner as HTMLElement);
            expect(openDetailModal).toHaveBeenCalledWith('items', 'sword');
        });

        it('should do nothing if no item-card ancestor', () => {
            const div = document.createElement('div');
            handleCardClick(div);
            expect(openDetailModal).not.toHaveBeenCalled();
        });

        it('should do nothing if entity data missing', () => {
            document.body.innerHTML = '<div class="item-card"><span class="inner">X</span></div>';
            const inner = document.querySelector('.inner')!;
            handleCardClick(inner as HTMLElement);
            expect(openDetailModal).not.toHaveBeenCalled();
        });
    });

    describe('handleCompareCheckboxClick', () => {
        it('should toggle checkbox and import compare module', async () => {
            document.body.innerHTML = `
                <label class="compare-checkbox-label">
                    <input type="checkbox" class="compare-checkbox" data-id="item1" value="item1" />
                </label>
            `;
            const label = document.querySelector('.compare-checkbox-label')!;
            const checkbox = document.querySelector<HTMLInputElement>('.compare-checkbox')!;
            const e = new MouseEvent('click');
            vi.spyOn(e, 'preventDefault');

            handleCompareCheckboxClick(e, label);
            expect(e.preventDefault).toHaveBeenCalled();
            expect(checkbox.checked).toBe(true);
        });

        it('should debounce rapid clicks', () => {
            document.body.innerHTML = `
                <label class="compare-checkbox-label">
                    <input type="checkbox" class="compare-checkbox" data-id="item1" value="item1" data-last-toggle="${Date.now()}" />
                </label>
            `;
            const label = document.querySelector('.compare-checkbox-label')!;
            const e = new MouseEvent('click');
            vi.spyOn(e, 'preventDefault');

            handleCompareCheckboxClick(e, label);
            // Should be debounced (within 100ms)
            expect(e.preventDefault).not.toHaveBeenCalled();
        });

        it('should do nothing without checkbox', () => {
            const div = document.createElement('div');
            const e = new MouseEvent('click');
            handleCompareCheckboxClick(e, div);
        });
    });

    describe('handleRemoveCompareClick', () => {
        it('should remove compare item by id', async () => {
            const btn = document.createElement('button');
            btn.classList.add('remove-compare-btn');
            btn.dataset.removeId = 'item1';
            handleRemoveCompareClick(btn);
            // Dynamic import is async
            await vi.dynamicImportSettled?.() || new Promise(r => setTimeout(r, 10));
        });

        it('should find button via closest', async () => {
            document.body.innerHTML = `
                <button class="remove-compare-btn" data-remove-id="item2">
                    <span class="icon">X</span>
                </button>
            `;
            const icon = document.querySelector('.icon')!;
            handleRemoveCompareClick(icon);
            await new Promise(r => setTimeout(r, 10));
        });

        it('should do nothing without remove id', () => {
            const btn = document.createElement('button');
            btn.classList.add('remove-compare-btn');
            handleRemoveCompareClick(btn);
        });
    });

    describe('handleBreakpointCardClick', () => {
        it('should call quickCalc via dynamic import', async () => {
            document.body.innerHTML = `
                <div class="breakpoint-card" data-item="sword" data-target="25">
                    <span>Card</span>
                </div>
            `;
            const span = document.querySelector('span')!;
            handleBreakpointCardClick(span);
            await new Promise(r => setTimeout(r, 10));
        });

        it('should do nothing without card ancestor', () => {
            const div = document.createElement('div');
            handleBreakpointCardClick(div);
        });

        it('should do nothing if target is NaN', () => {
            document.body.innerHTML = `
                <div class="breakpoint-card" data-item="sword" data-target="abc">
                    <span>Card</span>
                </div>
            `;
            const span = document.querySelector('span')!;
            handleBreakpointCardClick(span);
        });
    });

    describe('handleFavoriteClick', () => {
        it('should toggle favorite and update button', () => {
            const btn = document.createElement('button');
            btn.classList.add('favorite-btn');
            btn.dataset.tab = 'items';
            btn.dataset.id = 'sword';
            btn.textContent = '☆';

            handleFavoriteClick(btn);
            expect(toggleFavorite).toHaveBeenCalledWith('items', 'sword');
            expect(btn.classList.contains('favorited')).toBe(true);
            expect(btn.textContent).toBe('⭐');
            expect(btn.title).toBe('Remove from favorites');
            expect(ToastManager.success).toHaveBeenCalledWith('Added to favorites');
        });

        it('should update to unfavorited state', () => {
            vi.mocked(toggleFavorite).mockReturnValue(false);
            const btn = document.createElement('button');
            btn.classList.add('favorite-btn');
            btn.dataset.tab = 'weapons';
            btn.dataset.id = 'katana';
            btn.textContent = '⭐';

            handleFavoriteClick(btn);
            expect(btn.textContent).toBe('☆');
            expect(btn.title).toBe('Add to favorites');
            expect(ToastManager.success).toHaveBeenCalledWith('Removed from favorites');
        });

        it('should find button via closest', () => {
            document.body.innerHTML = `
                <button class="favorite-btn" data-tab="items" data-id="sword">
                    <span class="star">☆</span>
                </button>
            `;
            const star = document.querySelector('.star')!;
            handleFavoriteClick(star);
            expect(toggleFavorite).toHaveBeenCalledWith('items', 'sword');
        });

        it('should do nothing for non-entity tabs', () => {
            const btn = document.createElement('button');
            btn.classList.add('favorite-btn');
            btn.dataset.tab = 'build-planner';
            btn.dataset.id = 'build1';
            handleFavoriteClick(btn);
            expect(toggleFavorite).not.toHaveBeenCalled();
        });

        it('should do nothing without required data', () => {
            const btn = document.createElement('button');
            btn.classList.add('favorite-btn');
            handleFavoriteClick(btn);
            expect(toggleFavorite).not.toHaveBeenCalled();
        });
    });
});
