// ========================================
// CV Detection Metrics Summary
// ========================================
// Displays aggregate detection stats and quality grades

import { logger } from '../logger.ts';
import {
    getAccuracySummary,
    getGradeForF1,
    getQualityDescription,
    formatPercent,
    isHistoryLoaded,
    loadBenchmarkHistory,
} from './accuracy-tracker.ts';

// ========================================
// Types
// ========================================

/**
 * Detection result for metrics calculation
 */
export interface DetectionForMetrics {
    itemId: string;
    itemName: string;
    confidence: number;
    rarity?: string;
}

/**
 * Metrics summary for a detection session
 */
export interface MetricsSummary {
    totalItems: number;
    uniqueItems: number;
    avgConfidence: number;
    minConfidence: number;
    maxConfidence: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    qualityDescription: string;
    byRarity: Record<string, number>;
    confidenceDistribution: {
        high: number; // >= 80%
        medium: number; // 50-80%
        low: number; // < 50%
    };
    weakDetections: DetectionForMetrics[];
}

/**
 * System-wide accuracy info from benchmark history
 */
export interface SystemAccuracy {
    overallF1: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    trend: 'improving' | 'stable' | 'declining' | 'unknown';
    runCount: number;
    weakItems: Array<{ itemId: string; itemName: string; f1: number }>;
}

// ========================================
// Metrics Calculation
// ========================================

/**
 * Calculate metrics summary from detection results
 */
export function calculateMetricsSummary(detections: DetectionForMetrics[]): MetricsSummary {
    if (detections.length === 0) {
        return {
            totalItems: 0,
            uniqueItems: 0,
            avgConfidence: 0,
            minConfidence: 0,
            maxConfidence: 0,
            grade: 'F',
            qualityDescription: 'No items detected',
            byRarity: {},
            confidenceDistribution: { high: 0, medium: 0, low: 0 },
            weakDetections: [],
        };
    }

    // Calculate basic stats
    const uniqueIds = new Set(detections.map(d => d.itemId));
    const confidences = detections.map(d => d.confidence);
    const avgConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
    const minConfidence = Math.min(...confidences);
    const maxConfidence = Math.max(...confidences);

    // Count by rarity
    const byRarity: Record<string, number> = {};
    detections.forEach(d => {
        const rarity = d.rarity || 'unknown';
        byRarity[rarity] = (byRarity[rarity] || 0) + 1;
    });

    // Confidence distribution
    const confidenceDistribution = {
        high: detections.filter(d => d.confidence >= 0.8).length,
        medium: detections.filter(d => d.confidence >= 0.5 && d.confidence < 0.8).length,
        low: detections.filter(d => d.confidence < 0.5).length,
    };

    // Find weak detections (below 50% confidence)
    const weakDetections = detections.filter(d => d.confidence < 0.5).sort((a, b) => a.confidence - b.confidence);

    // Calculate grade based on average confidence
    const grade = getGradeForF1(avgConfidence);
    const qualityDescription = getQualityDescription(avgConfidence);

    return {
        totalItems: detections.length,
        uniqueItems: uniqueIds.size,
        avgConfidence,
        minConfidence,
        maxConfidence,
        grade,
        qualityDescription,
        byRarity,
        confidenceDistribution,
        weakDetections,
    };
}

/**
 * Get system-wide accuracy from benchmark history
 */
export async function getSystemAccuracy(): Promise<SystemAccuracy | null> {
    // Load history if not already loaded
    if (!isHistoryLoaded()) {
        await loadBenchmarkHistory();
    }

    const summary = getAccuracySummary();
    if (!summary) {
        return null;
    }

    return {
        overallF1: summary.overallF1,
        grade: summary.grade,
        trend: summary.trend,
        runCount: summary.runCount,
        weakItems: summary.weakItems,
    };
}

// ========================================
// UI Rendering
// ========================================

/**
 * Render metrics summary as HTML
 */
export function renderMetricsSummary(metrics: MetricsSummary): string {
    const gradeClass = `grade-${metrics.grade.toLowerCase()}`;

    return `
        <div class="metrics-summary">
            <div class="metrics-header">
                <div class="metrics-grade ${gradeClass}">
                    <span class="grade-letter">${metrics.grade}</span>
                    <span class="grade-label">${metrics.qualityDescription}</span>
                </div>
                <div class="metrics-confidence">
                    <span class="confidence-value">${formatPercent(metrics.avgConfidence)}</span>
                    <span class="confidence-label">Avg Confidence</span>
                </div>
            </div>

            <div class="metrics-stats">
                <div class="metric-stat">
                    <span class="stat-value">${metrics.totalItems}</span>
                    <span class="stat-label">Total Items</span>
                </div>
                <div class="metric-stat">
                    <span class="stat-value">${metrics.uniqueItems}</span>
                    <span class="stat-label">Unique Items</span>
                </div>
                <div class="metric-stat">
                    <span class="stat-value">${formatPercent(metrics.minConfidence)}</span>
                    <span class="stat-label">Min Conf.</span>
                </div>
                <div class="metric-stat">
                    <span class="stat-value">${formatPercent(metrics.maxConfidence)}</span>
                    <span class="stat-label">Max Conf.</span>
                </div>
            </div>

            <div class="metrics-distribution">
                <div class="distribution-bar">
                    <div class="dist-segment dist-high" style="width: ${getDistPercent(metrics, 'high')}%" title="High confidence (${metrics.confidenceDistribution.high})"></div>
                    <div class="dist-segment dist-medium" style="width: ${getDistPercent(metrics, 'medium')}%" title="Medium confidence (${metrics.confidenceDistribution.medium})"></div>
                    <div class="dist-segment dist-low" style="width: ${getDistPercent(metrics, 'low')}%" title="Low confidence (${metrics.confidenceDistribution.low})"></div>
                </div>
                <div class="distribution-legend">
                    <span class="legend-item"><span class="legend-dot high"></span> High (${metrics.confidenceDistribution.high})</span>
                    <span class="legend-item"><span class="legend-dot medium"></span> Medium (${metrics.confidenceDistribution.medium})</span>
                    <span class="legend-item"><span class="legend-dot low"></span> Low (${metrics.confidenceDistribution.low})</span>
                </div>
            </div>

            ${
                metrics.weakDetections.length > 0
                    ? `
                <div class="metrics-weak">
                    <h4>Low Confidence Detections</h4>
                    <ul>
                        ${metrics.weakDetections
                            .slice(0, 5)
                            .map(
                                d => `
                            <li>
                                <span class="weak-item-name">${escapeHtml(d.itemName)}</span>
                                <span class="weak-item-conf">${formatPercent(d.confidence)}</span>
                            </li>
                        `
                            )
                            .join('')}
                    </ul>
                    ${metrics.weakDetections.length > 5 ? `<p class="weak-more">+${metrics.weakDetections.length - 5} more</p>` : ''}
                </div>
            `
                    : ''
            }

            ${Object.keys(metrics.byRarity).length > 0 ? renderRarityBreakdown(metrics.byRarity) : ''}
        </div>
    `;
}

/**
 * Render rarity breakdown
 */
function renderRarityBreakdown(byRarity: Record<string, number>): string {
    const entries = Object.entries(byRarity).sort((a, b) => b[1] - a[1]);

    return `
        <div class="metrics-rarity">
            <h4>By Rarity</h4>
            <div class="rarity-bars">
                ${entries
                    .map(
                        ([rarity, count]) => `
                    <div class="rarity-bar rarity-${rarity}">
                        <span class="rarity-name">${capitalize(rarity)}</span>
                        <span class="rarity-count">${count}</span>
                    </div>
                `
                    )
                    .join('')}
            </div>
        </div>
    `;
}

/**
 * Render system accuracy badge
 */
export function renderSystemAccuracyBadge(accuracy: SystemAccuracy): string {
    const gradeClass = `grade-${accuracy.grade.toLowerCase()}`;
    const trendIcon = accuracy.trend === 'improving' ? '↑' : accuracy.trend === 'declining' ? '↓' : '→';
    const trendClass = accuracy.trend;

    return `
        <div class="system-accuracy-badge">
            <div class="accuracy-grade ${gradeClass}">${accuracy.grade}</div>
            <div class="accuracy-details">
                <span class="accuracy-f1">${formatPercent(accuracy.overallF1)} F1</span>
                <span class="accuracy-trend ${trendClass}">${trendIcon} ${capitalize(accuracy.trend)}</span>
            </div>
        </div>
    `;
}

/**
 * Render compact metrics indicator
 */
export function renderCompactMetrics(metrics: MetricsSummary): string {
    const gradeClass = `grade-${metrics.grade.toLowerCase()}`;

    return `
        <div class="metrics-compact">
            <span class="compact-grade ${gradeClass}">${metrics.grade}</span>
            <span class="compact-conf">${formatPercent(metrics.avgConfidence)}</span>
            <span class="compact-items">${metrics.totalItems} items</span>
        </div>
    `;
}

// ========================================
// Helpers
// ========================================

function getDistPercent(metrics: MetricsSummary, level: 'high' | 'medium' | 'low'): number {
    if (metrics.totalItems === 0) return 0;
    return Math.round((metrics.confidenceDistribution[level] / metrics.totalItems) * 100);
}

function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ========================================
// Logging
// ========================================

/**
 * Log metrics summary
 */
export function logMetricsSummary(metrics: MetricsSummary): void {
    logger.info({
        operation: 'metrics_summary',
        data: {
            totalItems: metrics.totalItems,
            uniqueItems: metrics.uniqueItems,
            avgConfidence: Math.round(metrics.avgConfidence * 100),
            grade: metrics.grade,
            highConf: metrics.confidenceDistribution.high,
            medConf: metrics.confidenceDistribution.medium,
            lowConf: metrics.confidenceDistribution.low,
        },
    });
}
