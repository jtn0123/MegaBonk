#!/usr/bin/env node
// Analyze what makes high-confidence matches work and build augmentation

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, ImageData } = require('canvas');
globalThis.ImageData = ImageData;

const OUTPUT_DIR = './training-data/augmented-templates';

// Analyze image characteristics
function analyzeImage(imageData) {
    const w = imageData.width, h = imageData.height;
    let sumR = 0, sumG = 0, sumB = 0;
    let sumGray = 0, sumGraySq = 0;
    let edgeCount = 0;
    let colorVariance = 0;
    const pixels = w * h;

    // Color stats
    for (let i = 0; i < imageData.data.length; i += 4) {
        sumR += imageData.data[i];
        sumG += imageData.data[i+1];
        sumB += imageData.data[i+2];
        const gray = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
        sumGray += gray;
        sumGraySq += gray * gray;
    }

    const avgR = sumR / pixels, avgG = sumG / pixels, avgB = sumB / pixels;
    const avgGray = sumGray / pixels;
    const variance = sumGraySq / pixels - avgGray * avgGray;

    // Color distinctiveness (how different are R, G, B from each other)
    colorVariance = Math.abs(avgR - avgG) + Math.abs(avgG - avgB) + Math.abs(avgR - avgB);

    // Edge density
    const gray = new Float32Array(pixels);
    for (let i = 0; i < pixels; i++) {
        gray[i] = (imageData.data[i*4] + imageData.data[i*4+1] + imageData.data[i*4+2]) / 3;
    }

    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const gx = Math.abs(gray[y*w + x+1] - gray[y*w + x-1]);
            const gy = Math.abs(gray[(y+1)*w + x] - gray[(y-1)*w + x]);
            if (gx + gy > 40) edgeCount++;
        }
    }

    const edgeDensity = edgeCount / ((w-2) * (h-2));

    // Saturation (how colorful)
    let satSum = 0;
    for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i], g = imageData.data[i+1], b = imageData.data[i+2];
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        satSum += max > 0 ? (max - min) / max : 0;
    }
    const avgSaturation = satSum / pixels;

    return { avgR, avgG, avgB, avgGray, variance, colorVariance, edgeDensity, avgSaturation };
}

// Augmentation functions
function adjustBrightness(imageData, factor) {
    const data = new Uint8ClampedArray(imageData.data);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, data[i] * factor));
        data[i+1] = Math.min(255, Math.max(0, data[i+1] * factor));
        data[i+2] = Math.min(255, Math.max(0, data[i+2] * factor));
    }
    return new ImageData(data, imageData.width, imageData.height);
}

function adjustContrast(imageData, factor) {
    const data = new Uint8ClampedArray(imageData.data);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, 128 + (data[i] - 128) * factor));
        data[i+1] = Math.min(255, Math.max(0, 128 + (data[i+1] - 128) * factor));
        data[i+2] = Math.min(255, Math.max(0, 128 + (data[i+2] - 128) * factor));
    }
    return new ImageData(data, imageData.width, imageData.height);
}

function adjustSaturation(imageData, factor) {
    const data = new Uint8ClampedArray(imageData.data);
    for (let i = 0; i < data.length; i += 4) {
        const gray = (data[i] + data[i+1] + data[i+2]) / 3;
        data[i] = Math.min(255, Math.max(0, gray + (data[i] - gray) * factor));
        data[i+1] = Math.min(255, Math.max(0, gray + (data[i+1] - gray) * factor));
        data[i+2] = Math.min(255, Math.max(0, gray + (data[i+2] - gray) * factor));
    }
    return new ImageData(data, imageData.width, imageData.height);
}

function addNoise(imageData, amount) {
    const data = new Uint8ClampedArray(imageData.data);
    for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * amount;
        data[i] = Math.min(255, Math.max(0, data[i] + noise));
        data[i+1] = Math.min(255, Math.max(0, data[i+1] + noise));
        data[i+2] = Math.min(255, Math.max(0, data[i+2] + noise));
    }
    return new ImageData(data, imageData.width, imageData.height);
}

function tintColor(imageData, tintR, tintG, tintB, strength) {
    const data = new Uint8ClampedArray(imageData.data);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, data[i] * (1 - strength) + tintR * strength));
        data[i+1] = Math.min(255, Math.max(0, data[i+1] * (1 - strength) + tintG * strength));
        data[i+2] = Math.min(255, Math.max(0, data[i+2] * (1 - strength) + tintB * strength));
    }
    return new ImageData(data, imageData.width, imageData.height);
}

function blur(imageData, radius = 1) {
    const w = imageData.width, h = imageData.height;
    const data = new Uint8ClampedArray(imageData.data);
    const result = new Uint8ClampedArray(imageData.data.length);

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let r = 0, g = 0, b = 0, count = 0;
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const nx = x + dx, ny = y + dy;
                    if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                        const i = (ny * w + nx) * 4;
                        r += data[i]; g += data[i+1]; b += data[i+2];
                        count++;
                    }
                }
            }
            const i = (y * w + x) * 4;
            result[i] = r / count;
            result[i+1] = g / count;
            result[i+2] = b / count;
            result[i+3] = data[i+3];
        }
    }
    return new ImageData(result, w, h);
}

// Generate augmented versions
function generateAugmentations(imageData, numVariants = 10) {
    const variants = [imageData]; // Original

    // Brightness variations
    variants.push(adjustBrightness(imageData, 0.7));  // Darker
    variants.push(adjustBrightness(imageData, 0.85));
    variants.push(adjustBrightness(imageData, 1.15));
    variants.push(adjustBrightness(imageData, 1.3));  // Brighter

    // Contrast variations
    variants.push(adjustContrast(imageData, 0.8));   // Lower contrast
    variants.push(adjustContrast(imageData, 1.2));   // Higher contrast

    // Saturation variations (simulate game rendering)
    variants.push(adjustSaturation(imageData, 0.7)); // Desaturated
    variants.push(adjustSaturation(imageData, 1.3)); // More saturated

    // Slight blur (simulate lower resolution)
    variants.push(blur(imageData, 1));

    // Add noise (simulate compression)
    variants.push(addNoise(imageData, 15));
    variants.push(addNoise(imageData, 25));

    // Color tints (simulate different biomes)
    variants.push(tintColor(imageData, 100, 50, 50, 0.15));  // Reddish (hell)
    variants.push(tintColor(imageData, 50, 100, 50, 0.15));  // Greenish (forest)
    variants.push(tintColor(imageData, 50, 80, 120, 0.15));  // Bluish (snow/ocean)

    // Combined augmentations
    let combined = adjustBrightness(imageData, 0.9);
    combined = adjustContrast(combined, 1.1);
    combined = addNoise(combined, 10);
    variants.push(combined);

    combined = adjustBrightness(imageData, 1.1);
    combined = adjustSaturation(combined, 0.85);
    combined = blur(combined, 1);
    variants.push(combined);

    return variants.slice(0, numVariants);
}

async function main() {
    console.log('=== Data Augmentation Pipeline ===\n');

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    // Load wiki templates
    const itemsData = JSON.parse(fs.readFileSync('./data/items.json', 'utf-8'));
    const templates = [];

    for (const item of itemsData.items) {
        if (!item.image) continue;
        const imagePath = path.join('./src/', item.image);
        if (!fs.existsSync(imagePath)) continue;

        try {
            const img = await loadImage(imagePath);
            const canvas = createCanvas(48, 48);
            const ctx = canvas.getContext('2d');
            const margin = Math.round(img.width * 0.08);
            ctx.drawImage(img, margin, margin, img.width - margin*2, img.height - margin*2, 0, 0, 48, 48);
            const imageData = ctx.getImageData(0, 0, 48, 48);
            const stats = analyzeImage(imageData);
            templates.push({ id: item.id, name: item.name, imageData, stats });
        } catch {}
    }

    console.log(`Loaded ${templates.length} wiki templates\n`);

    // Analyze template characteristics
    const avgStats = {
        variance: 0, colorVariance: 0, edgeDensity: 0, avgSaturation: 0
    };
    for (const t of templates) {
        avgStats.variance += t.stats.variance;
        avgStats.colorVariance += t.stats.colorVariance;
        avgStats.edgeDensity += t.stats.edgeDensity;
        avgStats.avgSaturation += t.stats.avgSaturation;
    }
    for (const key of Object.keys(avgStats)) {
        avgStats[key] /= templates.length;
    }

    console.log('Average wiki template stats:');
    console.log(`  Variance: ${avgStats.variance.toFixed(1)}`);
    console.log(`  Color variance: ${avgStats.colorVariance.toFixed(1)}`);
    console.log(`  Edge density: ${(avgStats.edgeDensity * 100).toFixed(1)}%`);
    console.log(`  Saturation: ${(avgStats.avgSaturation * 100).toFixed(1)}%`);

    // Load and analyze high-confidence in-game crops if available
    const highConfDir = './training-data/smart-extracted/high-confidence';
    if (fs.existsSync(highConfDir)) {
        const ingameStats = { variance: 0, colorVariance: 0, edgeDensity: 0, avgSaturation: 0 };
        let count = 0;

        const dirs = fs.readdirSync(highConfDir);
        for (const dir of dirs) {
            const itemDir = path.join(highConfDir, dir);
            if (!fs.statSync(itemDir).isDirectory()) continue;

            const files = fs.readdirSync(itemDir).filter(f => f.endsWith('.png'));
            for (const file of files) {
                const img = await loadImage(path.join(itemDir, file));
                const canvas = createCanvas(img.width, img.height);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, img.width, img.height);
                const stats = analyzeImage(imageData);

                ingameStats.variance += stats.variance;
                ingameStats.colorVariance += stats.colorVariance;
                ingameStats.edgeDensity += stats.edgeDensity;
                ingameStats.avgSaturation += stats.avgSaturation;
                count++;
            }
        }

        if (count > 0) {
            for (const key of Object.keys(ingameStats)) {
                ingameStats[key] /= count;
            }

            console.log(`\nAverage in-game crop stats (${count} samples):`);
            console.log(`  Variance: ${ingameStats.variance.toFixed(1)}`);
            console.log(`  Color variance: ${ingameStats.colorVariance.toFixed(1)}`);
            console.log(`  Edge density: ${(ingameStats.edgeDensity * 100).toFixed(1)}%`);
            console.log(`  Saturation: ${(ingameStats.avgSaturation * 100).toFixed(1)}%`);

            console.log('\nDifferences (in-game vs wiki):');
            console.log(`  Variance: ${((ingameStats.variance / avgStats.variance - 1) * 100).toFixed(1)}%`);
            console.log(`  Saturation: ${((ingameStats.avgSaturation / avgStats.avgSaturation - 1) * 100).toFixed(1)}%`);
        }
    }

    // Generate augmented templates
    console.log('\nGenerating augmented templates...');

    let totalAugmented = 0;
    const augmentedDir = path.join(OUTPUT_DIR, 'by-item');
    fs.mkdirSync(augmentedDir, { recursive: true });

    for (const template of templates) {
        const variants = generateAugmentations(template.imageData, 18);
        const itemDir = path.join(augmentedDir, template.id);
        fs.mkdirSync(itemDir, { recursive: true });

        for (let i = 0; i < variants.length; i++) {
            const canvas = createCanvas(48, 48);
            const ctx = canvas.getContext('2d');
            ctx.putImageData(variants[i], 0, 0);

            fs.writeFileSync(
                path.join(itemDir, `${template.id}_aug${i}.png`),
                canvas.toBuffer('image/png')
            );
        }
        totalAugmented += variants.length;
    }

    console.log(`Generated ${totalAugmented} augmented templates (${templates.length} items x ~18 variants)`);

    // Create sample montage
    const sampleItems = templates.slice(0, 6);
    const montageWidth = 18 * 50;
    const montageHeight = sampleItems.length * 50;
    const montage = createCanvas(montageWidth, montageHeight);
    const mCtx = montage.getContext('2d');
    mCtx.fillStyle = '#1a1a2e';
    mCtx.fillRect(0, 0, montageWidth, montageHeight);

    for (let row = 0; row < sampleItems.length; row++) {
        const template = sampleItems[row];
        const variants = generateAugmentations(template.imageData, 18);

        for (let col = 0; col < variants.length; col++) {
            const canvas = createCanvas(48, 48);
            canvas.getContext('2d').putImageData(variants[col], 0, 0);
            mCtx.drawImage(canvas, col * 50 + 1, row * 50 + 1, 48, 48);
        }
    }

    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'augmentation-samples.png'),
        montage.toBuffer('image/png')
    );

    console.log(`\nSample montage saved: ${OUTPUT_DIR}/augmentation-samples.png`);
    console.log(`Augmented templates saved to: ${augmentedDir}/`);
}

main().catch(console.error);
