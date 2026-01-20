#!/usr/bin/env npx tsx
/**
 * Screenshot Analyzer for MegaBonk CV Training
 *
 * Analyzes downloaded screenshots to determine their usefulness
 * for training the computer vision / OCR model.
 *
 * Usage:
 *   npx tsx scripts/analyze-screenshots.ts [options]
 *
 * Options:
 *   --input <dir>     Input directory (default: test-images/gameplay/steam-scraped)
 *   --output <file>   Output report file (default: test-images/gameplay/steam-scraped/analysis-report.json)
 *   --threshold <n>   Usefulness threshold 0-100 (default: 50)
 *   --move-useful     Move useful images to steam-community folder
 *   --verbose         Show detailed analysis for each image
 */

import * as fs from 'fs';
import * as path from 'path';

// Try to import sharp for image analysis (optional)
let sharp: typeof import('sharp') | null = null;
try {
  sharp = require('sharp');
} catch {
  console.log('Note: sharp not available, using basic file analysis');
}

// Configuration
const DEFAULT_INPUT_DIR = 'test-images/gameplay/steam-scraped';
const DEFAULT_OUTPUT_FILE = 'test-images/gameplay/steam-scraped/analysis-report.json';
const DEFAULT_THRESHOLD = 50;
const STEAM_COMMUNITY_DIR = 'test-images/gameplay/steam-community';

// MegaBonk-specific color signatures (approximate)
const GAME_UI_COLORS = {
  // Dark UI backgrounds
  darkBg: { r: [10, 50], g: [10, 50], b: [15, 60] },
  // Item rarity borders
  common: { r: [150, 200], g: [150, 200], b: [150, 200] },
  uncommon: { r: [50, 150], g: [180, 255], b: [50, 150] },
  rare: { r: [50, 150], g: [100, 200], b: [200, 255] },
  epic: { r: [150, 220], g: [50, 150], b: [200, 255] },
  legendary: { r: [220, 255], g: [150, 220], b: [50, 150] },
};

// Resolution requirements
const MIN_WIDTH = 800;
const MIN_HEIGHT = 600;
const IDEAL_WIDTH = 1920;
const IDEAL_HEIGHT = 1080;

interface AnalyzerOptions {
  inputDir: string;
  outputFile: string;
  threshold: number;
  moveUseful: boolean;
  verbose: boolean;
}

interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
  channels?: number;
}

interface ColorAnalysis {
  dominantColors: Array<{ r: number; g: number; b: number; percentage: number }>;
  hasDarkBackground: boolean;
  hasRarityColors: boolean;
  colorVariety: number;
}

interface AnalysisResult {
  filename: string;
  filepath: string;
  metadata: ImageMetadata;
  scores: {
    resolution: number;
    fileSize: number;
    colorSignature: number;
    aspectRatio: number;
    overall: number;
  };
  classification: 'useful' | 'maybe' | 'not_useful';
  reasons: string[];
  recommendations: string[];
}

interface AnalysisReport {
  _generated: string;
  _inputDir: string;
  _threshold: number;
  summary: {
    total: number;
    useful: number;
    maybe: number;
    notUseful: number;
    avgScore: number;
  };
  results: AnalysisResult[];
}

function parseArgs(): AnalyzerOptions {
  const args = process.argv.slice(2);
  const options: AnalyzerOptions = {
    inputDir: DEFAULT_INPUT_DIR,
    outputFile: DEFAULT_OUTPUT_FILE,
    threshold: DEFAULT_THRESHOLD,
    moveUseful: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--input':
        options.inputDir = args[++i] || DEFAULT_INPUT_DIR;
        break;
      case '--output':
        options.outputFile = args[++i] || DEFAULT_OUTPUT_FILE;
        break;
      case '--threshold':
        options.threshold = parseInt(args[++i], 10) || DEFAULT_THRESHOLD;
        break;
      case '--move-useful':
        options.moveUseful = true;
        break;
      case '--verbose':
        options.verbose = true;
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
Screenshot Analyzer for MegaBonk CV Training

Usage:
  npx tsx scripts/analyze-screenshots.ts [options]

Options:
  --input <dir>     Input directory (default: ${DEFAULT_INPUT_DIR})
  --output <file>   Output report file (default: ${DEFAULT_OUTPUT_FILE})
  --threshold <n>   Usefulness threshold 0-100 (default: ${DEFAULT_THRESHOLD})
  --move-useful     Move useful images to steam-community folder
  --verbose         Show detailed analysis for each image
  --help            Show this help message

Classification:
  - 'useful':      Score >= threshold, good for CV training
  - 'maybe':       Score between threshold-20 and threshold, needs manual review
  - 'not_useful':  Score < threshold-20, likely not suitable for training

Examples:
  # Analyze downloaded screenshots
  npx tsx scripts/analyze-screenshots.ts

  # Analyze with verbose output
  npx tsx scripts/analyze-screenshots.ts --verbose

  # Move useful images to steam-community folder
  npx tsx scripts/analyze-screenshots.ts --move-useful
`);
}

async function getImageMetadata(filepath: string): Promise<ImageMetadata | null> {
  const stats = fs.statSync(filepath);

  if (sharp) {
    try {
      const metadata = await sharp(filepath).metadata();
      return {
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: metadata.format || 'unknown',
        size: stats.size,
        channels: metadata.channels,
      };
    } catch (error) {
      console.error(`Error reading metadata for ${filepath}:`, error);
      return null;
    }
  }

  // Fallback: Basic detection from file header
  try {
    const buffer = Buffer.alloc(24);
    const fd = fs.openSync(filepath, 'r');
    fs.readSync(fd, buffer, 0, 24, 0);
    fs.closeSync(fd);

    let width = 0;
    let height = 0;
    let format = 'unknown';

    // JPEG detection
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      format = 'jpeg';
      // JPEG dimensions require parsing SOF markers - using placeholder
      width = 1920;
      height = 1080;
    }
    // PNG detection
    else if (buffer[0] === 0x89 && buffer[1] === 0x50) {
      format = 'png';
      width = buffer.readUInt32BE(16);
      height = buffer.readUInt32BE(20);
    }

    return { width, height, format, size: stats.size };
  } catch {
    return { width: 0, height: 0, format: 'unknown', size: stats.size };
  }
}

async function analyzeColors(filepath: string): Promise<ColorAnalysis | null> {
  if (!sharp) {
    return null;
  }

  try {
    // Sample the image at a lower resolution for faster analysis
    const { data, info } = await sharp(filepath)
      .resize(100, 100, { fit: 'cover' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = info.width * info.height;
    const colorCounts = new Map<string, number>();

    // Sample pixels
    for (let i = 0; i < data.length; i += 3) {
      const r = Math.floor(data[i] / 32) * 32;
      const g = Math.floor(data[i + 1] / 32) * 32;
      const b = Math.floor(data[i + 2] / 32) * 32;
      const key = `${r},${g},${b}`;
      colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
    }

    // Get dominant colors
    const sortedColors = Array.from(colorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key, count]) => {
        const [r, g, b] = key.split(',').map(Number);
        return { r, g, b, percentage: (count / pixels) * 100 };
      });

    // Check for dark background
    const hasDarkBackground = sortedColors.some(c =>
      c.r < 60 && c.g < 60 && c.b < 70 && c.percentage > 10
    );

    // Check for rarity colors (green, blue, purple, orange/gold)
    const hasRarityColors = sortedColors.some(c => {
      // Green (uncommon)
      if (c.g > 150 && c.r < 150 && c.b < 150) return true;
      // Blue (rare)
      if (c.b > 150 && c.r < 150) return true;
      // Purple (epic)
      if (c.r > 100 && c.b > 150 && c.g < 150) return true;
      // Orange/Gold (legendary)
      if (c.r > 200 && c.g > 100 && c.g < 200 && c.b < 100) return true;
      return false;
    });

    return {
      dominantColors: sortedColors,
      hasDarkBackground,
      hasRarityColors,
      colorVariety: colorCounts.size,
    };
  } catch (error) {
    console.error(`Error analyzing colors for ${filepath}:`, error);
    return null;
  }
}

function calculateScores(
  metadata: ImageMetadata,
  colorAnalysis: ColorAnalysis | null
): AnalysisResult['scores'] {
  const scores = {
    resolution: 0,
    fileSize: 0,
    colorSignature: 0,
    aspectRatio: 0,
    overall: 0,
  };

  // Resolution score (0-100)
  if (metadata.width >= IDEAL_WIDTH && metadata.height >= IDEAL_HEIGHT) {
    scores.resolution = 100;
  } else if (metadata.width >= MIN_WIDTH && metadata.height >= MIN_HEIGHT) {
    const widthRatio = Math.min(metadata.width / IDEAL_WIDTH, 1);
    const heightRatio = Math.min(metadata.height / IDEAL_HEIGHT, 1);
    scores.resolution = Math.round((widthRatio + heightRatio) * 50);
  } else {
    scores.resolution = Math.round(
      (metadata.width / MIN_WIDTH + metadata.height / MIN_HEIGHT) * 25
    );
  }

  // File size score (0-100) - larger files usually mean more detail
  // Ideal: 100KB - 2MB
  const sizeKB = metadata.size / 1024;
  if (sizeKB >= 100 && sizeKB <= 2048) {
    scores.fileSize = 100;
  } else if (sizeKB < 100) {
    scores.fileSize = Math.round((sizeKB / 100) * 80);
  } else {
    scores.fileSize = 90; // Very large files still good
  }

  // Aspect ratio score - 16:9 is ideal, 16:10 also good
  const aspectRatio = metadata.width / metadata.height;
  if (aspectRatio >= 1.7 && aspectRatio <= 1.8) {
    scores.aspectRatio = 100; // 16:9
  } else if (aspectRatio >= 1.5 && aspectRatio <= 1.7) {
    scores.aspectRatio = 90; // 16:10 or similar
  } else if (aspectRatio >= 1.2 && aspectRatio <= 2.0) {
    scores.aspectRatio = 70; // Acceptable
  } else {
    scores.aspectRatio = 30; // Unusual aspect ratio
  }

  // Color signature score
  if (colorAnalysis) {
    let colorScore = 50; // Base score

    if (colorAnalysis.hasDarkBackground) {
      colorScore += 25; // Game UI has dark backgrounds
    }

    if (colorAnalysis.hasRarityColors) {
      colorScore += 25; // Item borders indicate game UI
    }

    // Color variety - too little or too much is bad
    if (colorAnalysis.colorVariety >= 20 && colorAnalysis.colorVariety <= 200) {
      colorScore += 10;
    }

    scores.colorSignature = Math.min(colorScore, 100);
  } else {
    scores.colorSignature = 50; // Unknown
  }

  // Overall score - weighted average
  scores.overall = Math.round(
    scores.resolution * 0.3 +
    scores.fileSize * 0.2 +
    scores.aspectRatio * 0.2 +
    scores.colorSignature * 0.3
  );

  return scores;
}

function classifyResult(
  scores: AnalysisResult['scores'],
  threshold: number
): { classification: AnalysisResult['classification']; reasons: string[]; recommendations: string[] } {
  const reasons: string[] = [];
  const recommendations: string[] = [];

  // Analyze each score component
  if (scores.resolution >= 80) {
    reasons.push('Good resolution for CV training');
  } else if (scores.resolution >= 50) {
    reasons.push('Acceptable resolution');
    recommendations.push('Higher resolution images preferred');
  } else {
    reasons.push('Low resolution may affect recognition accuracy');
    recommendations.push('Consider finding higher resolution source');
  }

  if (scores.colorSignature >= 70) {
    reasons.push('Color profile matches MegaBonk UI');
  } else if (scores.colorSignature >= 50) {
    reasons.push('Color profile partially matches game UI');
  } else {
    reasons.push('Color profile does not match typical game UI');
    recommendations.push('May be a non-gameplay screenshot');
  }

  if (scores.aspectRatio >= 80) {
    reasons.push('Standard gaming aspect ratio');
  } else if (scores.aspectRatio < 50) {
    reasons.push('Unusual aspect ratio - may be cropped');
    recommendations.push('Verify this is a full screenshot');
  }

  // Classification
  let classification: AnalysisResult['classification'];
  if (scores.overall >= threshold) {
    classification = 'useful';
    recommendations.push('Add ground truth labels for CV training');
  } else if (scores.overall >= threshold - 20) {
    classification = 'maybe';
    recommendations.push('Manual review recommended');
  } else {
    classification = 'not_useful';
    recommendations.push('Consider removing from training set');
  }

  return { classification, reasons, recommendations };
}

async function analyzeImage(filepath: string, options: AnalyzerOptions): Promise<AnalysisResult | null> {
  const filename = path.basename(filepath);

  // Get metadata
  const metadata = await getImageMetadata(filepath);
  if (!metadata) {
    return null;
  }

  // Analyze colors
  const colorAnalysis = await analyzeColors(filepath);

  // Calculate scores
  const scores = calculateScores(metadata, colorAnalysis);

  // Classify
  const { classification, reasons, recommendations } = classifyResult(scores, options.threshold);

  return {
    filename,
    filepath,
    metadata,
    scores,
    classification,
    reasons,
    recommendations,
  };
}

async function analyzeScreenshots(options: AnalyzerOptions): Promise<void> {
  console.log('\n========================================');
  console.log('Screenshot Analyzer for MegaBonk CV');
  console.log('========================================\n');

  console.log(`Configuration:`);
  console.log(`  Input: ${options.inputDir}`);
  console.log(`  Output: ${options.outputFile}`);
  console.log(`  Threshold: ${options.threshold}`);
  console.log(`  Move useful: ${options.moveUseful}`);
  console.log(`  Sharp available: ${sharp !== null}`);
  console.log('');

  // Check input directory
  if (!fs.existsSync(options.inputDir)) {
    console.error(`Error: Input directory not found: ${options.inputDir}`);
    console.log('\nRun the scraper first:');
    console.log('  npx tsx scripts/steam-screenshot-scraper.ts');
    process.exit(1);
  }

  // Get image files
  const files = fs.readdirSync(options.inputDir)
    .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
    .map(f => path.join(options.inputDir, f));

  if (files.length === 0) {
    console.log('No image files found in input directory.');
    return;
  }

  console.log(`Found ${files.length} images to analyze...\n`);

  // Analyze each image
  const results: AnalysisResult[] = [];

  for (let i = 0; i < files.length; i++) {
    const filepath = files[i];
    const filename = path.basename(filepath);

    if (options.verbose) {
      console.log(`[${i + 1}/${files.length}] Analyzing: ${filename}`);
    }

    const result = await analyzeImage(filepath, options);
    if (result) {
      results.push(result);

      if (options.verbose) {
        console.log(`    Resolution: ${result.metadata.width}x${result.metadata.height}`);
        console.log(`    Size: ${Math.round(result.metadata.size / 1024)} KB`);
        console.log(`    Scores: res=${result.scores.resolution}, color=${result.scores.colorSignature}, overall=${result.scores.overall}`);
        console.log(`    Classification: ${result.classification.toUpperCase()}`);
        console.log('');
      }
    }
  }

  // Calculate summary
  const summary = {
    total: results.length,
    useful: results.filter(r => r.classification === 'useful').length,
    maybe: results.filter(r => r.classification === 'maybe').length,
    notUseful: results.filter(r => r.classification === 'not_useful').length,
    avgScore: Math.round(results.reduce((sum, r) => sum + r.scores.overall, 0) / results.length),
  };

  // Generate report
  const report: AnalysisReport = {
    _generated: new Date().toISOString(),
    _inputDir: options.inputDir,
    _threshold: options.threshold,
    summary,
    results: results.sort((a, b) => b.scores.overall - a.scores.overall),
  };

  // Save report
  const outputDir = path.dirname(options.outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(options.outputFile, JSON.stringify(report, null, 2));

  // Print summary
  console.log('\n========================================');
  console.log('Analysis Summary');
  console.log('========================================');
  console.log(`  Total images: ${summary.total}`);
  console.log(`  Useful:       ${summary.useful} (${Math.round(summary.useful / summary.total * 100)}%)`);
  console.log(`  Maybe:        ${summary.maybe} (${Math.round(summary.maybe / summary.total * 100)}%)`);
  console.log(`  Not useful:   ${summary.notUseful} (${Math.round(summary.notUseful / summary.total * 100)}%)`);
  console.log(`  Avg score:    ${summary.avgScore}/100`);
  console.log(`\nReport saved to: ${options.outputFile}`);

  // Move useful images if requested
  if (options.moveUseful && summary.useful > 0) {
    console.log('\n========================================');
    console.log('Moving Useful Images');
    console.log('========================================');

    if (!fs.existsSync(STEAM_COMMUNITY_DIR)) {
      fs.mkdirSync(STEAM_COMMUNITY_DIR, { recursive: true });
    }

    const usefulResults = results.filter(r => r.classification === 'useful');
    let moved = 0;

    for (const result of usefulResults) {
      const destPath = path.join(STEAM_COMMUNITY_DIR, result.filename);
      try {
        fs.copyFileSync(result.filepath, destPath);
        console.log(`  Copied: ${result.filename}`);
        moved++;
      } catch (error) {
        console.error(`  Failed to copy ${result.filename}:`, error);
      }
    }

    console.log(`\nCopied ${moved} images to: ${STEAM_COMMUNITY_DIR}`);
  }

  // Show top useful images
  const topUseful = results.filter(r => r.classification === 'useful').slice(0, 5);
  if (topUseful.length > 0) {
    console.log('\n========================================');
    console.log('Top Useful Screenshots');
    console.log('========================================');
    topUseful.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.filename} (score: ${r.scores.overall})`);
      console.log(`     ${r.metadata.width}x${r.metadata.height}, ${Math.round(r.metadata.size / 1024)}KB`);
    });
  }

  // Show images needing review
  const needsReview = results.filter(r => r.classification === 'maybe').slice(0, 5);
  if (needsReview.length > 0) {
    console.log('\n========================================');
    console.log('Screenshots Needing Review');
    console.log('========================================');
    needsReview.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.filename} (score: ${r.scores.overall})`);
      r.recommendations.forEach(rec => console.log(`     - ${rec}`));
    });
  }

  console.log('\nNext steps:');
  console.log('  1. Review the useful screenshots manually');
  console.log('  2. Add ground truth labels to ground-truth.json');
  console.log('  3. Run CV tests: npm run test:cv:offline');
}

// Main entry point
analyzeScreenshots(parseArgs());
