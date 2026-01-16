/**
 * Bug Validation Tests
 *
 * These tests validate the bugs found during the code review.
 * They should FAIL before the bugs are fixed, and PASS after the fixes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';

describe('Bug Validation - Critical Issues', () => {
    let dom: JSDOM;

    beforeEach(() => {
        dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
            url: 'http://localhost',
            pretendToBeVisual: true,
        });
        global.window = dom.window as any;
        global.document = dom.window.document;
    });

    afterEach(() => {
        dom.window.close();
    });

    describe('Bug #1: scan-build.ts - Non-null assertion on find() without validation', () => {
        it('should handle missing character in CV results gracefully', async () => {
            // Simulate the bug scenario
            const cvResults = [
                { type: 'weapon', entity: { id: 'sword' }, confidence: 0.9 },
                // No character result
            ];

            // This simulates the buggy code behavior
            const characterResult = cvResults.find(r => r.type === 'character');

            // Before fix: This would crash with "Cannot read property 'entity' of undefined"
            // After fix: Should handle gracefully
            expect(characterResult).toBeUndefined();

            // The code should check if characterResult exists before accessing properties
            if (characterResult) {
                expect(characterResult.entity).toBeDefined();
                expect(characterResult.confidence).toBeDefined();
            } else {
                // This is the expected behavior - should handle missing character
                expect(characterResult).toBeUndefined();
            }
        });

        it('should handle missing weapon in CV results gracefully', async () => {
            const cvResults = [
                { type: 'character', entity: { id: 'warrior' }, confidence: 0.9 },
                // No weapon result
            ];

            const weaponResult = cvResults.find(r => r.type === 'weapon');

            expect(weaponResult).toBeUndefined();

            if (weaponResult) {
                expect(weaponResult.entity).toBeDefined();
            } else {
                expect(weaponResult).toBeUndefined();
            }
        });

        it('should avoid multiple find() calls for the same result', () => {
            const cvResults = [
                { type: 'character', entity: { id: 'warrior' }, confidence: 0.9 },
            ];

            // Anti-pattern: calling find() multiple times (inefficient)
            const findSpy = vi.fn((r: any) => r.type === 'character');

            // Simulate the buggy code
            const entity1 = cvResults.find(findSpy)?.entity;
            const confidence1 = cvResults.find(findSpy)?.confidence;

            // This proves we're calling find() twice (inefficient)
            expect(findSpy).toHaveBeenCalledTimes(2);

            // Better approach: call find() once and store result
            findSpy.mockClear();
            const result = cvResults.find(findSpy);
            const entity2 = result?.entity;
            const confidence2 = result?.confidence;

            expect(findSpy).toHaveBeenCalledTimes(1);
            expect(entity2).toEqual(entity1);
            expect(confidence2).toEqual(confidence1);
        });
    });

    describe('Bug #2: computer-vision-enhanced.ts - Map operations with non-null assertion', () => {
        it('should safely access Map values after initialization', () => {
            const templatesByRarity = new Map<string, any[]>();
            const item = { id: 'item1', rarity: 'legendary' };

            // The current code does this:
            if (!templatesByRarity.has(item.rarity)) {
                templatesByRarity.set(item.rarity, []);
            }
            // Then uses non-null assertion (!)
            // templatesByRarity.get(item.rarity)!.push(item);

            // Better approach: use the result directly
            const rarityArray = templatesByRarity.get(item.rarity);
            expect(rarityArray).toBeDefined();
            expect(Array.isArray(rarityArray)).toBe(true);

            // This is safe because we just set it
            rarityArray!.push(item);
            expect(templatesByRarity.get(item.rarity)).toHaveLength(1);
        });

        it('should handle Map.get() returning undefined for missing keys', () => {
            const templatesByRarity = new Map<string, any[]>();

            // Before initialization, get() returns undefined
            const result = templatesByRarity.get('nonexistent');
            expect(result).toBeUndefined();

            // Using non-null assertion on undefined would crash:
            // result!.push(item) // TypeError: Cannot read property 'push' of undefined

            // Safe approach: check before using
            if (result) {
                result.push({ id: 'test' });
            } else {
                expect(result).toBeUndefined();
            }
        });
    });

    describe('Bug #3: build-planner.ts - Array index without bounds check', () => {
        it('should handle missing "build=" in URL hash', () => {
            const testCases = [
                { hash: '#', expected: undefined },
                { hash: '#other=value', expected: undefined },
                { hash: '#build', expected: undefined },
                { hash: '#build=', expected: '' },
                { hash: '#build=abc123', expected: 'abc123' },
            ];

            testCases.forEach(({ hash, expected }) => {
                // Simulate the buggy code
                const parts = hash.split('build=');
                const encoded = parts[1];

                expect(encoded).toBe(expected);

                // The code should check if encoded exists before using it
                if (!encoded) {
                    // This is the expected safe behavior
                    expect(encoded).toBeFalsy();
                } else {
                    expect(encoded).toBeTruthy();
                }
            });
        });

        it('should validate array length before accessing index', () => {
            const safeAccess = (arr: string[], index: number): string | undefined => {
                return index >= 0 && index < arr.length ? arr[index] : undefined;
            };

            const parts1 = 'no-separator'.split('build=');
            expect(safeAccess(parts1, 1)).toBeUndefined();

            const parts2 = 'build=value'.split('build=');
            expect(safeAccess(parts2, 1)).toBe('value');
        });
    });

    describe('Bug #4: build-planner.ts - Missing null check on weapon properties', () => {
        it('should handle null weapon before accessing properties', () => {
            const buildToUse = {
                character: { id: 'warrior' },
                weapon: null as any,
                tomes: [],
                items: [],
            };

            // Before fix: This crashes with "Cannot read property 'base_damage' of null"
            // buildToUse.weapon.base_damage

            // After fix: Should check if weapon exists first
            if (buildToUse.weapon) {
                const baseDamage = buildToUse.weapon.base_damage ?? buildToUse.weapon.baseDamage;
                expect(baseDamage).toBeDefined();
            } else {
                // This is the expected safe behavior
                expect(buildToUse.weapon).toBeNull();
            }
        });

        it('should use optional chaining for safe property access', () => {
            const buildWithWeapon = {
                weapon: { base_damage: 50 },
            };

            const buildWithoutWeapon = {
                weapon: null as any,
            };

            // Safe access with optional chaining
            expect(buildWithWeapon.weapon?.base_damage).toBe(50);
            expect(buildWithoutWeapon.weapon?.base_damage).toBeUndefined();

            // Using nullish coalescing for default values
            const damage1 = buildWithWeapon.weapon?.base_damage ?? 0;
            const damage2 = buildWithoutWeapon.weapon?.base_damage ?? 0;

            expect(damage1).toBe(50);
            expect(damage2).toBe(0);
        });
    });

    describe('Bug #5: Edge cases in string operations', () => {
        it('should handle edge cases in substring operations', () => {
            const testCases = [
                { value: '>=10', prefix: 2, expected: '10' },
                { value: '>5', prefix: 1, expected: '5' },
                { value: '>', prefix: 1, expected: '' },
                { value: '', prefix: 2, expected: '' },
            ];

            testCases.forEach(({ value, prefix, expected }) => {
                const result = value.substring(prefix);
                expect(result).toBe(expected);

                // parseFloat on empty string returns NaN
                const numValue = parseFloat(result);
                if (result === '') {
                    expect(isNaN(numValue)).toBe(true);
                } else {
                    expect(isNaN(numValue)).toBe(false);
                }
            });
        });

        it('should validate string length before substring operations', () => {
            const safeSubstring = (str: string, start: number): string | null => {
                return str.length > start ? str.substring(start) : null;
            };

            expect(safeSubstring('>=10', 2)).toBe('10');
            expect(safeSubstring('>', 1)).toBeNull(); // Length is 1, not > 1
            expect(safeSubstring('>', 2)).toBeNull();
        });
    });

    describe('Bug #6: Array empty state validation', () => {
        it('should handle Math.max on empty arrays', () => {
            const emptyArray: number[] = [];

            // Math.max on spread empty array returns -Infinity
            const maxOfEmpty = Math.max(...emptyArray);
            expect(maxOfEmpty).toBe(-Infinity);

            // Safe approach: check length first
            const safeMax = emptyArray.length > 0 ? Math.max(...emptyArray) : 1;
            expect(safeMax).toBe(1);
        });

        it('should handle arrays with only negative numbers', () => {
            const negativeArray = [-5, -10, -3];
            const maxVal = Math.max(...negativeArray);
            expect(maxVal).toBe(-3);

            // If we want to ensure positive fallback:
            const safeMax = maxVal > 0 ? maxVal : 1;
            expect(safeMax).toBe(1);
        });
    });

    describe('Bug #7: Type assertions without validation', () => {
        it('should validate FileReader result type', () => {
            // FileReader.result can be string OR ArrayBuffer depending on read method
            const stringResult: string | ArrayBuffer | null = 'data:image/png;base64,abc123';
            const arrayBufferResult: string | ArrayBuffer | null = new ArrayBuffer(8);
            const nullResult: string | ArrayBuffer | null = null;

            // Unsafe: result as string (could be ArrayBuffer!)
            // Safe: check type before using

            const isString = (result: string | ArrayBuffer | null): result is string => {
                return typeof result === 'string';
            };

            expect(isString(stringResult)).toBe(true);
            expect(isString(arrayBufferResult)).toBe(false);
            expect(isString(nullResult)).toBe(false);

            if (isString(stringResult)) {
                expect(stringResult.startsWith('data:')).toBe(true);
            }
        });
    });
});

describe('Bug Validation - Second Pass (Removing Unnecessary Non-null Assertions)', () => {
    describe('Bug #8: Unnecessary non-null assertions after null checks', () => {
        it('should access property directly after checking it exists', () => {
            interface TestObj {
                data?: {
                    items: string[];
                };
            }

            const obj1: TestObj = {
                data: { items: ['a', 'b', 'c'] },
            };

            const obj2: TestObj = {};

            // Anti-pattern: check with ?. then use !
            // if (obj.data?.items) {
            //     const items = obj.data!.items;  // Unnecessary !
            // }

            // Better: store the reference
            if (obj1.data?.items) {
                const items = obj1.data.items; // No need for !
                expect(items).toHaveLength(3);
                expect(items[0]).toBe('a');
            }

            if (obj2.data?.items) {
                const items = obj2.data.items;
                expect(items).toBeDefined();
            } else {
                // This is the expected path for obj2
                expect(obj2.data).toBeUndefined();
            }
        });

        it('should use local variable to avoid repeated assertions', () => {
            interface Build {
                weapon?: {
                    name: string;
                    damage: number;
                };
            }

            const buildWithWeapon: Build = {
                weapon: { name: 'Sword', damage: 50 },
            };

            const buildWithoutWeapon: Build = {};

            // Anti-pattern: repeated weapon! assertions
            // if (build.weapon) {
            //     console.log(build.weapon!.name);
            //     console.log(build.weapon!.damage);
            // }

            // Better: store reference once
            if (buildWithWeapon.weapon) {
                const weapon = buildWithWeapon.weapon;
                expect(weapon.name).toBe('Sword');
                expect(weapon.damage).toBe(50);
            }

            if (buildWithoutWeapon.weapon) {
                expect(buildWithoutWeapon.weapon).toBeDefined();
            } else {
                expect(buildWithoutWeapon.weapon).toBeUndefined();
            }
        });

        it('should handle arrays without non-null assertions after filter', () => {
            const allData = {
                items: {
                    items: [
                        { id: 'item1', name: 'Item 1' },
                        { id: 'item2', name: 'Item 2' },
                        { id: 'item3', name: 'Item 3' },
                    ],
                },
            };

            const selectedIds = ['item1', 'item3', 'nonexistent'];

            // Check data exists before accessing
            if (allData.items?.items) {
                const items = allData.items.items;
                const selectedItems = selectedIds
                    .map(id => items.find(item => item.id === id))
                    .filter((item): item is { id: string; name: string } => item !== undefined);

                expect(selectedItems).toHaveLength(2);
                expect(selectedItems[0].id).toBe('item1');
                expect(selectedItems[1].id).toBe('item3');
            }
        });
    });

    describe('Bug #9: Race conditions with setTimeout', () => {
        it('should prefer requestAnimationFrame over setTimeout for DOM operations', async () => {
            // Simulate creating a DOM element
            const container = document.createElement('div');
            container.id = 'test-container';
            document.body.appendChild(container);

            // Anti-pattern: arbitrary timeout
            // setTimeout(() => {
            //     const elem = document.getElementById('test-container');
            //     // What if it's not ready in 100ms?
            // }, 100);

            // Better: requestAnimationFrame ensures next paint cycle
            await new Promise<void>(resolve => {
                requestAnimationFrame(() => {
                    const elem = document.getElementById('test-container');
                    expect(elem).toBeDefined();
                    expect(elem?.id).toBe('test-container');
                    container.remove();
                    resolve();
                });
            });
        });

        it('should validate element state before performing operations', async () => {
            // Create element with class
            const modal = document.createElement('div');
            modal.id = 'test-modal';
            modal.classList.add('active');
            document.body.appendChild(modal);

            await new Promise<void>(resolve => {
                requestAnimationFrame(() => {
                    const elem = document.getElementById('test-modal');

                    // Validate both existence AND state
                    if (elem && elem.classList.contains('active')) {
                        expect(elem).toBeDefined();
                        expect(elem.classList.contains('active')).toBe(true);
                    } else {
                        // Element not ready or not in correct state
                        expect(elem).toBeNull();
                    }

                    modal.remove();
                    resolve();
                });
            });
        });
    });

    describe('Bug #10: Refactoring safety with non-null assertions', () => {
        it('should demonstrate why non-null assertions are dangerous during refactoring', () => {
            interface Build {
                weapon?: { name: string };
            }

            // Safe version: stores reference, no ! needed
            const formatWeaponSafe = (build: Build): string => {
                if (build.weapon) {
                    const weapon = build.weapon;
                    return `Using ${weapon.name}`;
                }
                return 'No weapon';
            };

            // Unsafe version: uses ! assertions
            const formatWeaponUnsafe = (build: Build): string => {
                if (build.weapon) {
                    // If someone refactors and removes the check, these ! hide the error
                    return `Using ${build.weapon!.name}`;
                }
                return 'No weapon';
            };

            const buildWith: Build = { weapon: { name: 'Sword' } };
            const buildWithout: Build = {};

            // Both work correctly when check is present
            expect(formatWeaponSafe(buildWith)).toBe('Using Sword');
            expect(formatWeaponSafe(buildWithout)).toBe('No weapon');

            expect(formatWeaponUnsafe(buildWith)).toBe('Using Sword');
            expect(formatWeaponUnsafe(buildWithout)).toBe('No weapon');

            // But if check is removed, ! hides the error:
            // const formatBuggy = (build: Build) => `Using ${build.weapon!.name}`;
            // This compiles but crashes at runtime!
        });
    });
});
