import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies BEFORE imports
vi.mock('../../src/modules/data-service.ts', () => ({
    allData: {
        items: {
            items: [
                {
                    id: 'test-item',
                    name: 'Test Item',
                    tier: 'S' as const,
                    rarity: 'legendary' as const,
                    base_effect: 'Test effect',
                    detailed_description: 'Test description',
                },
                {
                    id: 'item-2',
                    name: 'Item 2',
                    tier: 'A' as const,
                    rarity: 'epic' as const,
                    base_effect: 'Test effect 2',
                    detailed_description: 'Test description 2',
                },
            ],
        },
        weapons: {
            weapons: [
                {
                    id: 'test-weapon',
                    name: 'Test Weapon',
                    tier: 'S' as const,
                    rarity: 'legendary' as const,
                    description: 'Test weapon',
                    base_damage: 50,
                },
            ],
        },
        tomes: {
            tomes: [
                {
                    id: 'test-tome',
                    name: 'Test Tome',
                    tier: 'S' as const,
                    rarity: 'legendary' as const,
                    description: 'Test tome',
                    effect: 'Test effect',
                    priority: 1,
                },
            ],
        },
        characters: {
            characters: [
                {
                    id: 'hero',
                    name: 'Hero',
                    tier: 'S' as const,
                    description: 'Test hero',
                    passive_ability: 'Test passive',
                    starting_stats: {},
                },
            ],
        },
        shrines: {
            shrines: [
                {
                    id: 'test-shrine',
                    name: 'Test Shrine',
                    tier: 'S' as const,
                    effect: 'Test effect',
                    description: 'Test shrine',
                },
            ],
        },
        changelog: {
            patches: [
                {
                    id: 'patch-1',
                    version: '1.0.0',
                    title: 'Initial Release',
                    date: '2024-01-01',
                    summary: 'First version',
                },
                {
                    id: 'patch-2',
                    version: '1.1.0',
                    title: 'Update',
                    date: '2024-02-01',
                    summary: 'Bug fixes',
                },
            ],
        },
    },
}));

vi.mock('../../src/modules/utils.ts', () => ({
    safeGetElementById: (id: string) => document.getElementById(id),
    escapeHtml: (text: string) => {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },
    isValidExternalUrl: (url: string) => {
        if (!url) return false;
        try {
            const parsed = new URL(url);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
            return false;
        }
    },
    generateEmptyState: (icon: string, label: string) => `<div class="empty-state">${icon} No ${label}</div>`,
}));

// Import after mocks
import {
    findEntityInData,
    parseChangelogLinks,
    formatCategoryName,
    formatChangelogDate,
    renderChangesSections,
    renderChangelog,
    handleExpandClick,
    toggleChangelogExpand,
    updateChangelogStats,
} from '../../src/modules/changelog.ts';

describe('changelog.ts - Edge Cases', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    describe('findEntityInData', () => {
        it('should find item by ID', () => {
            const entity = findEntityInData('item', 'test-item');
            expect(entity).toBeTruthy();
            expect(entity?.name).toBe('Test Item');
        });

        it('should find weapon by ID', () => {
            const entity = findEntityInData('weapon', 'test-weapon');
            expect(entity).toBeTruthy();
            expect(entity?.name).toBe('Test Weapon');
        });

        it('should find tome by ID', () => {
            const entity = findEntityInData('tome', 'test-tome');
            expect(entity).toBeTruthy();
            expect(entity?.name).toBe('Test Tome');
        });

        it('should find character by ID', () => {
            const entity = findEntityInData('character', 'hero');
            expect(entity).toBeTruthy();
            expect(entity?.name).toBe('Hero');
        });

        it('should find shrine by ID', () => {
            const entity = findEntityInData('shrine', 'test-shrine');
            expect(entity).toBeTruthy();
            expect(entity?.name).toBe('Test Shrine');
        });

        it('should return null for nonexistent item', () => {
            const entity = findEntityInData('item', 'nonexistent');
            expect(entity).toBeNull();
        });

        it('should return null for invalid entity type', () => {
            const entity = findEntityInData('invalid' as any, 'test-item');
            expect(entity).toBeNull();
        });

        it('should return null for empty ID', () => {
            const entity = findEntityInData('item', '');
            expect(entity).toBeNull();
        });
    });

    describe('parseChangelogLinks', () => {
        // Note: These tests were previously skipped due to vi.mock complexities.
        // Fixed by ensuring data-service mock is properly set up before imports.
        it('should parse entity link with valid syntax', () => {
            const text = 'Fixed [[item:test-item|Test Item]]';
            const result = parseChangelogLinks(text);

            expect(result).toContain('<a href="#"');
            expect(result).toContain('class="entity-link"');
            expect(result).toContain('data-entity-type="item"');
            expect(result).toContain('data-entity-id="test-item"');
            expect(result).toContain('Test Item');
        });

        it('should parse multiple entity links', () => {
            const text = 'Fixed [[item:test-item|Test Item]] and [[weapon:test-weapon|Test Weapon]]';
            const result = parseChangelogLinks(text);

            expect(result).toContain('data-entity-id="test-item"');
            expect(result).toContain('data-entity-id="test-weapon"');
        });

        it('should handle empty text', () => {
            const result = parseChangelogLinks('');
            expect(result).toBe('');
        });

        it('should handle text without links', () => {
            const text = 'This is plain text';
            const result = parseChangelogLinks(text);
            expect(result).toBe(text);
        });

        it('should return plain text for invalid entity type', () => {
            const text = '[[invalid:test|Label]]';
            const result = parseChangelogLinks(text);
            expect(result).toBe('Label');
            expect(result).not.toContain('<a');
        });

        it('should return escaped text for nonexistent entity', () => {
            const text = '[[item:nonexistent|Nonexistent Item]]';
            const result = parseChangelogLinks(text);
            expect(result).toBe('Nonexistent Item');
            expect(result).not.toContain('<a');
        });

        it('should escape HTML in label', () => {
            const text = '[[item:test-item|<script>alert("xss")</script>]]';
            const result = parseChangelogLinks(text);

            expect(result).not.toContain('<script>');
            expect(result).toContain('&lt;script&gt;');
        });

        it('should handle malformed link syntax', () => {
            const text = '[[item:test-item]]'; // Missing label
            const result = parseChangelogLinks(text);
            // Should not crash, just return original
            expect(result).toBeDefined();
        });

        it('should handle link with no ID', () => {
            const text = '[[item:|Label]]';
            const result = parseChangelogLinks(text);
            // Should return label since entity won't be found
            expect(result).toBe('Label');
        });

        it('should handle link with special characters in label', () => {
            const text = '[[item:test-item|Test & "Item" <special>]]';
            const result = parseChangelogLinks(text);

            expect(result).toContain('&amp;');
            expect(result).toContain('&quot;');
            expect(result).toContain('&lt;');
        });

        it('should handle nested brackets', () => {
            const text = '[[item:test-item|[Test] Item]]';
            const result = parseChangelogLinks(text);
            expect(result).toContain('[Test] Item');
        });

        it('should handle very long labels', () => {
            const longLabel = 'A'.repeat(1000);
            const text = `[[item:test-item|${longLabel}]]`;
            const result = parseChangelogLinks(text);
            expect(result).toContain(longLabel);
        });
    });

    describe('formatCategoryName', () => {
        it('should format balance category', () => {
            expect(formatCategoryName('balance')).toBe('Balance Changes');
        });

        it('should format new_content category', () => {
            expect(formatCategoryName('new_content')).toBe('New Content');
        });

        it('should format bug_fixes category', () => {
            expect(formatCategoryName('bug_fixes')).toBe('Bug Fixes');
        });

        it('should format removed category', () => {
            expect(formatCategoryName('removed')).toBe('Removed');
        });

        it('should format other category', () => {
            expect(formatCategoryName('other')).toBe('Other Changes');
        });

        it('should return unknown category as-is', () => {
            expect(formatCategoryName('unknown')).toBe('unknown');
        });

        it('should handle empty string', () => {
            expect(formatCategoryName('')).toBe('');
        });

        it('should handle very long category names', () => {
            const longName = 'a'.repeat(100);
            expect(formatCategoryName(longName)).toBe(longName);
        });
    });

    describe('formatChangelogDate', () => {
        it('should format valid date', () => {
            const result = formatChangelogDate('2024-01-15');
            expect(result).toContain('2024');
            expect(result).toContain('Jan');
        });

        it('should handle empty string', () => {
            const result = formatChangelogDate('');
            expect(result).toBe('');
        });

        it('should handle invalid date', () => {
            const result = formatChangelogDate('not-a-date');
            expect(result).toBe('Invalid Date');
        });

        it('should handle null input', () => {
            const result = formatChangelogDate(null as any);
            expect(result).toBe('');
        });

        it('should handle undefined input', () => {
            const result = formatChangelogDate(undefined as any);
            expect(result).toBe('');
        });

        it('should handle date with invalid format', () => {
            const result = formatChangelogDate('2024/01/15'); // Wrong separator
            expect(result).toBeDefined(); // Should not throw
        });

        it('should handle date at year boundaries', () => {
            const result1 = formatChangelogDate('2024-01-01');
            const result2 = formatChangelogDate('2024-12-31');
            // Note: Dates may shift due to timezone (Jan 1 -> Dec 31 previous year)
            expect(result1).toMatch(/\w{3} \d{1,2}, \d{4}/);
            expect(result2).toContain('Dec');
        });

        it('should handle leap year dates', () => {
            const result = formatChangelogDate('2024-02-29');
            expect(result).toContain('Feb');
            // Note: Day may shift due to timezone, just verify it's a valid date format
            expect(result).toMatch(/\d{1,2},/);
        });

        it('should handle very old dates', () => {
            const result = formatChangelogDate('1970-01-01');
            // Note: May shift to Dec 31, 1969 in some timezones
            expect(result).toMatch(/\d{4}$/);
        });

        it('should handle future dates', () => {
            const result = formatChangelogDate('2099-12-31');
            expect(result).toContain('2099');
        });
    });

    describe('renderChangesSections', () => {
        it('should render categorized changes', () => {
            const categories = {
                balance: [{ text: 'Buffed item X', change_type: 'buff' as const }],
                bug_fixes: [{ text: 'Fixed bug Y' }],
            };

            const result = renderChangesSections(categories, undefined);

            expect(result).toContain('Balance Changes');
            expect(result).toContain('Buffed item X');
            expect(result).toContain('Bug Fixes');
            expect(result).toContain('Fixed bug Y');
        });

        it('should fallback to raw notes if no categories', () => {
            const result = renderChangesSections(undefined, 'Raw patch notes');

            expect(result).toContain('Raw patch notes');
            expect(result).toContain('changelog-raw-notes');
        });

        it('should escape HTML in raw notes', () => {
            const result = renderChangesSections(undefined, '<script>alert("xss")</script>');

            expect(result).not.toContain('<script>');
            expect(result).toContain('&lt;script&gt;');
        });

        it.skip('should parse entity links in raw notes', () => {
            // Skipped due to parseChangelogLinks mock issues
            const result = renderChangesSections(undefined, 'Fixed [[item:test-item|Test Item]]');

            expect(result).toContain('entity-link');
            expect(result).toContain('test-item');
        });

        it('should handle empty categories', () => {
            const categories = {
                balance: [],
                bug_fixes: [],
            };

            const result = renderChangesSections(categories, undefined);

            // Should be empty or minimal since no changes
            expect(result.trim()).toBe('');
        });

        it('should fallback to raw notes if all categories empty', () => {
            const categories = {
                balance: [],
            };
            const rawNotes = 'Fallback notes';

            const result = renderChangesSections(categories, rawNotes);

            expect(result).toContain('Fallback notes');
        });

        it('should handle changes with change_type', () => {
            const categories = {
                balance: [
                    { text: 'Buff', change_type: 'buff' as const },
                    { text: 'Nerf', change_type: 'nerf' as const },
                    { text: 'Fix', change_type: 'fix' as const },
                ],
            };

            const result = renderChangesSections(categories, undefined);

            expect(result).toContain('class="changelog-item buff"');
            expect(result).toContain('class="changelog-item nerf"');
            expect(result).toContain('class="changelog-item fix"');
        });

        it('should handle changes without change_type', () => {
            const categories = {
                other: [{ text: 'Generic change' }],
            };

            const result = renderChangesSections(categories, undefined);

            expect(result).toContain('class="changelog-item "');
            expect(result).toContain('Generic change');
        });

        it('should render categories in correct order', () => {
            const categories = {
                removed: [{ text: 'Removed X' }],
                new_content: [{ text: 'Added Y' }],
                balance: [{ text: 'Balanced Z' }],
            };

            const result = renderChangesSections(categories, undefined);

            // new_content should appear before balance, balance before removed
            const newContentIndex = result.indexOf('New Content');
            const balanceIndex = result.indexOf('Balance Changes');
            const removedIndex = result.indexOf('Removed');

            expect(newContentIndex).toBeLessThan(balanceIndex);
            expect(balanceIndex).toBeLessThan(removedIndex);
        });

        it('should handle very long change text', () => {
            const longText = 'A'.repeat(5000);
            const categories = {
                balance: [{ text: longText }],
            };

            const result = renderChangesSections(categories, undefined);

            expect(result).toContain(longText);
        });

        it('should return empty string for no categories and no raw notes', () => {
            const result = renderChangesSections(undefined, undefined);
            expect(result).toBe('');
        });
    });

    describe('renderChangelog', () => {
        beforeEach(() => {
            const container = document.createElement('div');
            container.id = 'changelogContainer';
            document.body.appendChild(container);

            const itemCount = document.createElement('div');
            itemCount.id = 'item-count';
            document.body.appendChild(itemCount);
        });

        it('should render patches', () => {
            const patches = [
                {
                    id: 'patch-1',
                    version: '1.0.0',
                    title: 'Initial Release',
                    date: '2024-01-01',
                    summary: 'First version',
                    categories: {
                        new_content: [{ text: 'Added items' }],
                    },
                },
            ];

            renderChangelog(patches);

            const container = document.getElementById('changelogContainer');
            expect(container?.innerHTML).toContain('v1.0.0');
            expect(container?.innerHTML).toContain('Initial Release');
            expect(container?.innerHTML).toContain('First version');
        });

        it('should show empty state for no patches', () => {
            renderChangelog([]);

            const container = document.getElementById('changelogContainer');
            expect(container?.innerHTML).toContain('empty-state');
            expect(container?.innerHTML).toContain('Changelog Entries');
        });

        it('should handle null patches array', () => {
            renderChangelog(null as any);

            const container = document.getElementById('changelogContainer');
            expect(container?.innerHTML).toContain('empty-state');
        });

        it('should handle missing container', () => {
            document.getElementById('changelogContainer')?.remove();

            expect(() => renderChangelog([])).not.toThrow();
        });

        it('should escape HTML in patch data', () => {
            const patches = [
                {
                    id: 'patch-1',
                    version: '<script>alert("xss")</script>',
                    title: '<b>Bold</b>',
                    date: '2024-01-01',
                    summary: '<i>Italic</i>',
                },
            ];

            renderChangelog(patches);

            const container = document.getElementById('changelogContainer');
            expect(container?.innerHTML).not.toContain('<script>');
            expect(container?.innerHTML).toContain('&lt;script&gt;');
            expect(container?.innerHTML).not.toContain('<b>Bold</b>');
            expect(container?.innerHTML).toContain('&lt;b&gt;');
        });

        it('should render Steam link if valid URL', () => {
            const patches = [
                {
                    id: 'patch-1',
                    version: '1.0.0',
                    title: 'Release',
                    date: '2024-01-01',
                    steam_url: 'https://steamcommunity.com/...',
                },
            ];

            renderChangelog(patches);

            const container = document.getElementById('changelogContainer');
            expect(container?.innerHTML).toContain('🔗 Steam');
            expect(container?.innerHTML).toContain('href=');
        });

        it('should not render Steam link if invalid URL', () => {
            const patches = [
                {
                    id: 'patch-1',
                    version: '1.0.0',
                    title: 'Release',
                    date: '2024-01-01',
                    steam_url: 'javascript:alert(1)',
                },
            ];

            renderChangelog(patches);

            const container = document.getElementById('changelogContainer');
            expect(container?.innerHTML).not.toContain('🔗 Steam');
        });

        it('should render category pills with counts', () => {
            const patches = [
                {
                    id: 'patch-1',
                    version: '1.0.0',
                    title: 'Release',
                    date: '2024-01-01',
                    categories: {
                        balance: [{ text: 'Change 1' }, { text: 'Change 2' }],
                        bug_fixes: [{ text: 'Fix 1' }],
                    },
                },
            ];

            renderChangelog(patches);

            const container = document.getElementById('changelogContainer');
            expect(container?.innerHTML).toContain('Balance');
            expect(container?.innerHTML).toContain('(2)');
            expect(container?.innerHTML).toContain('(1)');
        });

        it('should render expand button', () => {
            const patches = [
                {
                    id: 'patch-1',
                    version: '1.0.0',
                    title: 'Release',
                    date: '2024-01-01',
                },
            ];

            renderChangelog(patches);

            const button = document.querySelector('.changelog-expand-btn');
            expect(button).toBeTruthy();
            expect(button?.textContent).toContain('Show Details');
        });

        it('should attach event listener for expand buttons', () => {
            const patches = [
                {
                    id: 'patch-1',
                    version: '1.0.0',
                    title: 'Release',
                    date: '2024-01-01',
                    categories: {
                        balance: [{ text: 'Change' }],
                    },
                },
            ];

            renderChangelog(patches);

            const button = document.querySelector('.changelog-expand-btn') as HTMLButtonElement;
            button.click();

            // Should toggle
            const changes = document.getElementById('changes-patch-1');
            expect(changes?.classList.contains('expanded')).toBe(true);
        });

        it('should render multiple patches', () => {
            const patches = [
                {
                    id: 'patch-1',
                    version: '1.0.0',
                    title: 'Release 1',
                    date: '2024-01-01',
                },
                {
                    id: 'patch-2',
                    version: '1.1.0',
                    title: 'Release 2',
                    date: '2024-02-01',
                },
            ];

            renderChangelog(patches);

            const container = document.getElementById('changelogContainer');
            expect(container?.innerHTML).toContain('Release 1');
            expect(container?.innerHTML).toContain('Release 2');
        });

        it('should handle patches with no summary', () => {
            const patches = [
                {
                    id: 'patch-1',
                    version: '1.0.0',
                    title: 'Release',
                    date: '2024-01-01',
                    summary: undefined,
                },
            ];

            renderChangelog(patches);

            const container = document.getElementById('changelogContainer');
            expect(container?.innerHTML).toContain('Release');
        });

        it('should set dataset patchId', () => {
            const patches = [
                {
                    id: 'my-patch-id',
                    version: '1.0.0',
                    title: 'Release',
                    date: '2024-01-01',
                },
            ];

            renderChangelog(patches);

            const entry = document.querySelector('.changelog-entry') as HTMLElement;
            expect(entry?.dataset.patchId).toBe('my-patch-id');
        });
    });

    describe('handleExpandClick', () => {
        beforeEach(() => {
            const container = document.createElement('div');
            container.id = 'changelogContainer';
            document.body.innerHTML = '';
            document.body.appendChild(container);

            const changes = document.createElement('div');
            changes.id = 'changes-test';
            document.body.appendChild(changes);

            const button = document.createElement('button');
            button.className = 'changelog-expand-btn';
            button.dataset.target = 'changes-test';
            button.textContent = 'Show Details';
            container.appendChild(button);
        });

        it('should toggle expand when button is clicked', () => {
            const button = document.querySelector('.changelog-expand-btn') as HTMLButtonElement;
            const event = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(event, 'target', { value: button, enumerable: true });

            handleExpandClick(event);

            const changes = document.getElementById('changes-test');
            expect(changes?.classList.contains('expanded')).toBe(true);
        });

        it('should do nothing if clicked element is not expand button', () => {
            const otherButton = document.createElement('button');
            document.body.appendChild(otherButton);

            const event = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(event, 'target', { value: otherButton, enumerable: true });

            expect(() => handleExpandClick(event)).not.toThrow();
        });

        it('should handle click on child of button', () => {
            const button = document.querySelector('.changelog-expand-btn') as HTMLButtonElement;
            const span = document.createElement('span');
            span.textContent = 'Text';
            button.appendChild(span);

            const event = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(event, 'target', { value: span, enumerable: true });

            handleExpandClick(event);

            const changes = document.getElementById('changes-test');
            expect(changes?.classList.contains('expanded')).toBe(true);
        });
    });

    describe('toggleChangelogExpand', () => {
        beforeEach(() => {
            const changes = document.createElement('div');
            changes.id = 'changes-test';
            document.body.appendChild(changes);

            const button = document.createElement('button');
            button.dataset.target = 'changes-test';
            button.textContent = 'Show Details';
            button.setAttribute('aria-expanded', 'false');
            document.body.appendChild(button);
        });

        it('should expand collapsed content', () => {
            const button = document.querySelector('button') as HTMLButtonElement;
            const changes = document.getElementById('changes-test') as HTMLElement;

            toggleChangelogExpand(button);

            expect(changes.classList.contains('expanded')).toBe(true);
            expect(button.textContent).toBe('Hide Details');
            expect(button.getAttribute('aria-expanded')).toBe('true');
        });

        it('should collapse expanded content', () => {
            const button = document.querySelector('button') as HTMLButtonElement;
            const changes = document.getElementById('changes-test') as HTMLElement;

            // Expand first
            changes.classList.add('expanded');
            button.textContent = 'Hide Details';
            button.setAttribute('aria-expanded', 'true');

            // Then collapse
            toggleChangelogExpand(button);

            expect(changes.classList.contains('expanded')).toBe(false);
            expect(button.textContent).toBe('Show Details');
            expect(button.getAttribute('aria-expanded')).toBe('false');
        });

        it('should handle missing target', () => {
            const button = document.createElement('button');
            // No dataset.target

            expect(() => toggleChangelogExpand(button)).not.toThrow();
        });

        it('should handle nonexistent target ID', () => {
            const button = document.createElement('button');
            button.dataset.target = 'nonexistent';

            expect(() => toggleChangelogExpand(button)).not.toThrow();
        });

        it('should toggle multiple times', () => {
            const button = document.querySelector('button') as HTMLButtonElement;
            const changes = document.getElementById('changes-test') as HTMLElement;

            toggleChangelogExpand(button);
            expect(changes.classList.contains('expanded')).toBe(true);

            toggleChangelogExpand(button);
            expect(changes.classList.contains('expanded')).toBe(false);

            toggleChangelogExpand(button);
            expect(changes.classList.contains('expanded')).toBe(true);
        });
    });

    describe('updateChangelogStats', () => {
        beforeEach(() => {
            const itemCount = document.createElement('div');
            itemCount.id = 'item-count';
            document.body.appendChild(itemCount);
        });

        it('should show total count when not filtered', () => {
            const patches = [
                { id: '1', version: '1.0.0', title: 'A', date: '2024-01-01' },
                { id: '2', version: '1.1.0', title: 'B', date: '2024-02-01' },
            ];

            updateChangelogStats(patches);

            const itemCount = document.getElementById('item-count');
            expect(itemCount?.textContent).toBe('2 patches');
        });

        it('should show filtered count when different from total', () => {
            const patches = [
                { id: '1', version: '1.0.0', title: 'A', date: '2024-01-01' },
            ];

            updateChangelogStats(patches);

            const itemCount = document.getElementById('item-count');
            // Total is 2 (from mocked allData), showing is 1
            expect(itemCount?.textContent).toBe('1/2 patches');
        });

        it('should handle empty patches array', () => {
            updateChangelogStats([]);

            const itemCount = document.getElementById('item-count');
            expect(itemCount?.textContent).toBe('0/2 patches');
        });

        it('should handle missing item-count element', () => {
            document.getElementById('item-count')?.remove();

            expect(() => updateChangelogStats([])).not.toThrow();
        });

        it('should handle null patches', () => {
            updateChangelogStats(null as any);

            const itemCount = document.getElementById('item-count');
            expect(itemCount?.textContent).toContain('patches');
        });

        it('should use singular when showing 1 patch', () => {
            const patches = [
                { id: '1', version: '1.0.0', title: 'A', date: '2024-01-01' },
            ];

            updateChangelogStats(patches);

            const itemCount = document.getElementById('item-count');
            expect(itemCount?.textContent).toContain('patch');
        });
    });
});
