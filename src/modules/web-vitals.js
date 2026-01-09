// ========================================
// Web Vitals Monitoring Module
// ========================================
// Tracks Core Web Vitals: CLS, FCP, LCP, TTFB, INP
// (Note: INP replaced FID in web-vitals v4+)
// ========================================

import { onCLS, onFCP, onLCP, onTTFB, onINP } from 'web-vitals';

/**
 * Web Vitals thresholds (in milliseconds or score)
 */
const THRESHOLDS = {
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
};

/**
 * Store collected metrics
 */
const metrics = {
    CLS: null,
    FCP: null,
    LCP: null,
    TTFB: null,
    INP: null,
};

/**
 * Get rating for a metric value
 * @param {string} name - Metric name
 * @param {number} value - Metric value
 * @returns {string} Rating: 'good', 'needs-improvement', or 'poor'
 */
function _getRating(name, value) {
    const threshold = THRESHOLDS[name];
    if (!threshold) return 'unknown';

    if (value <= threshold.good) return 'good';
    if (value <= threshold.needsImprovement) return 'needs-improvement';
    return 'poor';
}

/**
 * Format metric value for display
 * @param {string} name - Metric name
 * @param {number} value - Metric value
 * @returns {string} Formatted value
 */
function formatValue(name, value) {
    if (name === 'CLS') {
        return value.toFixed(3);
    }
    return `${Math.round(value)}ms`;
}

/**
 * Log metric to console
 * @param {Object} metric - Web Vitals metric object
 */
function logMetric(metric) {
    const { name, value, rating } = metric;
    const formattedValue = formatValue(name, value);
    const emoji = rating === 'good' ? '✅' : rating === 'needs-improvement' ? '⚠️' : '❌';

    console.log(`[Web Vitals] ${emoji} ${name}: ${formattedValue} (${rating})`);

    // Store metric
    metrics[name] = {
        value,
        rating,
        formattedValue,
        delta: metric.delta,
        id: metric.id,
    };
}

/**
 * Send metric to analytics (placeholder)
 * Replace this with your actual analytics integration (Google Analytics, Plausible, etc.)
 * @param {Object} metric - Web Vitals metric object
 */
function sendToAnalytics(metric) {
    // Example: Google Analytics 4
    if (typeof gtag !== 'undefined') {
        // eslint-disable-next-line no-undef
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
 * @param {Object} metric - Web Vitals metric object
 */
function handleMetric(metric) {
    logMetric(metric);
    sendToAnalytics(metric);
}

/**
 * Initialize Web Vitals monitoring
 */
export function initWebVitals() {
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
 * @returns {Object} All metrics
 */
export function getMetrics() {
    return { ...metrics };
}

/**
 * Log summary of all metrics
 */
export function logSummary() {
    console.groupCollapsed('[Web Vitals] Performance Summary');

    const collectedMetrics = Object.entries(metrics).filter(([_, value]) => value !== null);

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
export function createPerformanceBadge() {
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

        const collectedMetrics = Object.entries(metrics).filter(([_, value]) => value !== null);
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
