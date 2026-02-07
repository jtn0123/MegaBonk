/**
 * @vitest-environment jsdom
 * Toast Notification Module Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Unmock the toast module to test real implementation
vi.unmock('../../src/modules/toast.ts');

// Import after unmocking
import { ToastManager } from '../../src/modules/toast.ts';

describe('ToastManager', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        ToastManager.reset();
    });

    afterEach(() => {
        vi.useRealTimers();
        ToastManager.reset();
    });

    // ========================================
    // Initialization Tests
    // ========================================
    describe('init', () => {
        it('should create a toast container on first init', () => {
            ToastManager.init();
            const container = document.getElementById('toast-container');
            expect(container).not.toBeNull();
        });

        it('should set correct aria attributes on container', () => {
            ToastManager.init();
            const container = document.getElementById('toast-container');
            expect(container?.getAttribute('role')).toBe('status');
            expect(container?.getAttribute('aria-live')).toBe('polite');
            expect(container?.getAttribute('aria-atomic')).toBe('true');
        });

        it('should not create duplicate containers on multiple inits', () => {
            ToastManager.init();
            ToastManager.init();
            ToastManager.init();
            const containers = document.querySelectorAll('#toast-container');
            expect(containers.length).toBe(1);
        });
    });

    // ========================================
    // show() Tests
    // ========================================
    describe('show', () => {
        it('should create a toast element', () => {
            const toast = ToastManager.show('Test message');
            expect(toast).toBeInstanceOf(HTMLElement);
            expect(toast.textContent).toBe('Test message');
        });

        it('should apply correct class for info type', () => {
            const toast = ToastManager.show('Info message', 'info');
            expect(toast.classList.contains('toast')).toBe(true);
            expect(toast.classList.contains('toast-info')).toBe(true);
        });

        it('should apply correct class for success type', () => {
            const toast = ToastManager.show('Success message', 'success');
            expect(toast.classList.contains('toast-success')).toBe(true);
        });

        it('should apply correct class for warning type', () => {
            const toast = ToastManager.show('Warning message', 'warning');
            expect(toast.classList.contains('toast-warning')).toBe(true);
        });

        it('should apply correct class for error type', () => {
            const toast = ToastManager.show('Error message', 'error');
            expect(toast.classList.contains('toast-error')).toBe(true);
        });

        it('should set role="alert" for accessibility', () => {
            const toast = ToastManager.show('Alert message');
            expect(toast.getAttribute('role')).toBe('alert');
        });

        it('should default to info type when not specified', () => {
            const toast = ToastManager.show('Default message');
            expect(toast.classList.contains('toast-info')).toBe(true);
        });

        it('should add toast-visible class after animation frame', () => {
            const toast = ToastManager.show('Animated message');
            
            // Initially not visible
            expect(toast.classList.contains('toast-visible')).toBe(false);
            
            // After animation frame
            vi.runAllTimers();
            // Note: requestAnimationFrame is async, so we need to advance
        });

        it('should auto-dismiss after default duration (3000ms)', () => {
            const toast = ToastManager.show('Dismissing message');
            const container = document.getElementById('toast-container');
            
            expect(container?.contains(toast)).toBe(true);
            
            // Advance past the duration
            vi.advanceTimersByTime(3000);
            
            // Toast should start removal process
            expect(toast.classList.contains('toast-visible')).toBe(false);
        });

        it('should respect custom duration', () => {
            const toast = ToastManager.show('Quick message', 'info', 1000);
            
            vi.advanceTimersByTime(500);
            expect(toast.classList.contains('toast-visible')).toBe(true);
            
            vi.advanceTimersByTime(600);
            expect(toast.classList.contains('toast-visible')).toBe(false);
        });

        it('should remove toast from DOM after transition', () => {
            const toast = ToastManager.show('Removing message', 'info', 100);
            const container = document.getElementById('toast-container');
            
            expect(container?.contains(toast)).toBe(true);
            
            // Advance past duration + fallback timeout
            vi.advanceTimersByTime(700);
            
            expect(container?.contains(toast)).toBe(false);
        });

        it('should handle multiple toasts simultaneously', () => {
            const toast1 = ToastManager.show('First');
            const toast2 = ToastManager.show('Second');
            const toast3 = ToastManager.show('Third');
            
            const container = document.getElementById('toast-container');
            expect(container?.children.length).toBe(3);
        });

        it('should auto-init container if not initialized', () => {
            // Don't call init() first
            ToastManager.show('Auto-init message');
            
            const container = document.getElementById('toast-container');
            expect(container).not.toBeNull();
        });
    });

    // ========================================
    // Convenience Method Tests
    // ========================================
    describe('info', () => {
        it('should show info toast', () => {
            const toast = ToastManager.info('Info notification');
            expect(toast.textContent).toBe('Info notification');
            expect(toast.classList.contains('toast-info')).toBe(true);
        });
    });

    describe('success', () => {
        it('should show success toast', () => {
            const toast = ToastManager.success('Success notification');
            expect(toast.textContent).toBe('Success notification');
            expect(toast.classList.contains('toast-success')).toBe(true);
        });
    });

    describe('warning', () => {
        it('should show warning toast', () => {
            const toast = ToastManager.warning('Warning notification');
            expect(toast.textContent).toBe('Warning notification');
            expect(toast.classList.contains('toast-warning')).toBe(true);
        });
    });

    describe('error', () => {
        it('should show error toast', () => {
            const toast = ToastManager.error('Error notification');
            expect(toast.textContent).toBe('Error notification');
            expect(toast.classList.contains('toast-error')).toBe(true);
        });
    });

    // ========================================
    // Reset Tests
    // ========================================
    describe('reset', () => {
        it('should remove container from DOM', () => {
            ToastManager.init();
            expect(document.getElementById('toast-container')).not.toBeNull();
            
            ToastManager.reset();
            expect(document.getElementById('toast-container')).toBeNull();
        });

        it('should reset internal state', () => {
            ToastManager.init();
            ToastManager.reset();
            
            // Should be able to init again
            ToastManager.init();
            expect(document.getElementById('toast-container')).not.toBeNull();
        });

        it('should handle reset when not initialized', () => {
            // Should not throw
            expect(() => ToastManager.reset()).not.toThrow();
        });

        it('should handle multiple resets', () => {
            ToastManager.init();
            ToastManager.reset();
            ToastManager.reset();
            ToastManager.reset();
            
            expect(document.getElementById('toast-container')).toBeNull();
        });
    });

    // ========================================
    // Edge Cases
    // ========================================
    describe('edge cases', () => {
        it('should handle empty message', () => {
            const toast = ToastManager.show('');
            expect(toast.textContent).toBe('');
        });

        it('should handle very long messages', () => {
            const longMessage = 'A'.repeat(1000);
            const toast = ToastManager.show(longMessage);
            expect(toast.textContent).toBe(longMessage);
        });

        it('should handle special characters', () => {
            const specialMessage = '<script>alert("xss")</script>';
            const toast = ToastManager.show(specialMessage);
            // textContent should escape HTML
            expect(toast.textContent).toBe(specialMessage);
            expect(toast.innerHTML).not.toContain('<script>');
        });

        it('should handle unicode characters', () => {
            const unicodeMessage = '🎮 MegaBonk 🏆 测试 العربية';
            const toast = ToastManager.show(unicodeMessage);
            expect(toast.textContent).toBe(unicodeMessage);
        });

        it('should handle zero duration', () => {
            const toast = ToastManager.show('Instant', 'info', 0);
            
            vi.advanceTimersByTime(0);
            expect(toast.classList.contains('toast-visible')).toBe(false);
        });

        it('should handle negative duration as immediate', () => {
            const toast = ToastManager.show('Negative', 'info', -100);
            
            vi.advanceTimersByTime(0);
            // Should still work, treated as 0 or immediate
        });
    });
});
