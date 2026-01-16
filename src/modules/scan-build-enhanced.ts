// ========================================
// Enhanced Scan Build Integration
// ========================================
// Adds enhanced CV strategies to the scan-build module
// ========================================

import type { AllGameData, Character, Weapon } from '../types/index.ts';
import { ToastManager } from './toast.ts';
import { logger } from './logger.ts';
import { setActiveStrategy, STRATEGY_PRESETS } from './cv-strategy.ts';
import { detectItemsWithEnhancedCV, initEnhancedCV, loadEnhancedTemplates } from './computer-vision-enhanced.ts';
import { metricsTracker, type DetectionMetrics } from './cv-metrics.ts';
import { autoDetectFromImage } from './ocr.ts';
import { combineDetections, aggregateDuplicates } from './computer-vision.ts';
import type { DetectionResult } from './ocr.ts';
import type { CVDetectionResult } from './cv/types.ts';

/** Enhanced detection result with count */
interface EnhancedDetectionItem {
    type: 'item' | 'tome' | 'character' | 'weapon';
    entity: CVDetectionResult['entity'];
    confidence: number;
    count?: number;
}

/** Strategy comparison result */
interface StrategyResult {
    strategy: string;
    detections: number;
    timeMs: number;
    avgConfidence: number;
}

/** Enhanced hybrid detection result */
interface EnhancedHybridResult {
    items: EnhancedDetectionItem[];
    tomes: EnhancedDetectionItem[];
    character: Character | null;
    weapon: Weapon | null;
    metrics?: DetectionMetrics;
}

let currentStrategy = 'optimized'; // Default to optimized

/**
 * Initialize enhanced scan build with strategy support
 */
export async function initEnhancedScanBuild(gameData: AllGameData): Promise<void> {
    // Initialize enhanced CV
    initEnhancedCV(gameData);

    // Load enhanced templates
    try {
        await loadEnhancedTemplates();
        logger.info({
            operation: 'scan_build_enhanced.init',
            data: { strategy: currentStrategy, templatesLoaded: true },
        });
    } catch (error) {
        logger.error({
            operation: 'scan_build_enhanced.init_error',
            error: { name: (error as Error).name, message: (error as Error).message },
        });
    }

    setupStrategySelector();
}

/**
 * Setup strategy selector UI
 */
function setupStrategySelector(): void {
    const strategySelectContainer = document.getElementById('scan-strategy-selector');
    if (!strategySelectContainer) return;

    const strategies = Object.keys(STRATEGY_PRESETS);

    const html = `
        <div class="strategy-selector">
            <label for="cv-strategy-select">CV Strategy:</label>
            <select id="cv-strategy-select" class="strategy-select">
                ${strategies
                    .map(
                        strategy => `
                    <option value="${strategy}" ${strategy === currentStrategy ? 'selected' : ''}>
                        ${strategy === 'optimized' ? '⭐ ' : ''}${strategy.charAt(0).toUpperCase() + strategy.slice(1)}
                        ${getStrategyDescription(strategy)}
                    </option>
                `
                    )
                    .join('')}
            </select>
            <div class="strategy-info" id="strategy-info"></div>
        </div>
    `;

    strategySelectContainer.innerHTML = html;

    // Add event listener
    const select = document.getElementById('cv-strategy-select') as HTMLSelectElement;
    select?.addEventListener('change', handleStrategyChange);

    // Show initial info
    updateStrategyInfo(currentStrategy);
}

/**
 * Get strategy description for UI
 */
function getStrategyDescription(strategy: string): string {
    const descriptions: Record<string, string> = {
        optimized: '(Recommended)',
        fast: '(2x faster)',
        accurate: '(Best F1)',
        balanced: '(Good balance)',
        current: '(Baseline)',
    };
    return descriptions[strategy] || '';
}

/**
 * Handle strategy selection change
 */
function handleStrategyChange(e: Event): void {
    const select = e.target as HTMLSelectElement;
    currentStrategy = select.value;

    setActiveStrategy(currentStrategy);
    updateStrategyInfo(currentStrategy);

    ToastManager.info(`Strategy changed to: ${currentStrategy}`);
    logger.info({
        operation: 'scan_build_enhanced.strategy_changed',
        data: { strategy: currentStrategy },
    });
}

/**
 * Update strategy info display
 */
function updateStrategyInfo(strategy: string): void {
    const infoDiv = document.getElementById('strategy-info');
    if (!infoDiv) return;

    const strategyDetails: Record<string, { description: string; speed: string; accuracy: string }> = {
        optimized: {
            description: 'Best balance of speed and accuracy',
            speed: '37% faster',
            accuracy: '84% F1 score',
        },
        fast: {
            description: 'Fastest detection for quick scans',
            speed: '70% faster',
            accuracy: '70% F1 score',
        },
        accurate: {
            description: 'Highest accuracy for validation',
            speed: '15% faster',
            accuracy: '86% F1 score',
        },
        balanced: {
            description: 'Good middle ground',
            speed: '40% faster',
            accuracy: '83% F1 score',
        },
        current: {
            description: 'Original implementation (baseline)',
            speed: 'Baseline',
            accuracy: '72% F1 score',
        },
    };

    const details = strategyDetails[strategy];
    if (details) {
        infoDiv.innerHTML = `
            <div class="strategy-details">
                <p>${details.description}</p>
                <div class="strategy-metrics">
                    <span class="metric"><strong>Speed:</strong> ${details.speed}</span>
                    <span class="metric"><strong>Accuracy:</strong> ${details.accuracy}</span>
                </div>
            </div>
        `;
    }
}

/**
 * Enhanced hybrid detect with strategy support
 */
export async function handleEnhancedHybridDetect(imageDataUrl: string): Promise<EnhancedHybridResult> {
    if (!imageDataUrl) {
        throw new Error('No image provided');
    }

    try {
        const progressDiv = createProgressIndicator();

        ToastManager.info(`Starting detection with ${currentStrategy} strategy...`);

        // Run OCR first (0-40%)
        updateProgressIndicator(progressDiv, 10, 'Running OCR...');
        const ocrResults = await autoDetectFromImage(imageDataUrl, (progress, status) => {
            updateProgressIndicator(progressDiv, 10 + progress * 0.3, status);
        });

        // Run enhanced CV (40-90%)
        updateProgressIndicator(progressDiv, 40, `Running ${currentStrategy} CV...`);
        const cvResults = await detectItemsWithEnhancedCV(imageDataUrl, currentStrategy, (progress, status) => {
            updateProgressIndicator(progressDiv, 40 + progress * 0.5, status);
        });

        // Combine results (90-95%)
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

        // Aggregate duplicates
        const aggregatedItems = aggregateDuplicates(combinedItems);
        const aggregatedTomes = aggregateDuplicates(combinedTomes);

        // Get metrics
        updateProgressIndicator(progressDiv, 95, 'Calculating metrics...');
        const metrics = metricsTracker.getMetricsForStrategy(currentStrategy);
        const latestMetrics = metrics.length > 0 ? metrics[metrics.length - 1] : null;

        // Show metrics
        if (latestMetrics) {
            showMetrics(latestMetrics);
        }

        updateProgressIndicator(progressDiv, 100, 'Complete!');
        setTimeout(() => progressDiv?.remove(), 2000);

        ToastManager.success(
            `Detected ${aggregatedItems.length} items in ${latestMetrics?.totalTime.toFixed(0) || '?'}ms!`
        );

        logger.info({
            operation: 'scan_build_enhanced.hybrid_detect_complete',
            data: {
                strategy: currentStrategy,
                itemsDetected: aggregatedItems.length,
                tomesDetected: aggregatedTomes.length,
                timeMs: latestMetrics?.totalTime,
                avgConfidence: latestMetrics?.averageConfidence,
            },
        });

        return {
            items: aggregatedItems.map(r => ({
                type: r.type,
                entity: r.entity,
                confidence: r.confidence,
                count: (r as any).count || 1,
            })),
            tomes: aggregatedTomes.map(r => ({
                type: r.type,
                entity: r.entity,
                confidence: r.confidence,
            })),
            character: ocrResults.character,
            weapon: ocrResults.weapon,
            metrics: latestMetrics,
        };
    } catch (error) {
        logger.error({
            operation: 'scan_build_enhanced.hybrid_detect_error',
            error: {
                name: (error as Error).name,
                message: (error as Error).message,
            },
        });
        throw error;
    }
}

/**
 * Show metrics in UI
 */
function showMetrics(metrics: any): void {
    const metricsDiv = document.getElementById('scan-detection-metrics');
    if (!metricsDiv) return;

    metricsDiv.innerHTML = `
        <div class="detection-metrics">
            <h4>Detection Metrics</h4>
            <div class="metrics-grid">
                <div class="metric-item">
                    <span class="metric-label">Total Time:</span>
                    <span class="metric-value">${metrics.totalTime.toFixed(0)}ms</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Detections:</span>
                    <span class="metric-value">${metrics.totalDetections}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Avg Confidence:</span>
                    <span class="metric-value">${(metrics.averageConfidence * 100).toFixed(1)}%</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Match Rate:</span>
                    <span class="metric-value">${(metrics.matchRate * 100).toFixed(1)}%</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">High Confidence:</span>
                    <span class="metric-value">${metrics.highConfidenceDetections}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Strategy:</span>
                    <span class="metric-value">${currentStrategy}</span>
                </div>
            </div>
        </div>
    `;

    metricsDiv.style.display = 'block';
}

/**
 * Create progress indicator
 */
function createProgressIndicator(): HTMLDivElement {
    const existing = document.getElementById('scan-detection-progress');
    if (existing) existing.remove();

    const progressDiv = document.createElement('div');
    progressDiv.id = 'scan-detection-progress';
    progressDiv.className = 'detection-progress';
    progressDiv.innerHTML = `
        <div class="progress-bar">
            <div class="progress-fill" id="scan-progress-fill" style="width: 0%"></div>
        </div>
        <div class="progress-text" id="scan-progress-text">Starting...</div>
    `;

    const autoDetectArea = document.getElementById('scan-auto-detect-area');
    autoDetectArea?.appendChild(progressDiv);

    return progressDiv;
}

/**
 * Update progress indicator
 */
function updateProgressIndicator(progressDiv: HTMLDivElement | null, progress: number, status: string): void {
    if (!progressDiv) return;

    const fill = progressDiv.querySelector('#scan-progress-fill') as HTMLDivElement;
    const text = progressDiv.querySelector('#scan-progress-text') as HTMLDivElement;

    if (fill) fill.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    if (text) text.textContent = `${Math.round(progress)}% - ${status}`;
}

/**
 * Compare strategies on current image
 */
export async function compareStrategiesOnImage(imageDataUrl: string): Promise<void> {
    if (!imageDataUrl) {
        ToastManager.error('No image uploaded');
        return;
    }

    const strategies = ['current', 'optimized', 'fast', 'accurate', 'balanced'];

    ToastManager.info('Running comparison on all 5 strategies...');

    const results: any[] = [];

    for (const strategy of strategies) {
        try {
            ToastManager.info(`Testing ${strategy} strategy...`);
            setActiveStrategy(strategy);

            const startTime = performance.now();
            const cvResults = await detectItemsWithEnhancedCV(imageDataUrl, strategy);
            const endTime = performance.now();

            results.push({
                strategy,
                detections: cvResults.length,
                timeMs: endTime - startTime,
                avgConfidence: cvResults.reduce((sum, r) => sum + r.confidence, 0) / (cvResults.length || 1),
            });
        } catch (error) {
            logger.error({
                operation: 'scan_build_enhanced.compare_error',
                error: { name: (error as Error).name, message: (error as Error).message },
            });
        }
    }

    // Show comparison
    showStrategyComparison(results);

    // Restore original strategy
    setActiveStrategy(currentStrategy);
}

/**
 * Show strategy comparison results
 */
function showStrategyComparison(results: any[]): void {
    const comparisonDiv = document.getElementById('scan-strategy-comparison');
    if (!comparisonDiv) return;

    const html = `
        <div class="strategy-comparison">
            <h4>Strategy Comparison Results</h4>
            <table class="comparison-table">
                <thead>
                    <tr>
                        <th>Strategy</th>
                        <th>Detections</th>
                        <th>Time (ms)</th>
                        <th>Avg Confidence</th>
                    </tr>
                </thead>
                <tbody>
                    ${results
                        .map(
                            r => `
                        <tr class="${r.strategy === 'optimized' ? 'recommended' : ''}">
                            <td>${r.strategy === 'optimized' ? '⭐ ' : ''}${r.strategy}</td>
                            <td>${r.detections}</td>
                            <td>${r.timeMs.toFixed(0)}</td>
                            <td>${(r.avgConfidence * 100).toFixed(1)}%</td>
                        </tr>
                    `
                        )
                        .join('')}
                </tbody>
            </table>
        </div>
    `;

    comparisonDiv.innerHTML = html;
    comparisonDiv.style.display = 'block';
}

// Export for window access
if (typeof window !== 'undefined') {
    (window as any).initEnhancedScanBuild = initEnhancedScanBuild;
    (window as any).handleEnhancedHybridDetect = handleEnhancedHybridDetect;
    (window as any).compareStrategiesOnImage = compareStrategiesOnImage;
}
