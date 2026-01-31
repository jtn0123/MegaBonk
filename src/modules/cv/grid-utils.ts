// ========================================
// Grid Utils - Helper Functions and Utilities
// Debug visualization, drawing overlays
// ========================================

import type { AutoDetectionResult } from './grid-types.ts';

// ========================================
// Debug Visualization
// ========================================

/**
 * Draw detection overlay on canvas for debugging
 */
export function drawDetectionOverlay(
    ctx: CanvasRenderingContext2D,
    detectionResult: AutoDetectionResult,
    options: {
        showBand?: boolean;
        showEdges?: boolean;
        showGrid?: boolean;
        showLabels?: boolean;
    } = {}
): void {
    const { showBand = true, showEdges = true, showGrid = true, showLabels = true } = options;

    ctx.save();

    // Draw hotbar band region
    if (showBand && detectionResult.bandRegion) {
        const band = detectionResult.bandRegion;
        ctx.strokeStyle = 'rgba(0, 100, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(0, band.topY, ctx.canvas.width, band.height);
        ctx.setLineDash([]);

        if (showLabels) {
            ctx.fillStyle = 'rgba(0, 100, 255, 0.8)';
            ctx.font = '12px monospace';
            ctx.fillText(`Band: Y=${band.topY}-${band.bottomY}`, 5, band.topY - 5);
        }
    }

    // Draw detected border edges
    if (showEdges && detectionResult.borders?.edges && detectionResult.bandRegion) {
        ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
        for (const edge of detectionResult.borders.edges) {
            ctx.beginPath();
            ctx.arc(edge.x, detectionResult.bandRegion.topY + 20, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Draw grid positions
    if (showGrid && detectionResult.grid?.positions && detectionResult.validation) {
        for (const cell of detectionResult.grid.positions) {
            // Determine cell status
            const isValid = detectionResult.validation.validCells?.some(v => v.slotIndex === cell.slotIndex);
            const isEmpty = detectionResult.validation.emptyCells?.some(e => e.slotIndex === cell.slotIndex);

            if (isValid) {
                ctx.strokeStyle = 'rgba(0, 255, 0, 0.9)';
                ctx.lineWidth = 2;
            } else if (isEmpty) {
                ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
                ctx.lineWidth = 1;
            } else {
                ctx.strokeStyle = 'rgba(255, 165, 0, 0.7)';
                ctx.lineWidth = 2;
            }

            ctx.strokeRect(cell.x, cell.y, cell.width, cell.height);

            // Draw slot index
            if (showLabels && isValid) {
                ctx.fillStyle = 'rgba(0, 255, 0, 0.9)';
                ctx.font = '10px monospace';
                ctx.fillText(`${cell.slotIndex}`, cell.x + 2, cell.y + 10);
            }
        }
    }

    ctx.restore();
}
