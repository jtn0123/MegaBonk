import { describe, it, expect, beforeEach } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';
import { showTabSkeleton, hideTabSkeleton, isShowingSkeleton } from '../../src/modules/skeleton-loader.ts';

describe('Skeleton Loading for All Tabs', () => {
    beforeEach(() => {
        createMinimalDOM();
        // Add containers not present in minimal DOM
        const containers = [
            'charactersContainer',
            'shrinesContainer',
            'buildPlannerContainer',
            'calculator-tab',
            'advisor-tab',
        ];
        for (const id of containers) {
            if (!document.getElementById(id)) {
                const el = document.createElement('div');
                el.id = id;
                document.body.appendChild(el);
            }
        }
    });

    const allTabs = [
        { tab: 'items', containerId: 'itemsContainer' },
        { tab: 'weapons', containerId: 'weaponsContainer' },
        { tab: 'tomes', containerId: 'tomesContainer' },
        { tab: 'characters', containerId: 'charactersContainer' },
        { tab: 'shrines', containerId: 'shrinesContainer' },
        { tab: 'build-planner', containerId: 'buildPlannerContainer' },
        { tab: 'calculator', containerId: 'calculator-tab' },
        { tab: 'advisor', containerId: 'advisor-tab' },
    ];

    for (const { tab, containerId } of allTabs) {
        it(`should show and hide skeleton for ${tab} tab`, () => {
            showTabSkeleton(tab);
            expect(isShowingSkeleton(containerId)).toBe(true);
            expect(document.getElementById(containerId)?.getAttribute('aria-busy')).toBe('true');

            hideTabSkeleton(tab);
            expect(isShowingSkeleton(containerId)).toBe(false);
            expect(document.getElementById(containerId)?.getAttribute('aria-busy')).toBeNull();
        });
    }
});
