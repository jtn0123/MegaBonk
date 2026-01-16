// ========================================
// Computer Vision Test Fixtures
// ========================================
// Mock data and test cases for CV module testing
// ========================================

import type { ValidationTestCase, ScreenRegions, RegionOfInterest, SlotInfo } from '../../src/types/computer-vision';

// ========================================
// ImageData Polyfill for Node.js
// ========================================

// Create ImageData class if not available (Node.js environment)
const ImageDataClass = typeof ImageData !== 'undefined'
    ? ImageData
    : class MockImageData {
        data: Uint8ClampedArray;
        width: number;
        height: number;
        colorSpace: string = 'srgb';

        constructor(data: Uint8ClampedArray | number, widthOrHeight?: number, height?: number) {
            if (data instanceof Uint8ClampedArray) {
                this.data = data;
                this.width = widthOrHeight!;
                this.height = height ?? (data.length / 4 / widthOrHeight!);
            } else {
                // data is width, widthOrHeight is height
                this.width = data;
                this.height = widthOrHeight!;
                this.data = new Uint8ClampedArray(this.width * this.height * 4);
            }
        }
    };

// ========================================
// Resolution Test Cases
// ========================================

export const RESOLUTION_TEST_CASES: Array<{
    name: string;
    width: number;
    height: number;
    expectedPreset: string;
    expectedIconSize: { min: number; max: number };
}> = [
    {
        name: '720p Standard',
        width: 1280,
        height: 720,
        expectedPreset: '720p',
        expectedIconSize: { min: 35, max: 42 },
    },
    {
        name: '1080p Full HD',
        width: 1920,
        height: 1080,
        expectedPreset: '1080p',
        expectedIconSize: { min: 42, max: 50 },
    },
    {
        name: '1440p QHD',
        width: 2560,
        height: 1440,
        expectedPreset: '1440p',
        expectedIconSize: { min: 52, max: 60 },
    },
    {
        name: '4K UHD',
        width: 3840,
        height: 2160,
        expectedPreset: '4k',
        expectedIconSize: { min: 65, max: 75 },
    },
    {
        name: 'Steam Deck',
        width: 1280,
        height: 800,
        expectedPreset: 'steam_deck',
        expectedIconSize: { min: 38, max: 45 },
    },
    {
        name: 'Ultrawide 1080p',
        width: 2560,
        height: 1080,
        expectedPreset: '1440p', // Closest by width match
        expectedIconSize: { min: 42, max: 60 },
    },
    {
        name: 'Custom resolution',
        width: 1600,
        height: 900,
        expectedPreset: '720p', // Closest by total dimension difference
        expectedIconSize: { min: 35, max: 50 },
    },
];

// ========================================
// Region Detection Test Cases
// ========================================

export const REGION_BOUNDS_TEST_CASES: Array<{
    name: string;
    width: number;
    height: number;
    expectedHotbarY: { min: number; max: number };
    expectedWeaponsX: { min: number; max: number };
    expectedWeaponsY: { min: number; max: number };
}> = [
    {
        name: '1080p hotbar position',
        width: 1920,
        height: 1080,
        expectedHotbarY: { min: 918, max: 1026 }, // 85-95% of 1080
        expectedWeaponsX: { min: 0, max: 288 }, // within 15% of width
        expectedWeaponsY: { min: 0, max: 216 }, // within 20% of height
    },
    {
        name: '720p hotbar position',
        width: 1280,
        height: 720,
        expectedHotbarY: { min: 612, max: 684 },
        expectedWeaponsX: { min: 0, max: 192 },
        expectedWeaponsY: { min: 0, max: 144 },
    },
    {
        name: '4K hotbar position',
        width: 3840,
        height: 2160,
        expectedHotbarY: { min: 1836, max: 2052 },
        expectedWeaponsX: { min: 0, max: 576 },
        expectedWeaponsY: { min: 0, max: 432 },
    },
];

// ========================================
// Slot Detection Test Cases
// ========================================

export const SLOT_VARIANCE_TEST_CASES: Array<{
    name: string;
    variance: number;
    expectedOccupied: boolean;
}> = [
    { name: 'Empty slot (low variance)', variance: 10, expectedOccupied: false },
    { name: 'Empty slot (medium-low variance)', variance: 25, expectedOccupied: false },
    { name: 'Occupied slot (high variance)', variance: 100, expectedOccupied: true },
    { name: 'Occupied slot (medium-high variance)', variance: 50, expectedOccupied: true },
    { name: 'Border case (at threshold)', variance: 30, expectedOccupied: false },
    { name: 'Just above threshold', variance: 31, expectedOccupied: true },
];

// ========================================
// Mock Screen Regions
// ========================================

export function createMockScreenRegions(width: number, height: number): ScreenRegions {
    const scale = height / 1080;

    return {
        itemsHotbar: {
            baseY: Math.round(height * 0.88),
            centerX: Math.round(width / 2),
            slotSize: Math.round(45 * scale),
            maxSlots: 12,
            detectedSlots: 0,
            margin: Math.round(50 * scale),
            spacing: Math.round(5 * scale),
        },
        weaponsRegion: {
            x: Math.round(50 * scale),
            y: Math.round(25 * scale),
            rows: 1,
            cols: 5,
            slotSize: Math.round(50 * scale),
            spacing: Math.round(5 * scale),
        },
        tomesRegion: {
            x: Math.round(50 * scale),
            y: Math.round(95 * scale),
            rows: 1,
            cols: 5,
            slotSize: Math.round(50 * scale),
            spacing: Math.round(5 * scale),
        },
        characterPortrait: {
            x: Math.round(width / 2 - 45 * scale),
            y: Math.round(25 * scale),
            width: Math.round(90 * scale),
            height: Math.round(90 * scale),
        },
        resolution: {
            width,
            height,
            scale,
            preset: '1080p',
        },
    };
}

// ========================================
// Mock Slot Data
// ========================================

export function createMockSlots(count: number, occupied: boolean[] = []): SlotInfo[] {
    return Array.from({ length: count }, (_, i) => ({
        index: i,
        x: 100 + i * 50,
        y: 900,
        width: 45,
        height: 45,
        occupied: occupied[i] ?? false,
        variance: occupied[i] ? 80 : 15,
    }));
}

// ========================================
// Mock Image Data
// ========================================

export function createMockImageData(
    width: number,
    height: number,
    fillPattern: 'uniform' | 'gradient' | 'random' | 'checkerboard' = 'uniform',
    baseColor: { r: number; g: number; b: number } = { r: 30, g: 30, b: 40 }
): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;

            switch (fillPattern) {
                case 'uniform':
                    data[idx] = baseColor.r;
                    data[idx + 1] = baseColor.g;
                    data[idx + 2] = baseColor.b;
                    break;

                case 'gradient':
                    const gradientFactor = x / width;
                    data[idx] = Math.round(baseColor.r * (1 + gradientFactor));
                    data[idx + 1] = Math.round(baseColor.g * (1 + gradientFactor));
                    data[idx + 2] = Math.round(baseColor.b * (1 + gradientFactor));
                    break;

                case 'random':
                    data[idx] = Math.floor(Math.random() * 256);
                    data[idx + 1] = Math.floor(Math.random() * 256);
                    data[idx + 2] = Math.floor(Math.random() * 256);
                    break;

                case 'checkerboard':
                    const isWhite = (Math.floor(x / 10) + Math.floor(y / 10)) % 2 === 0;
                    const val = isWhite ? 200 : 50;
                    data[idx] = val;
                    data[idx + 1] = val;
                    data[idx + 2] = val;
                    break;
            }

            data[idx + 3] = 255; // Alpha
        }
    }

    return new ImageDataClass(data, width, height);
}

/**
 * Create mock image data with a "slot" pattern at specific position
 * Simulates an occupied slot with higher variance
 */
export function createMockSlotImageData(
    width: number,
    height: number,
    slotX: number,
    slotY: number,
    slotWidth: number,
    slotHeight: number,
    occupied: boolean
): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);

    // Fill background with uniform dark color
    for (let i = 0; i < data.length; i += 4) {
        data[i] = 30;
        data[i + 1] = 30;
        data[i + 2] = 40;
        data[i + 3] = 255;
    }

    // Fill slot area
    for (let y = slotY; y < slotY + slotHeight && y < height; y++) {
        for (let x = slotX; x < slotX + slotWidth && x < width; x++) {
            const idx = (y * width + x) * 4;

            if (occupied) {
                // High variance pattern for occupied slot
                const variation = ((x + y) % 5) * 40;
                data[idx] = 100 + variation;
                data[idx + 1] = 80 + variation;
                data[idx + 2] = 60 + variation;
            } else {
                // Low variance for empty slot
                data[idx] = 35;
                data[idx + 1] = 35;
                data[idx + 2] = 45;
            }
        }
    }

    return new ImageDataClass(data, width, height);
}

// ========================================
// Validation Test Cases
// ========================================

export const VALIDATION_TEST_CASES: ValidationTestCase[] = [
    {
        name: 'Basic 1080p scan with 6 items',
        resolution: '1080p',
        width: 1920,
        height: 1080,
        expectedItems: ['Big Bonk', 'Beefy Ring', 'Ice Cube', 'Forbidden Juice', 'Clover', 'Medkit'],
        expectedWeapons: ['Hammer'],
        expectedTomes: ['HP Tome', 'Damage Tome'],
        expectedCharacter: 'Megachad',
    },
    {
        name: '720p scan with minimal items',
        resolution: '720p',
        width: 1280,
        height: 720,
        expectedItems: ['Big Bonk', 'Clover'],
        expectedWeapons: ['Sword'],
        expectedTomes: ['Speed Tome'],
        expectedCharacter: 'Ninja',
    },
    {
        name: '4K scan with full loadout',
        resolution: '4k',
        width: 3840,
        height: 2160,
        expectedItems: [
            'Big Bonk',
            'Big Bonk',
            'Beefy Ring',
            'Forbidden Juice',
            'Forbidden Juice',
            'Ice Cube',
            'Clover',
            'Medkit',
            'Golden Shield',
        ],
        expectedWeapons: ['Hammer', 'Dagger'],
        expectedTomes: ['HP Tome', 'Damage Tome', 'Speed Tome', 'Crit Tome'],
        expectedCharacter: 'Sir Chadwell',
    },
    {
        name: 'Steam Deck resolution',
        resolution: 'steam_deck',
        width: 1280,
        height: 800,
        expectedItems: ['Borgar', 'Beer', 'Campfire'],
        expectedWeapons: ['Club'],
        expectedTomes: ['HP Tome'],
        expectedCharacter: 'Ogre',
    },
    {
        name: 'Empty inventory scan',
        resolution: '1080p',
        width: 1920,
        height: 1080,
        expectedItems: [],
        expectedWeapons: [],
        expectedTomes: [],
        expectedCharacter: 'Spaceman',
    },
];

// ========================================
// Mock Detection Results
// ========================================

export function createMockDetectionResults(
    items: string[],
    weapons: string[],
    tomes: string[],
    character?: string
) {
    return {
        items: items.map((name, i) => ({
            type: 'item' as const,
            entity: { id: name.toLowerCase().replace(/\s+/g, '_'), name },
            confidence: 0.85 + Math.random() * 0.1,
            position: { x: 100 + i * 50, y: 900, width: 45, height: 45 },
            method: 'template_match' as const,
            slotIndex: i,
        })),
        weapons: weapons.map((name, i) => ({
            type: 'weapon' as const,
            entity: { id: name.toLowerCase().replace(/\s+/g, '_'), name },
            confidence: 0.80 + Math.random() * 0.15,
            position: { x: 50 + i * 55, y: 25, width: 50, height: 50 },
            method: 'template_match' as const,
            slotIndex: i,
        })),
        tomes: tomes.map((name, i) => ({
            type: 'tome' as const,
            entity: { id: name.toLowerCase().replace(/\s+/g, '_'), name },
            confidence: 0.82 + Math.random() * 0.12,
            position: { x: 50 + i * 55, y: 95, width: 50, height: 50 },
            method: 'template_match' as const,
            slotIndex: i,
        })),
        character: character
            ? {
                  type: 'character' as const,
                  entity: { id: character.toLowerCase().replace(/\s+/g, '_'), name: character },
                  confidence: 0.88,
                  position: { x: 915, y: 25, width: 90, height: 90 },
                  method: 'template_match' as const,
              }
            : undefined,
        regions: [] as RegionOfInterest[],
        timestamp: Date.now(),
        processingTime: 150 + Math.floor(Math.random() * 100),
        imageSize: { width: 1920, height: 1080 },
        confidence: 0.85,
    };
}

// ========================================
// Color Analysis Test Data
// ========================================

// Lazy-loaded to avoid ImageData issues at module load time
export function getColorTestCases() {
    return [
        {
            name: 'Red dominant',
            imageData: createMockImageData(10, 10, 'uniform', { r: 200, g: 50, b: 50 }),
            expectedDominant: { r: 200, g: 50, b: 50 },
        },
        {
            name: 'Green dominant',
            imageData: createMockImageData(10, 10, 'uniform', { r: 50, g: 200, b: 50 }),
            expectedDominant: { r: 50, g: 200, b: 50 },
        },
        {
            name: 'Blue dominant',
            imageData: createMockImageData(10, 10, 'uniform', { r: 50, g: 50, b: 200 }),
            expectedDominant: { r: 50, g: 50, b: 200 },
        },
        {
            name: 'Dark background',
            imageData: createMockImageData(10, 10, 'uniform', { r: 30, g: 30, b: 40 }),
            expectedDominant: { r: 30, g: 30, b: 40 },
        },
    ];
}

// Legacy export for backwards compatibility
export const COLOR_TEST_CASES: ReturnType<typeof getColorTestCases> = [];

// ========================================
// Bounding Box Test Cases
// ========================================

export const BOUNDING_BOX_TEST_CASES = [
    {
        name: 'Full overlap',
        boxA: { x: 0, y: 0, width: 100, height: 100 },
        boxB: { x: 0, y: 0, width: 100, height: 100 },
        expectedIoU: 1.0,
    },
    {
        name: 'No overlap',
        boxA: { x: 0, y: 0, width: 50, height: 50 },
        boxB: { x: 100, y: 100, width: 50, height: 50 },
        expectedIoU: 0,
    },
    {
        name: '50% overlap',
        boxA: { x: 0, y: 0, width: 100, height: 100 },
        boxB: { x: 50, y: 0, width: 100, height: 100 },
        expectedIoU: 0.5 / 1.5, // 5000 / 15000
    },
    {
        name: 'Partial overlap corner',
        boxA: { x: 0, y: 0, width: 100, height: 100 },
        boxB: { x: 75, y: 75, width: 100, height: 100 },
        expectedIoU: 625 / 19375, // 25*25 / (10000 + 10000 - 625)
    },
];
