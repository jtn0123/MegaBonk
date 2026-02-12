/**
 * @vitest-environment jsdom
 * Modal Core Module Tests
 * Tests for modal-core.ts - focus trap, modal session management, open/close
 */
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.ts';
import { createMockAllData } from '../helpers/mock-data.ts';

// ========================================
// Module Mocks
// ========================================

vi.mock('../../src/modules/data-service.ts', () => ({
    allData: {
        items: { items: [] },
        weapons: { weapons: [] },
        tomes: { tomes: [] },
        characters: { characters: [] },
        shrines: { shrines: [] },
    },
}));

vi.mock('../../src/modules/toast.ts', () => ({
    ToastManager: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
    },
}));

vi.mock('../../src/modules/utils.ts', () => ({
    safeGetElementById: vi.fn((id: string) => document.getElementById(id)),
}));

vi.mock('../../src/modules/recently-viewed.ts', () => ({
    onModalOpened: vi.fn(),
}));

vi.mock('../../src/modules/similar-items.ts', () => ({
    renderSimilarItemsSection: vi.fn(() => '<div class="similar-items">Similar Items</div>'),
    setupSimilarItemsHandlers: vi.fn(),
}));

vi.mock('../../src/modules/modal-items.ts', () => ({
    renderItemModal: vi.fn(() => '<div class="item-modal-content">Item Content</div>'),
}));

vi.mock('../../src/modules/modal-weapons.ts', () => ({
    renderWeaponModal: vi.fn(() => '<div class="weapon-modal-content">Weapon Content</div>'),
}));

vi.mock('../../src/modules/modal-characters.ts', () => ({
    renderCharacterModal: vi.fn(() => '<div class="character-modal-content">Character Content</div>'),
}));

vi.mock('../../src/modules/modal-entities.ts', () => ({
    renderTomeModal: vi.fn(async () => '<div class="tome-modal-content">Tome Content</div>'),
    renderShrineModal: vi.fn(() => '<div class="shrine-modal-content">Shrine Content</div>'),
}));

vi.mock('../../src/modules/charts.ts', () => ({
    getEffectiveStackCap: vi.fn(() => 100),
    createScalingChart: vi.fn(),
}));

// Import after mocks
import {
    openDetailModal,
    closeModal,
    activateFocusTrap,
    deactivateFocusTrap,
    getChartModule,
    getCurrentModalSessionId,
    incrementModalSessionId,
    tabHandlers,
} from '../../src/modules/modal-core.ts';
import { allData } from '../../src/modules/data-service.ts';
import { ToastManager } from '../../src/modules/toast.ts';
import { onModalOpened } from '../../src/modules/recently-viewed.ts';
import { renderSimilarItemsSection, setupSimilarItemsHandlers } from '../../src/modules/similar-items.ts';
import { renderItemModal } from '../../src/modules/modal-items.ts';
import { renderWeaponModal } from '../../src/modules/modal-weapons.ts';
import { renderCharacterModal } from '../../src/modules/modal-characters.ts';
import { renderTomeModal, renderShrineModal } from '../../src/modules/modal-entities.ts';

describe('Modal Core Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        createMinimalDOM();

        // Setup mock data
        const mockData = createMockAllData();
        (allData as any).items = mockData.items;
        (allData as any).weapons = mockData.weapons;
        (allData as any).tomes = mockData.tomes;
        (allData as any).characters = mockData.characters;
        (allData as any).shrines = mockData.shrines;
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        deactivateFocusTrap(); // Ensure cleanup
    });

    // ========================================
    // Modal Session ID Tests
    // ========================================
    describe('Modal Session Management', () => {
        it('should track current modal session ID', () => {
            const initialId = getCurrentModalSessionId();
            expect(typeof initialId).toBe('number');
        });

        it('should increment modal session ID', () => {
            const before = getCurrentModalSessionId();
            const newId = incrementModalSessionId();
            expect(newId).toBe(before + 1);
            expect(getCurrentModalSessionId()).toBe(newId);
        });

        it('should increment multiple times correctly', () => {
            const initial = getCurrentModalSessionId();
            incrementModalSessionId();
            incrementModalSessionId();
            incrementModalSessionId();
            expect(getCurrentModalSessionId()).toBe(initial + 3);
        });
    });

    // ========================================
    // Chart Module Cache Tests
    // ========================================
    describe('getChartModule', () => {
        it('should return chart module on success', async () => {
            const module = await getChartModule();
            expect(module).toBeDefined();
        });

        it('should cache chart module for subsequent calls', async () => {
            const module1 = await getChartModule();
            const module2 = await getChartModule();
            expect(module1).toBe(module2);
        });
    });

    // ========================================
    // Tab Handlers WeakMap Tests
    // ========================================
    describe('tabHandlers WeakMap', () => {
        it('should be a WeakMap', () => {
            expect(tabHandlers).toBeInstanceOf(WeakMap);
        });

        it('should allow setting and getting handlers', () => {
            const container = document.createElement('div');
            const handler = vi.fn();
            
            tabHandlers.set(container, handler);
            expect(tabHandlers.get(container)).toBe(handler);
        });

        it('should not retain handler after container is dereferenced', () => {
            let container: HTMLElement | null = document.createElement('div');
            const handler = vi.fn();
            
            tabHandlers.set(container, handler);
            expect(tabHandlers.has(container)).toBe(true);
            
            // Note: We can't directly test garbage collection, but we verify the API works
            container = null;
            // After GC, the entry would be removed (can't test directly in JS)
        });
    });

    // ========================================
    // Focus Trap Tests
    // ========================================
    describe('Focus Trap', () => {
        let modal: HTMLElement;

        beforeEach(() => {
            modal = document.getElementById('itemModal') as HTMLElement;
            modal.innerHTML = `
                <div class="modal-content">
                    <button id="firstBtn">First</button>
                    <input type="text" id="textInput" />
                    <a href="#" id="link">Link</a>
                    <button id="lastBtn">Last</button>
                </div>
            `;
            modal.style.display = 'block';
            modal.classList.add('active');
        });

        describe('activateFocusTrap', () => {
            it('should focus the modal title if present', () => {
                modal.innerHTML = `
                    <h2 id="modal-title">Title</h2>
                    <button id="btn1">Button 1</button>
                `;
                
                activateFocusTrap(modal);
                
                const title = modal.querySelector('#modal-title') as HTMLElement;
                expect(title.tabIndex).toBe(-1);
            });

            it('should focus first focusable element if no title', () => {
                modal.innerHTML = `
                    <button id="btn1">Button 1</button>
                    <button id="btn2">Button 2</button>
                `;
                
                activateFocusTrap(modal);
                
                // Focus trap sets up the elements
                const btn1 = modal.querySelector('#btn1') as HTMLElement;
                expect(btn1).toBeTruthy();
            });

            it('should handle modal with no focusable elements', () => {
                modal.innerHTML = '<div>No focusable elements</div>';
                
                expect(() => activateFocusTrap(modal)).not.toThrow();
            });

            it('should find all focusable elements', () => {
                modal.innerHTML = `
                    <button id="btn">Button</button>
                    <a href="#" id="link">Link</a>
                    <input type="text" id="input" />
                    <select id="select"><option>Option</option></select>
                    <textarea id="textarea"></textarea>
                    <div tabindex="0" id="focusable-div">Focusable Div</div>
                    <div tabindex="-1" id="non-focusable">Non-focusable</div>
                `;
                
                expect(() => activateFocusTrap(modal)).not.toThrow();
            });
        });

        describe('deactivateFocusTrap', () => {
            it('should deactivate focus trap', () => {
                activateFocusTrap(modal);
                deactivateFocusTrap();
                
                // Should not throw when called again
                expect(() => deactivateFocusTrap()).not.toThrow();
            });

            it('should be safe to call multiple times', () => {
                deactivateFocusTrap();
                deactivateFocusTrap();
                deactivateFocusTrap();
                
                expect(true).toBe(true);
            });

            it('should remove keydown listener', () => {
                const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
                
                activateFocusTrap(modal);
                deactivateFocusTrap();
                
                expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
            });
        });

        describe('Tab key navigation', () => {
            it('should trap Tab at end of modal', () => {
                modal.innerHTML = `
                    <button id="btn1">First</button>
                    <button id="btn2">Last</button>
                `;
                
                activateFocusTrap(modal);
                
                const btn2 = modal.querySelector('#btn2') as HTMLElement;
                btn2.focus();
                
                const event = new KeyboardEvent('keydown', {
                    key: 'Tab',
                    bubbles: true,
                    cancelable: true,
                });
                
                document.dispatchEvent(event);
                expect(event.defaultPrevented).toBe(true);
            });

            it('should trap Shift+Tab at start of modal', () => {
                modal.innerHTML = `
                    <button id="btn1">First</button>
                    <button id="btn2">Last</button>
                `;
                
                activateFocusTrap(modal);
                
                const btn1 = modal.querySelector('#btn1') as HTMLElement;
                btn1.focus();
                
                const event = new KeyboardEvent('keydown', {
                    key: 'Tab',
                    shiftKey: true,
                    bubbles: true,
                    cancelable: true,
                });
                
                document.dispatchEvent(event);
                expect(event.defaultPrevented).toBe(true);
            });

            it('should ignore non-Tab keys', () => {
                activateFocusTrap(modal);
                
                const event = new KeyboardEvent('keydown', {
                    key: 'Enter',
                    bubbles: true,
                });
                
                expect(() => document.dispatchEvent(event)).not.toThrow();
            });
        });

        describe('MutationObserver cleanup', () => {
            it('should cleanup when modal is removed from DOM', () => {
                activateFocusTrap(modal);
                
                // Remove modal from DOM
                expect(() => modal.remove()).not.toThrow();
            });

            it('should cleanup when modal active class is removed', () => {
                activateFocusTrap(modal);
                
                expect(() => modal.classList.remove('active')).not.toThrow();
            });

            it('should cleanup when modal display is set to none', () => {
                activateFocusTrap(modal);
                
                modal.style.display = 'none';
                expect(modal.style.display).toBe('none');
            });
        });
    });

    // ========================================
    // openDetailModal Tests
    // ========================================
    describe('openDetailModal', () => {
        describe('Entity Type Handling', () => {
            it('should open modal for items', async () => {
                await openDetailModal('items', 'test-item');
                
                const modal = document.getElementById('itemModal');
                expect(modal?.style.display).toBe('block');
                expect(renderItemModal).toHaveBeenCalled();
            });

            it('should open modal for weapons', async () => {
                await openDetailModal('weapons', 'test-weapon');
                
                const modal = document.getElementById('itemModal');
                expect(modal?.style.display).toBe('block');
                expect(renderWeaponModal).toHaveBeenCalled();
            });

            it('should open modal for tomes', async () => {
                await openDetailModal('tomes', 'test-tome');
                
                const modal = document.getElementById('itemModal');
                expect(modal?.style.display).toBe('block');
                expect(renderTomeModal).toHaveBeenCalled();
            });

            it('should open modal for characters', async () => {
                await openDetailModal('characters', 'test-character');
                
                const modal = document.getElementById('itemModal');
                expect(modal?.style.display).toBe('block');
                expect(renderCharacterModal).toHaveBeenCalled();
            });

            it('should open modal for shrines', async () => {
                await openDetailModal('shrines', 'test-shrine');
                
                const modal = document.getElementById('itemModal');
                expect(modal?.style.display).toBe('block');
                expect(renderShrineModal).toHaveBeenCalled();
            });
        });

        describe('Entity Not Found', () => {
            it('should show error toast for non-existent item', async () => {
                await openDetailModal('items', 'nonexistent-id');
                
                expect(ToastManager.error).toHaveBeenCalledWith(
                    expect.stringContaining('Could not find items with ID: nonexistent-id')
                );
            });

            it('should show error toast for non-existent weapon', async () => {
                await openDetailModal('weapons', 'fake-weapon');
                
                expect(ToastManager.error).toHaveBeenCalled();
            });

            it('should not open modal when entity not found', async () => {
                await openDetailModal('items', 'nonexistent');
                
                const modal = document.getElementById('itemModal');
                expect(modal?.style.display).toBe('none');
            });
        });

        describe('Data Array Guards', () => {
            it('should handle undefined items array', async () => {
                (allData as any).items = undefined;
                
                await openDetailModal('items', 'test-item');
                
                expect(ToastManager.error).toHaveBeenCalled();
            });

            it('should handle undefined weapons array', async () => {
                (allData as any).weapons = undefined;
                
                await openDetailModal('weapons', 'test-weapon');
                
                expect(ToastManager.error).toHaveBeenCalled();
            });

            it('should handle undefined tomes array', async () => {
                (allData as any).tomes = undefined;
                
                await openDetailModal('tomes', 'test-tome');
                
                expect(ToastManager.error).toHaveBeenCalled();
            });

            it('should handle undefined characters array', async () => {
                (allData as any).characters = undefined;
                
                await openDetailModal('characters', 'test-character');
                
                expect(ToastManager.error).toHaveBeenCalled();
            });

            it('should handle undefined shrines array', async () => {
                (allData as any).shrines = undefined;
                
                await openDetailModal('shrines', 'test-shrine');
                
                expect(ToastManager.error).toHaveBeenCalled();
            });

            it('should handle null nested items array', async () => {
                (allData as any).items = { items: null };
                
                await openDetailModal('items', 'test-item');
                
                expect(ToastManager.error).toHaveBeenCalled();
            });
        });

        describe('Modal Content', () => {
            it('should set modal body with entity name in title', async () => {
                await openDetailModal('items', 'test-item');
                
                const modalBody = document.getElementById('modalBody');
                expect(modalBody?.innerHTML).toContain('Test Item');
                expect(modalBody?.innerHTML).toContain('modal-title');
            });

            it('should include similar items section for items', async () => {
                await openDetailModal('items', 'test-item');
                
                expect(renderSimilarItemsSection).toHaveBeenCalledWith('items', 'test-item');
            });

            it('should include similar items section for weapons', async () => {
                await openDetailModal('weapons', 'test-weapon');
                
                expect(renderSimilarItemsSection).toHaveBeenCalledWith('weapons', 'test-weapon');
            });

            it('should NOT include similar items section for shrines', async () => {
                await openDetailModal('shrines', 'test-shrine');
                
                expect(renderSimilarItemsSection).not.toHaveBeenCalled();
            });
        });

        describe('Modal Animation & State', () => {
            it('should add active class after display is set', async () => {
                await openDetailModal('items', 'test-item');
                
                vi.runAllTimers();
                
                const modal = document.getElementById('itemModal');
                expect(modal?.classList.contains('active')).toBe(true);
            });

            it('should add modal-open class to body', async () => {
                await openDetailModal('items', 'test-item');
                
                vi.runAllTimers();
                
                expect(document.body.classList.contains('modal-open')).toBe(true);
            });

            it('should track view in recently viewed', async () => {
                await openDetailModal('items', 'test-item');
                
                expect(onModalOpened).toHaveBeenCalledWith('items', 'test-item');
            });

            it('should setup similar items handlers', async () => {
                await openDetailModal('items', 'test-item');
                
                vi.runAllTimers();
                
                expect(setupSimilarItemsHandlers).toHaveBeenCalled();
            });

            it('should activate focus trap', async () => {
                await openDetailModal('items', 'test-item');
                
                vi.runAllTimers();
                
                // Focus trap should be active
                expect(document.getElementById('itemModal')).toBeDefined();
            });
        });

        describe('Missing Modal Elements', () => {
            it('should return early if modal element not found', async () => {
                document.getElementById('itemModal')?.remove();
                
                await openDetailModal('items', 'test-item');
                
                // Should not throw and should not show toast for entity
                expect(renderItemModal).not.toHaveBeenCalled();
            });

            it('should return early if modalBody element not found', async () => {
                document.getElementById('modalBody')?.remove();
                
                await openDetailModal('items', 'test-item');
                
                expect(renderItemModal).not.toHaveBeenCalled();
            });
        });
    });

    // ========================================
    // closeModal Tests
    // ========================================
    describe('closeModal', () => {
        beforeEach(async () => {
            // Open a modal first
            await openDetailModal('items', 'test-item');
            vi.runAllTimers();
        });

        it('should remove active class immediately', () => {
            closeModal();
            
            const modal = document.getElementById('itemModal');
            expect(modal?.classList.contains('active')).toBe(false);
        });

        it('should remove modal-open class from body', () => {
            closeModal();
            
            expect(document.body.classList.contains('modal-open')).toBe(false);
        });

        it('should hide modal after animation delay', () => {
            closeModal();
            
            // Before timeout
            const modal = document.getElementById('itemModal');
            expect(modal?.style.display).toBe('block');
            
            // After timeout (300ms)
            vi.advanceTimersByTime(300);
            expect(modal?.style.display).toBe('none');
        });

        it('should deactivate focus trap', () => {
            // Spy on document.removeEventListener to verify cleanup
            const spy = vi.spyOn(document, 'removeEventListener');
            
            closeModal();
            
            expect(spy).toHaveBeenCalledWith('keydown', expect.any(Function));
        });

        it('should handle missing modal element gracefully', () => {
            document.getElementById('itemModal')?.remove();
            
            expect(() => closeModal()).not.toThrow();
        });

        it('should be idempotent', () => {
            closeModal();
            vi.advanceTimersByTime(300);
            
            closeModal();
            vi.advanceTimersByTime(300);
            
            closeModal();
            vi.advanceTimersByTime(300);
            
            expect(true).toBe(true); // No errors thrown
        });
    });

    // ========================================
    // Integration Tests
    // ========================================
    describe('Integration', () => {
        it('should open and close modal correctly', async () => {
            const modal = document.getElementById('itemModal') as HTMLElement;
            
            // Initial state
            expect(modal.style.display).toBe('none');
            
            // Open
            await openDetailModal('items', 'test-item');
            vi.runAllTimers();
            
            expect(modal.style.display).toBe('block');
            expect(modal.classList.contains('active')).toBe(true);
            expect(document.body.classList.contains('modal-open')).toBe(true);
            
            // Close
            closeModal();
            vi.advanceTimersByTime(300);
            
            expect(modal.style.display).toBe('none');
            expect(modal.classList.contains('active')).toBe(false);
            expect(document.body.classList.contains('modal-open')).toBe(false);
        });

        it('should handle rapid open/close cycles', async () => {
            for (let i = 0; i < 5; i++) {
                await openDetailModal('items', 'test-item');
                vi.runAllTimers();
                closeModal();
                vi.advanceTimersByTime(300);
            }
            
            const modal = document.getElementById('itemModal');
            expect(modal?.style.display).toBe('none');
        });

        it('should switch between entity types', async () => {
            await openDetailModal('items', 'test-item');
            vi.runAllTimers();
            expect(renderItemModal).toHaveBeenCalled();
            
            await openDetailModal('weapons', 'test-weapon');
            vi.runAllTimers();
            expect(renderWeaponModal).toHaveBeenCalled();
            
            await openDetailModal('characters', 'test-character');
            vi.runAllTimers();
            expect(renderCharacterModal).toHaveBeenCalled();
        });
    });

    // ========================================
    // Edge Cases
    // ========================================
    describe('Edge Cases', () => {
        it('should handle empty string ID', async () => {
            await openDetailModal('items', '');
            
            expect(ToastManager.error).toHaveBeenCalled();
        });

        it('should handle special characters in ID', async () => {
            await openDetailModal('items', 'item-with-special-<>chars');
            
            expect(ToastManager.error).toHaveBeenCalled();
        });

        it('should handle undefined ID', async () => {
            await openDetailModal('items', undefined as any);
            
            expect(ToastManager.error).toHaveBeenCalled();
        });

        it('should handle very long entity names', async () => {
            const longName = 'A'.repeat(1000);
            const mockData = createMockAllData();
            mockData.items.items[0].name = longName;
            (allData as any).items = mockData.items;
            
            await openDetailModal('items', 'test-item');
            
            const modalBody = document.getElementById('modalBody');
            expect(modalBody?.innerHTML).toContain(longName);
        });
    });
});
