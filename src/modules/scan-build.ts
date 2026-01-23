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

// State
let allData: AllGameData = {};
let uploadedImage: string | null = null;
let selectedItems: Map<string, { item: Item; count: number }> = new Map();
let selectedTomes: Map<string, Tome> = new Map();
let selectedCharacter: Character | null = null;
let selectedWeapon: Weapon | null = null;
let templatesLoaded: boolean = false;
let templatesLoadError: Error | null = null;

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
                    name: error.name,
                    message: error.message,
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
 * Setup event listeners for scan build UI
 */
function setupEventListeners(): void {
    // Upload/Camera button
    const uploadBtn = document.getElementById('scan-upload-btn');
    uploadBtn?.addEventListener('click', handleUploadClick);

    // File input change
    const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
    fileInput?.addEventListener('change', handleFileSelect);

    // Clear image button
    const clearBtn = document.getElementById('scan-clear-image');
    clearBtn?.addEventListener('click', clearUploadedImage);

    // Apply to advisor button
    const applyBtn = document.getElementById('scan-apply-to-advisor');
    applyBtn?.addEventListener('click', applyToAdvisor);

    // Auto-detect button (OCR)
    const autoDetectBtn = document.getElementById('scan-auto-detect-btn');
    autoDetectBtn?.addEventListener('click', handleAutoDetect);

    // Hybrid detect button (OCR + CV)
    const hybridDetectBtn = document.getElementById('scan-hybrid-detect-btn');
    hybridDetectBtn?.addEventListener('click', handleHybridDetect);
}

/**
 * Handle upload button click - trigger file input
 */
function handleUploadClick(): void {
    const fileInput = document.getElementById('scan-file-input') as HTMLInputElement;
    fileInput?.click();
}

/**
 * Handle file selection
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
            } else {
                ToastManager.error('Failed to read image as data URL');
            }
        };
        reader.onerror = () => {
            ToastManager.error('Failed to read image file');
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
        logger.error({
            operation: 'scan_build.upload_error',
            error: {
                name: (error as Error).name,
                message: (error as Error).message,
            },
        });
        ToastManager.error('Failed to upload image');
    }
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

    // Re-attach clear button listener
    const clearBtnElement = document.getElementById('scan-clear-image');
    clearBtnElement?.addEventListener('click', clearUploadedImage);
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

    // Create progress indicator before try block to ensure cleanup in finally
    const progressDiv = createProgressIndicator();

    try {
        ToastManager.info('Starting auto-detection...');

        // Run OCR
        const results = await autoDetectFromImage(uploadedImage, (progress, status) => {
            updateProgressIndicator(progressDiv, progress, status);
        });

        // If OCR found nothing, try CV as fallback
        if (results.items.length === 0 && results.tomes.length === 0) {
            logger.info({
                operation: 'scan_build.ocr_empty_trying_cv',
                data: { message: 'OCR found no items, trying icon detection' },
            });

            updateProgressIndicator(progressDiv, 50, 'Trying icon detection...');
            ToastManager.info('No text found, trying icon detection...');

            try {
                const cvResults = await detectItemsWithCV(uploadedImage, (progress, status) => {
                    updateProgressIndicator(progressDiv, 50 + progress * 0.5, status);
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
                logger.warn({
                    operation: 'scan_build.cv_fallback_failed',
                    error: { name: (cvError as Error).name, message: (cvError as Error).message },
                });
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
        logger.error({
            operation: 'scan_build.auto_detect_error',
            error: {
                name: (error as Error).name,
                message: (error as Error).message,
            },
        });
        ToastManager.error(`Auto-detection failed: ${(error as Error).message}`);
    } finally {
        // Always clean up progress indicator
        progressDiv.remove();
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

    // Check if templates are still loading
    if (!templatesLoaded && !templatesLoadError) {
        ToastManager.info('Item templates are still loading. Please wait a moment and try again.');
        return;
    }

    // Warn if templates failed to load (CV will have reduced accuracy)
    if (templatesLoadError) {
        ToastManager.warning('Item templates failed to load. Detection accuracy may be reduced.');
        logger.warn({
            operation: 'scan_build.hybrid_detect_degraded',
            error: {
                name: templatesLoadError.name,
                message: templatesLoadError.message,
            },
        });
    }

    // Create progress indicator before try block to ensure cleanup in finally
    const progressDiv = createProgressIndicator();

    try {
        ToastManager.info('Starting hybrid detection (OCR + Computer Vision)...');

        // Run OCR first
        updateProgressIndicator(progressDiv, 10, 'Running OCR...');
        const ocrResults = await autoDetectFromImage(uploadedImage, (progress, status) => {
            updateProgressIndicator(progressDiv, 10 + progress * 0.4, status);
        });

        // Run computer vision
        updateProgressIndicator(progressDiv, 50, 'Running computer vision...');
        const cvResults = await detectItemsWithCV(uploadedImage, (progress, status) => {
            updateProgressIndicator(progressDiv, 50 + progress * 0.4, status);
        });

        // Combine results
        updateProgressIndicator(progressDiv, 90, 'Combining detections...');

        // Convert CV results to match OCR format
        const cvAsOCR: DetectionResult[] = cvResults.map(cv => ({
            type: cv.type,
            entity: cv.entity,
            confidence: cv.confidence,
            rawText: `cv_detected_${cv.entity.name}`,
        }));

        // Combine both detection methods
        const combinedItems = combineDetections(
            [...ocrResults.items, ...cvAsOCR.filter(r => r.type === 'item')],
            cvResults.filter(r => r.type === 'item')
        );
        const combinedTomes = combineDetections(
            [...ocrResults.tomes, ...cvAsOCR.filter(r => r.type === 'tome')],
            cvResults.filter(r => r.type === 'tome')
        );

        // Aggregate duplicates (e.g., [Wrench, Wrench, Wrench] → [Wrench x3])
        const aggregatedItems = aggregateDuplicates(combinedItems);
        const aggregatedTomes = aggregateDuplicates(combinedTomes);

        const hybridResults = {
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
            character: (() => {
                if (ocrResults.character) return ocrResults.character;
                const charResult = cvResults.find(r => r.type === 'character');
                if (charResult) {
                    return {
                        type: 'character' as const,
                        entity: charResult.entity,
                        confidence: charResult.confidence,
                        rawText: 'hybrid_cv',
                    };
                }
                return null;
            })(),
            weapon: (() => {
                if (ocrResults.weapon) return ocrResults.weapon;
                const weaponResult = cvResults.find(r => r.type === 'weapon');
                if (weaponResult) {
                    return {
                        type: 'weapon' as const,
                        entity: weaponResult.entity,
                        confidence: weaponResult.confidence,
                        rawText: 'hybrid_cv',
                    };
                }
                return null;
            })(),
            rawText: 'hybrid_detection',
        };

        applyDetectionResults(hybridResults);

        // Update debug UI stats
        updateStats();
        updateLogViewer();

        // Check if debug mode is enabled
        if (isDebugEnabled()) {
            // Create debug overlay
            const debugOverlayUrl = await createDebugOverlay(uploadedImage, cvResults);

            // Store overlay URL for download button
            setLastOverlayUrl(debugOverlayUrl);

            // Replace uploaded image with debug overlay
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
            // Clear any previous overlay URL
            setLastOverlayUrl(null);
            ToastManager.success(
                `Hybrid Detection: ${hybridResults.items.length} items, ${hybridResults.tomes.length} tomes (Enhanced accuracy!)`
            );
        }

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
        logger.error({
            operation: 'scan_build.hybrid_detect_error',
            error: {
                name: (error as Error).name,
                message: (error as Error).message,
            },
        });
        ToastManager.error(`Hybrid detection failed: ${(error as Error).message}`);
    } finally {
        // Always clean up progress indicator
        progressDiv.remove();
    }
}

/**
 * Create progress indicator
 */
function createProgressIndicator(): HTMLElement {
    const container = document.getElementById('scan-image-preview');
    if (!container) return document.createElement('div');

    const progressDiv = document.createElement('div');
    progressDiv.className = 'scan-progress-overlay';
    progressDiv.innerHTML = `
        <div class="scan-progress-content">
            <div class="scan-progress-spinner"></div>
            <div class="scan-progress-text">Initializing...</div>
            <div class="scan-progress-bar">
                <div class="scan-progress-fill" style="width: 0%"></div>
            </div>
        </div>
    `;

    container.appendChild(progressDiv);
    return progressDiv;
}

/**
 * Update progress indicator
 */
function updateProgressIndicator(progressDiv: HTMLElement, progress: number, status: string): void {
    const textEl = progressDiv.querySelector('.scan-progress-text');
    const fillEl = progressDiv.querySelector('.scan-progress-fill') as HTMLElement;

    if (textEl) {
        textEl.textContent = status;
    }

    if (fillEl) {
        fillEl.style.width = `${progress}%`;
    }
}

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
        const item = detection.entity as Item;
        const currentCount = itemCounts.get(item.id) || 0;
        itemCounts.set(item.id, currentCount + 1);
    });

    itemCounts.forEach((count, itemId) => {
        const item = allData.items?.items.find(i => i.id === itemId);
        if (item) {
            selectedItems.set(item.id, { item, count });
            updateItemCardCount(item.id, count);
        }
    });

    // Apply tomes (unique)
    const uniqueTomes = new Set<string>();
    results.tomes.forEach(detection => {
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
