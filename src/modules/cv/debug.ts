// ========================================
// CV Debug Visualization
// ========================================

import type { CVDetectionResult, ROI } from './types.ts';
import { loadImageToCanvas } from './detection.ts';

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
    if (!ctx) return;

    // Wait for image to load properly (fixes race condition)
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Failed to load image for debug overlay'));
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
 */
export async function createDebugOverlay(imageDataUrl: string, detections: CVDetectionResult[]): Promise<string> {
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
}
