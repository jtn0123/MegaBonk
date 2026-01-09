// ========================================
// MegaBonk Toast Notification Module
// ========================================

/**
 * Toast notification manager for user feedback
 * Replaces browser alert() with modern, styled notifications
 */
const ToastManager = {
    container: null,

    /**
     * Initialize the toast container
     */
    init() {
        if (this.container) return;

        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        this.container.setAttribute('role', 'status');
        this.container.setAttribute('aria-live', 'polite');
        this.container.setAttribute('aria-atomic', 'true');
        document.body.appendChild(this.container);
    },

    /**
     * Show a toast notification
     * @param {string} message - Message to display
     * @param {string} type - Toast type: 'info', 'success', 'warning', 'error'
     * @param {number} duration - Duration in ms (default 3000)
     */
    show(message, type = 'info', duration = 3000) {
        this.init();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.setAttribute('role', 'alert');

        this.container.appendChild(toast);

        // Trigger entrance animation
        requestAnimationFrame(() => {
            toast.classList.add('toast-visible');
        });

        // Auto-dismiss
        setTimeout(() => {
            toast.classList.remove('toast-visible');

            // Use { once: true } to prevent memory leak
            toast.addEventListener(
                'transitionend',
                () => {
                    if (toast.parentNode) {
                        toast.remove();
                    }
                },
                { once: true }
            );

            // Fallback timeout to ensure removal even if transition doesn't fire
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 500); // Max transition duration
        }, duration);
    },

    /**
     * Show info toast
     * @param {string} message - Message to display
     */
    info(message) {
        this.show(message, 'info');
    },

    /**
     * Show success toast
     * @param {string} message - Message to display
     */
    success(message) {
        this.show(message, 'success');
    },

    /**
     * Show warning toast
     * @param {string} message - Message to display
     */
    warning(message) {
        this.show(message, 'warning');
    },

    /**
     * Show error toast
     * @param {string} message - Message to display
     */
    error(message) {
        this.show(message, 'error');
    },
};

// ========================================
// Expose to global scope
// ========================================

window.ToastManager = ToastManager;
