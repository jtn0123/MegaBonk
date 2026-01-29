/* global setTimeout, clearTimeout */
/* ========================================
 * Image Manager - Main Entry Point
 * Browse, rename, and delete test screenshots
 * ======================================== */

import {
    state,
    resetState,
    applyFilters,
    selectAll,
    deselectAll,
    removeImage,
    addOrphanedEntry,
} from './image-manager/state.js';

import {
    isFileSystemAccessSupported,
    requestDirectoryAccess,
    verifyPermission,
    scanDirectory,
    renameFile,
    deleteFile,
    generateRenameCommand,
    generateDeleteCommand,
} from './image-manager/filesystem.js';

import {
    loadGroundTruth,
    hasGroundTruthEntry,
    getGroundTruthEntry,
    renameGroundTruthEntry,
    deleteGroundTruthEntry,
    downloadGroundTruth,
    createBackup,
    saveGroundTruth,
    syncImagesWithGroundTruth,
    validateFilename,
} from './image-manager/ground-truth-sync.js';

import {
    initRenderer,
    renderGrid,
    renderStats,
    updateFileSystemStatus,
    showLoading,
    hideDetailModal,
    showRenameModal,
    hideRenameModal,
    updateRenameHint,
    showDeleteModal,
    hideDeleteModal,
    showFallbackModal,
    hideFallbackModal,
    showToast,
    getElements,
} from './image-manager/renderer.js';

// Initialize the application
async function init() {
    console.log('Image Manager initializing...');

    // Initialize renderer
    initRenderer();

    // Load ground truth first
    const gtResult = await loadGroundTruth();
    if (!gtResult.success) {
        showToast('Failed to load ground-truth.json', 'error');
        return;
    }

    // Auto-load images from ground-truth.json (like CV validator does)
    await loadImagesFromGroundTruth();

    // Check File System Access API support for write operations
    if (isFileSystemAccessSupported()) {
        updateFileSystemStatus({
            icon: '📂',
            path: 'Images loaded from ground-truth.json',
            method: 'Read-only (Select Directory for write access)',
            methodClass: 'readonly',
            hasAccess: false,
        });
    } else {
        updateFileSystemStatus({
            icon: '📂',
            path: 'Images loaded from ground-truth.json',
            method: 'Read-only mode',
            methodClass: 'readonly',
            hasAccess: false,
        });
    }

    // Setup event listeners
    setupEventListeners();
}

// Load images directly from ground-truth.json (no directory selection needed)
async function loadImagesFromGroundTruth() {
    showLoading('Loading images from ground-truth.json...');
    resetState();

    const images = [];
    const gtPaths = Object.keys(state.groundTruth).filter(k => !k.startsWith('_'));

    for (const path of gtPaths) {
        const parts = path.split('/');
        const filename = parts.pop();
        const source = parts[0] || 'unknown';

        images.push({
            filename: filename,
            path: path,
            source: source,
            fileHandle: null, // No file handle in read-only mode
            lastModified: null,
            size: null,
            status: 'labeled',
            itemCount: state.groundTruth[path]?.items?.length || 0,
            groundTruthData: state.groundTruth[path],
        });
    }

    state.images = images;

    // Apply filters and render
    applyFilters();
    renderGrid();
    renderStats();

    showToast(`Loaded ${images.length} images from ground-truth.json`, 'success');
}

// Setup all event listeners
function setupEventListeners() {
    const elements = getElements();

    // Directory selection
    elements.selectDirectoryBtn?.addEventListener('click', handleSelectDirectory);
    elements.refreshBtn?.addEventListener('click', handleRefresh);

    // Select all checkbox
    elements.selectAllCheckbox?.addEventListener('change', e => {
        if (e.target.checked) {
            selectAll();
        } else {
            deselectAll();
        }
        renderGrid();
    });

    // Batch actions
    elements.batchRenameBtn?.addEventListener('click', handleBatchRename);
    elements.batchDeleteBtn?.addEventListener('click', handleBatchDelete);
    elements.exportBackupBtn?.addEventListener('click', handleExportBackup);
    elements.findOrphansBtn?.addEventListener('click', handleFindOrphans);

    // Filters
    elements.sourceFilter?.addEventListener('change', handleFilterChange);
    elements.statusFilter?.addEventListener('change', handleFilterChange);
    elements.searchInput?.addEventListener('input', debounce(handleFilterChange, 200));
    elements.sortSelect?.addEventListener('change', handleFilterChange);

    // Detail modal
    document.getElementById('detail-close')?.addEventListener('click', hideDetailModal);
    document.getElementById('detail-rename-btn')?.addEventListener('click', () => {
        if (state.currentDetailImage) {
            hideDetailModal();
            showRenameModal(state.currentDetailImage);
        }
    });
    document.getElementById('detail-delete-btn')?.addEventListener('click', () => {
        if (state.currentDetailImage) {
            hideDetailModal();
            showDeleteModal([state.currentDetailImage.path]);
        }
    });
    document.getElementById('detail-open-validator-btn')?.addEventListener('click', () => {
        if (state.currentDetailImage) {
            // Open CV Validator with this image selected
            window.open(`cv-validator.html?image=${encodeURIComponent(state.currentDetailImage.path)}`, '_blank');
        }
    });

    // Rename modal
    document.getElementById('rename-close')?.addEventListener('click', hideRenameModal);
    document.getElementById('rename-cancel-btn')?.addEventListener('click', hideRenameModal);
    document.getElementById('rename-confirm-btn')?.addEventListener('click', handleRenameConfirm);
    document.getElementById('rename-input')?.addEventListener('input', e => {
        const validation = validateFilename(e.target.value);
        if (!validation.valid) {
            updateRenameHint(validation.error, true);
        } else {
            updateRenameHint('');
        }
    });
    document.getElementById('rename-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') handleRenameConfirm();
        if (e.key === 'Escape') hideRenameModal();
    });

    // Delete modal
    document.getElementById('delete-close')?.addEventListener('click', hideDeleteModal);
    document.getElementById('delete-cancel-btn')?.addEventListener('click', hideDeleteModal);
    document.getElementById('delete-confirm-btn')?.addEventListener('click', handleDeleteConfirm);

    // Fallback modal
    document.getElementById('fallback-close')?.addEventListener('click', hideFallbackModal);
    document.getElementById('fallback-done-btn')?.addEventListener('click', hideFallbackModal);
    document.getElementById('fallback-copy-btn')?.addEventListener('click', e => {
        const command = document.getElementById('fallback-command').textContent;
        navigator.clipboard.writeText(command).then(() => {
            e.target.textContent = 'Copied!';
            e.target.classList.add('copied');
            setTimeout(() => {
                e.target.textContent = 'Copy';
                e.target.classList.remove('copied');
            }, 2000);
        });
    });
    document.getElementById('fallback-download-btn')?.addEventListener('click', () => {
        downloadGroundTruth();
        showToast('Downloaded ground-truth.json', 'success');
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
        // Escape to close modals
        if (e.key === 'Escape') {
            hideDetailModal();
            hideRenameModal();
            hideDeleteModal();
            hideFallbackModal();
        }

        // R to rename selected
        if (e.key === 'r' && !e.ctrlKey && !e.metaKey && !isInputFocused()) {
            if (state.selectedImages.size === 1) {
                const path = Array.from(state.selectedImages)[0];
                const img = state.images.find(i => i.path === path);
                if (img) showRenameModal(img);
            }
        }

        // Delete to delete selected
        if ((e.key === 'Delete' || e.key === 'Backspace') && !isInputFocused()) {
            if (state.selectedImages.size > 0) {
                showDeleteModal(Array.from(state.selectedImages));
            }
        }
    });

    // Click outside modal to close
    [elements.detailModal, elements.renameModal, elements.deleteModal, elements.fallbackModal].forEach(modal => {
        modal?.addEventListener('click', e => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    });
}

// Handle directory selection
async function handleSelectDirectory() {
    const result = await requestDirectoryAccess();

    if (result.success) {
        updateFileSystemStatus({
            icon: '📂',
            path: result.handle.name,
            permission: '✓',
            permissionClass: 'granted',
            method: 'File System Access API',
            methodClass: 'direct',
            hasAccess: true,
        });

        await refreshImages();
    } else {
        if (result.error !== 'User cancelled directory selection') {
            showToast(result.error, 'error');
        }
    }
}

// Handle refresh
async function handleRefresh() {
    if (!state.directoryHandle) {
        showToast('No directory selected', 'warning');
        return;
    }

    const hasPermission = await verifyPermission();
    if (!hasPermission) {
        updateFileSystemStatus({
            icon: '📂',
            path: state.directoryHandle.name,
            permission: '⚠️ Stale',
            permissionClass: 'stale',
            method: 'File System Access API',
            methodClass: 'direct',
            hasAccess: false,
        });
        showToast('Permission expired. Click to re-authorize.', 'warning');
        return;
    }

    await refreshImages();
}

// Refresh image list
async function refreshImages() {
    showLoading('Scanning for images...');
    resetState();

    const scanResult = await scanDirectory((count, _filename) => {
        showLoading(`Scanning... ${count} images found`);
    });

    if (!scanResult.success) {
        showToast(scanResult.error, 'error');
        return;
    }

    // Load ground truth entries
    await loadGroundTruth();

    // Sync with ground truth
    const { images, orphaned } = syncImagesWithGroundTruth(scanResult.images);

    // Store ground truth data in images
    images.forEach(img => {
        if (hasGroundTruthEntry(img.path)) {
            img.groundTruthData = getGroundTruthEntry(img.path);
        }
    });

    state.images = images;

    // Add orphaned entries
    orphaned.forEach(o => addOrphanedEntry(o.path, o.data));

    // Apply filters and render
    applyFilters();
    renderGrid();
    renderStats();

    showToast(`Found ${images.length} images, ${orphaned.length} orphaned entries`, 'success');
}

// Handle filter changes
function handleFilterChange() {
    const elements = getElements();

    state.filters.source = elements.sourceFilter?.value || 'all';
    state.filters.status = elements.statusFilter?.value || 'all';
    state.filters.search = elements.searchInput?.value || '';
    state.filters.sort = elements.sortSelect?.value || 'name-asc';

    applyFilters();
    renderGrid();
    renderStats();
}

// Handle batch rename (single file when only one selected)
function handleBatchRename() {
    if (state.selectedImages.size !== 1) {
        showToast('Select exactly one image to rename', 'warning');
        return;
    }

    const path = Array.from(state.selectedImages)[0];
    const img = state.images.find(i => i.path === path);
    if (img) {
        showRenameModal(img);
    }
}

// Handle batch delete
function handleBatchDelete() {
    if (state.selectedImages.size === 0) {
        showToast('No images selected', 'warning');
        return;
    }

    showDeleteModal(Array.from(state.selectedImages));
}

// Handle rename confirmation
async function handleRenameConfirm() {
    const img = state.currentRenameImage;
    if (!img) return;

    const newFilename = document.getElementById('rename-input').value.trim();
    const validation = validateFilename(newFilename);

    if (!validation.valid) {
        updateRenameHint(validation.error, true);
        return;
    }

    if (newFilename === img.filename) {
        hideRenameModal();
        return;
    }

    // Build new path
    const parts = img.path.split('/');
    parts.pop();
    const newPath = [...parts, newFilename].join('/');

    // Check if file already exists
    const existingImage = state.images.find(i => i.path === newPath);
    if (existingImage) {
        updateRenameHint('A file with this name already exists', true);
        return;
    }

    // Try filesystem rename
    const result = await renameFile(img.path, newFilename);

    if (result.success) {
        // Update ground truth
        renameGroundTruthEntry(img.path, newPath);

        // Try to save ground truth
        const saveResult = await saveGroundTruth();
        if (!saveResult.success && saveResult.fallback) {
            // Show fallback for ground truth update
            showFallbackModal({
                description:
                    'File renamed successfully, but ground-truth.json could not be updated automatically. Download the updated file:',
                command: `# File renamed: ${img.filename} -> ${newFilename}`,
                showDownload: true,
            });
        }

        // Update local state
        img.filename = newFilename;
        img.path = newPath;

        // Update selection if necessary
        if (state.selectedImages.has(img.path)) {
            state.selectedImages.delete(img.path);
            state.selectedImages.add(newPath);
        }

        hideRenameModal();
        renderGrid();
        showToast(`Renamed to ${newFilename}`, 'success');
    } else if (result.fallback) {
        // Show fallback instructions
        hideRenameModal();
        showFallbackModal({
            description: 'Automatic rename not available. Run this command in your terminal:',
            command: generateRenameCommand(img.path, newPath),
            showDownload: true,
        });

        // Still update ground truth for download
        renameGroundTruthEntry(img.path, newPath);
    } else {
        updateRenameHint(result.error, true);
    }
}

// Handle delete confirmation
async function handleDeleteConfirm() {
    const paths = state.deleteQueue;
    if (paths.length === 0) return;

    let successCount = 0;
    const fallbackCommands = [];

    for (const path of paths) {
        const result = await deleteFile(path);

        if (result.success) {
            // Update ground truth
            deleteGroundTruthEntry(path);
            removeImage(path);
            successCount++;
        } else if (result.fallback) {
            fallbackCommands.push(generateDeleteCommand(path));
            // Still update ground truth for download
            deleteGroundTruthEntry(path);
        } else {
            showToast(`Failed to delete ${path}: ${result.error}`, 'error');
        }
    }

    hideDeleteModal();

    if (fallbackCommands.length > 0) {
        showFallbackModal({
            description: `Automatic deletion not available for ${fallbackCommands.length} file(s). Run these commands:`,
            command: fallbackCommands.join('\n'),
            showDownload: true,
        });
    }

    if (successCount > 0) {
        // Try to save ground truth
        await saveGroundTruth();

        applyFilters();
        renderGrid();
        renderStats();
        showToast(`Deleted ${successCount} file(s)`, 'success');
    }
}

// Handle export backup
function handleExportBackup() {
    createBackup();
    showToast('Backup downloaded', 'success');
}

// Handle find orphans
function handleFindOrphans() {
    state.filters.status = 'orphaned';
    const elements = getElements();
    if (elements.statusFilter) {
        elements.statusFilter.value = 'orphaned';
    }
    handleFilterChange();

    if (state.stats.orphaned === 0) {
        showToast('No orphaned entries found', 'success');
    } else {
        showToast(`Found ${state.stats.orphaned} orphaned entries`, 'warning');
    }
}

// Utility: Check if an input is focused
function isInputFocused() {
    const active = document.activeElement;
    return active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
}

// Utility: Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
