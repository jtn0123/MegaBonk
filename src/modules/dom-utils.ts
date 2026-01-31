// ========================================
// MegaBonk DOM Utilities Module
// ========================================
// Shared DOM manipulation patterns
// ========================================

/**
 * Options for creating an element
 */
export interface ElementOptions {
    className?: string;
    id?: string;
    attributes?: Record<string, string>;
    dataset?: Record<string, string>;
    innerHTML?: string;
    textContent?: string;
    children?: HTMLElement[];
}

/**
 * Create an HTML element with options
 * Uses DOM API (not innerHTML) for XSS safety
 * @param tag - HTML tag name
 * @param options - Element configuration options
 * @returns Created element
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    options: ElementOptions = {}
): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);

    if (options.className) {
        el.className = options.className;
    }

    if (options.id) {
        el.id = options.id;
    }

    if (options.attributes) {
        for (const [key, value] of Object.entries(options.attributes)) {
            el.setAttribute(key, value);
        }
    }

    if (options.dataset) {
        for (const [key, value] of Object.entries(options.dataset)) {
            el.dataset[key] = value;
        }
    }

    // Note: Use textContent for user content (safe), innerHTML only for trusted HTML
    if (options.textContent !== undefined) {
        el.textContent = options.textContent;
    } else if (options.innerHTML !== undefined) {
        el.innerHTML = options.innerHTML;
    }

    if (options.children) {
        for (const child of options.children) {
            el.appendChild(child);
        }
    }

    return el;
}

/**
 * Create a progress indicator element
 * @param initialStatus - Initial status text
 * @returns Progress element with update methods
 */
export interface ProgressIndicator {
    element: HTMLElement;
    update: (progress: number, status: string) => void;
    remove: () => void;
}

export function createProgressIndicator(initialStatus: string = 'Initializing...'): ProgressIndicator {
    const progressDiv = createElement('div', {
        className: 'scan-progress-overlay',
        innerHTML: `
            <div class="scan-progress-content">
                <div class="scan-progress-spinner"></div>
                <div class="scan-progress-text">${initialStatus}</div>
                <div class="scan-progress-bar">
                    <div class="scan-progress-fill" style="width: 0%"></div>
                </div>
            </div>
        `,
    });

    return {
        element: progressDiv,

        update: (progress: number, status: string) => {
            const textEl = progressDiv.querySelector('.scan-progress-text');
            const fillEl = progressDiv.querySelector('.scan-progress-fill') as HTMLElement | null;

            if (textEl) {
                textEl.textContent = status;
            }

            if (fillEl) {
                fillEl.style.width = `${Math.min(100, Math.max(0, progress))}%`;
            }
        },

        remove: () => {
            progressDiv.remove();
        },
    };
}

/**
 * Event listener cleanup manager
 * Tracks listeners for easy bulk removal
 */
export interface EventListenerManager {
    /** Add event listener with automatic tracking */
    add: <K extends keyof HTMLElementEventMap>(
        element: HTMLElement | Document,
        type: K,
        handler: (ev: HTMLElementEventMap[K]) => void,
        options?: AddEventListenerOptions
    ) => void;
    /** Add event listener using AbortController signal */
    addWithSignal: <K extends keyof HTMLElementEventMap>(
        element: HTMLElement | Document,
        type: K,
        handler: (ev: HTMLElementEventMap[K]) => void,
        options?: Omit<AddEventListenerOptions, 'signal'>
    ) => void;
    /** Remove all tracked listeners */
    removeAll: () => void;
    /** Get AbortController signal for external use */
    getSignal: () => AbortSignal;
}

export function createEventListenerManager(): EventListenerManager {
    const cleanups: Array<() => void> = [];
    let abortController: AbortController | null = null;

    const ensureAbortController = () => {
        if (!abortController) {
            abortController = new AbortController();
        }
        return abortController;
    };

    return {
        add: <K extends keyof HTMLElementEventMap>(
            element: HTMLElement | Document,
            type: K,
            handler: (ev: HTMLElementEventMap[K]) => void,
            options?: AddEventListenerOptions
        ) => {
            element.addEventListener(type, handler as EventListener, options);
            cleanups.push(() => element.removeEventListener(type, handler as EventListener, options));
        },

        addWithSignal: <K extends keyof HTMLElementEventMap>(
            element: HTMLElement | Document,
            type: K,
            handler: (ev: HTMLElementEventMap[K]) => void,
            options?: Omit<AddEventListenerOptions, 'signal'>
        ) => {
            const controller = ensureAbortController();
            element.addEventListener(type, handler as EventListener, { ...options, signal: controller.signal });
        },

        removeAll: () => {
            // Clean up manually tracked listeners
            while (cleanups.length > 0) {
                const cleanup = cleanups.pop();
                try {
                    cleanup?.();
                } catch {
                    // Element may have been removed from DOM
                }
            }

            // Abort all signal-tracked listeners
            if (abortController) {
                abortController.abort();
                abortController = null;
            }
        },

        getSignal: () => ensureAbortController().signal,
    };
}

/**
 * Download content as a file
 * @param content - Content string to download
 * @param filename - Suggested filename
 * @param mimeType - MIME type (default: application/json)
 */
export function downloadFile(
    content: string,
    filename: string,
    mimeType: string = 'application/json'
): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Download JSON data as a file
 * @param data - Data to serialize and download
 * @param filename - Suggested filename (without extension)
 * @param pretty - Whether to pretty-print JSON (default: true)
 */
export function downloadJson(
    data: unknown,
    filename: string,
    pretty: boolean = true
): void {
    const json = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    const fullFilename = filename.endsWith('.json') ? filename : `${filename}.json`;
    downloadFile(json, fullFilename, 'application/json');
}

/**
 * Render items into a container using DocumentFragment for performance
 * @param container - Container element
 * @param items - Items to render
 * @param renderFn - Function to render each item into an element
 */
export function renderWithFragment<T>(
    container: HTMLElement,
    items: T[],
    renderFn: (item: T, index: number) => HTMLElement
): void {
    container.innerHTML = '';
    const fragment = document.createDocumentFragment();

    items.forEach((item, index) => {
        fragment.appendChild(renderFn(item, index));
    });

    container.appendChild(fragment);
}

/**
 * Create a card element with common structure
 * @param className - Card class name
 * @param content - Inner HTML content
 * @param dataset - Data attributes
 * @returns Card element
 */
export function createCard(
    className: string,
    content: string,
    dataset?: Record<string, string>
): HTMLElement {
    return createElement('div', {
        className,
        innerHTML: content,
        dataset,
    });
}

/**
 * Create a button element
 * @param text - Button text
 * @param className - CSS class
 * @param onClick - Click handler
 * @param attributes - Additional attributes
 * @returns Button element
 */
export function createButton(
    text: string,
    className: string,
    onClick?: (e: MouseEvent) => void,
    attributes?: Record<string, string>
): HTMLButtonElement {
    const btn = createElement('button', {
        className,
        textContent: text,
        attributes,
    });

    if (onClick) {
        btn.addEventListener('click', onClick);
    }

    return btn;
}
