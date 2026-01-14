import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';
import {
    toggleTextExpand,
    showLoading,
    hideLoading,
    showErrorMessage,
    dismissError,
    switchTab,
    getSavedTab,
} from '../../src/modules/events.ts';

// Mock dependencies
vi.mock('../../src/modules/renderers.ts', () => ({
    renderTabContent: vi.fn(),
}));

vi.mock('../../src/modules/filters.ts', () => ({
    restoreFilterState: vi.fn(),
    saveFilterState: vi.fn(),
    updateFilters: vi.fn(),
}));

vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        setContext: vi.fn(),
    },
}));

vi.mock('../../src/modules/charts.ts', () => ({
    destroyAllCharts: vi.fn(),
}));

describe('events.ts - Edge Cases', () => {
    beforeEach(() => {
        createMinimalDOM();
        localStorage.clear();
    });

    describe('toggleTextExpand', () => {
        it('should expand collapsed text', () => {
            const element = document.createElement('div');
            element.className = 'expandable-text';
            element.setAttribute('data-full-text', 'This is the full text content');
            element.setAttribute('data-truncated', 'true');
            element.innerHTML = 'This is...<span class="expand-indicator">Click to expand</span>';
            document.body.appendChild(element);

            toggleTextExpand(element);

            expect(element.innerHTML).toContain('This is the full text content');
            expect(element.getAttribute('data-truncated')).toBe('false');
            expect(element.innerHTML).toContain('Click to collapse');
        });

        it('should collapse expanded text', () => {
            const element = document.createElement('div');
            element.className = 'expandable-text';
            element.setAttribute('data-full-text', 'This is the full text content that is very long');
            element.setAttribute('data-truncated', 'false');
            element.innerHTML = 'This is the full text content that is very long<span class="expand-indicator">Click to collapse</span>';
            document.body.appendChild(element);

            toggleTextExpand(element);

            expect(element.getAttribute('data-truncated')).toBe('true');
            expect(element.innerHTML).toContain('...');
            expect(element.innerHTML).toContain('Click to expand');
        });

        it('should handle elements without data-full-text', () => {
            const element = document.createElement('div');
            element.className = 'expandable-text';
            element.innerHTML = 'Some text';

            // Should not throw
            expect(() => toggleTextExpand(element)).not.toThrow();
        });

        it('should handle very long text content', () => {
            const longText = 'A'.repeat(10000);
            const element = document.createElement('div');
            element.className = 'expandable-text';
            element.setAttribute('data-full-text', longText);
            element.setAttribute('data-truncated', 'true');
            element.innerHTML = 'Short...<span class="expand-indicator">Click to expand</span>';

            toggleTextExpand(element);

            expect(element.innerHTML).toContain(longText);
        });

        it('should handle elements with special HTML characters', () => {
            const specialText = '<script>alert("xss")</script> & "quotes"';
            const element = document.createElement('div');
            element.className = 'expandable-text';
            element.setAttribute('data-full-text', specialText);
            element.setAttribute('data-truncated', 'true');
            element.innerHTML = 'Text...<span class="expand-indicator">Click to expand</span>';

            toggleTextExpand(element);

            // Should escape HTML properly
            expect(element.innerHTML).not.toContain('<script>alert');
        });
    });

    describe('showLoading', () => {
        it('should display loading indicator', () => {
            showLoading();

            const loading = document.getElementById('loading-indicator');
            expect(loading?.style.display).toBe('flex');
        });

        it('should handle missing loading element gracefully', () => {
            document.getElementById('loading-indicator')?.remove();

            // Should not throw
            expect(() => showLoading()).not.toThrow();
        });
    });

    describe('hideLoading', () => {
        it('should hide loading indicator', () => {
            showLoading();
            hideLoading();

            const loading = document.getElementById('loading-indicator');
            expect(loading?.style.display).toBe('none');
        });

        it('should handle missing loading element gracefully', () => {
            document.getElementById('loading-indicator')?.remove();

            // Should not throw
            expect(() => hideLoading()).not.toThrow();
        });

        it('should work even if loading was never shown', () => {
            // Call hideLoading without calling showLoading first
            expect(() => hideLoading()).not.toThrow();

            const loading = document.getElementById('loading-indicator');
            expect(loading?.style.display).toBe('none');
        });
    });

    describe('showErrorMessage', () => {
        it('should display error message with retry button', () => {
            showErrorMessage('Test error message', true);

            const errorContainer = document.getElementById('error-container');
            expect(errorContainer?.style.display).toBe('block');
            expect(errorContainer?.innerHTML).toContain('Test error message');
            expect(errorContainer?.innerHTML).toContain('Retry');
        });

        it('should display error message without retry button', () => {
            showErrorMessage('Non-retryable error', false);

            const errorContainer = document.getElementById('error-container');
            expect(errorContainer?.style.display).toBe('block');
            expect(errorContainer?.innerHTML).toContain('Non-retryable error');
            expect(errorContainer?.innerHTML).not.toContain('Retry');
        });

        it('should handle very long error messages', () => {
            const longMessage = 'Error: ' + 'A'.repeat(5000);
            showErrorMessage(longMessage, true);

            const errorContainer = document.getElementById('error-container');
            expect(errorContainer?.innerHTML).toContain(longMessage);
        });

        it('should escape HTML in error messages', () => {
            const maliciousMessage = '<script>alert("xss")</script>';
            showErrorMessage(maliciousMessage, false);

            const errorContainer = document.getElementById('error-container');
            // Should not contain unescaped script tags
            expect(errorContainer?.innerHTML).not.toContain('<script>alert');
        });

        it('should handle missing error container gracefully', () => {
            document.getElementById('error-container')?.remove();

            // Should not throw
            expect(() => showErrorMessage('Error', true)).not.toThrow();
        });

        it('should attach click listeners to retry and close buttons', () => {
            showErrorMessage('Test error', true);

            const retryBtn = document.querySelector('.error-retry-btn');
            const closeBtn = document.querySelector('.error-close');

            expect(retryBtn).toBeTruthy();
            expect(closeBtn).toBeTruthy();
        });

        it('should dismiss error when close button is clicked', () => {
            showErrorMessage('Test error', true);

            const closeBtn = document.querySelector('.error-close') as HTMLButtonElement;
            closeBtn?.click();

            return new Promise((resolve) => {
                setTimeout(() => {
                    const errorContainer = document.getElementById('error-container');
                    expect(errorContainer?.style.display).toBe('none');
                    resolve(undefined);
                }, 10);
            });
        });
    });

    describe('dismissError', () => {
        it('should hide error container', () => {
            showErrorMessage('Test error', false);

            dismissError();

            const errorContainer = document.getElementById('error-container');
            expect(errorContainer?.style.display).toBe('none');
        });

        it('should handle missing error container gracefully', () => {
            document.getElementById('error-container')?.remove();

            // Should not throw
            expect(() => dismissError()).not.toThrow();
        });

        it('should work even if no error was shown', () => {
            // Call dismissError without showing error first
            expect(() => dismissError()).not.toThrow();
        });
    });

    describe('switchTab', () => {
        it('should switch to items tab', () => {
            switchTab('items');

            // Check that tab is active
            const itemsTab = document.querySelector('[data-tab="items"]');
            expect(itemsTab?.classList.contains('active')).toBe(true);
        });

        it('should switch to weapons tab', () => {
            switchTab('weapons');

            const weaponsTab = document.querySelector('[data-tab="weapons"]');
            expect(weaponsTab?.classList.contains('active')).toBe(true);
        });

        it('should switch to tomes tab', () => {
            switchTab('tomes');

            const tomesTab = document.querySelector('[data-tab="tomes"]');
            expect(tomesTab?.classList.contains('active')).toBe(true);
        });

        it('should switch to characters tab', () => {
            switchTab('characters');

            const charactersTab = document.querySelector('[data-tab="characters"]');
            expect(charactersTab?.classList.contains('active')).toBe(true);
        });

        it('should switch to shrines tab', () => {
            switchTab('shrines');

            const shrinesTab = document.querySelector('[data-tab="shrines"]');
            expect(shrinesTab?.classList.contains('active')).toBe(true);
        });

        it('should deactivate previously active tab', () => {
            // Activate items tab first
            switchTab('items');
            const itemsTab = document.querySelector('[data-tab="items"]');
            expect(itemsTab?.classList.contains('active')).toBe(true);

            // Switch to weapons
            switchTab('weapons');
            expect(itemsTab?.classList.contains('active')).toBe(false);
        });

        it('should save tab to localStorage', () => {
            switchTab('weapons');

            const saved = localStorage.getItem('megabonk_current_tab');
            expect(saved).toBe('weapons');
        });

        it('should handle rapid tab switching', () => {
            // Rapidly switch between tabs
            switchTab('items');
            switchTab('weapons');
            switchTab('tomes');
            switchTab('characters');
            switchTab('shrines');

            const shrinesTab = document.querySelector('[data-tab="shrines"]');
            expect(shrinesTab?.classList.contains('active')).toBe(true);

            // Should save the last tab
            const saved = localStorage.getItem('megabonk_current_tab');
            expect(saved).toBe('shrines');
        });
    });

    describe('getSavedTab', () => {
        it('should return saved tab from localStorage', () => {
            localStorage.setItem('megabonk_current_tab', 'weapons');

            const saved = getSavedTab();
            expect(saved).toBe('weapons');
        });

        it('should return default tab when nothing is saved', () => {
            localStorage.removeItem('megabonk_current_tab');

            const saved = getSavedTab();
            expect(saved).toBe('items'); // Default should be 'items'
        });

        it('should handle invalid tab names', () => {
            localStorage.setItem('megabonk_current_tab', 'invalid-tab');

            const saved = getSavedTab();
            // Should return either the invalid value or a default
            expect(saved).toBeDefined();
        });

        it('should handle corrupted localStorage', () => {
            // Set invalid JSON
            Object.defineProperty(window, 'localStorage', {
                value: {
                    getItem: () => {
                        throw new Error('localStorage error');
                    },
                },
                writable: true,
            });

            // Should not throw and return default
            expect(() => getSavedTab()).not.toThrow();
        });
    });

    describe('Edge Cases - Multiple Operations', () => {
        it('should handle showing error while loading is visible', () => {
            showLoading();
            showErrorMessage('Error occurred', true);

            // Both should be visible potentially, or error should hide loading
            const loading = document.getElementById('loading-indicator');
            const error = document.getElementById('error-container');

            expect(error?.style.display).toBe('block');
            // Loading state is implementation dependent
        });

        it('should handle dismissing error while loading', () => {
            showLoading();
            showErrorMessage('Error', true);
            dismissError();
            hideLoading();

            const loading = document.getElementById('loading-indicator');
            const error = document.getElementById('error-container');

            expect(loading?.style.display).toBe('none');
            expect(error?.style.display).toBe('none');
        });

        it('should handle switching tabs rapidly with errors', () => {
            showErrorMessage('Error in items', true);
            switchTab('weapons');
            dismissError();
            switchTab('tomes');

            // Should not throw
            expect(true).toBe(true);
        });
    });
});
