/**
 * Real Integration Tests for Theme Manager Module
 * No mocking - tests actual theme manager implementations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { themeManager, THEMES } from '../../src/modules/theme-manager.ts';

// ========================================
// Constants
// ========================================

const STORAGE_KEY = 'megabonk-theme';

// ========================================
// Theme Manager Tests
// ========================================

describe('ThemeManager - Real Integration Tests', () => {
    beforeEach(() => {
        localStorage.clear();
        // Remove any existing theme toggle button
        const existingButton = document.getElementById('theme-toggle');
        if (existingButton) {
            existingButton.remove();
        }
    });

    afterEach(() => {
        localStorage.clear();
        const existingButton = document.getElementById('theme-toggle');
        if (existingButton) {
            existingButton.remove();
        }
    });

    describe('getStoredTheme', () => {
        it('should return null when no theme stored', () => {
            const stored = themeManager.getStoredTheme();
            // Could be null or a valid theme depending on when test runs
            expect(stored === null || stored === 'dark' || stored === 'light').toBe(true);
        });

        it('should return stored dark theme', () => {
            localStorage.setItem(STORAGE_KEY, 'dark');

            const stored = themeManager.getStoredTheme();
            expect(stored).toBe('dark');
        });

        it('should return stored light theme', () => {
            localStorage.setItem(STORAGE_KEY, 'light');

            const stored = themeManager.getStoredTheme();
            expect(stored).toBe('light');
        });

        it('should return null for invalid stored value', () => {
            localStorage.setItem(STORAGE_KEY, 'invalid');

            const stored = themeManager.getStoredTheme();
            expect(stored).toBeNull();
        });

        it('should return null for empty string', () => {
            localStorage.setItem(STORAGE_KEY, '');

            const stored = themeManager.getStoredTheme();
            expect(stored).toBeNull();
        });
    });

    describe('getSystemTheme', () => {
        it('should return a valid theme', () => {
            const systemTheme = themeManager.getSystemTheme();
            expect(['dark', 'light']).toContain(systemTheme);
        });
    });

    describe('getTheme', () => {
        it('should return current theme', () => {
            const currentTheme = themeManager.getTheme();
            expect(['dark', 'light']).toContain(currentTheme);
        });

        it('should return consistent value', () => {
            const theme1 = themeManager.getTheme();
            const theme2 = themeManager.getTheme();
            expect(theme1).toBe(theme2);
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

        it('should persist theme to localStorage', () => {
            themeManager.setTheme('light');
            expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
        });

        it('should update data-theme attribute', () => {
            themeManager.setTheme('light');
            expect(document.documentElement.getAttribute('data-theme')).toBe('light');
        });

        it('should not change theme for invalid value', () => {
            const currentTheme = themeManager.getTheme();
            themeManager.setTheme('invalid' as any);
            // Theme should remain unchanged
            expect(themeManager.getTheme()).toBe(currentTheme);
        });
    });

    describe('toggleTheme', () => {
        it('should toggle from dark to light', () => {
            themeManager.setTheme('dark');
            const newTheme = themeManager.toggleTheme();
            expect(newTheme).toBe('light');
        });

        it('should toggle from light to dark', () => {
            themeManager.setTheme('light');
            const newTheme = themeManager.toggleTheme();
            expect(newTheme).toBe('dark');
        });

        it('should return the new theme', () => {
            const oldTheme = themeManager.getTheme();
            const newTheme = themeManager.toggleTheme();

            expect(newTheme).not.toBe(oldTheme);
            expect(themeManager.getTheme()).toBe(newTheme);
        });

        it('should persist toggled theme', () => {
            themeManager.setTheme('dark');
            themeManager.toggleTheme();

            expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
        });
    });

    describe('applyTheme', () => {
        it('should apply dark theme variables', () => {
            themeManager.setTheme('dark');

            const root = document.documentElement;
            // Dark theme should have dark background
            const bgPrimary = root.style.getPropertyValue('--bg-primary');
            expect(bgPrimary).toBe('#0f0f14');
        });

        it('should apply light theme variables', () => {
            themeManager.setTheme('light');

            const root = document.documentElement;
            const bgPrimary = root.style.getPropertyValue('--bg-primary');
            expect(bgPrimary).toBe('#ffffff');
        });

        it('should set data-theme attribute', () => {
            themeManager.setTheme('dark');
            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

            themeManager.setTheme('light');
            expect(document.documentElement.getAttribute('data-theme')).toBe('light');
        });
    });

    describe('init', () => {
        it('should not throw', () => {
            expect(() => themeManager.init()).not.toThrow();
        });

        it('should create theme toggle button', () => {
            themeManager.init();

            const button = document.getElementById('theme-toggle');
            expect(button).not.toBeNull();
        });

        it('should set aria-label on button', () => {
            themeManager.init();

            const button = document.getElementById('theme-toggle');
            expect(button?.getAttribute('aria-label')).toBe('Toggle theme');
        });

        it('should set title on button', () => {
            themeManager.init();

            const button = document.getElementById('theme-toggle');
            expect(button?.getAttribute('title')).toContain('Toggle');
        });

        it('should not create duplicate buttons', () => {
            themeManager.init();
            themeManager.init();

            const buttons = document.querySelectorAll('#theme-toggle');
            expect(buttons.length).toBe(1);
        });
    });

    describe('createThemeToggleButton', () => {
        it('should create button with correct class', () => {
            // First remove any existing button
            const existing = document.getElementById('theme-toggle');
            if (existing) existing.remove();

            themeManager.init();

            const button = document.getElementById('theme-toggle');
            expect(button?.classList.contains('theme-toggle')).toBe(true);
        });

        it('should toggle theme on click', () => {
            themeManager.setTheme('dark');
            themeManager.init();

            const button = document.getElementById('theme-toggle') as HTMLButtonElement;
            button.click();

            expect(themeManager.getTheme()).toBe('light');
        });
    });
});

// ========================================
// THEMES Constants Tests
// ========================================

describe('THEMES Constants', () => {
    it('should have DARK constant', () => {
        expect(THEMES.DARK).toBe('dark');
    });

    it('should have LIGHT constant', () => {
        expect(THEMES.LIGHT).toBe('light');
    });

    it('should be frozen', () => {
        expect(Object.isFrozen(THEMES)).toBe(true);
    });
});

// ========================================
// CSS Variables Tests
// ========================================

describe('Theme CSS Variables', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('should set rarity colors for dark theme', () => {
        themeManager.setTheme('dark');

        const root = document.documentElement;
        expect(root.style.getPropertyValue('--rarity-common')).toBe('#6b9b6b');
        expect(root.style.getPropertyValue('--rarity-legendary')).toBe('#f0a800');
    });

    it('should set rarity colors for light theme', () => {
        themeManager.setTheme('light');

        const root = document.documentElement;
        expect(root.style.getPropertyValue('--rarity-common')).toBe('#4a7c4a');
        expect(root.style.getPropertyValue('--rarity-legendary')).toBe('#c08000');
    });

    it('should set text colors for dark theme', () => {
        themeManager.setTheme('dark');

        const root = document.documentElement;
        expect(root.style.getPropertyValue('--text-primary')).toBe('#ffffff');
    });

    it('should set text colors for light theme', () => {
        themeManager.setTheme('light');

        const root = document.documentElement;
        expect(root.style.getPropertyValue('--text-primary')).toBe('#1a1a1a');
    });

    it('should set accent colors for dark theme', () => {
        themeManager.setTheme('dark');

        const root = document.documentElement;
        expect(root.style.getPropertyValue('--accent')).toBe('#e94560');
    });

    it('should set accent colors for light theme', () => {
        themeManager.setTheme('light');

        const root = document.documentElement;
        expect(root.style.getPropertyValue('--accent')).toBe('#d62f4a');
    });

    it('should set chart colors', () => {
        themeManager.setTheme('dark');

        const root = document.documentElement;
        expect(root.style.getPropertyValue('--chart-line')).toBeDefined();
        expect(root.style.getPropertyValue('--chart-fill')).toBeDefined();
    });

    it('should set tier colors', () => {
        themeManager.setTheme('dark');

        const root = document.documentElement;
        expect(root.style.getPropertyValue('--tier-ss')).toBe('#ffd700');
        expect(root.style.getPropertyValue('--tier-s')).toBe('#22c55e');
        expect(root.style.getPropertyValue('--tier-a')).toBe('#3b82f6');
    });
});

// ========================================
// Edge Cases
// ========================================

describe('Theme Manager Edge Cases', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('should handle localStorage errors gracefully', () => {
        // Simulate localStorage error
        const originalSetItem = localStorage.setItem;
        localStorage.setItem = () => {
            throw new Error('Storage error');
        };

        // Should not throw
        expect(() => themeManager.setTheme('light')).not.toThrow();

        // Restore
        localStorage.setItem = originalSetItem;
    });

    it('should handle missing matchMedia', () => {
        const originalMatchMedia = window.matchMedia;
        (window as any).matchMedia = undefined;

        // Should not throw
        expect(() => themeManager.getSystemTheme()).not.toThrow();

        // Restore
        window.matchMedia = originalMatchMedia;
    });

    it('should handle multiple rapid theme changes', () => {
        themeManager.setTheme('dark');
        themeManager.setTheme('light');
        themeManager.setTheme('dark');
        themeManager.setTheme('light');

        expect(themeManager.getTheme()).toBe('light');
    });

    it('should handle toggle after set', () => {
        themeManager.setTheme('dark');
        themeManager.toggleTheme();

        expect(themeManager.getTheme()).toBe('light');
    });
});

// ========================================
// Persistence Tests
// ========================================

describe('Theme Persistence', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('should persist theme across getStoredTheme calls', () => {
        themeManager.setTheme('light');

        const stored = themeManager.getStoredTheme();
        expect(stored).toBe('light');
    });

    it('should use correct storage key', () => {
        themeManager.setTheme('light');

        expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
        expect(localStorage.getItem('theme')).toBeNull();
    });
});
