// ========================================
// Image Layout Utilities
// ========================================

/**
 * Detect image resolution category
 */
export function detectResolution(
    width: number,
    height: number
): {
    category: '720p' | '1080p' | '1440p' | '4K' | 'steam_deck' | 'custom';
    width: number;
    height: number;
} {
    // Steam Deck: 1280x800
    if (width === 1280 && height === 800) {
        return { category: 'steam_deck', width, height };
    }

    // 720p: 1280x720
    if (Math.abs(width - 1280) < 50 && Math.abs(height - 720) < 50) {
        return { category: '720p', width, height };
    }

    // 1080p: 1920x1080
    if (Math.abs(width - 1920) < 50 && Math.abs(height - 1080) < 50) {
        return { category: '1080p', width, height };
    }

    // 1440p: 2560x1440
    if (Math.abs(width - 2560) < 50 && Math.abs(height - 1440) < 50) {
        return { category: '1440p', width, height };
    }

    // 4K: 3840x2160
    if (Math.abs(width - 3840) < 50 && Math.abs(height - 2160) < 50) {
        return { category: '4K', width, height };
    }

    return { category: 'custom', width, height };
}

/**
 * Detect UI layout type based on resolution and aspect ratio
 */
export function detectUILayout(width: number, height: number): 'pc' | 'steam_deck' | 'unknown' {
    const aspectRatio = width / height;

    // Steam Deck: 16:10 aspect ratio (1.6)
    if (Math.abs(aspectRatio - 1.6) < 0.1) {
        return 'steam_deck';
    }

    // PC: 16:9 aspect ratio (1.777...)
    if (Math.abs(aspectRatio - 1.7777) < 0.1) {
        return 'pc';
    }

    return 'unknown';
}
