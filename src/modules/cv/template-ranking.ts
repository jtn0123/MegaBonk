// ========================================
// Template Ranking Module
// ========================================
// Tracks template performance and ranks them based on historical accuracy
// Used to prioritize templates that consistently match well

/**
 * Performance metrics for a single template
 */
export interface TemplatePerformance {
    templateId: string;
    itemId: string;
    /** Number of times this template was used */
    usageCount: number;
    /** Number of successful matches (verified correct) */
    successCount: number;
    /** Number of failed matches (false positives or misses) */
    failureCount: number;
    /** Average confidence when matched */
    avgConfidence: number;
    /** Items this template is often confused with */
    confusionItems: Map<string, number>;
    /** Optimal confidence threshold for this template */
    optimalThreshold: number;
    /** Last updated timestamp */
    lastUpdated: number;
}

/**
 * Ranking entry for quick lookup
 */
export interface TemplateRanking {
    templateId: string;
    itemId: string;
    /** Computed rank score (higher = better) */
    rankScore: number;
    /** Success rate (0-1) */
    successRate: number;
    /** Whether this template should be skipped */
    shouldSkip: boolean;
    /** Recommended confidence threshold */
    threshold: number;
}

/**
 * Skip list entry
 */
export interface SkipListEntry {
    templateId: string;
    itemId: string;
    reason: 'low_success_rate' | 'high_confusion' | 'manual';
    successRate: number;
    addedAt: number;
}

/**
 * Configuration for ranking system
 */
export interface RankingConfig {
    /** Minimum usage count before ranking is reliable */
    minUsageCount: number;
    /** Success rate below this triggers skip list */
    skipThreshold: number;
    /** Minimum confidence for counting as success */
    minConfidenceForSuccess: number;
    /** Weight for success rate in rank score */
    successRateWeight: number;
    /** Weight for confidence in rank score */
    confidenceWeight: number;
    /** Decay factor for old data (0-1) */
    timeDecay: number;
}

/**
 * Default ranking configuration
 */
export const DEFAULT_RANKING_CONFIG: RankingConfig = {
    minUsageCount: 5,
    skipThreshold: 0.1, // Skip if <10% success rate
    minConfidenceForSuccess: 0.5,
    successRateWeight: 0.7,
    confidenceWeight: 0.3,
    timeDecay: 0.95, // 5% decay per day
};

// Storage
const performanceData = new Map<string, TemplatePerformance>();
const rankingCache = new Map<string, TemplateRanking>();
const skipList = new Map<string, SkipListEntry>();

let config = DEFAULT_RANKING_CONFIG;
let lastCacheUpdate = 0;
const CACHE_TTL = 60000; // 1 minute

/**
 * Set ranking configuration
 */
export function setRankingConfig(newConfig: Partial<RankingConfig>): void {
    config = { ...config, ...newConfig };
    invalidateCache();
}

/**
 * Get current ranking configuration
 */
export function getRankingConfig(): RankingConfig {
    return config;
}

/**
 * Record a template match result
 */
export function recordMatchResult(
    templateId: string,
    itemId: string,
    success: boolean,
    confidence: number,
    confusedWith?: string
): void {
    const key = templateId;

    let perf = performanceData.get(key);
    if (!perf) {
        perf = {
            templateId,
            itemId,
            usageCount: 0,
            successCount: 0,
            failureCount: 0,
            avgConfidence: 0,
            confusionItems: new Map(),
            optimalThreshold: 0.5,
            lastUpdated: Date.now(),
        };
        performanceData.set(key, perf);
    }

    // Update counts
    perf.usageCount++;
    if (success && confidence >= config.minConfidenceForSuccess) {
        perf.successCount++;
    } else {
        perf.failureCount++;
    }

    // Update average confidence (running average)
    perf.avgConfidence = (perf.avgConfidence * (perf.usageCount - 1) + confidence) / perf.usageCount;

    // Track confusion
    if (!success && confusedWith) {
        const currentCount = perf.confusionItems.get(confusedWith) || 0;
        perf.confusionItems.set(confusedWith, currentCount + 1);
    }

    // Update optimal threshold based on success pattern
    updateOptimalThreshold(perf);

    perf.lastUpdated = Date.now();

    // Check if should be added to skip list
    checkForSkipList(perf);

    invalidateCache();
}

/**
 * Update optimal confidence threshold for a template
 */
function updateOptimalThreshold(perf: TemplatePerformance): void {
    if (perf.usageCount < config.minUsageCount) {
        perf.optimalThreshold = 0.5; // Default
        return;
    }

    const successRate = perf.successCount / perf.usageCount;

    // If high success rate, can use lower threshold
    // If low success rate, need higher threshold
    perf.optimalThreshold = 0.4 + (1 - successRate) * 0.3;

    // Clamp to reasonable range
    perf.optimalThreshold = Math.max(0.35, Math.min(0.7, perf.optimalThreshold));
}

/**
 * Check if template should be added to skip list
 */
function checkForSkipList(perf: TemplatePerformance): void {
    if (perf.usageCount < config.minUsageCount) {
        return;
    }

    const successRate = perf.successCount / perf.usageCount;

    if (successRate < config.skipThreshold) {
        // Add to skip list
        skipList.set(perf.templateId, {
            templateId: perf.templateId,
            itemId: perf.itemId,
            reason: 'low_success_rate',
            successRate,
            addedAt: Date.now(),
        });
    } else {
        // Remove from skip list if improved
        skipList.delete(perf.templateId);
    }

    // Check for high confusion
    const totalConfusions = Array.from(perf.confusionItems.values()).reduce((a, b) => a + b, 0);
    const confusionRate = totalConfusions / perf.usageCount;

    if (confusionRate > 0.5) {
        skipList.set(perf.templateId, {
            templateId: perf.templateId,
            itemId: perf.itemId,
            reason: 'high_confusion',
            successRate,
            addedAt: Date.now(),
        });
    }
}

/**
 * Get ranking for a template
 */
export function getTemplateRanking(templateId: string): TemplateRanking | null {
    updateCacheIfNeeded();
    return rankingCache.get(templateId) || null;
}

/**
 * Get rankings for all templates of an item
 */
export function getRankingsForItem(itemId: string): TemplateRanking[] {
    updateCacheIfNeeded();

    const rankings: TemplateRanking[] = [];
    for (const [, ranking] of rankingCache) {
        if (ranking.itemId === itemId) {
            rankings.push(ranking);
        }
    }

    return rankings.sort((a, b) => b.rankScore - a.rankScore);
}

/**
 * Get top N templates for an item by ranking
 */
export function getTopTemplates(itemId: string, count: number = 3): TemplateRanking[] {
    return getRankingsForItem(itemId).slice(0, count);
}

/**
 * Check if template is on skip list
 */
export function shouldSkipTemplate(templateId: string): boolean {
    return skipList.has(templateId);
}

/**
 * Get skip list entry
 */
export function getSkipListEntry(templateId: string): SkipListEntry | null {
    return skipList.get(templateId) || null;
}

/**
 * Get all skip list entries
 */
export function getSkipList(): SkipListEntry[] {
    return Array.from(skipList.values());
}

/**
 * Manually add template to skip list
 */
export function addToSkipList(templateId: string, itemId: string): void {
    skipList.set(templateId, {
        templateId,
        itemId,
        reason: 'manual',
        successRate: 0,
        addedAt: Date.now(),
    });
    invalidateCache();
}

/**
 * Remove template from skip list
 */
export function removeFromSkipList(templateId: string): void {
    skipList.delete(templateId);
    invalidateCache();
}

/**
 * Clear skip list
 */
export function clearSkipList(): void {
    skipList.clear();
    invalidateCache();
}

/**
 * Get confusion matrix for an item
 * Returns which items this item is commonly confused with
 */
export function getConfusionMatrix(itemId: string): Map<string, number> {
    const confusion = new Map<string, number>();

    for (const [, perf] of performanceData) {
        if (perf.itemId === itemId) {
            for (const [confusedItem, count] of perf.confusionItems) {
                const current = confusion.get(confusedItem) || 0;
                confusion.set(confusedItem, current + count);
            }
        }
    }

    return confusion;
}

/**
 * Get recommended threshold for an item (average of template thresholds)
 */
export function getRecommendedThreshold(itemId: string): number {
    const perfs = Array.from(performanceData.values()).filter(p => p.itemId === itemId);

    if (perfs.length === 0) {
        return 0.5; // Default
    }

    const totalThreshold = perfs.reduce((sum, p) => sum + p.optimalThreshold, 0);
    return totalThreshold / perfs.length;
}

/**
 * Update ranking cache
 */
function updateCacheIfNeeded(): void {
    const now = Date.now();
    if (now - lastCacheUpdate < CACHE_TTL) {
        return;
    }

    rankingCache.clear();

    for (const [templateId, perf] of performanceData) {
        const ranking = calculateRanking(perf);
        rankingCache.set(templateId, ranking);
    }

    lastCacheUpdate = now;
}

/**
 * Calculate ranking for a template
 */
function calculateRanking(perf: TemplatePerformance): TemplateRanking {
    const successRate = perf.usageCount > 0 ? perf.successCount / perf.usageCount : 0;

    // Apply time decay
    const daysSinceUpdate = (Date.now() - perf.lastUpdated) / (1000 * 60 * 60 * 24);
    const decayFactor = Math.pow(config.timeDecay, daysSinceUpdate);

    // Calculate rank score
    const rankScore =
        (successRate * config.successRateWeight + perf.avgConfidence * config.confidenceWeight) * decayFactor;

    return {
        templateId: perf.templateId,
        itemId: perf.itemId,
        rankScore,
        successRate,
        shouldSkip: skipList.has(perf.templateId),
        threshold: perf.optimalThreshold,
    };
}

/**
 * Invalidate ranking cache
 */
function invalidateCache(): void {
    lastCacheUpdate = 0;
}

/**
 * Export performance data for persistence
 */
export function exportPerformanceData(): {
    performance: Array<Omit<TemplatePerformance, 'confusionItems'> & { confusionItems: Array<[string, number]> }>;
    skipList: SkipListEntry[];
} {
    const performance = Array.from(performanceData.values()).map(p => {
        const { confusionItems, ...rest } = p;
        return {
            ...rest,
            confusionItems: Array.from(confusionItems.entries()),
        };
    });

    return {
        performance,
        skipList: Array.from(skipList.values()),
    };
}

/**
 * Import performance data from persistence
 */
export function importPerformanceData(data: {
    performance: Array<Omit<TemplatePerformance, 'confusionItems'> & { confusionItems: Array<[string, number]> }>;
    skipList: SkipListEntry[];
}): void {
    performanceData.clear();
    skipList.clear();

    for (const perf of data.performance) {
        performanceData.set(perf.templateId, {
            ...perf,
            confusionItems: new Map(perf.confusionItems),
        });
    }

    for (const entry of data.skipList) {
        skipList.set(entry.templateId, entry);
    }

    invalidateCache();
}

/**
 * Get summary statistics
 */
export function getRankingStats(): {
    totalTemplates: number;
    rankedTemplates: number;
    skippedTemplates: number;
    avgSuccessRate: number;
    avgConfidence: number;
} {
    updateCacheIfNeeded();

    const rankings = Array.from(rankingCache.values());

    const totalSuccessRate = rankings.reduce((sum, r) => sum + r.successRate, 0);
    const perfs = Array.from(performanceData.values());
    const totalConfidence = perfs.reduce((sum, p) => sum + p.avgConfidence, 0);

    return {
        totalTemplates: performanceData.size,
        rankedTemplates: rankings.filter(r => !r.shouldSkip).length,
        skippedTemplates: skipList.size,
        avgSuccessRate: rankings.length > 0 ? totalSuccessRate / rankings.length : 0,
        avgConfidence: perfs.length > 0 ? totalConfidence / perfs.length : 0,
    };
}

/**
 * Clear all performance data
 */
export function clearPerformanceData(): void {
    performanceData.clear();
    rankingCache.clear();
    skipList.clear();
    lastCacheUpdate = 0;
}
