#!/usr/bin/env npx tsx
/**
 * Steam Screenshot Scraper for MegaBonk
 *
 * Scrapes screenshots from Steam Community for the MegaBonk game
 * and saves them to the test-images directory with auto-generated
 * ground-truth stubs including resolution detection.
 *
 * Usage:
 *   npx tsx scripts/steam-screenshot-scraper.ts [options]
 *
 * Options:
 *   --limit <n>       Max screenshots to download (default: 50)
 *   --pages <n>       Number of pages to scrape (default: 3)
 *   --output <dir>    Output directory (default: test-images/gameplay/steam-community)
 *   --sort <type>     Sort by: trending, mostrecent, toprated (default: mostrecent)
 *   --skip-existing   Skip already downloaded files
 *   --dry-run         Show what would be downloaded without downloading
 *   --prioritize-rare Prioritize uncommon resolutions (1600x900, 1366x768, etc.)
 *   --generate-stubs  Generate ground-truth stub entries for new images
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { execSync } from 'child_process';

// Configuration
const STEAM_APP_ID = '3405340'; // MegaBonk
const STEAM_SCREENSHOTS_URL = `https://steamcommunity.com/app/${STEAM_APP_ID}/screenshots/`;
const DEFAULT_OUTPUT_DIR = 'test-images/gameplay/steam-community';
const DEFAULT_LIMIT = 50;
const DEFAULT_PAGES = 3;
const REQUEST_DELAY_MS = 800;
const GROUND_TRUTH_PATH = 'test-images/gameplay/ground-truth.json';

// Common resolutions - mark which ones we want more of
const RARE_RESOLUTIONS = new Set([
  '1600x900',
  '1280x800',
  '1366x768',
  '1440x900',
  '1536x864',
  '3840x2160',
  '2560x1080',
  '3440x1440',
  '1680x1050',
  '1920x1200',
]);

interface ScraperOptions {
  limit: number;
  pages: number;
  outputDir: string;
  sortType: 'trending' | 'mostrecent' | 'toprated';
  skipExisting: boolean;
  dryRun: boolean;
  prioritizeRare: boolean;
  generateStubs: boolean;
}

interface ScreenshotInfo {
  id: string;
  thumbnailUrl: string;
  fullUrl: string;
  author?: string;
  awards?: number;
  dateUploaded?: string;
}

interface DownloadResult {
  success: boolean;
  filename: string;
  filepath?: string;
  width?: number;
  height?: number;
  resolution?: string;
  error?: string;
}

interface GroundTruthEntry {
  character: string;
  level: number;
  resolution: string;
  biome?: string;
  ui_state?: string;
  items: string[];
  equipped_weapons?: string[];
  equipped_tomes?: string[];
  notes: string;
  difficulty: string;
  _auto_generated?: boolean;
  _needs_labeling?: boolean;
}

function parseArgs(): ScraperOptions {
  const args = process.argv.slice(2);
  const options: ScraperOptions = {
    limit: DEFAULT_LIMIT,
    pages: DEFAULT_PAGES,
    outputDir: DEFAULT_OUTPUT_DIR,
    sortType: 'mostrecent',
    skipExisting: false,
    dryRun: false,
    prioritizeRare: false,
    generateStubs: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--limit':
        options.limit = parseInt(args[++i], 10) || DEFAULT_LIMIT;
        break;
      case '--pages':
        options.pages = parseInt(args[++i], 10) || DEFAULT_PAGES;
        break;
      case '--output':
        options.outputDir = args[++i] || DEFAULT_OUTPUT_DIR;
        break;
      case '--sort':
        const sort = args[++i] as ScraperOptions['sortType'];
        if (['trending', 'mostrecent', 'toprated'].includes(sort)) {
          options.sortType = sort;
        }
        break;
      case '--skip-existing':
        options.skipExisting = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--prioritize-rare':
        options.prioritizeRare = true;
        break;
      case '--generate-stubs':
        options.generateStubs = true;
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
Steam Screenshot Scraper for MegaBonk

Usage:
  npx tsx scripts/steam-screenshot-scraper.ts [options]

Options:
  --limit <n>        Max screenshots to download (default: ${DEFAULT_LIMIT})
  --pages <n>        Number of pages to scrape (default: ${DEFAULT_PAGES})
  --output <dir>     Output directory (default: ${DEFAULT_OUTPUT_DIR})
  --sort <type>      Sort by: trending, mostrecent, toprated (default: mostrecent)
  --skip-existing    Skip already downloaded files
  --dry-run          Show what would be downloaded without downloading
  --prioritize-rare  Prioritize uncommon resolutions (1600x900, 1366x768, 4K, etc.)
  --generate-stubs   Generate ground-truth stub entries for new images
  --help             Show this help message

Examples:
  # Download 30 recent screenshots with stubs
  npx tsx scripts/steam-screenshot-scraper.ts --limit 30 --generate-stubs

  # Focus on rare resolutions
  npx tsx scripts/steam-screenshot-scraper.ts --prioritize-rare --generate-stubs

  # Scrape 5 pages worth of screenshots
  npx tsx scripts/steam-screenshot-scraper.ts --pages 5 --limit 100
`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 MegaBonkGuide/1.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    };

    const req = protocol.get(url, options, res => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirectUrl = res.headers.location;
        if (redirectUrl) {
          fetchUrl(redirectUrl).then(resolve).catch(reject);
          return;
        }
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function downloadImage(url: string, filepath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 MegaBonkGuide/1.0',
        Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
    };

    const req = protocol.get(url, options, res => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirectUrl = res.headers.location;
        if (redirectUrl) {
          downloadImage(redirectUrl, filepath).then(resolve).catch(reject);
          return;
        }
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      const dir = path.dirname(filepath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const fileStream = fs.createWriteStream(filepath);
      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });

      fileStream.on('error', err => {
        fs.unlink(filepath, () => {}); // Clean up partial file
        reject(err);
      });
    });

    req.on('error', reject);
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('Download timeout'));
    });
  });
}

/**
 * Get image dimensions using sips (macOS) or file command
 */
function getImageDimensions(filepath: string): { width: number; height: number } | null {
  try {
    // Try sips first (macOS)
    const output = execSync(`sips -g pixelWidth -g pixelHeight "${filepath}" 2>/dev/null`, {
      encoding: 'utf8',
    });
    const widthMatch = output.match(/pixelWidth:\s*(\d+)/);
    const heightMatch = output.match(/pixelHeight:\s*(\d+)/);
    if (widthMatch && heightMatch) {
      return {
        width: parseInt(widthMatch[1], 10),
        height: parseInt(heightMatch[1], 10),
      };
    }
  } catch {
    // Try file command as fallback
    try {
      const output = execSync(`file "${filepath}"`, { encoding: 'utf8' });
      const match = output.match(/(\d+)\s*x\s*(\d+)/);
      if (match) {
        return {
          width: parseInt(match[1], 10),
          height: parseInt(match[2], 10),
        };
      }
    } catch {
      // Ignore
    }
  }
  return null;
}

function extractScreenshotsFromHtml(html: string): ScreenshotInfo[] {
  const screenshots: ScreenshotInfo[] = [];

  // Pattern to match screenshot file IDs in the HTML
  // Steam uses various patterns for screenshot URLs
  const fileIdPattern = /steamuserimages-a\.akamaihd\.net\/ugc\/(\d+)\/([A-F0-9]+)/gi;
  const altPattern = /images\.steamusercontent\.com\/ugc\/(\d+)\/([A-F0-9]+)/gi;

  const seen = new Set<string>();

  // Extract from both patterns
  let match;
  while ((match = fileIdPattern.exec(html)) !== null) {
    const id = `${match[1]}_${match[2]}`;
    if (!seen.has(id)) {
      seen.add(id);
      const fullUrl = `https://steamuserimages-a.akamaihd.net/ugc/${match[1]}/${match[2]}/`;
      screenshots.push({
        id,
        thumbnailUrl: fullUrl,
        fullUrl: fullUrl,
      });
    }
  }

  while ((match = altPattern.exec(html)) !== null) {
    const id = `${match[1]}_${match[2]}`;
    if (!seen.has(id)) {
      seen.add(id);
      const fullUrl = `https://images.steamusercontent.com/ugc/${match[1]}/${match[2]}/`;
      screenshots.push({
        id,
        thumbnailUrl: fullUrl,
        fullUrl: fullUrl,
      });
    }
  }

  return screenshots;
}

async function fetchScreenshotsList(options: ScraperOptions): Promise<ScreenshotInfo[]> {
  const sortParam = {
    trending: 'trend',
    mostrecent: 'newestfirst',
    toprated: 'score',
  }[options.sortType];

  const allScreenshots: ScreenshotInfo[] = [];
  const seenIds = new Set<string>();

  for (let page = 1; page <= options.pages; page++) {
    const url = `${STEAM_SCREENSHOTS_URL}?p=${page}&browsefilter=${sortParam}`;
    console.log(`Fetching page ${page}/${options.pages}: ${url}`);

    try {
      const html = await fetchUrl(url);
      const pageScreenshots = extractScreenshotsFromHtml(html);

      let newCount = 0;
      for (const ss of pageScreenshots) {
        if (!seenIds.has(ss.id)) {
          seenIds.add(ss.id);
          allScreenshots.push(ss);
          newCount++;
        }
      }

      console.log(`  Found ${pageScreenshots.length} screenshots (${newCount} new)`);

      if (allScreenshots.length >= options.limit) {
        console.log(`  Reached limit of ${options.limit}`);
        break;
      }

      // Rate limit between pages
      if (page < options.pages) {
        await sleep(REQUEST_DELAY_MS);
      }
    } catch (error) {
      console.error(`  Error fetching page ${page}:`, error);
    }
  }

  console.log(`\nTotal unique screenshots found: ${allScreenshots.length}`);
  return allScreenshots.slice(0, options.limit);
}

/**
 * Guess the biome from filename or leave as unknown
 */
function guessBiome(_filename: string): string | undefined {
  return undefined; // Can't really guess from Steam screenshots
}

/**
 * Guess difficulty based on resolution
 */
function guessDifficulty(resolution: string): string {
  const [w, h] = resolution.split('x').map(Number);
  const pixels = w * h;

  if (pixels > 3000000) return 'hard'; // 1440p+
  if (pixels > 2000000) return 'medium'; // 1080p
  return 'easy'; // 720p and below
}

/**
 * Generate a ground-truth stub entry for a downloaded image
 */
function generateGroundTruthStub(result: DownloadResult): GroundTruthEntry {
  const resolution = result.resolution || 'unknown';

  return {
    character: 'Unknown',
    level: 0,
    resolution: resolution,
    items: [],
    notes: `AUTO-GENERATED: Scraped from Steam Community. Resolution ${resolution}. Needs manual labeling.`,
    difficulty: guessDifficulty(resolution),
    _auto_generated: true,
    _needs_labeling: true,
  };
}

/**
 * Load existing ground-truth data
 */
function loadGroundTruth(): Record<string, unknown> {
  try {
    const content = fs.readFileSync(GROUND_TRUTH_PATH, 'utf8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

/**
 * Save updated ground-truth data
 */
function saveGroundTruth(data: Record<string, unknown>): void {
  fs.writeFileSync(GROUND_TRUTH_PATH, JSON.stringify(data, null, 2) + '\n');
}

async function scrapeScreenshots(options: ScraperOptions): Promise<DownloadResult[]> {
  console.log('\n========================================');
  console.log('Steam Screenshot Scraper for MegaBonk');
  console.log('========================================\n');

  console.log(`Configuration:`);
  console.log(`  App ID: ${STEAM_APP_ID}`);
  console.log(`  Limit: ${options.limit}`);
  console.log(`  Pages: ${options.pages}`);
  console.log(`  Output: ${options.outputDir}`);
  console.log(`  Sort: ${options.sortType}`);
  console.log(`  Skip existing: ${options.skipExisting}`);
  console.log(`  Prioritize rare: ${options.prioritizeRare}`);
  console.log(`  Generate stubs: ${options.generateStubs}`);
  console.log(`  Dry run: ${options.dryRun}`);
  console.log('');

  // Ensure output directory exists
  if (!options.dryRun) {
    if (!fs.existsSync(options.outputDir)) {
      fs.mkdirSync(options.outputDir, { recursive: true });
      console.log(`Created output directory: ${options.outputDir}`);
    }
  }

  // Get existing files if skip-existing is enabled
  const existingFiles = new Set<string>();
  if (options.skipExisting && fs.existsSync(options.outputDir)) {
    fs.readdirSync(options.outputDir).forEach(file => {
      existingFiles.add(path.parse(file).name);
    });
    console.log(`Found ${existingFiles.size} existing files`);
  }

  // Load existing ground truth
  const groundTruth = options.generateStubs ? loadGroundTruth() : {};

  // Fetch screenshots list
  const screenshots = await fetchScreenshotsList(options);

  if (screenshots.length === 0) {
    console.log('\nNo screenshots found. This may be due to:');
    console.log('  - Steam API rate limiting');
    console.log('  - Network issues');
    console.log('  - Page structure changes');
    return [];
  }

  console.log(`\nPreparing to download ${screenshots.length} screenshots...\n`);

  const results: DownloadResult[] = [];
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  const resolutionCounts: Record<string, number> = {};

  for (let i = 0; i < screenshots.length; i++) {
    const ss = screenshots[i];
    const filename = `steam_${ss.id.substring(0, 24)}.jpg`;
    const filepath = path.join(options.outputDir, filename);

    // Check if should skip
    const baseFilename = path.parse(filename).name;
    if (options.skipExisting && existingFiles.has(baseFilename)) {
      console.log(`[${i + 1}/${screenshots.length}] SKIP: ${filename} (already exists)`);
      skipped++;
      results.push({ success: true, filename, error: 'skipped' });
      continue;
    }

    if (options.dryRun) {
      console.log(`[${i + 1}/${screenshots.length}] WOULD DOWNLOAD: ${filename}`);
      console.log(`    URL: ${ss.fullUrl}`);
      results.push({ success: true, filename });
      continue;
    }

    // Download the screenshot
    try {
      console.log(`[${i + 1}/${screenshots.length}] Downloading: ${filename}`);
      await downloadImage(ss.fullUrl, filepath);

      // Verify file was created and has content
      const stats = fs.statSync(filepath);
      if (stats.size < 1000) {
        throw new Error(`File too small (${stats.size} bytes)`);
      }

      // Get image dimensions
      const dims = getImageDimensions(filepath);
      const result: DownloadResult = {
        success: true,
        filename,
        filepath,
      };

      if (dims) {
        result.width = dims.width;
        result.height = dims.height;
        result.resolution = `${dims.width}x${dims.height}`;
        resolutionCounts[result.resolution] = (resolutionCounts[result.resolution] || 0) + 1;

        const isRare = RARE_RESOLUTIONS.has(result.resolution);
        console.log(
          `    ✓ Saved (${Math.round(stats.size / 1024)} KB, ${result.resolution})${isRare ? ' ★ RARE' : ''}`
        );
      } else {
        console.log(`    ✓ Saved (${Math.round(stats.size / 1024)} KB, resolution unknown)`);
      }

      downloaded++;
      results.push(result);

      // Generate ground truth stub if requested
      if (options.generateStubs && result.resolution) {
        const gtKey = `steam-community/${filename}`;
        if (!groundTruth[gtKey]) {
          groundTruth[gtKey] = generateGroundTruthStub(result);
          console.log(`    📝 Generated ground-truth stub`);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`    ✗ Failed: ${errorMsg}`);
      failed++;
      results.push({ success: false, filename, error: errorMsg });
    }

    // Rate limiting
    if (i < screenshots.length - 1) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  // Save updated ground truth
  if (options.generateStubs && !options.dryRun) {
    saveGroundTruth(groundTruth);
    console.log(`\nUpdated ground-truth.json with new stubs`);
  }

  // Summary
  console.log('\n========================================');
  console.log('Summary');
  console.log('========================================');
  console.log(`  Downloaded: ${downloaded}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total: ${screenshots.length}`);

  if (Object.keys(resolutionCounts).length > 0) {
    console.log('\n  Resolutions downloaded:');
    const sorted = Object.entries(resolutionCounts).sort((a, b) => b[1] - a[1]);
    for (const [res, count] of sorted) {
      const isRare = RARE_RESOLUTIONS.has(res);
      console.log(`    ${res}: ${count}${isRare ? ' ★' : ''}`);
    }
  }

  if (!options.dryRun && downloaded > 0) {
    console.log(`\nScreenshots saved to: ${options.outputDir}`);
    console.log('\nNext steps:');
    console.log('  1. Open cv-validator.html and label the new images');
    console.log('  2. Or run: npx tsx scripts/analyze-screenshots.ts');
  }

  return results;
}

// Main entry point
async function main(): Promise<void> {
  const options = parseArgs();

  try {
    await scrapeScreenshots(options);
    console.log('\nScraping complete!');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
