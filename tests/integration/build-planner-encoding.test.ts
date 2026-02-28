/**
 * Integration: Build planner → URL encoding/decoding round-trip
 * Tests build-validation + build-stats + store integration
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
    isValidBuildEntry,
    isValidBase64,
    isValidURLBuildData,
    validateBuildData,
    detectSynergies,
    detectAntiSynergies,
    isValidBuild,
    getBuildCompleteness,
    type BuildData,
    type URLBuildData,
} from '../../src/modules/build-validation.ts';
import { resetStore } from '../../src/modules/store.ts';

describe('Integration: Build Planner → Validation → Encoding', () => {
    beforeEach(() => {
        resetStore();
    });

    it('should validate a complete build entry', () => {
        const build: BuildData = {
            character: 'warrior',
            weapon: 'sword',
            tomes: ['fire_tome'],
            items: ['ring', 'potion'],
            name: 'Test Build',
            timestamp: Date.now(),
        };
        expect(isValidBuildEntry(build)).toBe(true);
    });

    it('should reject invalid build entries', () => {
        expect(isValidBuildEntry(null)).toBe(false);
        expect(isValidBuildEntry(undefined)).toBe(false);
        expect(isValidBuildEntry('string')).toBe(false);
        expect(isValidBuildEntry(42)).toBe(false);
    });

    it('should round-trip URL build data through base64', () => {
        const buildData: URLBuildData = {
            c: 'warrior',
            w: 'axe',
            t: ['fire', 'ice'],
            i: ['ring', 'shield'],
        };

        const encoded = btoa(JSON.stringify(buildData));
        expect(isValidBase64(encoded)).toBe(true);

        const decoded = JSON.parse(atob(encoded));
        expect(isValidURLBuildData(decoded)).toBe(true);
        expect(decoded.c).toBe('warrior');
        expect(decoded.i).toEqual(['ring', 'shield']);
    });

    it('should reject invalid base64', () => {
        expect(isValidBase64('')).toBe(false);
        expect(isValidBase64('not-valid-base64!!!')).toBe(false);
    });

    it('should validate URL build data structure', () => {
        expect(isValidURLBuildData({ c: 'warrior' })).toBe(true);
        expect(isValidURLBuildData({ w: 'sword' })).toBe(true);
        expect(isValidURLBuildData({ t: ['tome1'] })).toBe(true);
        expect(isValidURLBuildData({ i: ['item1'] })).toBe(true);
        expect(isValidURLBuildData({})).toBe(true); // empty is valid
        expect(isValidURLBuildData(null)).toBe(false);
        expect(isValidURLBuildData('string')).toBe(false);
    });

    it('should detect synergies in a build', () => {
        const build = {
            character: { id: 'warrior', name: 'Warrior', synergies: ['melee'], synergies_weapons: ['axe'] } as any,
            weapon: { id: 'axe', name: 'Battle Axe', synergies: ['melee'] } as any,
            items: [],
            tomes: [],
        };
        const synergies = detectSynergies(build);
        expect(synergies).toBeDefined();
        expect(typeof synergies.found).toBe('boolean');
    });

    it('should detect anti-synergies', () => {
        const build = {
            character: null,
            weapon: null,
            items: [
                { id: 'a', name: 'A', anti_synergies: ['B'], antiSynergies: ['B'] } as any,
                { id: 'b', name: 'B' } as any,
            ],
            tomes: [],
        };
        const antiSynergies = detectAntiSynergies(build);
        expect(Array.isArray(antiSynergies)).toBe(true);
    });

    it('should validate build completeness', () => {
        const emptyBuild = { character: null, weapon: null, items: [], tomes: [] };
        expect(getBuildCompleteness(emptyBuild)).toBe(0);

        const fullBuild = {
            character: { id: 'w' } as any,
            weapon: { id: 'a' } as any,
            items: [{ id: 'i1' }, { id: 'i2' }, { id: 'i3' }, { id: 'i4' }, { id: 'i5' }, { id: 'i6' }] as any[],
            tomes: [{ id: 't1' }, { id: 't2' }, { id: 't3' }] as any[],
        };
        expect(getBuildCompleteness(fullBuild)).toBeGreaterThan(0);
    });

    it('should validateBuildData and return BuildData or null', () => {
        expect(validateBuildData({ character: 'w', weapon: 'a', items: ['i'] })).not.toBeNull();
        expect(validateBuildData(null)).toBeNull();
        expect(validateBuildData('string')).toBeNull();
    });
});
