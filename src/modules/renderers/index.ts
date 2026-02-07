// ========================================
// Renderers Barrel File
// Re-exports everything for backwards compatibility
// ========================================

// Types
export type { Item, Weapon, Tome, Character, Shrine } from './types.ts';

// Common utilities
export { initChartsAsync, updateStats } from './common.ts';

// Entity renderers
export { renderItems } from './items.ts';
export { renderWeapons } from './weapons.ts';
export { renderTomes } from './tomes.ts';
export { renderCharacters } from './characters.ts';
export { renderShrines } from './shrines.ts';

// Global search
export { renderGlobalSearchResults } from './global-search.ts';

// Tab content orchestrator
export { renderTabContent } from './tab-content.ts';
