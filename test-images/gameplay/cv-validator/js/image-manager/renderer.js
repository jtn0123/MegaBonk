/* global setTimeout */
/* ========================================
 * Image Manager - UI Renderer
 * Renders image grid, cards, and modals
 * ======================================== */

import { state, toggleSelection } from './state.js';

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

        // Toast
        toast: document.getElementById('toast'),
        toastIcon: document.getElementById('toast-icon'),
        toastMessage: document.getElementById('toast-message'),
    };
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

    // Enable/disable toolbar buttons
    const hasAccess = status.hasAccess;
    if (elements.refreshBtn) elements.refreshBtn.disabled = !hasAccess;
    if (elements.exportBackupBtn) elements.exportBackupBtn.disabled = !hasAccess;
    if (elements.findOrphansBtn) elements.findOrphansBtn.disabled = !hasAccess;
}

// Show loading state
export function showLoading(message = 'Loading...') {
    if (elements.loadingMessage) {
        elements.loadingMessage.innerHTML = `<p>${message}</p>`;
        elements.loadingMessage.style.display = 'block';
    }
    if (elements.emptyState) elements.emptyState.style.display = 'none';
}

// Show detail modal
export function showDetailModal(img) {
    state.currentDetailImage = img;

    document.getElementById('detail-filename').textContent = img.filename;
    document.getElementById('detail-path').textContent = img.path;
    document.getElementById('detail-image').src = img.path;

    const resolution = img.resolution ? `${img.resolution.width}x${img.resolution.height}` : 'Unknown';
    document.getElementById('detail-resolution').textContent = resolution;

    const statusSpan = document.getElementById('detail-status');
    statusSpan.textContent = img.status;
    statusSpan.className = img.status;

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
