// ========================================
// MegaBonk Scan Build Module
// ========================================
// Main entry point - orchestrates scan build functionality
// Handles image upload, state management, and coordinates sub-modules
// ========================================

import type { Item, Tome, AllGameData, Character, Weapon } from '../types/index.ts';
import { ToastManager } from './toast.ts';
import { logger } from './logger.ts';
import { initOCR } from './ocr/index.ts';
import { initCV, loadItemTemplates } from './computer-vision.ts';
import { MAX_FILE_SIZE_BYTES } from './constants.ts';
import { MAX_ITEM_COUNT } from './constants.ts';
import { createMutex, createDebouncedAsync } from './async-utils.ts';
import { logError } from './error-utils.ts';
import { createEventListenerManager } from './dom-utils.ts';

// Import from sub-modules
import {
    displayUploadedImage,
    clearImageDisplay,
    showItemSelectionGrid,
    updateSelectionSummary,
    type SelectionState,
} from './scan-build-ui.ts';
import { runAutoDetect, runHybridDetect, type DetectionResults } from './scan-build-detection.ts';
import { applyDetectionResults, applyToAdvisor, getScanState, type ScanState, type BuildState } from './scan-build-results.ts';

// Re-export types for consumers
export type { ScanState, BuildState, DetectionResults };

// ========================================
// State
// ========================================
let allData: AllGameData = {};
let uploadedImage: string | null = null;
let selectedItems: Map<string, { item: Item; count: number }> = new Map();
let selectedTomes: Map<string, Tome> = new Map();
let selectedCharacter: Character | null = null;
let selectedWeapon: Weapon | null = null;
let templatesLoaded: boolean = false;
let templatesLoadError: Error | null = null;

// Event listener cleanup - use centralized manager for easy cleanup
const eventListenerManager = createEventListenerManager();

// File upload debounce - prevents race conditions from rapid uploads
const uploadDebouncer = createDebouncedAsync(processFileUploadAsync, 100);

// Race condition fix: Mutex to prevent concurrent detection runs
// Without this, multiple button clicks could start overlapping detections
const detectionMutex = createMutex('scan_detection');

// Callbacks for when build state is updated
type BuildStateCallback = (state: BuildState) => void;
let onBuildStateChange: BuildStateCallback | null = null;

// ========================================
// Helper to get current state
// ========================================
function getSelectionState(): SelectionState {
    return {
        selectedItems,
        selectedTomes,
        selectedCharacter,
        selectedWeapon,
    };
}

// ========================================
// Initialization
// ========================================

/**
 * Initialize the scan build module with game data
 */
export function initScanBuild(gameData: AllGameData, stateChangeCallback?: BuildStateCallback): void {
    allData = gameData;
    if (stateChangeCallback) {
        onBuildStateChange = stateChangeCallback;
    }

    // Initialize OCR and CV modules
    initOCR(gameData);
    initCV(gameData);

    // Preload item templates for template matching
    // Track loading status for better error handling during detection
    templatesLoaded = false;
    templatesLoadError = null;

    // Disable hybrid detect button until templates are loaded
    const hybridBtn = document.getElementById('scan-hybrid-detect-btn') as HTMLButtonElement | null;
    if (hybridBtn) {
        hybridBtn.disabled = true;
        hybridBtn.title = 'Loading item templates...';
    }

    loadItemTemplates()
        .then(() => {
            templatesLoaded = true;
            // Re-enable hybrid detect button
            if (hybridBtn) {
                hybridBtn.disabled = false;
                hybridBtn.title = '';
            }
            logger.info({
                operation: 'scan_build.templates_loaded',
                data: { success: true },
            });
        })
        .catch(error => {
            templatesLoadError = error as Error;
            // Re-enable button but show warning state
            if (hybridBtn) {
                hybridBtn.disabled = false;
                hybridBtn.title = 'Templates failed to load - reduced accuracy';
            }
            logger.error({
                operation: 'scan_build.load_templates',
                error: {
                    name: (error as Error).name,
                    message: (error as Error).message,
                    stack: (error as Error).stack?.split('\n').slice(0, 5).join(' -> '),
                },
                data: {
                    itemsCount: gameData.items?.items?.length || 0,
                    phase: 'template_preload',
                },
            });
            ToastManager.error('Failed to load item templates for recognition');
        });

    setupEventListeners();

    logger.info({
        operation: 'scan_build.init',
        data: {
            itemsCount: gameData.items?.items.length || 0,
        },
    });
}

/**
 * Cleanup event listeners to prevent memory leaks
 */
export function cleanupEventListeners(): void {
    eventListenerManager.removeAll();
}

// ========================================
// Event Listeners
// ========================================

/**
 * Setup event listeners for scan build UI
 * Uses centralized event listener manager for easy cleanup to prevent memory leaks
 */
function setupEventListeners(): void {
    // Clean up any existing listeners first
    cleanupEventListeners();

    // Upload/Camera button
    const uploadBtn = document.getElementById('scan-upload-btn');
    if (uploadBtn) eventListenerManager.addWithSignal(uploadBtn, 'click', handleUploadClick);

    // File input change
    const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
    if (fileInput) eventListenerManager.addWithSignal(fileInput, 'change', handleFileSelect);

    // Clear image button
    const clearBtn = document.getElementById('scan-clear-image');
    if (clearBtn) eventListenerManager.addWithSignal(clearBtn, 'click', clearUploadedImage);

    // Apply to advisor button
    const applyBtn = document.getElementById('scan-apply-to-advisor');
    if (applyBtn) eventListenerManager.addWithSignal(applyBtn, 'click', handleApplyToAdvisor);

    // Auto-detect button (OCR)
    const autoDetectBtn = document.getElementById('scan-auto-detect-btn');
    if (autoDetectBtn) eventListenerManager.addWithSignal(autoDetectBtn, 'click', handleAutoDetect);

    // Hybrid detect button (OCR + CV)
    const hybridDetectBtn = document.getElementById('scan-hybrid-detect-btn');
    if (hybridDetectBtn) eventListenerManager.addWithSignal(hybridDetectBtn, 'click', handleHybridDetect);
}

// ========================================
// File Upload Handlers
// ========================================

/**
 * Handle upload button click - trigger file input
 */
function handleUploadClick(): void {
    const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
    fileInput?.click();
}

/**
 * Handle file selection with debouncing to prevent race conditions
 */
async function handleFileSelect(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
        ToastManager.error('Please select an image file');
        return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
        ToastManager.error(`Image size must be less than ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`);
        return;
    }

    // Debounce file reads to prevent race conditions from rapid uploads
    uploadDebouncer.call(file);
}

/**
 * Process file upload after debounce (async version for debouncer)
 * Note: The debouncer handles stale check internally
 */
async function processFileUploadAsync(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            // Read file as data URL
            const reader = new FileReader();
            reader.onload = event => {
                const result = event.target?.result;
                if (typeof result === 'string') {
                    uploadedImage = result;
                    displayUploadedImage(uploadedImage, eventListenerManager, clearUploadedImage);
                    showGrid();
                    ToastManager.success('Image uploaded! Now select the items you see');
                    resolve();
                } else {
                    ToastManager.error('Failed to read image as data URL');
                    reject(new Error('Failed to read image as data URL'));
                }
            };
            reader.onerror = () => {
                ToastManager.error('Failed to read image file');
                reject(new Error('Failed to read image file'));
            };
            reader.readAsDataURL(file);

            logger.info({
                operation: 'scan_build.image_uploaded',
                data: {
                    fileName: file.name,
                    fileSize: file.size,
                    fileType: file.type,
                },
            });
        } catch (error) {
            logError('scan_build.upload_error', error);
            ToastManager.error('Failed to upload image');
            reject(error);
        }
    });
}

// ========================================
// State Management
// ========================================

/**
 * Clear uploaded image and reset state
 */
function clearUploadedImage(): void {
    uploadedImage = null;
    selectedItems.clear();
    selectedTomes.clear();
    selectedCharacter = null;
    selectedWeapon = null;

    clearImageDisplay();
    ToastManager.info('Image cleared');
}

/**
 * Update item count - called from UI
 */
function handleItemCountChange(item: Item, delta: number): number {
    const current = selectedItems.get(item.id);
    const currentCount = current?.count || 0;
    const newCount = Math.max(0, Math.min(MAX_ITEM_COUNT, currentCount + delta));

    if (newCount === 0) {
        selectedItems.delete(item.id);
    } else {
        selectedItems.set(item.id, { item, count: newCount });
    }

    return newCount;
}

/**
 * Handle character selection
 */
function handleCharacterSelect(character: Character): void {
    selectedCharacter = character;
}

/**
 * Handle weapon selection
 */
function handleWeaponSelect(weapon: Weapon): void {
    selectedWeapon = weapon;
}

/**
 * Handle tome toggle
 */
function handleTomeToggle(tome: Tome, selected: boolean): void {
    if (selected) {
        selectedTomes.set(tome.id, tome);
    } else {
        selectedTomes.delete(tome.id);
    }
}

/**
 * Update the selection summary display
 */
function updateSummary(): void {
    updateSelectionSummary(getSelectionState());
}

/**
 * Show the item selection grid
 */
function showGrid(): void {
    showItemSelectionGrid(
        allData,
        handleCharacterSelect,
        handleWeaponSelect,
        handleItemCountChange,
        handleTomeToggle,
        updateSummary
    );
}

// ========================================
// Detection Handlers
// ========================================

/**
 * Handle detection results - apply to state and UI
 */
function handleDetectionResults(results: DetectionResults): void {
    applyDetectionResults(results, allData, getSelectionState(), showGrid, updateSummary);
}

/**
 * Handle auto-detect button click - use OCR to detect items
 */
async function handleAutoDetect(): Promise<void> {
    if (!uploadedImage) {
        ToastManager.error('Please upload an image first');
        return;
    }

    await runAutoDetect(uploadedImage, detectionMutex, handleDetectionResults);
}

/**
 * Handle hybrid detect button click - use OCR + CV together
 */
async function handleHybridDetect(): Promise<void> {
    if (!uploadedImage) {
        ToastManager.error('Please upload an image first');
        return;
    }

    await runHybridDetect(
        uploadedImage,
        detectionMutex,
        templatesLoaded,
        templatesLoadError,
        handleDetectionResults
    );
}

// ========================================
// Apply to Advisor
// ========================================

/**
 * Handle apply to advisor button click
 */
function handleApplyToAdvisor(): void {
    applyToAdvisor(getSelectionState(), onBuildStateChange);
}

// ========================================
// Public API
// ========================================

/**
 * Get current scan state
 */
export function getState(): ScanState {
    return getScanState(getSelectionState());
}

// Legacy alias for backward compatibility
export { getState as getScanState };

/**
 * Reset module state for testing
 */
export function __resetForTesting(): void {
    // Clean up event listeners to prevent memory leaks
    cleanupEventListeners();

    // Cancel any pending upload debounce
    uploadDebouncer.cancel();

    // Release mutex if held (should be released, but just in case)
    if (detectionMutex.isLocked()) {
        detectionMutex.release();
    }

    allData = {};
    uploadedImage = null;
    selectedItems = new Map();
    selectedTomes = new Map();
    selectedCharacter = null;
    selectedWeapon = null;
    onBuildStateChange = null;
    templatesLoaded = false;
    templatesLoadError = null;
}

// ========================================
// Global Assignments
// ========================================
window.initScanBuild = initScanBuild;

// ========================================
// Self-Initialization for Lazy Loading
// ========================================
// When this module is lazily loaded (e.g., when advisor tab is first visited),
// data may already be available. Initialize immediately if so.
// This fixes a race condition where data loads before the module is imported.
(async function selfInit() {
    // Dynamic import to avoid circular dependency
    const { getAllData } = await import('./data-service.ts');
    const existingData = getAllData();

    // If data is already loaded and we haven't been initialized yet
    if (existingData && Object.keys(existingData).length > 0 && Object.keys(allData).length === 0) {
        initScanBuild(existingData);
        logger.debug({
            operation: 'scan_build.self_init',
            data: { itemsCount: existingData.items?.items?.length || 0 },
        });
    }
})();
