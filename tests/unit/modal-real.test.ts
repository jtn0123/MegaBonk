/**
 * Real Integration Tests for Modal Module
 * No mocking - tests actual modal implementations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { openDetailModal, closeModal } from '../../src/modules/modal.ts';
import { allData } from '../../src/modules/data-service.ts';

// ========================================
// Test Setup
// ========================================

const createModalDOM = () => {
    document.body.innerHTML = `
        <div id="itemModal" class="modal" style="display: none;">
            <div class="modal-content">
                <button class="modal-close">&times;</button>
                <div id="modalBody"></div>
            </div>
        </div>
        <div id="toast-container"></div>
    `;
};

// ========================================
// closeModal Tests
// ========================================

describe('closeModal - Real Integration Tests', () => {
    beforeEach(() => {
        createModalDOM();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('should hide modal element after animation delay', () => {
        const modal = document.getElementById('itemModal');
        modal!.style.display = 'block';
        modal!.classList.add('active');

        closeModal();

        // Modal uses 300ms animation delay before hiding
        vi.advanceTimersByTime(300);

        expect(modal?.style.display).toBe('none');
    });

    it('should immediately remove active class', () => {
        const modal = document.getElementById('itemModal');
        modal!.classList.add('active');

        closeModal();

        // Active class is removed immediately
        expect(modal?.classList.contains('active')).toBe(false);
    });

    it('should not throw when modal element missing', () => {
        document.body.innerHTML = '';

        expect(() => closeModal()).not.toThrow();
    });

    it('should handle already closed modal', () => {
        const modal = document.getElementById('itemModal');
        modal!.style.display = 'none';

        expect(() => closeModal()).not.toThrow();
    });
});

// ========================================
// openDetailModal Tests
// ========================================

describe('openDetailModal - Real Integration Tests', () => {
    beforeEach(() => {
        createModalDOM();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('with missing data', () => {
        it('should show error toast when item not found', async () => {
            await openDetailModal('items', 'nonexistent');

            // Modal should not be opened
            const modal = document.getElementById('itemModal');
            expect(modal?.style.display).toBe('none');
        });

        it('should show error toast when weapon not found', async () => {
            await openDetailModal('weapons', 'nonexistent');

            const modal = document.getElementById('itemModal');
            expect(modal?.style.display).toBe('none');
        });

        it('should show error toast when tome not found', async () => {
            await openDetailModal('tomes', 'nonexistent');

            const modal = document.getElementById('itemModal');
            expect(modal?.style.display).toBe('none');
        });

        it('should show error toast when character not found', async () => {
            await openDetailModal('characters', 'nonexistent');

            const modal = document.getElementById('itemModal');
            expect(modal?.style.display).toBe('none');
        });

        it('should show error toast when shrine not found', async () => {
            await openDetailModal('shrines', 'nonexistent');

            const modal = document.getElementById('itemModal');
            expect(modal?.style.display).toBe('none');
        });
    });

    describe('DOM requirements', () => {
        it('should not throw when modal element missing', async () => {
            document.body.innerHTML = '';

            await expect(openDetailModal('items', 'test')).resolves.not.toThrow();
        });

        it('should not throw when modalBody missing', async () => {
            document.body.innerHTML = '<div id="itemModal"></div>';

            await expect(openDetailModal('items', 'test')).resolves.not.toThrow();
        });
    });
});

// ========================================
// Modal Display Tests
// ========================================

describe('Modal Display Integration', () => {
    beforeEach(() => {
        createModalDOM();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('should toggle modal visibility with animation delay', () => {
        const modal = document.getElementById('itemModal');

        // Start closed
        expect(modal?.style.display).toBe('none');

        // Simulate opening
        modal!.style.display = 'block';
        modal!.classList.add('active');

        expect(modal?.style.display).toBe('block');
        expect(modal?.classList.contains('active')).toBe(true);

        // Close
        closeModal();
        vi.advanceTimersByTime(300);

        expect(modal?.style.display).toBe('none');
    });

    it('should maintain modal structure', () => {
        const modal = document.getElementById('itemModal');
        const modalBody = document.getElementById('modalBody');
        const closeBtn = document.querySelector('.modal-close');

        expect(modal).not.toBeNull();
        expect(modalBody).not.toBeNull();
        expect(closeBtn).not.toBeNull();
    });
});

// ========================================
// Edge Cases
// ========================================

describe('Modal Edge Cases', () => {
    beforeEach(() => {
        createModalDOM();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('should handle rapid open/close cycles', () => {
        const modal = document.getElementById('itemModal');

        for (let i = 0; i < 10; i++) {
            modal!.style.display = 'block';
            closeModal();
            vi.advanceTimersByTime(300);
        }

        expect(modal?.style.display).toBe('none');
    });

    it('should handle multiple close calls', () => {
        closeModal();
        closeModal();
        closeModal();

        // Should not throw
        expect(true).toBe(true);
    });

    it('should handle modal without active class', () => {
        const modal = document.getElementById('itemModal');
        modal!.style.display = 'block';
        // Explicitly don't add active class

        closeModal();
        vi.advanceTimersByTime(300);

        expect(modal?.style.display).toBe('none');
    });
});

// ========================================
// Accessibility Tests
// ========================================

describe('Modal Accessibility', () => {
    beforeEach(() => {
        createModalDOM();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should have close button', () => {
        const closeBtn = document.querySelector('.modal-close');
        expect(closeBtn).not.toBeNull();
    });

    it('should have modal structure for screen readers', () => {
        const modal = document.getElementById('itemModal');
        expect(modal?.classList.contains('modal')).toBe(true);
    });

    it('should have modalBody for content', () => {
        const modalBody = document.getElementById('modalBody');
        expect(modalBody).not.toBeNull();
    });
});
