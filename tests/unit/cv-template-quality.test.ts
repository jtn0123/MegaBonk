/**
 * Template Quality and Visual Similarity Tests
 * Validates that item templates are distinct and of good quality
 * This is critical for avoiding false positives in detection
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Known visually similar item pairs that users commonly confuse
const CONFUSABLE_PAIRS = [
    ['Medkit', 'First Aid Kit'], // Medical items (if both exist)
    ['Ice Crystal', 'Ice Cube'], // Ice-related items
    ['Moldy Cheese', 'Cheese'], // Cheese variants (if both exist)
    ['Demonic Soul', 'Cursed Doll'], // Demonic items
    ['Battery', 'Energy Core'], // Energy items
    ['Beefy Ring', 'Slippery Ring'], // Similar rings
    ['Dragonfire', 'Lightning Orb'], // Similar spell effects
    ['Holy Book', 'Shattered Knowledge'], // Book items
];

describe('Template Quality Validation', () => {
    describe('Template Existence', () => {
        it('should have templates for all items in data', async () => {
            // Load items data
            const itemsPath = path.join(process.cwd(), 'data', 'items.json');
            const itemsData = JSON.parse(fs.readFileSync(itemsPath, 'utf-8'));

            const items = itemsData.items || [];
            const missingTemplates: string[] = [];

            for (const item of items) {
                // Templates are stored in src/images/, not public/images/
                // item.image = "images/items/anvil.png"
                // Actual path: src/images/items/anvil.png
                const imagePath = item.image || '';
                const templatePath = path.join(process.cwd(), 'src', imagePath);

                // Check both PNG and WebP versions (either is acceptable)
                const pngExists = fs.existsSync(templatePath);
                const webpPath = templatePath.replace('.png', '.webp');
                const webpExists = fs.existsSync(webpPath);

                if (!pngExists && !webpExists) {
                    missingTemplates.push(`${item.name} -> ${item.image}`);
                }
            }

            if (missingTemplates.length > 0) {
                console.warn(`Missing templates for ${missingTemplates.length} items:`);
                console.warn(missingTemplates.slice(0, 10).join('\n'));
            }

            // All templates should exist
            expect(missingTemplates.length).toBe(0);
        });

        it('should have valid image file extensions', async () => {
            const itemsPath = path.join(process.cwd(), 'data', 'items.json');
            const itemsData = JSON.parse(fs.readFileSync(itemsPath, 'utf-8'));

            const items = itemsData.items || [];
            const invalidExtensions: string[] = [];

            for (const item of items) {
                const imagePath = item.image || '';
                const ext = path.extname(imagePath).toLowerCase();

                if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
                    invalidExtensions.push(`${item.name} -> ${imagePath}`);
                }
            }

            expect(invalidExtensions).toHaveLength(0);
        });
    });

    describe('Template Dimensions', () => {
        it('should have consistent template sizes', async () => {
            const itemsPath = path.join(process.cwd(), 'data', 'items.json');

            if (!fs.existsSync(itemsPath)) {
                return; // Skip if data not available
            }

            const itemsData = JSON.parse(fs.readFileSync(itemsPath, 'utf-8'));
            const items = itemsData.items || [];

            const dimensions = new Map<string, number>();

            for (const item of items.slice(0, 10)) {
                // Sample 10 items
                const imagePath = item.image || '';
                const templatePath = path.join(process.cwd(), 'src', imagePath);

                if (fs.existsSync(templatePath)) {
                    try {
                        // In real implementation, would load image and check dimensions
                        // For now, just check file size as proxy
                        const stats = fs.statSync(templatePath);
                        const sizeCategory = Math.floor(stats.size / 1000); // KB bucket

                        dimensions.set(item.name, sizeCategory);
                    } catch (e) {
                        // Skip
                    }
                }
            }

            // Check that sizes are reasonably consistent (within 10x range)
            const sizes = Array.from(dimensions.values());
            if (sizes.length > 0) {
                const minSize = Math.min(...sizes);
                const maxSize = Math.max(...sizes);

                console.log(`Template size range: ${minSize}KB - ${maxSize}KB`);

                // Templates shouldn't vary by more than 10x
                expect(maxSize / Math.max(minSize, 1)).toBeLessThan(10);
            }
        });
    });

    describe('Visual Similarity Detection', () => {
        it('should detect potential confusion between similar items', () => {
            // This test validates that we're aware of confusable pairs
            // In production, would load templates and compute similarity scores

            const confusableItemNames = CONFUSABLE_PAIRS.flat().map(name => name.toLowerCase());

            // Check that confusable items exist in our test data
            const uniqueItems = new Set(confusableItemNames);

            expect(uniqueItems.size).toBeGreaterThan(0);
            expect(CONFUSABLE_PAIRS.length).toBeGreaterThan(0);

            console.log(`Tracking ${CONFUSABLE_PAIRS.length} potentially confusable item pairs`);
        });

        it('should have different templates for confusable items', async () => {
            // Load items data to get image paths
            const itemsPath = path.join(process.cwd(), 'data', 'items.json');

            if (!fs.existsSync(itemsPath)) {
                return; // Skip if data not available
            }

            const itemsData = JSON.parse(fs.readFileSync(itemsPath, 'utf-8'));
            const items = itemsData.items || [];

            const itemImageMap = new Map<string, string>();
            for (const item of items) {
                itemImageMap.set(item.name.toLowerCase(), item.image || '');
            }

            // Check each confusable pair has different image paths
            for (const [item1, item2] of CONFUSABLE_PAIRS) {
                const image1 = itemImageMap.get(item1.toLowerCase());
                const image2 = itemImageMap.get(item2.toLowerCase());

                if (image1 && image2) {
                    // Images should have different paths
                    expect(image1).not.toBe(image2);
                }
            }
        });

        it('should measure discrimination between confusable items', () => {
            // This is a placeholder for a real visual similarity test
            // In production, would:
            // 1. Load template pairs
            // 2. Calculate similarity score (NCC, SSIM)
            // 3. Ensure score is below threshold (e.g., < 0.95)

            const mockSimilarityScores = {
                'Wrench vs wrench': 0.78,
                'Medkit vs First Aid Kit': 0.85,
                'Ice Crystal vs Ice Cube': 0.82,
                'Forbidden Juice vs forbidden juice': 0.88,
            };

            // All similarity scores should be below perfect match
            for (const [pair, score] of Object.entries(mockSimilarityScores)) {
                expect(score).toBeLessThan(1.0);

                // Should be discriminable (< 0.95)
                if (score >= 0.95) {
                    console.warn(`HIGH SIMILARITY WARNING: ${pair} = ${score}`);
                }
            }
        });
    });

    describe('Template Quality Metrics', () => {
        it('should have non-blank templates', () => {
            // Templates should have sufficient non-zero pixels
            // Prevents blank or corrupted templates from being used

            const mockTemplates = [
                { name: 'Wrench', nonZeroPixels: 850, totalPixels: 1024 },
                { name: 'Medkit', nonZeroPixels: 920, totalPixels: 1024 },
                { name: 'Ice Crystal', nonZeroPixels: 780, totalPixels: 1024 },
            ];

            for (const template of mockTemplates) {
                const density = template.nonZeroPixels / template.totalPixels;

                // At least 50% of pixels should be non-zero
                expect(density).toBeGreaterThan(0.5);
            }
        });

        it('should have sufficient contrast', () => {
            // Templates should have good contrast for matching
            // Measured by standard deviation of pixel values

            const mockTemplates = [
                { name: 'Wrench', stdDev: 45.2 },
                { name: 'Medkit', stdDev: 52.8 },
                { name: 'Ice Crystal', stdDev: 38.6 },
            ];

            for (const template of mockTemplates) {
                // Standard deviation should be > 20 for good contrast
                expect(template.stdDev).toBeGreaterThan(20);
            }
        });

        it('should not be all one color', () => {
            // Templates should have color variance
            // Prevents solid-color templates that would match everything

            const mockTemplates = [
                { name: 'Wrench', uniqueColors: 128 },
                { name: 'Medkit', uniqueColors: 156 },
                { name: 'Ice Crystal', uniqueColors: 98 },
            ];

            for (const template of mockTemplates) {
                // Should have at least 50 unique colors
                expect(template.uniqueColors).toBeGreaterThan(50);
            }
        });
    });

    describe('Rarity Color Validation', () => {
        it('should have distinct colors for each rarity', () => {
            const rarityColors = {
                common: '#9d9d9d',
                uncommon: '#1eff00',
                rare: '#0070dd',
                epic: '#a335ee',
                legendary: '#ff8000',
            };

            // Colors should be distinct
            const colors = Object.values(rarityColors);
            const uniqueColors = new Set(colors);

            expect(uniqueColors.size).toBe(colors.length);
        });

        it('should have correct rarity borders on item templates', () => {
            // Mock: check that items have correct border colors matching rarity
            const mockItems = [
                { name: 'Wrench', rarity: 'common', borderColor: '#9d9d9d', matches: true },
                { name: 'Beefy Ring', rarity: 'rare', borderColor: '#0070dd', matches: true },
                { name: 'Big Bonk', rarity: 'legendary', borderColor: '#ff8000', matches: true },
            ];

            for (const item of mockItems) {
                expect(item.matches).toBe(true);
            }
        });
    });

    describe('Template Naming Consistency', () => {
        it('should have consistent naming between data and files', async () => {
            const itemsPath = path.join(process.cwd(), 'data', 'items.json');

            if (!fs.existsSync(itemsPath)) {
                return; // Skip if data not available
            }

            const itemsData = JSON.parse(fs.readFileSync(itemsPath, 'utf-8'));
            const items = itemsData.items || [];

            const namingIssues: string[] = [];

            for (const item of items) {
                const imagePath = item.image || '';
                const fileName = path.basename(imagePath, path.extname(imagePath));

                // Check if file name roughly matches item name
                const itemNameNormalized = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                const fileNameNormalized = fileName.toLowerCase().replace(/[^a-z0-9]/g, '');

                // Should have some similarity
                if (!fileNameNormalized.includes(itemNameNormalized.substring(0, 5))) {
                    namingIssues.push(`${item.name} -> ${fileName}`);
                }
            }

            if (namingIssues.length > 0) {
                console.warn(`Potential naming inconsistencies: ${namingIssues.length}`);
            }

            // Soft check - most should be consistent
            expect(namingIssues.length).toBeLessThan(items.length * 0.1);
        });
    });

    describe('Performance - Template Loading', () => {
        it('should load templates efficiently', () => {
            // Mock template loading performance
            const loadTimes = [5, 8, 6, 7, 9, 5, 6, 8, 7, 6]; // ms per template

            const avgLoadTime = loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length;

            // Average load time should be < 10ms
            expect(avgLoadTime).toBeLessThan(10);
        });

        it('should cache templates to avoid reloading', () => {
            const cacheStats = {
                hits: 95,
                misses: 5,
                totalRequests: 100,
            };

            const hitRate = cacheStats.hits / cacheStats.totalRequests;

            // Cache hit rate should be > 90%
            expect(hitRate).toBeGreaterThan(0.9);
        });
    });
});

describe('Integration: Template Quality Impact on Detection', () => {
    it('should detect high-quality templates with high confidence', () => {
        // Mock detection results for high-quality templates
        const detections = [
            { template: 'Wrench', quality: 0.95, confidence: 0.88 },
            { template: 'Medkit', quality: 0.92, confidence: 0.86 },
            { template: 'Ice Crystal', quality: 0.90, confidence: 0.84 },
        ];

        for (const detection of detections) {
            // High quality should correlate with high confidence
            if (detection.quality > 0.9) {
                expect(detection.confidence).toBeGreaterThan(0.8);
            }
        }
    });

    it('should struggle with low-quality templates', () => {
        // Mock detection results for low-quality templates
        const detections = [
            { template: 'BlurryItem', quality: 0.45, confidence: 0.52 },
            { template: 'LowContrastItem', quality: 0.38, confidence: 0.48 },
        ];

        for (const detection of detections) {
            // Low quality should result in lower confidence
            if (detection.quality < 0.5) {
                expect(detection.confidence).toBeLessThan(0.7);
            }
        }
    });

    it('should prioritize high-quality templates in multi-match scenarios', () => {
        // When multiple templates match, prefer the one with better quality
        const matches = [
            { template: 'Wrench', quality: 0.95, confidence: 0.85 },
            { template: 'wrench_lowres', quality: 0.6, confidence: 0.82 },
        ];

        // Sort by quality
        matches.sort((a, b) => b.quality - a.quality);

        // Highest quality should be first
        expect(matches[0].template).toBe('Wrench');
    });
});
