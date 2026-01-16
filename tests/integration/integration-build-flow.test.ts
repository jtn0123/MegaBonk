/**
 * Integration Tests - Build Flow
 * Testing how multiple modules work together in build creation and recommendation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { recommendBestChoice, type BuildState, type ChoiceOption } from '../../src/modules/recommendation';
import { calculateAccuracyMetrics, calculateF1Score } from '../../src/modules/test-utils';
import { aggregateDuplicates, combineDetections, type CVDetectionResult } from '../../src/modules/computer-vision';
import type { Item, Weapon, Tome, Character } from '../../src/types';

describe('Integration - Build Recommendation Flow', () => {
    const createCharacter = (name: string, synergies: string[]): Character => ({
        id: `char_${name.toLowerCase()}`,
        name,
        tier: 'S',
        rarity: 'rare',
        passive: `${name} passive`,
        synergies_items: synergies,
        synergies_weapons: [],
    });

    const createWeapon = (name: string): Weapon => ({
        id: `weapon_${name.toLowerCase()}`,
        name,
        tier: 'A',
        rarity: 'uncommon',
        weapon_type: 'melee',
        damage_type: 'physical',
        base_damage: 50,
    });

    const createItem = (name: string, tier: 'SS' | 'S' | 'A' | 'B' | 'C', archetype: string): Item => ({
        id: `item_${name.toLowerCase().replace(/\s+/g, '_')}`,
        name,
        tier,
        rarity: 'common',
        effects: [archetype],
        base_effect: `${archetype} boost`,
    });

    it('should recommend synergistic items for damage build', () => {
        const character = createCharacter('Berserker', ['Damage Sword', 'Power Gauntlet']);
        const weapon = createWeapon('Battle Axe');

        const build: BuildState = {
            character,
            weapon,
            items: [
                createItem('Damage Ring', 'A', 'damage'),
                createItem('Power Amulet', 'B', 'damage'),
            ],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            { type: 'item', entity: createItem('Damage Sword', 'SS', 'damage') },
            { type: 'item', entity: createItem('HP Shield', 'SS', 'hp') },
            { type: 'item', entity: createItem('Speed Boots', 'A', 'speed') },
        ];

        const recommendations = recommendBestChoice(build, choices);

        // Damage Sword should be top due to synergy + SS tier + archetype match
        expect(recommendations[0].choice.entity.name).toBe('Damage Sword');
        expect(recommendations[0].synergies.length).toBeGreaterThan(0);
    });

    it('should recommend balanced items for mixed build', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            items: [
                createItem('Damage Item', 'A', 'damage'),
                createItem('HP Item', 'A', 'hp'),
                createItem('Crit Item', 'A', 'crit'),
            ],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            { type: 'item', entity: createItem('More Damage', 'A', 'damage') },
            { type: 'item', entity: createItem('More HP', 'A', 'hp') },
            { type: 'item', entity: createItem('More Crit', 'A', 'crit') },
        ];

        const recommendations = recommendBestChoice(build, choices);

        // All should have similar scores for mixed build
        expect(recommendations).toHaveLength(3);
        const scoreRange = recommendations[0].score - recommendations[2].score;
        expect(scoreRange).toBeLessThan(30); // Within 30 points
    });

    it('should prioritize SS-tier in early game', () => {
        const build: BuildState = {
            character: null,
            weapon: null,
            items: [createItem('Starter', 'C', 'damage')],
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            { type: 'item', entity: createItem('SS Legendary', 'SS', 'speed') },
            { type: 'item', entity: createItem('A Good Item', 'A', 'damage') },
        ];

        const recommendations = recommendBestChoice(build, choices);

        // SS should be top with early game bonus
        expect(recommendations[0].choice.entity.tier).toBe('SS');
        expect(recommendations[0].reasoning.some(r => r.includes('Early game'))).toBe(true);
    });

    it('should handle full build recommendation flow', () => {
        const character = createCharacter('Tank', ['Shield', 'Armor']);
        const weapon = createWeapon('Sword and Board');

        // Start with empty build
        let currentBuild: BuildState = {
            character,
            weapon,
            items: [],
            tomes: [],
        };

        const availableItems = [
            createItem('Shield', 'SS', 'hp'),
            createItem('Armor', 'S', 'hp'),
            createItem('Damage Sword', 'S', 'damage'),
            createItem('Speed Boots', 'A', 'speed'),
        ];

        // Simulate picking 3 items
        for (let i = 0; i < 3; i++) {
            const choices: ChoiceOption[] = availableItems.map(item => ({
                type: 'item' as const,
                entity: item,
            }));

            const recommendations = recommendBestChoice(currentBuild, choices);
            const picked = recommendations[0].choice.entity as Item;

            // Add to build
            currentBuild.items.push(picked);

            // Remove from available
            const pickedIndex = availableItems.findIndex(item => item.id === picked.id);
            availableItems.splice(pickedIndex, 1);
        }

        // Should have picked synergistic tank items
        expect(currentBuild.items).toHaveLength(3);
        expect(currentBuild.items.some(item => item.name === 'Shield')).toBe(true);
        expect(currentBuild.items.some(item => item.name === 'Armor')).toBe(true);
    });
});

describe('Integration - Detection and Accuracy Flow', () => {
    const createDetection = (id: string, name: string, confidence: number): CVDetectionResult => ({
        type: 'item',
        entity: { id, name, tier: 'A', rarity: 'common', effects: [] } as Item,
        confidence,
        method: 'template_match',
    });

    it('should aggregate duplicates then calculate accuracy', () => {
        // Simulate CV detecting same items multiple times
        const detections = [
            createDetection('sword', 'Sword', 0.9),
            createDetection('sword', 'Sword', 0.85),
            createDetection('shield', 'Shield', 0.8),
            createDetection('sword', 'Sword', 0.95),
        ];

        // Aggregate duplicates
        const aggregated = aggregateDuplicates(detections);

        // Should have 2 unique items
        expect(aggregated).toHaveLength(2);
        expect(aggregated.find(d => d.entity.name === 'Sword')?.count).toBe(3);
        expect(aggregated.find(d => d.entity.name === 'Shield')?.count).toBe(1);

        // Calculate accuracy against ground truth
        const groundTruth = ['Sword', 'Shield', 'Helmet'];
        const metrics = calculateAccuracyMetrics(aggregated, groundTruth);

        expect(metrics.truePositives).toBe(2); // Sword and Shield
        expect(metrics.falseNegatives).toBe(1); // Missing Helmet
        expect(metrics.precision).toBe(1.0); // No false positives
        expect(metrics.recall).toBeCloseTo(0.667, 2); // 2/3

        const f1 = calculateF1Score(metrics.precision, metrics.recall);
        expect(f1).toBeCloseTo(0.8, 1);
    });

    it('should combine OCR and CV then calculate accuracy', () => {
        const ocrResults = [
            {
                type: 'item' as const,
                entity: { id: 'sword', name: 'Sword' } as Item,
                confidence: 0.75,
                method: 'ocr' as const,
            },
            {
                type: 'item' as const,
                entity: { id: 'wrong', name: 'Wrong Item' } as Item,
                confidence: 0.6,
                method: 'ocr' as const,
            },
        ];

        const cvResults = [
            createDetection('sword', 'Sword', 0.8),
            createDetection('shield', 'Shield', 0.85),
        ];

        // Combine detections
        const combined = combineDetections(ocrResults, cvResults);

        // Sword should be boosted (found by both)
        const swordDetection = combined.find(d => d.entity.name === 'Sword');
        expect(swordDetection?.method).toBe('hybrid');
        expect(swordDetection?.confidence).toBeGreaterThan(0.8);

        // Calculate accuracy
        const groundTruth = ['Sword', 'Shield'];
        const metrics = calculateAccuracyMetrics(combined, groundTruth);

        expect(metrics.truePositives).toBe(2);
        expect(metrics.falsePositives).toBe(1); // Wrong Item
        expect(metrics.precision).toBeCloseTo(0.667, 2);
    });

    it('should handle full detection pipeline', () => {
        // 1. Initial CV detections with duplicates
        const cvDetections = [
            createDetection('item1', 'Sword', 0.9),
            createDetection('item1', 'Sword', 0.88),
            createDetection('item2', 'Shield', 0.85),
            createDetection('item3', 'Helmet', 0.75),
        ];

        // 2. OCR detections
        const ocrDetections = [
            {
                type: 'item' as const,
                entity: { id: 'item1', name: 'Sword' } as Item,
                confidence: 0.7,
                method: 'ocr' as const,
            },
            {
                type: 'item' as const,
                entity: { id: 'item4', name: 'Boots' } as Item,
                confidence: 0.65,
                method: 'ocr' as const,
            },
        ];

        // 3. Aggregate CV duplicates
        const aggregatedCV = aggregateDuplicates(cvDetections);
        expect(aggregatedCV).toHaveLength(3);

        // 4. Combine with OCR
        const combined = combineDetections(ocrDetections, aggregatedCV);

        // Sword should be hybrid with boosted confidence
        const sword = combined.find(d => d.entity.name === 'Sword');
        expect(sword?.method).toBe('hybrid');
        expect(sword?.confidence).toBeGreaterThan(0.7);

        // 5. Calculate final accuracy
        const groundTruth = ['Sword', 'Shield', 'Helmet', 'Boots'];
        const metrics = calculateAccuracyMetrics(combined, groundTruth);

        expect(metrics.truePositives).toBe(4);
        expect(metrics.falsePositives).toBe(0);
        expect(metrics.falseNegatives).toBe(0);
        expect(metrics.accuracy).toBe(1.0);
        expect(metrics.precision).toBe(1.0);
        expect(metrics.recall).toBe(1.0);
    });
});

describe('Integration - Build Recommendation with Detection Results', () => {
    const createDetection = (name: string, tier: 'SS' | 'S' | 'A' | 'B' | 'C', confidence: number): CVDetectionResult => ({
        type: 'item',
        entity: {
            id: `item_${name.toLowerCase().replace(/\s+/g, '_')}`,
            name,
            tier,
            rarity: 'common',
            effects: [],
            base_effect: 'damage',
        } as Item,
        confidence,
        method: 'template_match',
    });

    it('should convert detection results to build state and get recommendations', () => {
        // Simulated detection results from CV
        const detections = [
            createDetection('Damage Ring', 'A', 0.9),
            createDetection('Power Sword', 'S', 0.85),
            createDetection('Speed Boots', 'B', 0.8),
        ];

        // Convert to build state
        const currentBuild: BuildState = {
            character: null,
            weapon: null,
            items: detections.map(d => d.entity as Item),
            tomes: [],
        };

        // Get recommendations for next item
        const choices: ChoiceOption[] = [
            {
                type: 'item',
                entity: createDetection('Mega Damage', 'SS', 1.0).entity as Item,
            },
            {
                type: 'item',
                entity: createDetection('HP Tank', 'A', 1.0).entity as Item,
            },
        ];

        const recommendations = recommendBestChoice(currentBuild, choices);

        // Should recommend damage item for damage build
        expect(recommendations[0].choice.entity.name).toBe('Mega Damage');
    });

    it('should handle low-confidence detections in build', () => {
        const detections = [
            createDetection('Unclear Item 1', 'A', 0.45),
            createDetection('Unclear Item 2', 'B', 0.5),
            createDetection('Clear Item', 'S', 0.95),
        ];

        const currentBuild: BuildState = {
            character: null,
            weapon: null,
            items: detections.map(d => d.entity as Item),
            tomes: [],
        };

        const choices: ChoiceOption[] = [
            {
                type: 'item',
                entity: createDetection('New Item', 'SS', 1.0).entity as Item,
            },
        ];

        // Should still provide recommendations
        const recommendations = recommendBestChoice(currentBuild, choices);
        expect(recommendations).toHaveLength(1);
    });
});

describe('Integration - End-to-End Scenarios', () => {
    it('should handle complete tank build progression', () => {
        const character: Character = {
            id: 'tank_warrior',
            name: 'Tank Warrior',
            tier: 'SS',
            rarity: 'legendary',
            passive: 'Increased HP and Armor',
            synergies_items: ['Heavy Armor', 'Shield', 'HP Ring'],
            synergies_weapons: ['Tower Shield'],
        };

        const weapon: Weapon = {
            id: 'tower_shield',
            name: 'Tower Shield',
            tier: 'S',
            rarity: 'rare',
            weapon_type: 'melee',
            damage_type: 'physical',
            base_damage: 30,
        };

        let build: BuildState = {
            character,
            weapon,
            items: [],
            tomes: [],
        };

        const itemPool: Item[] = [
            {
                id: 'heavy_armor',
                name: 'Heavy Armor',
                tier: 'SS',
                rarity: 'legendary',
                effects: ['hp', 'armor'],
                base_effect: 'hp boost',
            } as Item,
            {
                id: 'shield',
                name: 'Shield',
                tier: 'S',
                rarity: 'rare',
                effects: ['hp'],
                base_effect: 'hp increase',
            } as Item,
            {
                id: 'hp_ring',
                name: 'HP Ring',
                tier: 'A',
                rarity: 'uncommon',
                effects: ['hp'],
                base_effect: 'hp',
            } as Item,
            {
                id: 'damage_sword',
                name: 'Damage Sword',
                tier: 'SS',
                rarity: 'legendary',
                effects: ['damage'],
                base_effect: 'damage',
            } as Item,
        ];

        // Pick 3 items for tank build
        for (let i = 0; i < 3; i++) {
            const choices = itemPool.map(item => ({
                type: 'item' as const,
                entity: item,
            }));

            const recommendations = recommendBestChoice(build, choices);
            const picked = recommendations[0].choice.entity as Item;

            build.items.push(picked);
            const index = itemPool.findIndex(item => item.id === picked.id);
            itemPool.splice(index, 1);
        }

        // Verify tank build has HP-focused items
        expect(build.items).toHaveLength(3);

        // Should have picked Heavy Armor (SS-tier with HP)
        expect(build.items.some(item => item.name === 'Heavy Armor')).toBe(true);

        // Should have at least 2 HP-focused items
        const hpItemCount = build.items.filter(item =>
            item.base_effect?.includes('hp') || item.effects?.includes('hp')
        ).length;
        expect(hpItemCount).toBeGreaterThanOrEqual(2);
    });

    it('should handle complete crit build progression', () => {
        const character: Character = {
            id: 'assassin',
            name: 'Assassin',
            tier: 'S',
            rarity: 'rare',
            passive: 'Critical hits deal bonus damage',
            synergies_items: ['Crit Blade', 'Crit Juice', 'Fork'],
            synergies_weapons: [],
        };

        let build: BuildState = {
            character,
            weapon: null,
            items: [],
            tomes: [],
        };

        const itemPool: Item[] = [
            {
                id: 'crit_blade',
                name: 'Crit Blade',
                tier: 'SS',
                rarity: 'legendary',
                effects: ['crit'],
                base_effect: 'crit chance',
            } as Item,
            {
                id: 'crit_juice',
                name: 'Crit Juice',
                tier: 'S',
                rarity: 'rare',
                effects: ['crit'],
                base_effect: 'critical',
            } as Item,
            {
                id: 'fork',
                name: 'Fork',
                tier: 'A',
                rarity: 'uncommon',
                effects: ['crit'],
                base_effect: 'crit',
            } as Item,
            {
                id: 'hp_item',
                name: 'HP Item',
                tier: 'SS',
                rarity: 'legendary',
                effects: ['hp'],
                base_effect: 'hp',
            } as Item,
        ];

        // Build crit-focused build
        for (let i = 0; i < 3; i++) {
            const choices = itemPool.map(item => ({
                type: 'item' as const,
                entity: item,
            }));

            const recommendations = recommendBestChoice(build, choices);
            const picked = recommendations[0].choice.entity as Item;

            build.items.push(picked);
            const index = itemPool.findIndex(item => item.id === picked.id);
            itemPool.splice(index, 1);
        }

        // Verify crit build
        expect(build.items).toHaveLength(3);

        // Should have picked Crit Blade (SS-tier with synergy)
        expect(build.items.some(item => item.name === 'Crit Blade')).toBe(true);

        // Should have at least 2 crit-focused items
        const critItemCount = build.items.filter(item =>
            item.base_effect?.includes('crit') || item.effects?.includes('crit')
        ).length;
        expect(critItemCount).toBeGreaterThanOrEqual(2);
    });
});
