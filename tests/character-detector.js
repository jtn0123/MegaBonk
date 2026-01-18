#!/usr/bin/env node
// Detect player character from screenshot

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, ImageData } = require('canvas');
globalThis.ImageData = ImageData;

const GT_PATH = './test-images/gameplay/ground-truth.json';
const OUTPUT_DIR = './test-results/character-detection';

// Character appears in center of screen, roughly
const CHARACTER_REGION = {
    xPercent: 0.45,  // 45% from left
    yPercent: 0.40,  // 40% from top
    widthPercent: 0.10,  // 10% of screen width
    heightPercent: 0.15  // 15% of screen height
};

function calculateNCC(d1, d2) {
    let s1 = 0, s2 = 0, sp = 0, ss1 = 0, ss2 = 0, c = 0;
    const len = Math.min(d1.data.length, d2.data.length);
    for (let i = 0; i < len; i += 4) {
        const g1 = (d1.data[i] + d1.data[i+1] + d1.data[i+2]) / 3;
        const g2 = (d2.data[i] + d2.data[i+1] + d2.data[i+2]) / 3;
        s1 += g1; s2 += g2; sp += g1*g2; ss1 += g1*g1; ss2 += g2*g2; c++;
    }
    const m1 = s1/c, m2 = s2/c;
    const num = sp/c - m1*m2;
    const den = Math.sqrt((ss1/c - m1*m1) * (ss2/c - m2*m2));
    return den === 0 ? 0 : (num/den + 1) / 2;
}

function computeColorProfile(imageData) {
    let sumR = 0, sumG = 0, sumB = 0;
    let count = 0;
    const colorCounts = new Map();

    for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i+1];
        const b = imageData.data[i+2];

        // Skip very dark or very bright (likely background)
        const brightness = (r + g + b) / 3;
        if (brightness < 30 || brightness > 240) continue;

        sumR += r;
        sumG += g;
        sumB += b;
        count++;

        // Quantize color for histogram
        const qR = Math.floor(r / 32);
        const qG = Math.floor(g / 32);
        const qB = Math.floor(b / 32);
        const key = `${qR}-${qG}-${qB}`;
        colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
    }

    if (count === 0) return null;

    // Find dominant colors
    const sortedColors = Array.from(colorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    return {
        avgColor: { r: sumR / count, g: sumG / count, b: sumB / count },
        dominantColors: sortedColors.map(([key, count]) => {
            const [r, g, b] = key.split('-').map(n => parseInt(n) * 32 + 16);
            return { r, g, b, count };
        }),
        pixelCount: count
    };
}

async function loadCharacterTemplates() {
    const templates = new Map();
    const charData = JSON.parse(fs.readFileSync('./data/characters.json', 'utf-8'));

    for (const char of charData.characters) {
        if (!char.image) continue;
        const imagePath = path.join('./src/', char.image);
        if (!fs.existsSync(imagePath)) continue;

        try {
            const img = await loadImage(imagePath);
            const canvas = createCanvas(64, 64);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, 64, 64);
            const imageData = ctx.getImageData(0, 0, 64, 64);
            const colorProfile = computeColorProfile(imageData);

            templates.set(char.id, {
                name: char.name,
                tier: char.tier,
                imageData,
                colorProfile,
                canvas
            });
        } catch {}
    }

    return templates;
}

function extractCharacterRegion(ctx, width, height) {
    const x = Math.round(width * CHARACTER_REGION.xPercent);
    const y = Math.round(height * CHARACTER_REGION.yPercent);
    const w = Math.round(width * CHARACTER_REGION.widthPercent);
    const h = Math.round(height * CHARACTER_REGION.heightPercent);

    return { x, y, w, h };
}

function matchCharacter(ctx, region, templates) {
    // Extract region
    const regionCanvas = createCanvas(64, 64);
    const regionCtx = regionCanvas.getContext('2d');

    const imageData = ctx.getImageData(region.x, region.y, region.w, region.h);
    const srcCanvas = createCanvas(region.w, region.h);
    srcCanvas.getContext('2d').putImageData(imageData, 0, 0);

    regionCtx.drawImage(srcCanvas, 0, 0, 64, 64);
    const regionData = regionCtx.getImageData(0, 0, 64, 64);
    const regionProfile = computeColorProfile(regionData);

    if (!regionProfile) return { match: null, confidence: 0 };

    let bestMatch = null;
    let bestScore = 0;

    for (const [id, template] of templates) {
        // Score based on NCC
        const nccScore = calculateNCC(regionData, template.imageData);

        // Score based on color similarity
        let colorScore = 0;
        if (template.colorProfile) {
            const rDiff = Math.abs(regionProfile.avgColor.r - template.colorProfile.avgColor.r);
            const gDiff = Math.abs(regionProfile.avgColor.g - template.colorProfile.avgColor.g);
            const bDiff = Math.abs(regionProfile.avgColor.b - template.colorProfile.avgColor.b);
            colorScore = 1 - (rDiff + gDiff + bDiff) / (3 * 255);
        }

        const combined = nccScore * 0.7 + colorScore * 0.3;

        if (combined > bestScore) {
            bestScore = combined;
            bestMatch = { id, name: template.name, tier: template.tier };
        }
    }

    return {
        match: bestMatch,
        confidence: bestScore,
        regionProfile,
        regionCanvas
    };
}

async function main() {
    console.log('=== Character Detection ===\n');

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const templates = await loadCharacterTemplates();
    console.log(`Loaded ${templates.size} character templates\n`);

    // Show template colors for debugging
    console.log('Character color profiles:');
    for (const [id, t] of Array.from(templates.entries()).slice(0, 5)) {
        if (t.colorProfile) {
            const c = t.colorProfile.avgColor;
            console.log(`  ${t.name}: RGB(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`);
        }
    }
    console.log('');

    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

    console.log('| Image | Detected | Confidence | Tier |');
    console.log('|-------|----------|------------|------|');

    const results = [];

    for (const [filename, data] of testCases) {
        const imagePath = path.join('./test-images/gameplay', filename);
        if (!fs.existsSync(imagePath)) continue;

        const image = await loadImage(imagePath);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        const region = extractCharacterRegion(ctx, image.width, image.height);
        const result = matchCharacter(ctx, region, templates);

        const shortName = filename.slice(9, 35);
        const detected = result.match ? result.match.name : 'Unknown';
        const tier = result.match ? result.match.tier : '-';
        console.log(`| ${shortName.padEnd(25)} | ${detected.padEnd(8)} | ${(result.confidence * 100).toFixed(0).padStart(9)}% | ${tier.padStart(4)} |`);

        results.push({
            filename,
            detected: result.match,
            confidence: result.confidence,
            expected: data.character || 'Unknown'
        });

        // Create visualization
        const vizCanvas = createCanvas(image.width, image.height + 100);
        const vizCtx = vizCanvas.getContext('2d');
        vizCtx.drawImage(image, 0, 0);

        // Draw character search region
        vizCtx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
        vizCtx.lineWidth = 3;
        vizCtx.strokeRect(region.x, region.y, region.w, region.h);

        // Info panel
        vizCtx.fillStyle = '#1a1a2e';
        vizCtx.fillRect(0, image.height, image.width, 100);
        vizCtx.fillStyle = '#fff';
        vizCtx.font = '12px monospace';

        vizCtx.fillText(`Detected: ${detected} (${(result.confidence * 100).toFixed(0)}%)`, 10, image.height + 25);
        vizCtx.fillText(`Tier: ${tier}`, 10, image.height + 50);
        vizCtx.fillText(`Expected: ${data.character || 'Unknown'}`, 10, image.height + 75);

        // Draw extracted region
        if (result.regionCanvas) {
            vizCtx.drawImage(result.regionCanvas, image.width - 80, image.height + 15, 64, 64);
            vizCtx.strokeStyle = '#fff';
            vizCtx.strokeRect(image.width - 82, image.height + 13, 68, 68);
        }

        // Draw best matching template
        if (result.match) {
            const template = templates.get(result.match.id);
            if (template) {
                vizCtx.drawImage(template.canvas, image.width - 160, image.height + 15, 64, 64);
                vizCtx.strokeStyle = '#0f0';
                vizCtx.strokeRect(image.width - 162, image.height + 13, 68, 68);
            }
        }

        fs.writeFileSync(
            path.join(OUTPUT_DIR, `char_${filename.replace(/[\/\.]/g, '_')}.png`),
            vizCanvas.toBuffer('image/png')
        );
    }

    // Summary
    console.log('|-------|----------|------------|------|');

    const avgConf = results.reduce((s, r) => s + r.confidence, 0) / results.length;
    console.log(`\nAverage confidence: ${(avgConf * 100).toFixed(1)}%`);

    // Save results
    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'results.json'),
        JSON.stringify(results, null, 2)
    );

    console.log(`\nResults saved to: ${OUTPUT_DIR}/`);
}

main().catch(console.error);
