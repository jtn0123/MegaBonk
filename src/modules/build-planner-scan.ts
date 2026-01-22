// ========================================
// MegaBonk Build Planner Screenshot Import
// ========================================
// Handles screenshot upload and CV detection to populate Build Planner
// ========================================

import type { Item, Tome, AllGameData, Character, Weapon } from '../types/index.ts';
import { ToastManager } from './toast.ts';
import { logger } from './logger.ts';
import {
    detectItemsWithCV,
    initCV,
    loadItemTemplates,
    combineDetections,
    aggregateDuplicates,
    isFullyLoaded as isCVFullyLoaded,
    autoDetectGrid,
    getPresetForResolution,
    loadGridPresets,
} from './cv/index.ts';
import { autoDetectFromImage, initOCR, type DetectionResult } from './ocr.ts';
import { loadBuildFromData } from './build-planner.ts';
import { escapeHtml } from './utils.ts';

// ========================================
// Types
// ========================================

interface DetectedBuild {
    character: Character | null;
    weapon: Weapon | null;
    items: { item: Item; count: number; confidence: number }[];
    tomes: { tome: Tome; confidence: number }[];
}

interface ScanProgress {
    progress: number;
    status: string;
}

type ProgressCallback = (progress: ScanProgress) => void;

// ========================================
// State
// ========================================

let allData: AllGameData = {};
let isInitialized = false;
let templatesLoaded = false;
let presetsLoaded = false;

// Modal state
let previewModal: HTMLElement | null = null;
let currentDetectedBuild: DetectedBuild | null = null;

// ========================================
// Initialization
// ========================================

/**
 * Initialize the build planner scan module
 */
export async function initBuildPlannerScan(gameData: AllGameData): Promise<void> {
    if (isInitialized) return;

    allData = gameData;

    // Initialize CV and OCR modules
    initCV(gameData);
    initOCR(gameData);

    // Load templates and presets in parallel
    const loadPromises: Promise<void>[] = [];

    loadPromises.push(
        loadItemTemplates()
            .then(() => {
                templatesLoaded = true;
                logger.info({
                    operation: 'build_planner_scan.templates_loaded',
                    data: { success: true },
                });
            })
            .catch(error => {
                logger.warn({
                    operation: 'build_planner_scan.templates_load_failed',
                    error: { name: (error as Error).name, message: (error as Error).message },
                });
            })
    );

    loadPromises.push(
        loadGridPresets()
            .then(() => {
                presetsLoaded = true;
                logger.info({
                    operation: 'build_planner_scan.presets_loaded',
                    data: { success: true },
                });
            })
            .catch(error => {
                logger.warn({
                    operation: 'build_planner_scan.presets_load_failed',
                    error: { name: (error as Error).name, message: (error as Error).message },
                });
            })
    );

    // Wait for both to complete (don't fail if one fails)
    await Promise.allSettled(loadPromises);

    // Setup UI elements
    setupUI();
    setupEventListeners();

    isInitialized = true;

    logger.info({
        operation: 'build_planner_scan.init',
        data: {
            templatesLoaded,
            presetsLoaded,
            itemsCount: gameData.items?.items.length || 0,
        },
    });
}

/**
 * Setup UI elements for screenshot import
 */
function setupUI(): void {
    // Add import button to build actions
    const buildActions = document.querySelector('.build-actions');
    if (buildActions && !document.getElementById('import-screenshot-btn')) {
        const importBtn = document.createElement('button');
        importBtn.id = 'import-screenshot-btn';
        importBtn.className = 'btn-primary';
        importBtn.innerHTML = '📷 Import from Screenshot';
        importBtn.title = 'Upload a screenshot to auto-detect items';

        // Insert at the beginning of the actions
        buildActions.insertBefore(importBtn, buildActions.firstChild);

        // Create hidden file input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'build-planner-file-input';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        buildActions.appendChild(fileInput);
    }

    // Create preview modal if it doesn't exist
    if (!document.getElementById('build-planner-scan-modal')) {
        const modal = document.createElement('div');
        modal.id = 'build-planner-scan-modal';
        modal.className = 'modal build-scan-modal';
        modal.innerHTML = `
            <div class="modal-content modal-wide">
                <button class="close" id="close-scan-modal" aria-label="Close modal">&times;</button>
                <h2>📷 Import Build from Screenshot</h2>
                <div id="build-scan-content">
                    <!-- Content loaded dynamically -->
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        previewModal = modal;
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners(): void {
    // Import button click
    const importBtn = document.getElementById('import-screenshot-btn');
    importBtn?.addEventListener('click', handleImportClick);

    // File input change
    const fileInput = document.getElementById('build-planner-file-input') as HTMLInputElement;
    fileInput?.addEventListener('change', handleFileSelect);

    // Modal close button
    const closeBtn = document.getElementById('close-scan-modal');
    closeBtn?.addEventListener('click', closePreviewModal);

    // Close modal on outside click
    previewModal?.addEventListener('click', e => {
        if (e.target === previewModal) {
            closePreviewModal();
        }
    });

    // Close on escape key
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && previewModal?.style.display === 'flex') {
            closePreviewModal();
        }
    });
}

// ========================================
// Event Handlers
// ========================================

/**
 * Handle import button click
 */
function handleImportClick(): void {
    const fileInput = document.getElementById('build-planner-file-input') as HTMLInputElement;
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

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        ToastManager.error('Image size must be less than 10MB');
        return;
    }

    try {
        // Read file as data URL
        const imageData = await readFileAsDataURL(file);

        // Show modal with processing state
        showProcessingModal(imageData);

        // Run detection
        const detectedBuild = await detectBuildFromImage(imageData, progress => {
            updateProcessingProgress(progress);
        });

        // Show preview
        showPreviewModal(imageData, detectedBuild);

        logger.info({
            operation: 'build_planner_scan.file_processed',
            data: {
                fileName: file.name,
                fileSize: file.size,
                itemsDetected: detectedBuild.items.length,
                tomesDetected: detectedBuild.tomes.length,
            },
        });
    } catch (error) {
        logger.error({
            operation: 'build_planner_scan.process_error',
            error: {
                name: (error as Error).name,
                message: (error as Error).message,
            },
        });
        ToastManager.error(`Failed to process screenshot: ${(error as Error).message}`);
        closePreviewModal();
    }

    // Reset file input for next upload
    input.value = '';
}

// ========================================
// Image Processing
// ========================================

/**
 * Read file as data URL
 */
function readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = event => {
            const result = event.target?.result;
            if (typeof result === 'string') {
                resolve(result);
            } else {
                reject(new Error('Failed to read image'));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

/**
 * Detect build from image using CV and OCR
 */
async function detectBuildFromImage(imageData: string, onProgress?: ProgressCallback): Promise<DetectedBuild> {
    const report = (progress: number, status: string) => {
        onProgress?.({ progress, status });
    };

    report(5, 'Loading image...');

    // Get image dimensions for preset lookup
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageData;
    });

    const width = img.naturalWidth;
    const height = img.naturalHeight;

    report(10, 'Detecting grid layout...');

    // Try to get preset for this resolution
    let gridConfig = getPresetForResolution(width, height);

    // If no preset, try auto-detection
    if (!gridConfig && presetsLoaded) {
        try {
            report(15, 'Auto-detecting grid...');
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0);
                const imageDataObj = ctx.getImageData(0, 0, width, height);
                const autoResult = await autoDetectGrid(imageDataObj);
                if (autoResult.success && autoResult.calibration) {
                    logger.info({
                        operation: 'build_planner_scan.auto_grid_success',
                        data: { calibration: autoResult.calibration },
                    });
                }
            }
        } catch (error) {
            logger.warn({
                operation: 'build_planner_scan.auto_grid_failed',
                error: { name: (error as Error).name, message: (error as Error).message },
            });
        }
    }

    // Run OCR detection
    report(20, 'Running text recognition...');
    let ocrResults: {
        items: DetectionResult[];
        tomes: DetectionResult[];
        character: DetectionResult | null;
        weapon: DetectionResult | null;
    } = { items: [], tomes: [], character: null, weapon: null };

    try {
        ocrResults = await autoDetectFromImage(imageData, (progress, status) => {
            report(20 + progress * 0.3, status);
        });
    } catch (error) {
        logger.warn({
            operation: 'build_planner_scan.ocr_failed',
            error: { name: (error as Error).name, message: (error as Error).message },
        });
    }

    // Run CV detection
    report(50, 'Running icon recognition...');
    let cvResults: { entity: Item | Tome | Character | Weapon; confidence: number; type: string }[] = [];

    if (templatesLoaded || isCVFullyLoaded()) {
        try {
            cvResults = await detectItemsWithCV(imageData, (progress, status) => {
                report(50 + progress * 0.4, status);
            });
        } catch (error) {
            logger.warn({
                operation: 'build_planner_scan.cv_failed',
                error: { name: (error as Error).name, message: (error as Error).message },
            });
        }
    }

    // Combine results
    report(90, 'Combining detections...');

    // Convert CV results to OCR format for combining
    const cvAsOCR: DetectionResult[] = cvResults.map(cv => ({
        type: cv.type as 'item' | 'tome' | 'character' | 'weapon',
        entity: cv.entity,
        confidence: cv.confidence,
        rawText: `cv_detected_${cv.entity.name}`,
    }));

    // Combine and aggregate
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

    // Build result
    const detectedBuild: DetectedBuild = {
        character: ocrResults.character
            ? (ocrResults.character.entity as Character)
            : (cvResults.find(r => r.type === 'character')?.entity as Character) || null,
        weapon: ocrResults.weapon
            ? (ocrResults.weapon.entity as Weapon)
            : (cvResults.find(r => r.type === 'weapon')?.entity as Weapon) || null,
        items: aggregatedItems.map(r => ({
            item: r.entity as Item,
            count: r.count || 1,
            confidence: r.confidence,
        })),
        tomes: aggregatedTomes.map(r => ({
            tome: r.entity as Tome,
            confidence: r.confidence,
        })),
    };

    report(100, 'Detection complete!');

    return detectedBuild;
}

// ========================================
// Modal UI
// ========================================

/**
 * Show processing modal
 */
function showProcessingModal(imageData: string): void {
    if (!previewModal) return;

    const content = document.getElementById('build-scan-content');
    if (content) {
        content.innerHTML = `
            <div class="build-scan-processing">
                <div class="build-scan-image-preview">
                    <img src="${imageData}" alt="Processing screenshot" />
                </div>
                <div class="build-scan-progress">
                    <div class="build-scan-progress-bar">
                        <div class="build-scan-progress-fill" style="width: 0%"></div>
                    </div>
                    <p class="build-scan-progress-text">Initializing...</p>
                </div>
            </div>
        `;
    }

    previewModal.style.display = 'flex';
}

/**
 * Update processing progress
 */
function updateProcessingProgress(progress: ScanProgress): void {
    const fill = document.querySelector('.build-scan-progress-fill') as HTMLElement;
    const text = document.querySelector('.build-scan-progress-text');

    if (fill) {
        fill.style.width = `${progress.progress}%`;
    }
    if (text) {
        text.textContent = progress.status;
    }
}

/**
 * Show preview modal with detection results
 */
function showPreviewModal(imageData: string, detectedBuild: DetectedBuild): void {
    if (!previewModal) return;

    currentDetectedBuild = detectedBuild;

    const totalItems = detectedBuild.items.reduce((sum, i) => sum + i.count, 0);
    const avgConfidence =
        detectedBuild.items.length > 0
            ? detectedBuild.items.reduce((sum, i) => sum + i.confidence, 0) / detectedBuild.items.length
            : 0;

    const content = document.getElementById('build-scan-content');
    if (content) {
        content.innerHTML = `
            <div class="build-scan-preview">
                <div class="build-scan-image-preview">
                    <img src="${imageData}" alt="Uploaded screenshot" />
                </div>

                <div class="build-scan-results">
                    <h3>Detected Items</h3>

                    ${
                        detectedBuild.items.length === 0 && detectedBuild.tomes.length === 0
                            ? '<p class="build-scan-empty">No items detected. Try a clearer screenshot of the pause menu.</p>'
                            : `
                            <div class="build-scan-stats">
                                <span>${totalItems} items</span>
                                <span>${detectedBuild.tomes.length} tomes</span>
                                <span>Avg confidence: ${Math.round(avgConfidence * 100)}%</span>
                            </div>

                            ${
                                detectedBuild.character
                                    ? `
                                <div class="build-scan-section">
                                    <h4>Character</h4>
                                    <div class="build-scan-entity">${escapeHtml(detectedBuild.character.name)}</div>
                                </div>
                            `
                                    : ''
                            }

                            ${
                                detectedBuild.weapon
                                    ? `
                                <div class="build-scan-section">
                                    <h4>Weapon</h4>
                                    <div class="build-scan-entity">${escapeHtml(detectedBuild.weapon.name)}</div>
                                </div>
                            `
                                    : ''
                            }

                            ${
                                detectedBuild.items.length > 0
                                    ? `
                                <div class="build-scan-section">
                                    <h4>Items</h4>
                                    <div class="build-scan-items-list">
                                        ${detectedBuild.items
                                            .map(
                                                ({ item, count, confidence }) => `
                                            <div class="build-scan-item ${getConfidenceClass(confidence)}">
                                                <span class="item-name">${escapeHtml(item.name)}${count > 1 ? ` x${count}` : ''}</span>
                                                <span class="item-confidence">${Math.round(confidence * 100)}%</span>
                                            </div>
                                        `
                                            )
                                            .join('')}
                                    </div>
                                </div>
                            `
                                    : ''
                            }

                            ${
                                detectedBuild.tomes.length > 0
                                    ? `
                                <div class="build-scan-section">
                                    <h4>Tomes</h4>
                                    <div class="build-scan-items-list">
                                        ${detectedBuild.tomes
                                            .map(
                                                ({ tome, confidence }) => `
                                            <div class="build-scan-item ${getConfidenceClass(confidence)}">
                                                <span class="item-name">${escapeHtml(tome.name)}</span>
                                                <span class="item-confidence">${Math.round(confidence * 100)}%</span>
                                            </div>
                                        `
                                            )
                                            .join('')}
                                    </div>
                                </div>
                            `
                                    : ''
                            }
                        `
                    }
                </div>

                <div class="build-scan-actions">
                    ${
                        detectedBuild.items.length > 0 || detectedBuild.tomes.length > 0
                            ? `
                        <button id="apply-detected-build" class="btn-primary">
                            ✅ Apply to Build Planner
                        </button>
                    `
                            : ''
                    }
                    <button id="cancel-detected-build" class="btn-secondary">
                        Cancel
                    </button>
                </div>
            </div>
        `;

        // Setup action buttons
        const applyBtn = document.getElementById('apply-detected-build');
        applyBtn?.addEventListener('click', applyDetectedBuild);

        const cancelBtn = document.getElementById('cancel-detected-build');
        cancelBtn?.addEventListener('click', closePreviewModal);
    }
}

/**
 * Get CSS class based on confidence level
 */
function getConfidenceClass(confidence: number): string {
    if (confidence >= 0.8) return 'confidence-high';
    if (confidence >= 0.5) return 'confidence-medium';
    return 'confidence-low';
}

/**
 * Close preview modal
 */
function closePreviewModal(): void {
    if (previewModal) {
        previewModal.style.display = 'none';
    }
    currentDetectedBuild = null;
}

/**
 * Apply detected build to the Build Planner
 */
function applyDetectedBuild(): void {
    if (!currentDetectedBuild) {
        ToastManager.error('No detected build to apply');
        return;
    }

    // Convert to BuildData format
    const buildData = {
        character: currentDetectedBuild.character?.id,
        weapon: currentDetectedBuild.weapon?.id,
        // For items, we take unique items (build planner doesn't support stacks)
        items: [...new Set(currentDetectedBuild.items.map(i => i.item.id))],
        tomes: currentDetectedBuild.tomes.map(t => t.tome.id),
        name: 'Imported Build',
        notes: `Imported from screenshot on ${new Date().toLocaleString()}`,
    };

    // Load into build planner
    loadBuildFromData(buildData);

    // Close modal
    closePreviewModal();

    // Show success message
    const itemCount = buildData.items.length;
    const tomeCount = buildData.tomes.length;
    ToastManager.success(`Applied ${itemCount} items and ${tomeCount} tomes to Build Planner!`);

    logger.info({
        operation: 'build_planner_scan.build_applied',
        data: {
            characterId: buildData.character,
            weaponId: buildData.weapon,
            itemsCount: itemCount,
            tomesCount: tomeCount,
        },
    });
}

// ========================================
// Exports
// ========================================

export { closePreviewModal, applyDetectedBuild };
