/* ========================================
 * CV Validator - Template Manager
 * Confidence-weighted template selection and versioning
 * ======================================== */

// Storage keys
const STORAGE_KEYS = {
    TEMPLATE_PERFORMANCE: 'cv-template-performance',
    TEMPLATE_VERSIONS: 'cv-template-versions',
};

// Configuration
const CONFIG = {
    // Source weights for quality scoring
    SOURCE_WEIGHTS: {
        ground_truth: 1.5,
        corrected: 1.3,
        corrected_from_empty: 1.2,
        verified: 1.0,
        unreviewed: 0.8,
    },

    // Performance tracking
    MIN_MATCHES_FOR_STATS: 5,
    PERFORMANCE_WINDOW: 100, // Keep last N match results

    // Template selection
    MAX_TEMPLATES_PER_ITEM: 10,
    RESOLUTION_MATCH_BONUS: 0.15,
};

// Template performance data
let performanceData = {
    templates: {}, // templateId -> { matches: number, correct: number, avgSimilarity: number }
    items: {},     // itemId -> { templates: [], lastUpdated: string }
};

// Version tracking
let versionData = {
    currentVersion: null,
    versions: [],  // { version, created, metrics, notes }
};

// ========================================
// Initialization
// ========================================

export function initTemplateManager() {
    loadPerformanceData();
    loadVersionData();
}

function loadPerformanceData() {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.TEMPLATE_PERFORMANCE);
        if (stored) {
            performanceData = JSON.parse(stored);
        }
    } catch (e) {
        console.warn('Could not load template performance data:', e);
    }
}

function savePerformanceData() {
    try {
        localStorage.setItem(STORAGE_KEYS.TEMPLATE_PERFORMANCE, JSON.stringify(performanceData));
    } catch (e) {
        console.warn('Could not save template performance data:', e);
    }
}

function loadVersionData() {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.TEMPLATE_VERSIONS);
        if (stored) {
            versionData = JSON.parse(stored);
        }
    } catch (e) {
        console.warn('Could not load version data:', e);
    }
}

function saveVersionData() {
    try {
        localStorage.setItem(STORAGE_KEYS.TEMPLATE_VERSIONS, JSON.stringify(versionData));
    } catch (e) {
        console.warn('Could not save version data:', e);
    }
}

// ========================================
// Quality Scoring
// ========================================

/**
 * Calculate quality score for a training sample
 * Used to weight templates during matching
 */
export function calculateSampleQuality(sample) {
    let score = 0.5; // Base score

    // Source weight
    const sourceWeight = CONFIG.SOURCE_WEIGHTS[sample.source] ||
                         CONFIG.SOURCE_WEIGHTS[sample.validation_type] || 0.8;
    score += (sourceWeight - 1) * 0.3;

    // Confidence bonus (higher original confidence = more reliable sample)
    if (sample.confidence) {
        score += sample.confidence * 0.1;
    }

    // Historical performance (if tracked)
    const templatePerf = performanceData.templates[sample.id];
    if (templatePerf && templatePerf.matches >= CONFIG.MIN_MATCHES_FOR_STATS) {
        const accuracy = templatePerf.correct / templatePerf.matches;
        score += (accuracy - 0.5) * 0.3;
    }

    return Math.min(1, Math.max(0, score));
}

/**
 * Calculate resolution match bonus
 * Templates from same resolution get higher weight
 */
export function calculateResolutionBonus(sampleResolution, targetResolution) {
    if (!sampleResolution || !targetResolution) return 0;

    if (sampleResolution === targetResolution) {
        return CONFIG.RESOLUTION_MATCH_BONUS;
    }

    // Parse resolutions
    const [sw, sh] = sampleResolution.split('x').map(Number);
    const [tw, th] = targetResolution.split('x').map(Number);

    if (!sw || !sh || !tw || !th) return 0;

    // Similar aspect ratio bonus
    const sampleRatio = sw / sh;
    const targetRatio = tw / th;

    if (Math.abs(sampleRatio - targetRatio) < 0.05) {
        return CONFIG.RESOLUTION_MATCH_BONUS * 0.5;
    }

    return 0;
}

// ========================================
// Template Selection
// ========================================

/**
 * Select best templates for an item based on quality and relevance
 */
export function selectBestTemplates(itemSamples, targetResolution, maxCount = 5) {
    if (!itemSamples || itemSamples.length === 0) return [];

    // Score each sample
    const scoredSamples = itemSamples.map(sample => {
        const qualityScore = calculateSampleQuality(sample);
        const resolutionBonus = calculateResolutionBonus(sample.source_resolution, targetResolution);
        const totalScore = qualityScore + resolutionBonus;

        return { sample, score: totalScore };
    });

    // Sort by score descending
    scoredSamples.sort((a, b) => b.score - a.score);

    // Select top samples, preferring diversity in sources
    const selected = [];
    const sourceCounts = {};

    for (const { sample, score } of scoredSamples) {
        if (selected.length >= maxCount) break;

        // Limit samples from same source
        const source = sample.source || 'unknown';
        if ((sourceCounts[source] || 0) >= 2) continue;

        selected.push({ ...sample, weight: score });
        sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    }

    return selected;
}

/**
 * Get weighted match score combining multiple templates
 */
export function calculateWeightedMatch(templateScores) {
    if (!templateScores || templateScores.length === 0) return 0;

    let weightedSum = 0;
    let totalWeight = 0;

    for (const { score, weight } of templateScores) {
        weightedSum += score * (weight || 1);
        totalWeight += weight || 1;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

// ========================================
// Performance Tracking
// ========================================

/**
 * Record a template match result
 */
export function recordTemplateMatch(templateId, similarity, wasCorrect) {
    if (!performanceData.templates[templateId]) {
        performanceData.templates[templateId] = {
            matches: 0,
            correct: 0,
            avgSimilarity: 0,
            recentResults: [],
        };
    }

    const perf = performanceData.templates[templateId];
    perf.matches++;
    if (wasCorrect) perf.correct++;

    // Update average similarity
    perf.avgSimilarity = ((perf.avgSimilarity * (perf.matches - 1)) + similarity) / perf.matches;

    // Track recent results (sliding window)
    perf.recentResults.push({ similarity, correct: wasCorrect, timestamp: Date.now() });
    if (perf.recentResults.length > CONFIG.PERFORMANCE_WINDOW) {
        perf.recentResults.shift();
    }

    savePerformanceData();
}

/**
 * Record item-level detection result
 */
export function recordItemDetection(itemId, templates, wasCorrect) {
    for (const template of templates) {
        recordTemplateMatch(template.id, template.similarity || 0, wasCorrect);
    }

    // Track item stats
    if (!performanceData.items[itemId]) {
        performanceData.items[itemId] = {
            detections: 0,
            correct: 0,
            lastUpdated: new Date().toISOString(),
        };
    }

    const itemPerf = performanceData.items[itemId];
    itemPerf.detections++;
    if (wasCorrect) itemPerf.correct++;
    itemPerf.lastUpdated = new Date().toISOString();

    savePerformanceData();
}

/**
 * Get template performance stats
 */
export function getTemplatePerformance(templateId) {
    const perf = performanceData.templates[templateId];
    if (!perf || perf.matches < CONFIG.MIN_MATCHES_FOR_STATS) {
        return null;
    }

    return {
        matches: perf.matches,
        accuracy: perf.correct / perf.matches,
        avgSimilarity: perf.avgSimilarity,
    };
}

/**
 * Get item performance stats
 */
export function getItemPerformance(itemId) {
    const perf = performanceData.items[itemId];
    if (!perf || perf.detections < CONFIG.MIN_MATCHES_FOR_STATS) {
        return null;
    }

    return {
        detections: perf.detections,
        accuracy: perf.correct / perf.detections,
    };
}

// ========================================
// Versioning
// ========================================

/**
 * Create a new template version snapshot
 */
export function createVersion(notes = '') {
    const version = {
        id: `v${Date.now()}`,
        created: new Date().toISOString(),
        notes,
        metrics: calculateCurrentMetrics(),
        templateCount: Object.keys(performanceData.templates).length,
    };

    versionData.versions.push(version);
    versionData.currentVersion = version.id;

    saveVersionData();
    return version;
}

/**
 * Calculate current overall metrics
 */
function calculateCurrentMetrics() {
    let totalMatches = 0;
    let totalCorrect = 0;
    let totalSimilarity = 0;
    let templateCount = 0;

    for (const perf of Object.values(performanceData.templates)) {
        if (perf.matches >= CONFIG.MIN_MATCHES_FOR_STATS) {
            totalMatches += perf.matches;
            totalCorrect += perf.correct;
            totalSimilarity += perf.avgSimilarity * perf.matches;
            templateCount++;
        }
    }

    return {
        totalMatches,
        accuracy: totalMatches > 0 ? totalCorrect / totalMatches : 0,
        avgSimilarity: totalMatches > 0 ? totalSimilarity / totalMatches : 0,
        templatesWithStats: templateCount,
    };
}

/**
 * Get version history
 */
export function getVersionHistory() {
    return [...versionData.versions].reverse();
}

/**
 * Compare two versions
 */
export function compareVersions(versionId1, versionId2) {
    const v1 = versionData.versions.find(v => v.id === versionId1);
    const v2 = versionData.versions.find(v => v.id === versionId2);

    if (!v1 || !v2) return null;

    return {
        v1,
        v2,
        delta: {
            accuracy: v2.metrics.accuracy - v1.metrics.accuracy,
            avgSimilarity: v2.metrics.avgSimilarity - v1.metrics.avgSimilarity,
            templateCount: v2.templateCount - v1.templateCount,
        },
        improved: v2.metrics.accuracy > v1.metrics.accuracy,
    };
}

// ========================================
// A/B Testing Support
// ========================================

/**
 * Track A/B test results
 */
const abTests = new Map();

export function startABTest(testName, variants) {
    abTests.set(testName, {
        name: testName,
        variants,
        started: Date.now(),
        results: variants.reduce((acc, v) => ({ ...acc, [v]: { matches: 0, correct: 0 } }), {}),
    });
}

export function recordABResult(testName, variant, wasCorrect) {
    const test = abTests.get(testName);
    if (!test || !test.results[variant]) return;

    test.results[variant].matches++;
    if (wasCorrect) test.results[variant].correct++;
}

export function getABTestResults(testName) {
    const test = abTests.get(testName);
    if (!test) return null;

    const results = {};
    for (const [variant, data] of Object.entries(test.results)) {
        results[variant] = {
            matches: data.matches,
            accuracy: data.matches > 0 ? data.correct / data.matches : 0,
        };
    }

    return {
        name: test.name,
        duration: Date.now() - test.started,
        results,
        winner: Object.entries(results)
            .filter(([_, r]) => r.matches >= 10)
            .sort((a, b) => b[1].accuracy - a[1].accuracy)[0]?.[0] || null,
    };
}

// ========================================
// Reports
// ========================================

/**
 * Get templates that are underperforming
 */
export function getUnderperformingTemplates(threshold = 0.5) {
    const underperforming = [];

    for (const [templateId, perf] of Object.entries(performanceData.templates)) {
        if (perf.matches >= CONFIG.MIN_MATCHES_FOR_STATS) {
            const accuracy = perf.correct / perf.matches;
            if (accuracy < threshold) {
                underperforming.push({
                    templateId,
                    accuracy,
                    matches: perf.matches,
                    avgSimilarity: perf.avgSimilarity,
                });
            }
        }
    }

    return underperforming.sort((a, b) => a.accuracy - b.accuracy);
}

/**
 * Get top performing templates per item
 */
export function getTopTemplates(limit = 5) {
    const top = [];

    for (const [templateId, perf] of Object.entries(performanceData.templates)) {
        if (perf.matches >= CONFIG.MIN_MATCHES_FOR_STATS) {
            const accuracy = perf.correct / perf.matches;
            if (accuracy >= 0.8) {
                top.push({
                    templateId,
                    accuracy,
                    matches: perf.matches,
                    avgSimilarity: perf.avgSimilarity,
                });
            }
        }
    }

    return top.sort((a, b) => b.accuracy - a.accuracy).slice(0, limit);
}

/**
 * Export all performance data
 */
export function exportPerformanceData() {
    return {
        performance: performanceData,
        versions: versionData,
        exportedAt: new Date().toISOString(),
    };
}

/**
 * Reset performance data (for testing)
 */
export function resetPerformanceData() {
    performanceData = {
        templates: {},
        items: {},
    };
    savePerformanceData();
}
