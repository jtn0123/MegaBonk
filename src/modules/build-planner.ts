// ========================================
// MegaBonk Build Planner Module
// Main entry point - orchestrates stats, validation, and UI
// ========================================

import type { Character, Weapon, Tome, Item } from '../types/index.ts';
import { ToastManager } from './toast.ts';
import { allData } from './data-service.ts';
import { MAX_BUILD_HISTORY } from './constants.ts';
import { logger } from './logger.ts';
import { getState, setState, type Build } from './store.ts';

// Import from sub-modules
import {
    calculateBuildStats as calculateBuildStatsFromModule,
    invalidateBuildStatsCache,
    type CalculatedBuildStats,
} from './build-stats.ts';
import {
    isValidBuildEntry,
    isValidBase64,
    isValidURLBuildData,
    type BuildData,
    type URLBuildData,
} from './build-validation.ts';
import {
    renderBuildPlanner as renderUI,
    updateBuildDisplay,
    setupBuildPlannerEvents as setupUIEvents,
    setupSelectionListeners,
    setCharacterSelection,
    setWeaponSelection,
    setTomeCheckboxes,
    setItemCheckboxes,
    clearAllSelections,
    getSelectedTomeIds,
    getSelectedItemIds,
    copyToClipboard,
} from './build-ui.ts';

// Re-export types for backwards compatibility
export type { Build } from './store.ts';
export type { BuildData, URLBuildData } from './build-validation.ts';
export type { CalculatedBuildStats } from './build-stats.ts';
export { invalidateBuildStatsCache } from './build-stats.ts';

/**
 * Calculate build statistics with memoization
 * Wrapper that provides backwards compatibility by using current build if none provided
 * @param build - Optional build to calculate stats for (uses currentBuild if not provided)
 * @returns Calculated stats
 */
export function calculateBuildStats(build?: Build): CalculatedBuildStats {
    const buildToUse = build || getState('currentBuild');
    return calculateBuildStatsFromModule(buildToUse);
}

// ========================================
// Build Templates
// ========================================

interface BuildTemplate {
    name: string;
    description: string;
    build: BuildData;
}

type BuildTemplatesMap = Record<string, BuildTemplate>;

export const BUILD_TEMPLATES: Readonly<BuildTemplatesMap> = Object.freeze({
    crit_build: {
        name: '🎯 Crit Build',
        description: 'Maximize critical hit chance and damage',
        build: {
            character: 'cl4nk',
            weapon: 'revolver',
            tomes: ['precision', 'damage'],
            items: ['clover', 'eagle_claw'],
        },
    },
    tank_build: {
        name: '🛡️ Tank Build',
        description: 'High HP and survivability',
        build: {
            character: 'sir_oofie',
            weapon: 'sword',
            tomes: ['hp', 'armor'],
            items: ['chonkplate', 'golden_shield'],
        },
    },
    speed_build: {
        name: '⚡ Speed Build',
        description: 'Fast attack and movement speed',
        build: {
            character: 'bandit',
            weapon: 'katana',
            tomes: ['cooldown', 'agility'],
            items: ['turbo_skates', 'turbo_socks'],
        },
    },
    glass_cannon: {
        name: '💥 Glass Cannon',
        description: 'Maximum damage, low defense',
        build: {
            character: 'ogre',
            weapon: 'sniper_rifle',
            tomes: ['damage', 'cooldown'],
            items: ['power_gloves', 'gym_sauce'],
        },
    },
});

// ========================================
// State Management
// ========================================

const BUILD_HISTORY_KEY = 'megabonk_build_history';
let eventsInitialized = false;
let cachedTomeMap: Map<string, Tome> | null = null;
let cachedItemMap: Map<string, Item> | null = null;
let cachedAllData: typeof allData | null = null;

/**
 * Get the current build from the store (never stale)
 */
function getCurrentBuildFromStore(): Build {
    return getState('currentBuild');
}

// Proxy for backwards compatibility - always reads from store
const currentBuild: Build = new Proxy({} as Build, {
    get(_target, prop: keyof Build) {
        const build = getCurrentBuildFromStore();
        return build[prop];
    },
    set(_target, prop: keyof Build, value: unknown) {
        const build = { ...getCurrentBuildFromStore() };
        (build as Record<keyof Build, unknown>)[prop] = value;
        setState('currentBuild', build);
        return true;
    },
    ownKeys() {
        return Object.keys(getCurrentBuildFromStore());
    },
    getOwnPropertyDescriptor(_target, prop) {
        const build = getCurrentBuildFromStore();
        if (prop in build) {
            return { configurable: true, enumerable: true, value: build[prop as keyof Build] };
        }
        return undefined;
    },
});

function updateCurrentBuild(build: Build): void {
    setState('currentBuild', build);
}

// ========================================
// Build History Management
// ========================================

export function getBuildHistory(): BuildData[] {
    try {
        const history = localStorage.getItem(BUILD_HISTORY_KEY);
        if (!history) return [];

        const parsed = JSON.parse(history);
        if (!Array.isArray(parsed)) {
            logger.warn({
                operation: 'build.history',
                error: { name: 'ValidationError', message: 'Build history is not an array' },
            });
            return [];
        }

        return parsed.filter((entry, index) => {
            if (isValidBuildEntry(entry)) return true;
            logger.warn({
                operation: 'build.history',
                error: { name: 'ValidationError', message: `Skipping corrupted entry at index ${index}` },
            });
            return false;
        }) as BuildData[];
    } catch (error) {
        logger.warn({
            operation: 'build.history',
            error: { name: (error as Error).name, message: (error as Error).message },
        });
        return [];
    }
}

export function saveBuildToHistory(): void {
    if (!currentBuild.character && !currentBuild.weapon) {
        ToastManager.warning('Build must have at least a character or weapon');
        return;
    }

    try {
        let history = getBuildHistory();
        const buildData: BuildData = {
            name: currentBuild.name || `Build ${new Date().toLocaleString()}`,
            notes: currentBuild.notes || '',
            timestamp: Date.now(),
            character: currentBuild.character?.id,
            weapon: currentBuild.weapon?.id,
            tomes: (currentBuild.tomes || []).map((t: Tome) => t.id),
            items: (currentBuild.items || []).map((i: Item) => i.id),
        };

        history.unshift(buildData);
        history = history.slice(0, MAX_BUILD_HISTORY);
        try {
            localStorage.setItem(BUILD_HISTORY_KEY, JSON.stringify(history));
        } catch (e) {
            if (e instanceof DOMException && e.name === 'QuotaExceededError') {
                // Remove oldest entries and retry
                history.splice(0, Math.ceil(history.length / 2));
                try { localStorage.setItem(BUILD_HISTORY_KEY, JSON.stringify(history)); } catch {}
            }
        }

        logger.info({
            operation: 'build.save',
            data: {
                action: 'save_to_history',
                characterId: currentBuild.character?.id,
                weaponId: currentBuild.weapon?.id,
                tomesCount: currentBuild.tomes?.length ?? 0,
                itemsCount: currentBuild.items?.length ?? 0,
                historySize: history.length,
            },
        });

        ToastManager.success(`Build "${buildData.name}" saved to history!`);
    } catch {
        ToastManager.error('Failed to save build to history');
    }
}

export function loadBuildFromHistory(index: number): void {
    try {
        if (!Number.isFinite(index) || !Number.isInteger(index)) {
            ToastManager.error('Invalid build index');
            return;
        }

        const history = getBuildHistory();
        if (index < 0 || index >= history.length) {
            ToastManager.error('Build not found in history');
            return;
        }

        const buildData = history[index];
        if (!buildData) {
            ToastManager.error('Build not found in history');
            return;
        }

        loadBuildFromData(buildData);

        logger.info({
            operation: 'build.load',
            data: {
                action: 'load_from_history',
                source: 'history',
                historyIndex: index,
                characterId: buildData.character,
                weaponId: buildData.weapon,
            },
        });

        ToastManager.success(`Loaded "${buildData.name || 'Build'}" from history`);
    } catch {
        ToastManager.error('Failed to load build from history');
    }
}

export function deleteBuildFromHistory(index: number): void {
    try {
        if (!Number.isFinite(index) || !Number.isInteger(index)) {
            ToastManager.error('Invalid build index');
            return;
        }

        let history = getBuildHistory();
        if (index < 0 || index >= history.length) {
            ToastManager.error('Build not found in history');
            return;
        }

        const buildName = history[index]?.name || 'Build';
        history.splice(index, 1);
        localStorage.setItem(BUILD_HISTORY_KEY, JSON.stringify(history));
        ToastManager.success(`Deleted "${buildName}" from history`);

        const windowWithModal = window as Window & { showBuildHistoryModal?: () => void };
        if (typeof windowWithModal.showBuildHistoryModal === 'function') {
            windowWithModal.showBuildHistoryModal();
        }
    } catch {
        ToastManager.error('Failed to delete build from history');
    }
}

export function clearBuildHistory(): void {
    try {
        localStorage.removeItem(BUILD_HISTORY_KEY);
        ToastManager.success('Build history cleared');
    } catch {
        ToastManager.error('Failed to clear build history');
    }
}

// ========================================
// Build Templates
// ========================================

export function loadBuildTemplate(templateId: string): void {
    const template = BUILD_TEMPLATES[templateId];
    if (!template) {
        ToastManager.error('Template not found');
        return;
    }

    try {
        currentBuild.name = template.name;
        currentBuild.notes = template.description;
        loadBuildFromData(template.build);
        ToastManager.success(`Loaded template: ${template.name}`);
    } catch {
        ToastManager.error('Failed to load template');
    }
}

// ========================================
// Build Import/Export/Load
// ========================================

export function loadBuildFromData(buildData: BuildData): void {
    clearBuild();

    if (buildData.character && allData.characters?.characters) {
        const charMap = new Map(allData.characters.characters.map((c: Character) => [c.id, c]));
        const char = charMap.get(buildData.character);
        if (char) {
            currentBuild.character = char;
            setCharacterSelection(char.id);
        }
    }

    if (buildData.weapon && allData.weapons?.weapons) {
        const weaponMap = new Map(allData.weapons.weapons.map((w: Weapon) => [w.id, w]));
        const weapon = weaponMap.get(buildData.weapon);
        if (weapon) {
            currentBuild.weapon = weapon;
            setWeaponSelection(weapon.id);
        }
    }

    if (buildData.tomes && Array.isArray(buildData.tomes) && allData.tomes?.tomes) {
        setTomeCheckboxes(buildData.tomes);
    }

    if (buildData.items && Array.isArray(buildData.items) && allData.items?.items) {
        setItemCheckboxes(buildData.items);
    }

    if (buildData.name) currentBuild.name = buildData.name;
    if (buildData.notes) currentBuild.notes = buildData.notes;

    updateBuildAnalysis();
}

export function importBuild(jsonString: string): void {
    try {
        const buildData = JSON.parse(jsonString) as BuildData;
        loadBuildFromData(buildData);
        ToastManager.success('Build imported successfully!');
    } catch {
        ToastManager.error('Invalid build data. Please check the format.');
    }
}

export function applyRandomBuild(randomBuild: {
    character: { id: string } | null;
    weapon: { id: string } | null;
    tomes: { id: string }[];
    items: { id: string }[];
}): void {
    const buildData: BuildData = {
        character: randomBuild.character?.id || '',
        weapon: randomBuild.weapon?.id || '',
        tomes: randomBuild.tomes.map(t => t.id),
        items: randomBuild.items.map(i => i.id),
        name: 'Random Build',
        notes: 'Generated by Random Build Generator',
    };

    loadBuildFromData(buildData);
    ToastManager.success('Random build applied!');
}

// ========================================
// UI Rendering & Events
// ========================================

export function renderBuildPlanner(): void {
    if (!eventsInitialized) {
        setupBuildPlannerEvents();
        eventsInitialized = true;
    }
    renderUI();
}

export function setupBuildPlannerEvents(): void {
    setupUIEvents(
        // onCharacterChange
        (charId: string) => {
            const charsArray = allData.characters?.characters;
            currentBuild.character = charsArray ? charsArray.find((c: Character) => c.id === charId) || null : null;
            updateBuildAnalysis();
        },
        // onWeaponChange
        (weaponId: string) => {
            const weaponsArray = allData.weapons?.weapons;
            currentBuild.weapon = weaponsArray ? weaponsArray.find((w: Weapon) => w.id === weaponId) || null : null;
            updateBuildAnalysis();
        },
        // onExport
        exportBuild,
        // onShare
        shareBuildURL,
        // onClear
        clearBuild
    );

    setupSelectionListeners(updateBuildAnalysis);
}

export function updateBuildAnalysis(): void {
    // Sync checkbox selections to build state
    // Invalidate cached maps if allData reference changed
    if (cachedAllData !== allData) {
        cachedTomeMap = null;
        cachedItemMap = null;
        cachedAllData = allData;
    }

    const selectedTomes = getSelectedTomeIds();
    if (allData.tomes?.tomes) {
        if (!cachedTomeMap) {
            cachedTomeMap = new Map(allData.tomes.tomes.map((t: Tome) => [t.id, t]));
        }
        currentBuild.tomes = selectedTomes
            .map((id: string) => cachedTomeMap!.get(id))
            .filter((t): t is Tome => t !== undefined);
    } else {
        currentBuild.tomes = [];
    }

    const selectedItems = getSelectedItemIds();
    if (allData.items?.items) {
        if (!cachedItemMap) {
            cachedItemMap = new Map(allData.items.items.map((i: Item) => [i.id, i]));
        }
        currentBuild.items = selectedItems
            .map((id: string) => cachedItemMap!.get(id))
            .filter((i): i is Item => i !== undefined);
    } else {
        currentBuild.items = [];
    }

    // Note: Don't spread the Proxy directly ({ ...currentBuild }) as it produces an empty object.
    // The Proxy setter already calls setState for each property change, so the store is up-to-date.
    // Just get the current build from the store for the UI update.

    // Update UI display
    updateBuildDisplay(getCurrentBuildFromStore(), updateBuildURL);
}

// ========================================
// Export & Share
// ========================================

export function exportBuild(): void {
    const buildCode = JSON.stringify({
        character: currentBuild.character?.id,
        weapon: currentBuild.weapon?.id,
        tomes: currentBuild.tomes.map((t: Tome) => t.id),
        items: currentBuild.items.map((i: Item) => i.id),
    });

    copyToClipboard(buildCode, 'Build code copied to clipboard!');
}

export function shareBuildURL(): void {
    const buildData: URLBuildData = {
        c: currentBuild.character?.id,
        w: currentBuild.weapon?.id,
        t: currentBuild.tomes.map((t: Tome) => t.id),
        i: currentBuild.items.map((i: Item) => i.id),
    };

    if (!buildData.c) delete buildData.c;
    if (!buildData.w) delete buildData.w;
    if (!buildData.t || buildData.t.length === 0) delete buildData.t;
    if (!buildData.i || buildData.i.length === 0) delete buildData.i;

    let encoded: string;
    try {
        encoded = btoa(JSON.stringify(buildData));
    } catch (error) {
        logger.error({
            operation: 'build.share',
            error: { name: (error as Error).name, message: (error as Error).message, module: 'build-planner' },
        });
        ToastManager.error('Build is too large to share. Try removing some items.');
        return;
    }

    const url = `${window.location.origin}${window.location.pathname}#build=${encoded}`;

    logger.info({
        operation: 'build.share',
        data: {
            action: 'share_url',
            characterId: currentBuild.character?.id,
            weaponId: currentBuild.weapon?.id,
            tomesCount: currentBuild.tomes?.length ?? 0,
            itemsCount: currentBuild.items?.length ?? 0,
        },
    });

    copyToClipboard(url, 'Build link copied to clipboard! Share it with friends.');
}

// ========================================
// URL Handling
// ========================================

export function loadBuildFromURL(): boolean {
    const hash = window.location.hash;
    if (!hash || !hash.includes('build=')) return false;

    try {
        const params = new URLSearchParams(hash.substring(1));
        const encoded = params.get('build');
        if (!encoded) {
            ToastManager.error('Invalid build link');
            return false;
        }

        if (!isValidBase64(encoded)) {
            logger.warn({
                operation: 'build.load',
                error: { name: 'ValidationError', message: 'Invalid base64 characters in build URL' },
            });
            ToastManager.error('Invalid build link format');
            return false;
        }

        if (encoded.length > 10000) {
            logger.warn({
                operation: 'build.load',
                error: { name: 'ValidationError', message: 'Build URL exceeds maximum length' },
            });
            ToastManager.error('Build link is too long');
            return false;
        }

        let decodedString: string;
        try {
            decodedString = atob(encoded);
        } catch {
            ToastManager.error('Invalid build link encoding');
            return false;
        }

        const decoded = JSON.parse(decodedString);

        if (!isValidURLBuildData(decoded)) {
            ToastManager.error('Invalid build data format');
            return false;
        }

        // Load character
        if (decoded.c && allData.characters) {
            const charMap = new Map(allData.characters.characters.map((c: Character) => [c.id, c]));
            const char = charMap.get(decoded.c);
            if (char) {
                currentBuild.character = char;
                setCharacterSelection(char.id);
            }
        }

        // Load weapon
        if (decoded.w && allData.weapons) {
            const weaponMap = new Map(allData.weapons.weapons.map((w: Weapon) => [w.id, w]));
            const weapon = weaponMap.get(decoded.w);
            if (weapon) {
                currentBuild.weapon = weapon;
                setWeaponSelection(weapon.id);
            }
        }

        // Load tomes
        if (decoded.t && Array.isArray(decoded.t) && allData.tomes?.tomes) {
            const tomeMap = new Map(allData.tomes.tomes.map((t: Tome) => [t.id, t]));
            currentBuild.tomes = decoded.t
                .map((id: string) => tomeMap.get(id))
                .filter((t): t is Tome => t !== undefined);
            setTomeCheckboxes(decoded.t);
        }

        // Load items
        if (decoded.i && Array.isArray(decoded.i) && allData.items?.items) {
            const itemMap = new Map(allData.items.items.map((i: Item) => [i.id, i]));
            currentBuild.items = decoded.i
                .map((id: string) => itemMap.get(id))
                .filter((i): i is Item => i !== undefined);
            setItemCheckboxes(decoded.i);
        }

        updateBuildAnalysis();

        logger.info({
            operation: 'build.load',
            data: {
                action: 'load_from_url',
                source: 'url',
                characterId: currentBuild.character?.id,
                weaponId: currentBuild.weapon?.id,
                tomesCount: currentBuild.tomes?.length ?? 0,
                itemsCount: currentBuild.items?.length ?? 0,
            },
        });

        ToastManager.success('Build loaded from URL!');
        return true;
    } catch {
        ToastManager.error('Invalid build link');
        return false;
    }
}

export function updateBuildURL(): void {
    if (
        !currentBuild.character &&
        !currentBuild.weapon &&
        (currentBuild.tomes?.length ?? 0) === 0 &&
        (currentBuild.items?.length ?? 0) === 0
    ) {
        if (window.location.hash) {
            history.replaceState(null, '', window.location.pathname);
        }
        return;
    }

    const buildData: URLBuildData = {
        c: currentBuild.character?.id,
        w: currentBuild.weapon?.id,
        t: currentBuild.tomes.map((t: Tome) => t.id),
        i: currentBuild.items.map((i: Item) => i.id),
    };

    if (!buildData.c) delete buildData.c;
    if (!buildData.w) delete buildData.w;
    if (!buildData.t || buildData.t.length === 0) delete buildData.t;
    if (!buildData.i || buildData.i.length === 0) delete buildData.i;

    try {
        const encoded = btoa(JSON.stringify(buildData));
        history.replaceState(null, '', `#build=${encoded}`);
    } catch (error) {
        logger.debug({
            operation: 'build.url_update',
            error: { name: (error as Error).name, message: (error as Error).message },
        });
    }
}

// ========================================
// Build Operations
// ========================================

export function clearBuild(): void {
    logger.info({
        operation: 'build.clear',
        data: {
            action: 'clear',
            hadCharacter: currentBuild.character !== null,
            hadWeapon: currentBuild.weapon !== null,
            tomesCleared: currentBuild.tomes?.length ?? 0,
            itemsCleared: currentBuild.items?.length ?? 0,
        },
    });

    invalidateBuildStatsCache();
    updateCurrentBuild({ character: null, weapon: null, tomes: [], items: [] });
    clearAllSelections();
    updateBuildAnalysis();
}

export function getCurrentBuild(): Build {
    const build = getState('currentBuild');
    return {
        ...build,
        tomes: [...build.tomes],
        items: [...build.items],
    };
}
