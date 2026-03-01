import { describe, it, expect, beforeEach } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';
import { showTabSkeleton, hideTabSkeleton, isShowingSkeleton } from '../../src/modules/skeleton-loader.ts';

describe('Skeleton Loading for All Data Tabs', () => {
    beforeEach(() => {
        createMinimalDOM();
        // Add containers not present in minimal DOM
        for (const id of ['charactersContainer', 'shrinesContainer']) {
            if (!document.getElementById(id)) {
                const el = document.createElement('div');
                el.id = id;
                document.body.appendChild(el);
            }
        }
    });

    const dataTabs = [
        { tab: 'items', containerId: 'itemsContainer' },
        { tab: 'weapons', containerId: 'weaponsContainer' },
        { tab: 'tomes', containerId: 'tomesContainer' },
        { tab: 'characters', containerId: 'charactersContainer' },
        { tab: 'shrines', containerId: 'shrinesContainer' },
    ];

    for (const { tab, containerId } of dataTabs) {
        it(`should show and hide skeleton for ${tab} tab`, () => {
            showTabSkeleton(tab);
            expect(isShowingSkeleton(containerId)).toBe(true);
            expect(document.getElementById(containerId)?.getAttribute('aria-busy')).toBe('true');

            hideTabSkeleton(tab);
            expect(isShowingSkeleton(containerId)).toBe(false);
            expect(document.getElementById(containerId)?.getAttribute('aria-busy')).toBeNull();
        });
    }

    it('should gracefully skip skeleton for static-content tabs', () => {
        // Static-content tabs (build-planner, calculator, advisor) have
        // pre-rendered HTML that should not be replaced by skeletons.
        // showTabSkeleton is a no-op for tabs not in the container map.
        for (const tab of ['build-planner', 'calculator', 'advisor']) {
            const container = document.createElement('div');
            container.id = `${tab}-container`;
            container.innerHTML = '<p>Static content</p>';
            document.body.appendChild(container);

            showTabSkeleton(tab);

            // Content should be preserved (no skeleton injected)
            expect(container.innerHTML).toBe('<p>Static content</p>');
            expect(isShowingSkeleton(`${tab}-container`)).toBe(false);
        }
    });
});
