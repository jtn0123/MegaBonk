// ========================================
// Enhanced CV Detection
// ========================================
// Main detection entry point with strategy support

import type { AllGameData } from '../../types/index.ts';
import type { CVDetectionResult, ROI } from '../computer-vision.ts';
import { detectGridPositions, aggregateDuplicates } from '../computer-vision.ts';
import type { CVStrategy } from '../cv-strategy.ts';
import { getActiveStrategy } from '../cv-strategy.ts';
import { startMetricsTracking } from '../cv-metrics.ts';
import { logger } from '../logger.ts';
import { getAllData, setAllData } from '../cv/state.ts';
import { loadEnhancedTemplates, areEnhancedTemplatesLoaded } from './templates.ts';
import { filterValidCells, multiPassMatching, singlePassMatching } from './matching.ts';
import { loadImage, createCanvasFromImage } from './utils.ts';
import type { ProgressCallback, ValidCellData } from './types.ts';

/**
 * Initialize enhanced CV module
 */
export function initEnhancedCV(gameData: AllGameData): void {
    setAllData(gameData);

    logger.info({
        operation: 'cv_enhanced.init',
        data: {
            itemsCount: gameData.items?.items.length || 0,
        },
    });
}

/**
 * Detect items using configured strategy
 */
async function detectWithStrategy(
    ctx: CanvasRenderingContext2D,
    gridPositions: ROI[],
    strategy: CVStrategy,
    progressCallback?: ProgressCallback
): Promise<CVDetectionResult[]> {
    const gameData = getAllData();
    const items = gameData.items?.items || [];

    // Filter empty cells first
    const validCells: ValidCellData[] = filterValidCells(ctx, gridPositions, strategy);

    // Multi-pass matching if enabled
    if (strategy.multiPassEnabled) {
        return multiPassMatching(validCells, items, strategy, progressCallback);
    } else {
        return singlePassMatching(validCells, items, strategy, progressCallback);
    }
}

/**
 * Enhanced detection with strategy support
 */
export async function detectItemsWithEnhancedCV(
    imageDataUrl: string,
    strategyName: string = 'optimized',
    progressCallback?: ProgressCallback
): Promise<CVDetectionResult[]> {
    const strategy = getActiveStrategy();

    // Start metrics tracking
    const metrics = startMetricsTracking(strategy, strategyName);
    metrics.startLoad();

    try {
        // Ensure templates loaded
        if (!areEnhancedTemplatesLoaded()) {
            if (progressCallback) {
                progressCallback(5, 'Loading enhanced templates...');
            }
            await loadEnhancedTemplates();
        }

        metrics.endLoad();
        metrics.startPreprocess();

        // Load image
        const img = await loadImage(imageDataUrl);
        const { ctx } = createCanvasFromImage(img);

        if (progressCallback) {
            progressCallback(20, 'Detecting grid positions...');
        }

        // Detect grid
        const gridPositions = detectGridPositions(img.width, img.height);

        metrics.endPreprocess();
        metrics.startMatching();

        if (progressCallback) {
            progressCallback(30, `Analyzing ${gridPositions.length} cells...`);
        }

        // Detect items using strategy
        const detections = await detectWithStrategy(ctx, gridPositions, strategy, progressCallback);

        metrics.endMatching();
        metrics.startPostprocess();

        if (progressCallback) {
            progressCallback(95, 'Aggregating results...');
        }

        // Aggregate duplicates
        const aggregated = aggregateDuplicates(detections);

        metrics.endPostprocess();

        // Record metrics
        metrics.recordDetections(aggregated);
        metrics.recordCellStats(
            gridPositions.length,
            0, // Empty cells calculation needed
            gridPositions.length,
            aggregated.length
        );

        const finalMetrics = metrics.complete();

        if (progressCallback) {
            progressCallback(
                100,
                `Complete! Detected ${aggregated.length} items in ${finalMetrics.totalTime.toFixed(0)}ms`
            );
        }

        logger.info({
            operation: 'cv_enhanced.detect_complete',
            data: {
                strategy: strategyName,
                detections: aggregated.length,
                time: finalMetrics.totalTime,
                avgConfidence: finalMetrics.averageConfidence,
            },
        });

        return aggregated;
    } catch (error) {
        logger.error({
            operation: 'cv_enhanced.detect_error',
            error: {
                name: (error as Error).name,
                message: (error as Error).message,
            },
        });
        throw error;
    }
}
