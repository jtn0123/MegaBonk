/**
 * Unit tests for OCR module
 * Tests text extraction, fuzzy matching, and item detection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    initOCR,
    detectItemsFromText,
    detectTomesFromText,
    detectCharactersFromText,
    detectWeaponsFromText,
} from '../../src/modules/ocr';
import type { AllGameData } from '../../src/types';

// Mock game data
const mockGameData: AllGameData = {
    items: {
        version: '1.0',
        last_updated: '2024-01-01',
        items: [
            {
                id: 'first_aid_kit',
                name: 'First Aid Kit',
                description: 'Heals you',
                rarity: 'common',
                tier: 'B',
                tags: ['health'],
                mechanics: { base: { health_regen: 5 } },
            },
            {
                id: 'wrench',
                name: 'Wrench',
                description: 'Increases damage',
                rarity: 'uncommon',
                tier: 'A',
                tags: ['damage'],
                mechanics: { base: { damage: 10 } },
            },
            {
                id: 'battery',
                name: 'Battery',
                description: 'More energy',
                rarity: 'rare',
                tier: 'S',
                tags: ['energy'],
                mechanics: { base: { energy: 15 } },
            },
            {
                id: 'gym_sauce',
                name: 'Gym Sauce',
                description: 'Increases strength',
                rarity: 'epic',
                tier: 'SS',
                tags: ['strength'],
                mechanics: { base: { strength: 20 } },
            },
        ],
    },
    tomes: {
        version: '1.0',
        last_updated: '2024-01-01',
        tomes: [
            {
                id: 'damage_tome',
                name: 'Damage Tome',
                description: 'Increases damage',
                priority_rank: 1,
                mechanics: { damage_multiplier: 1.5 },
            },
            {
                id: 'crit_tome',
                name: 'Crit Tome',
                description: 'Increases crit chance',
                priority_rank: 2,
                mechanics: { crit_chance: 0.2 },
            },
        ],
    },
    characters: {
        version: '1.0',
        last_updated: '2024-01-01',
        characters: [
            {
                id: 'clank',
                name: 'CL4NK',
                description: 'Robot character',
                starting_stats: { health: 100, damage: 10 },
                passive_abilities: ['shield'],
            },
            {
                id: 'dash',
                name: 'D4SH',
                description: 'Speed character',
                starting_stats: { health: 80, damage: 15 },
                passive_abilities: ['speed'],
            },
        ],
    },
    weapons: {
        version: '1.0',
        last_updated: '2024-01-01',
        weapons: [
            {
                id: 'hammer',
                name: 'Hammer',
                description: 'Heavy weapon',
                base_damage: 50,
                attack_speed: 1.0,
                upgrade_path: [],
            },
            {
                id: 'sword',
                name: 'Sword',
                description: 'Balanced weapon',
                base_damage: 30,
                attack_speed: 1.5,
                upgrade_path: [],
            },
        ],
    },
    stats: {
        version: '1.0',
        last_updated: '2024-01-01',
    },
};

describe('OCR Module - Initialization', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    it('should initialize with game data', () => {
        expect(() => initOCR(mockGameData)).not.toThrow();
    });

    it('should handle empty game data', () => {
        expect(() => initOCR({})).not.toThrow();
    });

    it('should handle partial game data', () => {
        const partialData = { items: mockGameData.items };
        expect(() => initOCR(partialData)).not.toThrow();
    });
});

describe('OCR Module - Item Detection', () => {
    beforeEach(() => {
        initOCR(mockGameData);
    });

    it('should detect exact item name match', () => {
        const text = 'First Aid Kit';
        const results = detectItemsFromText(text);

        expect(results).toHaveLength(1);
        expect(results[0].entity.name).toBe('First Aid Kit');
        expect(results[0].confidence).toBeGreaterThan(0.9);
    });

    it('should detect item with typo using fuzzy matching', () => {
        const text = 'First Aid Kt'; // Missing 'i'
        const results = detectItemsFromText(text);

        expect(results.length).toBeGreaterThanOrEqual(1);
        expect(results[0].entity.name).toBe('First Aid Kit');
        expect(results[0].confidence).toBeGreaterThan(0.5);
    });

    it('should detect multiple items from multiline text', () => {
        const text = `
            First Aid Kit
            Wrench
            Battery
        `;
        const results = detectItemsFromText(text);

        expect(results.length).toBeGreaterThanOrEqual(3);
        const itemNames = results.map(r => r.entity.name);
        expect(itemNames).toContain('First Aid Kit');
        expect(itemNames).toContain('Wrench');
        expect(itemNames).toContain('Battery');
    });

    it('should handle case-insensitive matching', () => {
        const text = 'FIRST AID KIT';
        const results = detectItemsFromText(text);

        expect(results).toHaveLength(1);
        expect(results[0].entity.name).toBe('First Aid Kit');
    });

    it('should ignore very short text (noise)', () => {
        const text = 'ab';
        const results = detectItemsFromText(text);

        expect(results).toHaveLength(0);
    });

    it('should handle text with no matches', () => {
        const text = 'This is some random text with no item names';
        const results = detectItemsFromText(text);

        expect(results).toHaveLength(0);
    });

    it('should detect items from noisy OCR output', () => {
        const text = 'F1rst A1d K1t'; // Numbers instead of letters
        const results = detectItemsFromText(text);

        expect(results.length).toBeGreaterThanOrEqual(1);
        expect(results[0].entity.name).toBe('First Aid Kit');
    });

    it('should handle items with special characters', () => {
        const text = 'Gym Sauce!'; // Exclamation mark
        const results = detectItemsFromText(text);

        expect(results.length).toBeGreaterThanOrEqual(1);
        expect(results[0].entity.name).toBe('Gym Sauce');
    });
});

describe('OCR Module - Tome Detection', () => {
    beforeEach(() => {
        initOCR(mockGameData);
    });

    it('should detect exact tome name', () => {
        const text = 'Damage Tome';
        const results = detectTomesFromText(text);

        expect(results).toHaveLength(1);
        expect(results[0].entity.name).toBe('Damage Tome');
    });

    it('should detect multiple tomes', () => {
        const text = 'Damage Tome\nCrit Tome';
        const results = detectTomesFromText(text);

        expect(results.length).toBe(2);
    });
});

describe('OCR Module - Character Detection', () => {
    beforeEach(() => {
        initOCR(mockGameData);
    });

    it('should detect character with exact name', () => {
        const text = 'CL4NK';
        const results = detectCharactersFromText(text);

        expect(results).toHaveLength(1);
        expect(results[0].entity.name).toBe('CL4NK');
    });

    it('should detect character with fuzzy match', () => {
        const text = 'CLANK'; // Without numbers
        const results = detectCharactersFromText(text);

        expect(results.length).toBeGreaterThanOrEqual(1);
        expect(results[0].entity.name).toBe('CL4NK');
    });

    it('should detect D4SH character', () => {
        const text = 'D4SH';
        const results = detectCharactersFromText(text);

        expect(results).toHaveLength(1);
        expect(results[0].entity.name).toBe('D4SH');
    });
});

describe('OCR Module - Weapon Detection', () => {
    beforeEach(() => {
        initOCR(mockGameData);
    });

    it('should detect weapon by name', () => {
        const text = 'Hammer';
        const results = detectWeaponsFromText(text);

        expect(results).toHaveLength(1);
        expect(results[0].entity.name).toBe('Hammer');
    });

    it('should detect weapon with level text', () => {
        // Weapon name on its own line, level on next line (realistic OCR)
        const text = 'Hammer\nLVL 14';
        const results = detectWeaponsFromText(text);

        expect(results.length).toBeGreaterThanOrEqual(1);
        expect(results[0].entity.name).toBe('Hammer');
    });
});

describe('OCR Module - Confidence Scoring', () => {
    beforeEach(() => {
        initOCR(mockGameData);
    });

    it('should have high confidence for exact match', () => {
        const text = 'Battery';
        const results = detectItemsFromText(text);

        expect(results[0].confidence).toBeGreaterThan(0.9);
    });

    it('should have lower confidence for fuzzy match', () => {
        const text = 'Battry'; // Missing 'e'
        const results = detectItemsFromText(text);

        expect(results[0].confidence).toBeLessThan(0.9);
        expect(results[0].confidence).toBeGreaterThan(0.5);
    });

    it('should reject matches below confidence threshold', () => {
        const text = 'Completely wrong text';
        const results = detectItemsFromText(text);

        expect(results).toHaveLength(0);
    });
});

describe('OCR Module - Edge Cases', () => {
    beforeEach(() => {
        initOCR(mockGameData);
    });

    it('should handle empty string', () => {
        const results = detectItemsFromText('');
        expect(results).toHaveLength(0);
    });

    it('should handle very long text', () => {
        // Realistic OCR output has newlines between items
        const longText = 'Battery\n'.repeat(100);
        const results = detectItemsFromText(longText);

        expect(results.length).toBeGreaterThan(0);
        expect(results[0].entity.name).toBe('Battery');
    });

    it('should handle text with numbers and symbols', () => {
        // OCR output with item on separate line
        const text = '123\nWrench x5\n$$$';
        const results = detectItemsFromText(text);

        expect(results.length).toBeGreaterThanOrEqual(1);
        expect(results[0].entity.name).toBe('Wrench');
    });

    it('should handle multiline with extra whitespace', () => {
        const text = `

            First Aid Kit


            Battery

        `;
        const results = detectItemsFromText(text);

        expect(results.length).toBeGreaterThanOrEqual(2);
    });
});

describe('OCR Module - Performance', () => {
    beforeEach(() => {
        initOCR(mockGameData);
    });

    it('should process text quickly (< 100ms for small text)', () => {
        const text = 'First Aid Kit\nWrench\nBattery';
        const start = performance.now();
        detectItemsFromText(text);
        const end = performance.now();

        expect(end - start).toBeLessThan(100);
    });

    it('should handle large text efficiently (< 500ms)', () => {
        const largeText = Array(100)
            .fill('First Aid Kit\nWrench\nBattery\n')
            .join('');
        const start = performance.now();
        detectItemsFromText(largeText);
        const end = performance.now();

        expect(end - start).toBeLessThan(500);
    });
});

describe('OCR Module - Integration with All Entity Types', () => {
    beforeEach(() => {
        initOCR(mockGameData);
    });

    it('should detect mixed entities from text', () => {
        // Realistic OCR output with entities on separate lines
        const text = `
            CL4NK
            Hammer
            First Aid Kit
            Battery
            Damage Tome
        `;

        const items = detectItemsFromText(text);
        const tomes = detectTomesFromText(text);
        const characters = detectCharactersFromText(text);
        const weapons = detectWeaponsFromText(text);

        expect(items.length).toBeGreaterThanOrEqual(2);
        expect(tomes.length).toBeGreaterThanOrEqual(1);
        expect(characters.length).toBeGreaterThanOrEqual(1);
        expect(weapons.length).toBeGreaterThanOrEqual(1);
    });
});
