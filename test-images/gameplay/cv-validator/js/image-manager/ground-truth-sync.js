/* global Blob */
/* ========================================
 * Image Manager - Ground Truth Sync
 * Keeps ground-truth.json synchronized with file operations
 * ======================================== */

import { state } from './state.js';

// Ground truth file path (relative to the gameplay folder)
const GROUND_TRUTH_PATH = 'ground-truth.json';

// Load ground truth from server/static file
export async function loadGroundTruth() {
    try {
        const response = await fetch(GROUND_TRUTH_PATH);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        state.groundTruth = await response.json();
        return { success: true, data: state.groundTruth };
    } catch (err) {
        console.error('Failed to load ground-truth.json:', err);
        return { success: false, error: err.message };
    }
}

// Check if an image path exists in ground truth
export function hasGroundTruthEntry(imagePath) {
    return Object.hasOwn(state.groundTruth, imagePath) && !imagePath.startsWith('_');
}

// Get ground truth entry for an image
export function getGroundTruthEntry(imagePath) {
    return state.groundTruth[imagePath];
}

// Get item count from ground truth
export function getItemCount(imagePath) {
    const entry = state.groundTruth[imagePath];
    return entry?.items?.length || 0;
}

// Get all ground truth paths (excluding metadata keys starting with _)
export function getAllGroundTruthPaths() {
    return Object.keys(state.groundTruth).filter(k => !k.startsWith('_'));
}

// Update ground truth entry key (for rename)
export function renameGroundTruthEntry(oldPath, newPath) {
    if (!state.groundTruth[oldPath]) return false;

    // Copy entry to new key
    state.groundTruth[newPath] = state.groundTruth[oldPath];

    // Delete old key
    delete state.groundTruth[oldPath];

    return true;
}

// Delete ground truth entry
export function deleteGroundTruthEntry(path) {
    if (!state.groundTruth[path]) return false;

    delete state.groundTruth[path];
    return true;
}

// Export ground truth as JSON string
export function exportGroundTruth() {
    return JSON.stringify(state.groundTruth, null, 2);
}

// Download ground truth as file
export function downloadGroundTruth(filename = 'ground-truth.json') {
    const json = exportGroundTruth();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return true;
}

// Create backup of ground truth
export function createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    return downloadGroundTruth(`ground-truth-backup-${timestamp}.json`);
}

// Save ground truth using File System Access API
export async function saveGroundTruth() {
    if (!state.directoryHandle) {
        return { success: false, error: 'No directory access', fallback: true };
    }

    try {
        const fileHandle = await state.directoryHandle.getFileHandle(GROUND_TRUTH_PATH, { create: false });
        const writable = await fileHandle.createWritable();
        await writable.write(exportGroundTruth());
        await writable.close();

        return { success: true };
    } catch (err) {
        console.error('Failed to save ground-truth.json:', err);
        return { success: false, error: err.message, fallback: true };
    }
}

// Synchronize image data with ground truth
export function syncImagesWithGroundTruth(images) {
    const gtPaths = new Set(getAllGroundTruthPaths());
    const imagePaths = new Set(images.map(img => img.path));

    // Update image status based on ground truth
    images.forEach(img => {
        if (hasGroundTruthEntry(img.path)) {
            img.status = 'labeled';
            img.itemCount = getItemCount(img.path);
        } else {
            img.status = 'unlabeled';
            img.itemCount = 0;
        }
    });

    // Find orphaned entries (in ground truth but no image file)
    const orphaned = [];
    for (const gtPath of gtPaths) {
        if (!imagePaths.has(gtPath)) {
            orphaned.push({
                path: gtPath,
                data: state.groundTruth[gtPath],
            });
        }
    }

    return { images, orphaned };
}

// Validate filename format
export function validateFilename(filename) {
    // Check for invalid characters (including control characters 0x00-0x1f)
    // eslint-disable-next-line no-control-regex
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (invalidChars.test(filename)) {
        return { valid: false, error: 'Filename contains invalid characters' };
    }

    // Check for extension
    const ext = filename.split('.').pop()?.toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
        return { valid: false, error: 'Filename must have an image extension (.png, .jpg, etc.)' };
    }

    // Check length
    if (filename.length > 255) {
        return { valid: false, error: 'Filename too long (max 255 characters)' };
    }

    // Check for leading/trailing spaces or dots
    if (filename.trim() !== filename || filename.startsWith('.')) {
        return { valid: false, error: 'Filename cannot start or end with spaces or dots' };
    }

    return { valid: true };
}
