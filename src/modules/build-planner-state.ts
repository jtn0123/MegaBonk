// ========================================
// Build Planner State Module
// State management, build history, and templates
// ========================================

import type { Tome, Item } from '../types/index.ts';
import { ToastManager } from './toast.ts';
import { MAX_BUILD_HISTORY } from './constants.ts';
import { logger } from './logger.ts';
import { getState, setState, type Build } from './store.ts';
import {
    isValidBuildEntry,
    type BuildData,
} from './build-validation.ts';

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

/**
 * Get the current build from the store (never stale)
 */
export function getCurrentBuildFromStore(): Build {
    return getState('currentBuild');
}

// Proxy for backwards compatibility - always reads from store
export const currentBuild: Build = new Proxy({} as Build, {
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

export function updateCurrentBuild(build: Build): void {
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
            localStorage.removeItem(BUILD_HISTORY_KEY);
            return [];
        }

        if (!parsed.every((b: unknown) => b && typeof b === 'object' && 'character' in (b as Record<string, unknown>))) {
            logger.warn({
                operation: 'build.history',
                error: { name: 'ValidationError', message: 'Build history contains entries without character field, clearing corrupt data' },
            });
            localStorage.removeItem(BUILD_HISTORY_KEY);
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

        if (typeof globalThis.showBuildHistoryModal === 'function') {
            globalThis.showBuildHistoryModal();
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

/**
 * Recursively strips prototype-pollution keys from a parsed JSON object.
 * Guards against crafted build links containing __proto__ payloads.
 * See: SEC-2026-0220-005
 */
export function sanitizeParsed(obj: unknown): unknown {
    if (obj === null || typeof obj !== 'object') return obj;
    const clean = obj as Record<string, unknown>;
    for (const dangerousKey of ['constructor', 'prototype']) {
        delete clean[dangerousKey];
    }
    const protoKeys = Object.keys(clean).filter(k => k === '__proto__');
    for (const k of protoKeys) {
        delete clean[k];
    }
    for (const key of Object.keys(clean)) {
        if (typeof clean[key] === 'object' && clean[key] !== null) {
            sanitizeParsed(clean[key]);
        }
    }
    return clean;
}
