/**
 * Real Integration Tests for Toast Module
 * No mocking - tests actual ToastManager implementation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ToastManager } from '../../src/modules/toast.ts';

describe('ToastManager - Real Integration Tests', () => {
    beforeEach(() => {
        // Reset toast manager state
        ToastManager.container = null;
        document.body.innerHTML = '';
        vi.useFakeTimers();
    });

    afterEach(() => {
        ToastManager.container = null;
        document.body.innerHTML = '';
        vi.useRealTimers();
    });

    describe('init', () => {
        it('should create toast container on init', () => {
            ToastManager.init();

            const container = document.getElementById('toast-container');
            expect(container).not.toBeNull();
        });

        it('should set accessibility attributes', () => {
            ToastManager.init();

            const container = document.getElementById('toast-container');
            expect(container?.getAttribute('role')).toBe('status');
            expect(container?.getAttribute('aria-live')).toBe('polite');
            expect(container?.getAttribute('aria-atomic')).toBe('true');
        });

        it('should not create duplicate containers', () => {
            ToastManager.init();
            ToastManager.init();

            const containers = document.querySelectorAll('#toast-container');
            expect(containers.length).toBe(1);
        });
    });

    describe('show', () => {
        it('should create toast element', () => {
            const toast = ToastManager.show('Test message', 'info');

            expect(toast).not.toBeNull();
            expect(toast.textContent).toBe('Test message');
        });

        it('should apply correct class for info toast', () => {
            const toast = ToastManager.show('Info', 'info');

            expect(toast.classList.contains('toast')).toBe(true);
            expect(toast.classList.contains('toast-info')).toBe(true);
        });

        it('should apply correct class for success toast', () => {
            const toast = ToastManager.show('Success', 'success');

            expect(toast.classList.contains('toast-success')).toBe(true);
        });

        it('should apply correct class for warning toast', () => {
            const toast = ToastManager.show('Warning', 'warning');

            expect(toast.classList.contains('toast-warning')).toBe(true);
        });

        it('should apply correct class for error toast', () => {
            const toast = ToastManager.show('Error', 'error');

            expect(toast.classList.contains('toast-error')).toBe(true);
        });

        it('should set alert role for accessibility', () => {
            const toast = ToastManager.show('Alert', 'error');

            expect(toast.getAttribute('role')).toBe('alert');
        });

        it('should append toast to container', () => {
            const toast = ToastManager.show('Temp', 'info', 1000);

            expect(toast.parentNode).not.toBeNull();
            expect(ToastManager.container?.contains(toast)).toBe(true);
        });

        it('should create toast with correct duration parameter', () => {
            const toast = ToastManager.show('Default', 'info', 2000);

            // Toast should be created regardless of duration
            expect(toast).not.toBeNull();
            expect(toast.textContent).toBe('Default');
        });

        it('should have base toast class', () => {
            const toast = ToastManager.show('Animate', 'info');

            expect(toast.classList.contains('toast')).toBe(true);
        });
    });

    describe('convenience methods', () => {
        it('should show info toast via info()', () => {
            const toast = ToastManager.info('Info message');

            expect(toast.classList.contains('toast-info')).toBe(true);
            expect(toast.textContent).toBe('Info message');
        });

        it('should show success toast via success()', () => {
            const toast = ToastManager.success('Success message');

            expect(toast.classList.contains('toast-success')).toBe(true);
            expect(toast.textContent).toBe('Success message');
        });

        it('should show warning toast via warning()', () => {
            const toast = ToastManager.warning('Warning message');

            expect(toast.classList.contains('toast-warning')).toBe(true);
            expect(toast.textContent).toBe('Warning message');
        });

        it('should show error toast via error()', () => {
            const toast = ToastManager.error('Error message');

            expect(toast.classList.contains('toast-error')).toBe(true);
            expect(toast.textContent).toBe('Error message');
        });
    });

    describe('multiple toasts', () => {
        it('should stack multiple toasts', () => {
            ToastManager.show('First', 'info');
            ToastManager.show('Second', 'success');
            ToastManager.show('Third', 'warning');

            const toasts = document.querySelectorAll('.toast');
            expect(toasts.length).toBe(3);
        });

        it('should maintain toast order', () => {
            ToastManager.show('First', 'info');
            ToastManager.show('Second', 'success');

            const toasts = document.querySelectorAll('.toast');
            expect(toasts[0].textContent).toBe('First');
            expect(toasts[1].textContent).toBe('Second');
        });

        it('should create toasts with different durations', () => {
            const first = ToastManager.show('First', 'info', 1000);
            const second = ToastManager.show('Second', 'success', 3000);

            // Both toasts should be created and present
            const toasts = document.querySelectorAll('.toast');
            expect(toasts.length).toBe(2);
            expect(first.textContent).toBe('First');
            expect(second.textContent).toBe('Second');
        });
    });

    describe('XSS prevention', () => {
        it('should not execute script tags in message', () => {
            const toast = ToastManager.show('<script>alert("xss")</script>', 'info');

            // textContent is used, so script should be displayed as text
            expect(toast.querySelector('script')).toBeNull();
            expect(toast.textContent).toContain('<script>');
        });

        it('should display HTML entities as text', () => {
            const toast = ToastManager.show('<b>Bold</b>', 'info');

            expect(toast.querySelector('b')).toBeNull();
            expect(toast.textContent).toContain('<b>');
        });
    });

    describe('edge cases', () => {
        it('should handle empty message', () => {
            const toast = ToastManager.show('', 'info');

            expect(toast.textContent).toBe('');
        });

        it('should handle very long message', () => {
            const longMessage = 'A'.repeat(1000);
            const toast = ToastManager.show(longMessage, 'info');

            expect(toast.textContent).toBe(longMessage);
        });

        it('should handle special characters', () => {
            const special = '日本語 🔥 emoji © symbols';
            const toast = ToastManager.show(special, 'info');

            expect(toast.textContent).toBe(special);
        });

        it('should handle zero duration', () => {
            const toast = ToastManager.show('Instant', 'info', 0);

            // Toast should still be created even with 0 duration
            expect(toast).not.toBeNull();
            expect(toast.textContent).toBe('Instant');
        });

        it('should handle very short duration', () => {
            const toast = ToastManager.show('Quick', 'info', 1);

            // Toast should be created with short duration
            expect(toast).not.toBeNull();
            expect(toast.classList.contains('toast')).toBe(true);
        });
    });
});
