// ========================================
// MegaBonk Build Planner Screenshot Import
// ========================================
// First-class screenshot import flow for the Build Planner
// with readiness reporting, preflight checks, and review-first apply.
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
    loadTrainingData,
    getTrainingStats,
} from './cv/index.ts';
import { autoDetectFromImage, initOCR, type DetectionResult } from './ocr/index.ts';
import { loadBuildFromData } from './build-planner.ts';
import { escapeHtml } from './utils.ts';
import {
    analyzeScanPreflight,
    renderScanPreflightReport,
    clearScanPreflightReport,
    type ScanPreflightReport,
} from './scan-build-preflight.ts';

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

export type ScanUIState = 'idle' | 'preflight' | 'processing' | 'review' | 'applied' | 'error';

type StatusTone = 'neutral' | 'info' | 'warn' | 'success' | 'error';

interface ScanSummarySnapshot {
    fileLabel: string;
    totalItems: number;
    totalTomes: number;
    avgConfidence: number;
    confidenceLabel: string;
    confidenceTone: StatusTone;
    hasDetectedEntities: boolean;
}

interface ScanStateCopy {
    label: string;
    title: string;
    body: string;
    tone: StatusTone;
}

type ReadinessTone = 'ready' | 'warn' | 'error' | 'loading';

// ========================================
// Constants
// ========================================

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const HIGH_CONFIDENCE_THRESHOLD = 0.8;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.6;

const DEFAULT_STATE_COPY: Record<ScanUIState, ScanStateCopy> = {
    idle: {
        label: 'Idle',
        title: 'Waiting for a screenshot',
        body: 'Import a pause-menu screenshot to preview matches, warnings, and manual review flags.',
        tone: 'neutral',
    },
    preflight: {
        label: 'Preflight',
        title: 'Checking screenshot quality',
        body: 'Inspecting resolution, screen type, and grid confidence before icon matching starts.',
        tone: 'info',
    },
    processing: {
        label: 'Processing',
        title: 'Scanning screenshot',
        body: 'Running OCR and icon matching. Nothing is applied automatically.',
        tone: 'info',
    },
    review: {
        label: 'Review',
        title: 'Review ready',
        body: 'Preview the import and review low-confidence matches before applying anything.',
        tone: 'warn',
    },
    applied: {
        label: 'Applied',
        title: 'Results applied',
        body: 'The reviewed screenshot import has been copied into your Build Planner.',
        tone: 'success',
    },
    error: {
        label: 'Error',
        title: 'Scan failed',
        body: 'The screenshot could not be processed. Your current build was not changed.',
        tone: 'error',
    },
};

// ========================================
// State
// ========================================

let isInitialized = false;
let templatesLoaded = false;
let templatesLoadError: Error | null = null;
let presetsLoaded = false;
let presetsLoadError: Error | null = null;
let trainingTemplatesAvailable = false;
let trainingLoadError: Error | null = null;

let previewModal: HTMLElement | null = null;
let currentDetectedBuild: DetectedBuild | null = null;
let currentPreflightReport: ScanPreflightReport | null = null;
let currentScanState: ScanUIState = 'idle';
let lastImageData: string | null = null;
let lastFileLabel: string | null = null;
let lastSummarySnapshot: ScanSummarySnapshot | null = null;

// ========================================
// DOM Helpers
// ========================================

function getElement<T extends HTMLElement>(id: string): T | null {
    return document.getElementById(id) as T | null;
}

function ensurePreviewModal(): void {
    previewModal = getElement<HTMLElement>('build-planner-scan-modal');
    if (previewModal) return;

    const modal = document.createElement('div');
    modal.id = 'build-planner-scan-modal';
    modal.className = 'modal build-scan-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'build-scan-modal-title');
    modal.innerHTML = `
        <div class="modal-content modal-wide">
            <button class="close" id="close-scan-modal" aria-label="Close screenshot review">&times;</button>
            <h2 id="build-scan-modal-title">📷 Review Screenshot Import</h2>
            <div id="build-scan-content"></div>
        </div>
    `;
    document.body.appendChild(modal);
    previewModal = modal;
}

function setupUI(): void {
    ensurePreviewModal();
    updateReadinessUI();
    renderScanSummary();
    updateRetryButton();
    setScanState(currentScanState);
}

// ========================================
// Initialization
// ========================================

/**
 * Initialize the build planner scan module.
 */
export async function initBuildPlannerScan(gameData: AllGameData): Promise<void> {
    setupUI();
    setupEventListeners();

    if (isInitialized) {
        updateReadinessUI();
        return;
    }

    setScanState('idle');

    initCV(gameData);
    initOCR(gameData);

    updateReadinessUI();

    const loadPromises: Promise<void>[] = [
        loadItemTemplates()
            .then(() => {
                templatesLoaded = true;
                templatesLoadError = null;
                logger.info({
                    operation: 'build_planner_scan.templates_loaded',
                    data: { success: true },
                });
            })
            .catch(error => {
                templatesLoaded = false;
                templatesLoadError = error as Error;
                logger.warn({
                    operation: 'build_planner_scan.templates_load_failed',
                    error: { name: (error as Error).name, message: (error as Error).message },
                });
            }),
        loadGridPresets()
            .then(() => {
                presetsLoaded = true;
                presetsLoadError = null;
                logger.info({
                    operation: 'build_planner_scan.presets_loaded',
                    data: { success: true },
                });
            })
            .catch(error => {
                presetsLoaded = false;
                presetsLoadError = error as Error;
                logger.warn({
                    operation: 'build_planner_scan.presets_load_failed',
                    error: { name: (error as Error).name, message: (error as Error).message },
                });
            }),
        loadTrainingData()
            .then(() => {
                const stats = getTrainingStats();
                trainingTemplatesAvailable = stats.totalTemplates > 0;
                trainingLoadError = null;
                logger.info({
                    operation: 'build_planner_scan.training_loaded',
                    data: {
                        templateCount: stats.totalTemplates,
                        itemCount: stats.totalItems,
                    },
                });
            })
            .catch(error => {
                trainingTemplatesAvailable = false;
                trainingLoadError = error as Error;
                logger.warn({
                    operation: 'build_planner_scan.training_load_failed',
                    error: { name: (error as Error).name, message: (error as Error).message },
                });
            }),
    ];

    await Promise.allSettled(loadPromises);
    updateReadinessUI();

    isInitialized = true;

    logger.info({
        operation: 'build_planner_scan.init',
        data: {
            templatesLoaded,
            presetsLoaded,
            trainingTemplatesAvailable,
            itemsCount: gameData.items?.items.length || 0,
        },
    });
}

// ========================================
// UI State
// ========================================

function setScanState(state: ScanUIState, overrides: Partial<ScanStateCopy> = {}): void {
    currentScanState = state;

    const badge = getElement<HTMLElement>('build-scan-state-badge');
    const title = getElement<HTMLElement>('build-scan-inline-status-title');
    const body = getElement<HTMLElement>('build-scan-inline-status-body');
    const container = getElement<HTMLElement>('build-scan-inline-status');
    const copy = { ...DEFAULT_STATE_COPY[state], ...overrides };

    if (badge) {
        badge.className = `build-scan-state-badge state-${state}`;
        badge.textContent = copy.label;
    }

    if (title) {
        title.textContent = copy.title;
    }

    if (body) {
        body.textContent = copy.body;
    }

    if (container) {
        container.className = `build-scan-inline-status tone-${copy.tone}`;
    }

    updateReadinessUI();
    updateRetryButton();
}

function renderReadinessCard(label: string, status: string, detail: string, tone: ReadinessTone): string {
    return `
        <div class="build-scan-readiness-card tone-${tone}">
            <span class="build-scan-readiness-label">${escapeHtml(label)}</span>
            <strong class="build-scan-readiness-status">${escapeHtml(status)}</strong>
            <span class="build-scan-readiness-detail">${escapeHtml(detail)}</span>
        </div>
    `;
}

function updateReadinessUI(): void {
    const container = getElement<HTMLElement>('build-scan-readiness');
    const importBtn = getElement<HTMLButtonElement>('import-screenshot-btn');
    if (!container) return;

    const trainingStats = getTrainingStats();
    const templatesTone: ReadinessTone = templatesLoadError
        ? 'warn'
        : templatesLoaded || isCVFullyLoaded()
          ? 'ready'
          : 'loading';
    const presetsTone: ReadinessTone = presetsLoadError ? 'warn' : presetsLoaded ? 'ready' : 'loading';
    const trainingTone: ReadinessTone = trainingLoadError
        ? 'warn'
        : trainingTemplatesAvailable
          ? 'ready'
          : trainingStats.loaded
            ? 'warn'
            : 'loading';

    container.innerHTML = `
        ${renderReadinessCard(
            'Templates',
            templatesTone === 'ready' ? 'Ready' : templatesTone === 'warn' ? 'Fallback' : 'Loading',
            templatesTone === 'ready'
                ? 'Primary icon templates are available.'
                : 'Static art will be used until screenshot-trained templates are ready.',
            templatesTone
        )}
        ${renderReadinessCard(
            'Training Data',
            trainingTemplatesAvailable ? 'Active' : trainingTone === 'loading' ? 'Loading' : 'Fallback',
            trainingTemplatesAvailable
                ? `${trainingStats.totalTemplates} screenshot-derived templates loaded.`
                : 'Using art-template fallback where screenshot templates are unavailable.',
            trainingTone
        )}
        ${renderReadinessCard(
            'Grid Presets',
            presetsTone === 'ready' ? 'Ready' : presetsTone === 'warn' ? 'Retry Needed' : 'Loading',
            presetsTone === 'ready'
                ? 'Preset calibrations are ready for common resolutions.'
                : 'Grid auto-detection can still run if preset loading falls back.',
            presetsTone
        )}
    `;

    if (importBtn) {
        importBtn.disabled = currentScanState === 'processing';
        importBtn.title =
            templatesLoadError || presetsLoadError
                ? 'Scan is available, but some CV readiness checks fell back to reduced-confidence paths.'
                : 'Upload a screenshot and review the import before applying it.';
    }
}

function updateRetryButton(): void {
    const retryBtn = getElement<HTMLButtonElement>('retry-last-scan-btn');
    if (!retryBtn) return;

    retryBtn.disabled = !lastImageData || currentScanState === 'processing';
}

function renderScanSummary(): void {
    const container = getElement<HTMLElement>('build-scan-summary');
    if (!container) return;

    if (!lastSummarySnapshot) {
        container.hidden = true;
        container.innerHTML = '';
        return;
    }

    const details = [
        `Source: ${lastSummarySnapshot.fileLabel}`,
        `${lastSummarySnapshot.totalItems} items`,
        `${lastSummarySnapshot.totalTomes} tomes`,
        `Average confidence: ${Math.round(lastSummarySnapshot.avgConfidence * 100)}%`,
        `Review signal: ${lastSummarySnapshot.confidenceLabel}`,
    ];

    if (currentPreflightReport) {
        details.push(`Preflight: ${currentPreflightReport.status.replace('_', ' ')}`);
        details.push(`${currentPreflightReport.imageWidth}x${currentPreflightReport.imageHeight}`);
    }

    const headline =
        currentScanState === 'applied'
            ? 'Latest screenshot import was applied'
            : currentScanState === 'review'
              ? 'Latest screenshot import is ready for review'
              : currentScanState === 'error'
                ? 'Latest screenshot import failed'
                : 'Latest screenshot import';

    container.hidden = false;
    container.innerHTML = `
        <div class="build-scan-summary-card tone-${lastSummarySnapshot.confidenceTone}">
            <div>
                <h4>${escapeHtml(headline)}</h4>
                <p>${escapeHtml(
                    lastSummarySnapshot.hasDetectedEntities
                        ? 'Nothing changes until you apply the reviewed results.'
                        : 'No reliable entities were detected from the latest screenshot.'
                )}</p>
            </div>
            <ul class="build-scan-summary-list">
                ${details.map(detail => `<li>${escapeHtml(detail)}</li>`).join('')}
            </ul>
        </div>
    `;
}

function captureSummarySnapshot(fileLabel: string, detectedBuild: DetectedBuild): void {
    const totalItems = detectedBuild.items.reduce((sum, entry) => sum + entry.count, 0);
    const totalTomes = detectedBuild.tomes.length;
    const confidenceValues = [
        ...detectedBuild.items.map(entry => entry.confidence),
        ...detectedBuild.tomes.map(entry => entry.confidence),
    ];
    const avgConfidence =
        confidenceValues.length > 0
            ? confidenceValues.reduce((sum, confidence) => sum + confidence, 0) / confidenceValues.length
            : 0;
    const descriptor = getConfidenceDescriptor(avgConfidence);

    lastSummarySnapshot = {
        fileLabel,
        totalItems,
        totalTomes,
        avgConfidence,
        confidenceLabel: descriptor.label,
        confidenceTone: descriptor.tone,
        hasDetectedEntities: hasDetectedEntities(detectedBuild),
    };
}

// ========================================
// Event Listeners
// ========================================

function setupEventListeners(): void {
    const importBtn = getElement<HTMLButtonElement>('import-screenshot-btn');
    if (importBtn && !importBtn.dataset.listenerAttached) {
        importBtn.addEventListener('click', handleImportClick);
        importBtn.dataset.listenerAttached = 'true';
    }

    const retryBtn = getElement<HTMLButtonElement>('retry-last-scan-btn');
    if (retryBtn && !retryBtn.dataset.listenerAttached) {
        retryBtn.addEventListener('click', handleRetryLastScan);
        retryBtn.dataset.listenerAttached = 'true';
    }

    const fileInput = getElement<HTMLInputElement>('build-planner-file-input');
    if (fileInput && !fileInput.dataset.listenerAttached) {
        fileInput.addEventListener('change', handleFileSelect);
        fileInput.dataset.listenerAttached = 'true';
    }

    const closeBtn = getElement<HTMLButtonElement>('close-scan-modal');
    if (closeBtn && !closeBtn.dataset.listenerAttached) {
        closeBtn.addEventListener('click', () => {
            closePreviewModal();
        });
        closeBtn.dataset.listenerAttached = 'true';
    }

    if (previewModal && !previewModal.dataset.listenerAttached) {
        previewModal.addEventListener('click', e => {
            if (e.target === previewModal) {
                closePreviewModal();
            }
        });
        previewModal.dataset.listenerAttached = 'true';
    }

    if (!document.body.dataset.buildScanEscBound) {
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && previewModal?.style.display === 'flex') {
                closePreviewModal();
            }
        });
        document.body.dataset.buildScanEscBound = 'true';
    }
}

function handleImportClick(): void {
    const fileInput = getElement<HTMLInputElement>('build-planner-file-input');
    fileInput?.click();
}

async function handleRetryLastScan(): Promise<void> {
    if (!lastImageData || !lastFileLabel) return;
    await processImage(lastImageData, `${lastFileLabel} (retry)`);
}

async function handleFileSelect(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
        ToastManager.error('Please select an image file');
        input.value = '';
        return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
        ToastManager.error('Image size must be less than 10MB');
        input.value = '';
        return;
    }

    try {
        const imageData = await readFileAsDataURL(file);
        await processImage(imageData, file.name);
    } catch (error) {
        logger.error({
            operation: 'build_planner_scan.file_read_error',
            error: {
                name: (error as Error).name,
                message: (error as Error).message,
            },
        });
        setScanState('error', {
            body: `Failed to read ${file.name}. Try a different screenshot file.`,
        });
        ToastManager.error(`Failed to read screenshot: ${(error as Error).message}`);
    } finally {
        input.value = '';
    }
}

// ========================================
// Image Processing
// ========================================

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

async function ensureTrainingTemplatesReady(report: (progress: number, status: string) => void): Promise<void> {
    const stats = getTrainingStats();
    if (trainingTemplatesAvailable || stats.totalTemplates > 0) {
        trainingTemplatesAvailable = true;
        updateReadinessUI();
        return;
    }

    report(12, 'Loading screenshot-trained templates...');

    try {
        await loadTrainingData();
        const refreshedStats = getTrainingStats();
        trainingTemplatesAvailable = refreshedStats.totalTemplates > 0;
        trainingLoadError = null;
    } catch (error) {
        trainingTemplatesAvailable = false;
        trainingLoadError = error as Error;
        logger.warn({
            operation: 'build_planner_scan.training_retry_failed',
            error: {
                name: (error as Error).name,
                message: (error as Error).message,
            },
        });
    }

    updateReadinessUI();
}

async function tryAutoDetectGrid(
    img: HTMLImageElement,
    width: number,
    height: number,
    report: (progress: number, status: string) => void
): Promise<void> {
    try {
        report(18, 'Auto-detecting grid...');
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const autoResult = await autoDetectGrid(ctx, width, height);
        if (autoResult.success && autoResult.calibration) {
            logger.info({
                operation: 'build_planner_scan.auto_grid_success',
                data: { calibration: autoResult.calibration, confidence: autoResult.confidence },
            });
        }
    } catch (error) {
        logger.warn({
            operation: 'build_planner_scan.auto_grid_failed',
            error: { name: (error as Error).name, message: (error as Error).message },
        });
    }
}

async function processImage(imageData: string, fileLabel: string): Promise<void> {
    lastImageData = imageData;
    lastFileLabel = fileLabel;
    currentDetectedBuild = null;
    currentPreflightReport = null;
    updateRetryButton();
    clearScanPreflightReport();

    try {
        setScanState('preflight', {
            body: `Checking ${fileLabel} for pause-menu quality, resolution, and grid confidence.`,
        });

        try {
            currentPreflightReport = await analyzeScanPreflight(imageData);
            renderScanPreflightReport(currentPreflightReport);
        } catch (error) {
            currentPreflightReport = null;
            logger.warn({
                operation: 'build_planner_scan.preflight_failed',
                error: {
                    name: (error as Error).name,
                    message: (error as Error).message,
                },
            });
        }

        setScanState('processing', {
            body: `Scanning ${fileLabel}. Nothing will be applied until you review the preview.`,
        });
        showProcessingModal(imageData, fileLabel);

        const detectedBuild = await detectBuildFromImage(imageData, progress => {
            updateProcessingProgress(progress);
        });

        captureSummarySnapshot(fileLabel, detectedBuild);
        renderScanSummary();
        showPreviewModal(imageData, detectedBuild);

        logger.info({
            operation: 'build_planner_scan.file_processed',
            data: {
                fileLabel,
                itemsDetected: detectedBuild.items.length,
                tomesDetected: detectedBuild.tomes.length,
                hasPreflight: Boolean(currentPreflightReport),
            },
        });
    } catch (error) {
        hidePreviewModal();
        setScanState('error', {
            body: `Failed to process ${fileLabel}: ${(error as Error).message}`,
        });
        renderScanSummary();
        logger.error({
            operation: 'build_planner_scan.process_error',
            error: {
                name: (error as Error).name,
                message: (error as Error).message,
            },
        });
        ToastManager.error(`Failed to process screenshot: ${(error as Error).message}`);
    }
}

async function detectBuildFromImage(imageData: string, onProgress?: ProgressCallback): Promise<DetectedBuild> {
    const report = (progress: number, status: string) => {
        onProgress?.({ progress, status });
    };

    report(5, 'Loading image...');

    const img = new Image();
    await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageData;
    });

    const width = img.naturalWidth;
    const height = img.naturalHeight;

    await ensureTrainingTemplatesReady(report);

    report(15, 'Checking grid calibration...');
    const gridConfig = getPresetForResolution(width, height);
    if (gridConfig) {
        report(18, `Using ${width}x${height} preset calibration...`);
    } else if (presetsLoaded) {
        await tryAutoDetectGrid(img, width, height, report);
    }

    report(25, 'Running text recognition...');
    let ocrResults: {
        items: DetectionResult[];
        tomes: DetectionResult[];
        character: DetectionResult | null;
        weapon: DetectionResult | null;
    } = { items: [], tomes: [], character: null, weapon: null };

    try {
        ocrResults = await autoDetectFromImage(imageData, (progress, status) => {
            report(25 + progress * 0.25, status);
        });
    } catch (error) {
        logger.warn({
            operation: 'build_planner_scan.ocr_failed',
            error: { name: (error as Error).name, message: (error as Error).message },
        });
    }

    report(55, 'Running icon recognition...');
    let cvResults: Array<{
        entity: Item | Tome | Character | Weapon;
        confidence: number;
        type: string;
        method: 'template_match' | 'icon_similarity' | 'hybrid';
    }> = [];

    if (templatesLoaded || isCVFullyLoaded()) {
        try {
            const rawCvResults = await detectItemsWithCV(imageData, (progress, status) => {
                report(55 + progress * 0.35, status);
            });
            cvResults = rawCvResults.map(result => ({
                ...result,
                method: 'template_match' as const,
            }));
        } catch (error) {
            logger.warn({
                operation: 'build_planner_scan.cv_failed',
                error: { name: (error as Error).name, message: (error as Error).message },
            });
        }
    }

    report(92, 'Combining detections...');

    const cvAsOCR: DetectionResult[] = cvResults.map(result => ({
        type: result.type as 'item' | 'tome' | 'character' | 'weapon',
        entity: result.entity,
        confidence: result.confidence,
        rawText: `cv_detected_${result.entity.name}`,
    }));

    const cvItemResults = cvResults
        .filter(result => result.type === 'item')
        .map(result => ({ ...result, type: result.type as 'item' | 'tome' | 'character' | 'weapon' }));
    const cvTomeResults = cvResults
        .filter(result => result.type === 'tome')
        .map(result => ({ ...result, type: result.type as 'item' | 'tome' | 'character' | 'weapon' }));

    const combinedItems = combineDetections(
        [...ocrResults.items, ...cvAsOCR.filter(result => result.type === 'item')],
        cvItemResults
    );
    const combinedTomes = combineDetections(
        [...ocrResults.tomes, ...cvAsOCR.filter(result => result.type === 'tome')],
        cvTomeResults
    );

    const aggregatedItems = aggregateDuplicates(combinedItems);
    const aggregatedTomes = aggregateDuplicates(combinedTomes);

    report(100, 'Detection complete');

    return {
        character: ocrResults.character
            ? (ocrResults.character.entity as Character)
            : (cvResults.find(result => result.type === 'character')?.entity as Character) || null,
        weapon: ocrResults.weapon
            ? (ocrResults.weapon.entity as Weapon)
            : (cvResults.find(result => result.type === 'weapon')?.entity as Weapon) || null,
        items: aggregatedItems.map(result => ({
            item: result.entity as Item,
            count: result.count || 1,
            confidence: result.confidence,
        })),
        tomes: aggregatedTomes.map(result => ({
            tome: result.entity as Tome,
            confidence: result.confidence,
        })),
    };
}

// ========================================
// Modal Rendering
// ========================================

function showProcessingModal(imageData: string, fileLabel: string): void {
    ensurePreviewModal();

    const content = getElement<HTMLElement>('build-scan-content');
    if (!content || !previewModal) return;

    content.innerHTML = `
        <div class="build-scan-processing">
            <div class="build-scan-image-preview">
                <img src="${imageData}" alt="Processing screenshot ${escapeHtml(fileLabel)}" loading="lazy" />
            </div>
            <div class="build-scan-progress">
                <div class="build-scan-progress-bar">
                    <div class="build-scan-progress-fill" style="width: 0%"></div>
                </div>
                <p class="build-scan-progress-text">Preparing screenshot review...</p>
            </div>
            <p class="build-scan-review-note">
                This import stays in review mode until you explicitly apply the results.
            </p>
        </div>
    `;

    previewModal.style.display = 'flex';
}

function updateProcessingProgress(progress: ScanProgress): void {
    const fill = document.querySelector('.build-scan-progress-fill') as HTMLElement | null;
    const text = document.querySelector('.build-scan-progress-text');

    if (fill) {
        fill.style.width = `${progress.progress}%`;
    }

    if (text) {
        text.textContent = progress.status;
    }

    setScanState('processing', {
        title: 'Scanning screenshot',
        body: progress.status,
    });
}

function showPreviewModal(imageData: string, detectedBuild: DetectedBuild): void {
    ensurePreviewModal();
    if (!previewModal) return;

    currentDetectedBuild = detectedBuild;

    const totalItems = detectedBuild.items.reduce((sum, entry) => sum + entry.count, 0);
    const confidenceValues = [
        ...detectedBuild.items.map(entry => entry.confidence),
        ...detectedBuild.tomes.map(entry => entry.confidence),
    ];
    const avgConfidence =
        confidenceValues.length > 0
            ? confidenceValues.reduce((sum, confidence) => sum + confidence, 0) / confidenceValues.length
            : 0;
    const hasResults = hasDetectedEntities(detectedBuild);
    const confidenceDescriptor = getConfidenceDescriptor(avgConfidence);

    const content = getElement<HTMLElement>('build-scan-content');
    if (!content) return;

    content.innerHTML = `
        <div class="build-scan-preview">
            <div class="build-scan-image-preview">
                <img src="${imageData}" alt="Uploaded screenshot" loading="lazy" />
            </div>

            <div class="build-scan-results">
                <div class="build-scan-results-header">
                    <h3>Review Detected Build</h3>
                    <p class="build-scan-review-note">
                        Nothing changes until you apply this preview. Review highlighted entries first.
                    </p>
                </div>

                ${
                    currentPreflightReport && currentPreflightReport.status !== 'pass'
                        ? `
                    <div class="build-scan-warning-banner tone-${currentPreflightReport.status === 'high_risk' ? 'error' : 'warn'}">
                        <strong>${currentPreflightReport.status === 'high_risk' ? 'High-risk screenshot' : 'Review warning'}</strong>
                        <span>${escapeHtml(currentPreflightReport.warnings[0] || 'Screenshot quality may reduce confidence.')}</span>
                    </div>
                `
                        : ''
                }

                ${
                    !hasResults
                        ? '<p class="build-scan-empty">No reliable entities were detected. Try a clearer pause-menu screenshot or re-run the latest import.</p>'
                        : `
                    <div class="build-scan-stats">
                        <span>${totalItems} items</span>
                        <span>${detectedBuild.tomes.length} tomes</span>
                        <span>${Math.round(avgConfidence * 100)}% average confidence</span>
                        <span>${escapeHtml(confidenceDescriptor.label)}</span>
                    </div>

                    ${renderBuildSection(
                        'Character',
                        detectedBuild.character
                            ? `<div class="build-scan-entity">${escapeHtml(detectedBuild.character.name)}</div>`
                            : null
                    )}

                    ${renderBuildSection(
                        'Weapon',
                        detectedBuild.weapon
                            ? `<div class="build-scan-entity">${escapeHtml(detectedBuild.weapon.name)}</div>`
                            : null
                    )}

                    ${renderBuildSection(
                        'Items',
                        detectedBuild.items.length > 0
                            ? `
                            <div class="build-scan-items-list">
                                ${detectedBuild.items
                                    .map(
                                        ({ item, count, confidence }) => `
                                    <div class="build-scan-item ${getConfidenceClass(confidence)}">
                                        <span class="item-name">${escapeHtml(formatItemCount(item.name, count))}</span>
                                        <div class="build-scan-item-meta">
                                            ${renderConfidenceTag(confidence)}
                                            <span class="item-confidence">${Math.round(confidence * 100)}%</span>
                                        </div>
                                    </div>
                                `
                                    )
                                    .join('')}
                            </div>
                        `
                            : null
                    )}

                    ${renderBuildSection(
                        'Tomes',
                        detectedBuild.tomes.length > 0
                            ? `
                            <div class="build-scan-items-list">
                                ${detectedBuild.tomes
                                    .map(
                                        ({ tome, confidence }) => `
                                    <div class="build-scan-item ${getConfidenceClass(confidence)}">
                                        <span class="item-name">${escapeHtml(tome.name)}</span>
                                        <div class="build-scan-item-meta">
                                            ${renderConfidenceTag(confidence)}
                                            <span class="item-confidence">${Math.round(confidence * 100)}%</span>
                                        </div>
                                    </div>
                                `
                                    )
                                    .join('')}
                            </div>
                        `
                            : null
                    )}
                `
                }
            </div>

            <div class="build-scan-actions">
                ${
                    hasResults
                        ? `
                    <button id="apply-detected-build" class="btn-primary">
                        ✅ Apply Reviewed Results
                    </button>
                `
                        : ''
                }
                <button id="cancel-detected-build" class="btn-secondary">
                    Close Review
                </button>
            </div>
        </div>
    `;

    const applyBtn = getElement<HTMLButtonElement>('apply-detected-build');
    applyBtn?.addEventListener('click', applyDetectedBuild);

    const cancelBtn = getElement<HTMLButtonElement>('cancel-detected-build');
    cancelBtn?.addEventListener('click', () => {
        closePreviewModal();
    });

    previewModal.style.display = 'flex';
    setScanState('review', {
        body: hasResults
            ? 'Review the preview and apply it when you are comfortable with the highlighted matches.'
            : 'No reliable entities were detected from this screenshot.',
    });
}

function renderBuildSection(title: string, content: string | null): string {
    if (!content) return '';
    return `
        <div class="build-scan-section">
            <h4>${escapeHtml(title)}</h4>
            ${content}
        </div>
    `;
}

function renderConfidenceTag(confidence: number): string {
    const descriptor = getConfidenceDescriptor(confidence);
    return `<span class="build-scan-confidence-tag tone-${descriptor.tone}">${escapeHtml(descriptor.label)}</span>`;
}

function getConfidenceDescriptor(confidence: number): { label: string; tone: StatusTone } {
    if (confidence >= HIGH_CONFIDENCE_THRESHOLD) {
        return { label: 'Strong match', tone: 'success' };
    }
    if (confidence >= MEDIUM_CONFIDENCE_THRESHOLD) {
        return { label: 'Review', tone: 'warn' };
    }
    return { label: 'Low confidence', tone: 'error' };
}

function getConfidenceClass(confidence: number): string {
    if (confidence >= HIGH_CONFIDENCE_THRESHOLD) return 'confidence-high';
    if (confidence >= MEDIUM_CONFIDENCE_THRESHOLD) return 'confidence-medium';
    return 'confidence-low';
}

function formatItemCount(name: string, count: number): string {
    return count > 1 ? `${name} x${count}` : name;
}

function hasDetectedEntities(detectedBuild: DetectedBuild): boolean {
    return Boolean(
        detectedBuild.character ||
        detectedBuild.weapon ||
        detectedBuild.items.length > 0 ||
        detectedBuild.tomes.length > 0
    );
}

function hidePreviewModal(): void {
    if (previewModal) {
        previewModal.style.display = 'none';
    }
}

/**
 * Close preview modal and leave the build unchanged.
 */
function closePreviewModal(): void {
    hidePreviewModal();
    currentDetectedBuild = null;

    if (currentScanState === 'review') {
        setScanState('idle', {
            title: 'Review closed',
            body: 'The screenshot preview was closed. Your Build Planner was not changed.',
            tone: 'neutral',
        });
    }
}

/**
 * Apply detected build to the Build Planner.
 */
function applyDetectedBuild(): void {
    if (!currentDetectedBuild) {
        ToastManager.error('No detected build to apply');
        return;
    }

    const buildData = {
        character: currentDetectedBuild.character?.id,
        weapon: currentDetectedBuild.weapon?.id,
        items: [...new Set(currentDetectedBuild.items.map(entry => entry.item.id))],
        tomes: currentDetectedBuild.tomes.map(entry => entry.tome.id),
        name: 'Imported Build',
        notes: `Imported from screenshot on ${new Date().toLocaleString()}`,
    };

    loadBuildFromData(buildData);
    hidePreviewModal();
    currentDetectedBuild = null;

    const itemCount = buildData.items.length;
    const tomeCount = buildData.tomes.length;

    setScanState('applied', {
        body: `Applied ${itemCount} item selections and ${tomeCount} tomes from the reviewed screenshot.`,
        tone: 'success',
    });
    renderScanSummary();

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
