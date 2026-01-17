/**
 * CV Error Analysis Module
 * Provides detailed analysis of false positives and false negatives
 */

export interface ErrorAnalysisResult {
    falsePositives: DetectionError[];
    falseNegatives: DetectionError[];
    truePositives: CorrectDetection[];
    summary: ErrorSummary;
    recommendations: string[];
}

export interface DetectionError {
    itemName: string;
    expectedCount: number;
    detectedCount: number;
    difference: number;
    confidence?: number;
    possibleReasons: string[];
}

export interface CorrectDetection {
    itemName: string;
    count: number;
    averageConfidence: number;
}

export interface ErrorSummary {
    totalErrors: number;
    falsePositiveCount: number;
    falseNegativeCount: number;
    errorRate: number;
    mostProblematicItems: string[];
    commonPatterns: string[];
}

/**
 * Analyze detection errors and provide insights
 */
export function analyzeDetectionErrors(
    detected: Array<{ name: string; confidence?: number }>,
    expected: string[]
): ErrorAnalysisResult {
    const detectedCounts = new Map<string, { count: number; confidences: number[] }>();
    const expectedCounts = new Map<string, number>();

    // Count detected items
    detected.forEach(item => {
        const name = item.name.toLowerCase().trim();
        if (!detectedCounts.has(name)) {
            detectedCounts.set(name, { count: 0, confidences: [] });
        }
        const entry = detectedCounts.get(name)!;
        entry.count++;
        if (item.confidence !== undefined) {
            entry.confidences.push(item.confidence);
        }
    });

    // Count expected items
    expected.forEach(item => {
        const name = item.toLowerCase().trim();
        expectedCounts.set(name, (expectedCounts.get(name) || 0) + 1);
    });

    const falsePositives: DetectionError[] = [];
    const falseNegatives: DetectionError[] = [];
    const truePositives: CorrectDetection[] = [];

    // Analyze each expected item
    for (const [itemName, expectedCount] of Array.from(expectedCounts.entries())) {
        const detectedEntry = detectedCounts.get(itemName);
        const detectedCount = detectedEntry?.count || 0;
        const difference = detectedCount - expectedCount;

        if (detectedCount === expectedCount) {
            // True positive
            const avgConfidence =
                detectedEntry!.confidences.length > 0
                    ? detectedEntry!.confidences.reduce((a, b) => a + b, 0) / detectedEntry!.confidences.length
                    : 0;

            truePositives.push({
                itemName,
                count: expectedCount,
                averageConfidence: avgConfidence,
            });
        } else if (detectedCount < expectedCount) {
            // False negative (missed items)
            const reasons = diagnoseError(
                itemName,
                detectedCount,
                expectedCount,
                detectedEntry?.confidences || [],
                'missed'
            );

            falseNegatives.push({
                itemName,
                expectedCount,
                detectedCount,
                difference: -difference,
                confidence: detectedEntry?.confidences[0],
                possibleReasons: reasons,
            });
        } else {
            // False positive (over-detected)
            const reasons = diagnoseError(
                itemName,
                detectedCount,
                expectedCount,
                detectedEntry?.confidences || [],
                'over-detected'
            );

            falsePositives.push({
                itemName,
                expectedCount,
                detectedCount,
                difference,
                confidence: detectedEntry.confidences[0],
                possibleReasons: reasons,
            });
        }
    }

    // Check for completely spurious detections
    for (const [itemName, detectedEntry] of Array.from(detectedCounts.entries())) {
        if (!expectedCounts.has(itemName)) {
            const reasons = diagnoseError(itemName, detectedEntry.count, 0, detectedEntry.confidences, 'spurious');

            falsePositives.push({
                itemName,
                expectedCount: 0,
                detectedCount: detectedEntry.count,
                difference: detectedEntry.count,
                confidence: detectedEntry.confidences[0],
                possibleReasons: reasons,
            });
        }
    }

    // Generate summary
    const summary = generateSummary(falsePositives, falseNegatives, detected.length, expected.length);

    // Generate recommendations
    const recommendations = generateRecommendations(falsePositives, falseNegatives, truePositives);

    return {
        falsePositives,
        falseNegatives,
        truePositives,
        summary,
        recommendations,
    };
}

/**
 * Diagnose why an error occurred
 */
function diagnoseError(
    itemName: string,
    detectedCount: number,
    expectedCount: number,
    confidences: number[],
    errorType: 'missed' | 'over-detected' | 'spurious'
): string[] {
    const reasons: string[] = [];

    if (errorType === 'missed') {
        if (detectedCount === 0) {
            reasons.push('Item completely missed - template may be missing or incorrect');
            reasons.push('Item may be obscured by visual effects or particles');
            reasons.push('Item color/appearance may differ from template');
        } else {
            reasons.push(`Only ${detectedCount}/${expectedCount} detected - possible duplicate detection failure`);
            reasons.push('Some items may be partially occluded');
        }

        if (confidences.length > 0 && confidences[0] < 0.7) {
            reasons.push(`Low confidence (${confidences[0].toFixed(2)}) - template match may be weak`);
        }
    } else if (errorType === 'over-detected') {
        reasons.push('Duplicate detection - same item matched multiple times');
        reasons.push('Similar-looking items may be confused');

        if (confidences.some(c => c < 0.75)) {
            reasons.push('Some detections have low confidence - may be false matches');
        }
    } else if (errorType === 'spurious') {
        reasons.push('Item not in ground truth - may be visual similarity to other items');

        if (itemName.includes('wrench') || itemName.includes('medkit')) {
            reasons.push('Common items may be over-detected due to visual similarity');
        }

        if (confidences.length > 0 && confidences[0] < 0.6) {
            reasons.push(`Very low confidence (${confidences[0].toFixed(2)}) suggests false positive`);
        }
    }

    return reasons;
}

/**
 * Generate error summary
 */
function generateSummary(
    falsePositives: DetectionError[],
    falseNegatives: DetectionError[],
    totalDetected: number,
    totalExpected: number
): ErrorSummary {
    const totalErrors = falsePositives.length + falseNegatives.length;
    const errorRate = totalExpected > 0 ? (totalErrors / totalExpected) * 100 : 0;

    // Find most problematic items (highest error difference)
    const allErrors = [...falsePositives, ...falseNegatives];
    allErrors.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
    const mostProblematic = allErrors.slice(0, 5).map(e => e.itemName);

    // Identify common patterns
    const patterns: string[] = [];

    const lowConfidenceErrors = allErrors.filter(e => e.confidence && e.confidence < 0.6);
    if (lowConfidenceErrors.length > totalErrors * 0.3) {
        patterns.push('Low confidence threshold - consider adjusting confidence settings');
    }

    const completelyMissed = falseNegatives.filter(e => e.detectedCount === 0);
    if (completelyMissed.length > falseNegatives.length * 0.5) {
        patterns.push('Many items completely missed - check template quality');
    }

    const overDetected = falsePositives.filter(e => e.expectedCount > 0);
    if (overDetected.length > falsePositives.length * 0.3) {
        patterns.push('Duplicate detection issues - improve NMS or region filtering');
    }

    const spurious = falsePositives.filter(e => e.expectedCount === 0);
    if (spurious.length > 3) {
        patterns.push('Spurious detections - may need stricter matching thresholds');
    }

    return {
        totalErrors,
        falsePositiveCount: falsePositives.reduce((sum, e) => sum + e.difference, 0),
        falseNegativeCount: falseNegatives.reduce((sum, e) => sum + e.difference, 0),
        errorRate,
        mostProblematicItems: mostProblematic,
        commonPatterns: patterns,
    };
}

/**
 * Generate recommendations based on error analysis
 */
function generateRecommendations(
    falsePositives: DetectionError[],
    falseNegatives: DetectionError[],
    truePositives: CorrectDetection[]
): string[] {
    const recommendations: string[] = [];

    // Check overall confidence
    const avgTruePositiveConfidence =
        truePositives.length > 0
            ? truePositives.reduce((sum, tp) => sum + tp.averageConfidence, 0) / truePositives.length
            : 0;

    if (avgTruePositiveConfidence < 0.75) {
        recommendations.push('Low average confidence on correct detections - retrain templates or adjust thresholds');
    }

    // Check false negative patterns
    if (falseNegatives.length > 0) {
        const completelyMissedRate = falseNegatives.filter(fn => fn.detectedCount === 0).length / falseNegatives.length;

        if (completelyMissedRate > 0.5) {
            recommendations.push(
                'HIGH PRIORITY: Many items completely missed - audit template library for missing/incorrect templates'
            );
        } else {
            recommendations.push('Some items partially detected - check for occlusion or duplicate counting logic');
        }

        const missedItems = falseNegatives
            .slice(0, 3)
            .map(fn => fn.itemName)
            .join(', ');
        recommendations.push(`Review templates for: ${missedItems}`);
    }

    // Check false positive patterns
    if (falsePositives.length > 0) {
        const overDetectionRate =
            falsePositives.filter(fp => fp.expectedCount > 0 && fp.detectedCount > fp.expectedCount).length /
            falsePositives.length;

        if (overDetectionRate > 0.5) {
            recommendations.push(
                'Duplicate detection issues - strengthen NMS (non-maximum suppression) or increase IoU threshold'
            );
        }

        const spuriousRate = falsePositives.filter(fp => fp.expectedCount === 0).length / falsePositives.length;

        if (spuriousRate > 0.5) {
            recommendations.push(
                'Many spurious detections - increase confidence threshold or improve template specificity'
            );
        }
    }

    // Strategy recommendations
    if (falseNegatives.length > falsePositives.length * 2) {
        recommendations.push('High false negative rate - try "accurate" or "optimized" strategy for better recall');
    } else if (falsePositives.length > falseNegatives.length * 2) {
        recommendations.push('High false positive rate - try "balanced" strategy or increase confidence thresholds');
    }

    // If no major issues
    if (recommendations.length === 0) {
        recommendations.push('Detection quality is good - errors are within acceptable range');
    }

    return recommendations;
}

/**
 * Format error analysis for console logging
 */
export function formatErrorAnalysis(analysis: ErrorAnalysisResult): string {
    let output = '\n' + '='.repeat(70) + '\n';
    output += 'ERROR ANALYSIS REPORT\n';
    output += '='.repeat(70) + '\n\n';

    // Summary
    output += 'SUMMARY:\n';
    output += `  Total Errors: ${analysis.summary.totalErrors}\n`;
    output += `  False Positives: ${analysis.summary.falsePositiveCount}\n`;
    output += `  False Negatives: ${analysis.summary.falseNegativeCount}\n`;
    output += `  Error Rate: ${analysis.summary.errorRate.toFixed(1)}%\n\n`;

    // Most problematic items
    if (analysis.summary.mostProblematicItems.length > 0) {
        output += 'MOST PROBLEMATIC ITEMS:\n';
        analysis.summary.mostProblematicItems.forEach((item, i) => {
            output += `  ${i + 1}. ${item}\n`;
        });
        output += '\n';
    }

    // Common patterns
    if (analysis.summary.commonPatterns.length > 0) {
        output += 'COMMON PATTERNS:\n';
        analysis.summary.commonPatterns.forEach(pattern => {
            output += `  - ${pattern}\n`;
        });
        output += '\n';
    }

    // False positives
    if (analysis.falsePositives.length > 0) {
        output += 'FALSE POSITIVES (Over-detected or Spurious):\n';
        analysis.falsePositives.slice(0, 10).forEach(fp => {
            output += `  - ${fp.itemName}: Expected ${fp.expectedCount}, Got ${fp.detectedCount} (+${fp.difference})`;
            if (fp.confidence) {
                output += ` [conf: ${fp.confidence.toFixed(2)}]`;
            }
            output += '\n';
            fp.possibleReasons.slice(0, 2).forEach(reason => {
                output += `      → ${reason}\n`;
            });
        });
        if (analysis.falsePositives.length > 10) {
            output += `  ... and ${analysis.falsePositives.length - 10} more\n`;
        }
        output += '\n';
    }

    // False negatives
    if (analysis.falseNegatives.length > 0) {
        output += 'FALSE NEGATIVES (Missed):\n';
        analysis.falseNegatives.slice(0, 10).forEach(fn => {
            output += `  - ${fn.itemName}: Expected ${fn.expectedCount}, Got ${fn.detectedCount} (-${fn.difference})`;
            if (fn.confidence) {
                output += ` [conf: ${fn.confidence.toFixed(2)}]`;
            }
            output += '\n';
            fn.possibleReasons.slice(0, 2).forEach(reason => {
                output += `      → ${reason}\n`;
            });
        });
        if (analysis.falseNegatives.length > 10) {
            output += `  ... and ${analysis.falseNegatives.length - 10} more\n`;
        }
        output += '\n';
    }

    // Recommendations
    if (analysis.recommendations.length > 0) {
        output += 'RECOMMENDATIONS:\n';
        analysis.recommendations.forEach((rec, i) => {
            output += `  ${i + 1}. ${rec}\n`;
        });
        output += '\n';
    }

    output += '='.repeat(70) + '\n';

    return output;
}

/**
 * Export error analysis to JSON file
 */
export function exportErrorAnalysisJSON(analysis: ErrorAnalysisResult, filename: string): void {
    const json = JSON.stringify(analysis, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
}
