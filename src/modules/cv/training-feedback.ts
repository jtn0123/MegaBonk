// ========================================
// CV Training Feedback Export
// ========================================
// Allows users to report wrong detections and contribute training data
// Exports feedback in format compatible with training data pipeline

import type { Item } from '../../types/index.ts';
import { logger } from '../logger.ts';

// ========================================
// Types
// ========================================

/**
 * A detection result that can be corrected
 */
export interface DetectionForFeedback {
    detectedItemId: string;
    detectedItemName: string;
    confidence: number;
    x: number;
    y: number;
    width: number;
    height: number;
    cropDataUrl?: string; // Base64 crop of detected region
}

/**
 * A single feedback correction
 */
export interface FeedbackCorrection {
    id: string;
    timestamp: string;
    detection: DetectionForFeedback;
    correctItemId: string;
    correctItemName: string;
    resolution: { width: number; height: number };
    userNotes?: string;
}

/**
 * Exportable feedback format (compatible with import-training-data.js)
 */
export interface FeedbackExport {
    version: string;
    exportedAt: string;
    exportedBy: string;
    corrections: Array<{
        itemId: string;
        itemName: string;
        cropData: string; // Base64
        source: 'user_correction';
        originalDetection: {
            itemId: string;
            confidence: number;
        };
        resolution: string;
        timestamp: string;
    }>;
    stats: {
        totalCorrections: number;
        uniqueItems: number;
        avgOriginalConfidence: number;
    };
}

/**
 * Feedback session state
 */
export interface FeedbackSession {
    corrections: FeedbackCorrection[];
    startedAt: string;
    imageDataUrl?: string;
    imageResolution?: { width: number; height: number };
}

// ========================================
// State
// ========================================

let currentSession: FeedbackSession | null = null;
const SESSION_STORAGE_KEY = 'cv-feedback-session';

// ========================================
// Session Management
// ========================================

/**
 * Start a new feedback session for an image
 */
export function startFeedbackSession(imageDataUrl: string, imageWidth: number, imageHeight: number): FeedbackSession {
    currentSession = {
        corrections: [],
        startedAt: new Date().toISOString(),
        imageDataUrl,
        imageResolution: { width: imageWidth, height: imageHeight },
    };

    // Save to session storage for persistence
    try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(currentSession));
    } catch (e) {
        logger.warn({
            operation: 'feedback.session_save_failed',
            error: { name: (e as Error).name, message: (e as Error).message },
        });
    }

    logger.info({
        operation: 'feedback.session_started',
        data: { resolution: `${imageWidth}x${imageHeight}` },
    });

    return currentSession;
}

/**
 * Get current feedback session
 */
export function getCurrentSession(): FeedbackSession | null {
    if (currentSession) return currentSession;

    // Try to restore from session storage
    try {
        const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (stored) {
            currentSession = JSON.parse(stored);
            return currentSession;
        }
    } catch (e) {
        logger.warn({
            operation: 'feedback.session_restore_failed',
            error: { name: (e as Error).name, message: (e as Error).message },
        });
    }

    return null;
}

/**
 * Clear current feedback session
 */
export function clearFeedbackSession(): void {
    currentSession = null;
    try {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {
        logger.debug({ operation: 'feedback.storage_error', data: { error: e } });
    }

    logger.info({
        operation: 'feedback.session_cleared',
    });
}

// ========================================
// Feedback Collection
// ========================================

/**
 * Extract crop from image at specified coordinates
 */
export async function extractCropFromImage(
    imageDataUrl: string,
    x: number,
    y: number,
    width: number,
    height: number,
    padding: number = 2
): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            // Apply padding
            const cropX = Math.max(0, x - padding);
            const cropY = Math.max(0, y - padding);
            const cropWidth = Math.min(width + padding * 2, img.width - cropX);
            const cropHeight = Math.min(height + padding * 2, img.height - cropY);

            // Create canvas for crop
            const canvas = document.createElement('canvas');
            canvas.width = cropWidth;
            canvas.height = cropHeight;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

            // Export as PNG base64
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = event => {
            const errorMsg = event instanceof ErrorEvent ? event.message : 'Unknown error';
            logger.warn({
                operation: 'feedback.extract_crop_failed',
                data: { x, y, width, height, error: errorMsg, imageUrlLength: imageDataUrl.length },
            });
            reject(new Error(`Failed to load image for crop extraction: ${errorMsg}`));
        };
        img.src = imageDataUrl;
    });
}

/**
 * Add a correction to the current session
 */
export async function addCorrection(
    detection: DetectionForFeedback,
    correctItem: Item,
    userNotes?: string
): Promise<FeedbackCorrection | null> {
    const session = getCurrentSession();
    if (!session) {
        logger.warn({
            operation: 'feedback.add_correction_no_session',
        });
        return null;
    }

    // Extract crop if not already provided
    let cropDataUrl = detection.cropDataUrl;
    if (!cropDataUrl && session.imageDataUrl) {
        try {
            cropDataUrl = await extractCropFromImage(
                session.imageDataUrl,
                detection.x,
                detection.y,
                detection.width,
                detection.height
            );
        } catch (e) {
            logger.warn({
                operation: 'feedback.crop_extraction_failed',
                error: { name: (e as Error).name, message: (e as Error).message },
            });
        }
    }

    const correction: FeedbackCorrection = {
        id: `correction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        detection: {
            ...detection,
            cropDataUrl,
        },
        correctItemId: correctItem.id,
        correctItemName: correctItem.name,
        resolution: session.imageResolution || { width: 0, height: 0 },
        userNotes,
    };

    session.corrections.push(correction);

    // Save updated session
    try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch (e) {
        logger.debug({ operation: 'feedback.storage_error', data: { error: e } });
    }

    logger.info({
        operation: 'feedback.correction_added',
        data: {
            detectedItem: detection.detectedItemName,
            correctItem: correctItem.name,
            confidence: detection.confidence,
        },
    });

    return correction;
}

/**
 * Remove a correction from the session
 */
export function removeCorrection(correctionId: string): boolean {
    const session = getCurrentSession();
    if (!session) return false;

    const index = session.corrections.findIndex(c => c.id === correctionId);
    if (index === -1) return false;

    session.corrections.splice(index, 1);

    // Save updated session
    try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch (e) {
        logger.debug({ operation: 'feedback.storage_error', data: { error: e } });
    }

    return true;
}

// ========================================
// Export
// ========================================

/**
 * Export feedback as JSON file
 */
export function exportFeedback(): FeedbackExport | null {
    const session = getCurrentSession();
    if (!session || session.corrections.length === 0) {
        logger.warn({
            operation: 'feedback.export_no_corrections',
        });
        return null;
    }

    // Calculate stats
    const uniqueItems = new Set(session.corrections.map(c => c.correctItemId));
    const avgConfidence =
        session.corrections.reduce((sum, c) => sum + c.detection.confidence, 0) / session.corrections.length;

    const feedbackExport: FeedbackExport = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        exportedBy: 'megabonk-user',
        corrections: session.corrections.map(c => ({
            itemId: c.correctItemId,
            itemName: c.correctItemName,
            cropData: c.detection.cropDataUrl || '',
            source: 'user_correction' as const,
            originalDetection: {
                itemId: c.detection.detectedItemId,
                confidence: c.detection.confidence,
            },
            resolution: `${c.resolution.width}x${c.resolution.height}`,
            timestamp: c.timestamp,
        })),
        stats: {
            totalCorrections: session.corrections.length,
            uniqueItems: uniqueItems.size,
            avgOriginalConfidence: avgConfidence,
        },
    };

    logger.info({
        operation: 'feedback.exported',
        data: feedbackExport.stats,
    });

    return feedbackExport;
}

/**
 * Download feedback as JSON file
 */
export function downloadFeedback(): boolean {
    const feedbackExport = exportFeedback();
    if (!feedbackExport) return false;

    const jsonString = JSON.stringify(feedbackExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `megabonk-feedback-${timestamp}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    logger.info({
        operation: 'feedback.downloaded',
        data: { filename },
    });

    return true;
}

// ========================================
// Getters
// ========================================

/**
 * Get correction count in current session
 */
export function getCorrectionCount(): number {
    return getCurrentSession()?.corrections.length || 0;
}

/**
 * Get all corrections in current session
 */
export function getCorrections(): FeedbackCorrection[] {
    return getCurrentSession()?.corrections || [];
}

/**
 * Check if a detection has been corrected
 */
export function isDetectionCorrected(detectedItemId: string, x: number, y: number): boolean {
    const session = getCurrentSession();
    if (!session) return false;

    return session.corrections.some(
        c =>
            c.detection.detectedItemId === detectedItemId &&
            Math.abs(c.detection.x - x) < 5 &&
            Math.abs(c.detection.y - y) < 5
    );
}

// ========================================
// Reset for testing
// ========================================

export function __resetForTesting(): void {
    currentSession = null;
    try {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {
        logger.debug({ operation: 'feedback.storage_error', data: { error: e } });
    }
}
