/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('../../src/modules/computer-vision.ts', () => ({
    loadImageToCanvas: vi.fn(),
    detectScreenType: vi.fn(),
    autoDetectGrid: vi.fn(),
}));

import { autoDetectGrid, detectScreenType, loadImageToCanvas } from '../../src/modules/computer-vision.ts';
import {
    analyzeScanPreflight,
    clearScanPreflightReport,
    renderScanPreflightReport,
} from '../../src/modules/scan-build-preflight.ts';

describe('scan-build-preflight', () => {
    const ctx = {
        getImageData: vi.fn(() => {
            const data = new Uint8ClampedArray(320 * 180 * 4);
            for (let i = 0; i < data.length; i += 4) {
                const value = (i / 4) % 2 === 0 ? 30 : 220;
                data[i] = value;
                data[i + 1] = value;
                data[i + 2] = value;
                data[i + 3] = 255;
            }
            return { data };
        }),
    } as unknown as CanvasRenderingContext2D;

    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '<div id="scan-preflight-report"></div>';
        vi.mocked(loadImageToCanvas).mockResolvedValue({
            canvas: document.createElement('canvas'),
            ctx,
            width: 1920,
            height: 1080,
        });
        vi.mocked(detectScreenType).mockReturnValue('pause_menu');
        vi.mocked(autoDetectGrid).mockResolvedValue({
            success: true,
            confidence: 0.8,
        } as any);
    });

    it('should return pass for a strong pause-menu screenshot', async () => {
        const report = await analyzeScanPreflight('data:image/png;base64,test');
        expect(report.status).toBe('pass');
        expect(report.warnings).toEqual([]);
    });

    it('should flag high risk for gameplay screenshots with weak grid confidence', async () => {
        vi.mocked(loadImageToCanvas).mockResolvedValue({
            canvas: document.createElement('canvas'),
            ctx,
            width: 900,
            height: 500,
        });
        vi.mocked(detectScreenType).mockReturnValue('gameplay');
        vi.mocked(autoDetectGrid).mockResolvedValue({
            success: true,
            confidence: 0.1,
        } as any);

        const report = await analyzeScanPreflight('data:image/png;base64,test');
        expect(report.status).toBe('high_risk');
        expect(report.warnings.join(' ')).toContain('gameplay');
        expect(report.recommendations).toContain('Retake from the pause menu.');
    });

    it('should render and clear the preflight report container', () => {
        renderScanPreflightReport({
            status: 'warn',
            imageWidth: 1280,
            imageHeight: 720,
            gridConfidence: 0.42,
            warnings: ['Grid confidence is low.'],
            recommendations: ['Capture the full inventory area.'],
            screenType: 'pause_menu',
            sharpnessScore: 22,
            aspectRatio: 16 / 9,
        });

        const container = document.getElementById('scan-preflight-report')!;
        expect(container.innerHTML).toContain('Screenshot may need review');
        expect(container.innerHTML).toContain('Grid confidence is low.');

        clearScanPreflightReport();
        expect(container.innerHTML).toBe('');
        expect(container.style.display).toBe('none');
    });
});
