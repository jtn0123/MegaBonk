// ========================================
// CV Result Aggregation
// ========================================

import type { CVDetectionResult } from './types.ts';

/** Base detection result for combining OCR and CV results */
interface BaseDetectionResult {
    type: string;
    entity: { id: string; name: string };
    confidence: number;
    position?: { x: number; y: number; width: number; height: number };
    method?: string;
}

/**
 * Aggregate duplicate detections into single entries with counts
 * Converts [Wrench, Wrench, Wrench] → [Wrench x3]
 */
export function aggregateDuplicates(detections: CVDetectionResult[]): Array<CVDetectionResult & { count: number }> {
    const grouped = new Map<string, Array<CVDetectionResult & { count?: number }>>();

    // Group by entity ID
    detections.forEach(detection => {
        const key = detection.entity.id;
        if (!grouped.has(key)) {
            grouped.set(key, []);
        }
        grouped.get(key)!.push(detection);
    });

    // Aggregate each group
    const aggregated: Array<CVDetectionResult & { count: number }> = [];

    grouped.forEach((group, _entityId) => {
        // Sum up counts (default to 1 per detection)
        const totalCount = group.reduce((sum, d) => sum + (d.count || 1), 0);

        // Use highest confidence from group
        const maxConfidence = Math.max(...group.map(d => d.confidence));

        // Keep first detection's position
        const firstDetection = group[0];
        if (!firstDetection) return;

        aggregated.push({
            type: firstDetection.type,
            entity: firstDetection.entity,
            confidence: maxConfidence,
            position: firstDetection.position,
            method: firstDetection.method,
            count: totalCount,
        });
    });

    // Sort by entity name for consistent ordering
    return aggregated.sort((a, b) => a.entity.name.localeCompare(b.entity.name));
}

/**
 * Combine OCR and CV results for hybrid detection
 */
export function combineDetections(
    ocrResults: BaseDetectionResult[],
    cvResults: CVDetectionResult[]
): CVDetectionResult[] {
    const combined: CVDetectionResult[] = [];
    const seen = new Set<string>();

    // Merge results, boosting confidence when both methods agree
    [...ocrResults, ...cvResults].forEach(result => {
        const entity = result.entity;
        const key = `${entity.id}_${result.type}`;

        if (seen.has(key)) {
            // Already added - boost confidence if found by both methods
            const existing = combined.find(r => r.entity.id === entity.id && r.type === result.type);
            if (existing) {
                existing.confidence = Math.min(0.98, existing.confidence * 1.2);
                existing.method = 'hybrid';
            }
        } else {
            seen.add(key);
            combined.push({
                type: result.type as CVDetectionResult['type'],
                entity: result.entity as CVDetectionResult['entity'],
                confidence: result.confidence,
                position: result.position,
                method: (result.method || 'template_match') as CVDetectionResult['method'],
            });
        }
    });

    // Sort by confidence
    return combined.sort((a, b) => b.confidence - a.confidence);
}
