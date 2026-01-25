// ========================================
// Adaptive Preprocessing Module
// ========================================
// Analyzes scene conditions and adjusts preprocessing parameters
// Based on ablation testing results showing contrast enhancement
// provides +1.8% F1 improvement

/**
 * Simple image data interface
 */
interface SimpleImageData {
    data: Uint8ClampedArray | number[];
    width: number;
    height: number;
}

/**
 * Scene analysis results
 */
export interface SceneAnalysis {
    /** Average brightness (0-255) */
    brightness: number;
    /** Brightness category */
    brightnessLevel: 'dark' | 'normal' | 'bright';
    /** Contrast level (standard deviation) */
    contrast: number;
    /** Contrast category */
    contrastLevel: 'low' | 'normal' | 'high';
    /** Estimated noise level */
    noiseLevel: 'low' | 'medium' | 'high';
    /** Color saturation average */
    saturation: number;
    /** Has heavy visual effects (particles, etc) */
    hasHeavyEffects: boolean;
    /** Detected biome/environment hint */
    environmentHint: 'normal' | 'hell' | 'snow' | 'dark' | 'bright';
}

/**
 * Preprocessing configuration based on scene
 */
export interface PreprocessConfig {
    /** Contrast enhancement factor (1.0 = no change) */
    contrastFactor: number;
    /** Whether to apply color normalization */
    normalizeColors: boolean;
    /** Sharpening factor (0 = no sharpening) */
    sharpeningFactor: number;
    /** Whether to apply noise reduction */
    reduceNoise: boolean;
    /** Brightness adjustment (-255 to 255) */
    brightnessAdjust: number;
}

/**
 * Analyze a scene/image region to determine preprocessing strategy
 */
export function analyzeScene(imageData: SimpleImageData): SceneAnalysis {
    const pixels = imageData.data;
    const pixelCount = pixels.length / 4;

    if (pixelCount === 0) {
        return {
            brightness: 128,
            brightnessLevel: 'normal',
            contrast: 50,
            contrastLevel: 'normal',
            noiseLevel: 'low',
            saturation: 50,
            hasHeavyEffects: false,
            environmentHint: 'normal',
        };
    }

    // Calculate brightness statistics
    let sumBrightness = 0;
    let sumR = 0,
        sumG = 0,
        sumB = 0;
    let sumSaturation = 0;
    const brightnessValues: number[] = [];

    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i] ?? 0;
        const g = pixels[i + 1] ?? 0;
        const b = pixels[i + 2] ?? 0;

        const brightness = (r + g + b) / 3;
        brightnessValues.push(brightness);
        sumBrightness += brightness;

        sumR += r;
        sumG += g;
        sumB += b;

        // Calculate saturation (simplified HSL saturation)
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const lightness = (max + min) / 2;
        let saturation = 0;
        if (max !== min) {
            saturation = lightness > 127 ? (max - min) / (510 - max - min) : (max - min) / (max + min);
        }
        sumSaturation += saturation * 100;
    }

    const avgBrightness = sumBrightness / pixelCount;
    const avgR = sumR / pixelCount;
    const avgG = sumG / pixelCount;
    const avgB = sumB / pixelCount;
    const avgSaturation = sumSaturation / pixelCount;

    // Calculate contrast (standard deviation of brightness)
    let sumSquaredDiff = 0;
    for (const brightness of brightnessValues) {
        const diff = brightness - avgBrightness;
        sumSquaredDiff += diff * diff;
    }
    const contrast = Math.sqrt(sumSquaredDiff / pixelCount);

    // Estimate noise level using local variance
    const noiseLevel = estimateNoiseLevel(imageData, avgBrightness);

    // Detect heavy visual effects (high color variance in local regions)
    const hasHeavyEffects = detectHeavyEffects(imageData, avgSaturation);

    // Determine brightness level
    let brightnessLevel: 'dark' | 'normal' | 'bright';
    if (avgBrightness < 70) {
        brightnessLevel = 'dark';
    } else if (avgBrightness > 180) {
        brightnessLevel = 'bright';
    } else {
        brightnessLevel = 'normal';
    }

    // Determine contrast level
    let contrastLevel: 'low' | 'normal' | 'high';
    if (contrast < 30) {
        contrastLevel = 'low';
    } else if (contrast > 70) {
        contrastLevel = 'high';
    } else {
        contrastLevel = 'normal';
    }

    // Detect environment hint from dominant colors
    let environmentHint: 'normal' | 'hell' | 'snow' | 'dark' | 'bright' = 'normal';
    if (avgR > avgG * 1.5 && avgR > avgB * 1.5) {
        environmentHint = 'hell'; // Red dominant = hell biome
    } else if (avgBrightness > 180 && avgSaturation < 30) {
        environmentHint = 'snow'; // Bright and desaturated = snow
    } else if (avgBrightness < 50) {
        environmentHint = 'dark'; // Very dark = crypt or night
    } else if (avgBrightness > 200) {
        environmentHint = 'bright';
    }

    return {
        brightness: avgBrightness,
        brightnessLevel,
        contrast,
        contrastLevel,
        noiseLevel,
        saturation: avgSaturation,
        hasHeavyEffects,
        environmentHint,
    };
}

/**
 * Estimate noise level using local variance
 */
function estimateNoiseLevel(imageData: SimpleImageData, avgBrightness: number): 'low' | 'medium' | 'high' {
    const pixels = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    if (width < 4 || height < 4) return 'low';

    // Sample local 2x2 neighborhoods and measure variance
    let totalLocalVar = 0;
    let sampleCount = 0;
    const step = 4; // Sample every 4th position

    for (let y = 0; y < height - 2; y += step) {
        for (let x = 0; x < width - 2; x += step) {
            const values: number[] = [];

            for (let dy = 0; dy < 2; dy++) {
                for (let dx = 0; dx < 2; dx++) {
                    const idx = ((y + dy) * width + (x + dx)) * 4;
                    const gray = ((pixels[idx] ?? 0) + (pixels[idx + 1] ?? 0) + (pixels[idx + 2] ?? 0)) / 3;
                    values.push(gray);
                }
            }

            const localMean = values.reduce((a, b) => a + b, 0) / values.length;
            const localVar = values.reduce((sum, v) => sum + (v - localMean) ** 2, 0) / values.length;
            totalLocalVar += localVar;
            sampleCount++;
        }
    }

    if (sampleCount === 0) return 'low';

    const avgLocalVar = totalLocalVar / sampleCount;

    // Normalize by brightness (darker images tend to have lower variance)
    const normalizedVar = avgLocalVar / Math.max(avgBrightness / 128, 0.5);

    if (normalizedVar < 50) return 'low';
    if (normalizedVar > 200) return 'high';
    return 'medium';
}

/**
 * Detect heavy visual effects (particles, explosions, etc)
 */
function detectHeavyEffects(imageData: SimpleImageData, _avgSaturation: number): boolean {
    const pixels = imageData.data;
    const pixelCount = pixels.length / 4;

    // Count highly saturated bright pixels (likely effects)
    let effectPixels = 0;

    for (let i = 0; i < pixels.length; i += 16) {
        // Sample every 4th pixel
        const r = pixels[i] ?? 0;
        const g = pixels[i + 1] ?? 0;
        const b = pixels[i + 2] ?? 0;

        const brightness = (r + g + b) / 3;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max > 0 ? ((max - min) / max) * 100 : 0;

        // Bright, highly saturated pixels indicate effects
        if (brightness > 200 && saturation > 60) {
            effectPixels++;
        }
    }

    const effectRatio = effectPixels / (pixelCount / 4);
    return effectRatio > 0.05; // >5% effect pixels
}

/**
 * Get optimal preprocessing configuration for a scene
 */
export function getPreprocessConfig(scene: SceneAnalysis): PreprocessConfig {
    const config: PreprocessConfig = {
        contrastFactor: 1.5, // Default from ablation testing
        normalizeColors: true,
        sharpeningFactor: 0,
        reduceNoise: false,
        brightnessAdjust: 0,
    };

    // Adjust based on brightness
    switch (scene.brightnessLevel) {
        case 'dark':
            config.contrastFactor = 1.3; // Less aggressive contrast for dark scenes
            config.brightnessAdjust = 20; // Slight brightness boost
            break;
        case 'bright':
            config.contrastFactor = 1.4;
            config.brightnessAdjust = -10; // Slight brightness reduction
            break;
        case 'normal':
            config.contrastFactor = 1.5; // Standard contrast
            break;
    }

    // Adjust based on existing contrast
    switch (scene.contrastLevel) {
        case 'low':
            config.contrastFactor *= 1.2; // Boost contrast more for low-contrast scenes
            break;
        case 'high':
            config.contrastFactor *= 0.85; // Reduce contrast enhancement for high-contrast scenes
            break;
    }

    // Handle noise
    switch (scene.noiseLevel) {
        case 'high':
            config.reduceNoise = true;
            config.sharpeningFactor = 0; // Don't sharpen noisy images
            break;
        case 'medium':
            config.sharpeningFactor = 0.2; // Light sharpening
            break;
        case 'low':
            config.sharpeningFactor = 0.4; // More sharpening for clean images
            break;
    }

    // Handle heavy effects (particles, explosions)
    if (scene.hasHeavyEffects) {
        config.normalizeColors = false; // Don't normalize when effects distort colors
        config.contrastFactor = 1.2; // Less aggressive contrast
    }

    // Environment-specific adjustments
    switch (scene.environmentHint) {
        case 'hell':
            // Red-heavy scenes need different handling
            config.contrastFactor = Math.min(config.contrastFactor, 1.4);
            break;
        case 'snow':
            // Bright scenes with low saturation
            config.brightnessAdjust = -15;
            config.contrastFactor = 1.6; // Need more contrast
            break;
        case 'dark':
            config.brightnessAdjust = 25;
            config.contrastFactor = 1.3;
            break;
    }

    // Clamp values to safe ranges
    config.contrastFactor = Math.max(1.0, Math.min(2.0, config.contrastFactor));
    config.sharpeningFactor = Math.max(0, Math.min(1.0, config.sharpeningFactor));
    config.brightnessAdjust = Math.max(-50, Math.min(50, config.brightnessAdjust));

    return config;
}

/**
 * Apply adaptive preprocessing to an image
 */
export function applyAdaptivePreprocessing(imageData: SimpleImageData): SimpleImageData {
    const scene = analyzeScene(imageData);
    const config = getPreprocessConfig(scene);

    let processed = imageData;

    // Apply brightness adjustment first
    if (config.brightnessAdjust !== 0) {
        processed = adjustBrightness(processed, config.brightnessAdjust);
    }

    // Apply contrast enhancement
    if (config.contrastFactor !== 1.0) {
        processed = enhanceContrastAdaptive(processed, config.contrastFactor);
    }

    // Apply noise reduction if needed
    if (config.reduceNoise) {
        processed = reduceNoise(processed);
    }

    // Apply color normalization if enabled
    if (config.normalizeColors) {
        processed = normalizeColorsAdaptive(processed);
    }

    // Apply sharpening if enabled
    if (config.sharpeningFactor > 0) {
        processed = sharpenImage(processed, config.sharpeningFactor);
    }

    return processed;
}

/**
 * Adjust brightness of image
 */
function adjustBrightness(imageData: SimpleImageData, amount: number): SimpleImageData {
    const data = new Uint8ClampedArray(imageData.data);

    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, (data[i] ?? 0) + amount));
        data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] ?? 0) + amount));
        data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] ?? 0) + amount));
    }

    return { data, width: imageData.width, height: imageData.height };
}

/**
 * Enhanced contrast with adaptive factor
 */
function enhanceContrastAdaptive(imageData: SimpleImageData, factor: number): SimpleImageData {
    const data = new Uint8ClampedArray(imageData.data);
    const midpoint = 128;

    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, midpoint + ((data[i] ?? 0) - midpoint) * factor));
        data[i + 1] = Math.min(255, Math.max(0, midpoint + ((data[i + 1] ?? 0) - midpoint) * factor));
        data[i + 2] = Math.min(255, Math.max(0, midpoint + ((data[i + 2] ?? 0) - midpoint) * factor));
    }

    return { data, width: imageData.width, height: imageData.height };
}

/**
 * Simple 3x3 box blur for noise reduction
 */
function reduceNoise(imageData: SimpleImageData): SimpleImageData {
    const { width, height } = imageData;
    const srcData = imageData.data;
    const data = new Uint8ClampedArray(srcData);

    // Simple box blur
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;

            for (let c = 0; c < 3; c++) {
                let sum = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const srcIdx = ((y + dy) * width + (x + dx)) * 4 + c;
                        sum += srcData[srcIdx] ?? 0;
                    }
                }
                data[idx + c] = Math.round(sum / 9);
            }
        }
    }

    return { data, width, height };
}

/**
 * Color normalization with range detection
 */
function normalizeColorsAdaptive(imageData: SimpleImageData): SimpleImageData {
    const data = new Uint8ClampedArray(imageData.data);

    let minR = 255,
        maxR = 0;
    let minG = 255,
        maxG = 0;
    let minB = 255,
        maxB = 0;

    for (let i = 0; i < data.length; i += 4) {
        minR = Math.min(minR, data[i] ?? 0);
        maxR = Math.max(maxR, data[i] ?? 0);
        minG = Math.min(minG, data[i + 1] ?? 0);
        maxG = Math.max(maxG, data[i + 1] ?? 0);
        minB = Math.min(minB, data[i + 2] ?? 0);
        maxB = Math.max(maxB, data[i + 2] ?? 0);
    }

    const rangeR = maxR - minR || 1;
    const rangeG = maxG - minG || 1;
    const rangeB = maxB - minB || 1;

    const MIN_RANGE_THRESHOLD = 20;

    for (let i = 0; i < data.length; i += 4) {
        if (rangeR >= MIN_RANGE_THRESHOLD) {
            data[i] = Math.round((((data[i] ?? 0) - minR) / rangeR) * 255);
        }
        if (rangeG >= MIN_RANGE_THRESHOLD) {
            data[i + 1] = Math.round((((data[i + 1] ?? 0) - minG) / rangeG) * 255);
        }
        if (rangeB >= MIN_RANGE_THRESHOLD) {
            data[i + 2] = Math.round((((data[i + 2] ?? 0) - minB) / rangeB) * 255);
        }
    }

    return { data, width: imageData.width, height: imageData.height };
}

/**
 * Unsharp mask sharpening
 */
function sharpenImage(imageData: SimpleImageData, factor: number): SimpleImageData {
    const { width, height } = imageData;
    const srcData = imageData.data;
    const data = new Uint8ClampedArray(srcData);

    // Apply unsharp mask: original + factor * (original - blurred)
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;

            for (let c = 0; c < 3; c++) {
                const center = srcData[idx + c] ?? 0;

                // Simple blur of surrounding pixels
                let blur = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const srcIdx = ((y + dy) * width + (x + dx)) * 4 + c;
                        blur += srcData[srcIdx] ?? 0;
                    }
                }
                blur /= 9;

                // Unsharp mask
                const sharpened = center + factor * (center - blur);
                data[idx + c] = Math.min(255, Math.max(0, Math.round(sharpened)));
            }
        }
    }

    return { data, width, height };
}

/**
 * Export scene analysis for debugging/logging
 */
export function describeScene(scene: SceneAnalysis): string {
    return (
        `Brightness: ${scene.brightnessLevel} (${scene.brightness.toFixed(0)}), ` +
        `Contrast: ${scene.contrastLevel} (${scene.contrast.toFixed(0)}), ` +
        `Noise: ${scene.noiseLevel}, ` +
        `Environment: ${scene.environmentHint}` +
        (scene.hasHeavyEffects ? ', Heavy effects detected' : '')
    );
}
