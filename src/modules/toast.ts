// ========================================
// MegaBonk Toast Notification Module
// ========================================

/**
 * Toast type
 */
type ToastType = 'info' | 'success' | 'warning' | 'error';

/**
 * Toast notification manager for user feedback
 * Replaces browser alert() with modern, styled notifications
 */
export const ToastManager = {
    container: null as HTMLElement | null,

    /**
     * Initialize the toast container
     */
    init(): void {
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
     * @param message - Message to display
     * @param type - Toast type: 'info', 'success', 'warning', 'error'
     * @param duration - Duration in ms (default 3000)
     */
    show(message: string, type: ToastType = 'info', duration: number = 3000): void {
        this.init();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.setAttribute('role', 'alert');

        this.container!.appendChild(toast);

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
     * @param message - Message to display
     */
    info(message: string): void {
        this.show(message, 'info');
    },

    /**
     * Show success toast
     * @param message - Message to display
     */
    success(message: string): void {
        this.show(message, 'success');
    },

    /**
     * Show warning toast
     * @param message - Message to display
     */
    warning(message: string): void {
        this.show(message, 'warning');
    },

    /**
     * Show error toast
     * @param message - Message to display
     */
    error(message: string): void {
        this.show(message, 'error');
    },
};
