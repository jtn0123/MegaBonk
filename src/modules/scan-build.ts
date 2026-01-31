// ========================================
// MegaBonk Scan Build Module
// ========================================
// Handles image upload and manual item identification for build recognition
// ========================================

import type { Item, Tome, AllGameData, Character, Weapon } from '../types/index.ts';
import { ToastManager } from './toast.ts';
import { logger } from './logger.ts';
import { autoDetectFromImage, initOCR, type DetectionResult } from './ocr.ts';
import {
    detectItemsWithCV,
    initCV,
    loadItemTemplates,
    combineDetections,
    aggregateDuplicates,
    createDebugOverlay,
} from './computer-vision.ts';
import { setLastOverlayUrl, updateStats, updateLogViewer, isDebugEnabled } from './debug-ui.ts';
import { escapeHtml } from './utils.ts';
import { MAX_ITEM_COUNT, MAX_FILE_SIZE_BYTES } from './constants.ts';
import { createMutex, createDebouncedAsync } from './async-utils.ts';
import { logError, logWarning } from './error-utils.ts';
import { createProgressIndicator, createEventListenerManager } from './dom-utils.ts';

// State
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
type BuildStateCallback = (state: {
    character: Character | null;
    weapon: Weapon | null;
    items: Item[];
    tomes: Tome[];
}) => void;

let onBuildStateChange: BuildStateCallback | null = null;

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
    if (applyBtn) eventListenerManager.addWithSignal(applyBtn, 'click', applyToAdvisor);

    // Auto-detect button (OCR)
    const autoDetectBtn = document.getElementById('scan-auto-detect-btn');
    if (autoDetectBtn) eventListenerManager.addWithSignal(autoDetectBtn, 'click', handleAutoDetect);

    // Hybrid detect button (OCR + CV)
    const hybridDetectBtn = document.getElementById('scan-hybrid-detect-btn');
    if (hybridDetectBtn) eventListenerManager.addWithSignal(hybridDetectBtn, 'click', handleHybridDetect);
}

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
                    displayUploadedImage();
                    showItemSelectionGrid();
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

/**
 * Display the uploaded image
 * Uses DOM manipulation instead of innerHTML to prevent XSS from malformed data URLs
 */
function displayUploadedImage(): void {
    const previewContainer = document.getElementById('scan-image-preview');
    if (!previewContainer || !uploadedImage) return;

    // Clear existing content safely
    previewContainer.innerHTML = '';

    // Create elements via DOM API to prevent XSS
    const wrapper = document.createElement('div');
    wrapper.className = 'scan-image-wrapper';

    const img = document.createElement('img');
    img.src = uploadedImage; // Set via property, not innerHTML
    img.alt = 'Uploaded build screenshot';
    img.className = 'scan-preview-image';

    const clearBtn = document.createElement('button');
    clearBtn.className = 'scan-clear-btn';
    clearBtn.id = 'scan-clear-image';
    clearBtn.setAttribute('aria-label', 'Clear image');
    clearBtn.textContent = '✕';

    wrapper.appendChild(img);
    wrapper.appendChild(clearBtn);
    previewContainer.appendChild(wrapper);

    previewContainer.style.display = 'block';

    // Show auto-detect button
    const autoDetectArea = document.getElementById('scan-auto-detect-area');
    if (autoDetectArea) {
        autoDetectArea.style.display = 'block';
    }

    // Attach clear button listener using centralized event manager for cleanup
    eventListenerManager.add(clearBtn, 'click', clearUploadedImage);
}

/**
 * Clear uploaded image and reset state
 */
function clearUploadedImage(): void {
    uploadedImage = null;
    selectedItems.clear();
    selectedTomes.clear();
    selectedCharacter = null;
    selectedWeapon = null;

    const previewContainer = document.getElementById('scan-image-preview');
    if (previewContainer) {
        previewContainer.innerHTML = '';
        previewContainer.style.display = 'none';
    }

    const selectionContainer = document.getElementById('scan-selection-area');
    if (selectionContainer) {
        selectionContainer.style.display = 'none';
    }

    const autoDetectArea = document.getElementById('scan-auto-detect-area');
    if (autoDetectArea) {
        autoDetectArea.style.display = 'none';
    }

    const detectionInfo = document.getElementById('scan-detection-info');
    if (detectionInfo) {
        detectionInfo.style.display = 'none';
    }

    // Clear file input
    const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
    if (fileInput) {
        fileInput.value = '';
    }

    ToastManager.info('Image cleared');
}

/**
 * Handle auto-detect button click - use OCR to detect items
 */
async function handleAutoDetect(): Promise<void> {
    if (!uploadedImage) {
        ToastManager.error('Please upload an image first');
        return;
    }

    // Race condition fix: Prevent concurrent detection runs using mutex
    if (!detectionMutex.tryAcquire()) {
        ToastManager.info('Detection already in progress...');
        return;
    }

    // Create progress indicator before try block to ensure cleanup in finally
    const progress = createProgressIndicator('Initializing...');
    const previewContainer = document.getElementById('scan-image-preview');
    if (previewContainer) {
        previewContainer.appendChild(progress.element);
    }

    try {
        ToastManager.info('Starting auto-detection...');

        // Run OCR
        const results = await autoDetectFromImage(uploadedImage, (pct, status) => {
            progress.update(pct, status);
        });

        // If OCR found nothing, try CV as fallback
        if (results.items.length === 0 && results.tomes.length === 0) {
            logger.info({
                operation: 'scan_build.ocr_empty_trying_cv',
                data: { message: 'OCR found no items, trying icon detection' },
            });

            progress.update(50, 'Trying icon detection...');
            ToastManager.info('No text found, trying icon detection...');

            try {
                const cvResults = await detectItemsWithCV(uploadedImage, (pct, status) => {
                    progress.update(50 + pct * 0.5, status);
                });

                if (cvResults.length > 0) {
                    // Convert CV results to detection format
                    const cvItems = cvResults
                        .filter(r => r.type === 'item')
                        .map(r => ({
                            type: 'item' as const,
                            entity: r.entity,
                            confidence: r.confidence,
                            rawText: `cv_detected_${r.entity.name}`,
                        }));

                    applyDetectionResults({
                        items: cvItems,
                        tomes: [],
                        character: null,
                        weapon: null,
                    });

                    ToastManager.success(`Detected ${cvResults.length} items via icon matching`);

                    logger.info({
                        operation: 'scan_build.cv_fallback_success',
                        data: { itemsDetected: cvResults.length },
                    });
                    return;
                }
            } catch (cvError) {
                logWarning('scan_build.cv_fallback_failed', cvError);
            }
        }

        // Apply detected items
        applyDetectionResults(results);

        if (results.items.length === 0 && results.tomes.length === 0) {
            ToastManager.info('No items detected. Try Hybrid mode or a clearer screenshot.');
        } else {
            ToastManager.success(
                `Detected: ${results.items.length} items, ${results.tomes.length} tomes` +
                    (results.character ? ', 1 character' : '') +
                    (results.weapon ? ', 1 weapon' : '')
            );
        }

        logger.info({
            operation: 'scan_build.auto_detect_complete',
            data: {
                itemsDetected: results.items.length,
                tomesDetected: results.tomes.length,
                characterDetected: results.character ? 1 : 0,
                weaponDetected: results.weapon ? 1 : 0,
            },
        });
    } catch (error) {
        logError('scan_build.auto_detect_error', error);
        ToastManager.error(`Auto-detection failed: ${(error as Error).message}`);
    } finally {
        // Always clean up progress indicator and release lock
        progress.remove();
        detectionMutex.release();
    }
}

/**
 * Combine OCR and CV detection results into unified hybrid results
 */
function combineHybridResults(
    ocrResults: Awaited<ReturnType<typeof autoDetectFromImage>>,
    cvResults: Awaited<ReturnType<typeof detectItemsWithCV>>
): {
    items: DetectionResult[];
    tomes: DetectionResult[];
    character: DetectionResult | null;
    weapon: DetectionResult | null;
    rawText: string;
} {
    // Convert CV results to OCR format
    const cvAsOCR: DetectionResult[] = cvResults.map(cv => ({
        type: cv.type,
        entity: cv.entity,
        confidence: cv.confidence,
        rawText: `cv_detected_${cv.entity.name}`,
    }));

    // Combine and aggregate items
    const combinedItems = combineDetections(
        [...ocrResults.items, ...cvAsOCR.filter(r => r.type === 'item')],
        cvResults.filter(r => r.type === 'item')
    );
    const combinedTomes = combineDetections(
        [...ocrResults.tomes, ...cvAsOCR.filter(r => r.type === 'tome')],
        cvResults.filter(r => r.type === 'tome')
    );

    const aggregatedItems = aggregateDuplicates(combinedItems);
    const aggregatedTomes = aggregateDuplicates(combinedTomes);

    // Determine character (OCR takes priority, fallback to CV)
    let character: DetectionResult | null = ocrResults.character;
    if (!character) {
        const charResult = cvResults.find(r => r.type === 'character');
        if (charResult) {
            character = {
                type: 'character' as const,
                entity: charResult.entity,
                confidence: charResult.confidence,
                rawText: 'hybrid_cv',
            };
        }
    }

    // Determine weapon (OCR takes priority, fallback to CV)
    let weapon: DetectionResult | null = ocrResults.weapon;
    if (!weapon) {
        const weaponResult = cvResults.find(r => r.type === 'weapon');
        if (weaponResult) {
            weapon = {
                type: 'weapon' as const,
                entity: weaponResult.entity,
                confidence: weaponResult.confidence,
                rawText: 'hybrid_cv',
            };
        }
    }

    return {
        items: aggregatedItems.map(r => ({
            type: r.type as 'item',
            entity: r.entity,
            confidence: r.confidence,
            rawText: `hybrid_${r.method}`,
            count: r.count,
        })),
        tomes: aggregatedTomes.map(r => ({
            type: r.type as 'tome',
            entity: r.entity,
            confidence: r.confidence,
            rawText: `hybrid_${r.method}`,
            count: r.count,
        })),
        character,
        weapon,
        rawText: 'hybrid_detection',
    };
}

/**
 * Display debug overlay if debug mode is enabled
 */
async function displayDebugOverlay(
    image: string,
    cvResults: Awaited<ReturnType<typeof detectItemsWithCV>>,
    hybridResults: { items: DetectionResult[]; tomes: DetectionResult[] }
): Promise<void> {
    if (isDebugEnabled()) {
        const debugOverlayUrl = await createDebugOverlay(image, cvResults);
        setLastOverlayUrl(debugOverlayUrl);

        const imagePreview = document.getElementById('scan-image-preview');
        if (imagePreview) {
            imagePreview.innerHTML = `
                <img src="${debugOverlayUrl}" alt="Debug Overlay" style="max-width: 100%; border-radius: 8px;" />
                <p style="text-align: center; margin-top: 1rem; color: var(--text-secondary); font-size: 0.9rem;">
                    Debug Mode: Green=High confidence, Orange=Medium, Red=Low
                </p>
            `;
        }
        ToastManager.success(
            `Hybrid Detection: ${hybridResults.items.length} items, ${hybridResults.tomes.length} tomes (Debug overlay shown)`
        );
    } else {
        setLastOverlayUrl(null);
        ToastManager.success(
            `Hybrid Detection: ${hybridResults.items.length} items, ${hybridResults.tomes.length} tomes (Enhanced accuracy!)`
        );
    }
}

/**
 * Handle hybrid detect button click - use OCR + CV together
 */
async function handleHybridDetect(): Promise<void> {
    if (!uploadedImage) {
        ToastManager.error('Please upload an image first');
        return;
    }

    if (!detectionMutex.tryAcquire()) {
        ToastManager.info('Detection already in progress...');
        return;
    }

    if (!templatesLoaded && !templatesLoadError) {
        ToastManager.info('Item templates are still loading. Please wait a moment and try again.');
        detectionMutex.release();
        return;
    }

    if (templatesLoadError) {
        ToastManager.warning('Item templates failed to load. Detection accuracy may be reduced.');
        logWarning('scan_build.hybrid_detect_degraded', templatesLoadError);
    }

    const progress = createProgressIndicator('Initializing...');
    const previewContainer = document.getElementById('scan-image-preview');
    if (previewContainer) {
        previewContainer.appendChild(progress.element);
    }

    try {
        ToastManager.info('Starting hybrid detection (OCR + Computer Vision)...');

        // Run OCR phase
        progress.update(10, 'Running OCR...');
        const ocrResults = await autoDetectFromImage(uploadedImage, (pct, status) => {
            progress.update(10 + pct * 0.4, status);
        });

        // Run CV phase
        progress.update(50, 'Running computer vision...');
        const cvResults = await detectItemsWithCV(uploadedImage, (pct, status) => {
            progress.update(50 + pct * 0.4, status);
        });

        // Combine results
        progress.update(90, 'Combining detections...');
        const hybridResults = combineHybridResults(ocrResults, cvResults);

        applyDetectionResults(hybridResults);
        updateStats();
        updateLogViewer();

        await displayDebugOverlay(uploadedImage, cvResults, hybridResults);

        logger.info({
            operation: 'scan_build.hybrid_detect_complete',
            data: {
                itemsDetected: hybridResults.items.length,
                tomesDetected: hybridResults.tomes.length,
                characterDetected: hybridResults.character ? 1 : 0,
                weaponDetected: hybridResults.weapon ? 1 : 0,
                ocrItems: ocrResults.items.length,
                cvItems: cvResults.length,
            },
        });
    } catch (error) {
        logError('scan_build.hybrid_detect_error', error);
        ToastManager.error(`Hybrid detection failed: ${(error as Error).message}`);
    } finally {
        progress.remove();
        detectionMutex.release();
    }
}

// Progress indicator functionality moved to dom-utils.ts

/**
 * Apply detection results to the UI
 */
function applyDetectionResults(results: {
    items: DetectionResult[];
    tomes: DetectionResult[];
    character: DetectionResult | null;
    weapon: DetectionResult | null;
}): void {
    // Clear existing selections
    selectedItems.clear();
    selectedTomes.clear();
    selectedCharacter = null;
    selectedWeapon = null;

    // Show selection grid
    showItemSelectionGrid();

    // Apply character
    if (results.character) {
        selectedCharacter = results.character.entity as Character;
        highlightDetectedEntity('character', results.character.entity.id);
    }

    // Apply weapon
    if (results.weapon) {
        selectedWeapon = results.weapon.entity as Weapon;
        highlightDetectedEntity('weapon', results.weapon.entity.id);
    }

    // Apply items (deduplicate and count)
    const itemCounts = new Map<string, number>();
    results.items.forEach(detection => {
        // Bug fix: Check detection.entity exists before accessing .id
        if (!detection.entity) return;
        const item = detection.entity as Item;
        const currentCount = itemCounts.get(item.id) || 0;
        itemCounts.set(item.id, currentCount + 1);
    });

    itemCounts.forEach((count, itemId) => {
        // Bug fix: Use optional chaining on .find() to prevent TypeError if items array is undefined
        const item = allData.items?.items?.find(i => i.id === itemId);
        if (item) {
            selectedItems.set(item.id, { item, count });
            updateItemCardCount(item.id, count);
        }
    });

    // Apply tomes (unique)
    const uniqueTomes = new Set<string>();
    results.tomes.forEach(detection => {
        // Bug fix: Check detection.entity exists before accessing .id
        if (!detection.entity) return;
        const tome = detection.entity as Tome;
        if (!uniqueTomes.has(tome.id)) {
            uniqueTomes.add(tome.id);
            selectedTomes.set(tome.id, tome);
            highlightDetectedEntity('tome', tome.id);
        }
    });

    // Update summary
    updateSelectionSummary();

    // Show detection confidence info
    displayDetectionConfidence(results);
}

/**
 * Highlight detected entity in the grid
 */
function highlightDetectedEntity(type: 'character' | 'weapon' | 'tome', entityId: string): void {
    let gridId = '';
    switch (type) {
        case 'character':
            gridId = 'scan-character-grid';
            break;
        case 'weapon':
            gridId = 'scan-weapon-grid';
            break;
        case 'tome':
            gridId = 'scan-tome-grid';
            break;
    }

    const grid = document.getElementById(gridId);
    if (!grid) return;

    // Remove existing selections
    grid.querySelectorAll('.scan-entity-card, .scan-tome-card').forEach(card => {
        card.classList.remove('selected');
    });

    // Add selection to detected entity
    const card = grid.querySelector(`[data-id="${entityId}"]`);
    if (card) {
        card.classList.add('selected');
    }
}

/**
 * Update item card count display
 */
function updateItemCardCount(itemId: string, count: number): void {
    const gridContainer = document.getElementById('scan-grid-items-container');
    if (!gridContainer) return;

    const card = gridContainer.querySelector(`[data-id="${itemId}"]`);
    if (!card) return;

    const countDisplay = card.querySelector('.scan-count-display');
    if (countDisplay) {
        countDisplay.textContent = count.toString();
    }

    card.classList.add('selected');
}

/**
 * Get confidence class based on confidence level
 */
function getConfidenceClass(confidence: number): string {
    if (confidence >= 0.8) return 'confidence-high';
    if (confidence >= 0.5) return 'confidence-medium';
    return 'confidence-low';
}

/**
 * Display detection confidence information
 */
function displayDetectionConfidence(results: {
    items: DetectionResult[];
    tomes: DetectionResult[];
    character: DetectionResult | null;
    weapon: DetectionResult | null;
}): void {
    const container = document.getElementById('scan-detection-info');
    if (!container) return;

    // Count detections by confidence level
    const allDetections: DetectionResult[] = [
        ...(results.character ? [results.character] : []),
        ...(results.weapon ? [results.weapon] : []),
        ...results.items,
        ...results.tomes,
    ];

    const highCount = allDetections.filter(d => d.confidence >= 0.8).length;
    const mediumCount = allDetections.filter(d => d.confidence >= 0.5 && d.confidence < 0.8).length;
    const lowCount = allDetections.filter(d => d.confidence < 0.5).length;
    const avgConfidence =
        allDetections.length > 0 ? allDetections.reduce((sum, d) => sum + d.confidence, 0) / allDetections.length : 0;

    let html = '<div class="scan-detection-results"><h4>🔍 Detection Confidence:</h4>';

    // Stats summary
    if (allDetections.length > 0) {
        html += `<div class="scan-detection-stats">
            <div class="scan-detection-stat stat-high">
                <span class="stat-count">${highCount}</span> high
            </div>
            <div class="scan-detection-stat stat-medium">
                <span class="stat-count">${mediumCount}</span> medium
            </div>
            <div class="scan-detection-stat stat-low">
                <span class="stat-count">${lowCount}</span> low
            </div>
            <div class="scan-detection-stat">
                Avg: <span class="stat-count">${Math.round(avgConfidence * 100)}%</span>
            </div>
        </div>`;
    }

    // Low confidence warning
    if (lowCount >= 3 || (lowCount > 0 && lowCount >= allDetections.length * 0.5)) {
        html += `<div class="scan-low-confidence-warning">
            <strong>⚠️ Many low-confidence detections</strong>
            Some items may be incorrectly identified. Review the selections below and adjust as needed.
        </div>`;
    }

    if (results.character) {
        const confClass = getConfidenceClass(results.character.confidence);
        html += `<div class="scan-detection-item">
            <span>Character: ${escapeHtml(results.character.entity.name)}</span>
            <span class="confidence ${confClass}">${Math.round(results.character.confidence * 100)}%</span>
        </div>`;
    }

    if (results.weapon) {
        const confClass = getConfidenceClass(results.weapon.confidence);
        html += `<div class="scan-detection-item">
            <span>Weapon: ${escapeHtml(results.weapon.entity.name)}</span>
            <span class="confidence ${confClass}">${Math.round(results.weapon.confidence * 100)}%</span>
        </div>`;
    }

    if (results.items.length > 0) {
        html += '<div class="scan-detection-section"><strong>Items:</strong>';
        results.items.forEach(item => {
            const confClass = getConfidenceClass(item.confidence);
            html += `<div class="scan-detection-item">
                <span>${escapeHtml(item.entity.name)}</span>
                <span class="confidence ${confClass}">${Math.round(item.confidence * 100)}%</span>
            </div>`;
        });
        html += '</div>';
    }

    if (results.tomes.length > 0) {
        html += '<div class="scan-detection-section"><strong>Tomes:</strong>';
        results.tomes.forEach(tome => {
            const confClass = getConfidenceClass(tome.confidence);
            html += `<div class="scan-detection-item">
                <span>${escapeHtml(tome.entity.name)}</span>
                <span class="confidence ${confClass}">${Math.round(tome.confidence * 100)}%</span>
            </div>`;
        });
        html += '</div>';
    }

    html += '<p class="scan-detection-hint">💡 Review and adjust selections below if needed</p></div>';
    container.innerHTML = html;
    container.style.display = 'block';
}

/**
 * Show item selection grid
 */
function showItemSelectionGrid(): void {
    const selectionContainer = document.getElementById('scan-selection-area');
    if (!selectionContainer) return;

    selectionContainer.style.display = 'block';

    // Create character/weapon selection
    createEntitySelection('character', allData.characters?.characters || []);
    createEntitySelection('weapon', allData.weapons?.weapons || []);

    // Create item selection grid
    createItemGrid();

    // Create tome selection grid
    createTomeGrid();

    // Update summary
    updateSelectionSummary();
}

/**
 * Create entity selection (character/weapon)
 */
function createEntitySelection(type: 'character' | 'weapon', entities: (Character | Weapon)[]): void {
    const container = document.getElementById(`scan-${type}-grid`);
    if (!container) return;

    container.innerHTML = '';

    entities.forEach((entity: Character | Weapon) => {
        const card = document.createElement('button');
        card.className = 'scan-entity-card';
        card.dataset.id = entity.id;
        card.innerHTML = `
            <div class="scan-entity-name">${escapeHtml(entity.name)}</div>
            <div class="scan-entity-tier tier-${escapeHtml(entity.tier.toLowerCase())}">${escapeHtml(entity.tier)}</div>
        `;

        card.addEventListener('click', () => {
            // Deselect all others
            container.querySelectorAll('.scan-entity-card').forEach(c => c.classList.remove('selected'));
            // Select this one
            card.classList.add('selected');

            if (type === 'character') {
                selectedCharacter = entity as Character;
            } else {
                selectedWeapon = entity as Weapon;
            }

            updateSelectionSummary();
        });

        container.appendChild(card);
    });
}

/**
 * Create item selection grid
 */
function createItemGrid(): void {
    const container = document.getElementById('scan-item-grid');
    if (!container || !allData.items?.items) return;

    container.innerHTML = '';

    // Add search filter
    const searchBox = document.createElement('input');
    searchBox.type = 'search';
    searchBox.className = 'scan-search-input';
    searchBox.placeholder = '🔍 Search items...';
    searchBox.addEventListener('input', e => {
        const query = (e.target as HTMLInputElement).value.toLowerCase();
        filterItemGrid(query);
    });
    container.appendChild(searchBox);

    // Create grid container
    const gridContainer = document.createElement('div');
    gridContainer.className = 'scan-grid-items';
    gridContainer.id = 'scan-grid-items-container';

    allData.items.items.forEach(item => {
        const card = createItemCard(item);
        gridContainer.appendChild(card);
    });

    container.appendChild(gridContainer);
}

/**
 * Create individual item card
 */
function createItemCard(item: Item): HTMLElement {
    const card = document.createElement('div');
    card.className = 'scan-item-card';
    card.dataset.id = item.id;
    card.dataset.name = item.name.toLowerCase();

    // Item info
    const info = document.createElement('div');
    info.className = 'scan-item-info';
    info.innerHTML = `
        <div class="scan-item-name">${escapeHtml(item.name)}</div>
        <div class="scan-item-tier tier-${escapeHtml(item.tier.toLowerCase())}">${escapeHtml(item.tier)}</div>
    `;

    // Counter controls
    const controls = document.createElement('div');
    controls.className = 'scan-item-controls';

    const decrementBtn = document.createElement('button');
    decrementBtn.className = 'scan-count-btn';
    decrementBtn.textContent = '−';
    decrementBtn.setAttribute('aria-label', `Decrease ${item.name} count`);

    const countDisplay = document.createElement('span');
    countDisplay.className = 'scan-count-display';
    countDisplay.textContent = '0';

    const incrementBtn = document.createElement('button');
    incrementBtn.className = 'scan-count-btn';
    incrementBtn.textContent = '+';
    incrementBtn.setAttribute('aria-label', `Increase ${item.name} count`);

    decrementBtn.addEventListener('click', () => {
        updateItemCount(item, -1, countDisplay, card);
    });

    incrementBtn.addEventListener('click', () => {
        updateItemCount(item, 1, countDisplay, card);
    });

    controls.appendChild(decrementBtn);
    controls.appendChild(countDisplay);
    controls.appendChild(incrementBtn);

    card.appendChild(info);
    card.appendChild(controls);

    return card;
}

/**
 * Update item count
 */
function updateItemCount(item: Item, delta: number, display: HTMLElement, card: HTMLElement): void {
    const current = selectedItems.get(item.id);
    const currentCount = current?.count || 0;
    const newCount = Math.max(0, Math.min(MAX_ITEM_COUNT, currentCount + delta));

    if (newCount === 0) {
        selectedItems.delete(item.id);
        card.classList.remove('selected');
    } else {
        selectedItems.set(item.id, { item, count: newCount });
        card.classList.add('selected');
    }

    display.textContent = newCount.toString();
    updateSelectionSummary();
}

/**
 * Filter item grid by search query
 */
function filterItemGrid(query: string): void {
    const gridContainer = document.getElementById('scan-grid-items-container');
    if (!gridContainer) return;

    const cards = gridContainer.querySelectorAll('.scan-item-card');
    cards.forEach(card => {
        const name = (card as HTMLElement).dataset.name || '';
        if (name.includes(query)) {
            (card as HTMLElement).style.display = 'flex';
        } else {
            (card as HTMLElement).style.display = 'none';
        }
    });
}

/**
 * Create tome selection grid
 */
function createTomeGrid(): void {
    const container = document.getElementById('scan-tome-grid');
    if (!container || !allData.tomes?.tomes) return;

    container.innerHTML = '';

    allData.tomes.tomes.forEach(tome => {
        const card = document.createElement('button');
        card.className = 'scan-tome-card';
        card.dataset.id = tome.id;
        card.innerHTML = `
            <div class="scan-tome-name">${escapeHtml(tome.name)}</div>
            <div class="scan-tome-tier tier-${escapeHtml(tome.tier.toLowerCase())}">${escapeHtml(tome.tier)}</div>
        `;

        card.addEventListener('click', () => {
            if (selectedTomes.has(tome.id)) {
                selectedTomes.delete(tome.id);
                card.classList.remove('selected');
            } else {
                selectedTomes.set(tome.id, tome);
                card.classList.add('selected');
            }
            updateSelectionSummary();
        });

        container.appendChild(card);
    });
}

/**
 * Update selection summary display
 */
function updateSelectionSummary(): void {
    const summaryContainer = document.getElementById('scan-selection-summary');
    if (!summaryContainer) return;

    let html = '<h4>Selected Build State:</h4>';

    // Character
    if (selectedCharacter) {
        html += `<div class="scan-summary-item">👤 <strong>${escapeHtml(selectedCharacter.name)}</strong></div>`;
    }

    // Weapon
    if (selectedWeapon) {
        html += `<div class="scan-summary-item">⚔️ <strong>${escapeHtml(selectedWeapon.name)}</strong></div>`;
    }

    // Items
    if (selectedItems.size > 0) {
        html += '<div class="scan-summary-section"><strong>📦 Items:</strong><ul>';
        selectedItems.forEach(({ item, count }) => {
            html += `<li>${escapeHtml(item.name)} x${count}</li>`;
        });
        html += '</ul></div>';
    }

    // Tomes
    if (selectedTomes.size > 0) {
        html += '<div class="scan-summary-section"><strong>📚 Tomes:</strong><ul>';
        selectedTomes.forEach(tome => {
            html += `<li>${escapeHtml(tome.name)}</li>`;
        });
        html += '</ul></div>';
    }

    summaryContainer.innerHTML = html;

    // Show/hide apply button
    const applyBtn = document.getElementById('scan-apply-to-advisor');
    if (applyBtn) {
        applyBtn.style.display =
            selectedCharacter || selectedWeapon || selectedItems.size > 0 || selectedTomes.size > 0 ? 'block' : 'none';
    }
}

/**
 * Apply selections to the main advisor
 */
function applyToAdvisor(): void {
    // Convert items map to array (expand counts)
    const items: Item[] = [];
    selectedItems.forEach(({ item, count }) => {
        for (let i = 0; i < count; i++) {
            items.push(item);
        }
    });

    const buildState = {
        character: selectedCharacter,
        weapon: selectedWeapon,
        items,
        tomes: Array.from(selectedTomes.values()),
    };

    // Use callback if provided
    if (onBuildStateChange) {
        onBuildStateChange(buildState);
    }

    // Also call the global applyScannedBuild function if available
    // Use typed window lookup for better type safety
    const windowWithApply = window as Window & {
        applyScannedBuild?: (state: typeof buildState) => void;
    };
    if (typeof windowWithApply.applyScannedBuild === 'function') {
        windowWithApply.applyScannedBuild(buildState);
    }

    ToastManager.success('Build state applied to advisor!');

    logger.info({
        operation: 'scan_build.applied_to_advisor',
        data: {
            character: selectedCharacter?.name,
            weapon: selectedWeapon?.name,
            itemsCount: items.length,
            tomesCount: buildState.tomes.length,
        },
    });

    // Scroll to advisor section
    setTimeout(() => {
        const advisorSection = document.getElementById('advisor-current-build-section');
        advisorSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

/**
 * Scan state return type
 */
interface ScanState {
    character: Character | null;
    weapon: Weapon | null;
    items: Array<{ id: string; name: string; count: number }>;
    tomes: Array<{ id: string; name: string }>;
}

/**
 * Get current scan state
 */
export function getScanState(): ScanState {
    return {
        character: selectedCharacter,
        weapon: selectedWeapon,
        items: Array.from(selectedItems.entries()).map(([id, data]) => ({
            id,
            name: data.item.name,
            count: data.count,
        })),
        tomes: Array.from(selectedTomes.values()).map(t => ({ id: t.id, name: t.name })),
    };
}

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
