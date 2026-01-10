import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock logger before importing theme-manager
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

import { themeManager, THEMES } from '../../src/modules/theme-manager.ts';

describe('Theme Manager Module', () => {
    beforeEach(() => {
        // Clear localStorage
        localStorage.clear();

        // Reset document state
        document.documentElement.removeAttribute('data-theme');
        document.documentElement.style.cssText = '';

        // Remove any existing theme toggle button
        const existingToggle = document.getElementById('theme-toggle');
        if (existingToggle) existingToggle.remove();

        vi.clearAllMocks();
    });

    afterEach(() => {
        localStorage.clear();
    });

    describe('THEMES constant', () => {
        it('should have DARK and LIGHT themes', () => {
            expect(THEMES.DARK).toBe('dark');
            expect(THEMES.LIGHT).toBe('light');
        });

        it('should be frozen (immutable)', () => {
            expect(Object.isFrozen(THEMES)).toBe(true);
        });
    });

    describe('getStoredTheme()', () => {
        it('should return null when no theme is stored', () => {
            const theme = themeManager.getStoredTheme();
            expect(theme).toBeNull();
        });

        it('should return stored dark theme', () => {
            localStorage.setItem('megabonk-theme', 'dark');
            const theme = themeManager.getStoredTheme();
            expect(theme).toBe('dark');
        });

        it('should return stored light theme', () => {
            localStorage.setItem('megabonk-theme', 'light');
            const theme = themeManager.getStoredTheme();
            expect(theme).toBe('light');
        });

        it('should return null for invalid stored value', () => {
            localStorage.setItem('megabonk-theme', 'invalid');
            const theme = themeManager.getStoredTheme();
            expect(theme).toBeNull();
        });
    });

    describe('getSystemTheme()', () => {
        it('should return dark when system prefers dark', () => {
            // Mock matchMedia to return dark preference
            window.matchMedia = vi.fn().mockReturnValue({
                matches: true,
                addEventListener: vi.fn(),
            });

            const theme = themeManager.getSystemTheme();
            expect(theme).toBe('dark');
        });

        it('should return light when system prefers light', () => {
            window.matchMedia = vi.fn().mockReturnValue({
                matches: false,
                addEventListener: vi.fn(),
            });

            const theme = themeManager.getSystemTheme();
            expect(theme).toBe('light');
        });
    });

    describe('applyTheme()', () => {
        it('should set data-theme attribute on document', () => {
            themeManager.applyTheme('dark');

            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        });

        it('should apply dark theme CSS variables', () => {
            themeManager.applyTheme('dark');

            const root = document.documentElement;
            expect(root.style.getPropertyValue('--bg-primary')).toBe('#0f0f14');
            expect(root.style.getPropertyValue('--text-primary')).toBe('#ffffff');
        });

        it('should apply light theme CSS variables', () => {
            themeManager.applyTheme('light');

            const root = document.documentElement;
            expect(root.style.getPropertyValue('--bg-primary')).toBe('#ffffff');
            expect(root.style.getPropertyValue('--text-primary')).toBe('#1a1a1a');
        });

        it('should store theme preference in localStorage', () => {
            themeManager.applyTheme('light');

            expect(localStorage.getItem('megabonk-theme')).toBe('light');
        });

        it('should apply rarity color variables', () => {
            themeManager.applyTheme('dark');

            const root = document.documentElement;
            expect(root.style.getPropertyValue('--rarity-common')).toBe('#6b9b6b');
            expect(root.style.getPropertyValue('--rarity-legendary')).toBe('#f0a800');
        });

        it('should apply chart color variables', () => {
            themeManager.applyTheme('dark');

            const root = document.documentElement;
            expect(root.style.getPropertyValue('--chart-line')).toBe('#e94560');
            expect(root.style.getPropertyValue('--chart-grid')).toBe('rgba(255, 255, 255, 0.1)');
        });

        it('should apply tier color variables', () => {
            themeManager.applyTheme('dark');

            const root = document.documentElement;
            expect(root.style.getPropertyValue('--tier-ss')).toBe('#ffd700');
            expect(root.style.getPropertyValue('--tier-s')).toBe('#22c55e');
            expect(root.style.getPropertyValue('--tier-a')).toBe('#3b82f6');
        });
    });

    describe('toggleTheme()', () => {
        it('should toggle from dark to light', () => {
            themeManager.applyTheme('dark');

            const newTheme = themeManager.toggleTheme();

            expect(newTheme).toBe('light');
            expect(document.documentElement.getAttribute('data-theme')).toBe('light');
        });

        it('should toggle from light to dark', () => {
            themeManager.applyTheme('light');

            const newTheme = themeManager.toggleTheme();

            expect(newTheme).toBe('dark');
            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        });

        it('should return the new theme', () => {
            themeManager.applyTheme('dark');

            const result = themeManager.toggleTheme();

            expect(result).toBe('light');
        });
    });

    describe('setTheme()', () => {
        it('should set dark theme', () => {
            themeManager.setTheme('dark');

            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        });

        it('should set light theme', () => {
            themeManager.setTheme('light');

            expect(document.documentElement.getAttribute('data-theme')).toBe('light');
        });

        it('should ignore invalid theme values', () => {
            themeManager.setTheme('dark');
            themeManager.setTheme('invalid');

            // Should still be dark since 'invalid' was ignored
            expect(themeManager.getTheme()).toBe('dark');
        });
    });

    describe('getTheme()', () => {
        it('should return current theme', () => {
            themeManager.applyTheme('light');

            expect(themeManager.getTheme()).toBe('light');
        });

        it('should reflect changes after toggle', () => {
            themeManager.applyTheme('dark');
            themeManager.toggleTheme();

            expect(themeManager.getTheme()).toBe('light');
        });
    });

    describe('init()', () => {
        it('should apply current theme on init', () => {
            themeManager.init();

            // Should have a data-theme attribute
            expect(document.documentElement.hasAttribute('data-theme')).toBe(true);
        });

        it('should create theme toggle button', () => {
            themeManager.init();

            const button = document.getElementById('theme-toggle');
            expect(button).not.toBeNull();
        });

        it('should set up system theme listener', () => {
            const addEventListenerMock = vi.fn();
            window.matchMedia = vi.fn().mockReturnValue({
                matches: true,
                addEventListener: addEventListenerMock,
            });

            themeManager.init();

            expect(addEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));
        });
    });

    describe('createThemeToggleButton()', () => {
        it('should create button with correct ID', () => {
            themeManager.createThemeToggleButton();

            const button = document.getElementById('theme-toggle');
            expect(button).not.toBeNull();
        });

        it('should have correct class name', () => {
            themeManager.createThemeToggleButton();

            const button = document.getElementById('theme-toggle');
            expect(button.classList.contains('theme-toggle')).toBe(true);
        });

        it('should have aria-label attribute', () => {
            themeManager.createThemeToggleButton();

            const button = document.getElementById('theme-toggle');
            expect(button.getAttribute('aria-label')).toBe('Toggle theme');
        });

        it('should have title attribute', () => {
            themeManager.createThemeToggleButton();

            const button = document.getElementById('theme-toggle');
            expect(button.getAttribute('title')).toBe('Toggle dark/light theme (T)');
        });

        it('should show sun emoji in dark mode', () => {
            themeManager.applyTheme('dark');
            themeManager.createThemeToggleButton();

            const button = document.getElementById('theme-toggle');
            expect(button.textContent).toContain('☀️');
        });

        it('should show moon emoji in light mode', () => {
            themeManager.applyTheme('light');
            themeManager.createThemeToggleButton();

            const button = document.getElementById('theme-toggle');
            expect(button.textContent).toContain('🌙');
        });

        it('should toggle theme on click', () => {
            themeManager.applyTheme('dark');
            themeManager.createThemeToggleButton();

            const button = document.getElementById('theme-toggle');
            button.click();

            expect(themeManager.getTheme()).toBe('light');
        });

        it('should not create duplicate buttons', () => {
            themeManager.createThemeToggleButton();
            themeManager.createThemeToggleButton();

            const buttons = document.querySelectorAll('#theme-toggle');
            expect(buttons).toHaveLength(1);
        });

        it('should update button content after toggle', () => {
            themeManager.applyTheme('dark');
            themeManager.createThemeToggleButton();

            const button = document.getElementById('theme-toggle');
            button.click();

            // After clicking in dark mode, should switch to light and show moon
            expect(button.textContent).toContain('🌙');
        });
    });

    describe('localStorage error handling', () => {
        it('should handle localStorage unavailable gracefully', async () => {
            // Mock localStorage to throw
            const originalSetItem = localStorage.setItem;
            localStorage.setItem = vi.fn().mockImplementation(() => {
                throw new Error('Storage not available');
            });

            expect(() => themeManager.applyTheme('dark')).not.toThrow();

            const { logger } = await import('../../src/modules/logger.ts');
            expect(logger.warn).toHaveBeenCalled();

            // Restore original
            localStorage.setItem = originalSetItem;
        });
    });
});
