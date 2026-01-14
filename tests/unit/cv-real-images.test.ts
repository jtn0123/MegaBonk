/**
 * Real Image Tests for Computer Vision Module
 * Tests CV detection with actual screenshot images
 *
 * Note: Full template matching requires browser environment.
 * These tests validate grid detection, resolution handling, and image loading.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { detectGridPositions } from '../../src/modules/computer-vision';
import { detectResolution, detectUILayout } from '../../src/modules/test-utils';

// Test image paths
const TEST_IMAGES_DIR = path.join(__dirname, '../../test-images/gameplay/pc-1080p');
const GROUND_TRUTH_PATH = path.join(__dirname, '../../test-images/gameplay/ground-truth.json');

// Check if canvas is available (for Node.js)
let canvasAvailable = false;
let loadImage: any;
let createCanvas: any;

try {
    // Use require for better compatibility in test environment
    const canvas = require('canvas');
    loadImage = canvas.loadImage;
    createCanvas = canvas.createCanvas;
    canvasAvailable = true;
    console.log('Canvas module loaded successfully');
} catch (e) {
    console.log('Canvas module not available - some tests will be skipped');
    console.log('Error:', (e as Error).message);
}

describe('CV Real Image Detection', () => {
    describe('Grid Detection', () => {
        it('should detect grid positions for 1080p', () => {
            const grid = detectGridPositions(1920, 1080);

            expect(grid.length).toBeGreaterThan(0);
            expect(grid.length).toBeLessThanOrEqual(30);

            // Grid should be at bottom of screen (>90%)
            grid.forEach(cell => {
                expect(cell.y).toBeGreaterThan(1080 * 0.9);
                expect(cell.y).toBeLessThan(1080);
            });

            // Cell sizes should be reasonable
            expect(grid[0].width).toBeGreaterThanOrEqual(40);
            expect(grid[0].width).toBeLessThanOrEqual(60);
        });

        it('should detect grid positions for 720p', () => {
            const grid = detectGridPositions(1280, 720);

            expect(grid.length).toBeGreaterThan(0);
            grid.forEach(cell => {
                expect(cell.y).toBeGreaterThan(720 * 0.9);
            });
        });

        it('should detect grid positions for 800p (Steam Deck-like)', () => {
            const grid = detectGridPositions(1280, 800);

            expect(grid.length).toBeGreaterThan(0);
            grid.forEach(cell => {
                expect(cell.y).toBeGreaterThan(800 * 0.9);
            });
        });

        it('should detect grid positions for 4K', () => {
            const grid = detectGridPositions(3840, 2160);

            expect(grid.length).toBeGreaterThan(0);
            grid.forEach(cell => {
                expect(cell.y).toBeGreaterThan(2160 * 0.9);
            });

            // 4K should have larger cells
            expect(grid[0].width).toBeGreaterThanOrEqual(60);
        });
    });

    describe('Resolution Detection', () => {
        it('should correctly identify common resolutions', () => {
            expect(detectResolution(1920, 1080).category).toBe('1080p');
            expect(detectResolution(1280, 720).category).toBe('720p');
            expect(detectResolution(2560, 1440).category).toBe('1440p');
            expect(detectResolution(3840, 2160).category).toBe('4K');
            expect(detectResolution(1280, 800).category).toBe('steam_deck');
        });

        it('should handle non-standard resolutions', () => {
            const result = detectResolution(1456, 816);
            expect(result.category).toBeDefined();
            expect(result.width).toBe(1456);
            expect(result.height).toBe(816);
        });
    });

    describe('UI Layout Detection', () => {
        it('should detect PC layout for 16:9 aspect ratio', () => {
            expect(detectUILayout(1920, 1080)).toBe('pc');
            expect(detectUILayout(1280, 720)).toBe('pc');
            expect(detectUILayout(2560, 1440)).toBe('pc');
        });

        it('should detect Steam Deck layout for 16:10 aspect ratio', () => {
            expect(detectUILayout(1280, 800)).toBe('steam_deck');
        });
    });

    describe('Test Image Availability', () => {
        it('should have test images directory', () => {
            const exists = fs.existsSync(TEST_IMAGES_DIR);
            expect(exists).toBe(true);
        });

        it('should have test images in the directory', () => {
            if (!fs.existsSync(TEST_IMAGES_DIR)) return;

            const files = fs.readdirSync(TEST_IMAGES_DIR);
            const imageFiles = files.filter(f => f.endsWith('.jpg') || f.endsWith('.png'));

            expect(imageFiles.length).toBeGreaterThan(0);
            console.log(`Found ${imageFiles.length} test images:`, imageFiles);
        });

        it('should have ground truth file', () => {
            const exists = fs.existsSync(GROUND_TRUTH_PATH);
            expect(exists).toBe(true);
        });

        it('should have valid ground truth JSON', () => {
            if (!fs.existsSync(GROUND_TRUTH_PATH)) return;

            const content = fs.readFileSync(GROUND_TRUTH_PATH, 'utf-8');
            expect(() => JSON.parse(content)).not.toThrow();
        });
    });

    describe('Real Image Loading (requires canvas)', () => {
        it.skipIf(!canvasAvailable)('should load test image with canvas', async () => {
            const imagePath = path.join(TEST_IMAGES_DIR, 'level_33_english_forest_early.jpg');

            if (!fs.existsSync(imagePath)) {
                console.log('Skipping: Test image not found');
                return;
            }

            const image = await loadImage(imagePath);

            expect(image.width).toBeGreaterThan(0);
            expect(image.height).toBeGreaterThan(0);
            console.log(`Loaded image: ${image.width}x${image.height}`);
        });

        it.skipIf(!canvasAvailable)('should convert image to canvas data URL', async () => {
            const imagePath = path.join(TEST_IMAGES_DIR, 'level_33_english_forest_early.jpg');

            if (!fs.existsSync(imagePath)) {
                console.log('Skipping: Test image not found');
                return;
            }

            const image = await loadImage(imagePath);
            const canvas = createCanvas(image.width, image.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);

            const dataUrl = canvas.toDataURL('image/png');

            expect(dataUrl).toContain('data:image/png;base64,');
            expect(dataUrl.length).toBeGreaterThan(1000);
            console.log(`Data URL length: ${dataUrl.length} characters`);
        });

        it.skipIf(!canvasAvailable)('should extract image dimensions from all test images', async () => {
            if (!fs.existsSync(TEST_IMAGES_DIR)) return;

            const files = fs.readdirSync(TEST_IMAGES_DIR);
            const imageFiles = files.filter(f => f.endsWith('.jpg') || f.endsWith('.png'));

            for (const file of imageFiles) {
                const imagePath = path.join(TEST_IMAGES_DIR, file);
                const image = await loadImage(imagePath);

                console.log(`${file}: ${image.width}x${image.height}`);
                expect(image.width).toBeGreaterThan(0);
                expect(image.height).toBeGreaterThan(0);
            }
        });
    });

    describe('Grid Positions for Test Images (requires canvas)', () => {
        it.skipIf(!canvasAvailable)('should calculate grid for actual screenshot dimensions', async () => {
            const imagePath = path.join(TEST_IMAGES_DIR, 'level_33_english_forest_early.jpg');

            if (!fs.existsSync(imagePath)) {
                console.log('Skipping: Test image not found');
                return;
            }

            const image = await loadImage(imagePath);
            const grid = detectGridPositions(image.width, image.height);

            console.log(`Image: ${image.width}x${image.height}`);
            console.log(`Grid cells: ${grid.length}`);
            console.log(`First cell: x=${grid[0].x}, y=${grid[0].y}, size=${grid[0].width}x${grid[0].height}`);

            expect(grid.length).toBeGreaterThan(0);

            // Grid should be at bottom of actual image
            grid.forEach(cell => {
                expect(cell.y).toBeGreaterThan(image.height * 0.85);
            });
        });
    });
});
