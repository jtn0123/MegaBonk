/**
 * @vitest-environment jsdom
 * Theme Manager Module Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { themeManager, THEMES } from '../../src/modules/theme-manager.ts';

describe('Theme Manager', () => {
    let originalMatchMedia: typeof window.matchMedia;
    let mockMatchMedia: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        
        // Reset document styles
        document.documentElement.style.cssText = '';
        document.documentElement.removeAttribute('data-theme');
        
        // Remove any existing theme toggle buttons
        const existingButton = document.getElementById('theme-toggle');
        if (existingButton) {
            existingButton.remove();
        }

        // Mock matchMedia
        originalMatchMedia = window.matchMedia;
        mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
            matches: query === '(prefers-color-scheme: dark)',
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));
        window.matchMedia = mockMatchMedia;
    });

    afterEach(() => {
        window.matchMedia = originalMatchMedia;
        localStorage.clear();
        
        // Cleanup
        const button = document.getElementById('theme-toggle');
        if (button) {
            button.remove();
        }
    });

    // ========================================
    // THEMES Constants Tests
    // ========================================
    describe('THEMES constants', () => {
        it('should have DARK constant', () => {
            expect(THEMES.DARK).toBe('dark');
        });

        it('should have LIGHT constant', () => {
            expect(THEMES.LIGHT).toBe('light');
        });

        it('should be frozen (immutable)', () => {
            expect(Object.isFrozen(THEMES)).toBe(true);
        });
    });

    // ========================================
    // getStoredTheme Tests
    // ========================================
    describe('getStoredTheme', () => {
        it('should return null when no theme is stored', () => {
            expect(themeManager.getStoredTheme()).toBeNull();
        });

        it('should return dark when dark is stored', () => {
            localStorage.setItem('megabonk-theme', 'dark');
            expect(themeManager.getStoredTheme()).toBe('dark');
        });

        it('should return light when light is stored', () => {
            localStorage.setItem('megabonk-theme', 'light');
            expect(themeManager.getStoredTheme()).toBe('light');
        });

        it('should return null for invalid stored value', () => {
            localStorage.setItem('megabonk-theme', 'invalid');
            expect(themeManager.getStoredTheme()).toBeNull();
        });

        it('should handle localStorage errors gracefully', () => {
            const originalGetItem = localStorage.getItem;
            localStorage.getItem = vi.fn().mockImplementation(() => {
                throw new Error('localStorage error');
            });
            
            expect(themeManager.getStoredTheme()).toBeNull();
            
            localStorage.getItem = originalGetItem;
        });
    });

    // ========================================
    // getSystemTheme Tests
    // ========================================
    describe('getSystemTheme', () => {
        it('should return dark when system prefers dark', () => {
            mockMatchMedia.mockImplementation((query: string) => ({
                matches: query === '(prefers-color-scheme: dark)',
                media: query,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            }));
            
            expect(themeManager.getSystemTheme()).toBe('dark');
        });

        it('should return light when system prefers light', () => {
            mockMatchMedia.mockImplementation((query: string) => ({
                matches: false,
                media: query,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            }));
            
            expect(themeManager.getSystemTheme()).toBe('light');
        });

        it('should return light when matchMedia is not available', () => {
            window.matchMedia = undefined as any;
            
            expect(themeManager.getSystemTheme()).toBe('light');
            
            window.matchMedia = mockMatchMedia;
        });
    });

    // ========================================
    // applyTheme Tests
    // ========================================
    describe('applyTheme', () => {
        it('should set data-theme attribute on document', () => {
            themeManager.applyTheme('dark');
            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
            
            themeManager.applyTheme('light');
            expect(document.documentElement.getAttribute('data-theme')).toBe('light');
        });

        it('should store theme in localStorage', () => {
            themeManager.applyTheme('dark');
            expect(localStorage.getItem('megabonk-theme')).toBe('dark');
            
            themeManager.applyTheme('light');
            expect(localStorage.getItem('megabonk-theme')).toBe('light');
        });

        it('should apply dark theme CSS variables', () => {
            themeManager.applyTheme('dark');
            
            const root = document.documentElement;
            expect(root.style.getPropertyValue('--bg-primary')).toBe('#0f0f14');
            expect(root.style.getPropertyValue('--text-primary')).toBe('#ffffff');
            expect(root.style.getPropertyValue('--accent')).toBe('#e94560');
        });

        it('should apply light theme CSS variables', () => {
            themeManager.applyTheme('light');
            
            const root = document.documentElement;
            expect(root.style.getPropertyValue('--bg-primary')).toBe('#ffffff');
            expect(root.style.getPropertyValue('--text-primary')).toBe('#1a1a1a');
            expect(root.style.getPropertyValue('--accent')).toBe('#d62f4a');
        });

        it('should set rarity colors', () => {
            themeManager.applyTheme('dark');
            
            const root = document.documentElement;
            expect(root.style.getPropertyValue('--rarity-common')).toBe('#6b9b6b');
            expect(root.style.getPropertyValue('--rarity-legendary')).toBe('#f0a800');
        });

        it('should set tier colors', () => {
            themeManager.applyTheme('dark');
            
            const root = document.documentElement;
            expect(root.style.getPropertyValue('--tier-ss')).toBe('#ffd700');
            expect(root.style.getPropertyValue('--tier-s')).toBe('#22c55e');
        });

        it('should set chart colors', () => {
            themeManager.applyTheme('dark');
            
            const root = document.documentElement;
            expect(root.style.getPropertyValue('--chart-line')).toBe('#e94560');
        });

        it('should handle localStorage errors gracefully', () => {
            const originalSetItem = localStorage.setItem;
            localStorage.setItem = vi.fn().mockImplementation(() => {
                throw new Error('localStorage error');
            });
            
            // Should not throw
            expect(() => themeManager.applyTheme('dark')).not.toThrow();
            
            localStorage.setItem = originalSetItem;
        });

        it('should update currentTheme state', () => {
            themeManager.applyTheme('light');
            expect(themeManager.getTheme()).toBe('light');
            
            themeManager.applyTheme('dark');
            expect(themeManager.getTheme()).toBe('dark');
        });
    });

    // ========================================
    // toggleTheme Tests
    // ========================================
    describe('toggleTheme', () => {
        it('should toggle from dark to light', () => {
            themeManager.applyTheme('dark');
            
            const newTheme = themeManager.toggleTheme();
            
            expect(newTheme).toBe('light');
            expect(themeManager.getTheme()).toBe('light');
        });

        it('should toggle from light to dark', () => {
            themeManager.applyTheme('light');
            
            const newTheme = themeManager.toggleTheme();
            
            expect(newTheme).toBe('dark');
            expect(themeManager.getTheme()).toBe('dark');
        });

        it('should update CSS variables on toggle', () => {
            themeManager.applyTheme('dark');
            themeManager.toggleTheme();
            
            const root = document.documentElement;
            expect(root.style.getPropertyValue('--bg-primary')).toBe('#ffffff');
        });

        it('should persist toggled theme', () => {
            themeManager.applyTheme('dark');
            themeManager.toggleTheme();
            
            expect(localStorage.getItem('megabonk-theme')).toBe('light');
        });
    });

    // ========================================
    // setTheme Tests
    // ========================================
    describe('setTheme', () => {
        it('should set dark theme', () => {
            themeManager.setTheme('dark');
            expect(themeManager.getTheme()).toBe('dark');
        });

        it('should set light theme', () => {
            themeManager.setTheme('light');
            expect(themeManager.getTheme()).toBe('light');
        });

        it('should ignore invalid theme values', () => {
            themeManager.applyTheme('dark');
            themeManager.setTheme('invalid' as any);
            
            // Should remain dark
            expect(themeManager.getTheme()).toBe('dark');
        });
    });

    // ========================================
    // getTheme Tests
    // ========================================
    describe('getTheme', () => {
        it('should return current theme', () => {
            themeManager.applyTheme('dark');
            expect(themeManager.getTheme()).toBe('dark');
            
            themeManager.applyTheme('light');
            expect(themeManager.getTheme()).toBe('light');
        });
    });

    // ========================================
    // init Tests
    // ========================================
    describe('init', () => {
        it('should apply initial theme', () => {
            themeManager.init();
            
            expect(document.documentElement.getAttribute('data-theme')).toBeTruthy();
        });

        it('should create theme toggle button', () => {
            themeManager.init();
            
            const button = document.getElementById('theme-toggle');
            expect(button).not.toBeNull();
        });

        it('should set button accessibility attributes', () => {
            themeManager.init();
            
            const button = document.getElementById('theme-toggle');
            expect(button?.getAttribute('aria-label')).toBe('Toggle theme');
            expect(button?.getAttribute('title')).toContain('Toggle');
        });

        it('should not create duplicate buttons on multiple inits', () => {
            themeManager.init();
            themeManager.init();
            themeManager.init();
            
            const buttons = document.querySelectorAll('#theme-toggle');
            expect(buttons.length).toBe(1);
        });
    });

    // ========================================
    // createThemeToggleButton Tests
    // ========================================
    describe('createThemeToggleButton', () => {
        it('should create button with correct id', () => {
            themeManager.createThemeToggleButton();
            
            const button = document.getElementById('theme-toggle');
            expect(button).not.toBeNull();
        });

        it('should have theme-toggle class', () => {
            themeManager.createThemeToggleButton();
            
            const button = document.getElementById('theme-toggle');
            expect(button?.classList.contains('theme-toggle')).toBe(true);
        });

        it('should show sun emoji when in dark mode', () => {
            themeManager.applyTheme('dark');
            themeManager.createThemeToggleButton();
            
            const button = document.getElementById('theme-toggle');
            expect(button?.innerHTML).toBe('☀️');
        });

        it('should show moon emoji when in light mode', () => {
            themeManager.applyTheme('light');
            themeManager.createThemeToggleButton();
            
            const button = document.getElementById('theme-toggle');
            expect(button?.innerHTML).toBe('🌙');
        });

        it('should toggle theme on click', () => {
            themeManager.applyTheme('dark');
            themeManager.createThemeToggleButton();
            
            const button = document.getElementById('theme-toggle');
            button?.click();
            
            expect(themeManager.getTheme()).toBe('light');
        });

        it('should update button content on click', () => {
            themeManager.applyTheme('dark');
            themeManager.createThemeToggleButton();
            
            const button = document.getElementById('theme-toggle');
            button?.click();
            
            expect(button?.innerHTML).toBe('🌙');
        });
    });

    // ========================================
    // System Theme Change Listener Tests
    // ========================================
    describe('system theme change listener', () => {
        it('should register listener for system theme changes', () => {
            const addEventListenerMock = vi.fn();
            mockMatchMedia.mockImplementation(() => ({
                matches: false,
                addEventListener: addEventListenerMock,
            }));
            
            themeManager.init();
            
            expect(addEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));
        });
    });

    // ========================================
    // CSS Variables Tests
    // ========================================
    describe('CSS variables', () => {
        it('should set all required dark theme variables', () => {
            themeManager.applyTheme('dark');
            const root = document.documentElement;
            
            const requiredVars = [
                '--rarity-common',
                '--rarity-uncommon',
                '--rarity-rare',
                '--rarity-epic',
                '--rarity-legendary',
                '--bg-primary',
                '--bg-elevated',
                '--bg-subtle',
                '--text-primary',
                '--text-secondary',
                '--accent',
                '--accent-hover',
                '--chart-line',
                '--chart-fill',
                '--chart-grid',
                '--chart-text',
                '--tier-ss',
                '--tier-s',
                '--tier-a',
                '--tier-b',
                '--tier-c',
            ];
            
            requiredVars.forEach(varName => {
                expect(root.style.getPropertyValue(varName)).not.toBe('');
            });
        });

        it('should set all required light theme variables', () => {
            themeManager.applyTheme('light');
            const root = document.documentElement;
            
            // Just check a few key ones differ from dark
            expect(root.style.getPropertyValue('--bg-primary')).toBe('#ffffff');
            expect(root.style.getPropertyValue('--text-primary')).toBe('#1a1a1a');
        });
    });
});
