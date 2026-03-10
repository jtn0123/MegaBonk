import { logger } from './logger.ts';
import { autoDetectGrid, detectScreenType, loadImageToCanvas } from './computer-vision.ts';
import { escapeHtml } from './utils.ts';

export type ScanPreflightStatus = 'pass' | 'warn' | 'high_risk';

export interface ScanPreflightReport {
    status: ScanPreflightStatus;
    imageWidth: number;
    imageHeight: number;
    gridConfidence?: number;
    warnings: string[];
    recommendations: string[];
    screenType: 'pause_menu' | 'gameplay';
    sharpnessScore: number;
    aspectRatio: number;
}

const PREVIEW_CONTAINER_ID = 'scan-preflight-report';
const MIN_WIDTH = 1280;
const MIN_HEIGHT = 720;
const HIGH_RISK_WIDTH = 960;
const HIGH_RISK_HEIGHT = 540;
const LOW_DETAIL_THRESHOLD = 18;
const WARN_DETAIL_THRESHOLD = 28;
const LOW_GRID_CONFIDENCE = 0.18;
const WARN_GRID_CONFIDENCE = 0.45;
const MIN_SUPPORTED_ASPECT = 1.45;
const MAX_SUPPORTED_ASPECT = 1.9;

function computeSharpnessScore(ctx: CanvasRenderingContext2D, width: number, height: number): number {
    const sampleWidth = Math.max(32, Math.min(width, 320));
    const sampleHeight = Math.max(32, Math.min(height, 180));
    const startX = Math.max(0, Math.floor((width - sampleWidth) / 2));
    const startY = Math.max(0, Math.floor((height - sampleHeight) / 2));
    const data = ctx.getImageData(startX, startY, sampleWidth, sampleHeight).data;

    let totalDelta = 0;
    let comparisons = 0;

    for (let y = 0; y < sampleHeight - 1; y += 2) {
        for (let x = 0; x < sampleWidth - 1; x += 2) {
            const index = (y * sampleWidth + x) * 4;
            const rightIndex = index + 4;
            const downIndex = index + sampleWidth * 4;
            const luminance = ((data[index] ?? 0) + (data[index + 1] ?? 0) + (data[index + 2] ?? 0)) / 3;
            const right = ((data[rightIndex] ?? 0) + (data[rightIndex + 1] ?? 0) + (data[rightIndex + 2] ?? 0)) / 3;
            const down = ((data[downIndex] ?? 0) + (data[downIndex + 1] ?? 0) + (data[downIndex + 2] ?? 0)) / 3;

            totalDelta += Math.abs(luminance - right) + Math.abs(luminance - down);
            comparisons += 2;
        }
    }

    return comparisons > 0 ? totalDelta / comparisons : 0;
}

function dedupe(values: string[]): string[] {
    return Array.from(new Set(values));
}

function getStatusCopy(status: ScanPreflightStatus): { title: string; badge: string } {
    switch (status) {
        case 'pass':
            return { title: 'Screenshot looks usable', badge: 'Ready' };
        case 'warn':
            return { title: 'Screenshot may need review', badge: 'Warning' };
        case 'high_risk':
            return { title: 'Detection is high risk on this screenshot', badge: 'High Risk' };
    }
}

export async function analyzeScanPreflight(imageDataUrl: string): Promise<ScanPreflightReport> {
    const { ctx, width, height } = await loadImageToCanvas(imageDataUrl);
    const warnings: string[] = [];
    const recommendations: string[] = [];
    const aspectRatio = width / Math.max(height, 1);
    const sharpnessScore = computeSharpnessScore(ctx, width, height);
    const screenType = detectScreenType(ctx, width, height);

    let status: ScanPreflightStatus = 'pass';
    let gridConfidence = 0;

    if (width < HIGH_RISK_WIDTH || height < HIGH_RISK_HEIGHT) {
        status = 'high_risk';
        warnings.push('Resolution is very low for reliable icon detection.');
        recommendations.push('Use a higher-resolution screenshot.');
    } else if (width < MIN_WIDTH || height < MIN_HEIGHT) {
        status = 'warn';
        warnings.push('Resolution is below the recommended scan size.');
        recommendations.push('Use a higher-resolution screenshot.');
    }

    if (aspectRatio < MIN_SUPPORTED_ASPECT || aspectRatio > MAX_SUPPORTED_ASPECT) {
        status = status === 'high_risk' ? 'high_risk' : 'warn';
        warnings.push('Aspect ratio looks unusual for a full pause-menu capture.');
        recommendations.push('Capture the full inventory area without cropping.');
    }

    if (screenType === 'gameplay') {
        status = 'high_risk';
        warnings.push('The screenshot looks like live gameplay instead of the pause menu.');
        recommendations.push('Retake from the pause menu.');
    }

    if (sharpnessScore < LOW_DETAIL_THRESHOLD) {
        status = 'high_risk';
        warnings.push('Image detail is very soft, likely from blur or heavy compression.');
        recommendations.push('Avoid motion blur and messaging-app compression.');
    } else if (sharpnessScore < WARN_DETAIL_THRESHOLD) {
        status = status === 'high_risk' ? 'high_risk' : 'warn';
        warnings.push('Image detail is low and may reduce icon matching accuracy.');
        recommendations.push('Avoid motion blur and compression if possible.');
    }

    try {
        const gridResult = await autoDetectGrid(ctx, width, height);
        gridConfidence = gridResult.success ? gridResult.confidence || 0 : 0;

        if (!gridResult.success || gridConfidence < LOW_GRID_CONFIDENCE) {
            status = 'high_risk';
            warnings.push('Inventory grid could not be confidently located.');
            recommendations.push('Capture the full inventory area.');
        } else if (gridConfidence < WARN_GRID_CONFIDENCE) {
            status = status === 'high_risk' ? 'high_risk' : 'warn';
            warnings.push('Inventory grid confidence is low.');
            recommendations.push('Capture the full inventory area with clearer borders.');
        }
    } catch (error) {
        logger.warn({
            operation: 'scan_build.preflight_grid_error',
            error: {
                name: (error as Error).name,
                message: (error as Error).message,
            },
        });
        status = status === 'pass' ? 'warn' : status;
        warnings.push('Grid preflight could not complete.');
        recommendations.push('Retake from the pause menu if detection struggles.');
    }

    const report: ScanPreflightReport = {
        status,
        imageWidth: width,
        imageHeight: height,
        gridConfidence,
        warnings: dedupe(warnings),
        recommendations: dedupe(recommendations),
        screenType,
        sharpnessScore,
        aspectRatio,
    };

    logger.info({
        operation: 'scan_build.preflight_complete',
        data: {
            status: report.status,
            imageWidth: report.imageWidth,
            imageHeight: report.imageHeight,
            gridConfidence: report.gridConfidence,
            warningsCount: report.warnings.length,
            screenType: report.screenType,
            sharpnessScore: Number(report.sharpnessScore.toFixed(2)),
        },
    });

    return report;
}

export function renderScanPreflightReport(report: ScanPreflightReport): void {
    const container = document.getElementById(PREVIEW_CONTAINER_ID);
    if (!container) return;

    const copy = getStatusCopy(report.status);
    const warnings = report.warnings.map(warning => `<li>${escapeHtml(warning)}</li>`).join('');
    const recommendations = report.recommendations
        .map(recommendation => `<li>${escapeHtml(recommendation)}</li>`)
        .join('');

    container.className = `scan-preflight-report status-${report.status.replace('_', '-')}`;
    container.innerHTML = `
        <div class="scan-preflight-header">
            <div>
                <div class="scan-preflight-title">${copy.title}</div>
            </div>
            <span class="scan-preflight-badge">${copy.badge}</span>
        </div>
        <ul class="scan-preflight-meta">
            <li>${report.imageWidth}x${report.imageHeight}</li>
            <li>${report.screenType === 'pause_menu' ? 'Pause menu detected' : 'Gameplay detected'}</li>
            <li>Grid confidence: ${Math.round((report.gridConfidence || 0) * 100)}%</li>
        </ul>
        ${
            report.warnings.length > 0
                ? `<span class="scan-preflight-label">Warnings</span><ul class="scan-preflight-list">${warnings}</ul>`
                : ''
        }
        ${
            report.recommendations.length > 0
                ? `<span class="scan-preflight-label">Recommended fixes</span><ul class="scan-preflight-list">${recommendations}</ul>`
                : ''
        }
    `;
    container.style.display = 'block';
}

export function clearScanPreflightReport(): void {
    const container = document.getElementById(PREVIEW_CONTAINER_ID);
    if (!container) return;

    container.innerHTML = '';
    container.style.display = 'none';
    container.className = 'scan-preflight-report';
}
