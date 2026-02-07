// ========================================
// Keyboard Shortcuts Module
// ========================================
// Provides keyboard navigation and shortcuts help modal
// ========================================

// ========================================
// Type Definitions
// ========================================

/**
 * Individual keyboard shortcut definition
 */
interface Shortcut {
    keys: string[];
    description: string;
}

/**
 * Shortcut category definition
 */
interface ShortcutCategory {
    category: string;
    shortcuts: Shortcut[];
}

// ========================================
// Module State
// ========================================

/**
 * Reference to the keydown handler for cleanup
 * We store the handler function so we can remove it later
 */
let keydownHandler: ((e: KeyboardEvent) => void) | null = null;

// ========================================
// Constants
// ========================================

/**
 * Keyboard shortcut definitions
 */
const SHORTCUTS: readonly ShortcutCategory[] = Object.freeze([
    {
        category: 'Navigation',
        shortcuts: [
            { keys: ['1'], description: 'Switch to Items tab' },
            { keys: ['2'], description: 'Switch to Weapons tab' },
            { keys: ['3'], description: 'Switch to Tomes tab' },
            { keys: ['4'], description: 'Switch to Characters tab' },
            { keys: ['5'], description: 'Switch to Shrines tab' },
            { keys: ['6'], description: 'Switch to Build Planner tab' },
            { keys: ['7'], description: 'Switch to Calculator tab' },
            { keys: ['8'], description: 'Switch to Changelog tab' },
        ],
    },
    {
        category: 'Search & Filter',
        shortcuts: [
            { keys: ['/'], description: 'Focus search box' },
            { keys: ['Ctrl', 'F'], description: 'Focus search box (alternative)' },
            { keys: ['Escape'], description: 'Clear search and focus' },
            { keys: ['Ctrl', 'K'], description: 'Clear all filters' },
        ],
    },
    {
        category: 'View',
        shortcuts: [
            { keys: ['G'], description: 'Toggle grid view' },
            { keys: ['L'], description: 'Toggle list view' },
            { keys: ['C'], description: 'Toggle compare mode' },
            { keys: ['T'], description: 'Toggle dark/light theme' },
        ],
    },
    {
        category: 'Modal',
        shortcuts: [
            { keys: ['Escape'], description: 'Close modal/dialog' },
            { keys: ['Enter'], description: 'Confirm action in modal' },
        ],
    },
    {
        category: 'Help',
        shortcuts: [
            { keys: ['?'], description: 'Show keyboard shortcuts' },
            { keys: ['Shift', '?'], description: 'Show keyboard shortcuts' },
        ],
    },
]);

// ========================================
// Exported Functions
// ========================================

/**
 * Show keyboard shortcuts modal
 */
export function showShortcutsModal(): void {
    // Remove existing modal if any
    const existing = document.getElementById('shortcuts-modal');
    if (existing) {
        existing.remove();
        return;
    }

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'shortcuts-modal';
    modal.className = 'modal shortcuts-modal';

    const categoriesHtml = SHORTCUTS.map(
        category => `
        <div class="shortcuts-category">
            <h3 class="shortcuts-category-title">${category.category}</h3>
            <div class="shortcuts-list">
                ${category.shortcuts
                    .map(
                        shortcut => `
                    <div class="shortcut-item">
                        <div class="shortcut-keys">
                            ${shortcut.keys
                                .map(key => `<kbd class="shortcut-key">${key}</kbd>`)
                                .join('<span class="key-separator">+</span>')}
                        </div>
                        <div class="shortcut-description">${shortcut.description}</div>
                    </div>
                `
                    )
                    .join('')}
            </div>
        </div>
    `
    ).join('');

    modal.innerHTML = `
        <div class="modal-content shortcuts-modal-content">
            <button class="modal-close" id="shortcuts-modal-close">&times;</button>
            <div class="modal-header">
                <h2>⌨️ Keyboard Shortcuts</h2>
                <p class="modal-subtitle">Navigate faster with keyboard shortcuts</p>
            </div>
            <div class="modal-body shortcuts-modal-body">
                ${categoriesHtml}
            </div>
            <div class="modal-footer">
                <p class="shortcuts-tip">
                    💡 Tip: Press <kbd>?</kbd> anytime to toggle this help
                </p>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Set display to block first (CSS has display: none by default)
    modal.style.display = 'block';

    // Use AbortController to clean up all listeners when modal closes
    const abortController = new AbortController();
    const { signal } = abortController;

    const closeModal = (): void => {
        abortController.abort(); // Clean up all listeners
        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
        // Wait for animation before removing
        setTimeout(() => {
            modal.remove();
        }, 300);
    };

    // Add event listeners with signal for automatic cleanup
    const closeBtn = document.getElementById('shortcuts-modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal, { signal });
    }

    // Close on backdrop click
    modal.addEventListener(
        'click',
        (e: MouseEvent) => {
            if (e.target === modal) {
                closeModal();
            }
        },
        { signal }
    );

    // Close on Escape
    document.addEventListener(
        'keydown',
        (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closeModal();
            }
        },
        { signal }
    );

    // Show modal with animation
    requestAnimationFrame(() => {
        modal.classList.add('active');
        // Prevent body scroll on mobile when modal is open
        document.body.classList.add('modal-open');
    });
}

/**
 * Clean up keyboard shortcut event listeners
 * Call this in test teardown or when unmounting
 */
export function cleanupKeyboardShortcuts(): void {
    if (keydownHandler) {
        document.removeEventListener('keydown', keydownHandler);
        keydownHandler = null;
    }
}

/**
 * Setup keyboard shortcut handlers
 */
export function setupKeyboardShortcuts(): void {
    // Clean up existing listener first to prevent stacking
    cleanupKeyboardShortcuts();

    keydownHandler = (e: KeyboardEvent) => {
        // Ignore shortcuts when typing in inputs
        const target = e.target as HTMLElement;
        if (target && target.matches && target.matches('input, textarea, select')) {
            return;
        }

        // Help modal toggle
        if (e.key === '?' || (e.shiftKey && e.key === '?')) {
            e.preventDefault();
            showShortcutsModal();
            return;
        }

        // Tab navigation (1-9)
        if (e.key >= '1' && e.key <= '9' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            const tabs = [
                'items',
                'weapons',
                'tomes',
                'characters',
                'shrines',
                'build-planner',
                'calculator',
                'advisor',
                'changelog',
            ];
            const tabIndex = parseInt(e.key) - 1;
            const tabBtn = document.querySelector<HTMLElement>(`[data-tab="${tabs[tabIndex]}"]`);
            if (tabBtn) {
                tabBtn.click();
            }
            return;
        }

        // Search focus
        if (e.key === '/' || (e.ctrlKey && e.key === 'f')) {
            e.preventDefault();
            const searchInput = document.getElementById('searchInput') as HTMLInputElement | null;
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
            return;
        }

        // Clear filters
        if (e.ctrlKey && e.key === 'k') {
            e.preventDefault();
            const clearBtn = document.querySelector<HTMLElement>('[onclick="clearFilters()"]');
            if (clearBtn) {
                clearBtn.click();
            }
            return;
        }

        // Escape - clear search and focus
        if (e.key === 'Escape') {
            const searchInput = document.getElementById('searchInput') as HTMLInputElement | null;
            if (searchInput && searchInput.value) {
                e.preventDefault();
                searchInput.value = '';
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                searchInput.blur();
            }
            return;
        }

        // View toggles
        if (e.key.toLowerCase() === 'g') {
            e.preventDefault();
            const gridBtn = document.querySelector<HTMLElement>('[data-view="grid"]');
            if (gridBtn) {
                gridBtn.click();
            }
            return;
        }

        if (e.key.toLowerCase() === 'l') {
            e.preventDefault();
            const listBtn = document.querySelector<HTMLElement>('[data-view="list"]');
            if (listBtn) {
                listBtn.click();
            }
            return;
        }

        if (e.key.toLowerCase() === 'c') {
            e.preventDefault();
            const compareBtn = document.getElementById('compare-mode-toggle');
            if (compareBtn) {
                compareBtn.click();
            }
            return;
        }

        // Theme toggle
        if (e.key.toLowerCase() === 't') {
            e.preventDefault();
            const themeBtn = document.getElementById('theme-toggle');
            if (themeBtn) {
                themeBtn.click();
            }
            return;
        }
    };

    document.addEventListener('keydown', keydownHandler);
}

/**
 * Get all registered shortcuts
 * @returns All shortcuts
 */
export function getAllShortcuts(): readonly ShortcutCategory[] {
    return SHORTCUTS;
}
