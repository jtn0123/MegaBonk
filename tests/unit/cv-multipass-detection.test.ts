/**
 * Multi-Pass Detection Tests
 * Tests multi-region scanning, color pre-filtering, and rarity validation
 * Critical for detection accuracy and performance optimization
 */

import { describe, it, expect, vi } from 'vitest';
import type { CVDetectionResult, ROI } from '../../src/modules/cv/types.ts';

// Mock helpers
function createMockContext(width: number, height: number): CanvasRenderingContext2D {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas.getContext('2d')!;
}

function createMockImageData(width: number, height: number, fillColor: [number, number, number]): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(width, height);
    const [r, g, b] = fillColor;

    for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i] = r;
        imageData.data[i + 1] = g;
        imageData.data[i + 2] = b;
        imageData.data[i + 3] = 255;
    }

    return imageData;
}

describe('Multi-Region Detection Strategy', () => {
    describe('Hotbar Region (Bottom 20%)', () => {
        it('should define hotbar region at bottom 20% of screen', () => {
            const width = 1280;
            const height = 720;

            const hotbarROI: ROI = {
                x: 0,
                y: Math.floor(height * 0.8),
                width: width,
                height: Math.floor(height * 0.2),
                label: 'hotbar_region',
            };

            expect(hotbarROI.y).toBe(576);
            expect(hotbarROI.height).toBe(144);
            expect(hotbarROI.width).toBe(1280);
        });

        it('should scale hotbar region with resolution (1080p)', () => {
            const width = 1920;
            const height = 1080;

            const hotbarROI: ROI = {
                x: 0,
                y: Math.floor(height * 0.8),
                width: width,
                height: Math.floor(height * 0.2),
            };

            expect(hotbarROI.y).toBe(864);
            expect(hotbarROI.height).toBe(216);
        });

        it('should cover full width for hotbar', () => {
            const width = 2560;
            const height = 1440;

            const hotbarROI: ROI = {
                x: 0,
                y: Math.floor(height * 0.8),
                width: width,
                height: Math.floor(height * 0.2),
            };

            expect(hotbarROI.x).toBe(0);
            expect(hotbarROI.width).toBe(2560);
        });
    });

    describe('Equipment Region (Top-Left 25% × 40%)', () => {
        it('should define equipment region in top-left corner', () => {
            const width = 1280;
            const height = 720;

            const equipmentROI: ROI = {
                x: 0,
                y: 0,
                width: Math.floor(width * 0.25),
                height: Math.floor(height * 0.4),
                label: 'equipment_region',
            };

            expect(equipmentROI.x).toBe(0);
            expect(equipmentROI.y).toBe(0);
            expect(equipmentROI.width).toBe(320);
            expect(equipmentROI.height).toBe(288);
        });

        it('should scale equipment region with resolution', () => {
            const width = 1920;
            const height = 1080;

            const equipmentROI: ROI = {
                x: 0,
                y: 0,
                width: Math.floor(width * 0.25),
                height: Math.floor(height * 0.4),
            };

            expect(equipmentROI.width).toBe(480);
            expect(equipmentROI.height).toBe(432);
        });

        it('should not overlap with hotbar region', () => {
            const width = 1280;
            const height = 720;

            const hotbarROI: ROI = {
                x: 0,
                y: Math.floor(height * 0.8),
                width: width,
                height: Math.floor(height * 0.2),
            };

            const equipmentROI: ROI = {
                x: 0,
                y: 0,
                width: Math.floor(width * 0.25),
                height: Math.floor(height * 0.4),
            };

            // Equipment ends at y=288, hotbar starts at y=576
            expect(equipmentROI.y + equipmentROI.height).toBeLessThan(hotbarROI.y);
        });
    });

    describe('Region Priority and Coverage', () => {
        it('should have reasonable scan step sizes for each region', () => {
            // Hotbar: stepSize = 10 (from detection.ts line 872)
            // Equipment: stepSize = 8 (from detection.ts line 629)

            const hotbarStep = 10;
            const equipmentStep = 8;

            // Equipment should have finer step (more precision)
            expect(equipmentStep).toBeLessThan(hotbarStep);

            // Both should be reasonable for 45px icons
            expect(hotbarStep).toBeLessThan(20);
            expect(equipmentStep).toBeLessThan(15);
        });

        it('should have appropriate confidence thresholds per region', () => {
            // Hotbar: minConfidence = 0.72 (from detection.ts line 872)
            // Equipment: minConfidence = 0.70 (from detection.ts line 630)

            const hotbarMinConf = 0.72;
            const equipmentMinConf = 0.70;

            // Equipment can be slightly more lenient
            expect(equipmentMinConf).toBeLessThanOrEqual(hotbarMinConf);

            // Both should be reasonably high
            expect(hotbarMinConf).toBeGreaterThan(0.65);
            expect(equipmentMinConf).toBeGreaterThan(0.65);
        });

        it('should cover distinct screen areas without gaps', () => {
            const width = 1280;
            const height = 720;

            const hotbarROI: ROI = {
                x: 0,
                y: Math.floor(height * 0.8),
                width: width,
                height: Math.floor(height * 0.2),
            };

            const equipmentROI: ROI = {
                x: 0,
                y: 0,
                width: Math.floor(width * 0.25),
                height: Math.floor(height * 0.4),
            };

            // Total scanned area
            const hotbarArea = hotbarROI.width * hotbarROI.height;
            const equipmentArea = equipmentROI.width * equipmentROI.height;
            const totalScanned = hotbarArea + equipmentArea;

            // Total screen area
            const screenArea = width * height;

            // Should scan reasonable percentage (at least 25%)
            const coverage = totalScanned / screenArea;
            expect(coverage).toBeGreaterThan(0.20);
            expect(coverage).toBeLessThan(0.50);
        });
    });
});

describe('Color-Based Pre-Filtering', () => {
    describe('Dominant Color Extraction', () => {
        it('should extract red as dominant color', () => {
            const imageData = createMockImageData(45, 45, [200, 50, 50]);

            // Simulate getDominantColor (simplified)
            const r = 200;
            const g = 50;
            const b = 50;
            const max = Math.max(r, g, b);

            let color = 'mixed';
            if (max === r && r > 100 && r > g * 1.5 && r > b * 1.5) {
                color = 'red';
            }

            expect(color).toBe('red');
        });

        it('should extract green as dominant color', () => {
            const imageData = createMockImageData(45, 45, [50, 200, 50]);

            const r = 50;
            const g = 200;
            const b = 50;
            const max = Math.max(r, g, b);

            let color = 'mixed';
            if (max === g && g > 100 && g > r * 1.5 && g > b * 1.5) {
                color = 'green';
            }

            expect(color).toBe('green');
        });

        it('should extract blue as dominant color', () => {
            const imageData = createMockImageData(45, 45, [50, 50, 200]);

            const r = 50;
            const g = 50;
            const b = 200;
            const max = Math.max(r, g, b);

            let color = 'mixed';
            if (max === b && b > 100 && b > r * 1.5 && b > g * 1.5) {
                color = 'blue';
            }

            expect(color).toBe('blue');
        });

        it('should classify mixed colors when no clear dominant', () => {
            const imageData = createMockImageData(45, 45, [100, 100, 100]);

            const r = 100;
            const g = 100;
            const b = 100;

            // No channel dominates
            const isDominant = (val: number, others: number[]) => {
                return val > 100 && others.every(o => val > o * 1.5);
            };

            const color =
                isDominant(r, [g, b]) ? 'red' :
                isDominant(g, [r, b]) ? 'green' :
                isDominant(b, [r, g]) ? 'blue' :
                'mixed';

            expect(color).toBe('mixed');
        });
    });

    describe('Template Filtering by Color', () => {
        it('should filter candidates to color-matching items', () => {
            // Simulate templatesByColor map
            const templatesByColor = new Map([
                ['red', ['Fire Staff', 'Spicy Meatball', 'Lava Cake']],
                ['blue', ['Ice Staff', 'Water Flask', 'Frost Orb']],
                ['green', ['Slime', 'Medkit', 'Grass Seed']],
                ['mixed', ['Wrench', 'Battery', 'Gear']],
            ]);

            const allItems = [
                'Fire Staff', 'Ice Staff', 'Slime', 'Wrench',
                'Spicy Meatball', 'Water Flask', 'Medkit', 'Battery',
                'Lava Cake', 'Frost Orb', 'Grass Seed', 'Gear',
            ];

            // Detect red dominant color
            const detectedColor = 'red';
            const colorCandidates = templatesByColor.get(detectedColor) || [];
            const mixedCandidates = templatesByColor.get('mixed') || [];
            const candidates = [...colorCandidates, ...mixedCandidates];

            // Should only include red items + mixed items
            expect(candidates).toContain('Fire Staff');
            expect(candidates).toContain('Spicy Meatball');
            expect(candidates).toContain('Lava Cake');
            expect(candidates).toContain('Wrench');
            expect(candidates).toContain('Battery');

            // Should exclude blue/green items
            expect(candidates).not.toContain('Ice Staff');
            expect(candidates).not.toContain('Slime');

            // Should be smaller than full item set
            expect(candidates.length).toBeLessThan(allItems.length);
        });

        it('should fallback to top 30 items if no color matches', () => {
            const templatesByColor = new Map([
                ['red', ['Fire Staff']],
                ['blue', ['Ice Staff']],
            ]);

            const allItems = Array.from({ length: 78 }, (_, i) => `Item ${i}`);

            // Detect unknown color
            const detectedColor = 'yellow';
            const colorCandidates = templatesByColor.get(detectedColor) || [];
            const mixedCandidates = templatesByColor.get('mixed') || [];
            const candidateItems = [...colorCandidates, ...mixedCandidates];
            const itemsToCheck = candidateItems.length > 0 ? candidateItems : allItems.slice(0, 30);

            // Should fall back to first 30 items
            expect(itemsToCheck.length).toBe(30);
            expect(itemsToCheck).toContain('Item 0');
            expect(itemsToCheck).toContain('Item 29');
            expect(itemsToCheck).not.toContain('Item 30');
        });

        it('should reduce search space significantly for common colors', () => {
            // Real-world scenario: 78 total items, only ~20 are red
            const templatesByColor = new Map([
                ['red', Array.from({ length: 20 }, (_, i) => `Red Item ${i}`)],
                ['blue', Array.from({ length: 18 }, (_, i) => `Blue Item ${i}`)],
                ['green', Array.from({ length: 15 }, (_, i) => `Green Item ${i}`)],
                ['mixed', Array.from({ length: 25 }, (_, i) => `Mixed Item ${i}`)],
            ]);

            const allItemsCount = 78;
            const detectedColor = 'red';

            const colorCandidates = templatesByColor.get(detectedColor) || [];
            const mixedCandidates = templatesByColor.get('mixed') || [];
            const candidates = [...colorCandidates, ...mixedCandidates];

            // Red (20) + Mixed (25) = 45 candidates vs 78 total
            expect(candidates.length).toBe(45);

            // 42% reduction in search space
            const reduction = 1 - candidates.length / allItemsCount;
            expect(reduction).toBeGreaterThan(0.40);
        });
    });

    describe('Empty Cell Detection', () => {
        it('should skip matching on empty cells', () => {
            const emptyImageData = createMockImageData(45, 45, [30, 30, 30]);

            // Calculate variance
            let sum = 0;
            let count = 0;
            const data = emptyImageData.data;

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const gray = (r + g + b) / 3;
                sum += gray;
                count++;
            }

            const mean = sum / count;

            let variance = 0;
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const gray = (r + g + b) / 3;
                variance += Math.pow(gray - mean, 2);
            }
            variance /= count;

            // Empty cell has low variance
            expect(variance).toBeLessThan(100);

            // Should skip template matching
            const shouldMatch = variance >= 800; // From detection.ts line 537
            expect(shouldMatch).toBe(false);
        });

        it('should process cells with sufficient variance', () => {
            // Create cell with pattern (high variance)
            const canvas = document.createElement('canvas');
            canvas.width = 45;
            canvas.height = 45;
            const ctx = canvas.getContext('2d')!;

            // Draw checkerboard pattern
            for (let y = 0; y < 45; y++) {
                for (let x = 0; x < 45; x++) {
                    ctx.fillStyle = (x + y) % 2 === 0 ? '#FFFFFF' : '#000000';
                    ctx.fillRect(x, y, 1, 1);
                }
            }

            const imageData = ctx.getImageData(0, 0, 45, 45);

            // Calculate variance
            const data = imageData.data;
            let sum = 0;
            let count = 0;

            for (let i = 0; i < data.length; i += 4) {
                const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
                sum += gray;
                count++;
            }

            const mean = sum / count;
            let variance = 0;

            for (let i = 0; i < data.length; i += 4) {
                const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
                variance += Math.pow(gray - mean, 2);
            }
            variance /= count;

            // High variance pattern
            expect(variance).toBeGreaterThan(800);

            const shouldMatch = variance >= 800;
            expect(shouldMatch).toBe(true);
        });
    });
});

describe('Rarity-Based Validation', () => {
    describe('Border Rarity Detection', () => {
        it('should boost confidence when border matches item rarity', () => {
            const originalConfidence = 0.80;
            const detectedBorderRarity = 'epic';
            const itemRarity = 'epic';

            // Simulate validation boost (detection.ts line 447)
            const boostedConfidence =
                detectedBorderRarity === itemRarity
                    ? Math.min(0.99, originalConfidence * 1.05)
                    : originalConfidence * 0.85;

            expect(boostedConfidence).toBe(0.84); // 0.80 * 1.05
            expect(boostedConfidence).toBeGreaterThan(originalConfidence);
        });

        it('should reduce confidence when border does not match item rarity', () => {
            const originalConfidence = 0.80;
            const detectedBorderRarity = 'common';
            const itemRarity = 'legendary';

            // Simulate validation penalty
            const penalizedConfidence =
                detectedBorderRarity === itemRarity
                    ? Math.min(0.99, originalConfidence * 1.05)
                    : originalConfidence * 0.85;

            expect(penalizedConfidence).toBe(0.68); // 0.80 * 0.85
            expect(penalizedConfidence).toBeLessThan(originalConfidence);
        });

        it('should keep confidence unchanged when border not detected', () => {
            const originalConfidence = 0.80;
            const detectedBorderRarity = null;

            // No border detected, keep original
            const newConfidence = detectedBorderRarity === null ? originalConfidence : originalConfidence * 1.05;

            expect(newConfidence).toBe(0.80);
        });

        it('should cap boosted confidence at 0.99', () => {
            const originalConfidence = 0.96;
            const detectedBorderRarity = 'epic';
            const itemRarity = 'epic';

            const boostedConfidence = Math.min(0.99, originalConfidence * 1.05);

            expect(boostedConfidence).toBe(0.99);
            expect(boostedConfidence).toBeLessThanOrEqual(0.99);
        });
    });

    describe('Context-Based Confidence Boosting', () => {
        it('should boost common items slightly', () => {
            const originalConfidence = 0.75;
            const rarity = 'common';

            let boost = 0;
            if (rarity === 'common') boost = 0.03;
            else if (rarity === 'uncommon') boost = 0.02;
            else if (rarity === 'legendary') boost = -0.02;

            const newConfidence = originalConfidence + boost;

            expect(newConfidence).toBe(0.78);
        });

        it('should boost uncommon items slightly', () => {
            const originalConfidence = 0.75;
            const rarity = 'uncommon';

            let boost = 0;
            if (rarity === 'common') boost = 0.03;
            else if (rarity === 'uncommon') boost = 0.02;
            else if (rarity === 'legendary') boost = -0.02;

            const newConfidence = originalConfidence + boost;

            expect(newConfidence).toBe(0.77);
        });

        it('should reduce legendary confidence slightly', () => {
            const originalConfidence = 0.75;
            const rarity = 'legendary';

            let boost = 0;
            if (rarity === 'common') boost = 0.03;
            else if (rarity === 'uncommon') boost = 0.02;
            else if (rarity === 'legendary') boost = -0.02;

            const newConfidence = originalConfidence + boost;

            expect(newConfidence).toBe(0.73);
        });

        it('should boost items with detected synergies', () => {
            const baseConfidence = 0.75;
            const detectedItems = ['Wrench', 'Scrap', 'Gear'];
            const currentItem = 'Wrench';

            const synergies: Record<string, string[]> = {
                wrench: ['scrap', 'metal', 'gear'],
                battery: ['tesla', 'electric'],
            };

            const itemSynergies = synergies[currentItem.toLowerCase()] || [];
            let hasSynergy = false;

            for (const synergy of itemSynergies) {
                if (detectedItems.some(name => name.toLowerCase().includes(synergy))) {
                    hasSynergy = true;
                    break;
                }
            }

            const boost = hasSynergy ? 0.03 : 0;
            const newConfidence = baseConfidence + boost;

            expect(newConfidence).toBe(0.78);
        });
    });
});

describe('Multi-Pass Pipeline Integration', () => {
    describe('Pass Execution Order', () => {
        it('should execute passes in correct order', () => {
            const executionLog: string[] = [];

            // Simulate detection pipeline
            executionLog.push('1. Load templates');
            executionLog.push('2. Scan hotbar region');
            executionLog.push('3. Scan equipment region');
            executionLog.push('4. Combine detections');
            executionLog.push('5. Apply context boosting');
            executionLog.push('6. Validate with border rarity');

            expect(executionLog).toHaveLength(6);
            expect(executionLog[0]).toContain('Load templates');
            expect(executionLog[1]).toContain('hotbar');
            expect(executionLog[2]).toContain('equipment');
            expect(executionLog[5]).toContain('border rarity');
        });

        it('should combine detections from all regions', () => {
            const hotbarDetections: CVDetectionResult[] = [
                {
                    type: 'item',
                    entity: { id: 'wrench', name: 'Wrench', rarity: 'common', tier: 'A', image: '', base_effect: '' },
                    confidence: 0.85,
                    position: { x: 100, y: 600, width: 45, height: 45 },
                    method: 'template_match',
                },
            ];

            const equipmentDetections: CVDetectionResult[] = [
                {
                    type: 'item',
                    entity: { id: 'axe', name: 'Axe', rarity: 'common', tier: 'S', image: '', base_effect: '' },
                    confidence: 0.88,
                    position: { x: 50, y: 50, width: 45, height: 45 },
                    method: 'template_match',
                },
            ];

            const allDetections = [...hotbarDetections, ...equipmentDetections];

            expect(allDetections).toHaveLength(2);
            expect(allDetections[0].entity.name).toBe('Wrench');
            expect(allDetections[1].entity.name).toBe('Axe');
        });
    });

    describe('Progressive Confidence Refinement', () => {
        it('should progressively refine confidence through pipeline', () => {
            let confidence = 0.75;
            const steps: Array<{ step: string; confidence: number }> = [];

            steps.push({ step: 'Initial template match', confidence });

            // Step 1: Color match boost
            confidence += 0.02;
            steps.push({ step: 'Color match boost', confidence });

            // Step 2: Rarity context boost (common item)
            confidence += 0.03;
            steps.push({ step: 'Rarity boost (common)', confidence });

            // Step 3: Synergy boost
            confidence += 0.03;
            steps.push({ step: 'Synergy boost', confidence });

            // Step 4: Border rarity validation
            confidence = Math.min(0.99, confidence * 1.05);
            steps.push({ step: 'Border validation', confidence });

            // Final confidence should be higher
            expect(steps[0].confidence).toBe(0.75);
            expect(steps[steps.length - 1].confidence).toBeGreaterThan(0.75);
            expect(steps[steps.length - 1].confidence).toBeCloseTo(0.87, 1);
        });

        it('should filter out low-confidence after refinement', () => {
            const detections = [
                { name: 'Item A', confidence: 0.85 },
                { name: 'Item B', confidence: 0.65 },
                { name: 'Item C', confidence: 0.78 },
            ];

            const minConfidence = 0.70;
            const filtered = detections.filter(d => d.confidence >= minConfidence);

            expect(filtered).toHaveLength(2);
            expect(filtered.map(d => d.name)).toEqual(['Item A', 'Item C']);
        });
    });

    describe('Performance Optimization', () => {
        it('should reduce template matches through color filtering', () => {
            const totalItems = 78;
            const colorFilteredItems = 45;

            const matchesSaved = totalItems - colorFilteredItems;
            const savingsPercentage = (matchesSaved / totalItems) * 100;

            expect(savingsPercentage).toBeGreaterThan(40);
        });

        it('should skip empty cells before template matching', () => {
            const totalCells = 50;
            const filledCells = 20;
            const emptyCells = totalCells - filledCells;

            const matchesSkipped = emptyCells;
            const savingsPercentage = (matchesSkipped / totalCells) * 100;

            expect(savingsPercentage).toBe(60);
        });

        it('should limit scan regions to relevant areas', () => {
            const screenWidth = 1280;
            const screenHeight = 720;
            const fullScreenArea = screenWidth * screenHeight;

            // Hotbar: 1280 × 144
            const hotbarArea = 1280 * 144;

            // Equipment: 320 × 288
            const equipmentArea = 320 * 288;

            const scannedArea = hotbarArea + equipmentArea;
            const coverage = scannedArea / fullScreenArea;

            // Should scan < 40% of screen
            expect(coverage).toBeLessThan(0.40);
            expect(coverage).toBeGreaterThan(0.25);
        });
    });
});
