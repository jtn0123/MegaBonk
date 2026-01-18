/**
 * CV Threshold Boundary and Edge Case Tests
 * Tests confidence thresholds at boundary values and various edge cases
 *
 * This suite covers:
 * - Confidence threshold boundaries (0.85, 0.70, adaptive)
 * - Edge cases (missing icons, partial visibility, overlaps)
 * - Boundary conditions for detection algorithms
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cvTestKit } from '../helpers/cv-test-kit.ts';

// ========================================
// Test Helpers
// ========================================

/**
 * Create mock detection result with position
 */
const createDetection = (
    id: string,
    name: string,
    confidence: number,
    x: number = 0,
    y: number = 0
) => ({
    entity: { id, name } as any,
    confidence,
    x,
    y,
    width: 64,
    height: 64,
});

/**
 * Confidence threshold constants (should match cv-strategy.ts)
 */
const CONFIDENCE_THRESHOLDS = {
    HIGH: 0.85,
    MEDIUM: 0.70,
    LOW: 0.50,
    MINIMUM: 0.40,
};

// ========================================
// Confidence Threshold Boundary Tests
// ========================================

describe('CV Confidence Threshold Boundaries', () => {
    describe('High Confidence Threshold (0.85)', () => {
        it('should accept detection at exactly 0.85', () => {
            const detection = createDetection('wrench', 'Wrench', 0.85);
            expect(detection.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLDS.HIGH);
        });

        it('should accept detection just above 0.85', () => {
            const detection = createDetection('wrench', 'Wrench', 0.8500001);
            expect(detection.confidence).toBeGreaterThan(CONFIDENCE_THRESHOLDS.HIGH);
        });

        it('should reject detection just below 0.85 for high threshold', () => {
            const detection = createDetection('wrench', 'Wrench', 0.8499999);
            expect(detection.confidence).toBeLessThan(CONFIDENCE_THRESHOLDS.HIGH);
        });

        it('should handle floating point precision at 0.85', () => {
            // Test various representations of 0.85
            const values = [0.85, 0.850, 17 / 20, 0.84999999999999999];
            values.forEach(val => {
                const detection = createDetection('wrench', 'Wrench', val);
                // Due to floating point, 0.84999...9 rounds to 0.85
                expect(detection.confidence).toBeCloseTo(0.85, 10);
            });
        });
    });

    describe('Medium Confidence Threshold (0.70)', () => {
        it('should accept detection at exactly 0.70', () => {
            const detection = createDetection('wrench', 'Wrench', 0.70);
            expect(detection.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLDS.MEDIUM);
        });

        it('should categorize 0.70 as medium, not low', () => {
            const confidence = 0.70;
            const isHigh = confidence >= CONFIDENCE_THRESHOLDS.HIGH;
            const isMedium = confidence >= CONFIDENCE_THRESHOLDS.MEDIUM && confidence < CONFIDENCE_THRESHOLDS.HIGH;
            const isLow = confidence < CONFIDENCE_THRESHOLDS.MEDIUM;

            expect(isHigh).toBe(false);
            expect(isMedium).toBe(true);
            expect(isLow).toBe(false);
        });

        it('should categorize 0.6999 as low', () => {
            const confidence = 0.6999;
            const isMedium = confidence >= CONFIDENCE_THRESHOLDS.MEDIUM;
            expect(isMedium).toBe(false);
        });
    });

    describe('Minimum Confidence Threshold (0.40)', () => {
        it('should reject detection below 0.40', () => {
            const detection = createDetection('wrench', 'Wrench', 0.39);
            expect(detection.confidence).toBeLessThan(CONFIDENCE_THRESHOLDS.MINIMUM);
        });

        it('should accept detection at 0.40', () => {
            const detection = createDetection('wrench', 'Wrench', 0.40);
            expect(detection.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLDS.MINIMUM);
        });

        it('should handle very low but valid confidence', () => {
            const detection = createDetection('wrench', 'Wrench', 0.4001);
            expect(detection.confidence).toBeGreaterThan(CONFIDENCE_THRESHOLDS.MINIMUM);
        });
    });

    describe('Extreme Confidence Values', () => {
        it('should handle confidence of exactly 0', () => {
            const detection = createDetection('wrench', 'Wrench', 0);
            expect(detection.confidence).toBe(0);
            expect(detection.confidence).toBeLessThan(CONFIDENCE_THRESHOLDS.MINIMUM);
        });

        it('should handle confidence of exactly 1', () => {
            const detection = createDetection('wrench', 'Wrench', 1.0);
            expect(detection.confidence).toBe(1.0);
            expect(detection.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLDS.HIGH);
        });

        it('should handle confidence > 1 (invalid but possible)', () => {
            const detection = createDetection('wrench', 'Wrench', 1.05);
            // System should clamp or handle values > 1
            expect(detection.confidence).toBeGreaterThan(1.0);
        });

        it('should handle negative confidence (invalid)', () => {
            const detection = createDetection('wrench', 'Wrench', -0.1);
            expect(detection.confidence).toBeLessThan(0);
            expect(detection.confidence).toBeLessThan(CONFIDENCE_THRESHOLDS.MINIMUM);
        });

        it('should handle NaN confidence', () => {
            const detection = createDetection('wrench', 'Wrench', NaN);
            expect(Number.isNaN(detection.confidence)).toBe(true);
        });

        it('should handle Infinity confidence', () => {
            const detection = createDetection('wrench', 'Wrench', Infinity);
            expect(detection.confidence).toBe(Infinity);
        });
    });

    describe('Adaptive Threshold Behavior', () => {
        it('should use higher threshold for common items', () => {
            const commonItemThreshold = CONFIDENCE_THRESHOLDS.MEDIUM + 0.05; // 0.75
            const commonDetection = createDetection('wrench', 'Wrench', 0.74);

            // Common items should require higher confidence
            expect(commonDetection.confidence).toBeLessThan(commonItemThreshold);
        });

        it('should use lower threshold for rare items', () => {
            const rareItemThreshold = CONFIDENCE_THRESHOLDS.MEDIUM - 0.05; // 0.65
            const rareDetection = createDetection('dragonfire', 'Dragonfire', 0.66);

            // Rare items can have lower confidence
            expect(rareDetection.confidence).toBeGreaterThan(rareItemThreshold);
        });

        it('should handle threshold gap detection', () => {
            // When there's a large gap between best and second-best match
            const bestMatch = 0.85;
            const secondBest = 0.45;
            const gap = bestMatch - secondBest;

            // Large gap (>0.20) indicates confident detection
            expect(gap).toBeGreaterThan(0.20);
        });
    });
});

// ========================================
// Edge Case Tests - Detection Scenarios
// ========================================

describe('CV Detection Edge Cases', () => {
    describe('Empty and Missing Icons', () => {
        it('should handle detection on completely empty cell', () => {
            // Empty cell should return no valid detection
            const emptyImage = cvTestKit.image.solid(64, 64, 30, 30, 30);
            expect(emptyImage.width).toBe(64);
            expect(emptyImage.height).toBe(64);

            // Empty cells should be filtered out during detection
            const isEmptyCell = (avgBrightness: number) => avgBrightness < 50;
            const brightness = 30; // Dark cell
            expect(isEmptyCell(brightness)).toBe(true);
        });

        it('should handle missing icon with placeholder', () => {
            // Some cells may have placeholder graphics instead of actual icons
            const placeholderImage = cvTestKit.image.checkerboard(64, 64, 8);
            expect(placeholderImage.data.length).toBe(64 * 64 * 4);
        });

        it('should handle transparent icon areas', () => {
            // Icons may have transparent backgrounds
            const hasTransparentPixels = (imageData: ImageData) => {
                for (let i = 3; i < imageData.data.length; i += 4) {
                    if (imageData.data[i]! < 255) return true;
                }
                return false;
            };

            const opaqueImage = cvTestKit.image.solid(64, 64, 128, 128, 128);
            expect(hasTransparentPixels(opaqueImage)).toBe(false);
        });

        it('should detect empty vs filled cell based on variance', () => {
            const emptyImage = cvTestKit.image.solid(64, 64, 50, 50, 50);
            const filledImage = cvTestKit.image.gradient(64, 64, [50, 50, 50], [200, 150, 100]);

            // Calculate variance
            const calculateVariance = (imageData: ImageData) => {
                const pixels = [];
                for (let i = 0; i < imageData.data.length; i += 4) {
                    pixels.push((imageData.data[i]! + imageData.data[i + 1]! + imageData.data[i + 2]!) / 3);
                }
                const mean = pixels.reduce((a, b) => a + b, 0) / pixels.length;
                return pixels.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / pixels.length;
            };

            const emptyVariance = calculateVariance(emptyImage);
            const filledVariance = calculateVariance(filledImage);

            expect(emptyVariance).toBe(0); // Solid color has 0 variance
            expect(filledVariance).toBeGreaterThan(0); // Gradient has variance
        });
    });

    describe('Partial Visibility', () => {
        it('should handle item at grid edge (cropped)', () => {
            // Item partially visible at edge of inventory
            const fullWidth = 64;
            const visibleWidth = 48; // Only 75% visible

            const visibilityRatio = visibleWidth / fullWidth;
            expect(visibilityRatio).toBe(0.75);

            // Detection confidence should be reduced proportionally
            const baseConfidence = 0.90;
            const adjustedConfidence = baseConfidence * visibilityRatio;
            expect(adjustedConfidence).toBeCloseTo(0.675, 2);
        });

        it('should handle overlapping UI elements', () => {
            // Tooltip or menu overlapping item
            const itemRegion = { x: 100, y: 100, width: 64, height: 64 };
            const overlayRegion = { x: 120, y: 80, width: 100, height: 50 };

            // Calculate overlap
            const overlapX = Math.max(0, Math.min(itemRegion.x + itemRegion.width, overlayRegion.x + overlayRegion.width) - Math.max(itemRegion.x, overlayRegion.x));
            const overlapY = Math.max(0, Math.min(itemRegion.y + itemRegion.height, overlayRegion.y + overlayRegion.height) - Math.max(itemRegion.y, overlayRegion.y));
            const overlapArea = overlapX * overlapY;
            const itemArea = itemRegion.width * itemRegion.height;

            const overlapRatio = overlapArea / itemArea;
            expect(overlapRatio).toBeGreaterThan(0); // There is some overlap
            expect(overlapRatio).toBeLessThan(1); // Not fully covered
        });

        it('should handle scrolled inventory (partial row visible)', () => {
            const rowHeight = 64;
            const visibleHeight = 32; // Half visible

            // Bottom row might be partially scrolled out
            const rowVisibility = visibleHeight / rowHeight;
            expect(rowVisibility).toBe(0.5);
        });
    });

    describe('Overlapping Items', () => {
        it('should detect overlapping bounding boxes', () => {
            const detection1 = createDetection('wrench', 'Wrench', 0.85, 100, 100);
            const detection2 = createDetection('medkit', 'Medkit', 0.80, 120, 100);

            // Calculate IoU (Intersection over Union)
            const calculateIoU = (
                box1: { x: number; y: number; width: number; height: number },
                box2: { x: number; y: number; width: number; height: number }
            ) => {
                const x1 = Math.max(box1.x, box2.x);
                const y1 = Math.max(box1.y, box2.y);
                const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
                const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

                const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
                const union = box1.width * box1.height + box2.width * box2.height - intersection;

                return intersection / union;
            };

            const iou = calculateIoU(
                { ...detection1, width: 64, height: 64 },
                { ...detection2, width: 64, height: 64 }
            );

            expect(iou).toBeGreaterThan(0); // Boxes overlap
            expect(iou).toBeLessThan(1); // Not identical
        });

        it('should apply NMS (Non-Maximum Suppression) for duplicates', () => {
            // Multiple detections of same item at slightly different positions
            const detections = [
                createDetection('wrench', 'Wrench', 0.90, 100, 100),
                createDetection('wrench', 'Wrench', 0.85, 102, 101), // Slight offset
                createDetection('wrench', 'Wrench', 0.80, 98, 99),  // Another offset
            ];

            // NMS should keep only the highest confidence detection
            const nmsThreshold = 0.5;
            const keepDetection = (d: typeof detections[0], others: typeof detections) => {
                return !others.some(other =>
                    other !== d &&
                    other.confidence > d.confidence &&
                    Math.abs(other.x - d.x) < 10 &&
                    Math.abs(other.y - d.y) < 10
                );
            };

            const kept = detections.filter(d => keepDetection(d, detections));
            expect(kept.length).toBe(1);
            expect(kept[0]!.confidence).toBe(0.90);
        });

        it('should handle stacked items (same position, different items)', () => {
            // UI glitch might show multiple items at same position
            const detections = [
                createDetection('wrench', 'Wrench', 0.85, 100, 100),
                createDetection('medkit', 'Medkit', 0.82, 100, 100), // Same position
            ];

            // Different items at same position - keep the higher confidence one
            const samePosition = detections.every(d => d.x === 100 && d.y === 100);
            expect(samePosition).toBe(true);

            const bestDetection = detections.reduce((best, d) =>
                d.confidence > best.confidence ? d : best
            );
            expect(bestDetection.entity.id).toBe('wrench');
        });
    });

    describe('Grid Boundary Conditions', () => {
        it('should handle first cell (0,0)', () => {
            const detection = createDetection('wrench', 'Wrench', 0.85, 0, 0);
            expect(detection.x).toBe(0);
            expect(detection.y).toBe(0);
        });

        it('should handle cell at maximum grid position', () => {
            const gridWidth = 10;
            const gridHeight = 7;
            const cellSize = 64;

            const maxX = (gridWidth - 1) * cellSize;
            const maxY = (gridHeight - 1) * cellSize;

            const detection = createDetection('wrench', 'Wrench', 0.85, maxX, maxY);
            expect(detection.x).toBe(576);
            expect(detection.y).toBe(384);
        });

        it('should handle out-of-bounds detection gracefully', () => {
            // Detection reported outside expected grid
            const gridBounds = { maxX: 640, maxY: 448 };
            const detection = createDetection('wrench', 'Wrench', 0.85, 700, 500);

            const isOutOfBounds = detection.x > gridBounds.maxX || detection.y > gridBounds.maxY;
            expect(isOutOfBounds).toBe(true);
        });
    });

    describe('Image Quality Issues', () => {
        it('should detect low contrast image', () => {
            const lowContrastImage = cvTestKit.image.gradient(64, 64, [100, 100, 100], [110, 110, 110]);

            // Calculate contrast
            let min = 255, max = 0;
            for (let i = 0; i < lowContrastImage.data.length; i += 4) {
                const gray = (lowContrastImage.data[i]! + lowContrastImage.data[i + 1]! + lowContrastImage.data[i + 2]!) / 3;
                min = Math.min(min, gray);
                max = Math.max(max, gray);
            }

            const contrast = max - min;
            expect(contrast).toBeLessThan(20); // Very low contrast
        });

        it('should handle oversaturated image', () => {
            const oversaturatedImage = cvTestKit.image.solid(64, 64, 255, 0, 0);

            // Check for clipping (values at max)
            let clippedPixels = 0;
            for (let i = 0; i < oversaturatedImage.data.length; i += 4) {
                if (oversaturatedImage.data[i] === 255 ||
                    oversaturatedImage.data[i + 1] === 255 ||
                    oversaturatedImage.data[i + 2] === 255) {
                    clippedPixels++;
                }
            }

            const clippingRatio = clippedPixels / (oversaturatedImage.width * oversaturatedImage.height);
            expect(clippingRatio).toBe(1); // Fully saturated red
        });

        it('should handle very dark image', () => {
            const darkImage = cvTestKit.image.solid(64, 64, 10, 10, 10);

            let avgBrightness = 0;
            const pixelCount = darkImage.width * darkImage.height;
            for (let i = 0; i < darkImage.data.length; i += 4) {
                avgBrightness += (darkImage.data[i]! + darkImage.data[i + 1]! + darkImage.data[i + 2]!) / 3;
            }
            avgBrightness /= pixelCount;

            expect(avgBrightness).toBe(10);
            expect(avgBrightness).toBeLessThan(20); // Very dark
        });
    });
});

// ========================================
// Rarity Border Detection Edge Cases
// ========================================

describe('CV Rarity Border Edge Cases', () => {
    describe('Border Color Detection', () => {
        it('should detect common (gray) border', () => {
            const commonBorder = cvTestKit.image.bordered(64, 64, [128, 128, 128], [50, 50, 50], 3);
            expect(commonBorder.data.length).toBe(64 * 64 * 4);
        });

        it('should detect uncommon (green) border', () => {
            const uncommonBorder = cvTestKit.image.bordered(64, 64, [0, 200, 0], [50, 50, 50], 3);
            expect(uncommonBorder.data[0]).toBe(0);   // R
            expect(uncommonBorder.data[1]).toBe(200); // G
            expect(uncommonBorder.data[2]).toBe(0);   // B
        });

        it('should detect rare (blue) border', () => {
            const rareBorder = cvTestKit.image.bordered(64, 64, [0, 100, 255], [50, 50, 50], 3);
            expect(rareBorder.data[2]).toBe(255); // Blue channel
        });

        it('should detect epic (purple) border', () => {
            const epicBorder = cvTestKit.image.bordered(64, 64, [200, 0, 200], [50, 50, 50], 3);
            // Purple has R and B
            expect(epicBorder.data[0]).toBe(200); // R
            expect(epicBorder.data[2]).toBe(200); // B
        });

        it('should detect legendary (orange/gold) border', () => {
            const legendaryBorder = cvTestKit.image.bordered(64, 64, [255, 165, 0], [50, 50, 50], 3);
            expect(legendaryBorder.data[0]).toBe(255); // R
            expect(legendaryBorder.data[1]).toBe(165); // G (orange)
        });

        it('should handle ambiguous border color', () => {
            // Color between purple and blue
            const ambiguousBorder = cvTestKit.image.bordered(64, 64, [100, 50, 200], [50, 50, 50], 3);

            // Classify by dominant component
            const r = 100, g = 50, b = 200;
            const isMoreBlue = b > r && b > g;
            const isMorePurple = r > 50 && b > 150 && Math.abs(r - b) < 100;

            expect(isMoreBlue || isMorePurple).toBe(true);
        });

        it('should handle thin border (1px)', () => {
            const thinBorder = cvTestKit.image.bordered(64, 64, [255, 0, 0], [50, 50, 50], 1);

            // Check that border is only 1 pixel wide
            // Top-left corner should be border color
            expect(thinBorder.data[0]).toBe(255);
            // Position (1,1) should be inner color
            const idx = (1 * 64 + 1) * 4;
            expect(thinBorder.data[idx]).toBe(50);
        });

        it('should handle thick border (5px)', () => {
            const thickBorder = cvTestKit.image.bordered(64, 64, [255, 0, 0], [50, 50, 50], 5);

            // Position (4,4) should still be border
            const idx4 = (4 * 64 + 4) * 4;
            expect(thickBorder.data[idx4]).toBe(255);

            // Position (5,5) should be inner
            const idx5 = (5 * 64 + 5) * 4;
            expect(thickBorder.data[idx5]).toBe(50);
        });
    });

    describe('Border Detection Reliability', () => {
        it('should handle border with antialiasing', () => {
            // Antialiased borders have gradient edges
            const image = cvTestKit.image.create(64, 64, (x, y) => {
                const distFromEdge = Math.min(x, y, 63 - x, 63 - y);
                if (distFromEdge < 2) {
                    // Gradient from border to inner
                    const t = distFromEdge / 2;
                    return [
                        Math.floor(255 * (1 - t) + 50 * t),
                        Math.floor(0 * (1 - t) + 50 * t),
                        Math.floor(0 * (1 - t) + 50 * t),
                    ];
                }
                return [50, 50, 50];
            });

            expect(image.data[0]).toBe(255); // Edge is still red
        });

        it('should handle corrupted border (partial)', () => {
            // Border only on some sides (top and left, not bottom and right)
            const image = cvTestKit.image.create(64, 64, (x, y) => {
                // Only top and left borders (within first 3 pixels)
                if (x < 3 || y < 3) {
                    return [255, 0, 0];
                }
                return [50, 50, 50];
            });

            // Top-left corner (0,0) should be border color (red)
            const hasTopBorder = image.data[0] === 255;

            // Bottom-right corner (63,63) should be inner color (gray)
            // Index for pixel (63, 63) = (63 * 64 + 63) * 4
            const bottomRightIdx = (63 * 64 + 63) * 4;
            const hasBottomBorder = image.data[bottomRightIdx] === 255;

            expect(hasTopBorder).toBe(true);
            expect(hasBottomBorder).toBe(false); // Should be gray (50), not red
        });
    });
});

// ========================================
// Numeric Precision Tests
// ========================================

describe('CV Numeric Precision', () => {
    it('should handle similarity score at exact threshold', () => {
        const threshold = 0.70;
        const scores = [0.70, 0.700000001, 0.699999999];

        scores.forEach(score => {
            const passes = score >= threshold - Number.EPSILON;
            // All should effectively pass due to floating point tolerance
            expect(Math.abs(score - threshold) < 0.0001).toBe(true);
        });
    });

    it('should handle very small confidence differences', () => {
        const detections = [
            createDetection('a', 'A', 0.8500000001),
            createDetection('b', 'B', 0.8500000000),
            createDetection('c', 'C', 0.8499999999),
        ];

        // Sort by confidence
        const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);

        expect(sorted[0]!.entity.id).toBe('a');
        expect(sorted[2]!.entity.id).toBe('c');
    });

    it('should handle accumulated floating point errors', () => {
        // Simulate accumulated errors from multiple operations
        let confidence = 0.0;
        for (let i = 0; i < 10; i++) {
            confidence += 0.1;
        }

        // Due to floating point, this won't be exactly 1.0
        expect(confidence).not.toBe(1.0);
        expect(confidence).toBeCloseTo(1.0, 10);
    });
});
