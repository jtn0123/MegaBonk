/**
 * Comprehensive tests for theme-manager.ts module
 * Tests theme switching, localStorage persistence, and UI
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock logger
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

import { themeManager, THEMES } from '../../src/modules/theme-manager.ts';
import { logger } from '../../src/modules/logger.ts';

describe('ThemeManager', () => {
    let matchMediaMock: ReturnType<typeof vi.fn>;
    let addEventListenerMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
        document.documentElement.removeAttribute('data-theme');
        localStorage.clear();

        // Mock matchMedia
        addEventListenerMock = vi.fn();
        matchMediaMock = vi.fn().mockReturnValue({
            matches: false,
            addEventListener: addEventListenerMock,
        });
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: matchMediaMock,
        });
    });

    afterEach(() => {
        // Clean up theme toggle button
        const button = document.getElementById('theme-toggle');
        if (button) button.remove();
    });

    describe('THEMES constant', () => {
        it('should have DARK theme', () => {
            expect(THEMES.DARK).toBe('dark');
        });

        it('should have LIGHT theme', () => {
            expect(THEMES.LIGHT).toBe('light');
        });
    });

    describe('getStoredTheme', () => {
        it('should return null when no theme stored', () => {
            const theme = themeManager.getStoredTheme();
            expect(theme).toBeNull();
        });

        it('should return dark when dark is stored', () => {
            localStorage.setItem('megabonk-theme', 'dark');
            const theme = themeManager.getStoredTheme();
            expect(theme).toBe('dark');
        });

        it('should return light when light is stored', () => {
            localStorage.setItem('megabonk-theme', 'light');
            const theme = themeManager.getStoredTheme();
            expect(theme).toBe('light');
        });

        it('should return null for invalid stored value', () => {
            localStorage.setItem('megabonk-theme', 'invalid');
            const theme = themeManager.getStoredTheme();
            expect(theme).toBeNull();
        });

        it('should handle localStorage error', () => {
            const originalGetItem = localStorage.getItem;
            localStorage.getItem = vi.fn(() => {
                throw new Error('Storage unavailable');
            });

            const theme = themeManager.getStoredTheme();
            expect(theme).toBeNull();

            localStorage.getItem = originalGetItem;
        });
    });

    describe('getSystemTheme', () => {
        it('should return dark when system prefers dark', () => {
            matchMediaMock.mockReturnValue({
                matches: true,
                addEventListener: addEventListenerMock,
            });

            const theme = themeManager.getSystemTheme();
            expect(theme).toBe('dark');
        });

        it('should return light when system prefers light', () => {
            matchMediaMock.mockReturnValue({
                matches: false,
                addEventListener: addEventListenerMock,
            });

            const theme = themeManager.getSystemTheme();
            expect(theme).toBe('light');
        });

        it('should query prefers-color-scheme media query', () => {
            themeManager.getSystemTheme();
            expect(matchMediaMock).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
        });
    });

    describe('applyTheme', () => {
        it('should set data-theme attribute to dark', () => {
            themeManager.applyTheme('dark');
            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        });

        it('should set data-theme attribute to light', () => {
            themeManager.applyTheme('light');
            expect(document.documentElement.getAttribute('data-theme')).toBe('light');
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

        it('should store theme in localStorage', () => {
            themeManager.applyTheme('dark');
            expect(localStorage.getItem('megabonk-theme')).toBe('dark');
        });

        it('should log warning on localStorage error', () => {
            const originalSetItem = localStorage.setItem;
            localStorage.setItem = vi.fn(() => {
                throw new Error('Storage full');
            });

            themeManager.applyTheme('dark');

            expect(logger.warn).toHaveBeenCalledWith({
                operation: 'theme.storage',
                error: { name: 'StorageError', message: 'Failed to store theme preference', module: 'theme-manager' },
            });

            localStorage.setItem = originalSetItem;
        });
    });

    describe('toggleTheme', () => {
        it('should toggle from dark to light', () => {
            themeManager.applyTheme('dark');
            const newTheme = themeManager.toggleTheme();
            expect(newTheme).toBe('light');
        });

        it('should toggle from light to dark', () => {
            themeManager.applyTheme('light');
            const newTheme = themeManager.toggleTheme();
            expect(newTheme).toBe('dark');
        });

        it('should apply the new theme', () => {
            themeManager.applyTheme('dark');
            themeManager.toggleTheme();
            expect(document.documentElement.getAttribute('data-theme')).toBe('light');
        });
    });

    describe('setTheme', () => {
        it('should set dark theme', () => {
            themeManager.setTheme('dark');
            expect(themeManager.getTheme()).toBe('dark');
        });

        it('should set light theme', () => {
            themeManager.setTheme('light');
            expect(themeManager.getTheme()).toBe('light');
        });

        it('should ignore invalid theme', () => {
            themeManager.setTheme('dark');
            themeManager.setTheme('invalid' as any);
            expect(themeManager.getTheme()).toBe('dark');
        });
    });

    describe('getTheme', () => {
        it('should return current theme', () => {
            themeManager.applyTheme('light');
            expect(themeManager.getTheme()).toBe('light');
        });
    });

    describe('init', () => {
        it('should apply initial theme', () => {
            themeManager.init();
            expect(document.documentElement.getAttribute('data-theme')).not.toBeNull();
        });

        it('should create theme toggle button', () => {
            themeManager.init();
            const button = document.getElementById('theme-toggle');
            expect(button).not.toBeNull();
        });

        it('should listen for system theme changes', () => {
            themeManager.init();
            expect(addEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));
        });
    });

    describe('createThemeToggleButton', () => {
        it('should create button with correct ID', () => {
            themeManager.createThemeToggleButton();
            const button = document.getElementById('theme-toggle');
            expect(button).not.toBeNull();
        });

        it('should have theme-toggle class', () => {
            themeManager.createThemeToggleButton();
            const button = document.getElementById('theme-toggle');
            expect(button?.className).toContain('theme-toggle');
        });

        it('should have aria-label', () => {
            themeManager.createThemeToggleButton();
            const button = document.getElementById('theme-toggle');
            expect(button?.getAttribute('aria-label')).toBe('Toggle theme');
        });

        it('should not create duplicate buttons', () => {
            themeManager.createThemeToggleButton();
            themeManager.createThemeToggleButton();
            const buttons = document.querySelectorAll('#theme-toggle');
            expect(buttons.length).toBe(1);
        });

        it('should show sun emoji in dark mode', () => {
            themeManager.applyTheme('dark');
            themeManager.createThemeToggleButton();
            const button = document.getElementById('theme-toggle');
            expect(button?.innerHTML).toContain('☀️');
        });

        it('should show moon emoji in light mode', () => {
            themeManager.applyTheme('light');
            // Remove existing button first
            const existing = document.getElementById('theme-toggle');
            if (existing) existing.remove();

            themeManager.createThemeToggleButton();
            const button = document.getElementById('theme-toggle');
            expect(button?.innerHTML).toContain('🌙');
        });

        it('should toggle theme on click', () => {
            themeManager.applyTheme('dark');
            themeManager.createThemeToggleButton();
            const button = document.getElementById('theme-toggle') as HTMLButtonElement;

            button.click();

            expect(themeManager.getTheme()).toBe('light');
        });
    });

    describe('system theme change listener', () => {
        it('should register listener for system theme changes', () => {
            themeManager.init();
            expect(addEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));
        });

        it('should not auto-switch when user preference stored', () => {
            localStorage.setItem('megabonk-theme', 'light');
            themeManager.applyTheme('light');
            themeManager.init();

            // Get the change handler that was registered
            const changeHandler = addEventListenerMock.mock.calls.find(
                (call: any[]) => call[0] === 'change'
            )?.[1];

            if (changeHandler) {
                // Simulate system theme change
                changeHandler({ matches: true }); // Dark mode

                // Should remain light because user preference is stored
                expect(themeManager.getTheme()).toBe('light');
            }
        });
    });

    describe('CSS variables', () => {
        it('should set all rarity colors', () => {
            themeManager.applyTheme('dark');
            const root = document.documentElement;

            expect(root.style.getPropertyValue('--rarity-common')).toBeTruthy();
            expect(root.style.getPropertyValue('--rarity-uncommon')).toBeTruthy();
            expect(root.style.getPropertyValue('--rarity-rare')).toBeTruthy();
            expect(root.style.getPropertyValue('--rarity-epic')).toBeTruthy();
            expect(root.style.getPropertyValue('--rarity-legendary')).toBeTruthy();
        });

        it('should set all tier colors', () => {
            themeManager.applyTheme('dark');
            const root = document.documentElement;

            expect(root.style.getPropertyValue('--tier-ss')).toBeTruthy();
            expect(root.style.getPropertyValue('--tier-s')).toBeTruthy();
            expect(root.style.getPropertyValue('--tier-a')).toBeTruthy();
            expect(root.style.getPropertyValue('--tier-b')).toBeTruthy();
            expect(root.style.getPropertyValue('--tier-c')).toBeTruthy();
        });

        it('should set chart colors', () => {
            themeManager.applyTheme('dark');
            const root = document.documentElement;

            expect(root.style.getPropertyValue('--chart-line')).toBeTruthy();
            expect(root.style.getPropertyValue('--chart-fill')).toBeTruthy();
            expect(root.style.getPropertyValue('--chart-grid')).toBeTruthy();
            expect(root.style.getPropertyValue('--chart-text')).toBeTruthy();
        });
    });
});
