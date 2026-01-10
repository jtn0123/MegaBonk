#!/usr/bin/env node
/**
 * Convert PNG/JPG images to WebP format for better performance
 * Keeps original images as fallbacks
 *
 * Usage: node scripts/convert-to-webp.js
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
    sharp = require('sharp');
} catch {
    console.error('❌ Sharp is not installed. Install it with: bun add -d sharp');
    process.exit(1);
}

const IMAGE_DIRS = ['src/images/items', 'src/images/weapons', 'src/images/tomes', 'src/images/characters', 'src/icons'];

const WEBP_QUALITY = 85; // Balance between quality and file size

/**
 * Convert a single image to WebP
 * @param {string} inputPath - Path to input image
 * @param {string} outputPath - Path to output WebP image
 */
async function convertToWebP(inputPath, outputPath) {
    try {
        await sharp(inputPath).webp({ quality: WEBP_QUALITY }).toFile(outputPath);

        const originalSize = fs.statSync(inputPath).size;
        const webpSize = fs.statSync(outputPath).size;
        const savings = ((1 - webpSize / originalSize) * 100).toFixed(1);

        console.log(`✓ ${path.basename(inputPath)} → ${path.basename(outputPath)} (${savings}% smaller)`);
        return { originalSize, webpSize, savings: parseFloat(savings) };
    } catch (error) {
        console.error(`✗ Failed to convert ${inputPath}:`, error.message);
        return null;
    }
}

/**
 * Process all images in a directory
 * @param {string} dirPath - Directory path
 */
async function processDirectory(dirPath) {
    const fullPath = path.join(process.cwd(), dirPath);

    if (!fs.existsSync(fullPath)) {
        console.log(`⚠ Directory not found: ${dirPath}`);
        return { converted: 0, totalSavings: 0 };
    }

    const files = fs.readdirSync(fullPath);
    const imageFiles = files.filter(f => /\.(png|jpg|jpeg)$/i.test(f));

    if (imageFiles.length === 0) {
        console.log(`ℹ No images found in ${dirPath}`);
        return { converted: 0, totalSavings: 0 };
    }

    console.log(`\n📂 Processing ${dirPath} (${imageFiles.length} images)...`);

    let converted = 0;
    let totalOriginalSize = 0;
    let totalWebPSize = 0;

    for (const file of imageFiles) {
        const inputPath = path.join(fullPath, file);
        const outputPath = path.join(fullPath, file.replace(/\.(png|jpg|jpeg)$/i, '.webp'));

        // Skip if WebP already exists and is newer
        if (fs.existsSync(outputPath)) {
            const inputStat = fs.statSync(inputPath);
            const outputStat = fs.statSync(outputPath);
            if (outputStat.mtime > inputStat.mtime) {
                console.log(`⊘ Skipping ${file} (WebP is up to date)`);
                continue;
            }
        }

        const result = await convertToWebP(inputPath, outputPath);
        if (result) {
            converted++;
            totalOriginalSize += result.originalSize;
            totalWebPSize += result.webpSize;
        }
    }

    const totalSavings = totalOriginalSize > 0 ? ((1 - totalWebPSize / totalOriginalSize) * 100).toFixed(1) : 0;

    console.log(`✓ Converted ${converted} images in ${dirPath} (${totalSavings}% total savings)`);

    return { converted, totalSavings: parseFloat(totalSavings), totalOriginalSize, totalWebPSize };
}

/**
 * Main execution
 */
async function main() {
    console.log('🖼️  MegaBonk WebP Converter\n');
    console.log('Converting PNG/JPG images to WebP format...\n');

    let totalConverted = 0;
    let grandTotalOriginal = 0;
    let grandTotalWebP = 0;

    for (const dir of IMAGE_DIRS) {
        const result = await processDirectory(dir);
        totalConverted += result.converted;
        grandTotalOriginal += result.totalOriginalSize || 0;
        grandTotalWebP += result.totalWebPSize || 0;
    }

    const grandTotalSavings = grandTotalOriginal > 0 ? ((1 - grandTotalWebP / grandTotalOriginal) * 100).toFixed(1) : 0;

    const originalKB = (grandTotalOriginal / 1024).toFixed(1);
    const webpKB = (grandTotalWebP / 1024).toFixed(1);

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Conversion Complete!`);
    console.log(`   Total images converted: ${totalConverted}`);
    console.log(`   Original size: ${originalKB} KB`);
    console.log(`   WebP size: ${webpKB} KB`);
    console.log(`   Total savings: ${grandTotalSavings}%`);
    console.log('='.repeat(60));

    console.log('\n💡 Next steps:');
    console.log('   1. Images will automatically use WebP format with PNG fallbacks');
    console.log('   2. Update service worker cache if needed: src/sw.js');
    console.log("   3. Test in browsers that support/don't support WebP");
}

main().catch(console.error);
