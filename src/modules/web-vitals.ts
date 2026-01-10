// ========================================
// Web Vitals Monitoring Module
// ========================================
// Tracks Core Web Vitals: CLS, FCP, LCP, TTFB, INP
// (Note: INP replaced FID in web-vitals v4+)
// ========================================

import { onCLS, onFCP, onLCP, onTTFB, onINP, type Metric as WebVitalsMetric } from 'web-vitals';
import type { MetricName, MetricRating, StoredMetric } from '../types/index.ts';

// ========================================
// Type Definitions
// ========================================

/**
 * Threshold configuration for a metric
 */
interface MetricThreshold {
    good: number;
    needsImprovement: number;
}

/**
 * All metric thresholds
 */
interface Thresholds {
    LCP: MetricThreshold;
    CLS: MetricThreshold;
    FCP: MetricThreshold;
    TTFB: MetricThreshold;
    INP: MetricThreshold;
}

/**
 * Stored metrics collection
 */
interface MetricsCollection {
    CLS: StoredMetric | null;
    FCP: StoredMetric | null;
    LCP: StoredMetric | null;
    TTFB: StoredMetric | null;
    INP: StoredMetric | null;
}

/**
 * Global gtag function declaration
 */
declare global {
    const gtag: ((command: string, eventName: string, params: Record<string, unknown>) => void) | undefined;
}

// ========================================
// Constants
// ========================================

/**
 * Web Vitals thresholds (in milliseconds or score)
 */
const THRESHOLDS: Readonly<Thresholds> = Object.freeze({
    // Largest Contentful Paint
    LCP: {
        good: 2500,
        needsImprovement: 4000,
    },
    // Cumulative Layout Shift (score, not ms)
    CLS: {
        good: 0.1,
        needsImprovement: 0.25,
    },
    // First Contentful Paint
    FCP: {
        good: 1800,
        needsImprovement: 3000,
    },
    // Time to First Byte
    TTFB: {
        good: 800,
        needsImprovement: 1800,
    },
    // Interaction to Next Paint (replaces FID)
    INP: {
        good: 200,
        needsImprovement: 500,
    },
});

/**
 * Store collected metrics
 */
const metrics: MetricsCollection = {
    CLS: null,
    FCP: null,
    LCP: null,
    TTFB: null,
    INP: null,
};

// ========================================
// Helper Functions
// ========================================

/**
 * Get rating for a metric value (utility function for custom use)
 * @param name - Metric name
 * @param value - Metric value
 * @returns Rating: 'good', 'needs-improvement', 'poor', or 'unknown'
 */
export function getRating(name: MetricName, value: number): MetricRating {
    const threshold = THRESHOLDS[name];
    if (!threshold) return 'unknown';

    if (value <= threshold.good) return 'good';
    if (value <= threshold.needsImprovement) return 'needs-improvement';
    return 'poor';
}

/**
 * Format metric value for display
 * @param name - Metric name
 * @param value - Metric value
 * @returns Formatted value
 */
function formatValue(name: MetricName, value: number): string {
    if (name === 'CLS') {
        return value.toFixed(3);
    }
    return `${Math.round(value)}ms`;
}

/**
 * Log metric to console
 * @param metric - Web Vitals metric object
 */
function logMetric(metric: WebVitalsMetric): void {
    const { name, value, rating, delta, id } = metric;
    const formattedValue = formatValue(name as MetricName, value);
    const emoji = rating === 'good' ? '✅' : rating === 'needs-improvement' ? '⚠️' : '❌';

    console.log(`[Web Vitals] ${emoji} ${name}: ${formattedValue} (${rating})`);

    // Store metric
    metrics[name as MetricName] = {
        value,
        rating: rating as MetricRating,
        formattedValue,
        delta,
        id,
    };
}

/**
 * Send metric to analytics (placeholder)
 * Replace this with your actual analytics integration (Google Analytics, Plausible, etc.)
 * @param metric - Web Vitals metric object
 */
function sendToAnalytics(metric: WebVitalsMetric): void {
    // Example: Google Analytics 4
    if (typeof gtag !== 'undefined') {
        gtag('event', metric.name, {
            value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
            metric_id: metric.id,
            metric_value: metric.value,
            metric_delta: metric.delta,
            metric_rating: metric.rating,
        });
    }

    // Example: Custom analytics endpoint
    // fetch('/api/analytics/web-vitals', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({
    //         name: metric.name,
    //         value: metric.value,
    //         rating: metric.rating,
    //         delta: metric.delta,
    //         id: metric.id,
    //         url: window.location.href,
    //         userAgent: navigator.userAgent
    //     })
    // }).catch(err => console.error('Failed to send analytics:', err));
}

/**
 * Handle metric callback
 * @param metric - Web Vitals metric object
 */
function handleMetric(metric: WebVitalsMetric): void {
    logMetric(metric);
    sendToAnalytics(metric);
}

// ========================================
// Exported Functions
// ========================================

/**
 * Initialize Web Vitals monitoring
 */
export function initWebVitals(): void {
    try {
        // Track Core Web Vitals
        onCLS(handleMetric);
        onFCP(handleMetric);
        onLCP(handleMetric);
        onTTFB(handleMetric);
        onINP(handleMetric); // Replaces deprecated FID metric

        console.log('[Web Vitals] Monitoring initialized');

        // Log summary after page load
        window.addEventListener('load', () => {
            setTimeout(() => {
                logSummary();
            }, 3000); // Wait 3s for metrics to be collected
        });
    } catch (error) {
        console.error('[Web Vitals] Failed to initialize:', error);
    }
}

/**
 * Get all collected metrics
 * @returns All metrics
 */
export function getMetrics(): MetricsCollection {
    return { ...metrics };
}

/**
 * Log summary of all metrics
 */
export function logSummary(): void {
    console.groupCollapsed('[Web Vitals] Performance Summary');

    const collectedMetrics = Object.entries(metrics).filter(([_, value]) => value !== null) as Array<
        [MetricName, StoredMetric]
    >;

    if (collectedMetrics.length === 0) {
        console.log('No metrics collected yet');
        console.groupEnd();
        return;
    }

    collectedMetrics.forEach(([name, data]) => {
        const emoji = data.rating === 'good' ? '✅' : data.rating === 'needs-improvement' ? '⚠️' : '❌';
        console.log(`${emoji} ${name}: ${data.formattedValue} (${data.rating})`);
    });

    // Overall score
    const goodCount = collectedMetrics.filter(([_, data]) => data.rating === 'good').length;
    const total = collectedMetrics.length;
    const score = Math.round((goodCount / total) * 100);

    console.log(`\nOverall Score: ${score}% (${goodCount}/${total} metrics good)`);
    console.groupEnd();
}

/**
 * Create performance badge UI element
 * Shows a small badge with the overall performance score
 */
export function createPerformanceBadge(): void {
    // Wait for metrics to be collected
    setTimeout(() => {
        const badge = document.createElement('div');
        badge.id = 'perf-badge';
        badge.className = 'perf-badge';
        badge.style.cssText = `
            position: fixed;
            bottom: 1rem;
            left: 1rem;
            padding: 0.5rem 1rem;
            background: var(--bg-elevated);
            border: 1px solid var(--bg-subtle);
            border-radius: 0.5rem;
            font-size: 0.75rem;
            color: var(--text-secondary);
            cursor: pointer;
            z-index: 998;
            transition: all 0.3s;
            opacity: 0.7;
        `;

        const collectedMetrics = Object.entries(metrics).filter(([_, value]) => value !== null) as Array<
            [MetricName, StoredMetric]
        >;
        const goodCount = collectedMetrics.filter(([_, data]) => data.rating === 'good').length;
        const total = collectedMetrics.length;
        const score = total > 0 ? Math.round((goodCount / total) * 100) : 0;

        const emoji = score >= 80 ? '🚀' : score >= 60 ? '⚡' : '🐌';
        badge.textContent = `${emoji} Perf: ${score}%`;
        badge.title = 'Click to view Web Vitals details';

        badge.addEventListener('click', () => {
            logSummary();
        });

        badge.addEventListener('mouseenter', () => {
            badge.style.opacity = '1';
        });

        badge.addEventListener('mouseleave', () => {
            badge.style.opacity = '0.7';
        });

        // Only show in development mode
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            document.body.appendChild(badge);
        }
    }, 3000);
}

// Export thresholds for reference
export { THRESHOLDS };
