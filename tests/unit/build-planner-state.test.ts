/**
 * Build Planner State Module Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../src/modules/toast.ts', () => ({
    ToastManager: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
    },
}));

vi.mock('../../src/modules/logger.ts', () => ({
    logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

vi.mock('../../src/modules/store.ts', () => {
    let state: Record<string, any> = {
        currentBuild: { character: null, weapon: null, tomes: [], items: [], name: '', notes: '' },
    };
    return {
        getState: vi.fn((key: string) => state[key]),
        setState: vi.fn((key: string, value: any) => { state[key] = typeof value === 'function' ? value(state[key]) : value; }),
        resetStore: vi.fn(() => {
            state = { currentBuild: { character: null, weapon: null, tomes: [], items: [], name: '', notes: '' } };
        }),
    };
});

vi.mock('../../src/modules/build-validation.ts', () => ({
    isValidBuildEntry: vi.fn((entry: any) => {
        return entry && typeof entry === 'object' && 'character' in entry;
    }),
}));

vi.mock('../../src/modules/constants.ts', () => ({
    MAX_BUILD_HISTORY: 20,
}));

import {
    BUILD_TEMPLATES,
    getCurrentBuildFromStore,
    currentBuild,
    updateCurrentBuild,
    getBuildHistory,
    saveBuildToHistory,
    deleteBuildFromHistory,
    clearBuildHistory,
    sanitizeParsed,
} from '../../src/modules/build-planner-state.ts';
import { getState, setState, resetStore } from '../../src/modules/store.ts';
import { ToastManager } from '../../src/modules/toast.ts';

describe('build-planner-state', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        vi.mocked(resetStore)();
    });

    afterEach(() => {
        localStorage.clear();
    });

    describe('BUILD_TEMPLATES', () => {
        it('should have 4 templates', () => {
            expect(Object.keys(BUILD_TEMPLATES)).toHaveLength(4);
        });

        it('should include crit_build template', () => {
            expect(BUILD_TEMPLATES.crit_build.name).toBe('🎯 Crit Build');
            expect(BUILD_TEMPLATES.crit_build.build.character).toBe('cl4nk');
        });

        it('should be frozen', () => {
            expect(Object.isFrozen(BUILD_TEMPLATES)).toBe(true);
        });
    });

    describe('getCurrentBuildFromStore', () => {
        it('should return current build from store', () => {
            const build = getCurrentBuildFromStore();
            expect(build).toBeDefined();
            expect(getState).toHaveBeenCalledWith('currentBuild');
        });
    });

    describe('updateCurrentBuild', () => {
        it('should set build in store', () => {
            const build = { character: null, weapon: null, tomes: [], items: [], name: 'Test', notes: '' };
            updateCurrentBuild(build as any);
            expect(setState).toHaveBeenCalledWith('currentBuild', build);
        });
    });

    describe('currentBuild proxy', () => {
        it('should read from store via proxy', () => {
            const result = currentBuild.name;
            expect(getState).toHaveBeenCalledWith('currentBuild');
        });

        it('should write to store via proxy', () => {
            currentBuild.name = 'My Build';
            expect(setState).toHaveBeenCalled();
        });

        it('should support ownKeys', () => {
            const keys = Object.keys(currentBuild);
            expect(Array.isArray(keys)).toBe(true);
        });

        it('should support getOwnPropertyDescriptor', () => {
            const desc = Object.getOwnPropertyDescriptor(currentBuild, 'name');
            expect(desc).toBeDefined();
        });
    });

    describe('getBuildHistory', () => {
        it('should return empty array when no history', () => {
            expect(getBuildHistory()).toEqual([]);
        });

        it('should parse valid history from localStorage', () => {
            const history = [{ character: 'cl4nk', weapon: 'sword', tomes: [], items: [], name: 'Build 1', timestamp: Date.now() }];
            localStorage.setItem('megabonk_build_history', JSON.stringify(history));
            expect(getBuildHistory()).toEqual(history);
        });

        it('should clear corrupt non-array data', () => {
            localStorage.setItem('megabonk_build_history', JSON.stringify({ bad: true }));
            expect(getBuildHistory()).toEqual([]);
            expect(localStorage.getItem('megabonk_build_history')).toBeNull();
        });

        it('should clear entries without character field', () => {
            localStorage.setItem('megabonk_build_history', JSON.stringify([{ weapon: 'sword' }]));
            expect(getBuildHistory()).toEqual([]);
        });

        it('should handle JSON parse errors', () => {
            localStorage.setItem('megabonk_build_history', 'not json');
            expect(getBuildHistory()).toEqual([]);
        });
    });

    describe('saveBuildToHistory', () => {
        it('should warn if no character or weapon', () => {
            saveBuildToHistory();
            expect(ToastManager.warning).toHaveBeenCalledWith('Build must have at least a character or weapon');
        });

        it('should save build with character', () => {
            vi.mocked(getState).mockReturnValue({
                character: { id: 'cl4nk' },
                weapon: { id: 'sword' },
                tomes: [],
                items: [],
                name: 'My Build',
                notes: '',
            });
            saveBuildToHistory();
            expect(ToastManager.success).toHaveBeenCalled();
            const stored = localStorage.getItem('megabonk_build_history');
            expect(stored).toBeTruthy();
            const parsed = JSON.parse(stored!);
            expect(parsed[0].character).toBe('cl4nk');
        });
    });

    describe('deleteBuildFromHistory', () => {
        it('should delete build at index', () => {
            const history = [
                { character: 'cl4nk', name: 'Build 1' },
                { character: 'ogre', name: 'Build 2' },
            ];
            localStorage.setItem('megabonk_build_history', JSON.stringify(history));
            deleteBuildFromHistory(0);
            expect(ToastManager.success).toHaveBeenCalled();
            const stored = JSON.parse(localStorage.getItem('megabonk_build_history')!);
            expect(stored).toHaveLength(1);
            expect(stored[0].name).toBe('Build 2');
        });

        it('should error on invalid index', () => {
            deleteBuildFromHistory(NaN);
            expect(ToastManager.error).toHaveBeenCalledWith('Invalid build index');
        });

        it('should error on out of range index', () => {
            localStorage.setItem('megabonk_build_history', JSON.stringify([]));
            deleteBuildFromHistory(5);
            expect(ToastManager.error).toHaveBeenCalledWith('Build not found in history');
        });

        it('should error on non-integer index', () => {
            deleteBuildFromHistory(1.5);
            expect(ToastManager.error).toHaveBeenCalledWith('Invalid build index');
        });
    });

    describe('clearBuildHistory', () => {
        it('should clear history from localStorage', () => {
            localStorage.setItem('megabonk_build_history', JSON.stringify([{ character: 'test' }]));
            clearBuildHistory();
            expect(localStorage.getItem('megabonk_build_history')).toBeNull();
            expect(ToastManager.success).toHaveBeenCalledWith('Build history cleared');
        });
    });

    describe('sanitizeParsed', () => {
        it('should return primitives unchanged', () => {
            expect(sanitizeParsed(null)).toBeNull();
            expect(sanitizeParsed('hello')).toBe('hello');
            expect(sanitizeParsed(42)).toBe(42);
            expect(sanitizeParsed(true)).toBe(true);
        });

        it('should remove __proto__ keys', () => {
            const obj = JSON.parse('{"__proto__": {"admin": true}, "name": "test"}');
            const result = sanitizeParsed(obj) as Record<string, unknown>;
            expect(result.name).toBe('test');
            expect('__proto__' in result && Object.hasOwn(result, '__proto__')).toBe(false);
        });

        it('should remove constructor and prototype keys', () => {
            const obj = { constructor: 'evil', prototype: 'bad', name: 'ok' };
            const result = sanitizeParsed(obj) as Record<string, unknown>;
            expect(result.name).toBe('ok');
            expect(Object.hasOwn(result, 'constructor')).toBe(false);
            expect(Object.hasOwn(result, 'prototype')).toBe(false);
        });

        it('should recursively sanitize nested objects', () => {
            const obj = { nested: { constructor: 'evil', safe: 'value' }, top: 'ok' };
            const result = sanitizeParsed(obj) as any;
            expect(result.top).toBe('ok');
            expect(result.nested.safe).toBe('value');
            expect(Object.hasOwn(result.nested, 'constructor')).toBe(false);
        });

        it('should handle arrays within objects', () => {
            const obj = { items: [{ constructor: 'bad', id: '1' }] };
            const result = sanitizeParsed(obj) as any;
            expect(result.items[0].id).toBe('1');
        });
    });
});
