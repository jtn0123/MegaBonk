#!/usr/bin/env npx tsx
/**
 * Comprehensive Ablation Report Generator
 *
 * Runs full ablation testing suite and generates detailed reports including:
 * - Component impact analysis
 * - CSV export for spreadsheet analysis
 * - Historical comparison (if previous runs exist)
 * - Recommendations for optimal configuration
 * - Component interaction matrix
 *
 * Usage:
 *   npx tsx scripts/ablation-report.ts [options]
 *
 * Options:
 *   --quick, -q       Run quick ablation (6 configs) instead of full (20+ configs)
 *   --verbose, -v     Show detailed output
 *   --compare         Compare with previous run
 *   --output, -o      Output directory (default: test-results/ablation)
 *   --help, -h        Show help
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawn } from 'child_process';

// ========================================
// Types
// ========================================

interface AblationResult {
    configName: string;
    testCase: string;
    f1Score: number;
    precision: number;
    recall: number;
    time: number;
    truePositives: number;
    falsePositives: number;
    falseNegatives: number;
}

interface ConfigSummary {
    name: string;
    avgF1: number;
    avgPrecision: number;
    avgRecall: number;
    avgTime: number;
    minF1: number;
    maxF1: number;
    stdDevF1: number;
    testCount: number;
}

interface ComponentImpact {
    component: string;
    impact: number;  // Negative = helps, positive = hurts
    significance: 'high' | 'medium' | 'low' | 'none';
}

interface HistoricalRun {
    timestamp: string;
    bestF1: number;
    bestConfig: string;
    componentImpacts: ComponentImpact[];
}

// ========================================
// Main Script
// ========================================

class AblationReportGenerator {
    private outputDir: string;
    private verbose: boolean;
    private quick: boolean;
    private compare: boolean;

    constructor(options: { outputDir: string; verbose: boolean; quick: boolean; compare: boolean }) {
        this.outputDir = options.outputDir;
        this.verbose = options.verbose;
        this.quick = options.quick;
        this.compare = options.compare;
    }

    async run(): Promise<void> {
        console.log('🔬 Ablation Testing Report Generator\n');
        console.log(`Mode: ${this.quick ? 'Quick (6 configs)' : 'Full (20+ configs)'}`);
        console.log(`Output: ${this.outputDir}\n`);

        // Ensure output directory exists
        fs.mkdirSync(this.outputDir, { recursive: true });

        // Step 1: Run ablation tests
        console.log('━'.repeat(60));
        console.log('Step 1: Running ablation tests...');
        console.log('━'.repeat(60));

        await this.runAblationTests();

        // Step 2: Load and analyze results
        console.log('\n' + '━'.repeat(60));
        console.log('Step 2: Analyzing results...');
        console.log('━'.repeat(60));

        const results = this.loadResults();
        if (!results || results.length === 0) {
            console.error('❌ No results found. Ablation tests may have failed.');
            process.exit(1);
        }

        // Step 3: Generate reports
        console.log('\n' + '━'.repeat(60));
        console.log('Step 3: Generating reports...');
        console.log('━'.repeat(60));

        const summaries = this.calculateSummaries(results);
        const impacts = this.calculateComponentImpacts(summaries);

        this.generateCSVReport(results, summaries);
        this.generateMarkdownReport(summaries, impacts);
        this.generateJSONReport(summaries, impacts);

        if (this.compare) {
            this.compareWithHistory(summaries, impacts);
        }

        this.saveToHistory(summaries, impacts);

        // Step 4: Print summary
        console.log('\n' + '━'.repeat(60));
        console.log('Summary');
        console.log('━'.repeat(60));
        this.printSummary(summaries, impacts);
    }

    private async runAblationTests(): Promise<void> {
        const runnerPath = path.join(__dirname, '../tests/offline-cv-runner.ts');
        const args = [
            'tsx',
            runnerPath,
            this.quick ? '--ablation-quick' : '--ablation',
            '--output', this.outputDir,
        ];

        if (this.verbose) {
            args.push('--verbose');
        }

        return new Promise((resolve, reject) => {
            console.log(`Running: npx ${args.join(' ')}\n`);

            const proc = spawn('npx', args, {
                stdio: 'inherit',
                cwd: path.join(__dirname, '..'),
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Ablation tests exited with code ${code}`));
                }
            });

            proc.on('error', (err) => {
                reject(err);
            });
        });
    }

    private loadResults(): AblationResult[] {
        const jsonPath = path.join(this.outputDir, 'ablation-results.json');

        if (!fs.existsSync(jsonPath)) {
            console.warn(`⚠️ Results file not found: ${jsonPath}`);
            return [];
        }

        try {
            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

            // Handle both old and new format
            if (Array.isArray(data.results)) {
                return data.results.map((r: any) => ({
                    configName: r.pipelineConfig || r.configName,
                    testCase: r.testCase,
                    f1Score: r.metrics?.f1Score || r.f1Score || 0,
                    precision: r.metrics?.precision || r.precision || 0,
                    recall: r.metrics?.recall || r.recall || 0,
                    time: r.metrics?.totalTime || r.time || 0,
                    truePositives: r.metrics?.truePositives || r.truePositives || 0,
                    falsePositives: r.metrics?.falsePositives || r.falsePositives || 0,
                    falseNegatives: r.metrics?.falseNegatives || r.falseNegatives || 0,
                }));
            }

            return [];
        } catch (error) {
            console.error(`❌ Failed to parse results: ${(error as Error).message}`);
            return [];
        }
    }

    private calculateSummaries(results: AblationResult[]): ConfigSummary[] {
        const byConfig = new Map<string, AblationResult[]>();

        for (const result of results) {
            if (!byConfig.has(result.configName)) {
                byConfig.set(result.configName, []);
            }
            byConfig.get(result.configName)!.push(result);
        }

        const summaries: ConfigSummary[] = [];

        for (const [name, configResults] of byConfig) {
            const f1Scores = configResults.map(r => r.f1Score);
            const avgF1 = f1Scores.reduce((a, b) => a + b, 0) / f1Scores.length;
            const avgPrecision = configResults.reduce((a, b) => a + b.precision, 0) / configResults.length;
            const avgRecall = configResults.reduce((a, b) => a + b.recall, 0) / configResults.length;
            const avgTime = configResults.reduce((a, b) => a + b.time, 0) / configResults.length;

            const minF1 = Math.min(...f1Scores);
            const maxF1 = Math.max(...f1Scores);

            // Standard deviation
            const variance = f1Scores.reduce((sum, f1) => sum + Math.pow(f1 - avgF1, 2), 0) / f1Scores.length;
            const stdDevF1 = Math.sqrt(variance);

            summaries.push({
                name,
                avgF1,
                avgPrecision,
                avgRecall,
                avgTime,
                minF1,
                maxF1,
                stdDevF1,
                testCount: configResults.length,
            });
        }

        // Sort by F1 descending
        summaries.sort((a, b) => b.avgF1 - a.avgF1);

        return summaries;
    }

    private calculateComponentImpacts(summaries: ConfigSummary[]): ComponentImpact[] {
        const baseline = summaries.find(s => s.name === 'baseline-all-on');
        if (!baseline) {
            console.warn('⚠️ No baseline config found for impact analysis');
            return [];
        }

        const impacts: ComponentImpact[] = [];

        for (const summary of summaries) {
            if (summary.name.startsWith('no-')) {
                const component = summary.name.replace('no-', '');
                const impact = summary.avgF1 - baseline.avgF1;

                let significance: 'high' | 'medium' | 'low' | 'none';
                if (Math.abs(impact) > 0.05) {
                    significance = 'high';
                } else if (Math.abs(impact) > 0.02) {
                    significance = 'medium';
                } else if (Math.abs(impact) > 0.005) {
                    significance = 'low';
                } else {
                    significance = 'none';
                }

                impacts.push({ component, impact, significance });
            }
        }

        // Sort by impact (most negative first = most helpful)
        impacts.sort((a, b) => a.impact - b.impact);

        return impacts;
    }

    private generateCSVReport(results: AblationResult[], summaries: ConfigSummary[]): void {
        // Detailed results CSV
        let detailedCSV = 'Config,TestCase,F1,Precision,Recall,Time(ms),TP,FP,FN\n';

        for (const result of results) {
            detailedCSV += `${result.configName},${result.testCase},${result.f1Score.toFixed(4)},${result.precision.toFixed(4)},${result.recall.toFixed(4)},${result.time.toFixed(0)},${result.truePositives},${result.falsePositives},${result.falseNegatives}\n`;
        }

        fs.writeFileSync(path.join(this.outputDir, 'ablation-detailed.csv'), detailedCSV);
        console.log('   ✓ ablation-detailed.csv');

        // Summary CSV
        let summaryCSV = 'Config,AvgF1,AvgPrecision,AvgRecall,AvgTime(ms),MinF1,MaxF1,StdDev,TestCount\n';

        for (const summary of summaries) {
            summaryCSV += `${summary.name},${summary.avgF1.toFixed(4)},${summary.avgPrecision.toFixed(4)},${summary.avgRecall.toFixed(4)},${summary.avgTime.toFixed(0)},${summary.minF1.toFixed(4)},${summary.maxF1.toFixed(4)},${summary.stdDevF1.toFixed(4)},${summary.testCount}\n`;
        }

        fs.writeFileSync(path.join(this.outputDir, 'ablation-summary.csv'), summaryCSV);
        console.log('   ✓ ablation-summary.csv');
    }

    private generateMarkdownReport(summaries: ConfigSummary[], impacts: ComponentImpact[]): void {
        const timestamp = new Date().toISOString();
        const baseline = summaries.find(s => s.name === 'baseline-all-on');
        const baselineF1 = baseline?.avgF1 || 0;

        let md = `# Ablation Test Report

Generated: ${timestamp}
Mode: ${this.quick ? 'Quick' : 'Full'}
Configs tested: ${summaries.length}

## Executive Summary

`;

        const best = summaries[0];
        const worst = summaries[summaries.length - 1];

        md += `| Metric | Value |
|--------|-------|
| Best Config | ${best.name} |
| Best F1 Score | ${(best.avgF1 * 100).toFixed(1)}% |
| Worst Config | ${worst.name} |
| Worst F1 Score | ${(worst.avgF1 * 100).toFixed(1)}% |
| F1 Range | ${((best.avgF1 - worst.avgF1) * 100).toFixed(1)}% |

## Configuration Rankings

| Rank | Config | Avg F1 | Precision | Recall | Time | Δ Baseline |
|------|--------|--------|-----------|--------|------|------------|
`;

        summaries.forEach((s, i) => {
            const delta = s.avgF1 - baselineF1;
            const deltaStr = s.name === 'baseline-all-on' ? '-' :
                (delta >= 0 ? `+${(delta * 100).toFixed(1)}%` : `${(delta * 100).toFixed(1)}%`);

            md += `| ${i + 1} | ${s.name} | ${(s.avgF1 * 100).toFixed(1)}% | ${(s.avgPrecision * 100).toFixed(1)}% | ${(s.avgRecall * 100).toFixed(1)}% | ${s.avgTime.toFixed(0)}ms | ${deltaStr} |\n`;
        });

        md += `
## Component Impact Analysis

Components sorted by their impact when disabled. Negative impact means the component **helps** accuracy.

| Component | Impact | Significance | Recommendation |
|-----------|--------|--------------|----------------|
`;

        for (const impact of impacts) {
            const emoji = impact.impact < -0.01 ? '🟢' : impact.impact > 0.01 ? '🔴' : '⚪';
            const recommendation = impact.impact < -0.02 ? 'KEEP (essential)' :
                impact.impact < 0 ? 'Keep (helpful)' :
                impact.impact > 0.02 ? 'Consider removing' :
                impact.impact > 0 ? 'Optional' : 'Neutral';

            md += `| ${emoji} ${impact.component} | ${(impact.impact * 100).toFixed(2)}% | ${impact.significance} | ${recommendation} |\n`;
        }

        md += `
## Recommendations

### Essential Components (Keep Enabled)
`;

        const essential = impacts.filter(i => i.impact < -0.02);
        if (essential.length > 0) {
            for (const i of essential) {
                md += `- **${i.component}**: Provides ${(Math.abs(i.impact) * 100).toFixed(1)}% F1 improvement\n`;
            }
        } else {
            md += `- No components showed >2% improvement\n`;
        }

        md += `
### Potentially Harmful Components (Consider Disabling)
`;

        const harmful = impacts.filter(i => i.impact > 0.02);
        if (harmful.length > 0) {
            for (const i of harmful) {
                md += `- **${i.component}**: Reduces F1 by ${(i.impact * 100).toFixed(1)}%\n`;
            }
        } else {
            md += `- No components showed >2% degradation\n`;
        }

        md += `
### Optimal Configuration

Based on the analysis, the recommended configuration is:

\`\`\`typescript
const OPTIMAL_CONFIG = {
`;

        // List enabled components
        const enabledComponents = impacts.filter(i => i.impact <= 0).map(i => i.component);
        const disabledComponents = impacts.filter(i => i.impact > 0.02).map(i => i.component);

        for (const comp of enabledComponents) {
            md += `    use${comp.charAt(0).toUpperCase() + comp.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase())}: true,\n`;
        }
        for (const comp of disabledComponents) {
            md += `    use${comp.charAt(0).toUpperCase() + comp.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase())}: false, // hurts by ${(impacts.find(i => i.component === comp)?.impact || 0) * 100}%\n`;
        }

        md += `};
\`\`\`

## Detailed Statistics

| Config | Min F1 | Max F1 | Std Dev | Consistency |
|--------|--------|--------|---------|-------------|
`;

        for (const s of summaries.slice(0, 10)) {
            const consistency = s.stdDevF1 < 0.05 ? '🟢 Good' :
                s.stdDevF1 < 0.1 ? '🟡 Fair' : '🔴 Variable';
            md += `| ${s.name} | ${(s.minF1 * 100).toFixed(1)}% | ${(s.maxF1 * 100).toFixed(1)}% | ${(s.stdDevF1 * 100).toFixed(2)}% | ${consistency} |\n`;
        }

        md += `

---
*Generated by ablation-report.ts*
`;

        fs.writeFileSync(path.join(this.outputDir, 'ablation-analysis.md'), md);
        console.log('   ✓ ablation-analysis.md');
    }

    private generateJSONReport(summaries: ConfigSummary[], impacts: ComponentImpact[]): void {
        const report = {
            timestamp: new Date().toISOString(),
            mode: this.quick ? 'quick' : 'full',
            summaries,
            impacts,
            recommendations: {
                bestConfig: summaries[0]?.name,
                essentialComponents: impacts.filter(i => i.impact < -0.02).map(i => i.component),
                harmfulComponents: impacts.filter(i => i.impact > 0.02).map(i => i.component),
            },
        };

        fs.writeFileSync(
            path.join(this.outputDir, 'ablation-analysis.json'),
            JSON.stringify(report, null, 2)
        );
        console.log('   ✓ ablation-analysis.json');
    }

    private saveToHistory(summaries: ConfigSummary[], impacts: ComponentImpact[]): void {
        const historyPath = path.join(this.outputDir, 'ablation-history.json');

        let history: HistoricalRun[] = [];
        if (fs.existsSync(historyPath)) {
            try {
                history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
            } catch {
                history = [];
            }
        }

        const newRun: HistoricalRun = {
            timestamp: new Date().toISOString(),
            bestF1: summaries[0]?.avgF1 || 0,
            bestConfig: summaries[0]?.name || 'unknown',
            componentImpacts: impacts,
        };

        history.push(newRun);

        // Keep last 20 runs
        if (history.length > 20) {
            history = history.slice(-20);
        }

        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
        console.log('   ✓ ablation-history.json (updated)');
    }

    private compareWithHistory(summaries: ConfigSummary[], impacts: ComponentImpact[]): void {
        const historyPath = path.join(this.outputDir, 'ablation-history.json');

        if (!fs.existsSync(historyPath)) {
            console.log('\n⚠️ No historical data found for comparison');
            return;
        }

        const history: HistoricalRun[] = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));

        if (history.length < 2) {
            console.log('\n⚠️ Not enough historical data for comparison (need at least 2 runs)');
            return;
        }

        const previous = history[history.length - 1];
        const current = {
            bestF1: summaries[0]?.avgF1 || 0,
            bestConfig: summaries[0]?.name || 'unknown',
        };

        console.log('\n📊 Comparison with Previous Run:');
        console.log(`   Previous best: ${previous.bestConfig} (F1: ${(previous.bestF1 * 100).toFixed(1)}%)`);
        console.log(`   Current best:  ${current.bestConfig} (F1: ${(current.bestF1 * 100).toFixed(1)}%)`);

        const delta = current.bestF1 - previous.bestF1;
        const emoji = delta > 0 ? '📈' : delta < 0 ? '📉' : '➡️';
        console.log(`   Change: ${emoji} ${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(2)}%`);
    }

    private printSummary(summaries: ConfigSummary[], impacts: ComponentImpact[]): void {
        const best = summaries[0];
        const worst = summaries[summaries.length - 1];

        console.log(`\n📊 Results:`);
        console.log(`   Best:  ${best.name} (F1: ${(best.avgF1 * 100).toFixed(1)}%)`);
        console.log(`   Worst: ${worst.name} (F1: ${(worst.avgF1 * 100).toFixed(1)}%)`);
        console.log(`   Range: ${((best.avgF1 - worst.avgF1) * 100).toFixed(1)}%`);

        console.log(`\n🎯 Component Impact (when disabled):`);

        for (const impact of impacts.slice(0, 5)) {
            const emoji = impact.impact < -0.01 ? '🟢' : impact.impact > 0.01 ? '🔴' : '⚪';
            const verb = impact.impact < 0 ? 'helps' : impact.impact > 0 ? 'hurts' : 'neutral';
            console.log(`   ${emoji} ${impact.component}: ${verb} by ${(Math.abs(impact.impact) * 100).toFixed(1)}%`);
        }

        console.log(`\n📁 Reports saved to: ${this.outputDir}`);
        console.log(`   - ablation-analysis.md (full report)`);
        console.log(`   - ablation-summary.csv (for spreadsheets)`);
        console.log(`   - ablation-detailed.csv (per-test results)`);
        console.log(`   - ablation-analysis.json (programmatic access)`);
    }
}

// ========================================
// CLI Entry Point
// ========================================

function printHelp(): void {
    console.log(`
Ablation Report Generator

Runs comprehensive ablation testing and generates detailed analysis reports.

Usage:
  npx tsx scripts/ablation-report.ts [options]

Options:
  --quick, -q       Run quick ablation (6 configs) instead of full (20+ configs)
  --verbose, -v     Show detailed output during testing
  --compare, -c     Compare results with previous run
  --output, -o      Output directory (default: test-results/ablation)
  --help, -h        Show this help message

Examples:
  # Run full ablation tests
  npx tsx scripts/ablation-report.ts

  # Run quick ablation with comparison
  npx tsx scripts/ablation-report.ts --quick --compare

  # Run with verbose output to custom directory
  npx tsx scripts/ablation-report.ts -v -o ./my-results

Output Files:
  - ablation-analysis.md    Comprehensive markdown report
  - ablation-summary.csv    Config-level summary for spreadsheets
  - ablation-detailed.csv   Per-test-case results
  - ablation-analysis.json  Programmatic access to results
  - ablation-history.json   Historical run tracking
`);
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);

    let outputDir = path.join(__dirname, '../test-results/ablation');
    let verbose = false;
    let quick = false;
    let compare = false;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--help' || arg === '-h') {
            printHelp();
            process.exit(0);
        } else if (arg === '--quick' || arg === '-q') {
            quick = true;
        } else if (arg === '--verbose' || arg === '-v') {
            verbose = true;
        } else if (arg === '--compare' || arg === '-c') {
            compare = true;
        } else if ((arg === '--output' || arg === '-o') && i + 1 < args.length) {
            outputDir = args[++i];
        }
    }

    const generator = new AblationReportGenerator({
        outputDir,
        verbose,
        quick,
        compare,
    });

    try {
        await generator.run();
        process.exit(0);
    } catch (error) {
        console.error(`\n❌ Error: ${(error as Error).message}`);
        process.exit(1);
    }
}

main();
