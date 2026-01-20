#!/usr/bin/env npx tsx
/**
 * Steam Screenshot Pipeline for MegaBonk CV Training
 *
 * Complete pipeline that:
 * 1. Scrapes screenshots from Steam Community
 * 2. Analyzes them for training usefulness
 * 3. Generates ground truth templates
 * 4. Organizes files for CV training
 *
 * Usage:
 *   npx tsx scripts/steam-screenshot-pipeline.ts [options]
 *
 * Options:
 *   --limit <n>         Max screenshots to download (default: 30)
 *   --sort <type>       Sort by: trending, mostrecent, toprated (default: trending)
 *   --threshold <n>     Usefulness threshold 0-100 (default: 50)
 *   --auto-organize     Automatically move useful images
 *   --generate-labels   Generate ground truth template file
 *   --skip-scrape       Skip scraping, only analyze existing files
 *   --skip-analyze      Skip analysis, only scrape
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

// Configuration
const SCRAPER_SCRIPT = 'scripts/steam-screenshot-scraper.ts';
const ANALYZER_SCRIPT = 'scripts/analyze-screenshots.ts';
const SCRAPED_DIR = 'test-images/gameplay/steam-scraped';
const COMMUNITY_DIR = 'test-images/gameplay/steam-community';
const GROUND_TRUTH_FILE = 'test-images/gameplay/ground-truth.json';

interface PipelineOptions {
  limit: number;
  sortType: string;
  threshold: number;
  autoOrganize: boolean;
  generateLabels: boolean;
  skipScrape: boolean;
  skipAnalyze: boolean;
}

function parseArgs(): PipelineOptions {
  const args = process.argv.slice(2);
  const options: PipelineOptions = {
    limit: 30,
    sortType: 'trending',
    threshold: 50,
    autoOrganize: false,
    generateLabels: false,
    skipScrape: false,
    skipAnalyze: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--limit':
        options.limit = parseInt(args[++i], 10) || 30;
        break;
      case '--sort':
        options.sortType = args[++i] || 'trending';
        break;
      case '--threshold':
        options.threshold = parseInt(args[++i], 10) || 50;
        break;
      case '--auto-organize':
        options.autoOrganize = true;
        break;
      case '--generate-labels':
        options.generateLabels = true;
        break;
      case '--skip-scrape':
        options.skipScrape = true;
        break;
      case '--skip-analyze':
        options.skipAnalyze = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
Steam Screenshot Pipeline for MegaBonk CV Training

Usage:
  npx tsx scripts/steam-screenshot-pipeline.ts [options]

Options:
  --limit <n>         Max screenshots to download (default: 30)
  --sort <type>       Sort by: trending, mostrecent, toprated (default: trending)
  --threshold <n>     Usefulness threshold 0-100 (default: 50)
  --auto-organize     Automatically move useful images to steam-community
  --generate-labels   Generate ground truth template file for labeling
  --skip-scrape       Skip scraping, only analyze existing files
  --skip-analyze      Skip analysis, only scrape
  --help              Show this help message

Pipeline Steps:
  1. Scrape: Download screenshots from Steam Community
  2. Analyze: Score each screenshot for CV training usefulness
  3. Organize: Move useful screenshots to steam-community folder
  4. Labels: Generate ground truth template for manual labeling

Examples:
  # Run full pipeline with 50 screenshots
  npx tsx scripts/steam-screenshot-pipeline.ts --limit 50 --auto-organize

  # Only analyze existing scraped images
  npx tsx scripts/steam-screenshot-pipeline.ts --skip-scrape --generate-labels

  # Scrape most recent screenshots
  npx tsx scripts/steam-screenshot-pipeline.ts --sort mostrecent --limit 20
`);
}

function runScript(script: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['tsx', script, ...args], {
      stdio: 'inherit',
      cwd: process.cwd(),
    });

    child.on('close', (code) => {
      resolve(code || 0);
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

interface AnalysisReport {
  summary: {
    total: number;
    useful: number;
    maybe: number;
    notUseful: number;
  };
  results: Array<{
    filename: string;
    classification: string;
    metadata: {
      width: number;
      height: number;
    };
  }>;
}

function generateGroundTruthTemplate(options: PipelineOptions): void {
  console.log('\n========================================');
  console.log('Generating Ground Truth Template');
  console.log('========================================\n');

  const reportPath = path.join(SCRAPED_DIR, 'analysis-report.json');
  if (!fs.existsSync(reportPath)) {
    console.log('No analysis report found. Run the analyzer first.');
    return;
  }

  const report: AnalysisReport = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
  const usefulImages = report.results.filter(r => r.classification === 'useful' || r.classification === 'maybe');

  if (usefulImages.length === 0) {
    console.log('No useful images found to generate labels for.');
    return;
  }

  // Load existing ground truth
  let groundTruth: Record<string, unknown> = {};
  if (fs.existsSync(GROUND_TRUTH_FILE)) {
    groundTruth = JSON.parse(fs.readFileSync(GROUND_TRUTH_FILE, 'utf-8'));
  }

  // Generate template entries for new images
  const templateEntries: Record<string, unknown> = {};
  let newCount = 0;

  for (const img of usefulImages) {
    // Use the path relative to ground-truth.json location
    const relativePath = `steam-community/${img.filename}`;

    // Skip if already exists
    if (groundTruth[relativePath]) {
      continue;
    }

    templateEntries[relativePath] = {
      character: 'TODO',
      level: 0,
      resolution: `${img.metadata.width}x${img.metadata.height}`,
      biome: 'TODO',
      ui_state: 'gameplay',
      items: ['TODO: List all visible items'],
      equipped_weapons: ['TODO: List equipped weapons with levels'],
      equipped_tomes: ['TODO: List equipped tomes with levels'],
      notes: `Scraped from Steam Community. Classification: ${img.classification}`,
      difficulty: 'TODO',
      _needs_labeling: true,
    };
    newCount++;
  }

  if (newCount === 0) {
    console.log('All images already have ground truth entries.');
    return;
  }

  // Write template file
  const templatePath = path.join(SCRAPED_DIR, 'ground-truth-template.json');
  const template = {
    _instructions: 'Copy entries from this file to ground-truth.json after filling in the labels',
    _generated: new Date().toISOString(),
    _count: newCount,
    entries: templateEntries,
  };

  fs.writeFileSync(templatePath, JSON.stringify(template, null, 2));
  console.log(`Generated template with ${newCount} new entries`);
  console.log(`Template saved to: ${templatePath}`);
  console.log('\nNext steps:');
  console.log('  1. Open each image and identify items, weapons, tomes, etc.');
  console.log('  2. Fill in the TODO fields in the template');
  console.log('  3. Copy completed entries to ground-truth.json');
  console.log('  4. Remove the _needs_labeling field');
}

function printSummary(options: PipelineOptions): void {
  console.log('\n========================================');
  console.log('Pipeline Summary');
  console.log('========================================\n');

  // Count files
  const scrapedCount = fs.existsSync(SCRAPED_DIR)
    ? fs.readdirSync(SCRAPED_DIR).filter(f => /\.(jpg|jpeg|png)$/i.test(f)).length
    : 0;

  const communityCount = fs.existsSync(COMMUNITY_DIR)
    ? fs.readdirSync(COMMUNITY_DIR).filter(f => /\.(jpg|jpeg|png)$/i.test(f)).length
    : 0;

  // Load ground truth count
  let groundTruthCount = 0;
  if (fs.existsSync(GROUND_TRUTH_FILE)) {
    const gt = JSON.parse(fs.readFileSync(GROUND_TRUTH_FILE, 'utf-8'));
    groundTruthCount = Object.keys(gt).filter(k => !k.startsWith('_')).length;
  }

  console.log(`Files in ${SCRAPED_DIR}: ${scrapedCount}`);
  console.log(`Files in ${COMMUNITY_DIR}: ${communityCount}`);
  console.log(`Ground truth entries: ${groundTruthCount}`);

  // Load and show analysis report summary if exists
  const reportPath = path.join(SCRAPED_DIR, 'analysis-report.json');
  if (fs.existsSync(reportPath)) {
    const report: AnalysisReport = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    console.log('\nAnalysis Results:');
    console.log(`  Useful:     ${report.summary.useful}`);
    console.log(`  Maybe:      ${report.summary.maybe}`);
    console.log(`  Not useful: ${report.summary.notUseful}`);
  }

  console.log('\nNext Steps:');
  console.log('  - Review images in steam-scraped/ and steam-community/');
  console.log('  - Add ground truth labels for useful images');
  console.log('  - Run CV tests: npm run test:cv:offline');
}

async function runPipeline(options: PipelineOptions): Promise<void> {
  console.log('========================================');
  console.log('Steam Screenshot Pipeline');
  console.log('========================================\n');

  console.log('Configuration:');
  console.log(`  Limit: ${options.limit}`);
  console.log(`  Sort: ${options.sortType}`);
  console.log(`  Threshold: ${options.threshold}`);
  console.log(`  Auto-organize: ${options.autoOrganize}`);
  console.log(`  Generate labels: ${options.generateLabels}`);
  console.log('');

  // Step 1: Scrape
  if (!options.skipScrape) {
    console.log('\n========================================');
    console.log('Step 1: Scraping Screenshots');
    console.log('========================================\n');

    const scrapeArgs = [
      '--limit', String(options.limit),
      '--sort', options.sortType,
      '--skip-existing',
    ];

    const scrapeCode = await runScript(SCRAPER_SCRIPT, scrapeArgs);
    if (scrapeCode !== 0) {
      console.error('Scraping failed with code:', scrapeCode);
      // Continue anyway to analyze what we have
    }
  } else {
    console.log('\nSkipping scrape step (--skip-scrape)');
  }

  // Step 2: Analyze
  if (!options.skipAnalyze) {
    console.log('\n========================================');
    console.log('Step 2: Analyzing Screenshots');
    console.log('========================================\n');

    const analyzeArgs = [
      '--threshold', String(options.threshold),
      '--verbose',
    ];

    if (options.autoOrganize) {
      analyzeArgs.push('--move-useful');
    }

    const analyzeCode = await runScript(ANALYZER_SCRIPT, analyzeArgs);
    if (analyzeCode !== 0) {
      console.error('Analysis failed with code:', analyzeCode);
    }
  } else {
    console.log('\nSkipping analyze step (--skip-analyze)');
  }

  // Step 3: Generate labels
  if (options.generateLabels) {
    generateGroundTruthTemplate(options);
  }

  // Print final summary
  printSummary(options);
}

// Main entry point
runPipeline(parseArgs()).catch(err => {
  console.error('Pipeline error:', err);
  process.exit(1);
});
