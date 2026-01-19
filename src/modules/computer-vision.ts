// ========================================
// MegaBonk Computer Vision Module
// ========================================
// This file re-exports from the cv/ directory for backwards compatibility.
// All CV functionality has been split into smaller, focused modules.
// ========================================

// Re-export everything from the cv module
export * from './cv/index.ts';

// ========================================
// Global Assignments (for browser compatibility)
// ========================================
import { initCV } from './cv/index.ts';

if (typeof window !== 'undefined') {
    window.initCV = initCV;
}
