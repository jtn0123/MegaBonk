// ========================================
// Template Variant Generator
// ========================================
// Generates brightness/contrast variants of templates to improve
// matching across different lighting conditions in screenshots

/**
 * Simple image data interface
 */
interface SimpleImageData {
    data: Uint8ClampedArray | number[];
    width: number;
    height: number;
}

/**
 * Template variant types
 */
export type VariantType =
    | 'original'
    | 'bright'
    | 'dark'
    | 'high_contrast'
    | 'low_contrast'
    | 'warm'    // Reddish (hell biome)
    | 'cool';   // Bluish (snow biome)

/**
 * Template variant metadata
 */
export interface TemplateVariant {
    type: VariantType;
    imageData: SimpleImageData;
    description: string;
}

/**
 * Configuration for variant generation
 */
export interface VariantConfig {
    /** Generate brightness variants */
    generateBrightness: boolean;
    /** Generate contrast variants */
    generateContrast: boolean;
    /** Generate color temperature variants */
    generateColorTemp: boolean;
    /** Brightness adjustment for 'bright' variant */
    brightAdjust: number;
    /** Brightness adjustment for 'dark' variant */
    darkAdjust: number;
    /** Contrast factor for 'high_contrast' variant */
    highContrastFactor: number;
    /** Contrast factor for 'low_contrast' variant */
    lowContrastFactor: number;
    /** Color temperature shift for warm/cool variants */
    colorTempShift: number;
}

/**
 * Default variant configuration
 */
export const DEFAULT_VARIANT_CONFIG: VariantConfig = {
    generateBrightness: true,
    generateContrast: true,
    generateColorTemp: false,  // Disabled by default - adds overhead
    brightAdjust: 30,
    darkAdjust: -25,
    highContrastFactor: 1.3,
    lowContrastFactor: 0.8,
    colorTempShift: 20,
};

/**
 * Minimal variant configuration (faster, less memory)
 */
export const MINIMAL_VARIANT_CONFIG: VariantConfig = {
    generateBrightness: true,
    generateContrast: false,
    generateColorTemp: false,
    brightAdjust: 25,
    darkAdjust: -20,
    highContrastFactor: 1.2,
    lowContrastFactor: 0.85,
    colorTempShift: 15,
};

/**
 * Full variant configuration (most comprehensive)
 */
export const FULL_VARIANT_CONFIG: VariantConfig = {
    generateBrightness: true,
    generateContrast: true,
    generateColorTemp: true,
    brightAdjust: 35,
    darkAdjust: -30,
    highContrastFactor: 1.4,
    lowContrastFactor: 0.75,
    colorTempShift: 25,
};

/**
 * Generate all template variants based on configuration
 */
export function generateVariants(
    original: SimpleImageData,
    config: VariantConfig = DEFAULT_VARIANT_CONFIG
): TemplateVariant[] {
    const variants: TemplateVariant[] = [
        {
            type: 'original',
            imageData: original,
            description: 'Original template',
        },
    ];

    if (config.generateBrightness) {
        variants.push({
            type: 'bright',
            imageData: adjustBrightness(original, config.brightAdjust),
            description: `Brightness +${config.brightAdjust}`,
        });

        variants.push({
            type: 'dark',
            imageData: adjustBrightness(original, config.darkAdjust),
            description: `Brightness ${config.darkAdjust}`,
        });
    }

    if (config.generateContrast) {
        variants.push({
            type: 'high_contrast',
            imageData: adjustContrast(original, config.highContrastFactor),
            description: `Contrast x${config.highContrastFactor}`,
        });

        variants.push({
            type: 'low_contrast',
            imageData: adjustContrast(original, config.lowContrastFactor),
            description: `Contrast x${config.lowContrastFactor}`,
        });
    }

    if (config.generateColorTemp) {
        variants.push({
            type: 'warm',
            imageData: adjustColorTemperature(original, config.colorTempShift),
            description: `Warm (hell biome)`,
        });

        variants.push({
            type: 'cool',
            imageData: adjustColorTemperature(original, -config.colorTempShift),
            description: `Cool (snow biome)`,
        });
    }

    return variants;
}

/**
 * Adjust brightness of image
 */
function adjustBrightness(imageData: SimpleImageData, amount: number): SimpleImageData {
    const data = new Uint8ClampedArray(imageData.data);

    for (let i = 0; i < data.length; i += 4) {
        data[i] = clamp((data[i] ?? 0) + amount);       // R
        data[i + 1] = clamp((data[i + 1] ?? 0) + amount); // G
        data[i + 2] = clamp((data[i + 2] ?? 0) + amount); // B
        // Alpha unchanged
    }

    return { data, width: imageData.width, height: imageData.height };
}

/**
 * Adjust contrast of image
 */
function adjustContrast(imageData: SimpleImageData, factor: number): SimpleImageData {
    const data = new Uint8ClampedArray(imageData.data);
    const midpoint = 128;

    for (let i = 0; i < data.length; i += 4) {
        data[i] = clamp(midpoint + ((data[i] ?? 0) - midpoint) * factor);
        data[i + 1] = clamp(midpoint + ((data[i + 1] ?? 0) - midpoint) * factor);
        data[i + 2] = clamp(midpoint + ((data[i + 2] ?? 0) - midpoint) * factor);
    }

    return { data, width: imageData.width, height: imageData.height };
}

/**
 * Adjust color temperature (warm = positive, cool = negative)
 */
function adjustColorTemperature(imageData: SimpleImageData, shift: number): SimpleImageData {
    const data = new Uint8ClampedArray(imageData.data);

    for (let i = 0; i < data.length; i += 4) {
        // Warm: increase R, decrease B
        // Cool: decrease R, increase B
        data[i] = clamp((data[i] ?? 0) + shift);       // R
        // G stays relatively unchanged
        data[i + 2] = clamp((data[i + 2] ?? 0) - shift); // B
    }

    return { data, width: imageData.width, height: imageData.height };
}

/**
 * Clamp value to 0-255 range
 */
function clamp(value: number): number {
    return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * Get recommended variant for a scene type
 */
export function getRecommendedVariant(sceneType: string): VariantType {
    switch (sceneType.toLowerCase()) {
        case 'hell':
        case 'lava':
        case 'fire':
            return 'warm';
        case 'snow':
        case 'ice':
        case 'frost':
            return 'cool';
        case 'dark':
        case 'crypt':
        case 'night':
            return 'bright';
        case 'bright':
        case 'desert':
            return 'dark';
        default:
            return 'original';
    }
}

/**
 * Score a template variant against a cell image
 * Returns how well the variant matches the cell's characteristics
 */
export function scoreVariantMatch(
    variant: TemplateVariant,
    cellBrightness: number,
    cellContrast: number
): number {
    // Base score
    let score = 1.0;

    // Adjust based on cell brightness
    if (cellBrightness < 80) {
        // Dark cell - prefer bright variant
        if (variant.type === 'bright') score += 0.15;
        if (variant.type === 'dark') score -= 0.15;
    } else if (cellBrightness > 180) {
        // Bright cell - prefer dark variant
        if (variant.type === 'dark') score += 0.15;
        if (variant.type === 'bright') score -= 0.15;
    }

    // Adjust based on cell contrast
    if (cellContrast < 30) {
        // Low contrast cell - prefer high contrast template
        if (variant.type === 'high_contrast') score += 0.1;
        if (variant.type === 'low_contrast') score -= 0.1;
    } else if (cellContrast > 70) {
        // High contrast cell - prefer low contrast template
        if (variant.type === 'low_contrast') score += 0.1;
        if (variant.type === 'high_contrast') score -= 0.1;
    }

    return Math.max(0.5, Math.min(1.5, score));
}

/**
 * Select best variants for a given scene
 */
export function selectBestVariants(
    variants: TemplateVariant[],
    sceneType?: string,
    maxVariants: number = 3
): TemplateVariant[] {
    if (variants.length <= maxVariants) {
        return variants;
    }

    // Always include original
    const selected: TemplateVariant[] = [variants[0]];

    // Get recommended variant for scene
    const recommendedType = sceneType ? getRecommendedVariant(sceneType) : 'original';

    // Add recommended variant if different from original
    const recommended = variants.find(v => v.type === recommendedType);
    if (recommended && recommended.type !== 'original') {
        selected.push(recommended);
    }

    // Fill remaining slots with diversity
    const remaining = variants.filter(v => !selected.includes(v));
    while (selected.length < maxVariants && remaining.length > 0) {
        // Prefer contrast variants next
        const contrast = remaining.find(v =>
            v.type === 'high_contrast' || v.type === 'low_contrast'
        );
        if (contrast) {
            selected.push(contrast);
            remaining.splice(remaining.indexOf(contrast), 1);
            continue;
        }

        // Then brightness variants
        const brightness = remaining.find(v =>
            v.type === 'bright' || v.type === 'dark'
        );
        if (brightness) {
            selected.push(brightness);
            remaining.splice(remaining.indexOf(brightness), 1);
            continue;
        }

        // Otherwise just take the next one
        selected.push(remaining.shift()!);
    }

    return selected;
}

/**
 * Calculate statistics about template variants
 */
export function getVariantStats(variants: TemplateVariant[]): {
    count: number;
    types: VariantType[];
    hasBrightness: boolean;
    hasContrast: boolean;
    hasColorTemp: boolean;
} {
    const types = variants.map(v => v.type);
    return {
        count: variants.length,
        types,
        hasBrightness: types.includes('bright') || types.includes('dark'),
        hasContrast: types.includes('high_contrast') || types.includes('low_contrast'),
        hasColorTemp: types.includes('warm') || types.includes('cool'),
    };
}
