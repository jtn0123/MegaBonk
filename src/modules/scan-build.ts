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
import {
    addCorrection,
    initActiveLearning,
    initCV,
    loadItemTemplates,
    startFeedbackSession,
    clearFeedbackSession,
} from './computer-vision.ts';
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
    updateItemCardCount,
    type SelectionState,
} from './scan-build-ui.ts';
import { runAutoDetect, runHybridDetect } from './scan-build-detection.ts';
import {
    applyDetectionResults,
    applyItemCorrection,
    applyToAdvisor,
    createDisplayDetectionResult,
    getTrustSummary,
    getScanState,
    markDetectionReviewed,
    resetDetectionReviewState,
    setDetectionReviewActions,
    type ScanState,
    type BuildState,
    type DisplayDetectionResult,
    type DetectionResults,
} from './scan-build-results.ts';
import {
    analyzeScanPreflight,
    clearScanPreflightReport,
    renderScanPreflightReport,
    type ScanPreflightReport,
} from './scan-build-preflight.ts';
import {
    abandonCurrentScanSession,
    clearCurrentScanSession,
    exportStoredScanReports,
    finalizeScanSession,
    recordDetectionSummary,
    recordPreflight,
    startScanSession,
} from './scan-build-session.ts';
import { openScanCorrectionModal, type ScanCorrection } from './scan-build-corrections.ts';
import {
    compareStrategiesOnImage,
    handleEnhancedHybridDetect,
    initEnhancedScanBuild,
    type EnhancedHybridResult,
} from './scan-build-enhanced.ts';

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
let currentPreflightReport: ScanPreflightReport | null = null;
let enhancedCVReady = false;
let enhancedCVInitError: Error | null = null;
let pendingDetectionMethod: 'ocr' | 'hybrid' | 'enhanced_hybrid' | null = null;

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
 * Initialize the scan build module with game data.
 *
 * Sets up OCR and CV engines, preloads item templates for template matching,
 * and attaches all DOM event listeners for the scan-build UI.
 *
 * @param gameData - The full game data object containing items, tomes, characters, and weapons.
 * @param stateChangeCallback - Optional callback invoked whenever the build state changes
 *   (e.g., after applying detection results to the advisor).
 *
 * @example
 * ```ts
 * import { initScanBuild } from './scan-build.ts';
 *
 * const gameData = await fetchGameData();
 * initScanBuild(gameData, (buildState) => {
 *   console.log('Build updated:', buildState);
 * });
 * ```
 */
export function initScanBuild(gameData: AllGameData, stateChangeCallback?: BuildStateCallback): void {
    allData = gameData;
    if (stateChangeCallback) {
        onBuildStateChange = stateChangeCallback;
    }

    // Initialize OCR and CV modules
    initOCR(gameData);
    initCV(gameData);
    initActiveLearning(gameData);
    setDetectionReviewActions({
        onOpenCorrection: handleOpenCorrection,
    });

    void initEnhancedScanBuild(gameData)
        .then(() => {
            enhancedCVReady = true;
            enhancedCVInitError = null;
        })
        .catch(error => {
            enhancedCVReady = false;
            enhancedCVInitError = error as Error;
            logger.warn({
                operation: 'scan_build.enhanced_init_failed',
                error: {
                    name: (error as Error).name,
                    message: (error as Error).message,
                },
            });
        });

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
 * Remove all event listeners registered by the scan-build module.
 *
 * Call this when tearing down the scan-build UI to prevent memory leaks.
 * Automatically called by `__resetForTesting()` and at the start of `setupEventListeners()`.
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

    const compareStrategiesBtn = document.getElementById('scan-compare-strategies-btn');
    if (compareStrategiesBtn) {
        eventListenerManager.addWithSignal(compareStrategiesBtn, 'click', handleCompareStrategies);
    }

    const exportReportBtn = document.getElementById('scan-export-report-btn');
    if (exportReportBtn) {
        eventListenerManager.addWithSignal(exportReportBtn, 'click', handleExportReport);
    }
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
            startScanSession({
                name: file.name,
                size: file.size,
                type: file.type,
            });

            // Read file as data URL
            const reader = new FileReader();
            reader.onload = async event => {
                const result = event.target?.result;
                if (typeof result === 'string') {
                    uploadedImage = result;
                    displayUploadedImage(uploadedImage, eventListenerManager, clearUploadedImage);
                    showGrid();
                    await runPreflightForCurrentImage(true);
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
    currentPreflightReport = null;
    resetDetectionReviewState();
    clearFeedbackSession();
    clearScanPreflightReport();
    abandonCurrentScanSession();

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

    markDetectionReviewed('item', item.id);

    return newCount;
}

/**
 * Handle character selection
 */
function handleCharacterSelect(character: Character): void {
    selectedCharacter = character;
    markDetectionReviewed('character', character.id);
}

/**
 * Handle weapon selection
 */
function handleWeaponSelect(weapon: Weapon): void {
    selectedWeapon = weapon;
    markDetectionReviewed('weapon', weapon.id);
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

    markDetectionReviewed('tome', tome.id);
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
    if (pendingDetectionMethod) {
        recordDetectionSummary(pendingDetectionMethod, results, getTrustSummary());
        pendingDetectionMethod = null;
    }
}

function mapEnhancedResults(results: EnhancedHybridResult): DetectionResults {
    return {
        items: results.items.map(result =>
            createDisplayDetectionResult(
                {
                    type: 'item',
                    entity: result.entity as Item,
                    confidence: result.confidence,
                    rawText: `enhanced_${result.entity.name}`,
                    count: result.count,
                },
                'hybrid',
                ['enhanced strategy']
            )
        ),
        tomes: results.tomes.map(result =>
            createDisplayDetectionResult(
                {
                    type: 'tome',
                    entity: result.entity as Tome,
                    confidence: result.confidence,
                    rawText: `enhanced_${result.entity.name}`,
                },
                'hybrid',
                ['enhanced strategy']
            )
        ),
        character: results.character ? createDisplayDetectionResult(results.character, 'ocr') : null,
        weapon: results.weapon ? createDisplayDetectionResult(results.weapon, 'ocr') : null,
    };
}

async function runPreflightForCurrentImage(force: boolean = false): Promise<ScanPreflightReport | null> {
    if (!uploadedImage) return null;
    if (currentPreflightReport && !force) {
        return currentPreflightReport;
    }

    try {
        const report = await analyzeScanPreflight(uploadedImage);
        currentPreflightReport = report;
        renderScanPreflightReport(report);
        recordPreflight(report);
        startFeedbackSession(uploadedImage, report.imageWidth, report.imageHeight);
        return report;
    } catch (error) {
        logger.warn({
            operation: 'scan_build.preflight_failed',
            error: {
                name: (error as Error).name,
                message: (error as Error).message,
            },
        });
        ToastManager.warning('Preflight could not analyze this screenshot. Detection can still continue.');
        return null;
    }
}

async function maybeWarnForPreflight(): Promise<void> {
    const report = await runPreflightForCurrentImage();
    if (!report) return;

    if (report.status === 'high_risk') {
        ToastManager.warning('Preflight flagged this screenshot as high risk. Detection may need manual correction.');
    } else if (report.status === 'warn') {
        ToastManager.info('Preflight found some scan risks. Review flagged detections after running CV.');
    }
}

async function handleOpenCorrection(result: DisplayDetectionResult): Promise<void> {
    if (!uploadedImage || result.type !== 'item') return;

    const allItems = allData.items?.items || [];
    if (allItems.length === 0) {
        ToastManager.error('No items available for correction');
        return;
    }

    await openScanCorrectionModal({
        detection: result,
        allItems,
        imageDataUrl: uploadedImage,
        onSubmit: applyExplicitCorrection,
    });
}

async function applyExplicitCorrection(correction: ScanCorrection): Promise<void> {
    const correctedItem = allData.items?.items?.find(item => item.id === correction.correctedItemId);
    if (!correctedItem) {
        ToastManager.error('Corrected item was not found in game data');
        return;
    }

    const currentDetected = selectedItems.get(correction.detectedItemId);
    const correctionCount = Math.max(1, correction.count || 1);
    const currentDetectedCount = currentDetected?.count || 0;
    const remainingDetectedCount = Math.max(0, currentDetectedCount - correctionCount);

    if (remainingDetectedCount === 0) {
        selectedItems.delete(correction.detectedItemId);
    } else if (currentDetected) {
        selectedItems.set(correction.detectedItemId, {
            item: currentDetected.item,
            count: remainingDetectedCount,
        });
    }
    updateItemCardCount(correction.detectedItemId, remainingDetectedCount);

    const existingCorrected = selectedItems.get(correctedItem.id);
    const nextCorrectedCount = (existingCorrected?.count || 0) + correctionCount;
    selectedItems.set(correctedItem.id, { item: correctedItem, count: nextCorrectedCount });
    updateItemCardCount(correctedItem.id, nextCorrectedCount);

    applyItemCorrection(correction.detectedItemId, correctedItem);

    await addCorrection(
        {
            detectedItemId: correction.detectedItemId,
            detectedItemName: correction.detectedItemName,
            confidence: correction.confidence,
            x: correction.crop?.x || 0,
            y: correction.crop?.y || 0,
            width: correction.crop?.width || 0,
            height: correction.crop?.height || 0,
            cropDataUrl: correction.crop?.dataUrl,
        },
        correctedItem
    );

    updateSummary();
    ToastManager.success(`Corrected ${correction.detectedItemName} to ${correction.correctedItemName}`);
}

/**
 * Handle auto-detect button click - use OCR to detect items
 */
async function handleAutoDetect(): Promise<void> {
    if (!uploadedImage) {
        ToastManager.error('Please upload an image first');
        return;
    }

    await maybeWarnForPreflight();
    pendingDetectionMethod = 'ocr';
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

    await maybeWarnForPreflight();
    const useEnhancedHybrid = (document.getElementById('scan-use-enhanced-hybrid') as HTMLInputElement | null)?.checked;

    if (useEnhancedHybrid) {
        pendingDetectionMethod = 'enhanced_hybrid';
        if (!enhancedCVReady) {
            if (enhancedCVInitError) {
                ToastManager.warning(
                    'Enhanced CV is unavailable right now. Falling back to the standard hybrid detector.'
                );
            }
            pendingDetectionMethod = 'hybrid';
            await runHybridDetect(
                uploadedImage,
                detectionMutex,
                templatesLoaded,
                templatesLoadError,
                handleDetectionResults
            );
            return;
        }

        if (!detectionMutex.tryAcquire()) {
            ToastManager.info('Detection already in progress...');
            return;
        }

        try {
            const enhancedResults = await handleEnhancedHybridDetect(uploadedImage);
            handleDetectionResults(mapEnhancedResults(enhancedResults));
        } catch (error) {
            if (detectionMutex.isLocked()) {
                detectionMutex.release();
            }
            logger.warn({
                operation: 'scan_build.enhanced_detect_failed',
                error: {
                    name: (error as Error).name,
                    message: (error as Error).message,
                },
            });
            ToastManager.warning('Enhanced CV failed. Falling back to the standard hybrid detector.');
            pendingDetectionMethod = 'hybrid';
            await runHybridDetect(
                uploadedImage,
                detectionMutex,
                templatesLoaded,
                templatesLoadError,
                handleDetectionResults
            );
            return;
        } finally {
            if (detectionMutex.isLocked()) {
                detectionMutex.release();
            }
        }

        return;
    }

    pendingDetectionMethod = 'hybrid';
    await runHybridDetect(uploadedImage, detectionMutex, templatesLoaded, templatesLoadError, handleDetectionResults);
}

async function handleCompareStrategies(): Promise<void> {
    if (!uploadedImage) {
        ToastManager.error('Please upload an image first');
        return;
    }

    if (!enhancedCVReady) {
        ToastManager.warning('Enhanced CV is not ready yet.');
        return;
    }

    await compareStrategiesOnImage(uploadedImage);
}

function handleExportReport(): void {
    exportStoredScanReports();
}

// ========================================
// Apply to Advisor
// ========================================

/**
 * Handle apply to advisor button click
 */
function handleApplyToAdvisor(): void {
    applyToAdvisor(getSelectionState(), onBuildStateChange);
    finalizeScanSession(getTrustSummary());
}

// ========================================
// Public API
// ========================================

/**
 * Get the current scan state snapshot.
 *
 * Returns the selected items (with counts), tomes, character, and weapon
 * that the user has chosen or that were auto-detected.
 *
 * @returns The current {@link ScanState} including all selections.
 *
 * @example
 * ```ts
 * const state = getState();
 * console.log(`${state.selectedItems.size} items selected`);
 * ```
 */
export function getState(): ScanState {
    return getScanState(getSelectionState());
}

// Legacy alias for backward compatibility
export { getState as getScanState };

/**
 * Reset all module state for testing purposes.
 *
 * Clears event listeners, cancels pending uploads, releases the detection mutex,
 * and resets all internal state (selected items, tomes, character, weapon, etc.).
 * **Only intended for use in test suites.**
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
    currentPreflightReport = null;
    enhancedCVReady = false;
    enhancedCVInitError = null;
    pendingDetectionMethod = null;
    clearCurrentScanSession();
    clearFeedbackSession();
    clearScanPreflightReport();
    document.querySelector('.scan-correction-modal')?.remove();
    resetDetectionReviewState();
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
