// ========================================
// Tab Content Renderer (Orchestrator)
// ========================================

import { safeGetElementById } from '../utils.ts';
import { getDataForTab, allData } from '../data-service.ts';
import type { AllGameData } from '../../types/index.ts';
import { filterData } from '../filters.ts';
import { setState } from '../store.ts';
import { registerFunction } from '../registry.ts';
import type { Entity, ChangelogPatch } from '../../types/index.ts';

import { updateStats } from './common.ts';
import { renderItems } from './items.ts';
import { renderWeapons } from './weapons.ts';
import { renderTomes } from './tomes.ts';
import { renderCharacters } from './characters.ts';
import { renderShrines } from './shrines.ts';
import { renderGlobalSearchResults } from './global-search.ts';
import type { Item, Weapon, Tome, Character, Shrine } from './types.ts';

// NOTE: Calculator button listener tracking moved to data attribute on element
// to properly handle DOM recreation scenarios

/**
 * Render content for the current tab
 * Uses dynamic imports for tab-specific modules to enable code splitting
 * @param {string} tabName - Tab to render
 */
export async function renderTabContent(tabName: string): Promise<void> {
    if (tabName === 'build-planner') {
        const { renderBuildPlanner } = await import('../build-planner.ts');
        renderBuildPlanner();
        // Initialize screenshot import feature
        const { initBuildPlannerScan } = await import('../build-planner-scan.ts');
        initBuildPlannerScan(allData as AllGameData);
        return;
    }

    if (tabName === 'calculator') {
        const { populateCalculatorItems, calculateBreakpoint } = await import('../calculator.ts');
        populateCalculatorItems();
        // Use data attribute to track listener on the actual element
        // This handles DOM recreation scenarios (HMR, re-renders) correctly
        const calcBtn = safeGetElementById('calc-button');
        if (calcBtn && !calcBtn.dataset.listenerAttached) {
            calcBtn.addEventListener('click', calculateBreakpoint);
            calcBtn.dataset.listenerAttached = 'true';
        }
        return;
    }

    if (tabName === 'changelog') {
        const { updateChangelogStats, renderChangelog } = await import('../changelog.ts');
        const data = getDataForTab(tabName) as ChangelogPatch[];
        // filterData works with any array having name/description fields
        const filtered = filterData(data as unknown as Entity[], tabName) as unknown as ChangelogPatch[];
        setState('filteredData', filtered as unknown as Entity[]);
        updateChangelogStats(filtered);
        renderChangelog(filtered);
        return;
    }

    if (tabName === 'about') {
        const { renderAbout, updateAboutStats } = await import('../about.ts');
        updateAboutStats();
        renderAbout();
        return;
    }

    const data = getDataForTab(tabName) as Entity[];
    if (!data) return;

    const filtered = filterData(data, tabName);
    setState('filteredData', filtered);

    updateStats(filtered, tabName);

    // Render based on type
    switch (tabName) {
        case 'items':
            await renderItems(filtered as Item[]);
            break;
        case 'weapons':
            renderWeapons(filtered as Weapon[]);
            break;
        case 'tomes':
            renderTomes(filtered as Tome[]);
            break;
        case 'characters':
            renderCharacters(filtered as Character[]);
            break;
        case 'shrines':
            renderShrines(filtered as Shrine[]);
            break;
    }
}

// ========================================
// Registry & Global Assignments
// ========================================
// Register renderTabContent for type-safe cross-module access
registerFunction('renderTabContent', renderTabContent);
// Keep window assignment for backwards compatibility during migration
if (typeof window !== 'undefined') {
    // Type assertions: functions use specific types but window uses generic types for flexibility
    window.renderTabContent = renderTabContent as typeof window.renderTabContent;
    window.renderGlobalSearchResults = renderGlobalSearchResults as typeof window.renderGlobalSearchResults;
}
