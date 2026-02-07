// ========================================
// MegaBonk Modal Module
// Entry point that re-exports all modal functionality
// ========================================

// Re-export core modal functionality
export { openDetailModal, closeModal } from './modal-core.ts';

// Re-export types for consumers who need them
export type { ChartOptions, ModalEntity } from './modal-core.ts';

// Re-export individual renderers for direct use if needed
export { renderItemModal } from './modal-items.ts';
export { renderWeaponModal } from './modal-weapons.ts';
export { renderCharacterModal } from './modal-characters.ts';
export { renderTomeModal, renderShrineModal } from './modal-entities.ts';

// ========================================
// Exported functions:
// - openDetailModal(type, id)
// - closeModal()
// ========================================
