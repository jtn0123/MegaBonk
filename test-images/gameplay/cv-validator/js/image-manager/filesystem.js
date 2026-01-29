/* global FileReader, Image */
/* ========================================
 * Image Manager - File System Access API
 * Handles directory access, file operations
 * ======================================== */

import { state } from './state.js';

// Check if File System Access API is supported
export function isFileSystemAccessSupported() {
    return 'showDirectoryPicker' in window;
}

// Request directory access
export async function requestDirectoryAccess() {
    if (!isFileSystemAccessSupported()) {
        return { success: false, error: 'File System Access API not supported' };
    }

    try {
        const handle = await window.showDirectoryPicker({
            id: 'megabonk-gameplay',
            mode: 'readwrite',
            startIn: 'documents',
        });

        state.directoryHandle = handle;
        state.hasFileSystemAccess = true;

        return { success: true, handle };
    } catch (err) {
        if (err.name === 'AbortError') {
            return { success: false, error: 'User cancelled directory selection' };
        }
        return { success: false, error: err.message };
    }
}

// Verify directory still has permission
export async function verifyPermission() {
    if (!state.directoryHandle) return false;

    try {
        const permission = await state.directoryHandle.queryPermission({ mode: 'readwrite' });
        return permission === 'granted';
    } catch {
        return false;
    }
}

// Request permission again if needed
export async function requestPermission() {
    if (!state.directoryHandle) return false;

    try {
        const permission = await state.directoryHandle.requestPermission({ mode: 'readwrite' });
        return permission === 'granted';
    } catch {
        return false;
    }
}

// Scan directory for images
// This list should match all directories containing test screenshots for CV
export async function scanDirectory(progressCallback) {
    if (!state.directoryHandle) {
        return { success: false, error: 'No directory handle' };
    }

    const images = [];
    // Include all image folders that the CV system uses
    const subdirs = ['pc-screenshots', 'steam-community', 'steam-scraped'];

    for (const subdir of subdirs) {
        try {
            const subdirHandle = await state.directoryHandle.getDirectoryHandle(subdir);
            const files = await scanSubdirectory(subdirHandle, subdir, progressCallback);
            images.push(...files);
        } catch (err) {
            console.warn(`Subdirectory ${subdir} not found:`, err.message);
        }
    }

    return { success: true, images };
}

// Scan a subdirectory for image files
async function scanSubdirectory(dirHandle, sourceName, progressCallback) {
    const images = [];

    for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' && isImageFile(entry.name)) {
            try {
                const file = await entry.getFile();
                const path = `${sourceName}/${entry.name}`;

                images.push({
                    filename: entry.name,
                    path: path,
                    source: sourceName,
                    fileHandle: entry,
                    lastModified: file.lastModified,
                    size: file.size,
                });

                if (progressCallback) {
                    progressCallback(images.length, entry.name);
                }
            } catch (err) {
                console.warn(`Failed to read file ${entry.name}:`, err.message);
            }
        }
    }

    return images;
}

// Check if file is an image
function isImageFile(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    return ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext);
}

// Get file handle for a specific path
async function getFileHandle(path) {
    if (!state.directoryHandle) return null;

    const parts = path.split('/');
    const filename = parts.pop();
    let currentHandle = state.directoryHandle;

    // Navigate to subdirectory
    for (const part of parts) {
        try {
            currentHandle = await currentHandle.getDirectoryHandle(part);
        } catch {
            return null;
        }
    }

    try {
        return await currentHandle.getFileHandle(filename);
    } catch {
        return null;
    }
}

// Get directory handle for a path
async function getDirectoryHandleForPath(path) {
    if (!state.directoryHandle) return null;

    const parts = path.split('/');
    parts.pop(); // Remove filename
    let currentHandle = state.directoryHandle;

    for (const part of parts) {
        try {
            currentHandle = await currentHandle.getDirectoryHandle(part);
        } catch {
            return null;
        }
    }

    return currentHandle;
}

// Rename a file
export async function renameFile(oldPath, newFilename) {
    if (!state.directoryHandle) {
        return { success: false, error: 'No directory access', fallback: true };
    }

    if (!isFileSystemAccessSupported()) {
        return { success: false, error: 'File System Access API not supported', fallback: true };
    }

    try {
        // Get the old file handle
        const oldHandle = await getFileHandle(oldPath);
        if (!oldHandle) {
            return { success: false, error: 'File not found' };
        }

        // Get the directory handle
        const dirHandle = await getDirectoryHandleForPath(oldPath);
        if (!dirHandle) {
            return { success: false, error: 'Directory not found' };
        }

        // Read the old file
        const oldFile = await oldHandle.getFile();
        const contents = await oldFile.arrayBuffer();

        // Create new file with new name
        const newHandle = await dirHandle.getFileHandle(newFilename, { create: true });
        const writable = await newHandle.createWritable();
        await writable.write(contents);
        await writable.close();

        // Delete old file
        await dirHandle.removeEntry(oldHandle.name);

        // Build new path
        const parts = oldPath.split('/');
        parts.pop();
        const newPath = [...parts, newFilename].join('/');

        return { success: true, newPath, newHandle };
    } catch (err) {
        console.error('Rename failed:', err);
        return { success: false, error: err.message, fallback: true };
    }
}

// Delete a file
export async function deleteFile(path) {
    if (!state.directoryHandle) {
        return { success: false, error: 'No directory access', fallback: true };
    }

    if (!isFileSystemAccessSupported()) {
        return { success: false, error: 'File System Access API not supported', fallback: true };
    }

    try {
        const dirHandle = await getDirectoryHandleForPath(path);
        if (!dirHandle) {
            return { success: false, error: 'Directory not found' };
        }

        const filename = path.split('/').pop();
        await dirHandle.removeEntry(filename);

        return { success: true };
    } catch (err) {
        console.error('Delete failed:', err);
        return { success: false, error: err.message, fallback: true };
    }
}

// Read a file as data URL (for thumbnails)
export async function readFileAsDataURL(path) {
    if (!state.directoryHandle) return null;

    try {
        const handle = await getFileHandle(path);
        if (!handle) return null;

        const file = await handle.getFile();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    } catch {
        return null;
    }
}

// Get image resolution
export async function getImageResolution(path) {
    const dataUrl = await readFileAsDataURL(path);
    if (!dataUrl) return null;

    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => resolve(null);
        img.src = dataUrl;
    });
}

// Generate fallback terminal command for rename
export function generateRenameCommand(oldPath, newPath) {
    const basePath = 'test-images/gameplay';
    return `mv "${basePath}/${oldPath}" "${basePath}/${newPath}"`;
}

// Generate fallback terminal command for delete
export function generateDeleteCommand(path) {
    const basePath = 'test-images/gameplay';
    return `rm "${basePath}/${path}"`;
}
