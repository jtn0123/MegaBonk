// ========================================
// Image Recognition Debug Module
// ========================================
// Visual debugging tools for image recognition
// Provides overlays, logging, and validation utilities
// ========================================

import type {
    DebugRegion,
    DebugOverlayOptions,
    DebugLogEntry,
    DebugStats,
    CVDetectionResult,
    DetectionResults,
    BoundingBox,
    SlotInfo,
    ColorAnalysis,
    ValidationTestCase,
    ValidationResult,
} from '../types/computer-vision';

// ========================================
// Default Configuration
// ========================================

const DEFAULT_DEBUG_OPTIONS: DebugOverlayOptions = {
    showRegionBounds: true,
    showSlotGrid: true,
    showConfidenceLabels: true,
    showDetectionBoxes: true,
    showVarianceHeatmap: false,
    showDominantColors: false,
    regionColors: {
        items: '#00ff88',
        weapons: '#ff6b6b',
        tomes: '#4ecdc4',
        character: '#f7dc6f',
        unknown: '#95a5a6',
    },
    fontSize: 12,
    lineWidth: 2,
};

// ========================================
// Module State
// ========================================

// Safe localStorage access for SSR/testing environments
function getLocalStorage(): Storage | null {
    if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
    }
    return null;
}

let debugEnabled = getLocalStorage()?.getItem('megabonk_cv_debug') === 'true';
let debugOptions: DebugOverlayOptions = { ...DEFAULT_DEBUG_OPTIONS };
const debugLogs: DebugLogEntry[] = [];
const debugStats: DebugStats = {
    totalDetections: 0,
    successfulMatches: 0,
    falsePositives: 0,
    averageConfidence: 0,
    averageProcessingTime: 0,
    regionDetectionAccuracy: 0,
    templateCacheHits: 0,
    templateCacheMisses: 0,
};

// Confidence history for calculating averages
const confidenceHistory: number[] = [];
const processingTimeHistory: number[] = [];

// ========================================
// Debug Mode Control
// ========================================

/**
 * Enable or disable debug mode
 */
export function setDebugEnabled(enabled: boolean): void {
    debugEnabled = enabled;
    getLocalStorage()?.setItem('megabonk_cv_debug', String(enabled));
    log('config', `Debug mode ${enabled ? 'enabled' : 'disabled'}`, undefined, 'info');
}

/**
 * Check if debug mode is enabled
 */
export function isDebugEnabled(): boolean {
    return debugEnabled;
}

/**
 * Set debug overlay options
 */
export function setDebugOptions(options: Partial<DebugOverlayOptions>): void {
    debugOptions = { ...debugOptions, ...options };
    log('config', 'Debug options updated', options, 'info');
}

/**
 * Get current debug options
 */
export function getDebugOptions(): DebugOverlayOptions {
    return { ...debugOptions };
}

// ========================================
// Debug Logging
// ========================================

/**
 * Log a debug message
 */
export function log(category: string, message: string, data?: unknown, level: DebugLogEntry['level'] = 'debug'): void {
    const entry: DebugLogEntry = {
        timestamp: Date.now(),
        category,
        message,
        data,
        level,
    };

    debugLogs.push(entry);

    // Keep only last 500 entries
    if (debugLogs.length > 500) {
        debugLogs.shift();
    }

    // Console output if debug enabled
    if (debugEnabled) {
        const prefix = `[CV:${category}]`;
        const style = {
            debug: 'color: #888',
            info: 'color: #4ecdc4',
            warn: 'color: #f7dc6f',
            error: 'color: #ff6b6b',
        }[level];

        console.groupCollapsed(`%c${prefix} ${message}`, style);
        if (data !== undefined) {
            if (typeof data === 'object' && data !== null) {
                console.table(data);
            } else {
                console.log(data);
            }
        }
        console.trace('Stack trace');
        console.groupEnd();
    }
}

/**
 * Get all debug logs
 */
export function getLogs(): DebugLogEntry[] {
    return [...debugLogs];
}

/**
 * Get logs filtered by category
 */
export function getLogsByCategory(category: string): DebugLogEntry[] {
    return debugLogs.filter(entry => entry.category === category);
}

/**
 * Get logs filtered by level
 */
export function getLogsByLevel(level: DebugLogEntry['level']): DebugLogEntry[] {
    return debugLogs.filter(entry => entry.level === level);
}

/**
 * Clear all logs
 */
export function clearLogs(): void {
    debugLogs.length = 0;
    log('system', 'Logs cleared', undefined, 'info');
}

/**
 * Export logs as JSON
 */
export function exportLogs(): string {
    return JSON.stringify(debugLogs, null, 2);
}

// ========================================
// Debug Statistics
// ========================================

/**
 * Record a detection result for statistics
 */
export function recordDetection(result: DetectionResults): void {
    debugStats.totalDetections++;

    const totalItems = result.items.length + result.weapons.length + result.tomes.length + (result.character ? 1 : 0);
    debugStats.successfulMatches += totalItems;

    // Update confidence average
    const confidences = [
        ...result.items.map(d => d.confidence),
        ...result.weapons.map(d => d.confidence),
        ...result.tomes.map(d => d.confidence),
        ...(result.character ? [result.character.confidence] : []),
    ];

    if (confidences.length > 0) {
        const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
        confidenceHistory.push(avgConfidence);
        if (confidenceHistory.length > 100) confidenceHistory.shift();
        debugStats.averageConfidence = confidenceHistory.reduce((a, b) => a + b, 0) / confidenceHistory.length;
    }

    // Update processing time average
    processingTimeHistory.push(result.processingTime);
    if (processingTimeHistory.length > 100) processingTimeHistory.shift();
    debugStats.averageProcessingTime = processingTimeHistory.reduce((a, b) => a + b, 0) / processingTimeHistory.length;

    log('stats', 'Detection recorded', {
        totalItems,
        avgConfidence: debugStats.averageConfidence.toFixed(3),
        processingTime: result.processingTime,
    });
}

/**
 * Record a cache hit/miss
 */
export function recordCacheAccess(hit: boolean): void {
    if (hit) {
        debugStats.templateCacheHits++;
    } else {
        debugStats.templateCacheMisses++;
    }
}

/**
 * Get current statistics
 */
export function getStats(): DebugStats {
    return { ...debugStats };
}

/**
 * Reset statistics
 */
export function resetStats(): void {
    Object.assign(debugStats, {
        totalDetections: 0,
        successfulMatches: 0,
        falsePositives: 0,
        averageConfidence: 0,
        averageProcessingTime: 0,
        regionDetectionAccuracy: 0,
        templateCacheHits: 0,
        templateCacheMisses: 0,
    });
    confidenceHistory.length = 0;
    processingTimeHistory.length = 0;
    log('stats', 'Statistics reset', undefined, 'info');
}

// ========================================
// Debug Overlay Rendering
// ========================================

/**
 * Create a debug overlay canvas from an image
 */
export function createDebugCanvas(
    sourceImage: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
    width?: number,
    height?: number
): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width ?? sourceImage.width;
    canvas.height = height ?? sourceImage.height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
        ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
    }

    return canvas;
}

/**
 * Draw debug regions on a canvas
 */
export function drawDebugRegions(
    canvas: HTMLCanvasElement,
    regions: DebugRegion[],
    options: Partial<DebugOverlayOptions> = {}
): void {
    const opts = { ...debugOptions, ...options };
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    regions.forEach(region => {
        // Draw region box
        ctx.strokeStyle = region.color;
        ctx.lineWidth = opts.lineWidth;

        // Set line style
        if (region.strokeStyle === 'dashed') {
            ctx.setLineDash([8, 4]);
        } else if (region.strokeStyle === 'dotted') {
            ctx.setLineDash([2, 2]);
        } else {
            ctx.setLineDash([]);
        }

        ctx.strokeRect(region.x, region.y, region.width, region.height);

        // Fill with transparency if specified
        if (region.fillOpacity && region.fillOpacity > 0) {
            ctx.fillStyle = region.color;
            ctx.globalAlpha = region.fillOpacity;
            ctx.fillRect(region.x, region.y, region.width, region.height);
            ctx.globalAlpha = 1;
        }

        // Draw label
        if (opts.showConfidenceLabels && region.label) {
            ctx.font = `${opts.fontSize}px monospace`;
            ctx.fillStyle = region.color;

            const labelText =
                region.confidence !== undefined
                    ? `${region.label} (${(region.confidence * 100).toFixed(1)}%)`
                    : region.label;

            // Draw label background
            const textMetrics = ctx.measureText(labelText);
            const labelX = region.x;
            const labelY = region.y - 4;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(labelX - 2, labelY - opts.fontSize, textMetrics.width + 4, opts.fontSize + 4);

            ctx.fillStyle = region.color;
            ctx.fillText(labelText, labelX, labelY);
        }
    });

    // Reset line dash
    ctx.setLineDash([]);
}

/**
 * Draw slot grid on a canvas
 */
export function drawSlotGrid(
    canvas: HTMLCanvasElement,
    slots: SlotInfo[],
    _color: string = '#ffffff',
    options: Partial<DebugOverlayOptions> = {}
): void {
    const opts = { ...debugOptions, ...options };
    if (!opts.showSlotGrid) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    slots.forEach(slot => {
        // Draw slot border
        ctx.strokeStyle = slot.occupied ? '#00ff88' : '#666666';
        ctx.lineWidth = slot.occupied ? 2 : 1;
        ctx.setLineDash(slot.occupied ? [] : [4, 4]);
        ctx.strokeRect(slot.x, slot.y, slot.width, slot.height);

        // Draw slot index
        if (opts.showConfidenceLabels) {
            ctx.font = `${opts.fontSize - 2}px monospace`;
            ctx.fillStyle = slot.occupied ? '#00ff88' : '#666666';
            ctx.fillText(String(slot.index), slot.x + slot.width / 2 - 4, slot.y + slot.height / 2 + 4);
        }

        // Draw variance info if available
        if (slot.variance !== undefined && opts.showVarianceHeatmap) {
            const intensity = Math.min(255, Math.floor(slot.variance));
            ctx.fillStyle = `rgba(255, ${255 - intensity}, 0, 0.3)`;
            ctx.fillRect(slot.x, slot.y, slot.width, slot.height);
        }
    });

    ctx.setLineDash([]);
}

/**
 * Draw detection boxes for matched items
 */
export function drawDetectionBoxes(
    canvas: HTMLCanvasElement,
    detections: CVDetectionResult[],
    color: string = '#00ff88',
    options: Partial<DebugOverlayOptions> = {}
): void {
    const opts = { ...debugOptions, ...options };
    if (!opts.showDetectionBoxes) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    detections.forEach(detection => {
        if (!detection.position) return;

        const pos = detection.position;

        // Draw detection box
        ctx.strokeStyle = color;
        ctx.lineWidth = opts.lineWidth;
        ctx.strokeRect(pos.x, pos.y, pos.width, pos.height);

        // Draw entity name and confidence
        if (opts.showConfidenceLabels) {
            ctx.font = `bold ${opts.fontSize}px monospace`;

            const label = `${detection.entity.name} (${(detection.confidence * 100).toFixed(0)}%)`;
            const textMetrics = ctx.measureText(label);

            // Background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(pos.x, pos.y + pos.height + 2, textMetrics.width + 8, opts.fontSize + 6);

            // Text
            ctx.fillStyle = color;
            ctx.fillText(label, pos.x + 4, pos.y + pos.height + opts.fontSize + 2);
        }
    });
}

/**
 * Create a complete debug overlay from detection results
 */
export function createDebugOverlay(
    imageDataUrl: string,
    results: DetectionResults,
    options: Partial<DebugOverlayOptions> = {}
): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = createDebugCanvas(img);
            const opts = { ...debugOptions, ...options };

            // Draw region bounds
            if (opts.showRegionBounds) {
                const debugRegions: DebugRegion[] = results.regions.map(region => ({
                    ...region,
                    label: region.label ?? region.type,
                    color: getRegionColor(region.type, opts),
                    strokeStyle: 'solid' as const,
                    fillOpacity: 0.1,
                }));
                drawDebugRegions(canvas, debugRegions, opts);
            }

            // Draw slot grids
            if (opts.showSlotGrid) {
                results.regions.forEach(region => {
                    if (region.slots) {
                        drawSlotGrid(canvas, region.slots, getRegionColor(region.type, opts), opts);
                    }
                });
            }

            // Draw item detections
            if (opts.showDetectionBoxes) {
                drawDetectionBoxes(canvas, results.items, opts.regionColors.items, opts);
                drawDetectionBoxes(canvas, results.weapons, opts.regionColors.weapons, opts);
                drawDetectionBoxes(canvas, results.tomes, opts.regionColors.tomes, opts);
                if (results.character) {
                    drawDetectionBoxes(canvas, [results.character], opts.regionColors.character, opts);
                }
            }

            // Draw stats overlay
            drawStatsOverlay(canvas, results, opts);

            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => reject(new Error('Failed to load image for debug overlay'));
        img.src = imageDataUrl;
    });
}

/**
 * Get color for a region type
 */
function getRegionColor(type: string, options: DebugOverlayOptions): string {
    switch (type) {
        case 'items_hotbar':
            return options.regionColors.items;
        case 'weapons_region':
            return options.regionColors.weapons;
        case 'tomes_region':
            return options.regionColors.tomes;
        case 'character_portrait':
            return options.regionColors.character;
        default:
            return options.regionColors.unknown;
    }
}

/**
 * Draw statistics overlay on canvas
 */
function drawStatsOverlay(canvas: HTMLCanvasElement, results: DetectionResults, options: DebugOverlayOptions): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const padding = 10;
    const lineHeight = options.fontSize + 4;
    const boxWidth = 200;
    const lines = [
        `Resolution: ${results.imageSize.width}x${results.imageSize.height}`,
        `Items: ${results.items.length}`,
        `Weapons: ${results.weapons.length}`,
        `Tomes: ${results.tomes.length}`,
        `Character: ${results.character?.entity.name ?? 'None'}`,
        `Confidence: ${(results.confidence * 100).toFixed(1)}%`,
        `Time: ${results.processingTime}ms`,
    ];
    const boxHeight = lines.length * lineHeight + padding * 2;

    // Draw background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(canvas.width - boxWidth - padding, padding, boxWidth, boxHeight);

    // Draw border
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 1;
    ctx.strokeRect(canvas.width - boxWidth - padding, padding, boxWidth, boxHeight);

    // Draw text
    ctx.font = `${options.fontSize}px monospace`;
    ctx.fillStyle = '#ffffff';

    lines.forEach((line, i) => {
        ctx.fillText(line, canvas.width - boxWidth - padding + 8, padding + lineHeight * (i + 1));
    });
}

// ========================================
// Validation Utilities
// ========================================

/**
 * Validate detection results against expected values
 */
export function validateDetectionResults(results: DetectionResults, testCase: ValidationTestCase): ValidationResult {
    const startTime = Date.now();

    const detectedItems = results.items.map(d => d.entity.name);
    const detectedWeapons = results.weapons.map(d => d.entity.name);
    const detectedTomes = results.tomes.map(d => d.entity.name);
    const detectedCharacter = results.character?.entity.name;

    // Calculate matches, misses, and false positives
    const matchedItems = testCase.expectedItems.filter(e => detectedItems.includes(e));
    const missedItems = testCase.expectedItems.filter(e => !detectedItems.includes(e));
    const falsePositiveItems = detectedItems.filter(d => !testCase.expectedItems.includes(d));

    const matchedWeapons = testCase.expectedWeapons.filter(e => detectedWeapons.includes(e));
    const missedWeapons = testCase.expectedWeapons.filter(e => !detectedWeapons.includes(e));
    const falsePositiveWeapons = detectedWeapons.filter(d => !testCase.expectedWeapons.includes(d));

    const matchedTomes = testCase.expectedTomes.filter(e => detectedTomes.includes(e));
    const missedTomes = testCase.expectedTomes.filter(e => !detectedTomes.includes(e));
    const falsePositiveTomes = detectedTomes.filter(d => !testCase.expectedTomes.includes(d));

    const characterMatch = testCase.expectedCharacter ? detectedCharacter === testCase.expectedCharacter : true;

    // Calculate accuracy
    const itemAccuracy = testCase.expectedItems.length > 0 ? matchedItems.length / testCase.expectedItems.length : 1;
    const weaponAccuracy =
        testCase.expectedWeapons.length > 0 ? matchedWeapons.length / testCase.expectedWeapons.length : 1;
    const tomeAccuracy = testCase.expectedTomes.length > 0 ? matchedTomes.length / testCase.expectedTomes.length : 1;

    const totalExpected =
        testCase.expectedItems.length +
        testCase.expectedWeapons.length +
        testCase.expectedTomes.length +
        (testCase.expectedCharacter ? 1 : 0);
    const totalMatched =
        matchedItems.length +
        matchedWeapons.length +
        matchedTomes.length +
        (characterMatch && testCase.expectedCharacter ? 1 : 0);
    const overallAccuracy = totalExpected > 0 ? totalMatched / totalExpected : 1;

    // Calculate region accuracy if annotated regions provided
    let regionAccuracy = 1;
    if (testCase.annotatedRegions && testCase.annotatedRegions.length > 0) {
        let regionMatches = 0;
        testCase.annotatedRegions.forEach(expected => {
            const found = results.regions.find(
                detected =>
                    detected.type === expected.type &&
                    Math.abs(detected.x - expected.x) < 50 &&
                    Math.abs(detected.y - expected.y) < 50
            );
            if (found) regionMatches++;
        });
        regionAccuracy = regionMatches / testCase.annotatedRegions.length;
    }

    const result: ValidationResult = {
        testCase,
        passed:
            overallAccuracy >= 0.8 &&
            falsePositiveItems.length === 0 &&
            falsePositiveWeapons.length === 0 &&
            falsePositiveTomes.length === 0,
        matched: {
            items: matchedItems,
            weapons: matchedWeapons,
            tomes: matchedTomes,
            character: characterMatch ? detectedCharacter : undefined,
        },
        missed: {
            items: missedItems,
            weapons: missedWeapons,
            tomes: missedTomes,
            character: characterMatch ? undefined : testCase.expectedCharacter,
        },
        falsePositives: {
            items: falsePositiveItems,
            weapons: falsePositiveWeapons,
            tomes: falsePositiveTomes,
        },
        accuracy: {
            items: itemAccuracy,
            weapons: weaponAccuracy,
            tomes: tomeAccuracy,
            overall: overallAccuracy,
        },
        regionAccuracy,
        processingTime: Date.now() - startTime,
    };

    log(
        'validation',
        `Validation ${result.passed ? 'PASSED' : 'FAILED'}: ${testCase.name}`,
        {
            accuracy: result.accuracy,
            missed: result.missed,
            falsePositives: result.falsePositives,
        },
        result.passed ? 'info' : 'warn'
    );

    return result;
}

// ========================================
// Color Analysis Debug
// ========================================

/**
 * Analyze colors in a region for debugging
 */
export function analyzeRegionColors(imageData: ImageData, region: BoundingBox): ColorAnalysis {
    const colors: Map<string, number> = new Map();
    let totalR = 0,
        totalG = 0,
        totalB = 0;
    let totalBrightness = 0;
    let count = 0;

    const startX = Math.max(0, Math.floor(region.x));
    const startY = Math.max(0, Math.floor(region.y));
    const endX = Math.min(imageData.width, Math.floor(region.x + region.width));
    const endY = Math.min(imageData.height, Math.floor(region.y + region.height));

    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const idx = (y * imageData.width + x) * 4;
            const r = imageData.data[idx] ?? 0;
            const g = imageData.data[idx + 1] ?? 0;
            const b = imageData.data[idx + 2] ?? 0;

            totalR += r;
            totalG += g;
            totalB += b;
            totalBrightness += (r + g + b) / 3;
            count++;

            // Quantize color for histogram (reduce to 32 levels per channel)
            const qr = Math.floor(r / 8) * 8;
            const qg = Math.floor(g / 8) * 8;
            const qb = Math.floor(b / 8) * 8;
            const colorKey = `${qr},${qg},${qb}`;
            colors.set(colorKey, (colors.get(colorKey) ?? 0) + 1);
        }
    }

    // Find dominant colors
    const sortedColors = [...colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const dominantColors = sortedColors.map(([color, freq]) => {
        const parts = color.split(',').map(Number);
        const r = parts[0] ?? 0;
        const g = parts[1] ?? 0;
        const b = parts[2] ?? 0;
        return {
            color: `rgb(${r}, ${g}, ${b})`,
            percentage: (freq / count) * 100,
            rgb: { r, g, b },
        };
    });

    const avgR = Math.round(totalR / count);
    const avgG = Math.round(totalG / count);
    const avgB = Math.round(totalB / count);

    // Calculate saturation
    const max = Math.max(avgR, avgG, avgB);
    const min = Math.min(avgR, avgG, avgB);
    const saturation = max === 0 ? 0 : ((max - min) / max) * 100;

    return {
        dominantColors,
        averageColor: `rgb(${avgR}, ${avgG}, ${avgB})`,
        brightness: totalBrightness / count,
        contrast: max - min,
        saturation,
    };
}

// ========================================
// Export Debug Image
// ========================================

/**
 * Download debug overlay as image file
 */
export function downloadDebugImage(dataUrl: string, filename: string = 'debug-overlay.png'): void {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    log('export', `Downloaded debug image: ${filename}`, undefined, 'info');
}

// ========================================
// Console Debug Commands
// ========================================

/**
 * Register debug commands on window for console access
 */
export function registerDebugCommands(): void {
    if (typeof window === 'undefined') return;

    (window as unknown as Record<string, unknown>).cvDebug = {
        enable: () => setDebugEnabled(true),
        disable: () => setDebugEnabled(false),
        getLogs: () => getLogs(),
        getStats: () => getStats(),
        clearLogs: () => clearLogs(),
        resetStats: () => resetStats(),
        exportLogs: () => exportLogs(),
        setOptions: (opts: Partial<DebugOverlayOptions>) => setDebugOptions(opts),
        getOptions: () => getDebugOptions(),
    };

    log('system', 'Debug commands registered. Access via window.cvDebug', undefined, 'info');
}

// Auto-register debug commands
if (typeof window !== 'undefined') {
    registerDebugCommands();
}
