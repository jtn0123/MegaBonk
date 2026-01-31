// ========================================
// OCR Utility Functions
// ========================================

/** Default timeout for OCR operations (60 seconds) */
export const OCR_TIMEOUT_MS = 60000;

/** Maximum retries for OCR operations */
export const OCR_MAX_RETRIES = 2;

/**
 * Wrap a promise with a timeout
 * Rejects with TimeoutError if the promise doesn't resolve within the timeout
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        promise
            .then(result => {
                clearTimeout(timeoutId);
                resolve(result);
            })
            .catch(error => {
                clearTimeout(timeoutId);
                reject(error);
            });
    });
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Split text into searchable segments (by newlines and common delimiters)
 */
export function splitIntoSegments(text: string): string[] {
    // Split by newlines first
    const lines = text.split('\n');
    const segments: string[] = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length <= 2) continue;

        // If line is very long (e.g., repeated items), also split by common delimiters
        if (trimmed.length > 50) {
            // Split by common OCR/game delimiters: comma, semicolon, pipe, tab
            const subSegments = trimmed.split(/[,;|\t]+/);
            for (const seg of subSegments) {
                const segTrimmed = seg.trim();
                if (segTrimmed.length > 2) {
                    segments.push(segTrimmed);
                }
            }
        } else {
            segments.push(trimmed);
        }
    }

    return segments;
}

/**
 * Extract item counts from text (looks for patterns like "x3", "×2", etc.)
 */
export function extractItemCounts(text: string): Map<string, number> {
    const counts = new Map<string, number>();

    // Pattern: "item name x3" or "item name ×2" or "item name (3)"
    const patterns = [/(.+?)\s*[x×]\s*(\d+)/gi, /(.+?)\s*\((\d+)\)/gi, /(.+?)\s*:\s*(\d+)/gi];

    for (const pattern of patterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
            const name = match[1]?.trim();
            const countStr = match[2];
            if (name && countStr) {
                const count = parseInt(countStr, 10);
                if (!isNaN(count) && count > 0) {
                    counts.set(name.toLowerCase(), count);
                }
            }
        }
    }

    return counts;
}
