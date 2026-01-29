/* global setTimeout */
/* ========================================
 * Image Manager - UI Renderer
 * Renders image grid, cards, and modals
 * ======================================== */

import { state, toggleSelection } from './state.js';
import { getImageResolution } from './filesystem.js';

// DOM Elements
let elements = {};

// Initialize renderer with DOM elements
export function initRenderer() {
    elements = {
        // Grid
        imageGrid: document.getElementById('image-grid'),
        loadingMessage: document.getElementById('loading-message'),
        emptyState: document.getElementById('empty-state'),

        // Stats
        statTotal: document.getElementById('stat-total'),
        statLabeled: document.getElementById('stat-labeled'),
        statUnlabeled: document.getElementById('stat-unlabeled'),
        statOrphaned: document.getElementById('stat-orphaned'),
        statFiltered: document.getElementById('stat-filtered'),

        // Toolbar
        selectAllCheckbox: document.getElementById('select-all-checkbox'),
        selectionCount: document.getElementById('selection-count'),
        batchRenameBtn: document.getElementById('batch-rename-btn'),
        batchDeleteBtn: document.getElementById('batch-delete-btn'),
        exportBackupBtn: document.getElementById('export-backup-btn'),
        findOrphansBtn: document.getElementById('find-orphans-btn'),
        refreshBtn: document.getElementById('refresh-btn'),
        selectDirectoryBtn: document.getElementById('select-directory-btn'),

        // Filters
        sourceFilter: document.getElementById('source-filter'),
        statusFilter: document.getElementById('status-filter'),
        searchInput: document.getElementById('search-input'),
        sortSelect: document.getElementById('sort-select'),

        // File System Status
        fsIcon: document.getElementById('fs-icon'),
        fsPath: document.getElementById('fs-path'),
        fsPermission: document.getElementById('fs-permission'),
        fsMethod: document.getElementById('fs-method'),

        // Modals
        detailModal: document.getElementById('detail-modal'),
        renameModal: document.getElementById('rename-modal'),
        deleteModal: document.getElementById('delete-modal'),
        fallbackModal: document.getElementById('fallback-modal'),

        // Fullscreen
        fullscreenOverlay: document.getElementById('fullscreen-overlay'),
        fullscreenImage: document.getElementById('fullscreen-image'),
        fullscreenClose: document.getElementById('fullscreen-close'),

        // Toast
        toast: document.getElementById('toast'),
        toastIcon: document.getElementById('toast-icon'),
        toastMessage: document.getElementById('toast-message'),
    };

    // Setup fullscreen handlers
    setupFullscreenHandlers();
}

// Setup fullscreen image handlers
function setupFullscreenHandlers() {
    // Click on detail preview to open fullscreen
    const detailPreview = document.querySelector('.detail-preview');
    if (detailPreview) {
        detailPreview.addEventListener('click', () => {
            const detailImage = document.getElementById('detail-image');
            if (detailImage && detailImage.src) {
                showFullscreen(detailImage.src);
            }
        });
    }

    // Close fullscreen on button click
    if (elements.fullscreenClose) {
        elements.fullscreenClose.addEventListener('click', hideFullscreen);
    }

    // Close fullscreen on overlay click
    if (elements.fullscreenOverlay) {
        elements.fullscreenOverlay.addEventListener('click', e => {
            if (e.target === elements.fullscreenOverlay || e.target === elements.fullscreenImage) {
                hideFullscreen();
            }
        });
    }

    // Close fullscreen on Escape key
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && elements.fullscreenOverlay?.classList.contains('show')) {
            hideFullscreen();
        }
    });
}

// Show fullscreen image
function showFullscreen(src) {
    if (elements.fullscreenImage) {
        elements.fullscreenImage.src = src;
    }
    if (elements.fullscreenOverlay) {
        elements.fullscreenOverlay.classList.add('show');
    }
}

// Hide fullscreen image
function hideFullscreen() {
    if (elements.fullscreenOverlay) {
        elements.fullscreenOverlay.classList.remove('show');
    }
}

// Render the image grid
export function renderGrid() {
    const { imageGrid, loadingMessage, emptyState } = elements;

    // Hide loading message
    if (loadingMessage) loadingMessage.style.display = 'none';

    // Clear existing cards
    const existingCards = imageGrid.querySelectorAll('.image-card');
    existingCards.forEach(card => card.remove());

    // Show empty state if no images
    if (state.filteredImages.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    // Render image cards
    state.filteredImages.forEach(img => {
        const card = createImageCard(img);
        imageGrid.appendChild(card);
    });

    updateSelectionUI();
}

// Create an image card element
function createImageCard(img) {
    const card = document.createElement('div');
    card.className = 'image-card';
    card.dataset.path = img.path;

    if (state.selectedImages.has(img.path)) {
        card.classList.add('selected');
    }

    const resolution = img.resolution ? `${img.resolution.width}x${img.resolution.height}` : '?';

    card.innerHTML = `
        <div class="card-checkbox">
            <input type="checkbox" ${state.selectedImages.has(img.path) ? 'checked' : ''}>
        </div>
        <div class="card-thumbnail">
            <img src="${img.path}" alt="${img.filename}" loading="lazy" onerror="this.parentElement.innerHTML='<span class=\\'placeholder\\'>Failed to load</span>'">
        </div>
        <div class="card-info">
            <div class="card-filename" title="${img.filename}">${img.filename}</div>
            <div class="card-source">${img.source}/</div>
            <div class="card-meta">
                <div class="card-status">
                    <span class="status-dot ${img.status}"></span>
                    <span>${img.status}</span>
                </div>
                <span class="card-items">${img.itemCount} items</span>
                <span class="card-resolution">${resolution}</span>
            </div>
        </div>
        <div class="card-actions">
            <button class="card-action-btn view-btn" title="View Details">👁️</button>
            <button class="card-action-btn rename-btn" title="Rename">✏️</button>
            <button class="card-action-btn danger delete-btn" title="Delete">🗑️</button>
        </div>
    `;

    // Event listeners
    const checkbox = card.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('click', e => {
        e.stopPropagation();
        toggleSelection(img.path, checkbox.checked);
        card.classList.toggle('selected', checkbox.checked);
        updateSelectionUI();
    });

    card.querySelector('.view-btn').addEventListener('click', e => {
        e.stopPropagation();
        showDetailModal(img);
    });

    card.querySelector('.rename-btn').addEventListener('click', e => {
        e.stopPropagation();
        showRenameModal(img);
    });

    card.querySelector('.delete-btn').addEventListener('click', e => {
        e.stopPropagation();
        showDeleteModal([img.path]);
    });

    card.addEventListener('click', e => {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
            showDetailModal(img);
        }
    });

    return card;
}

// Update statistics display
export function renderStats() {
    if (elements.statTotal) elements.statTotal.textContent = state.stats.total;
    if (elements.statLabeled) elements.statLabeled.textContent = state.stats.labeled;
    if (elements.statUnlabeled) elements.statUnlabeled.textContent = state.stats.unlabeled;
    if (elements.statOrphaned) elements.statOrphaned.textContent = state.stats.orphaned;
    if (elements.statFiltered) elements.statFiltered.textContent = state.stats.filtered;
}

// Update selection UI
export function updateSelectionUI() {
    const count = state.selectedImages.size;
    if (elements.selectionCount) {
        elements.selectionCount.textContent = `${count} selected`;
    }

    // Enable/disable batch action buttons
    const hasSelection = count > 0;
    if (elements.batchRenameBtn) elements.batchRenameBtn.disabled = !hasSelection || count > 1;
    if (elements.batchDeleteBtn) elements.batchDeleteBtn.disabled = !hasSelection;

    // Update select all checkbox
    if (elements.selectAllCheckbox) {
        const allSelected =
            state.filteredImages.length > 0 && state.filteredImages.every(img => state.selectedImages.has(img.path));
        elements.selectAllCheckbox.checked = allSelected;
        elements.selectAllCheckbox.indeterminate = count > 0 && !allSelected;
    }
}

// Update file system status bar
export function updateFileSystemStatus(status) {
    if (elements.fsIcon) elements.fsIcon.textContent = status.icon || '📁';
    if (elements.fsPath) {
        elements.fsPath.textContent = status.path || 'No directory selected';
        elements.fsPath.classList.toggle('has-dir', !!status.path);
    }
    if (elements.fsPermission) {
        elements.fsPermission.textContent = status.permission || '';
        elements.fsPermission.className = 'fs-permission';
        if (status.permissionClass) {
            elements.fsPermission.classList.add(status.permissionClass);
        }
    }
    if (elements.fsMethod) {
        elements.fsMethod.textContent = status.method || '';
        elements.fsMethod.className = 'fs-method';
        if (status.methodClass) {
            elements.fsMethod.classList.add(status.methodClass);
        }
    }

    // Enable toolbar buttons - they work in read-only mode too (backup downloads, find orphans, etc.)
    // Refresh only needs directory access for write operations
    if (elements.refreshBtn) elements.refreshBtn.disabled = false;
    if (elements.exportBackupBtn) elements.exportBackupBtn.disabled = false;
    if (elements.findOrphansBtn) elements.findOrphansBtn.disabled = false;
}

// Show loading state
export function showLoading(message = 'Loading...') {
    if (elements.loadingMessage) {
        elements.loadingMessage.innerHTML = `<p>${message}</p>`;
        elements.loadingMessage.style.display = 'block';
    }
    if (elements.emptyState) elements.emptyState.style.display = 'none';
}

// Hide loading state
export function hideLoading() {
    if (elements.loadingMessage) {
        elements.loadingMessage.style.display = 'none';
    }
}

// Show detail modal
export function showDetailModal(img) {
    state.currentDetailImage = img;

    document.getElementById('detail-filename').textContent = img.filename;
    document.getElementById('detail-path').textContent = img.path;

    // Setup detail image with error handling for orphaned/missing files
    const detailImg = document.getElementById('detail-image');
    detailImg.onerror = () => {
        // Use a placeholder SVG for broken images
        detailImg.src =
            'data:image/svg+xml,' +
            encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">' +
                    '<rect fill="#1a1a2e" width="400" height="300"/>' +
                    '<text x="200" y="140" text-anchor="middle" fill="#666" font-family="sans-serif" font-size="16">Image file not found</text>' +
                    '<text x="200" y="170" text-anchor="middle" fill="#888" font-family="sans-serif" font-size="12">📁 File missing from disk</text>' +
                    '</svg>'
            );
    };
    detailImg.src = img.path;

    // Handle resolution - load on-demand for non-orphaned images
    const resolutionSpan = document.getElementById('detail-resolution');
    const isOrphaned = img.isOrphaned || img.status === 'orphaned';

    if (isOrphaned) {
        resolutionSpan.textContent = 'N/A (file missing)';
    } else if (img.resolution) {
        resolutionSpan.textContent = `${img.resolution.width}x${img.resolution.height}`;
    } else {
        // Lazy-load resolution for non-orphaned images
        resolutionSpan.textContent = 'Loading...';
        getImageResolution(img.path).then(res => {
            if (res) {
                resolutionSpan.textContent = `${res.width}x${res.height}`;
                // Cache the resolution on the image object
                img.resolution = res;
            } else {
                resolutionSpan.textContent = 'Unknown';
            }
        });
    }

    const statusSpan = document.getElementById('detail-status');
    statusSpan.textContent = img.status;
    statusSpan.className = img.status;

    // Show orphaned warning if applicable
    const orphanedRow = document.getElementById('detail-orphaned-row');
    if (orphanedRow) {
        orphanedRow.style.display = isOrphaned ? 'flex' : 'none';
    }

    document.getElementById('detail-items').textContent = `${img.itemCount} items`;

    // Show notes if available
    const notesRow = document.getElementById('detail-notes-row');
    const notesSpan = document.getElementById('detail-notes');
    if (img.groundTruthData?.notes) {
        notesRow.style.display = 'flex';
        notesSpan.textContent = img.groundTruthData.notes;
    } else {
        notesRow.style.display = 'none';
    }

    // Show difficulty if available
    const difficultyRow = document.getElementById('detail-difficulty-row');
    const difficultySpan = document.getElementById('detail-difficulty');
    if (img.groundTruthData?.difficulty) {
        difficultyRow.style.display = 'flex';
        difficultySpan.textContent = img.groundTruthData.difficulty;
    } else {
        difficultyRow.style.display = 'none';
    }

    elements.detailModal.classList.add('show');
}

// Hide detail modal
export function hideDetailModal() {
    elements.detailModal.classList.remove('show');
    state.currentDetailImage = null;
    // Reset inline edit mode when closing
    exitInlineEditMode();
}

// Enter inline edit mode for filename in detail modal
export function enterInlineEditMode() {
    const filenameH3 = document.getElementById('detail-filename');
    const filenameInput = document.getElementById('detail-filename-input');
    const filenameExt = document.getElementById('detail-filename-ext');
    const editBtn = document.getElementById('detail-edit-name-btn');
    const confirmBtn = document.getElementById('detail-confirm-name-btn');
    const cancelBtn = document.getElementById('detail-cancel-name-btn');

    if (!filenameH3 || !filenameInput) return;

    // Extract base name without extension
    const fullFilename = filenameH3.textContent;
    const lastDot = fullFilename.lastIndexOf('.');
    const baseName = lastDot > 0 ? fullFilename.substring(0, lastDot) : fullFilename;
    const extension = lastDot > 0 ? fullFilename.substring(lastDot) : '';

    // Hide h3, show input and extension
    filenameH3.classList.add('hidden');
    filenameInput.classList.remove('hidden');
    filenameInput.value = baseName;
    filenameInput.dataset.extension = extension;

    // Show extension label
    if (filenameExt && extension) {
        filenameExt.textContent = extension;
        filenameExt.classList.remove('hidden');
    }

    // Hide edit button, show confirm/cancel
    editBtn.classList.add('hidden');
    confirmBtn.classList.remove('hidden');
    cancelBtn.classList.remove('hidden');

    // Focus and select input
    filenameInput.focus();
    filenameInput.select();
}

// Get the full filename from inline edit (base name + stored extension)
export function getInlineEditFilename() {
    const filenameInput = document.getElementById('detail-filename-input');
    if (!filenameInput) return '';
    const baseName = filenameInput.value.trim();
    const extension = filenameInput.dataset.extension || '';
    return baseName + extension;
}

// Exit inline edit mode (cancel)
export function exitInlineEditMode() {
    const filenameH3 = document.getElementById('detail-filename');
    const filenameInput = document.getElementById('detail-filename-input');
    const filenameExt = document.getElementById('detail-filename-ext');
    const editBtn = document.getElementById('detail-edit-name-btn');
    const confirmBtn = document.getElementById('detail-confirm-name-btn');
    const cancelBtn = document.getElementById('detail-cancel-name-btn');

    if (!filenameH3 || !filenameInput) return;

    // Show h3, hide input and extension
    filenameH3.classList.remove('hidden');
    filenameInput.classList.add('hidden');
    if (filenameExt) filenameExt.classList.add('hidden');

    // Show edit button, hide confirm/cancel
    editBtn.classList.remove('hidden');
    confirmBtn.classList.add('hidden');
    cancelBtn.classList.add('hidden');
}

// Update detail modal filename after successful rename
export function updateDetailFilename(newFilename) {
    const filenameH3 = document.getElementById('detail-filename');
    const filenameExt = document.getElementById('detail-filename-ext');
    if (filenameH3) {
        filenameH3.textContent = newFilename;
    }
    // Hide extension span before exiting (it will show full filename in h3)
    if (filenameExt) filenameExt.classList.add('hidden');
    exitInlineEditMode();
}

// Show rename modal
export function showRenameModal(img) {
    state.currentRenameImage = img;

    document.getElementById('rename-current').textContent = img.filename;
    const input = document.getElementById('rename-input');
    input.value = img.filename;
    input.focus();
    input.select();

    document.getElementById('rename-hint').textContent = '';
    document.getElementById('rename-hint').className = 'form-hint';

    elements.renameModal.classList.add('show');
}

// Hide rename modal
export function hideRenameModal() {
    elements.renameModal.classList.remove('show');
    state.currentRenameImage = null;
}

// Update rename hint
export function updateRenameHint(message, isError = false) {
    const hint = document.getElementById('rename-hint');
    hint.textContent = message;
    hint.className = isError ? 'form-hint error' : 'form-hint';
}

// Show delete confirmation modal
export function showDeleteModal(paths) {
    state.deleteQueue = paths;

    const list = document.getElementById('delete-list');
    list.innerHTML = paths.map(path => `<div class="delete-list-item"><span>📄</span> ${path}</div>`).join('');

    elements.deleteModal.classList.add('show');
}

// Hide delete modal
export function hideDeleteModal() {
    elements.deleteModal.classList.remove('show');
    state.deleteQueue = [];
}

// Show fallback modal (for manual operations)
export function showFallbackModal(options) {
    document.getElementById('fallback-description').textContent = options.description;
    document.getElementById('fallback-command').textContent = options.command;

    const downloadSection = document.getElementById('fallback-download-section');
    if (options.showDownload) {
        downloadSection.style.display = 'block';
    } else {
        downloadSection.style.display = 'none';
    }

    elements.fallbackModal.classList.add('show');
}

// Hide fallback modal
export function hideFallbackModal() {
    elements.fallbackModal.classList.remove('show');
}

// Show toast notification
export function showToast(message, type = 'info', duration = 3000) {
    const icons = {
        success: '✓',
        error: '✗',
        warning: '⚠',
        info: 'ℹ',
    };

    elements.toastIcon.textContent = icons[type] || icons.info;
    elements.toastMessage.textContent = message;

    elements.toast.className = 'toast show ' + type;

    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, duration);
}

// Get DOM elements reference
export function getElements() {
    return elements;
}
