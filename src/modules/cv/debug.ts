// ========================================
// CV Debug Visualization
// ========================================

import type { CVDetectionResult, ROI } from './types.ts';
import { loadImageToCanvas } from './detection.ts';
import { logger } from '../logger.ts';

/**
 * Render debug overlay showing scan regions and detections
 * Draws colored boxes around detections with confidence scores
 */
export async function renderDebugOverlay(
    canvas: HTMLCanvasElement,
    imageDataUrl: string,
    scanRegions: ROI[],
    detections: CVDetectionResult[],
    _emptyCells?: Set<number> // Deprecated, kept for compatibility
): Promise<void> {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        logger.warn({
            operation: 'cv.debug.render_overlay_no_context',
            data: { canvasWidth: canvas.width, canvasHeight: canvas.height },
        });
        return;
    }

    // Wait for image to load properly (fixes race condition)
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = (event) => {
            const errorMsg = event instanceof ErrorEvent ? event.message : 'Unknown image load error';
            logger.warn({
                operation: 'cv.debug.image_load_failed',
                data: { imageUrlLength: imageDataUrl.length, error: errorMsg },
            });
            reject(new Error(`Failed to load image for debug overlay: ${errorMsg}`));
        };
        image.src = imageDataUrl;
    });

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    // Draw scan regions (dashed cyan boxes)
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 5]);
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)'; // Cyan, semi-transparent
    ctx.font = '14px monospace';

    scanRegions.forEach(region => {
        ctx.strokeRect(region.x, region.y, region.width, region.height);

        // Label the region
        if (region.label) {
            ctx.fillStyle = 'rgba(0, 255, 255, 0.8)';
            const labelText = region.label.replace('_', ' ').toUpperCase();
            ctx.fillRect(region.x, region.y - 20, ctx.measureText(labelText).width + 10, 20);
            ctx.fillStyle = 'black';
            ctx.fillText(labelText, region.x + 5, region.y - 5);
        }
    });

    // Reset line dash for detections
    ctx.setLineDash([]);

    // Draw detections with confidence-based colors
    detections.forEach(detection => {
        if (!detection.position) return;

        const pos = detection.position;
        const confidence = detection.confidence;

        // Color based on confidence
        let color: string;
        if (confidence >= 0.85) {
            color = 'rgba(0, 255, 0, 0.8)'; // Green = high confidence
        } else if (confidence >= 0.7) {
            color = 'rgba(255, 165, 0, 0.8)'; // Orange = medium confidence
        } else {
            color = 'rgba(255, 0, 0, 0.8)'; // Red = low confidence
        }

        // Draw detection border (thicker)
        ctx.lineWidth = 3;
        ctx.strokeStyle = color;
        ctx.strokeRect(pos.x, pos.y, pos.width, pos.height);

        // Draw label background
        const label = `${detection.entity.name}`;
        const confidenceText = `${(confidence * 100).toFixed(0)}%`;
        const labelWidth = Math.max(ctx.measureText(label).width, ctx.measureText(confidenceText).width) + 10;

        ctx.fillStyle = color;
        ctx.fillRect(pos.x, pos.y + pos.height, labelWidth, 36);

        // Draw label text
        ctx.fillStyle = 'black';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(label, pos.x + 5, pos.y + pos.height + 14);
        ctx.fillText(confidenceText, pos.x + 5, pos.y + pos.height + 30);
    });

    // Draw legend
    const legendX = 10;
    const legendY = 10;
    const legendHeight = 140;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(legendX, legendY, 220, legendHeight);

    ctx.fillStyle = 'white';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('Smart Detection Overlay', legendX + 10, legendY + 20);

    ctx.font = '12px monospace';
    ctx.fillStyle = 'rgba(0, 255, 0, 1)';
    ctx.fillText('■ High (≥85%)', legendX + 10, legendY + 45);

    ctx.fillStyle = 'rgba(255, 165, 0, 1)';
    ctx.fillText('■ Medium (70-85%)', legendX + 10, legendY + 65);

    ctx.fillStyle = 'rgba(255, 0, 0, 1)';
    ctx.fillText('■ Low (<70%)', legendX + 10, legendY + 85);

    ctx.fillStyle = 'rgba(0, 255, 255, 1)';
    ctx.fillText('┄ Scan regions', legendX + 10, legendY + 105);

    ctx.fillStyle = 'rgba(200, 200, 200, 1)';
    ctx.fillText(`Detections: ${detections.length}`, legendX + 10, legendY + 125);
}

/**
 * Create debug overlay canvas and return as data URL
 * Shows scan regions and detected icons with confidence scores
 * Returns a fallback placeholder image URL if creation fails
 */
export async function createDebugOverlay(imageDataUrl: string, detections: CVDetectionResult[]): Promise<string> {
    try {
        const { width, height } = await loadImageToCanvas(imageDataUrl);

        // Define scan regions (same as used in detectItemsWithCV)
        const scanRegions: ROI[] = [
            {
                x: 0,
                y: Math.floor(height * 0.8),
                width: width,
                height: Math.floor(height * 0.2),
                label: 'hotbar_region',
            },
            {
                x: 0,
                y: 0,
                width: Math.floor(width * 0.25),
                height: Math.floor(height * 0.4),
                label: 'equipment_region',
            },
        ];

        // Create canvas for debug overlay
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        // Wait for debug overlay to fully render
        await renderDebugOverlay(canvas, imageDataUrl, scanRegions, detections);

        return canvas.toDataURL('image/png');
    } catch (error) {
        logger.error({
            operation: 'cv.debug.create_overlay_failed',
            error: {
                name: (error as Error).name,
                message: (error as Error).message,
                stack: (error as Error).stack?.split('\n').slice(0, 3).join(' -> '),
            },
            data: {
                imageUrlLength: imageDataUrl.length,
                detectionsCount: detections.length,
            },
        });
        // Return the original image as fallback instead of failing completely
        return imageDataUrl;
    }
}

// ========================================
// Enhanced Debug Visualizations
// ========================================

/**
 * Debug visualization options
 */
export interface DebugVisualizationOptions {
    showGrid: boolean;
    showConfidenceHeatmap: boolean;
    showMatchingSteps: boolean;
    confidenceThreshold: number;
    gridCellSize: number;
}

export const defaultDebugOptions: DebugVisualizationOptions = {
    showGrid: true,
    showConfidenceHeatmap: false,
    showMatchingSteps: false,
    confidenceThreshold: 0.7,
    gridCellSize: 64,
};

/**
 * Render live grid overlay during scanning
 * Shows the cell grid being scanned in real-time
 */
export function renderGridOverlay(
    canvas: HTMLCanvasElement,
    gridCells: ROI[],
    currentCell?: number,
    processedCells?: Set<number>
): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw grid cells
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    gridCells.forEach((cell, index) => {
        let color: string;

        if (index === currentCell) {
            color = 'rgba(255, 255, 0, 0.8)'; // Yellow = currently processing
        } else if (processedCells?.has(index)) {
            color = 'rgba(100, 100, 100, 0.4)'; // Gray = processed
        } else {
            color = 'rgba(150, 150, 150, 0.3)'; // Light gray = pending
        }

        ctx.strokeStyle = color;
        ctx.strokeRect(cell.x, cell.y, cell.width, cell.height);

        // Show cell index
        ctx.fillStyle = color;
        ctx.font = '10px monospace';
        ctx.fillText(`${index}`, cell.x + 2, cell.y + 12);
    });

    ctx.setLineDash([]);
}

/**
 * Render confidence heatmap overlay
 * Shows detection confidence as a color gradient
 */
export function renderConfidenceHeatmap(
    canvas: HTMLCanvasElement,
    detections: CVDetectionResult[],
    threshold: number = 0.7
): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Group detections by confidence bands
    const bands = [
        { min: 0.9, max: 1.0, color: 'rgba(0, 255, 0, 0.3)' },
        { min: 0.8, max: 0.9, color: 'rgba(128, 255, 0, 0.3)' },
        { min: 0.7, max: 0.8, color: 'rgba(255, 255, 0, 0.3)' },
        { min: threshold, max: 0.7, color: 'rgba(255, 165, 0, 0.3)' },
        { min: 0, max: threshold, color: 'rgba(255, 0, 0, 0.3)' },
    ];

    detections.forEach(detection => {
        if (!detection.position) return;

        const pos = detection.position;
        const confidence = detection.confidence;

        // Find matching band
        const band = bands.find(b => confidence >= b.min && confidence < b.max);
        if (band) {
            ctx.fillStyle = band.color;
            ctx.fillRect(pos.x, pos.y, pos.width, pos.height);
        }
    });
}

/**
 * Render step-by-step template matching view
 * Shows the matching process for debugging
 */
export interface MatchingStep {
    templateId: string;
    templateName: string;
    similarity: number;
    position: ROI;
    isMatch: boolean;
}

export function renderMatchingSteps(canvas: HTMLCanvasElement, steps: MatchingStep[], currentStep: number): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear previous steps display
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(10, canvas.height - 200, 300, 190);

    // Header
    ctx.fillStyle = 'white';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('Template Matching Steps', 20, canvas.height - 180);

    // Show recent steps
    ctx.font = '11px monospace';
    const displaySteps = steps.slice(Math.max(0, currentStep - 7), currentStep + 1);

    displaySteps.forEach((step, i) => {
        const y = canvas.height - 160 + i * 20;
        const isLatest = i === displaySteps.length - 1;

        // Background for latest step
        if (isLatest) {
            ctx.fillStyle = 'rgba(255, 255, 0, 0.2)';
            ctx.fillRect(15, y - 12, 290, 18);
        }

        // Match indicator
        ctx.fillStyle = step.isMatch ? 'rgba(0, 255, 0, 1)' : 'rgba(255, 0, 0, 1)';
        ctx.fillText(step.isMatch ? '✓' : '✗', 20, y);

        // Template name and similarity
        ctx.fillStyle = 'white';
        const text = `${step.templateName.slice(0, 15).padEnd(15)} ${(step.similarity * 100).toFixed(1)}%`;
        ctx.fillText(text, 40, y);
    });

    // Progress indicator
    ctx.fillStyle = 'rgba(100, 100, 255, 1)';
    ctx.fillText(`Step ${currentStep + 1}/${steps.length}`, 220, canvas.height - 180);
}

/**
 * Render side-by-side strategy comparison
 * Compares results from different CV strategies
 */
export interface StrategyResult {
    strategyName: string;
    detections: CVDetectionResult[];
    processingTime: number;
    accuracy?: number;
}

export async function renderStrategyComparison(
    canvas: HTMLCanvasElement,
    imageDataUrl: string,
    results: StrategyResult[]
): Promise<void> {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Load image
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Failed to load image'));
        image.src = imageDataUrl;
    });

    // Calculate layout
    const numStrategies = results.length;
    const colWidth = Math.floor(img.width / numStrategies);
    canvas.width = img.width;
    canvas.height = img.height + 80; // Extra space for labels

    // Draw comparison panel
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(0, 0, canvas.width, 80);

    // Draw header
    ctx.fillStyle = 'white';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('Strategy Comparison', 10, 25);

    results.forEach((result, index) => {
        const x = index * colWidth;

        // Draw strategy header
        ctx.fillStyle = 'rgba(50, 50, 50, 1)';
        ctx.fillRect(x, 35, colWidth - 5, 40);

        ctx.fillStyle = 'white';
        ctx.font = '12px monospace';
        ctx.fillText(result.strategyName, x + 5, 52);
        ctx.fillText(`${result.detections.length} items | ${result.processingTime}ms`, x + 5, 68);

        // Draw image section
        ctx.drawImage(img, x, 80, colWidth, img.height);

        // Draw detections for this strategy
        result.detections.forEach(detection => {
            if (!detection.position) return;

            const pos = detection.position;
            const confidence = detection.confidence;

            const color =
                confidence >= 0.85
                    ? 'rgba(0, 255, 0, 0.8)'
                    : confidence >= 0.7
                      ? 'rgba(255, 165, 0, 0.8)'
                      : 'rgba(255, 0, 0, 0.8)';

            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.strokeRect(
                x + (pos.x * colWidth) / img.width,
                80 + pos.y,
                (pos.width * colWidth) / img.width,
                pos.height
            );
        });

        // Draw separator
        if (index < numStrategies - 1) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x + colWidth - 2, 80);
            ctx.lineTo(x + colWidth - 2, canvas.height);
            ctx.stroke();
        }
    });
}

/**
 * Render confidence distribution histogram
 */
export function renderConfidenceHistogram(
    canvas: HTMLCanvasElement,
    detections: CVDetectionResult[],
    threshold: number = 0.7
): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate histogram bins
    const bins = Array(10).fill(0);
    detections.forEach(d => {
        const bin = Math.min(9, Math.floor(d.confidence * 10));
        bins[bin]++;
    });

    const maxCount = Math.max(...bins, 1);

    // Draw histogram panel
    const panelX = canvas.width - 210;
    const panelY = canvas.height - 120;
    const panelWidth = 200;
    const panelHeight = 110;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);

    // Title
    ctx.fillStyle = 'white';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('Confidence Distribution', panelX + 10, panelY + 15);

    // Draw bars
    const barWidth = 15;
    const barStartX = panelX + 20;
    const barMaxHeight = 60;

    bins.forEach((count, i) => {
        const x = barStartX + i * (barWidth + 4);
        const height = (count / maxCount) * barMaxHeight;
        const y = panelY + 90 - height;

        // Bar color based on bin
        const confidence = (i + 0.5) / 10;
        ctx.fillStyle =
            confidence >= 0.85
                ? 'rgba(0, 255, 0, 0.8)'
                : confidence >= 0.7
                  ? 'rgba(255, 165, 0, 0.8)'
                  : 'rgba(255, 0, 0, 0.8)';

        ctx.fillRect(x, y, barWidth, height);

        // Count label
        if (count > 0) {
            ctx.fillStyle = 'white';
            ctx.font = '9px monospace';
            ctx.fillText(String(count), x + 2, y - 2);
        }
    });

    // Threshold line
    const thresholdX = barStartX + threshold * 10 * (barWidth + 4);
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(thresholdX, panelY + 25);
    ctx.lineTo(thresholdX, panelY + 95);
    ctx.stroke();
    ctx.setLineDash([]);

    // X-axis labels
    ctx.fillStyle = 'rgba(150, 150, 150, 1)';
    ctx.font = '9px monospace';
    ctx.fillText('0%', barStartX - 5, panelY + 103);
    ctx.fillText('100%', barStartX + 155, panelY + 103);
}
