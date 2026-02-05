// ========================================
// CV Web Worker Module
// ========================================
// Moves computer vision processing to a Web Worker for better performance
// ========================================

import { logger } from './logger.ts';

// ========================================
// Types
// ========================================

export interface CVWorkerMessage {
    type: 'detect' | 'analyze' | 'init' | 'terminate';
    id: string;
    data?: {
        imageData?: ImageData;
        config?: CVWorkerConfig;
        templates?: CVTemplate[];
    };
}

export interface CVWorkerResponse {
    type: 'result' | 'error' | 'progress' | 'ready';
    id: string;
    data?: {
        detections?: DetectionResult[];
        progress?: number;
        message?: string;
    };
    error?: string;
}

export interface CVWorkerConfig {
    threshold: number;
    maxDetections: number;
    enableDebug: boolean;
}

export interface CVTemplate {
    id: string;
    name: string;
    imageData: ImageData;
    width: number;
    height: number;
}

export interface DetectionResult {
    id: string;
    name: string;
    confidence: number;
    x: number;
    y: number;
    width: number;
    height: number;
}

// ========================================
// Worker Code (Inlined)
// ========================================

const workerCode = `
// CV Worker - Runs in Web Worker context

let templates = [];
let config = {
    threshold: 0.7,
    maxDetections: 20,
    enableDebug: false
};

// Simple color distance calculation
function colorDistance(c1, c2) {
    const dr = c1[0] - c2[0];
    const dg = c1[1] - c2[1];
    const db = c1[2] - c2[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
}

// Extract dominant color from image region
function extractDominantColor(imageData, x, y, width, height) {
    const data = imageData.data;
    const imgWidth = imageData.width;

    let totalR = 0, totalG = 0, totalB = 0;
    let count = 0;

    for (let py = y; py < y + height && py < imageData.height; py++) {
        for (let px = x; px < x + width && px < imgWidth; px++) {
            const idx = (py * imgWidth + px) * 4;
            totalR += data[idx];
            totalG += data[idx + 1];
            totalB += data[idx + 2];
            count++;
        }
    }

    if (count === 0) return [0, 0, 0];

    return [
        Math.round(totalR / count),
        Math.round(totalG / count),
        Math.round(totalB / count)
    ];
}

// Simple template matching using color histogram comparison
function matchTemplate(sourceData, template, x, y) {
    const sourceColor = extractDominantColor(sourceData, x, y, template.width, template.height);
    const templateColor = extractDominantColor(template.imageData, 0, 0, template.width, template.height);

    const distance = colorDistance(sourceColor, templateColor);
    const maxDistance = Math.sqrt(255 * 255 * 3); // Max possible color distance

    return 1 - (distance / maxDistance);
}

// Scan image for template matches
function detectTemplates(imageData, postProgress) {
    const detections = [];
    const stepSize = 16; // Scan in 16px steps for performance

    const totalSteps = Math.ceil(imageData.width / stepSize) * Math.ceil(imageData.height / stepSize) * templates.length;
    let currentStep = 0;

    for (const template of templates) {
        for (let y = 0; y < imageData.height - template.height; y += stepSize) {
            for (let x = 0; x < imageData.width - template.width; x += stepSize) {
                const confidence = matchTemplate(imageData, template, x, y);

                if (confidence >= config.threshold) {
                    detections.push({
                        id: template.id,
                        name: template.name,
                        confidence,
                        x,
                        y,
                        width: template.width,
                        height: template.height
                    });
                }

                currentStep++;

                // Report progress every 1000 steps
                if (currentStep % 1000 === 0) {
                    postProgress(Math.round((currentStep / totalSteps) * 100));
                }
            }
        }
    }

    // Sort by confidence and limit results
    detections.sort((a, b) => b.confidence - a.confidence);
    return detections.slice(0, config.maxDetections);
}

// Non-maximum suppression to remove overlapping detections
function nonMaxSuppression(detections, overlapThreshold = 0.3) {
    if (detections.length === 0) return [];

    const result = [];
    const used = new Set();

    for (let i = 0; i < detections.length; i++) {
        if (used.has(i)) continue;

        result.push(detections[i]);

        for (let j = i + 1; j < detections.length; j++) {
            if (used.has(j)) continue;

            const overlap = calculateOverlap(detections[i], detections[j]);
            if (overlap > overlapThreshold) {
                used.add(j);
            }
        }
    }

    return result;
}

function calculateOverlap(box1, box2) {
    const x1 = Math.max(box1.x, box2.x);
    const y1 = Math.max(box1.y, box2.y);
    const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
    const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

    if (x2 < x1 || y2 < y1) return 0;

    const intersection = (x2 - x1) * (y2 - y1);
    const area1 = box1.width * box1.height;
    const area2 = box2.width * box2.height;
    const union = area1 + area2 - intersection;

    return intersection / union;
}

// Message handler
self.onmessage = function(e) {
    const { type, id, data } = e.data;

    switch (type) {
        case 'init':
            if (data?.config) config = { ...config, ...data.config };
            if (data?.templates) templates = data.templates;
            self.postMessage({ type: 'ready', id });
            break;

        case 'detect':
            if (!data?.imageData) {
                self.postMessage({ type: 'error', id, error: 'No image data provided' });
                return;
            }

            try {
                const postProgress = (progress) => {
                    self.postMessage({ type: 'progress', id, data: { progress } });
                };

                let detections = detectTemplates(data.imageData, postProgress);
                detections = nonMaxSuppression(detections);

                self.postMessage({
                    type: 'result',
                    id,
                    data: { detections }
                });
            } catch (error) {
                self.postMessage({
                    type: 'error',
                    id,
                    error: error.message || 'Detection failed'
                });
            }
            break;

        case 'terminate':
            self.close();
            break;

        default:
            self.postMessage({ type: 'error', id, error: 'Unknown message type' });
    }
};
`;

// ========================================
// Worker Manager Class
// ========================================

class CVWorkerManager {
    private worker: Worker | null = null;
    private pendingRequests: Map<
        string,
        {
            resolve: (result: DetectionResult[]) => void;
            reject: (error: Error) => void;
            onProgress?: (progress: number) => void;
        }
    > = new Map();
    private isReady = false;
    private requestIdCounter = 0;

    /**
     * Initialize the CV worker
     */
    async init(config?: Partial<CVWorkerConfig>, templates?: CVTemplate[]): Promise<void> {
        if (this.worker) {
            this.terminate();
        }

        try {
            // Create worker from blob URL
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(blob);
            this.worker = new Worker(workerUrl);

            // Clean up blob URL after worker is created
            URL.revokeObjectURL(workerUrl);

            // Set up message handler
            this.worker.onmessage = this.handleMessage.bind(this);
            this.worker.onerror = this.handleError.bind(this);

            // Initialize worker
            return new Promise((resolve, reject) => {
                const id = this.generateId();
                this.pendingRequests.set(id, {
                    resolve: () => {
                        this.isReady = true;
                        resolve();
                    },
                    reject,
                });

                this.worker?.postMessage({
                    type: 'init',
                    id,
                    data: { config, templates },
                });

                // Timeout after 5 seconds
                setTimeout(() => {
                    if (this.pendingRequests.has(id)) {
                        this.pendingRequests.delete(id);
                        reject(new Error('Worker initialization timeout'));
                    }
                }, 5000);
            });
        } catch (error) {
            logger.error({
                operation: 'cv-worker.init',
                error: { name: 'WorkerError', message: String(error), module: 'cv-worker' },
            });
            throw error;
        }
    }

    /**
     * Run detection on an image
     */
    async detect(imageData: ImageData, onProgress?: (progress: number) => void): Promise<DetectionResult[]> {
        if (!this.worker || !this.isReady) {
            throw new Error('CV Worker not initialized');
        }

        return new Promise((resolve, reject) => {
            const id = this.generateId();
            this.pendingRequests.set(id, { resolve, reject, onProgress });

            this.worker?.postMessage({
                type: 'detect',
                id,
                data: { imageData },
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error('Detection timeout'));
                }
            }, 30000);
        });
    }

    /**
     * Terminate the worker
     */
    terminate(): void {
        if (this.worker) {
            this.worker.postMessage({ type: 'terminate', id: 'terminate' });
            this.worker.terminate();
            this.worker = null;
        }
        this.isReady = false;
        this.pendingRequests.clear();
    }

    /**
     * Check if worker is ready
     */
    get ready(): boolean {
        return this.isReady;
    }

    /**
     * Handle messages from worker
     */
    private handleMessage(event: MessageEvent<CVWorkerResponse>): void {
        const { type, id, data, error } = event.data;
        const pending = this.pendingRequests.get(id);

        if (!pending) {
            // Progress messages may come after the main result
            if (type === 'progress') return;
            logger.warn({
                operation: 'cv-worker.message',
                data: { id, type, reason: 'no_pending_request' },
            });
            return;
        }

        switch (type) {
            case 'ready':
                pending.resolve([]);
                this.pendingRequests.delete(id);
                break;

            case 'result':
                pending.resolve(data?.detections || []);
                this.pendingRequests.delete(id);
                break;

            case 'progress':
                pending.onProgress?.(data?.progress || 0);
                break;

            case 'error':
                pending.reject(new Error(error || 'Unknown worker error'));
                this.pendingRequests.delete(id);
                break;
        }
    }

    /**
     * Handle worker errors
     */
    private handleError(error: ErrorEvent): void {
        logger.error({
            operation: 'cv-worker.error',
            error: { name: 'WorkerError', message: error.message, module: 'cv-worker' },
        });

        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests) {
            pending.reject(new Error(`Worker error: ${error.message}`));
            this.pendingRequests.delete(id);
        }
    }

    /**
     * Generate unique request ID
     */
    private generateId(): string {
        return `cv-${++this.requestIdCounter}-${Date.now()}`;
    }
}

// ========================================
// Singleton Export
// ========================================

export const cvWorker = new CVWorkerManager();

// ========================================
// Helper Functions
// ========================================

/**
 * Check if Web Workers are supported
 */
export function isWorkerSupported(): boolean {
    return typeof Worker !== 'undefined';
}

/**
 * Run CV detection using worker if available, fallback to main thread
 */
export async function runCVDetection(
    imageData: ImageData,
    config?: Partial<CVWorkerConfig>,
    templates?: CVTemplate[],
    onProgress?: (progress: number) => void
): Promise<DetectionResult[]> {
    if (!isWorkerSupported()) {
        logger.warn({
            operation: 'cv-worker.detect',
            data: { reason: 'workers_not_supported', fallback: 'main_thread' },
        });
        // Fallback would go here - for now just return empty
        return [];
    }

    try {
        // Initialize worker if needed
        if (!cvWorker.ready) {
            await cvWorker.init(config, templates);
        }

        return await cvWorker.detect(imageData, onProgress);
    } catch (error) {
        logger.error({
            operation: 'cv-worker.detect',
            error: { name: 'DetectionError', message: String(error), module: 'cv-worker' },
        });
        throw error;
    }
}
