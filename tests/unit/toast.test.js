/* global setTimeout, requestAnimationFrame */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';
import { ToastManager } from '../../src/modules/toast.ts';

describe('ToastManager', () => {
    beforeEach(() => {
        createMinimalDOM();
        ToastManager.reset();
        vi.useFakeTimers();
    });

    afterEach(() => {
        ToastManager.reset();
        vi.useRealTimers();
    });

    describe('init()', () => {
        it('should create toast container with correct ID', () => {
            ToastManager.init();

            const container = document.getElementById('toast-container');
            expect(container).not.toBeNull();
        });

        it('should set aria-live attribute to polite', () => {
            ToastManager.init();

            const container = document.getElementById('toast-container');
            expect(container.getAttribute('aria-live')).toBe('polite');
        });

        it('should set role to status', () => {
            ToastManager.init();

            const container = document.getElementById('toast-container');
            expect(container.getAttribute('role')).toBe('status');
        });

        it('should set aria-atomic to true', () => {
            ToastManager.init();

            const container = document.getElementById('toast-container');
            expect(container.getAttribute('aria-atomic')).toBe('true');
        });

        it('should append container to body', () => {
            ToastManager.init();

            const container = document.getElementById('toast-container');
            expect(container.parentNode).toBe(document.body);
        });

        it('should not create duplicate containers', () => {
            ToastManager.init();
            ToastManager.init();
            ToastManager.init();

            const containers = document.querySelectorAll('#toast-container');
            expect(containers.length).toBe(1);
        });
    });

    describe('show()', () => {
        it('should create toast element with correct class', () => {
            const toast = ToastManager.show('Test message', 'info');

            expect(toast.classList.contains('toast')).toBe(true);
            expect(toast.classList.contains('toast-info')).toBe(true);
        });

        it('should set toast message text', () => {
            const toast = ToastManager.show('Test message');

            expect(toast.textContent).toBe('Test message');
        });

        it('should add toast-visible class via requestAnimationFrame', async () => {
            vi.useRealTimers(); // Use real timers for this test
            const toast = ToastManager.show('Test message');

            // Initially should not have visible class
            expect(toast.classList.contains('toast-visible')).toBe(false);

            // Wait for requestAnimationFrame to run (use setTimeout as fallback in jsdom)
            await new Promise(resolve => setTimeout(resolve, 20));
            expect(toast.classList.contains('toast-visible')).toBe(true);
        });

        it('should auto-dismiss after duration', async () => {
            vi.useRealTimers(); // Use real timers for this test
            const toast = ToastManager.show('Test message', 'info', 50); // Short duration

            // Wait for requestAnimationFrame
            await new Promise(resolve => requestAnimationFrame(resolve));

            // Should have visible class after animation frame
            expect(toast.classList.contains('toast-visible')).toBe(true);

            // After duration, visible class should be removed
            await new Promise(resolve => setTimeout(resolve, 60));
            expect(toast.classList.contains('toast-visible')).toBe(false);
        });

        it('should default to info type', () => {
            const toast = ToastManager.show('Test message');

            expect(toast.classList.contains('toast-info')).toBe(true);
        });

        it('should default to 3000ms duration', () => {
            const toast = ToastManager.show('Test message');

            // Should still be visible at 2999ms
            vi.advanceTimersByTime(2999);
            expect(toast.classList.contains('toast-visible')).toBe(true);

            // Should lose visible class after 3000ms
            vi.advanceTimersByTime(2);
            expect(toast.classList.contains('toast-visible')).toBe(false);
        });

        it('should add toast to container', () => {
            ToastManager.show('Test message');

            const container = document.getElementById('toast-container');
            expect(container.children.length).toBe(1);
        });

        it('should support custom duration', () => {
            const toast = ToastManager.show('Test message', 'info', 5000);

            // Should still be visible at 4999ms
            vi.advanceTimersByTime(4999);
            expect(toast.classList.contains('toast-visible')).toBe(true);

            // Should lose visible class after 5000ms
            vi.advanceTimersByTime(2);
            expect(toast.classList.contains('toast-visible')).toBe(false);
        });
    });

    describe('info()', () => {
        it('should create toast with toast-info class', () => {
            const toast = ToastManager.info('Info message');

            expect(toast.classList.contains('toast-info')).toBe(true);
        });

        it('should display the message', () => {
            const toast = ToastManager.info('Info message');

            expect(toast.textContent).toBe('Info message');
        });
    });

    describe('success()', () => {
        it('should create toast with toast-success class', () => {
            const toast = ToastManager.success('Success message');

            expect(toast.classList.contains('toast-success')).toBe(true);
        });

        it('should display the message', () => {
            const toast = ToastManager.success('Success message');

            expect(toast.textContent).toBe('Success message');
        });
    });

    describe('warning()', () => {
        it('should create toast with toast-warning class', () => {
            const toast = ToastManager.warning('Warning message');

            expect(toast.classList.contains('toast-warning')).toBe(true);
        });

        it('should display the message', () => {
            const toast = ToastManager.warning('Warning message');

            expect(toast.textContent).toBe('Warning message');
        });
    });

    describe('error()', () => {
        it('should create toast with toast-error class', () => {
            const toast = ToastManager.error('Error message');

            expect(toast.classList.contains('toast-error')).toBe(true);
        });

        it('should display the message', () => {
            const toast = ToastManager.error('Error message');

            expect(toast.textContent).toBe('Error message');
        });
    });

    describe('accessibility', () => {
        it('should set role=alert on toast elements', () => {
            const toast = ToastManager.show('Test message');

            expect(toast.getAttribute('role')).toBe('alert');
        });

        it('should have aria-atomic=true on container', () => {
            ToastManager.init();

            const container = document.getElementById('toast-container');
            expect(container.getAttribute('aria-atomic')).toBe('true');
        });

        it('should have aria-live=polite on container for non-urgent messages', () => {
            ToastManager.init();

            const container = document.getElementById('toast-container');
            expect(container.getAttribute('aria-live')).toBe('polite');
        });
    });

    describe('multiple toasts', () => {
        it('should allow multiple toasts at once', () => {
            ToastManager.show('First message');
            ToastManager.show('Second message');
            ToastManager.show('Third message');

            const container = document.getElementById('toast-container');
            expect(container.children.length).toBe(3);
        });

        it('should dismiss toasts independently', () => {
            ToastManager.show('First message', 'info', 1000);
            ToastManager.show('Second message', 'info', 2000);

            const container = document.getElementById('toast-container');
            expect(container.children.length).toBe(2);

            // After first toast duration
            vi.advanceTimersByTime(1001);

            // First toast should start dismissing (remove visible class)
            const firstToast = container.children[0];
            expect(firstToast.classList.contains('toast-visible')).toBe(false);

            // Second toast should still be visible
            const secondToast = container.children[1];
            expect(secondToast.classList.contains('toast-visible')).toBe(true);
        });
    });

    describe('edge cases', () => {
        it('should handle empty message', () => {
            const toast = ToastManager.show('');

            expect(toast.textContent).toBe('');
            expect(toast).not.toBeNull();
        });

        it('should handle special characters in message', () => {
            const message = '<script>alert("xss")</script>';
            const toast = ToastManager.show(message);

            // textContent should escape HTML
            expect(toast.textContent).toBe(message);
            // Should not contain actual script element
            expect(toast.querySelector('script')).toBeNull();
        });

        it('should handle very long messages', () => {
            const longMessage = 'A'.repeat(1000);
            const toast = ToastManager.show(longMessage);

            expect(toast.textContent).toBe(longMessage);
        });

        it('should handle unicode characters', () => {
            const unicodeMessage = '🎮 Game saved! 日本語 テスト';
            const toast = ToastManager.show(unicodeMessage);

            expect(toast.textContent).toBe(unicodeMessage);
        });
    });
});
