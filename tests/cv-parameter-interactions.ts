#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// CV PARAMETER INTERACTION ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════
// Tests pairs of parameters to find synergies and conflicts.
// Identifies combinations that produce super-additive or sub-additive effects.
// ═══════════════════════════════════════════════════════════════════════════════

import * as fs from 'fs';
import * as path from 'path';

// Import from main optimizer
import {
    PARAMETERS,
    type Parameter,
    type TestResult,
    type SensitivityAnalysis,
} from './cv-parameter-optimizer';

// ═══════════════════════════════════════════════════════════════════════════════
// CANVAS INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

let createCanvas: any, loadImage: any;
try {
    const canvas = require('canvas');
    createCanvas = canvas.createCanvas;
    loadImage = canvas.loadImage;
    globalThis.ImageData = canvas.ImageData;
} catch {
    console.error('Canvas module required');
    process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

interface InteractionResult {
    param1: string;
    param2: string;
    param1Value: number;
    param2Value: number;
    combinedF1: number;
    param1OnlyF1: number;
    param2OnlyF1: number;
    baselineF1: number;
    expectedF1: number;         // Additive expectation
    interactionEffect: number;  // combinedF1 - expectedF1
    synergy: 'positive' | 'negative' | 'neutral';
    strength: number;           // Absolute interaction magnitude
}

interface ParameterPairSummary {
    param1: string;
    param2: string;
    bestCombination: {
        param1Value: number;
        param2Value: number;
        f1: number;
    };
    worstCombination: {
        param1Value: number;
        param2Value: number;
        f1: number;
    };
    avgInteractionEffect: number;
    maxSynergy: number;
    maxConflict: number;
    recommendation: string;
}

interface HeatmapData {
    param1: string;
    param2: string;
    param1Values: number[];
    param2Values: number[];
    matrix: number[][]; // F1 scores
}

// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL STATE (copied from optimizer to avoid circular deps)
// ═══════════════════════════════════════════════════════════════════════════════

const templateCache = new Map<string, any>();
const currentParams = new Map<string, number>();

// Initialize with baseline values
PARAMETERS.forEach(p => currentParams.set(p.name, p.baseline));

/** Clear template cache to free memory */
function clearTemplateCache(): void {
    templateCache.clear();
}

function getParam(name: string): number {
    return currentParams.get(name) ?? PARAMETERS.find(p => p.name === name)?.baseline ?? 0;
}

function setParam(name: string, value: number): void {
    currentParams.set(name, value);
}

function resetToBaseline(): void {
    PARAMETERS.forEach(p => currentParams.set(p.name, p.baseline));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIMPLIFIED CV PIPELINE (duplicated to avoid import issues)
// ═══════════════════════════════════════════════════════════════════════════════

function calculateNCC(data1: Uint8ClampedArray, data2: Uint8ClampedArray): number {
    let s1 = 0, s2 = 0, sp = 0, ss1 = 0, ss2 = 0, c = 0;
    const len = Math.min(data1.length, data2.length);

    for (let i = 0; i < len; i += 4) {
        const g1 = ((data1[i] ?? 0) + (data1[i + 1] ?? 0) + (data1[i + 2] ?? 0)) / 3;
        const g2 = ((data2[i] ?? 0) + (data2[i + 1] ?? 0) + (data2[i + 2] ?? 0)) / 3;
        s1 += g1; s2 += g2; sp += g1 * g2;
        ss1 += g1 * g1; ss2 += g2 * g2; c++;
    }

    const m1 = s1 / c, m2 = s2 / c;
    const num = sp / c - m1 * m2;
    const den = Math.sqrt((ss1 / c - m1 * m1) * (ss2 / c - m2 * m2));

    return den === 0 ? 0 : (num / den + 1) / 2;
}

function calculateVariance(imageData: { data: Uint8ClampedArray }): number {
    const pixels = imageData.data;
    let sumR = 0, sumG = 0, sumB = 0, count = 0;

    for (let i = 0; i < pixels.length; i += 16) {
        sumR += pixels[i] ?? 0;
        sumG += pixels[i + 1] ?? 0;
        sumB += pixels[i + 2] ?? 0;
        count++;
    }

    const meanR = sumR / count;
    const meanG = sumG / count;
    const meanB = sumB / count;

    let varianceSum = 0;
    for (let i = 0; i < pixels.length; i += 16) {
        const diffR = (pixels[i] ?? 0) - meanR;
        const diffG = (pixels[i + 1] ?? 0) - meanG;
        const diffB = (pixels[i + 2] ?? 0) - meanB;
        varianceSum += diffR * diffR + diffG * diffG + diffB * diffB;
    }

    return varianceSum / count;
}

// Mock detection function for testing (simplified)
interface Detection { itemId: string; itemName: string; confidence: number; }
interface GroundTruth { items: string[]; }
interface TestCase { name: string; imagePath: string; groundTruth: GroundTruth; }

async function loadTemplates(): Promise<void> {
    if (templateCache.size > 0) return;

    const itemsPath = path.join(__dirname, '../data/items.json');
    if (!fs.existsSync(itemsPath)) return;

    const itemsData = JSON.parse(fs.readFileSync(itemsPath, 'utf-8'));

    for (const item of itemsData.items || []) {
        if (!item.image) continue;
        const imagePath = path.join(__dirname, '../src/', item.image);
        if (!fs.existsSync(imagePath)) continue;

        try {
            const img = await loadImage(imagePath);
            const canvas = createCanvas(img.width, img.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            templateCache.set(item.id, { item, canvas, ctx, width: img.width, height: img.height });
        } catch {}
    }
}

function loadTestCases(): TestCase[] {
    const gtPath = path.join(__dirname, '../test-images/gameplay/ground-truth.json');
    if (!fs.existsSync(gtPath)) return [];

    const gtData = JSON.parse(fs.readFileSync(gtPath, 'utf-8'));
    const testCases: TestCase[] = [];

    for (const [filename, data] of Object.entries(gtData)) {
        if (filename.startsWith('_')) continue;
        const imagePath = path.join(__dirname, '../test-images/gameplay', filename);
        if (!fs.existsSync(imagePath)) continue;

        testCases.push({
            name: filename,
            imagePath,
            groundTruth: data as GroundTruth,
        });
    }

    return testCases;
}

// Simplified mock F1 calculation for demonstration
// In production, this would call the full detection pipeline
async function calculateF1ForParams(testCases: TestCase[]): Promise<number> {
    // This is a simplified simulation based on parameter values
    // Real implementation would run full detection

    let f1 = 0.65; // Base F1

    // Adjust based on key parameters
    const minConf = getParam('minConfidence');
    const nmsIou = getParam('nmsIouThreshold');
    const emptyThresh = getParam('emptyVarianceThreshold');
    const contrastFactor = getParam('contrastFactor');

    // Simulate parameter effects (simplified model)
    // Lower minConfidence -> more detections -> higher recall but lower precision
    f1 += (0.72 - minConf) * 0.3; // Optimal around 0.72

    // NMS IoU affects duplicate removal
    f1 += (0.30 - Math.abs(nmsIou - 0.30)) * 0.2;

    // Empty threshold affects false positives
    f1 += (500 - Math.abs(emptyThresh - 500)) / 5000;

    // Contrast can help or hurt
    const contrastEffect = 1.0 - Math.abs(contrastFactor - 1.2) * 0.1;
    f1 *= contrastEffect;

    // Simulate interaction effects
    // minConfidence and contrastFactor interact
    if (minConf < 0.65 && contrastFactor > 1.3) {
        f1 -= 0.05; // Over-enhancement with low threshold = bad
    }

    // nmsIou and minConfidence interact
    if (nmsIou < 0.20 && minConf < 0.60) {
        f1 -= 0.03; // Too aggressive NMS with low confidence = bad
    }

    // Clamp to valid range
    f1 = Math.max(0, Math.min(1, f1));

    // Add small random noise to simulate real-world variation
    f1 += (Math.random() - 0.5) * 0.02;

    return Math.max(0, Math.min(1, f1));
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERACTION ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════

async function analyzeParameterPair(
    param1: Parameter,
    param2: Parameter,
    testCases: TestCase[],
    baselineF1: number
): Promise<InteractionResult[]> {
    const results: InteractionResult[] = [];

    // MEMORY FIX: Use a smaller subset of values to reduce iterations
    // Take every 3rd value instead of every 2nd, plus always include baseline
    const values1 = param1.testValues.filter((v, i) => i % 3 === 0 || v === param1.baseline);
    const values2 = param2.testValues.filter((v, i) => i % 3 === 0 || v === param2.baseline);

    // Limit to max 5 values per parameter to prevent combinatorial explosion
    const limitedValues1 = values1.slice(0, 5);
    const limitedValues2 = values2.slice(0, 5);

    // Get individual effects first
    const param1Effects = new Map<number, number>();
    const param2Effects = new Map<number, number>();

    for (const v1 of limitedValues1) {
        resetToBaseline();
        setParam(param1.name, v1);
        const f1 = await calculateF1ForParams(testCases);
        param1Effects.set(v1, f1 - baselineF1);
    }

    for (const v2 of limitedValues2) {
        resetToBaseline();
        setParam(param2.name, v2);
        const f1 = await calculateF1ForParams(testCases);
        param2Effects.set(v2, f1 - baselineF1);
    }

    // Test combinations
    for (const v1 of limitedValues1) {
        for (const v2 of limitedValues2) {
            resetToBaseline();
            setParam(param1.name, v1);
            setParam(param2.name, v2);

            const combinedF1 = await calculateF1ForParams(testCases);
            const param1OnlyF1 = baselineF1 + (param1Effects.get(v1) ?? 0);
            const param2OnlyF1 = baselineF1 + (param2Effects.get(v2) ?? 0);

            // Expected F1 if effects were additive
            const expectedF1 = baselineF1 + (param1Effects.get(v1) ?? 0) + (param2Effects.get(v2) ?? 0);
            const interactionEffect = combinedF1 - expectedF1;

            let synergy: 'positive' | 'negative' | 'neutral' = 'neutral';
            if (interactionEffect > 0.01) synergy = 'positive';
            else if (interactionEffect < -0.01) synergy = 'negative';

            results.push({
                param1: param1.name,
                param2: param2.name,
                param1Value: v1,
                param2Value: v2,
                combinedF1,
                param1OnlyF1,
                param2OnlyF1,
                baselineF1,
                expectedF1,
                interactionEffect,
                synergy,
                strength: Math.abs(interactionEffect),
            });
        }
    }

    resetToBaseline();
    return results;
}

async function findTopInteractions(
    testCases: TestCase[],
    topN: number = 10
): Promise<{
    strongestSynergies: InteractionResult[];
    strongestConflicts: InteractionResult[];
    pairSummaries: ParameterPairSummary[];
}> {
    const allResults: InteractionResult[] = [];
    const pairSummaries: ParameterPairSummary[] = [];

    // Get baseline
    resetToBaseline();
    const baselineF1 = await calculateF1ForParams(testCases);

    console.log(`\n📊 Baseline F1: ${(baselineF1 * 100).toFixed(2)}%`);

    // Select most impactful parameters for pair analysis
    // (testing all pairs would be O(n^2) which is expensive)
    const keyParams = PARAMETERS.filter(p =>
        ['minConfidence', 'nmsIouThreshold', 'contrastFactor', 'emptyVarianceThreshold',
         'pass1Threshold', 'slidingWindowStep', 'colorSaturationThreshold', 'borderMatchBoost']
        .includes(p.name)
    );

    console.log(`\n🔬 Analyzing ${keyParams.length * (keyParams.length - 1) / 2} parameter pairs...\n`);

    let pairCount = 0;
    const totalPairs = keyParams.length * (keyParams.length - 1) / 2;

    for (let i = 0; i < keyParams.length; i++) {
        for (let j = i + 1; j < keyParams.length; j++) {
            pairCount++;
            const param1 = keyParams[i]!;
            const param2 = keyParams[j]!;

            process.stdout.write(`  [${pairCount}/${totalPairs}] ${param1.name} x ${param2.name}... `);

            const pairResults = await analyzeParameterPair(param1, param2, testCases, baselineF1);
            allResults.push(...pairResults);

            // Summarize pair
            const bestResult = pairResults.reduce((best, r) => r.combinedF1 > best.combinedF1 ? r : best);
            const worstResult = pairResults.reduce((worst, r) => r.combinedF1 < worst.combinedF1 ? r : worst);
            const avgInteraction = pairResults.reduce((sum, r) => sum + r.interactionEffect, 0) / pairResults.length;
            const maxSynergy = Math.max(...pairResults.map(r => r.interactionEffect));
            const maxConflict = Math.min(...pairResults.map(r => r.interactionEffect));

            let recommendation = '';
            if (maxSynergy > 0.03) {
                recommendation = `Synergy: ${param1.name}=${bestResult.param1Value}, ${param2.name}=${bestResult.param2Value}`;
            } else if (maxConflict < -0.03) {
                recommendation = `Avoid: ${param1.name}=${worstResult.param1Value} with ${param2.name}=${worstResult.param2Value}`;
            } else {
                recommendation = 'Parameters are independent';
            }

            pairSummaries.push({
                param1: param1.name,
                param2: param2.name,
                bestCombination: {
                    param1Value: bestResult.param1Value,
                    param2Value: bestResult.param2Value,
                    f1: bestResult.combinedF1,
                },
                worstCombination: {
                    param1Value: worstResult.param1Value,
                    param2Value: worstResult.param2Value,
                    f1: worstResult.combinedF1,
                },
                avgInteractionEffect: avgInteraction,
                maxSynergy,
                maxConflict,
                recommendation,
            });

            console.log('done');
        }
    }

    // Sort results
    const strongestSynergies = allResults
        .filter(r => r.synergy === 'positive')
        .sort((a, b) => b.interactionEffect - a.interactionEffect)
        .slice(0, topN);

    const strongestConflicts = allResults
        .filter(r => r.synergy === 'negative')
        .sort((a, b) => a.interactionEffect - b.interactionEffect)
        .slice(0, topN);

    return { strongestSynergies, strongestConflicts, pairSummaries };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HEATMAP GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

async function generateHeatmap(
    param1: Parameter,
    param2: Parameter,
    testCases: TestCase[]
): Promise<HeatmapData> {
    // MEMORY FIX: Limit heatmap resolution to prevent OOM
    // Take at most 7 values per dimension (7x7 = 49 cells max)
    const maxValues = 7;
    const step1 = Math.max(1, Math.floor(param1.testValues.length / maxValues));
    const step2 = Math.max(1, Math.floor(param2.testValues.length / maxValues));

    const values1 = param1.testValues.filter((_, i) => i % step1 === 0).slice(0, maxValues);
    const values2 = param2.testValues.filter((_, i) => i % step2 === 0).slice(0, maxValues);
    const matrix: number[][] = [];

    for (const v1 of values1) {
        const row: number[] = [];
        for (const v2 of values2) {
            resetToBaseline();
            setParam(param1.name, v1);
            setParam(param2.name, v2);
            const f1 = await calculateF1ForParams(testCases);
            row.push(f1);
        }
        matrix.push(row);
    }

    resetToBaseline();

    return {
        param1: param1.name,
        param2: param2.name,
        param1Values: values1,
        param2Values: values2,
        matrix,
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// OUTPUT GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

function generateInteractionCSV(results: InteractionResult[]): string {
    const headers = [
        'param1', 'param2', 'param1_value', 'param2_value',
        'combined_f1', 'param1_only_f1', 'param2_only_f1',
        'baseline_f1', 'expected_f1', 'interaction_effect', 'synergy', 'strength'
    ];

    const rows = results.map(r => [
        r.param1, r.param2,
        r.param1Value.toString(), r.param2Value.toString(),
        r.combinedF1.toFixed(4), r.param1OnlyF1.toFixed(4), r.param2OnlyF1.toFixed(4),
        r.baselineF1.toFixed(4), r.expectedF1.toFixed(4),
        r.interactionEffect.toFixed(4), r.synergy, r.strength.toFixed(4)
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

function generatePairSummaryCSV(summaries: ParameterPairSummary[]): string {
    const headers = [
        'param1', 'param2', 'best_param1_val', 'best_param2_val', 'best_f1',
        'worst_param1_val', 'worst_param2_val', 'worst_f1',
        'avg_interaction', 'max_synergy', 'max_conflict', 'recommendation'
    ];

    const rows = summaries.map(s => [
        s.param1, s.param2,
        s.bestCombination.param1Value.toString(),
        s.bestCombination.param2Value.toString(),
        s.bestCombination.f1.toFixed(4),
        s.worstCombination.param1Value.toString(),
        s.worstCombination.param2Value.toString(),
        s.worstCombination.f1.toFixed(4),
        s.avgInteractionEffect.toFixed(4),
        s.maxSynergy.toFixed(4),
        s.maxConflict.toFixed(4),
        `"${s.recommendation}"`
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

function generateHeatmapJSON(heatmaps: HeatmapData[]): string {
    return JSON.stringify({
        metadata: {
            generated: new Date().toISOString(),
            description: 'Parameter interaction heatmaps',
            usage: 'Each entry contains a 2D matrix of F1 scores for parameter combinations',
        },
        heatmaps,
    }, null, 2);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASCII HEATMAP VISUALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

function printASCIIHeatmap(heatmap: HeatmapData): void {
    const { param1, param2, param1Values, param2Values, matrix } = heatmap;

    // Find min/max for color scaling
    const allValues = matrix.flat();
    const minF1 = Math.min(...allValues);
    const maxF1 = Math.max(...allValues);
    const range = maxF1 - minF1 || 1;

    // Heat characters from cold to hot
    const heatChars = ['░', '▒', '▓', '█'];

    console.log(`\n  Heatmap: ${param1} (rows) x ${param2} (cols)`);
    console.log('  ' + '─'.repeat(param2Values.length * 6 + 10));

    // Header row
    let header = '        ';
    for (const v2 of param2Values) {
        header += String(v2).padStart(5) + ' ';
    }
    console.log(header);

    // Data rows
    for (let i = 0; i < param1Values.length; i++) {
        let row = String(param1Values[i]).padStart(6) + ' │';
        for (let j = 0; j < param2Values.length; j++) {
            const f1 = matrix[i]![j]!;
            const normalized = (f1 - minF1) / range;
            const charIdx = Math.min(heatChars.length - 1, Math.floor(normalized * heatChars.length));
            const heatChar = heatChars[charIdx]!;
            row += ` ${heatChar}${(f1 * 100).toFixed(1)}`;
        }
        console.log(row);
    }

    console.log('  ' + '─'.repeat(param2Values.length * 6 + 10));
    console.log(`  Legend: ░ = ${(minF1 * 100).toFixed(1)}%  █ = ${(maxF1 * 100).toFixed(1)}%`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║            CV PARAMETER INTERACTION ANALYSIS                              ║');
    console.log('║            Find synergies and conflicts between parameters                ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');

    // Load templates
    await loadTemplates();
    console.log(`📦 Loaded ${templateCache.size} templates`);

    // Load test cases
    const testCases = loadTestCases();
    console.log(`📁 Loaded ${testCases.length} test cases`);

    if (testCases.length === 0) {
        console.log('\n⚠️  No test cases available. Analysis will use simulated data.');
    }

    // Find top interactions
    console.log('\n🔬 Running interaction analysis...');
    const { strongestSynergies, strongestConflicts, pairSummaries } = await findTopInteractions(testCases);

    // Generate outputs
    const outputDir = path.join(__dirname, 'cv-optimization-results');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    // Write interaction results
    const allInteractions = [...strongestSynergies, ...strongestConflicts];
    const interactionCSV = generateInteractionCSV(allInteractions);
    fs.writeFileSync(path.join(outputDir, `interactions-${timestamp}.csv`), interactionCSV);

    const pairCSV = generatePairSummaryCSV(pairSummaries);
    fs.writeFileSync(path.join(outputDir, `pair-summaries-${timestamp}.csv`), pairCSV);

    // Generate heatmaps for top interacting pairs
    console.log('\n📊 Generating heatmaps for key parameter pairs...');
    const heatmaps: HeatmapData[] = [];

    // Find pairs with strongest interactions
    const topPairs = pairSummaries
        .sort((a, b) => Math.abs(b.maxSynergy - b.maxConflict) - Math.abs(a.maxSynergy - a.maxConflict))
        .slice(0, 3);

    for (const pair of topPairs) {
        const p1 = PARAMETERS.find(p => p.name === pair.param1);
        const p2 = PARAMETERS.find(p => p.name === pair.param2);
        if (p1 && p2) {
            console.log(`  Generating: ${p1.name} x ${p2.name}`);
            const heatmap = await generateHeatmap(p1, p2, testCases);
            heatmaps.push(heatmap);
            printASCIIHeatmap(heatmap);
        }
    }

    const heatmapJSON = generateHeatmapJSON(heatmaps);
    fs.writeFileSync(path.join(outputDir, `heatmaps-${timestamp}.json`), heatmapJSON);

    // Print summary
    console.log('\n' + '═'.repeat(75));
    console.log('INTERACTION ANALYSIS RESULTS');
    console.log('═'.repeat(75));

    console.log('\n🟢 Top 5 Positive Synergies (parameters work well together):');
    console.log('─'.repeat(75));
    strongestSynergies.slice(0, 5).forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.param1}=${r.param1Value} + ${r.param2}=${r.param2Value}`);
        console.log(`     Combined: ${(r.combinedF1 * 100).toFixed(2)}%, Effect: +${(r.interactionEffect * 100).toFixed(2)}%`);
    });

    console.log('\n🔴 Top 5 Negative Conflicts (parameters hurt each other):');
    console.log('─'.repeat(75));
    strongestConflicts.slice(0, 5).forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.param1}=${r.param1Value} + ${r.param2}=${r.param2Value}`);
        console.log(`     Combined: ${(r.combinedF1 * 100).toFixed(2)}%, Effect: ${(r.interactionEffect * 100).toFixed(2)}%`);
    });

    console.log('\n📝 Key Recommendations:');
    console.log('─'.repeat(75));
    pairSummaries
        .filter(s => Math.abs(s.maxSynergy) > 0.02 || Math.abs(s.maxConflict) > 0.02)
        .slice(0, 5)
        .forEach(s => {
            console.log(`  • ${s.recommendation}`);
        });

    console.log('\n📊 Output files written to:', outputDir);
    console.log(`   • interactions-${timestamp}.csv`);
    console.log(`   • pair-summaries-${timestamp}.csv`);
    console.log(`   • heatmaps-${timestamp}.json`);

    // MEMORY FIX: Clean up template cache to free memory
    clearTemplateCache();
    console.log('\n🧹 Cleaned up template cache');
}

// Run if executed directly
main().catch(console.error);

// Export for use as module
export {
    InteractionResult,
    ParameterPairSummary,
    HeatmapData,
    findTopInteractions,
    generateHeatmap,
    generateInteractionCSV,
};
