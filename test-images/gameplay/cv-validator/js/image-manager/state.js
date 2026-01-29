/* ========================================
 * Image Manager - State Management
 * Centralized state for image browser
 * ======================================== */

// Application state
export const state = {
    // File System Access API handle
    directoryHandle: null,
    hasFileSystemAccess: false,

    // Ground truth data
    groundTruth: {},

    // Image data
    images: [], // Array of { filename, path, source, status, itemCount, resolution, lastModified }
    filteredImages: [],

    // Selection state
    selectedImages: new Set(),

    // Filter state
    filters: {
        source: 'all',
        status: 'all',
        search: '',
        sort: 'name-asc',
    },

    // Statistics
    stats: {
        total: 0,
        labeled: 0,
        unlabeled: 0,
        orphaned: 0,
        filtered: 0,
    },

    // Modal state
    currentDetailImage: null,
    currentRenameImage: null,
    deleteQueue: [],

    // Loading state
    isLoading: false,
    isScanning: false,
};

// Reset state
export function resetState() {
    state.images = [];
    state.filteredImages = [];
    state.selectedImages.clear();
    state.stats = {
        total: 0,
        labeled: 0,
        unlabeled: 0,
        orphaned: 0,
        filtered: 0,
    };
}

// Update statistics
export function updateStats() {
    state.stats.total = state.images.length;
    state.stats.labeled = state.images.filter(img => img.status === 'labeled').length;
    state.stats.unlabeled = state.images.filter(img => img.status === 'unlabeled').length;
    state.stats.orphaned = state.images.filter(img => img.status === 'orphaned').length;
    state.stats.filtered = state.filteredImages.length;
}

// Apply filters
export function applyFilters() {
    let filtered = [...state.images];

    // Source filter
    if (state.filters.source !== 'all') {
        filtered = filtered.filter(img => img.source === state.filters.source);
    }

    // Status filter
    if (state.filters.status !== 'all') {
        filtered = filtered.filter(img => img.status === state.filters.status);
    }

    // Search filter
    if (state.filters.search) {
        const search = state.filters.search.toLowerCase();
        filtered = filtered.filter(img => img.filename.toLowerCase().includes(search));
    }

    // Sorting
    filtered.sort((a, b) => {
        switch (state.filters.sort) {
            case 'name-asc':
                return a.filename.localeCompare(b.filename);
            case 'name-desc':
                return b.filename.localeCompare(a.filename);
            case 'date-desc':
                return (b.lastModified || 0) - (a.lastModified || 0);
            case 'date-asc':
                return (a.lastModified || 0) - (b.lastModified || 0);
            case 'items-desc':
                return b.itemCount - a.itemCount;
            case 'items-asc':
                return a.itemCount - b.itemCount;
            case 'status': {
                const statusOrder = { orphaned: 0, unlabeled: 1, labeled: 2 };
                return statusOrder[a.status] - statusOrder[b.status];
            }
            default:
                return 0;
        }
    });

    state.filteredImages = filtered;
    updateStats();
}

// Toggle image selection
export function toggleSelection(imagePath, selected) {
    if (selected) {
        state.selectedImages.add(imagePath);
    } else {
        state.selectedImages.delete(imagePath);
    }
}

// Select all visible images
export function selectAll() {
    state.filteredImages.forEach(img => {
        state.selectedImages.add(img.path);
    });
}

// Deselect all
export function deselectAll() {
    state.selectedImages.clear();
}

// Get image by path
export function getImageByPath(path) {
    return state.images.find(img => img.path === path);
}

// Update image in state
export function updateImage(path, updates) {
    const index = state.images.findIndex(img => img.path === path);
    if (index !== -1) {
        state.images[index] = { ...state.images[index], ...updates };
    }
}

// Remove image from state
export function removeImage(path) {
    state.images = state.images.filter(img => img.path !== path);
    state.selectedImages.delete(path);
}

// Add orphaned entry (ground truth without image file)
export function addOrphanedEntry(gtPath, data) {
    state.images.push({
        filename: gtPath.split('/').pop(),
        path: gtPath,
        source: getSourceFromPath(gtPath),
        status: 'orphaned',
        itemCount: data.items?.length || 0,
        resolution: null,
        lastModified: null,
        isOrphaned: true,
    });
}

// Helper to extract source from path
export function getSourceFromPath(path) {
    if (path.includes('pc-screenshots')) return 'pc-screenshots';
    if (path.includes('steam-community')) return 'steam-community';
    return 'unknown';
}
