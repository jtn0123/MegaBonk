import { logger } from './logger.ts';
import { downloadJson } from './dom-utils.ts';
import type { ScanPreflightReport } from './scan-build-preflight.ts';
import type { DetectionResults, TrustSummary } from './scan-build-results.ts';

const STORAGE_KEY = 'megabonk-scan-session-reports';
const MAX_STORED_REPORTS = 50;

export type ScanDetectionMethod = 'ocr' | 'hybrid' | 'enhanced_hybrid';
export type ScanSessionStatus = 'in_progress' | 'completed' | 'abandoned';

export interface ScanSessionReport {
    id: string;
    status: ScanSessionStatus;
    startedAt: string;
    completedAt?: string;
    uploadStartedAt: string;
    uploadFileName?: string;
    uploadFileSize?: number;
    uploadFileType?: string;
    imageWidth?: number;
    imageHeight?: number;
    preflightStatus?: ScanPreflightReport['status'];
    preflightWarningsCount: number;
    preflightRecommendationsCount: number;
    detectionMethod?: ScanDetectionMethod;
    totalDetections: number;
    zeroResults: boolean;
    detectionSuccess: boolean;
    safeCount: number;
    reviewCount: number;
    riskyCount: number;
    unresolvedRiskyCountAtApply: number;
    reviewedCount: number;
    manualReviewActions: number;
    explicitCorrections: number;
    uploadToApplyMs?: number;
}

let currentSession: ScanSessionReport | null = null;

function loadReports(): ScanSessionReport[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as ScanSessionReport[];
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        logger.warn({
            operation: 'scan_build.session_load_failed',
            error: {
                name: (error as Error).name,
                message: (error as Error).message,
            },
        });
        return [];
    }
}

function saveReports(reports: ScanSessionReport[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(reports.slice(-MAX_STORED_REPORTS)));
    } catch (error) {
        logger.warn({
            operation: 'scan_build.session_save_failed',
            error: {
                name: (error as Error).name,
                message: (error as Error).message,
            },
        });
    }
}

function persistCurrentSession(status: ScanSessionStatus): void {
    if (!currentSession) return;

    currentSession.status = status;
    currentSession.completedAt = new Date().toISOString();

    const reports = loadReports();
    const filtered = reports.filter(report => report.id !== currentSession!.id);
    filtered.push({ ...currentSession });
    saveReports(filtered);
}

export function startScanSession(file: { name?: string; size?: number; type?: string }): ScanSessionReport {
    if (currentSession && currentSession.status === 'in_progress') {
        persistCurrentSession('abandoned');
    }

    const timestamp = new Date().toISOString();
    currentSession = {
        id: `scan_${Date.now()}`,
        status: 'in_progress',
        startedAt: timestamp,
        uploadStartedAt: timestamp,
        uploadFileName: file.name,
        uploadFileSize: file.size,
        uploadFileType: file.type,
        preflightWarningsCount: 0,
        preflightRecommendationsCount: 0,
        totalDetections: 0,
        zeroResults: false,
        detectionSuccess: false,
        safeCount: 0,
        reviewCount: 0,
        riskyCount: 0,
        unresolvedRiskyCountAtApply: 0,
        reviewedCount: 0,
        manualReviewActions: 0,
        explicitCorrections: 0,
    };

    logger.info({
        operation: 'scan_build.session_started',
        data: {
            sessionId: currentSession.id,
            uploadFileName: currentSession.uploadFileName,
            uploadFileSize: currentSession.uploadFileSize,
            uploadFileType: currentSession.uploadFileType,
        },
    });

    return currentSession;
}

export function updateSessionImageSize(width: number, height: number): void {
    if (!currentSession) return;
    currentSession.imageWidth = width;
    currentSession.imageHeight = height;
}

export function recordPreflight(report: ScanPreflightReport): void {
    if (!currentSession) return;

    currentSession.preflightStatus = report.status;
    currentSession.preflightWarningsCount = report.warnings.length;
    currentSession.preflightRecommendationsCount = report.recommendations.length;
    currentSession.imageWidth = report.imageWidth;
    currentSession.imageHeight = report.imageHeight;
}

export function recordDetectionSummary(
    method: ScanDetectionMethod,
    results: DetectionResults,
    trust: TrustSummary
): void {
    if (!currentSession) return;

    const totalDetections =
        (results.character ? 1 : 0) + (results.weapon ? 1 : 0) + results.items.length + results.tomes.length;

    currentSession.detectionMethod = method;
    currentSession.totalDetections = totalDetections;
    currentSession.zeroResults = totalDetections === 0;
    currentSession.detectionSuccess = totalDetections > 0;
    currentSession.safeCount = trust.safeCount;
    currentSession.reviewCount = trust.reviewCount;
    currentSession.riskyCount = trust.riskyCount;
    currentSession.reviewedCount = trust.reviewedCount;
    currentSession.manualReviewActions = trust.manualReviewCount;
    currentSession.explicitCorrections = trust.explicitCorrectionCount;
}

export function incrementManualReviewAction(): void {
    if (!currentSession) return;
    currentSession.manualReviewActions += 1;
}

export function incrementExplicitCorrection(): void {
    if (!currentSession) return;
    currentSession.explicitCorrections += 1;
}

export function finalizeScanSession(trust: TrustSummary): ScanSessionReport | null {
    if (!currentSession) return null;

    currentSession.safeCount = trust.safeCount;
    currentSession.reviewCount = trust.reviewCount;
    currentSession.riskyCount = trust.riskyCount;
    currentSession.reviewedCount = trust.reviewedCount;
    currentSession.manualReviewActions = trust.manualReviewCount;
    currentSession.explicitCorrections = trust.explicitCorrectionCount;
    currentSession.unresolvedRiskyCountAtApply = trust.unresolvedRiskyCount;
    currentSession.uploadToApplyMs = Date.now() - new Date(currentSession.uploadStartedAt).getTime();

    persistCurrentSession('completed');

    logger.info({
        operation: 'scan_build.session_completed',
        data: {
            sessionId: currentSession.id,
            status: currentSession.status,
            detectionMethod: currentSession.detectionMethod,
            totalDetections: currentSession.totalDetections,
            preflightWarningsCount: currentSession.preflightWarningsCount,
            safeCount: currentSession.safeCount,
            reviewCount: currentSession.reviewCount,
            riskyCount: currentSession.riskyCount,
            unresolvedRiskyCountAtApply: currentSession.unresolvedRiskyCountAtApply,
            manualReviewActions: currentSession.manualReviewActions,
            explicitCorrections: currentSession.explicitCorrections,
            uploadToApplyMs: currentSession.uploadToApplyMs,
        },
    });

    return { ...currentSession };
}

export function abandonCurrentScanSession(): void {
    if (!currentSession) return;
    if (currentSession.status !== 'in_progress') {
        currentSession = null;
        return;
    }
    persistCurrentSession('abandoned');
    currentSession = null;
}

export function clearCurrentScanSession(): void {
    currentSession = null;
}

export function exportStoredScanReports(): void {
    const reports = loadReports();
    downloadJson(reports, `megabonk-cv-report-${Date.now()}`);

    logger.info({
        operation: 'scan_build.session_exported',
        data: {
            reportCount: reports.length,
        },
    });
}

export function getStoredScanReports(): ScanSessionReport[] {
    return loadReports();
}

export function getCurrentScanSession(): ScanSessionReport | null {
    return currentSession ? { ...currentSession } : null;
}
