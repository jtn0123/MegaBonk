// ========================================
// Detection Pipeline - Local Types
// ========================================

import type { ROI } from '../types.ts';

/** Result from template matching worker */
export interface WorkerMatchResult {
    itemId: string;
    similarity: number;
    position: ROI;
}

/** Options for two-phase detection */
export interface TwoPhaseOptions {
    minConfidence?: number;
    progressCallback?: (progress: number, status: string) => void;
}

/** Options for sliding window detection */
export interface SlidingWindowOptions {
    stepSize?: number;
    minConfidence?: number;
    regionOfInterest?: ROI;
    progressCallback?: (progress: number, status: string) => void;
    multiScale?: boolean;
}

/** Result from two-phase detection */
export interface TwoPhaseResult {
    detections: import('../types.ts').CVDetectionResult[];
    gridUsed: boolean;
    grid: import('../detection-grid.ts').GridParameters | null;
}

/** Progress callback type */
export type ProgressCallback = (progress: number, status: string) => void;
