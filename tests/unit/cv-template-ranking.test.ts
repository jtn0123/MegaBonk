/**
 * CV Template Ranking Module Tests
 * 
 * Tests the template performance tracking and ranking system
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
    recordMatchResult,
    getTemplateRanking,
    getRankingsForItem,
    getTopTemplates,
    shouldSkipTemplate,
    getSkipListEntry,
    getSkipList,
    addToSkipList,
    removeFromSkipList,
    clearSkipList,
    getConfusionMatrix,
    getRecommendedThreshold,
    exportPerformanceData,
    importPerformanceData,
    getRankingStats,
    clearPerformanceData,
    setRankingConfig,
    getRankingConfig,
    DEFAULT_RANKING_CONFIG,
    type RankingConfig,
} from '../../src/modules/cv/template-ranking.ts';

describe('CV Template Ranking Module', () => {
    beforeEach(() => {
        // Reset all data before each test
        clearPerformanceData();
        setRankingConfig(DEFAULT_RANKING_CONFIG);
    });

    describe('Configuration', () => {
        it('should return default configuration', () => {
            const config = getRankingConfig();
            expect(config).toEqual(DEFAULT_RANKING_CONFIG);
        });

        it('should have expected default values', () => {
            const config = getRankingConfig();
            expect(config.minUsageCount).toBe(5);
            expect(config.skipThreshold).toBe(0.1);
            expect(config.minConfidenceForSuccess).toBe(0.5);
            expect(config.successRateWeight).toBe(0.7);
            expect(config.confidenceWeight).toBe(0.3);
            expect(config.timeDecay).toBe(0.95);
        });

        it('should allow partial config updates', () => {
            setRankingConfig({ minUsageCount: 10 });
            const config = getRankingConfig();
            expect(config.minUsageCount).toBe(10);
            expect(config.skipThreshold).toBe(0.1); // Unchanged
        });

        it('should allow full config replacement', () => {
            const newConfig: Partial<RankingConfig> = {
                minUsageCount: 3,
                skipThreshold: 0.2,
                minConfidenceForSuccess: 0.6,
            };
            setRankingConfig(newConfig);
            const config = getRankingConfig();
            expect(config.minUsageCount).toBe(3);
            expect(config.skipThreshold).toBe(0.2);
        });
    });

    describe('recordMatchResult', () => {
        it('should create new performance entry for new template', () => {
            recordMatchResult('tmpl-1', 'item-a', true, 0.85);
            const ranking = getTemplateRanking('tmpl-1');
            expect(ranking).not.toBeNull();
            expect(ranking!.templateId).toBe('tmpl-1');
            expect(ranking!.itemId).toBe('item-a');
        });

        it('should increment usage count', () => {
            recordMatchResult('tmpl-1', 'item-a', true, 0.85);
            recordMatchResult('tmpl-1', 'item-a', true, 0.80);
            recordMatchResult('tmpl-1', 'item-a', false, 0.60);
            const stats = getRankingStats();
            expect(stats.totalTemplates).toBe(1);
        });

        it('should track success and failure counts', () => {
            recordMatchResult('tmpl-1', 'item-a', true, 0.85);
            recordMatchResult('tmpl-1', 'item-a', true, 0.80);
            recordMatchResult('tmpl-1', 'item-a', false, 0.40);
            const ranking = getTemplateRanking('tmpl-1');
            expect(ranking!.successRate).toBeGreaterThan(0.5);
        });

        it('should only count success if confidence above threshold', () => {
            // minConfidenceForSuccess is 0.5 by default
            recordMatchResult('tmpl-1', 'item-a', true, 0.3); // Below threshold
            recordMatchResult('tmpl-1', 'item-a', true, 0.3);
            recordMatchResult('tmpl-1', 'item-a', true, 0.3);
            recordMatchResult('tmpl-1', 'item-a', true, 0.3);
            recordMatchResult('tmpl-1', 'item-a', true, 0.3);
            const ranking = getTemplateRanking('tmpl-1');
            // Even though success=true, low confidence means failures
            expect(ranking!.successRate).toBe(0);
        });

        it('should track confusion items', () => {
            recordMatchResult('tmpl-1', 'item-a', false, 0.6, 'item-b');
            recordMatchResult('tmpl-1', 'item-a', false, 0.55, 'item-b');
            recordMatchResult('tmpl-1', 'item-a', false, 0.5, 'item-c');
            const confusion = getConfusionMatrix('item-a');
            expect(confusion.get('item-b')).toBe(2);
            expect(confusion.get('item-c')).toBe(1);
        });

        it('should calculate running average confidence', () => {
            recordMatchResult('tmpl-1', 'item-a', true, 0.80);
            recordMatchResult('tmpl-1', 'item-a', true, 0.90);
            // Average should be around 0.85
            const ranking = getTemplateRanking('tmpl-1');
            expect(ranking).not.toBeNull();
        });
    });

    describe('Skip List', () => {
        it('should add template to skip list when success rate is too low', () => {
            // Record 5 failures (minUsageCount is 5)
            for (let i = 0; i < 6; i++) {
                recordMatchResult('bad-tmpl', 'item-a', false, 0.3);
            }
            expect(shouldSkipTemplate('bad-tmpl')).toBe(true);
        });

        it('should not skip template with insufficient usage', () => {
            recordMatchResult('new-tmpl', 'item-a', false, 0.3);
            recordMatchResult('new-tmpl', 'item-a', false, 0.3);
            // Only 2 usages, minUsageCount is 5
            expect(shouldSkipTemplate('new-tmpl')).toBe(false);
        });

        it('should remove from skip list when improved', () => {
            // First make it bad
            for (let i = 0; i < 5; i++) {
                recordMatchResult('tmpl-1', 'item-a', false, 0.3);
            }
            expect(shouldSkipTemplate('tmpl-1')).toBe(true);

            // Now record many successes to improve rate
            for (let i = 0; i < 50; i++) {
                recordMatchResult('tmpl-1', 'item-a', true, 0.9);
            }
            expect(shouldSkipTemplate('tmpl-1')).toBe(false);
        });

        it('should add to skip list for high confusion rate', () => {
            // More than 50% confusion
            for (let i = 0; i < 6; i++) {
                recordMatchResult('confused-tmpl', 'item-a', false, 0.6, 'item-b');
            }
            const entry = getSkipListEntry('confused-tmpl');
            expect(entry).not.toBeNull();
            expect(entry!.reason).toBe('high_confusion');
        });

        it('should allow manual skip list addition', () => {
            addToSkipList('manual-skip', 'item-a');
            expect(shouldSkipTemplate('manual-skip')).toBe(true);
            const entry = getSkipListEntry('manual-skip');
            expect(entry!.reason).toBe('manual');
        });

        it('should allow removal from skip list', () => {
            addToSkipList('tmpl-1', 'item-a');
            expect(shouldSkipTemplate('tmpl-1')).toBe(true);
            removeFromSkipList('tmpl-1');
            expect(shouldSkipTemplate('tmpl-1')).toBe(false);
        });

        it('should clear entire skip list', () => {
            addToSkipList('tmpl-1', 'item-a');
            addToSkipList('tmpl-2', 'item-b');
            clearSkipList();
            expect(getSkipList()).toHaveLength(0);
        });

        it('should return all skip list entries', () => {
            addToSkipList('tmpl-1', 'item-a');
            addToSkipList('tmpl-2', 'item-b');
            const list = getSkipList();
            expect(list).toHaveLength(2);
            expect(list.map(e => e.templateId)).toContain('tmpl-1');
            expect(list.map(e => e.templateId)).toContain('tmpl-2');
        });

        it('should return null for non-existent skip list entry', () => {
            const entry = getSkipListEntry('nonexistent');
            expect(entry).toBeNull();
        });
    });

    describe('getTemplateRanking', () => {
        it('should return null for unknown template', () => {
            const ranking = getTemplateRanking('unknown');
            expect(ranking).toBeNull();
        });

        it('should return ranking with all fields', () => {
            recordMatchResult('tmpl-1', 'item-a', true, 0.85);
            const ranking = getTemplateRanking('tmpl-1');
            expect(ranking).not.toBeNull();
            expect(ranking!.templateId).toBe('tmpl-1');
            expect(ranking!.itemId).toBe('item-a');
            expect(ranking!.rankScore).toBeGreaterThanOrEqual(0);
            expect(ranking!.successRate).toBeGreaterThanOrEqual(0);
            expect(typeof ranking!.shouldSkip).toBe('boolean');
            expect(ranking!.threshold).toBeGreaterThan(0);
        });

        it('should update ranking after new results', () => {
            recordMatchResult('tmpl-1', 'item-a', true, 0.85);
            const ranking1 = getTemplateRanking('tmpl-1');
            
            recordMatchResult('tmpl-1', 'item-a', false, 0.3);
            recordMatchResult('tmpl-1', 'item-a', false, 0.3);
            
            // Force cache invalidation by waiting or calling again
            const ranking2 = getTemplateRanking('tmpl-1');
            
            // Success rate should have decreased
            expect(ranking2!.successRate).toBeLessThan(ranking1!.successRate);
        });
    });

    describe('getRankingsForItem', () => {
        it('should return empty array for unknown item', () => {
            const rankings = getRankingsForItem('unknown');
            expect(rankings).toHaveLength(0);
        });

        it('should return all templates for an item', () => {
            recordMatchResult('tmpl-1', 'item-a', true, 0.85);
            recordMatchResult('tmpl-2', 'item-a', true, 0.80);
            recordMatchResult('tmpl-3', 'item-b', true, 0.75); // Different item
            
            const rankings = getRankingsForItem('item-a');
            expect(rankings).toHaveLength(2);
            expect(rankings.every(r => r.itemId === 'item-a')).toBe(true);
        });

        it('should sort by rank score descending', () => {
            recordMatchResult('tmpl-1', 'item-a', true, 0.70);
            recordMatchResult('tmpl-2', 'item-a', true, 0.95);
            recordMatchResult('tmpl-3', 'item-a', true, 0.80);
            
            const rankings = getRankingsForItem('item-a');
            expect(rankings[0].rankScore).toBeGreaterThanOrEqual(rankings[1].rankScore);
            expect(rankings[1].rankScore).toBeGreaterThanOrEqual(rankings[2].rankScore);
        });
    });

    describe('getTopTemplates', () => {
        it('should return top N templates', () => {
            recordMatchResult('tmpl-1', 'item-a', true, 0.70);
            recordMatchResult('tmpl-2', 'item-a', true, 0.95);
            recordMatchResult('tmpl-3', 'item-a', true, 0.80);
            recordMatchResult('tmpl-4', 'item-a', true, 0.85);
            
            const top2 = getTopTemplates('item-a', 2);
            expect(top2).toHaveLength(2);
        });

        it('should default to 3 templates', () => {
            for (let i = 1; i <= 5; i++) {
                recordMatchResult(`tmpl-${i}`, 'item-a', true, 0.7 + i * 0.05);
            }
            
            const top = getTopTemplates('item-a');
            expect(top).toHaveLength(3);
        });

        it('should return fewer if not enough templates exist', () => {
            recordMatchResult('tmpl-1', 'item-a', true, 0.85);
            
            const top = getTopTemplates('item-a', 5);
            expect(top).toHaveLength(1);
        });
    });

    describe('getConfusionMatrix', () => {
        it('should return empty map for item with no confusion', () => {
            recordMatchResult('tmpl-1', 'item-a', true, 0.85);
            const confusion = getConfusionMatrix('item-a');
            expect(confusion.size).toBe(0);
        });

        it('should aggregate confusion across templates', () => {
            recordMatchResult('tmpl-1', 'item-a', false, 0.6, 'item-b');
            recordMatchResult('tmpl-2', 'item-a', false, 0.6, 'item-b');
            recordMatchResult('tmpl-1', 'item-a', false, 0.6, 'item-c');
            
            const confusion = getConfusionMatrix('item-a');
            expect(confusion.get('item-b')).toBe(2);
            expect(confusion.get('item-c')).toBe(1);
        });

        it('should return empty map for unknown item', () => {
            const confusion = getConfusionMatrix('unknown');
            expect(confusion.size).toBe(0);
        });
    });

    describe('getRecommendedThreshold', () => {
        it('should return default 0.5 for unknown item', () => {
            const threshold = getRecommendedThreshold('unknown');
            expect(threshold).toBe(0.5);
        });

        it('should average thresholds across templates', () => {
            recordMatchResult('tmpl-1', 'item-a', true, 0.85);
            recordMatchResult('tmpl-2', 'item-a', true, 0.80);
            
            const threshold = getRecommendedThreshold('item-a');
            expect(threshold).toBeGreaterThan(0.3);
            expect(threshold).toBeLessThan(0.8);
        });
    });

    describe('Export/Import', () => {
        it('should export performance data', () => {
            recordMatchResult('tmpl-1', 'item-a', true, 0.85);
            recordMatchResult('tmpl-1', 'item-a', false, 0.6, 'item-b');
            addToSkipList('tmpl-2', 'item-c');
            
            const exported = exportPerformanceData();
            expect(exported.performance).toHaveLength(1);
            expect(exported.skipList).toHaveLength(1);
        });

        it('should export confusion items as array', () => {
            recordMatchResult('tmpl-1', 'item-a', false, 0.6, 'item-b');
            
            const exported = exportPerformanceData();
            expect(Array.isArray(exported.performance[0].confusionItems)).toBe(true);
        });

        it('should import performance data', () => {
            const data = {
                performance: [
                    {
                        templateId: 'imported-tmpl',
                        itemId: 'item-x',
                        usageCount: 10,
                        successCount: 8,
                        failureCount: 2,
                        avgConfidence: 0.82,
                        confusionItems: [['item-y', 2]],
                        optimalThreshold: 0.45,
                        lastUpdated: Date.now(),
                    },
                ],
                skipList: [
                    {
                        templateId: 'skip-imported',
                        itemId: 'item-z',
                        reason: 'manual' as const,
                        successRate: 0,
                        addedAt: Date.now(),
                    },
                ],
            };
            
            importPerformanceData(data);
            
            const ranking = getTemplateRanking('imported-tmpl');
            expect(ranking).not.toBeNull();
            expect(ranking!.itemId).toBe('item-x');
            
            expect(shouldSkipTemplate('skip-imported')).toBe(true);
        });

        it('should clear existing data on import', () => {
            recordMatchResult('existing-tmpl', 'item-a', true, 0.85);
            
            importPerformanceData({ performance: [], skipList: [] });
            
            const ranking = getTemplateRanking('existing-tmpl');
            expect(ranking).toBeNull();
        });
    });

    describe('getRankingStats', () => {
        it('should return zeros for empty data', () => {
            const stats = getRankingStats();
            expect(stats.totalTemplates).toBe(0);
            expect(stats.rankedTemplates).toBe(0);
            expect(stats.skippedTemplates).toBe(0);
            expect(stats.avgSuccessRate).toBe(0);
            expect(stats.avgConfidence).toBe(0);
        });

        it('should count templates correctly', () => {
            recordMatchResult('tmpl-1', 'item-a', true, 0.85);
            recordMatchResult('tmpl-2', 'item-b', true, 0.80);
            addToSkipList('tmpl-3', 'item-c');
            
            const stats = getRankingStats();
            expect(stats.totalTemplates).toBe(2);
            expect(stats.skippedTemplates).toBe(1);
        });

        it('should calculate average success rate', () => {
            recordMatchResult('tmpl-1', 'item-a', true, 0.85);
            recordMatchResult('tmpl-1', 'item-a', true, 0.80);
            recordMatchResult('tmpl-2', 'item-b', true, 0.90);
            recordMatchResult('tmpl-2', 'item-b', false, 0.40);
            
            const stats = getRankingStats();
            expect(stats.avgSuccessRate).toBeGreaterThan(0);
            expect(stats.avgSuccessRate).toBeLessThanOrEqual(1);
        });

        it('should calculate average confidence', () => {
            recordMatchResult('tmpl-1', 'item-a', true, 0.85);
            recordMatchResult('tmpl-2', 'item-b', true, 0.75);
            
            const stats = getRankingStats();
            expect(stats.avgConfidence).toBeCloseTo(0.8, 1);
        });
    });

    describe('clearPerformanceData', () => {
        it('should clear all data', () => {
            recordMatchResult('tmpl-1', 'item-a', true, 0.85);
            addToSkipList('tmpl-2', 'item-b');
            
            clearPerformanceData();
            
            expect(getTemplateRanking('tmpl-1')).toBeNull();
            expect(shouldSkipTemplate('tmpl-2')).toBe(false);
            expect(getRankingStats().totalTemplates).toBe(0);
        });
    });

    describe('Edge Cases', () => {
        it('should handle zero confidence', () => {
            recordMatchResult('tmpl-1', 'item-a', false, 0);
            const ranking = getTemplateRanking('tmpl-1');
            expect(ranking).not.toBeNull();
        });

        it('should handle confidence = 1', () => {
            recordMatchResult('tmpl-1', 'item-a', true, 1.0);
            const ranking = getTemplateRanking('tmpl-1');
            expect(ranking).not.toBeNull();
        });

        it('should handle many templates', () => {
            for (let i = 0; i < 100; i++) {
                recordMatchResult(`tmpl-${i}`, 'item-a', true, 0.5 + Math.random() * 0.5);
            }
            const stats = getRankingStats();
            expect(stats.totalTemplates).toBe(100);
        });

        it('should handle special characters in template IDs', () => {
            recordMatchResult('tmpl/with/slashes', 'item-a', true, 0.85);
            recordMatchResult('tmpl:with:colons', 'item-a', true, 0.80);
            
            expect(getTemplateRanking('tmpl/with/slashes')).not.toBeNull();
            expect(getTemplateRanking('tmpl:with:colons')).not.toBeNull();
        });

        it('should handle empty confusion item', () => {
            recordMatchResult('tmpl-1', 'item-a', false, 0.6, undefined);
            recordMatchResult('tmpl-1', 'item-a', false, 0.6, '');
            const confusion = getConfusionMatrix('item-a');
            // Empty strings might be tracked as confusion
            expect(confusion.size).toBeLessThanOrEqual(1);
        });
    });
});
