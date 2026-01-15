import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';
import {
    createMockItem,
    createMockWeapon,
    createMockCharacter,
    createMockShrine,
    createMockAllData,
} from '../helpers/mock-data.js';

/**
 * Modal management functions for unit testing
 */
let allData = {};
let compareItems = [];
const MAX_COMPARE_ITEMS = 3;

function setupModalDOM() {
    // createMinimalDOM() already includes itemModal and compareModal
    createMinimalDOM();
}

function openDetailModal(type, id) {
    const modal = document.getElementById('itemModal');
    const modalBody = document.getElementById('modalBody');

    if (!modal || !modalBody) return false;

    let data = null;
    switch (type) {
        case 'item':
            data = allData.items?.items?.find(i => i.id === id);
            break;
        case 'weapon':
            data = allData.weapons?.weapons?.find(w => w.id === id);
            break;
        case 'character':
            data = allData.characters?.characters?.find(c => c.id === id);
            break;
        case 'tome':
            data = allData.tomes?.tomes?.find(t => t.id === id);
            break;
        case 'shrine':
            data = allData.shrines?.shrines?.find(s => s.id === id);
            break;
    }

    if (!data) return false;

    modalBody.innerHTML = generateModalContent(type, data);
    modal.style.display = 'block';
    return true;
}

function generateModalContent(type, data) {
    let content = `<h2>${data.name}</h2>`;
    content += `<span class="badge tier-${data.tier}">${data.tier || 'N/A'} Tier</span>`;

    if (data.rarity) {
        content += `<span class="badge rarity">${data.rarity}</span>`;
    }

    // Item-specific fields
    if (type === 'item') {
        if (data.image) {
            content += `<img src="${data.image}" alt="${data.name}" class="modal-item-image">`;
        }
        if (data.one_and_done) {
            content += '<div class="one-and-done-warning">One-and-Done: Additional copies provide no benefit</div>';
        }
        if (data.max_stacks || (data.stack_cap && data.stack_cap <= 100)) {
            content += `<div class="stack-info">Stack Limit: ${data.max_stacks || data.stack_cap} stacks</div>`;
        }
        if (data.base_effect) {
            content += `<div class="effect"><strong>Effect:</strong> ${data.base_effect}</div>`;
        }
        // Support both description and detailed_description fields
        const itemDescription = data.detailed_description || data.description;
        if (itemDescription) {
            content += `<p class="description">${itemDescription}</p>`;
        }
        if (data.unlock_requirement) {
            content += `<div class="unlock"><strong>Unlock:</strong> ${data.unlock_requirement}</div>`;
        }
        if (data.synergies?.length) {
            content += `<div class="synergies-section"><h3>Synergies</h3>${data.synergies.map(s => `<span class="synergy-tag">${s}</span>`).join('')}</div>`;
        }
        if (data.anti_synergies?.length) {
            content += `<div class="anti-synergies-section"><h3>Anti-Synergies</h3>${data.anti_synergies.map(s => `<span class="antisynergy-tag">${s}</span>`).join('')}</div>`;
        }
    }

    // Character-specific fields
    if (type === 'character') {
        if (data.image) {
            content += `<img src="${data.image}" alt="${data.name}" class="modal-character-image">`;
        }
        if (data.passive_ability) {
            content += `<div class="character-passive"><strong>${data.passive_ability}</strong>`;
            if (data.passive_description) {
                content += `<p>${data.passive_description}</p>`;
            }
            content += '</div>';
        }
        // Character meta including starting weapon and stats
        const hasCharMeta = data.starting_weapon || data.base_hp || data.hp || data.base_damage || data.damage;
        if (hasCharMeta) {
            content += '<div class="character-meta">';
            if (data.starting_weapon) {
                content += `<div>Starting Weapon: ${data.starting_weapon}</div>`;
            }
            const charHp = data.base_hp || data.hp;
            const charDamage = data.base_damage || data.damage;
            if (charHp || charDamage) {
                content += '<div>';
                if (charHp) content += `HP: ${charHp}`;
                if (charHp && charDamage) content += ' | ';
                if (charDamage) content += `Damage: ${charDamage}`;
                content += '</div>';
            }
            content += '</div>';
        }
        if (data.best_for?.length) {
            content += `<div class="character-section"><h3>Best For</h3>${data.best_for.map(b => `<span class="meta-tag">${b}</span>`).join('')}</div>`;
        }
        if (data.strengths?.length || data.weaknesses?.length) {
            content += '<div class="strengths-weaknesses">';
            if (data.strengths?.length) {
                content += `<div class="strengths"><h4>Strengths</h4><ul>${data.strengths.map(s => `<li>${s}</li>`).join('')}</ul></div>`;
            }
            if (data.weaknesses?.length) {
                content += `<div class="weaknesses"><h4>Weaknesses</h4><ul>${data.weaknesses.map(w => `<li>${w}</li>`).join('')}</ul></div>`;
            }
            content += '</div>';
        }
        if (data.synergies_weapons?.length || data.synergies_items?.length || data.synergies_tomes?.length) {
            content += '<div class="synergies-section"><h3>Synergies</h3>';
            if (data.synergies_weapons?.length) {
                content += `<div class="synergy-group"><h4>Weapons</h4>${data.synergies_weapons.map(s => `<span class="synergy-tag">${s}</span>`).join('')}</div>`;
            }
            if (data.synergies_items?.length) {
                content += `<div class="synergy-group"><h4>Items</h4>${data.synergies_items.map(s => `<span class="synergy-tag">${s}</span>`).join('')}</div>`;
            }
            if (data.synergies_tomes?.length) {
                content += `<div class="synergy-group"><h4>Tomes</h4>${data.synergies_tomes.map(s => `<span class="synergy-tag">${s}</span>`).join('')}</div>`;
            }
            content += '</div>';
        }
        if (data.build_tips) {
            content += `<div class="build-tips"><h3>Build Tips</h3><p>${data.build_tips}</p></div>`;
        }
    }

    // Shrine-specific fields
    if (type === 'shrine') {
        if (data.icon) {
            content += `<span class="shrine-icon-modal">${data.icon}</span>`;
        }
        if (data.description) {
            content += `<div class="shrine-description-full"><p>${data.description}</p></div>`;
        }
        if (data.reward) {
            content += `<div class="shrine-detail-section"><strong>Reward</strong><p>${data.reward}</p></div>`;
        }
        if (data.strategy) {
            content += `<div class="shrine-strategy"><strong>Strategy</strong><p>${data.strategy}</p></div>`;
        }
        if (data.notes) {
            content += `<div class="item-notes">${data.notes}</div>`;
        }
    }

    // Weapon-specific fields (matching renderWeaponModal)
    if (type === 'weapon') {
        // Image
        if (data.image) {
            content += `<img src="${data.image}" alt="${data.name}" class="modal-weapon-image">`;
        }
        // Playstyle badge
        if (data.playstyle) {
            content += `<span class="badge">${data.playstyle}</span>`;
        }
        // Weapon stats section
        content += '<div class="weapon-stats-section">';
        if (data.base_damage) {
            content += `<div><strong>Base Damage:</strong> ${data.base_damage}`;
            if (data.base_projectile_count) {
                content += ` × ${data.base_projectile_count} projectiles`;
            }
            content += '</div>';
        }
        if (data.attack_pattern) {
            content += `<div><strong>Attack Pattern:</strong> ${data.attack_pattern}</div>`;
        }
        content += '</div>';
        // Description
        if (data.description) {
            content += `<p class="weapon-description">${data.description}</p>`;
        }
        // Best for section
        if (data.best_for?.length) {
            content += `<div class="weapon-section"><h3>Best For</h3><div class="tag-list">${data.best_for.map(b => `<span class="meta-tag">${b}</span>`).join('')}</div></div>`;
        }
        // Upgradeable stats section
        content += '<div class="weapon-section"><h3>Upgradeable Stats</h3>';
        if (Array.isArray(data.upgradeable_stats) && data.upgradeable_stats.length) {
            content += `<div class="tag-list">${data.upgradeable_stats.map(s => `<span class="meta-tag">${s}</span>`).join('')}</div>`;
        } else {
            content += '<span class="text-muted">None</span>';
        }
        content += '</div>';
        // Pros/Cons section
        if (data.pros?.length || data.cons?.length) {
            content += '<div class="strengths-weaknesses">';
            content += '<div class="strengths"><h4>Pros</h4><ul>';
            content += data.pros?.map(p => `<li>${p}</li>`).join('') || '<li>None listed</li>';
            content += '</ul></div>';
            content += '<div class="weaknesses"><h4>Cons</h4><ul>';
            content += data.cons?.map(c => `<li>${c}</li>`).join('') || '<li>None listed</li>';
            content += '</ul></div>';
            content += '</div>';
        }
        // Synergies section
        if (data.synergies_items?.length || data.synergies_tomes?.length || data.synergies_characters?.length) {
            content += '<div class="synergies-section"><h3>Synergies</h3>';
            if (data.synergies_items?.length) {
                content += `<div class="synergy-group"><h4>Items</h4><div class="synergy-list">${data.synergies_items.map(s => `<span class="synergy-tag">${s}</span>`).join('')}</div></div>`;
            }
            if (data.synergies_tomes?.length) {
                content += `<div class="synergy-group"><h4>Tomes</h4><div class="synergy-list">${data.synergies_tomes.map(s => `<span class="synergy-tag">${s}</span>`).join('')}</div></div>`;
            }
            if (data.synergies_characters?.length) {
                content += `<div class="synergy-group"><h4>Characters</h4><div class="synergy-list">${data.synergies_characters.map(s => `<span class="synergy-tag">${s}</span>`).join('')}</div></div>`;
            }
            content += '</div>';
        }
        // Build tips
        if (data.build_tips) {
            content += `<div class="build-tips"><h3>Build Tips</h3><p>${data.build_tips}</p></div>`;
        }
    }

    if (data.unlock_requirement) {
        content += `<div class="unlock"><strong>Unlock:</strong> ${data.unlock_requirement}</div>`;
    }

    return content;
}

function closeModal() {
    const itemModal = document.getElementById('itemModal');
    const compareModal = document.getElementById('compareModal');

    if (itemModal) itemModal.style.display = 'none';
    if (compareModal) compareModal.style.display = 'none';
}

function isModalOpen(modalId) {
    const modal = document.getElementById(modalId);
    return modal && modal.style.display === 'block';
}

function toggleCompareItem(itemId) {
    const index = compareItems.indexOf(itemId);

    if (index > -1) {
        // Remove item
        compareItems.splice(index, 1);
        return { action: 'removed', count: compareItems.length };
    }

    if (compareItems.length >= MAX_COMPARE_ITEMS) {
        return { action: 'max_reached', count: compareItems.length };
    }

    // Add item
    compareItems.push(itemId);
    return { action: 'added', count: compareItems.length };
}

function getCompareItems() {
    return [...compareItems];
}

function clearCompare() {
    compareItems = [];
    return compareItems.length;
}

function openCompareModal() {
    if (compareItems.length < 2) {
        return false;
    }

    const modal = document.getElementById('compareModal');
    const compareBody = document.getElementById('compareBody');

    if (!modal || !compareBody) return false;

    const items = compareItems.map(id => allData.items?.items?.find(i => i.id === id)).filter(Boolean);

    if (items.length < 2) return false;

    compareBody.innerHTML = generateCompareContent(items);
    modal.style.display = 'block';
    return true;
}

function generateCompareContent(items) {
    let content = '<div class="compare-grid">';

    items.forEach(item => {
        content += `
      <div class="compare-column">
        <h3>${item.name}</h3>
        <span class="badge">${item.tier || 'N/A'}</span>
        ${item.rarity ? `<span class="badge rarity">${item.rarity}</span>` : ''}
        ${item.base_effect ? `<p>${item.base_effect}</p>` : ''}
      </div>
    `;
    });

    content += '</div>';
    return content;
}

describe('Modal Management', () => {
    beforeEach(() => {
        setupModalDOM();
        allData = createMockAllData();
        // Add test-item-2 for compare modal tests
        allData.items.items.push(createMockItem({ id: 'test-item-2', name: 'Test Item 2' }));
        compareItems = [];
    });

    describe('openDetailModal()', () => {
        it('should open modal for item', () => {
            const result = openDetailModal('item', 'test-item');

            expect(result).toBe(true);
            expect(isModalOpen('itemModal')).toBe(true);
        });

        it('should open modal for weapon', () => {
            const result = openDetailModal('weapon', 'test-weapon');

            expect(result).toBe(true);
            expect(isModalOpen('itemModal')).toBe(true);
        });

        it('should open modal for character', () => {
            const result = openDetailModal('character', 'test-character');

            expect(result).toBe(true);
            expect(isModalOpen('itemModal')).toBe(true);
        });

        it('should open modal for tome', () => {
            const result = openDetailModal('tome', 'test-tome');

            expect(result).toBe(true);
            expect(isModalOpen('itemModal')).toBe(true);
        });

        it('should return false for invalid ID', () => {
            const result = openDetailModal('item', 'nonexistent');

            expect(result).toBe(false);
        });

        it('should return false for invalid type', () => {
            const result = openDetailModal('invalid', 'test-item');

            expect(result).toBe(false);
        });

        it('should populate modal body with content', () => {
            openDetailModal('item', 'test-item');

            const modalBody = document.getElementById('modalBody');
            expect(modalBody.innerHTML).toContain('Test Item');
        });
    });

    describe('generateModalContent()', () => {
        it('should include item name', () => {
            const item = createMockItem({ name: 'Power Ring' });
            const content = generateModalContent('item', item);

            expect(content).toContain('Power Ring');
        });

        it('should include tier badge', () => {
            const item = createMockItem({ tier: 'SS' });
            const content = generateModalContent('item', item);

            expect(content).toContain('SS');
            expect(content).toContain('badge');
        });

        it('should include rarity when present', () => {
            const item = createMockItem({ rarity: 'legendary' });
            const content = generateModalContent('item', item);

            expect(content).toContain('legendary');
        });

        it('should include description', () => {
            const item = createMockItem({ detailed_description: 'A powerful artifact that grants amazing abilities.' });
            const content = generateModalContent('item', item);

            expect(content).toContain('A powerful artifact that grants amazing abilities.');
        });

        it('should include base effect', () => {
            const item = createMockItem({ base_effect: '+10% damage' });
            const content = generateModalContent('item', item);

            expect(content).toContain('+10% damage');
            expect(content).toContain('Effect:');
        });

        it('should include stats for weapons', () => {
            const weapon = createMockWeapon({ base_damage: 50, attack_pattern: 'Triple shot' });
            const content = generateModalContent('weapon', weapon);

            expect(content).toContain('Base Damage');
            expect(content).toContain('50');
            expect(content).toContain('Attack Pattern');
            expect(content).toContain('Triple shot');
        });

        it('should include stats for characters', () => {
            const character = createMockCharacter({ hp: 100, damage: 15 });
            const content = generateModalContent('character', character);

            expect(content).toContain('HP: 100');
            expect(content).toContain('Damage: 15');
        });

        it('should include unlock requirement', () => {
            const item = createMockItem({ unlock_requirement: 'Complete level 10' });
            const content = generateModalContent('item', item);

            expect(content).toContain('Complete level 10');
            expect(content).toContain('Unlock:');
        });
    });

    describe('closeModal()', () => {
        it('should close item modal', () => {
            openDetailModal('item', 'test-item');
            expect(isModalOpen('itemModal')).toBe(true);

            closeModal();
            expect(isModalOpen('itemModal')).toBe(false);
        });

        it('should close compare modal', () => {
            // Setup and open compare modal
            toggleCompareItem('test-item');
            toggleCompareItem('test-item-2');
            openCompareModal();
            expect(isModalOpen('compareModal')).toBe(true);

            closeModal();
            expect(isModalOpen('compareModal')).toBe(false);
        });

        it('should close both modals if both open', () => {
            openDetailModal('item', 'test-item');

            closeModal();

            expect(isModalOpen('itemModal')).toBe(false);
            expect(isModalOpen('compareModal')).toBe(false);
        });
    });
});

describe('Compare Functionality', () => {
    beforeEach(() => {
        setupModalDOM();
        allData = createMockAllData();
        // Add additional items for comparison
        allData.items.items.push(
            createMockItem({ id: 'test-item-2', name: 'Test Item 2' }),
            createMockItem({ id: 'test-item-3', name: 'Test Item 3' }),
            createMockItem({ id: 'test-item-4', name: 'Test Item 4' })
        );
        compareItems = [];
    });

    describe('toggleCompareItem()', () => {
        it('should add item to compare list', () => {
            const result = toggleCompareItem('test-item');

            expect(result.action).toBe('added');
            expect(result.count).toBe(1);
            expect(getCompareItems()).toContain('test-item');
        });

        it('should remove item from compare list', () => {
            toggleCompareItem('test-item');
            const result = toggleCompareItem('test-item');

            expect(result.action).toBe('removed');
            expect(result.count).toBe(0);
            expect(getCompareItems()).not.toContain('test-item');
        });

        it('should not exceed max items', () => {
            toggleCompareItem('test-item');
            toggleCompareItem('test-item-2');
            toggleCompareItem('test-item-3');
            const result = toggleCompareItem('test-item-4');

            expect(result.action).toBe('max_reached');
            expect(result.count).toBe(3);
            expect(getCompareItems()).not.toContain('test-item-4');
        });

        it('should allow adding after removing', () => {
            toggleCompareItem('test-item');
            toggleCompareItem('test-item-2');
            toggleCompareItem('test-item-3');

            // Remove one
            toggleCompareItem('test-item-2');

            // Should now be able to add another
            const result = toggleCompareItem('test-item-4');
            expect(result.action).toBe('added');
            expect(result.count).toBe(3);
        });
    });

    describe('getCompareItems()', () => {
        it('should return empty array initially', () => {
            expect(getCompareItems()).toEqual([]);
        });

        it('should return copy of compare items', () => {
            toggleCompareItem('test-item');
            toggleCompareItem('test-item-2');

            const items = getCompareItems();
            items.push('fake-item');

            // Original should be unchanged
            expect(getCompareItems()).toEqual(['test-item', 'test-item-2']);
        });
    });

    describe('clearCompare()', () => {
        it('should clear all compare items', () => {
            toggleCompareItem('test-item');
            toggleCompareItem('test-item-2');
            toggleCompareItem('test-item-3');

            const result = clearCompare();

            expect(result).toBe(0);
            expect(getCompareItems()).toEqual([]);
        });

        it('should return 0 when already empty', () => {
            const result = clearCompare();
            expect(result).toBe(0);
        });
    });

    describe('openCompareModal()', () => {
        it('should not open with less than 2 items', () => {
            toggleCompareItem('test-item');

            const result = openCompareModal();

            expect(result).toBe(false);
            expect(isModalOpen('compareModal')).toBe(false);
        });

        it('should open with 2 items', () => {
            toggleCompareItem('test-item');
            toggleCompareItem('test-item-2');

            const result = openCompareModal();

            expect(result).toBe(true);
            expect(isModalOpen('compareModal')).toBe(true);
        });

        it('should open with 3 items', () => {
            toggleCompareItem('test-item');
            toggleCompareItem('test-item-2');
            toggleCompareItem('test-item-3');

            const result = openCompareModal();

            expect(result).toBe(true);
        });

        it('should populate compare body', () => {
            toggleCompareItem('test-item');
            toggleCompareItem('test-item-2');
            openCompareModal();

            const compareBody = document.getElementById('compareBody');
            expect(compareBody.innerHTML).toContain('compare-column');
        });
    });

    describe('generateCompareContent()', () => {
        it('should create columns for each item', () => {
            const items = [createMockItem({ name: 'Item A' }), createMockItem({ name: 'Item B' })];

            const content = generateCompareContent(items);

            expect(content).toContain('Item A');
            expect(content).toContain('Item B');
            expect((content.match(/compare-column/g) || []).length).toBe(2);
        });

        it('should include tier for each item', () => {
            const items = [
                createMockItem({ name: 'Item A', tier: 'SS' }),
                createMockItem({ name: 'Item B', tier: 'S' }),
            ];

            const content = generateCompareContent(items);

            expect(content).toContain('SS');
            expect(content).toContain('S');
        });

        it('should include rarity when present', () => {
            const items = [
                createMockItem({ name: 'Item A', rarity: 'legendary' }),
                createMockItem({ name: 'Item B', rarity: 'epic' }),
            ];

            const content = generateCompareContent(items);

            expect(content).toContain('legendary');
            expect(content).toContain('epic');
        });

        it('should include base effect', () => {
            const items = [
                createMockItem({ name: 'Item A', base_effect: 'Effect A' }),
                createMockItem({ name: 'Item B', base_effect: 'Effect B' }),
            ];

            const content = generateCompareContent(items);

            expect(content).toContain('Effect A');
            expect(content).toContain('Effect B');
        });
    });
});

describe('Modal Edge Cases', () => {
    beforeEach(() => {
        setupModalDOM();
        allData = createMockAllData();
        compareItems = [];
    });

    it('should handle missing modal elements gracefully', () => {
        document.getElementById('itemModal').remove();

        const result = openDetailModal('item', 'test-item');
        expect(result).toBe(false);
    });

    it('should handle missing modal body gracefully', () => {
        document.getElementById('modalBody').remove();

        const result = openDetailModal('item', 'test-item');
        expect(result).toBe(false);
    });

    it('should handle empty allData', () => {
        allData = {};

        const result = openDetailModal('item', 'test-item');
        expect(result).toBe(false);
    });

    it('should handle reopening modal with different item', () => {
        openDetailModal('item', 'test-item');
        const firstContent = document.getElementById('modalBody').innerHTML;

        // Add another item and reopen
        allData.items.items.push(createMockItem({ id: 'second-item', name: 'Second Item' }));
        openDetailModal('item', 'second-item');
        const secondContent = document.getElementById('modalBody').innerHTML;

        expect(firstContent).not.toEqual(secondContent);
        expect(secondContent).toContain('Second Item');
    });

    it('should handle rapid open/close cycles', () => {
        for (let i = 0; i < 10; i++) {
            openDetailModal('item', 'test-item');
            closeModal();
        }

        expect(isModalOpen('itemModal')).toBe(false);
    });
});

describe('Item Modal Content', () => {
    beforeEach(() => {
        setupModalDOM();
        allData = createMockAllData();
    });

    it('should display anti_synergies when present', () => {
        allData.items.items.push(
            createMockItem({
                id: 'anti-syn-item',
                name: 'Anti-Synergy Item',
                anti_synergies: ['Beer', 'Poison Flask'],
            })
        );

        openDetailModal('item', 'anti-syn-item');
        const content = document.getElementById('modalBody').innerHTML;

        expect(content).toContain('Anti-Synergies');
        expect(content).toContain('Beer');
        expect(content).toContain('Poison Flask');
    });

    it('should display one_and_done warning', () => {
        allData.items.items.push(
            createMockItem({
                id: 'one-done-item',
                name: 'One-and-Done Item',
                one_and_done: true,
            })
        );

        openDetailModal('item', 'one-done-item');
        const content = document.getElementById('modalBody').innerHTML;

        expect(content).toContain('One-and-Done');
        expect(content).toContain('no benefit');
    });

    it('should display max_stacks info', () => {
        allData.items.items.push(
            createMockItem({
                id: 'max-stack-item',
                name: 'Max Stack Item',
                max_stacks: 10,
            })
        );

        openDetailModal('item', 'max-stack-item');
        const content = document.getElementById('modalBody').innerHTML;

        expect(content).toContain('Stack Limit');
        expect(content).toContain('10');
    });

    it('should display stack_cap as fallback', () => {
        allData.items.items.push(
            createMockItem({
                id: 'stack-cap-item',
                name: 'Stack Cap Item',
                stack_cap: 5,
            })
        );

        openDetailModal('item', 'stack-cap-item');
        const content = document.getElementById('modalBody').innerHTML;

        expect(content).toContain('Stack Limit');
        expect(content).toContain('5');
    });

    it('should display synergies when present', () => {
        allData.items.items.push(
            createMockItem({
                id: 'synergy-item',
                name: 'Synergy Item',
                synergies: ['Test Weapon', 'Test Item'],
            })
        );

        openDetailModal('item', 'synergy-item');
        const content = document.getElementById('modalBody').innerHTML;

        expect(content).toContain('Synergies');
        expect(content).toContain('Test Weapon');
    });
});

describe('Weapon Modal', () => {
    beforeEach(() => {
        setupModalDOM();
        allData = createMockAllData();
    });

    it('should render weapon modal content', () => {
        const result = openDetailModal('weapon', 'test-weapon');

        expect(result).toBe(true);
        const modalBody = document.getElementById('modalBody');
        expect(modalBody.innerHTML).toContain('Test Weapon');
    });

    it('should display weapon tier badge', () => {
        allData.weapons.weapons.push(
            createMockWeapon({
                id: 'tier-weapon',
                name: 'Tier Weapon',
                tier: 'SS',
            })
        );

        openDetailModal('weapon', 'tier-weapon');
        const content = document.getElementById('modalBody').innerHTML;

        expect(content).toContain('SS');
        expect(content).toContain('badge');
    });

    it('should display weapon base damage', () => {
        allData.weapons.weapons.push(
            createMockWeapon({
                id: 'dmg-weapon',
                name: 'Damage Weapon',
                base_damage: 25,
            })
        );

        openDetailModal('weapon', 'dmg-weapon');
        const content = document.getElementById('modalBody').innerHTML;

        expect(content).toContain('Base Damage');
        expect(content).toContain('25');
    });

    it('should display weapon attack pattern', () => {
        allData.weapons.weapons.push(
            createMockWeapon({
                id: 'pattern-weapon',
                name: 'Pattern Weapon',
                attack_pattern: 'Multi-shot burst',
            })
        );

        openDetailModal('weapon', 'pattern-weapon');
        const content = document.getElementById('modalBody').innerHTML;

        expect(content).toContain('Attack Pattern');
        expect(content).toContain('Multi-shot burst');
    });

    it('should display weapon projectile count when available', () => {
        allData.weapons.weapons.push(
            createMockWeapon({
                id: 'projectile-weapon',
                name: 'Projectile Weapon',
                base_damage: 5,
                base_projectile_count: 6,
            })
        );

        openDetailModal('weapon', 'projectile-weapon');
        const content = document.getElementById('modalBody').innerHTML;

        expect(content).toContain('6 projectiles');
    });

    it('should display weapon playstyle badge', () => {
        allData.weapons.weapons.push(
            createMockWeapon({
                id: 'playstyle-weapon',
                name: 'Playstyle Weapon',
                playstyle: 'Rapid-fire shredder',
            })
        );

        openDetailModal('weapon', 'playstyle-weapon');
        const content = document.getElementById('modalBody').innerHTML;

        expect(content).toContain('Rapid-fire shredder');
        expect(content).toContain('badge');
    });

    it('should display weapon best_for', () => {
        allData.weapons.weapons.push(
            createMockWeapon({
                id: 'bestfor-weapon',
                name: 'BestFor Weapon',
                best_for: ['Crit builds', 'Boss killing'],
            })
        );

        openDetailModal('weapon', 'bestfor-weapon');
        const content = document.getElementById('modalBody').innerHTML;

        expect(content).toContain('Best For');
        expect(content).toContain('Crit builds');
        expect(content).toContain('Boss killing');
    });

    it('should display weapon upgradeable stats as tags', () => {
        allData.weapons.weapons.push(
            createMockWeapon({
                id: 'upgrade-weapon',
                name: 'Upgrade Weapon',
                upgradeable_stats: ['Damage', 'Crit Chance', 'Projectile Count'],
            })
        );

        openDetailModal('weapon', 'upgrade-weapon');
        const content = document.getElementById('modalBody').innerHTML;

        expect(content).toContain('Upgradeable Stats');
        expect(content).toContain('Damage');
        expect(content).toContain('Crit Chance');
        expect(content).toContain('meta-tag');
    });

    it('should display weapon pros and cons', () => {
        allData.weapons.weapons.push(
            createMockWeapon({
                id: 'proscons-weapon',
                name: 'ProsCons Weapon',
                pros: ['High damage', 'Fast attack speed'],
                cons: ['Low range', 'Hard to aim'],
            })
        );

        openDetailModal('weapon', 'proscons-weapon');
        const content = document.getElementById('modalBody').innerHTML;

        expect(content).toContain('Pros');
        expect(content).toContain('High damage');
        expect(content).toContain('Cons');
        expect(content).toContain('Low range');
    });

    it('should display weapon synergies grouped by type', () => {
        allData.weapons.weapons.push(
            createMockWeapon({
                id: 'synergy-weapon',
                name: 'Synergy Weapon',
                synergies_items: ['Beefy Ring', 'Gym Sauce'],
                synergies_tomes: ['Damage', 'Precision'],
                synergies_characters: ['CL4NK', 'Bush'],
            })
        );

        openDetailModal('weapon', 'synergy-weapon');
        const content = document.getElementById('modalBody').innerHTML;

        expect(content).toContain('Synergies');
        expect(content).toContain('Items');
        expect(content).toContain('Beefy Ring');
        expect(content).toContain('Tomes');
        expect(content).toContain('Damage');
        expect(content).toContain('Characters');
        expect(content).toContain('CL4NK');
    });

    it('should display weapon build tips', () => {
        allData.weapons.weapons.push(
            createMockWeapon({
                id: 'tips-weapon',
                name: 'Tips Weapon',
                build_tips: 'Stack crit for maximum damage',
            })
        );

        openDetailModal('weapon', 'tips-weapon');
        const content = document.getElementById('modalBody').innerHTML;

        expect(content).toContain('Build Tips');
        expect(content).toContain('Stack crit');
    });

    it('should display weapon unlock requirement', () => {
        allData.weapons.weapons.push(
            createMockWeapon({
                id: 'unlock-weapon',
                name: 'Unlock Weapon',
                unlock_requirement: 'Kill 5000 enemies',
            })
        );

        openDetailModal('weapon', 'unlock-weapon');
        const content = document.getElementById('modalBody').innerHTML;

        expect(content).toContain('Unlock');
        expect(content).toContain('Kill 5000 enemies');
    });

    it('should display weapon image when present', () => {
        allData.weapons.weapons.push(
            createMockWeapon({
                id: 'img-weapon',
                name: 'Image Weapon',
                image: 'images/weapons/test.png',
            })
        );

        openDetailModal('weapon', 'img-weapon');
        const content = document.getElementById('modalBody').innerHTML;

        expect(content).toContain('images/weapons/test.png');
        expect(content).toContain('img');
    });

    it('should handle missing optional fields gracefully', () => {
        allData.weapons.weapons.push(
            createMockWeapon({
                id: 'minimal-weapon',
                name: 'Minimal Weapon',
                tier: 'A',
                base_damage: 10,
                attack_pattern: 'Single shot',
                upgradeable_stats: [],
                description: 'A basic weapon',
                // No optional fields: best_for, synergies_*, pros, cons, build_tips, playstyle, image
                best_for: undefined,
                synergies_items: undefined,
                synergies_tomes: undefined,
                synergies_characters: undefined,
                pros: undefined,
                cons: undefined,
                build_tips: undefined,
                playstyle: undefined,
                image: undefined,
            })
        );

        openDetailModal('weapon', 'minimal-weapon');
        const content = document.getElementById('modalBody').innerHTML;

        // Should still render basic content
        expect(content).toContain('Minimal Weapon');
        expect(content).toContain('A basic weapon');
        expect(content).toContain('10');
        // Should not throw errors
    });
});

describe('Character Modal', () => {
    beforeEach(() => {
        setupModalDOM();
        allData = createMockAllData();
    });

    it('should render character modal content', () => {
        const result = openDetailModal('character', 'test-character');

        expect(result).toBe(true);
        const modalBody = document.getElementById('modalBody');
        expect(modalBody.innerHTML).toContain('Test Character');
    });

    it('should display passive ability and description', () => {
        allData.characters.characters.push(
            createMockCharacter({
                id: 'passive-char',
                name: 'Passive Character',
                passive_ability: 'Super Passive',
                passive_description: 'This is a super passive ability',
            })
        );

        openDetailModal('character', 'passive-char');
        const content = document.getElementById('modalBody').innerHTML;

        expect(content).toContain('Super Passive');
        expect(content).toContain('This is a super passive ability');
    });

    it('should display strengths and weaknesses', () => {
        allData.characters.characters.push(
            createMockCharacter({
                id: 'str-weak-char',
                name: 'Strengths Weaknesses Character',
                strengths: ['Strong 1', 'Strong 2'],
                weaknesses: ['Weak 1'],
            })
        );

        openDetailModal('character', 'str-weak-char');
        const content = document.getElementById('modalBody').innerHTML;

        expect(content).toContain('Strengths');
        expect(content).toContain('Strong 1');
        expect(content).toContain('Weaknesses');
        expect(content).toContain('Weak 1');
    });

    it('should display synergies for weapons, items, and tomes', () => {
        allData.characters.characters.push(
            createMockCharacter({
                id: 'synergy-char',
                name: 'Synergy Character',
                synergies_weapons: ['Sword'],
                synergies_items: ['Beefy Ring'],
                synergies_tomes: ['Damage'],
            })
        );

        openDetailModal('character', 'synergy-char');
        const content = document.getElementById('modalBody').innerHTML;

        expect(content).toContain('Sword');
        expect(content).toContain('Beefy Ring');
        expect(content).toContain('Damage');
    });

    it('should display build_tips', () => {
        allData.characters.characters.push(
            createMockCharacter({
                id: 'tips-char',
                name: 'Tips Character',
                build_tips: 'Stack damage for maximum effect',
            })
        );

        openDetailModal('character', 'tips-char');
        const content = document.getElementById('modalBody').innerHTML;

        expect(content).toContain('Build Tips');
        expect(content).toContain('Stack damage');
    });

    it('should display best_for', () => {
        allData.characters.characters.push(
            createMockCharacter({
                id: 'best-for-char',
                name: 'Best For Character',
                best_for: ['Tank builds', 'Beginners'],
            })
        );

        openDetailModal('character', 'best-for-char');
        const content = document.getElementById('modalBody').innerHTML;

        expect(content).toContain('Best For');
        expect(content).toContain('Tank builds');
    });
});

describe('Shrine Modal', () => {
    beforeEach(() => {
        setupModalDOM();
        allData = createMockAllData();
    });

    it('should open shrine modal', () => {
        const result = openDetailModal('shrine', 'test-shrine');

        expect(result).toBe(true);
        expect(isModalOpen('itemModal')).toBe(true);
    });

    it('should display shrine icon', () => {
        openDetailModal('shrine', 'test-shrine');
        const content = document.getElementById('modalBody').innerHTML;

        expect(content).toContain('shrine-icon-modal');
    });

    it('should display shrine reward', () => {
        allData.shrines.shrines.push(
            createMockShrine({
                id: 'reward-shrine',
                name: 'Reward Shrine',
                reward: 'Amazing reward effect',
            })
        );

        openDetailModal('shrine', 'reward-shrine');
        const content = document.getElementById('modalBody').innerHTML;

        expect(content).toContain('Reward');
        expect(content).toContain('Amazing reward effect');
    });

    it('should display shrine strategy', () => {
        allData.shrines.shrines.push(
            createMockShrine({
                id: 'strategy-shrine',
                name: 'Strategy Shrine',
                strategy: 'Use when strong',
            })
        );

        openDetailModal('shrine', 'strategy-shrine');
        const content = document.getElementById('modalBody').innerHTML;

        expect(content).toContain('Strategy');
        expect(content).toContain('Use when strong');
    });

    it('should display shrine notes', () => {
        allData.shrines.shrines.push(
            createMockShrine({
                id: 'notes-shrine',
                name: 'Notes Shrine',
                notes: 'Important note here',
            })
        );

        openDetailModal('shrine', 'notes-shrine');
        const content = document.getElementById('modalBody').innerHTML;

        expect(content).toContain('Important note here');
    });
});

describe('View Details Consistency Across Tabs', () => {
    beforeEach(() => {
        setupModalDOM();
        allData = createMockAllData();
    });

    it('should render tier badge for items, weapons, characters, and tomes', () => {
        // Item
        openDetailModal('item', 'test-item');
        let content = document.getElementById('modalBody').innerHTML;
        expect(content).toContain('badge');
        expect(content).toContain('Tier');

        // Weapon
        openDetailModal('weapon', 'test-weapon');
        content = document.getElementById('modalBody').innerHTML;
        expect(content).toContain('badge');
        expect(content).toContain('Tier');

        // Character
        openDetailModal('character', 'test-character');
        content = document.getElementById('modalBody').innerHTML;
        expect(content).toContain('badge');
        expect(content).toContain('Tier');

        // Tome
        openDetailModal('tome', 'test-tome');
        content = document.getElementById('modalBody').innerHTML;
        expect(content).toContain('badge');
        expect(content).toContain('Tier');
    });

    it('should render entity name for all entity types', () => {
        const entities = [
            { type: 'item', id: 'test-item', name: 'Test Item' },
            { type: 'weapon', id: 'test-weapon', name: 'Test Weapon' },
            { type: 'character', id: 'test-character', name: 'Test Character' },
            { type: 'tome', id: 'test-tome', name: 'Test Tome' },
            { type: 'shrine', id: 'test-shrine', name: 'Test Shrine' },
        ];

        entities.forEach(({ type, id, name }) => {
            openDetailModal(type, id);
            const content = document.getElementById('modalBody').innerHTML;
            expect(content).toContain(name);
        });
    });

    it('should render description for all entity types that have one', () => {
        // Items use detailed_description
        allData.items.items.push(
            createMockItem({
                id: 'desc-item',
                name: 'Desc Item',
                detailed_description: 'Item description here',
            })
        );
        openDetailModal('item', 'desc-item');
        let content = document.getElementById('modalBody').innerHTML;
        expect(content).toContain('Item description here');

        // Weapons
        allData.weapons.weapons.push(
            createMockWeapon({
                id: 'desc-weapon',
                name: 'Desc Weapon',
                description: 'Weapon description here',
            })
        );
        openDetailModal('weapon', 'desc-weapon');
        content = document.getElementById('modalBody').innerHTML;
        expect(content).toContain('Weapon description here');

        // Characters have passive_description
        allData.characters.characters.push(
            createMockCharacter({
                id: 'desc-char',
                name: 'Desc Character',
                passive_description: 'Character passive description',
            })
        );
        openDetailModal('character', 'desc-char');
        content = document.getElementById('modalBody').innerHTML;
        expect(content).toContain('Character passive description');

        // Shrines
        allData.shrines.shrines.push(
            createMockShrine({
                id: 'desc-shrine',
                name: 'Desc Shrine',
                description: 'Shrine description here',
            })
        );
        openDetailModal('shrine', 'desc-shrine');
        content = document.getElementById('modalBody').innerHTML;
        expect(content).toContain('Shrine description here');
    });

    it('should render synergies section consistently for weapons and characters', () => {
        // Weapon with synergies
        allData.weapons.weapons.push(
            createMockWeapon({
                id: 'syn-weapon',
                name: 'Synergy Weapon',
                synergies_items: ['Test Item'],
                synergies_tomes: ['Damage'],
            })
        );
        openDetailModal('weapon', 'syn-weapon');
        let content = document.getElementById('modalBody').innerHTML;
        expect(content).toContain('synergies-section');
        expect(content).toContain('synergy-group');

        // Character with synergies
        allData.characters.characters.push(
            createMockCharacter({
                id: 'syn-char',
                name: 'Synergy Character',
                synergies_weapons: ['Test Weapon'],
                synergies_items: ['Test Item'],
            })
        );
        openDetailModal('character', 'syn-char');
        content = document.getElementById('modalBody').innerHTML;
        expect(content).toContain('synergies-section');
        expect(content).toContain('synergy-group');
    });

    it('should render unlock requirement for entities that have one', () => {
        // Item with unlock
        allData.items.items.push(
            createMockItem({
                id: 'unlock-item',
                name: 'Unlock Item',
                unlock_requirement: 'Defeat 100 bosses',
            })
        );
        openDetailModal('item', 'unlock-item');
        let content = document.getElementById('modalBody').innerHTML;
        expect(content).toContain('Unlock');
        expect(content).toContain('Defeat 100 bosses');

        // Weapon with unlock
        allData.weapons.weapons.push(
            createMockWeapon({
                id: 'unlock-weapon',
                name: 'Unlock Weapon',
                unlock_requirement: 'Reach level 50',
            })
        );
        openDetailModal('weapon', 'unlock-weapon');
        content = document.getElementById('modalBody').innerHTML;
        expect(content).toContain('Unlock');
        expect(content).toContain('Reach level 50');
    });

    it('should not render empty sections when data is missing', () => {
        // Weapon without optional fields
        allData.weapons.weapons.push(
            createMockWeapon({
                id: 'empty-weapon',
                name: 'Empty Weapon',
                tier: 'A',
                base_damage: 10,
                attack_pattern: 'Basic',
                upgradeable_stats: ['Damage'],
                description: 'Basic weapon',
                // Explicitly set optional fields to undefined/empty
                best_for: [],
                synergies_items: [],
                synergies_tomes: [],
                synergies_characters: [],
                pros: [],
                cons: [],
                build_tips: undefined,
            })
        );
        openDetailModal('weapon', 'empty-weapon');
        const content = document.getElementById('modalBody').innerHTML;

        // Should not have synergies section when empty
        expect(content).not.toContain('synergies-section');
        // Should not have strengths-weaknesses section when no pros/cons
        expect(content).not.toContain('strengths-weaknesses');
        // Should not have build-tips section when undefined
        expect(content).not.toContain('build-tips');
    });
});
