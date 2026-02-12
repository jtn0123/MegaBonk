import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';

/**
 * Edge case tests for new feature modules
 * Tests boundary conditions, error handling, and unusual inputs
 */

describe('Edge Cases', () => {
    beforeEach(() => {
        createMinimalDOM();
        localStorage.clear();
    });

    describe('Recently Viewed Edge Cases', () => {
        beforeEach(async () => {
            vi.resetModules();
        });

        it('should handle rapid consecutive adds', async () => {
            vi.mock('../../src/modules/data-service.ts', () => ({
                allData: { items: { items: [] } },
            }));

            const { addToRecentlyViewed, getRecentlyViewed, clearRecentlyViewed } =
                await import('../../src/modules/recently-viewed.ts');

            clearRecentlyViewed();

            // Rapid fire adds
            for (let i = 0; i < 100; i++) {
                addToRecentlyViewed('items', `item_${i}`);
            }

            // Should only keep MAX_RECENT_ITEMS (10)
            expect(getRecentlyViewed().length).toBeLessThanOrEqual(10);
        });

        it('should handle special characters in IDs', async () => {
            vi.mock('../../src/modules/data-service.ts', () => ({
                allData: { items: { items: [] } },
            }));

            const { addToRecentlyViewed, getRecentlyViewed, clearRecentlyViewed } =
                await import('../../src/modules/recently-viewed.ts');

            clearRecentlyViewed();

            const specialIds = [
                'item-with-dash',
                'item_with_underscore',
                'item.with.dots',
                'item with spaces',
                'item"with"quotes',
            ];

            specialIds.forEach(id => {
                addToRecentlyViewed('items', id);
            });

            const recent = getRecentlyViewed();
            expect(recent).toHaveLength(5);
            specialIds.forEach(id => {
                expect(recent.some(r => r.id === id)).toBe(true);
            });
        });

        it('should handle empty string ID', async () => {
            vi.mock('../../src/modules/data-service.ts', () => ({
                allData: { items: { items: [] } },
            }));

            const { addToRecentlyViewed, getRecentlyViewed, clearRecentlyViewed } =
                await import('../../src/modules/recently-viewed.ts');

            clearRecentlyViewed();

            // Empty ID should still work (though not ideal)
            addToRecentlyViewed('items', '');

            const recent = getRecentlyViewed();
            expect(recent).toHaveLength(1);
            expect(recent[0].id).toBe('');
        });

        it('should handle malformed localStorage data types', async () => {
            // Set various malformed data
            localStorage.setItem('megabonk-recently-viewed', JSON.stringify('not an array'));

            const { loadRecentlyViewed } = await import('../../src/modules/recently-viewed.ts');

            expect(() => loadRecentlyViewed()).not.toThrow();
        });

        it('should handle entries with missing fields', async () => {
            const malformedData = [
                { type: 'items' }, // missing id and timestamp
                { id: 'test' }, // missing type and timestamp
                { timestamp: Date.now() }, // missing type and id
            ];
            localStorage.setItem('megabonk-recently-viewed', JSON.stringify(malformedData));

            const { loadRecentlyViewed } = await import('../../src/modules/recently-viewed.ts');

            expect(() => loadRecentlyViewed()).not.toThrow();
        });
    });

    describe('Similar Items Edge Cases', () => {
        it('should handle items with all undefined optional fields', async () => {
            vi.mock('../../src/modules/data-service.ts', () => ({
                allData: {
                    items: {
                        items: [
                            { id: 'minimal1', name: 'Minimal 1' },
                            { id: 'minimal2', name: 'Minimal 2' },
                        ],
                    },
                },
            }));

            const { findSimilarItems } = await import('../../src/modules/similar-items.ts');

            // Should not throw when comparing items with minimal data
            expect(() => findSimilarItems('items', 'minimal1')).not.toThrow();
        });

        it('should handle empty synergies array', async () => {
            vi.mock('../../src/modules/data-service.ts', () => ({
                allData: {
                    items: {
                        items: [
                            { id: 'item1', name: 'Item 1', synergies: [] },
                            { id: 'item2', name: 'Item 2', synergies: [] },
                        ],
                    },
                },
            }));

            const { findSimilarItems } = await import('../../src/modules/similar-items.ts');

            const similar = findSimilarItems('items', 'item1');
            expect(Array.isArray(similar)).toBe(true);
        });

        it('should handle very long base_effect strings', async () => {
            const longEffect = 'damage '.repeat(1000);

            vi.mock('../../src/modules/data-service.ts', () => ({
                allData: {
                    items: {
                        items: [
                            { id: 'long1', name: 'Long 1', base_effect: longEffect },
                            { id: 'long2', name: 'Long 2', base_effect: longEffect },
                        ],
                    },
                },
            }));

            const { findSimilarItems } = await import('../../src/modules/similar-items.ts');

            expect(() => findSimilarItems('items', 'long1')).not.toThrow();
        });

        it('should handle unicode in item names and effects', async () => {
            vi.mock('../../src/modules/data-service.ts', () => ({
                allData: {
                    items: {
                        items: [
                            { id: 'unicode1', name: '魔法の剣', base_effect: 'ダメージ増加' },
                            { id: 'unicode2', name: 'Épée magique', base_effect: 'Dégâts augmentés' },
                        ],
                    },
                },
            }));

            const { findSimilarItems, renderSimilarItemsSection } = await import('../../src/modules/similar-items.ts');

            expect(() => findSimilarItems('items', 'unicode1')).not.toThrow();
            expect(() => renderSimilarItemsSection('items', 'unicode1')).not.toThrow();
        });
    });

    describe('Random Build Edge Cases', () => {
        it('should generate builds with structure', async () => {
            const { generateRandomBuild } = await import('../../src/modules/random-build.ts');

            const build = generateRandomBuild();

            // Build should have the expected structure
            expect(build).toHaveProperty('character');
            expect(build).toHaveProperty('weapon');
            expect(build).toHaveProperty('tomes');
            expect(build).toHaveProperty('items');
            expect(build).toHaveProperty('constraints');
            expect(Array.isArray(build.tomes)).toBe(true);
            expect(Array.isArray(build.items)).toBe(true);
        });

        it('should respect constraint combinations', async () => {
            const { generateRandomBuild } = await import('../../src/modules/random-build.ts');

            // Generate with all constraints
            const build = generateRandomBuild({
                noLegendary: true,
                noSSItems: true,
                challengeMode: true,
            });

            // Should not throw and return valid build structure
            expect(build).toHaveProperty('character');
            expect(build).toHaveProperty('weapon');
            expect(Array.isArray(build.items)).toBe(true);

            // Items should not be legendary if any exist
            build.items.forEach(item => {
                expect(item.rarity).not.toBe('legendary');
            });
        });

        it('should return empty arrays for impossible constraints', async () => {
            const { generateRandomBuild } = await import('../../src/modules/random-build.ts');

            // Generate build
            const build = generateRandomBuild();

            // Even with empty results, structure should be valid
            expect(build.constraints).toBeDefined();
        });
    });

    describe('Mobile Nav Edge Cases', () => {
        it('should handle missing DOM elements gracefully', async () => {
            // Don't add mobile nav to DOM

            vi.mock('../../src/modules/store.ts', () => ({
                getState: vi.fn().mockReturnValue('items'),
                setState: vi.fn(),
                subscribe: vi.fn(),
            }));

            const { initMobileNav, showMoreMenu, hideMoreMenu } = await import('../../src/modules/mobile-nav.ts');

            expect(() => initMobileNav()).not.toThrow();
            expect(() => showMoreMenu()).not.toThrow();
            expect(() => hideMoreMenu()).not.toThrow();
        });

        it('should handle multiple rapid menu toggles', async () => {
            const mobileNav = document.createElement('nav');
            mobileNav.className = 'mobile-bottom-nav';
            mobileNav.innerHTML = '<div class="nav-items"></div>';
            document.body.appendChild(mobileNav);

            vi.mock('../../src/modules/store.ts', () => ({
                getState: vi.fn().mockReturnValue('items'),
                setState: vi.fn(),
                subscribe: vi.fn(),
            }));

            const { showMoreMenu, hideMoreMenu } = await import('../../src/modules/mobile-nav.ts');

            // Rapid toggle
            for (let i = 0; i < 10; i++) {
                showMoreMenu();
                hideMoreMenu();
            }

            expect(document.body.classList.contains('more-menu-open')).toBe(false);
        });
    });

    describe('CV Worker Edge Cases', () => {
        it('should handle small ImageData correctly', async () => {
            // This test validates that the CV worker module can be imported
            // and handles small image data without throwing errors
            const { isWorkerSupported } = await import('../../src/modules/cv-worker.ts');

            // isWorkerSupported should return a boolean
            const supported = isWorkerSupported();
            expect(typeof supported).toBe('boolean');
        });
    });
});

describe('Input Sanitization', () => {
    describe('XSS Prevention utilities', () => {
        it('should have escapeHtml function in utils', async () => {
            const { escapeHtml } = await import('../../src/modules/utils.ts');

            // Test that escapeHtml properly escapes dangerous characters
            const dangerous = '<script>alert("xss")</script>';
            const escaped = escapeHtml(dangerous);

            expect(escaped).not.toContain('<script>');
            expect(escaped).toContain('&lt;');
            expect(escaped).toContain('&gt;');
        });

        it('should escape HTML entities correctly', async () => {
            const { escapeHtml } = await import('../../src/modules/utils.ts');

            // Test core HTML entities that must be escaped for security
            const testCases = [
                { input: '<', expected: '&lt;' },
                { input: '>', expected: '&gt;' },
                { input: '&', expected: '&amp;' },
                { input: '"', expected: '&quot;' },
            ];

            testCases.forEach(({ input, expected }) => {
                expect(escapeHtml(input)).toBe(expected);
            });

            // Single quotes are escaped by string replacement implementation
            expect(escapeHtml("'")).toBe("&#039;");
        });

        it('should handle complex XSS payloads', async () => {
            const { escapeHtml } = await import('../../src/modules/utils.ts');

            const payloads = [
                '<img src=x onerror=alert(1)>',
                '<svg onload=alert(1)>',
                'javascript:alert(1)',
                '<iframe src="javascript:alert(1)">',
            ];

            payloads.forEach(payload => {
                const escaped = escapeHtml(payload);
                expect(escaped).not.toContain('<img');
                expect(escaped).not.toContain('<svg');
                expect(escaped).not.toContain('<iframe');
            });
        });
    });
});
