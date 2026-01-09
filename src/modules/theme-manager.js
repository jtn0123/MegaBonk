// ========================================
// Theme Manager Module
// ========================================
// Handles dark/light theme switching with localStorage persistence
// ========================================

/**
 * Theme constants
 */
const THEMES = {
    DARK: 'dark',
    LIGHT: 'light',
};

const STORAGE_KEY = 'megabonk-theme';

/**
 * Light theme CSS variables
 */
const LIGHT_THEME = {
    // Rarity colors (adjusted for light mode)
    '--rarity-common': '#4a7c4a',
    '--rarity-uncommon': '#2a8ca0',
    '--rarity-rare': '#9c2db0',
    '--rarity-epic': '#6b3cc6',
    '--rarity-legendary': '#c08000',

    // Backgrounds
    '--bg-primary': '#ffffff',
    '--bg-elevated': '#f5f5f5',
    '--bg-subtle': '#e5e5e5',

    // Text
    '--text-primary': '#1a1a1a',
    '--text-secondary': '#666666',

    // Interactive
    '--accent': '#d62f4a',
    '--accent-hover': '#c91d38',

    // Chart colors
    '--chart-line': '#d62f4a',
    '--chart-fill': 'rgba(214, 47, 74, 0.1)',
    '--chart-grid': 'rgba(0, 0, 0, 0.1)',
    '--chart-text': '#666666',

    // Tier colors (same as dark mode)
    '--tier-ss': '#ffd700',
    '--tier-s': '#22c55e',
    '--tier-a': '#3b82f6',
    '--tier-b': '#f59e0b',
    '--tier-c': '#ef4444',
};

/**
 * Dark theme CSS variables (default)
 */
const DARK_THEME = {
    '--rarity-common': '#6b9b6b',
    '--rarity-uncommon': '#5bb8d0',
    '--rarity-rare': '#c94de0',
    '--rarity-epic': '#8b5cf6',
    '--rarity-legendary': '#f0a800',

    '--bg-primary': '#0f0f14',
    '--bg-elevated': '#1a1a24',
    '--bg-subtle': '#252530',

    '--text-primary': '#ffffff',
    '--text-secondary': '#8b8b9b',

    '--accent': '#e94560',
    '--accent-hover': '#ff6b8a',

    '--chart-line': '#e94560',
    '--chart-fill': 'rgba(233, 69, 96, 0.2)',
    '--chart-grid': 'rgba(255, 255, 255, 0.1)',
    '--chart-text': '#8b8b9b',

    '--tier-ss': '#ffd700',
    '--tier-s': '#22c55e',
    '--tier-a': '#3b82f6',
    '--tier-b': '#f59e0b',
    '--tier-c': '#ef4444',
};

/**
 * ThemeManager class
 */
class ThemeManager {
    constructor() {
        this.currentTheme = this.getStoredTheme() || this.getSystemTheme();
    }

    /**
     * Get stored theme from localStorage
     * @returns {string|null} Stored theme or null
     */
    getStoredTheme() {
        try {
            return localStorage.getItem(STORAGE_KEY);
        } catch {
            return null;
        }
    }

    /**
     * Get system theme preference
     * @returns {string} System theme (dark or light)
     */
    getSystemTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return THEMES.DARK;
        }
        return THEMES.LIGHT;
    }

    /**
     * Apply theme variables to document
     * @param {string} theme - Theme to apply
     */
    applyTheme(theme) {
        const root = document.documentElement;
        const themeVars = theme === THEMES.LIGHT ? LIGHT_THEME : DARK_THEME;

        Object.entries(themeVars).forEach(([property, value]) => {
            root.style.setProperty(property, value);
        });

        // Update data-theme attribute
        root.setAttribute('data-theme', theme);

        // Update current theme
        this.currentTheme = theme;

        // Store preference
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch (error) {
            console.warn('Failed to store theme preference:', error);
        }
    }

    /**
     * Toggle between dark and light themes
     * @returns {string} New theme
     */
    toggleTheme() {
        const newTheme = this.currentTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
        this.applyTheme(newTheme);
        return newTheme;
    }

    /**
     * Set specific theme
     * @param {string} theme - Theme to set
     */
    setTheme(theme) {
        if (theme === THEMES.DARK || theme === THEMES.LIGHT) {
            this.applyTheme(theme);
        }
    }

    /**
     * Get current theme
     * @returns {string} Current theme
     */
    getTheme() {
        return this.currentTheme;
    }

    /**
     * Initialize theme manager
     */
    init() {
        // Apply initial theme
        this.applyTheme(this.currentTheme);

        // Listen for system theme changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
                // Only auto-switch if no user preference is stored
                if (!this.getStoredTheme()) {
                    const newTheme = e.matches ? THEMES.DARK : THEMES.LIGHT;
                    this.applyTheme(newTheme);
                }
            });
        }

        // Create and add theme toggle button
        this.createThemeToggleButton();
    }

    /**
     * Create theme toggle button in UI
     */
    createThemeToggleButton() {
        // Check if button already exists
        if (document.getElementById('theme-toggle')) {
            return;
        }

        // Create button
        const button = document.createElement('button');
        button.id = 'theme-toggle';
        button.className = 'theme-toggle';
        button.setAttribute('aria-label', 'Toggle theme');
        button.setAttribute('title', 'Toggle dark/light theme (T)');

        // Update button content based on current theme
        const updateButtonContent = () => {
            button.innerHTML =
                this.currentTheme === THEMES.DARK
                    ? '☀️' // Sun for light mode
                    : '🌙'; // Moon for dark mode
        };

        updateButtonContent();

        // Add click handler
        button.addEventListener('click', () => {
            this.toggleTheme();
            updateButtonContent();
        });

        // Add to page (top-right corner)
        document.body.appendChild(button);
    }
}

// Create singleton instance
const themeManager = new ThemeManager();

// Export singleton instance
export { themeManager, THEMES };
