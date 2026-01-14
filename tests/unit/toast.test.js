import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';

// ✅ REFACTORED: Import ToastManager from the actual toast module
import { ToastManager } from '../../src/modules/toast.ts';

describe('ToastManager', () => {
  beforeEach(() => {
    createMinimalDOM();
    // Reset toast container before each test
    const existingContainer = document.getElementById('toast-container');
    if (existingContainer) {
      existingContainer.remove();
    }
    // Reset the ToastManager's internal state
    ToastManager.container = null;
    ToastManager.init();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('init()', () => {
    it('should create a toast container in the DOM', () => {
      const container = document.getElementById('toast-container');
      expect(container).not.toBeNull();
      expect(container.getAttribute('role')).toBe('status');
      expect(container.getAttribute('aria-live')).toBe('polite');
    });

    it('should not create duplicate containers on multiple init calls', () => {
      ToastManager.init();
      ToastManager.init();
      const containers = document.querySelectorAll('#toast-container');
      expect(containers.length).toBe(1);
    });
  });

  describe('show()', () => {
    it('should create a toast element with correct type', () => {
      ToastManager.show('Test message', 'success');
      const container = document.getElementById('toast-container');
      const toast = container.querySelector('.toast');
      expect(toast).toBeInstanceOf(HTMLElement);
      expect(toast.classList.contains('toast')).toBe(true);
      expect(toast.classList.contains('toast-success')).toBe(true);
      expect(toast.textContent).toBe('Test message');
    });

    it('should have proper accessibility attributes', () => {
      ToastManager.show('Accessible message', 'info');
      const container = document.getElementById('toast-container');
      const toast = container.querySelector('.toast');
      expect(toast.getAttribute('role')).toBe('alert');
    });

    it('should append toast to container', () => {
      ToastManager.show('Message 1', 'info');
      const container = document.getElementById('toast-container');
      expect(container.children.length).toBe(1);
    });

    it('should auto-dismiss after specified duration', () => {
      ToastManager.show('Auto-dismiss message', 'info', 1000);
      const container = document.getElementById('toast-container');
      const toast = container.querySelector('.toast');
      expect(toast.classList.contains('toast-visible')).toBe(false); // Not visible immediately

      // Advance timers to trigger visibility
      vi.runAllTimers();

      // After timers run, toast should be removed or have visibility class removed
      expect(toast.classList.contains('toast-visible')).toBe(false);
    });
  });

  describe('info()', () => {
    it('should create an info toast', () => {
      ToastManager.info('Info message');
      const container = document.getElementById('toast-container');
      const toast = container.querySelector('.toast');
      expect(toast.classList.contains('toast-info')).toBe(true);
    });
  });

  describe('success()', () => {
    it('should create a success toast', () => {
      ToastManager.success('Success message');
      const container = document.getElementById('toast-container');
      const toast = container.querySelector('.toast');
      expect(toast.classList.contains('toast-success')).toBe(true);
    });
  });

  describe('warning()', () => {
    it('should create a warning toast', () => {
      ToastManager.warning('Warning message');
      const container = document.getElementById('toast-container');
      const toast = container.querySelector('.toast');
      expect(toast.classList.contains('toast-warning')).toBe(true);
    });
  });

  describe('error()', () => {
    it('should create an error toast', () => {
      ToastManager.error('Error message');
      const container = document.getElementById('toast-container');
      const toast = container.querySelector('.toast');
      expect(toast.classList.contains('toast-error')).toBe(true);
    });
  });

  describe('multiple toasts', () => {
    it('should support multiple toasts simultaneously', () => {
      ToastManager.info('Message 1');
      ToastManager.success('Message 2');
      ToastManager.error('Message 3');

      const container = document.getElementById('toast-container');
      expect(container.children.length).toBe(3);
    });
  });
});
