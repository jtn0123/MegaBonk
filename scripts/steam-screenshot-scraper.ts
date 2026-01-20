#!/usr/bin/env npx tsx
/**
 * Steam Screenshot Scraper for MegaBonk
 *
 * Scrapes screenshots from Steam Community for the MegaBonk game
 * and saves them to the test-images directory.
 *
 * Usage:
 *   npx tsx scripts/steam-screenshot-scraper.ts [options]
 *
 * Options:
 *   --limit <n>       Max screenshots to download (default: 50)
 *   --output <dir>    Output directory (default: test-images/gameplay/steam-scraped)
 *   --sort <type>     Sort by: trending, mostrecent, toprated (default: trending)
 *   --skip-existing   Skip already downloaded files
 *   --dry-run         Show what would be downloaded without downloading
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

// Configuration
const STEAM_APP_ID = '3405340'; // MegaBonk
const STEAM_SCREENSHOTS_URL = `https://steamcommunity.com/app/${STEAM_APP_ID}/screenshots/`;
const DEFAULT_OUTPUT_DIR = 'test-images/gameplay/steam-scraped';
const DEFAULT_LIMIT = 50;
const REQUEST_DELAY_MS = 500;

interface ScraperOptions {
  limit: number;
  outputDir: string;
  sortType: 'trending' | 'mostrecent' | 'toprated';
  skipExisting: boolean;
  dryRun: boolean;
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
  error?: string;
}

function parseArgs(): ScraperOptions {
  const args = process.argv.slice(2);
  const options: ScraperOptions = {
    limit: DEFAULT_LIMIT,
    outputDir: DEFAULT_OUTPUT_DIR,
    sortType: 'trending',
    skipExisting: false,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--limit':
        options.limit = parseInt(args[++i], 10) || DEFAULT_LIMIT;
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
  --limit <n>       Max screenshots to download (default: ${DEFAULT_LIMIT})
  --output <dir>    Output directory (default: ${DEFAULT_OUTPUT_DIR})
  --sort <type>     Sort by: trending, mostrecent, toprated (default: trending)
  --skip-existing   Skip already downloaded files
  --dry-run         Show what would be downloaded without downloading
  --help            Show this help message

Examples:
  # Download 20 trending screenshots
  npx tsx scripts/steam-screenshot-scraper.ts --limit 20

  # Download most recent screenshots to custom directory
  npx tsx scripts/steam-screenshot-scraper.ts --sort mostrecent --output ./my-screenshots

  # See what would be downloaded
  npx tsx scripts/steam-screenshot-scraper.ts --dry-run
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
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    };

    const req = protocol.get(url, options, (res) => {
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
      res.on('data', chunk => data += chunk);
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
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      }
    };

    const req = protocol.get(url, options, (res) => {
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

      fileStream.on('error', (err) => {
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

function extractScreenshotsFromHtml(html: string): ScreenshotInfo[] {
  const screenshots: ScreenshotInfo[] = [];

  // Pattern to match screenshot detail links and thumbnails
  // Steam uses various patterns for screenshot URLs

  // Look for screenshot file IDs in the HTML
  // Pattern: https://steamuserimages-a.akamaihd.net/ugc/ID/HASH/
  // or: https://images.steamusercontent.com/ugc/ID/HASH/
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

  // Also try to extract author names from nearby context
  // This is a best-effort extraction
  const authorPattern = /class="apphub_CardAuthor"[^>]*>([^<]+)</gi;
  const authors: string[] = [];
  while ((match = authorPattern.exec(html)) !== null) {
    authors.push(match[1].trim());
  }

  // Try to match authors to screenshots (approximate)
  screenshots.forEach((ss, i) => {
    if (authors[i]) {
      ss.author = authors[i];
    }
  });

  return screenshots;
}

async function fetchScreenshotsList(options: ScraperOptions): Promise<ScreenshotInfo[]> {
  const sortParam = {
    'trending': 'trend',
    'mostrecent': 'newestfirst',
    'toprated': 'score',
  }[options.sortType];

  const url = `${STEAM_SCREENSHOTS_URL}?p=1&browsefilter=${sortParam}`;

  console.log(`Fetching screenshots list from: ${url}`);

  try {
    const html = await fetchUrl(url);
    const screenshots = extractScreenshotsFromHtml(html);

    console.log(`Found ${screenshots.length} screenshots on page`);

    // Limit to requested amount
    return screenshots.slice(0, options.limit);
  } catch (error) {
    console.error('Error fetching screenshots list:', error);
    return [];
  }
}

async function scrapeScreenshots(options: ScraperOptions): Promise<DownloadResult[]> {
  console.log('\n========================================');
  console.log('Steam Screenshot Scraper for MegaBonk');
  console.log('========================================\n');

  console.log(`Configuration:`);
  console.log(`  App ID: ${STEAM_APP_ID}`);
  console.log(`  Limit: ${options.limit}`);
  console.log(`  Output: ${options.outputDir}`);
  console.log(`  Sort: ${options.sortType}`);
  console.log(`  Skip existing: ${options.skipExisting}`);
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

  for (let i = 0; i < screenshots.length; i++) {
    const ss = screenshots[i];
    const filename = `steam_${ss.id.substring(0, 20)}.jpg`;
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
      if (ss.author) console.log(`    Author: ${ss.author}`);
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

      console.log(`    ✓ Saved (${Math.round(stats.size / 1024)} KB)`);
      downloaded++;
      results.push({ success: true, filename });

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

  // Summary
  console.log('\n========================================');
  console.log('Summary');
  console.log('========================================');
  console.log(`  Downloaded: ${downloaded}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total: ${screenshots.length}`);

  if (!options.dryRun && downloaded > 0) {
    console.log(`\nScreenshots saved to: ${options.outputDir}`);
    console.log('\nNext steps:');
    console.log('  1. Run the analyzer: npx tsx scripts/analyze-screenshots.ts');
    console.log('  2. Review useful screenshots and add ground truth labels');
  }

  return results;
}

// Create a manifest file with download metadata
async function writeManifest(
  options: ScraperOptions,
  results: DownloadResult[],
  screenshots: ScreenshotInfo[]
): Promise<void> {
  const manifestPath = path.join(options.outputDir, 'scrape-manifest.json');

  const manifest = {
    _generated: new Date().toISOString(),
    _source: `Steam Community Screenshots - App ${STEAM_APP_ID}`,
    _sort: options.sortType,
    screenshots: screenshots.map((ss, i) => ({
      id: ss.id,
      filename: results[i]?.filename || `steam_${ss.id.substring(0, 20)}.jpg`,
      sourceUrl: ss.fullUrl,
      author: ss.author || 'unknown',
      downloadStatus: results[i]?.success ? 'success' : (results[i]?.error || 'unknown'),
    })),
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest saved to: ${manifestPath}`);
}

// Main entry point
async function main(): Promise<void> {
  const options = parseArgs();

  try {
    const results = await scrapeScreenshots(options);

    if (!options.dryRun && results.length > 0) {
      // Note: We can't write manifest without the original screenshots array
      // This would need the function to return both
      console.log('\nScraping complete!');
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
