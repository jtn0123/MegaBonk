/* ========================================
 * CV Validator - Algorithm Ensemble
 * Per-item optimal similarity algorithm blending
 * ======================================== */

// Storage key
const STORAGE_KEY = 'cv-algorithm-ensemble';

// Available similarity algorithms
export const ALGORITHMS = {
    NCC: 'ncc',           // Normalized Cross-Correlation
    SSIM: 'ssim',         // Structural Similarity Index
    HISTOGRAM: 'histogram', // Color histogram matching
    EDGE: 'edge',         // Edge-based similarity
};

// Default weights (sum to 1)
const DEFAULT_WEIGHTS = {
    [ALGORITHMS.NCC]: 0.35,
    [ALGORITHMS.SSIM]: 0.30,
    [ALGORITHMS.HISTOGRAM]: 0.20,
    [ALGORITHMS.EDGE]: 0.15,
};

// Ensemble data
let ensembleData = {
    // Per-item learned weights
    itemWeights: {},

    // Global learned weights (fallback)
    globalWeights: { ...DEFAULT_WEIGHTS },

    // Training data: algorithm scores for correct/incorrect matches
    trainingHistory: {},

    // Metadata
    lastOptimized: null,
    version: 1,
};

// ========================================
// Initialization
// ========================================

export function initAlgorithmEnsemble() {
    loadEnsembleData();
}

function loadEnsembleData() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            ensembleData = { ...ensembleData, ...JSON.parse(stored) };
        }
    } catch (e) {
        console.warn('Could not load ensemble data:', e);
    }
}

function saveEnsembleData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(ensembleData));
    } catch (e) {
        console.warn('Could not save ensemble data:', e);
    }
}

// ========================================
// Weight Management
// ========================================

/**
 * Get algorithm weights for an item
 * Falls back to global weights if no item-specific weights exist
 */
export function getWeightsForItem(itemId) {
    if (itemId && ensembleData.itemWeights[itemId]) {
        return { ...ensembleData.itemWeights[itemId] };
    }
    return { ...ensembleData.globalWeights };
}

/**
 * Set weights for an item
 */
export function setWeightsForItem(itemId, weights) {
    // Normalize weights to sum to 1
    const normalized = normalizeWeights(weights);
    ensembleData.itemWeights[itemId] = normalized;
    saveEnsembleData();
}

/**
 * Normalize weights to sum to 1
 */
function normalizeWeights(weights) {
    const sum = Object.values(weights).reduce((s, w) => s + w, 0);
    if (sum === 0) return { ...DEFAULT_WEIGHTS };

    const normalized = {};
    for (const [algo, weight] of Object.entries(weights)) {
        normalized[algo] = weight / sum;
    }
    return normalized;
}

// ========================================
// Combined Scoring
// ========================================

/**
 * Calculate combined similarity score using weighted algorithms
 */
export function calculateEnsembleScore(algorithmScores, itemId = null) {
    const weights = getWeightsForItem(itemId);
    let weightedSum = 0;
    let totalWeight = 0;

    for (const [algo, score] of Object.entries(algorithmScores)) {
        const weight = weights[algo] || 0;
        if (weight > 0 && typeof score === 'number' && !isNaN(score)) {
            weightedSum += score * weight;
            totalWeight += weight;
        }
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Calculate score with algorithm breakdown
 */
export function calculateDetailedScore(algorithmScores, itemId = null) {
    const weights = getWeightsForItem(itemId);
    const details = {};
    let combinedScore = 0;

    for (const [algo, score] of Object.entries(algorithmScores)) {
        const weight = weights[algo] || 0;
        const contribution = score * weight;
        details[algo] = {
            score,
            weight,
            contribution,
        };
        combinedScore += contribution;
    }

    return {
        combinedScore,
        details,
        weights,
    };
}

// ========================================
// Learning / Training
// ========================================

/**
 * Record algorithm scores for a match result
 * Used to learn optimal weights
 */
export function recordMatchResult(itemId, algorithmScores, wasCorrect) {
    if (!ensembleData.trainingHistory[itemId]) {
        ensembleData.trainingHistory[itemId] = {
            correct: [],
            incorrect: [],
        };
    }

    const history = ensembleData.trainingHistory[itemId];
    const record = { scores: algorithmScores, timestamp: Date.now() };

    if (wasCorrect) {
        history.correct.push(record);
        // Keep last 50 correct matches
        if (history.correct.length > 50) history.correct.shift();
    } else {
        history.incorrect.push(record);
        // Keep last 50 incorrect matches
        if (history.incorrect.length > 50) history.incorrect.shift();
    }

    saveEnsembleData();
}

/**
 * Optimize weights for an item based on training history
 */
export function optimizeWeightsForItem(itemId) {
    const history = ensembleData.trainingHistory[itemId];
    if (!history || history.correct.length < 5) {
        return null; // Not enough data
    }

    // Calculate which algorithms best discriminate correct from incorrect
    const algoPerformance = {};

    for (const algo of Object.values(ALGORITHMS)) {
        const correctScores = history.correct.map(r => r.scores[algo] || 0);
        const incorrectScores = history.incorrect.map(r => r.scores[algo] || 0);

        const avgCorrect = correctScores.reduce((s, v) => s + v, 0) / correctScores.length;
        const avgIncorrect = incorrectScores.length > 0
            ? incorrectScores.reduce((s, v) => s + v, 0) / incorrectScores.length
            : 0;

        // Performance = how much higher the score is for correct matches
        // Higher is better (algorithm discriminates well)
        const discrimination = avgCorrect - avgIncorrect;

        // Also consider consistency (lower variance = more reliable)
        const variance = calculateVariance(correctScores);
        const consistency = 1 / (1 + variance);

        algoPerformance[algo] = {
            avgCorrect,
            avgIncorrect,
            discrimination,
            consistency,
            score: discrimination * 0.7 + consistency * 0.3,
        };
    }

    // Convert performance to weights
    const minScore = Math.min(...Object.values(algoPerformance).map(p => p.score));
    const adjustedScores = {};

    for (const [algo, perf] of Object.entries(algoPerformance)) {
        // Shift scores to be positive and give more weight to discriminating algorithms
        adjustedScores[algo] = Math.max(0.1, perf.score - minScore + 0.1);
    }

    const optimizedWeights = normalizeWeights(adjustedScores);
    ensembleData.itemWeights[itemId] = optimizedWeights;
    ensembleData.lastOptimized = new Date().toISOString();
    saveEnsembleData();

    return {
        weights: optimizedWeights,
        performance: algoPerformance,
        sampleSize: history.correct.length + history.incorrect.length,
    };
}

/**
 * Calculate variance of an array
 */
function calculateVariance(arr) {
    if (arr.length === 0) return 0;
    const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
    const squaredDiffs = arr.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((s, v) => s + v, 0) / arr.length;
}

/**
 * Optimize weights globally based on all training data
 */
export function optimizeGlobalWeights() {
    const allPerformance = {};

    for (const algo of Object.values(ALGORITHMS)) {
        allPerformance[algo] = { totalDiscrimination: 0, count: 0 };
    }

    for (const [itemId, history] of Object.entries(ensembleData.trainingHistory)) {
        if (history.correct.length < 3) continue;

        for (const algo of Object.values(ALGORITHMS)) {
            const correctScores = history.correct.map(r => r.scores[algo] || 0);
            const incorrectScores = history.incorrect.map(r => r.scores[algo] || 0);

            const avgCorrect = correctScores.reduce((s, v) => s + v, 0) / correctScores.length;
            const avgIncorrect = incorrectScores.length > 0
                ? incorrectScores.reduce((s, v) => s + v, 0) / incorrectScores.length
                : 0;

            allPerformance[algo].totalDiscrimination += avgCorrect - avgIncorrect;
            allPerformance[algo].count++;
        }
    }

    // Calculate average discrimination per algorithm
    const avgDiscrimination = {};
    for (const [algo, perf] of Object.entries(allPerformance)) {
        avgDiscrimination[algo] = perf.count > 0 ? perf.totalDiscrimination / perf.count : 0.1;
    }

    const minDisc = Math.min(...Object.values(avgDiscrimination));
    const adjustedScores = {};
    for (const [algo, disc] of Object.entries(avgDiscrimination)) {
        adjustedScores[algo] = Math.max(0.1, disc - minDisc + 0.1);
    }

    ensembleData.globalWeights = normalizeWeights(adjustedScores);
    ensembleData.lastOptimized = new Date().toISOString();
    saveEnsembleData();

    return ensembleData.globalWeights;
}

// ========================================
// Analysis
// ========================================

/**
 * Get items with custom weights
 */
export function getItemsWithCustomWeights() {
    return Object.keys(ensembleData.itemWeights);
}

/**
 * Get algorithm recommendations for an item
 */
export function getAlgorithmRecommendations(itemId) {
    const history = ensembleData.trainingHistory[itemId];
    if (!history || history.correct.length < 5) {
        return { hasEnoughData: false };
    }

    const recommendations = [];

    for (const algo of Object.values(ALGORITHMS)) {
        const correctScores = history.correct.map(r => r.scores[algo] || 0);
        const avgCorrect = correctScores.reduce((s, v) => s + v, 0) / correctScores.length;

        if (avgCorrect < 0.5) {
            recommendations.push({
                algorithm: algo,
                type: 'weak',
                message: `${algo} has low scores for this item (avg: ${(avgCorrect * 100).toFixed(1)}%)`,
            });
        } else if (avgCorrect > 0.85) {
            recommendations.push({
                algorithm: algo,
                type: 'strong',
                message: `${algo} works well for this item (avg: ${(avgCorrect * 100).toFixed(1)}%)`,
            });
        }
    }

    return {
        hasEnoughData: true,
        recommendations,
        currentWeights: getWeightsForItem(itemId),
    };
}

/**
 * Compare algorithm performance across all items
 */
export function getGlobalAlgorithmStats() {
    const stats = {};

    for (const algo of Object.values(ALGORITHMS)) {
        stats[algo] = {
            avgScoreCorrect: 0,
            avgScoreIncorrect: 0,
            itemCount: 0,
        };
    }

    for (const history of Object.values(ensembleData.trainingHistory)) {
        if (history.correct.length < 3) continue;

        for (const algo of Object.values(ALGORITHMS)) {
            const correctScores = history.correct.map(r => r.scores[algo] || 0);
            const avgCorrect = correctScores.reduce((s, v) => s + v, 0) / correctScores.length;

            stats[algo].avgScoreCorrect += avgCorrect;
            stats[algo].itemCount++;

            if (history.incorrect.length > 0) {
                const incorrectScores = history.incorrect.map(r => r.scores[algo] || 0);
                const avgIncorrect = incorrectScores.reduce((s, v) => s + v, 0) / incorrectScores.length;
                stats[algo].avgScoreIncorrect += avgIncorrect;
            }
        }
    }

    // Finalize averages
    for (const algo of Object.values(ALGORITHMS)) {
        if (stats[algo].itemCount > 0) {
            stats[algo].avgScoreCorrect /= stats[algo].itemCount;
            stats[algo].avgScoreIncorrect /= stats[algo].itemCount;
            stats[algo].discrimination = stats[algo].avgScoreCorrect - stats[algo].avgScoreIncorrect;
        }
    }

    return stats;
}

// ========================================
// Export / Reset
// ========================================

/**
 * Export ensemble data
 */
export function exportEnsembleData() {
    return {
        ...ensembleData,
        exportedAt: new Date().toISOString(),
    };
}

/**
 * Reset ensemble data
 */
export function resetEnsembleData() {
    ensembleData = {
        itemWeights: {},
        globalWeights: { ...DEFAULT_WEIGHTS },
        trainingHistory: {},
        lastOptimized: null,
        version: 1,
    };
    saveEnsembleData();
}

/**
 * Get default weights
 */
export function getDefaultWeights() {
    return { ...DEFAULT_WEIGHTS };
}
