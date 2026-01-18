#!/usr/bin/env node
// Create heavily blurred augmentations that match in-game variance levels

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, ImageData } = require('canvas');
globalThis.ImageData = ImageData;

const OUTPUT_DIR = './training-data/ingame-style-templates';

function analyzeImage(imageData) {
    let sumGray = 0, sumGraySq = 0;
    const pixels = imageData.width * imageData.height;
    for (let i = 0; i < imageData.data.length; i += 4) {
        const gray = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
        sumGray += gray; sumGraySq += gray * gray;
    }
    return sumGraySq / pixels - (sumGray / pixels) ** 2;
}

function heavyBlur(imageData, radius) {
    const w = imageData.width, h = imageData.height;
    const data = imageData.data;
    const result = new Uint8ClampedArray(data.length);

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let r = 0, g = 0, b = 0, a = 0, count = 0;
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const nx = Math.min(w-1, Math.max(0, x + dx));
                    const ny = Math.min(h-1, Math.max(0, y + dy));
                    const i = (ny * w + nx) * 4;
                    r += data[i]; g += data[i+1]; b += data[i+2]; a += data[i+3];
                    count++;
                }
            }
            const i = (y * w + x) * 4;
            result[i] = r / count;
            result[i+1] = g / count;
            result[i+2] = b / count;
            result[i+3] = a / count;
        }
    }
    return new ImageData(result, w, h);
}

function reduceContrast(imageData, factor) {
    const data = new Uint8ClampedArray(imageData.data);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.round(128 + (data[i] - 128) * factor);
        data[i+1] = Math.round(128 + (data[i+1] - 128) * factor);
        data[i+2] = Math.round(128 + (data[i+2] - 128) * factor);
    }
    return new ImageData(data, imageData.width, imageData.height);
}

function adjustBrightness(imageData, factor) {
    const data = new Uint8ClampedArray(imageData.data);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.round(data[i] * factor));
        data[i+1] = Math.min(255, Math.round(data[i+1] * factor));
        data[i+2] = Math.min(255, Math.round(data[i+2] * factor));
    }
    return new ImageData(data, imageData.width, imageData.height);
}

function downscaleUpscale(imageData, scale) {
    const w = imageData.width, h = imageData.height;
    const smallW = Math.round(w / scale), smallH = Math.round(h / scale);

    // Downscale
    const smallCanvas = createCanvas(smallW, smallH);
    const smallCtx = smallCanvas.getContext('2d');
    const srcCanvas = createCanvas(w, h);
    srcCanvas.getContext('2d').putImageData(imageData, 0, 0);
    smallCtx.drawImage(srcCanvas, 0, 0, smallW, smallH);

    // Upscale back
    const dstCanvas = createCanvas(w, h);
    const dstCtx = dstCanvas.getContext('2d');
    dstCtx.imageSmoothingEnabled = true;
    dstCtx.imageSmoothingQuality = 'low';
    dstCtx.drawImage(smallCanvas, 0, 0, w, h);

    return dstCtx.getImageData(0, 0, w, h);
}

// Create variants that progressively match in-game variance
function createIngameStyleVariants(imageData, targetVariance = 600) {
    const originalVariance = analyzeImage(imageData);
    const variants = [];

    // Try different combinations to hit target variance
    const blurRadii = [1, 2, 3, 4, 5];
    const contrastFactors = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    const downscaleFactors = [1.5, 2, 2.5, 3];

    for (const blur of blurRadii) {
        for (const contrast of contrastFactors) {
            let processed = heavyBlur(imageData, blur);
            processed = reduceContrast(processed, contrast);

            const variance = analyzeImage(processed);
            if (variance >= targetVariance * 0.5 && variance <= targetVariance * 2) {
                variants.push({ imageData: processed, variance, blur, contrast, downscale: 0 });
            }
        }
    }

    // Also try downscale/upscale approach
    for (const ds of downscaleFactors) {
        let processed = downscaleUpscale(imageData, ds);
        processed = reduceContrast(processed, 0.7);

        const variance = analyzeImage(processed);
        if (variance >= targetVariance * 0.5 && variance <= targetVariance * 2) {
            variants.push({ imageData: processed, variance, blur: 0, contrast: 0.7, downscale: ds });
        }
    }

    // Sort by how close to target variance
    variants.sort((a, b) =>
        Math.abs(a.variance - targetVariance) - Math.abs(b.variance - targetVariance)
    );

    return variants.slice(0, 8); // Keep best 8 variants
}

async function main() {
    console.log('=== Creating In-Game Style Templates ===\n');
    console.log('Target variance: ~600 (matching in-game crops)\n');

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
            templates.push({ id: item.id, name: item.name, imageData });
        } catch {}
    }

    console.log(`Processing ${templates.length} templates...\n`);

    const allVariants = [];
    let totalCreated = 0;

    for (const template of templates) {
        const originalVariance = analyzeImage(template.imageData);
        const variants = createIngameStyleVariants(template.imageData, 600);

        // Save variants
        const itemDir = path.join(OUTPUT_DIR, 'by-item', template.id);
        fs.mkdirSync(itemDir, { recursive: true });

        // Save original too
        const origCanvas = createCanvas(48, 48);
        origCanvas.getContext('2d').putImageData(template.imageData, 0, 0);
        fs.writeFileSync(path.join(itemDir, `${template.id}_orig.png`), origCanvas.toBuffer('image/png'));

        for (let i = 0; i < variants.length; i++) {
            const v = variants[i];
            const canvas = createCanvas(48, 48);
            canvas.getContext('2d').putImageData(v.imageData, 0, 0);
            fs.writeFileSync(
                path.join(itemDir, `${template.id}_v${i}_var${Math.round(v.variance)}.png`),
                canvas.toBuffer('image/png')
            );

            allVariants.push({
                id: template.id,
                variant: i,
                variance: v.variance,
                params: { blur: v.blur, contrast: v.contrast, downscale: v.downscale }
            });
        }

        totalCreated += variants.length + 1;
    }

    console.log(`Created ${totalCreated} templates (original + variants)`);

    // Analyze variance distribution
    const variances = allVariants.map(v => v.variance);
    const avgVariance = variances.reduce((a, b) => a + b, 0) / variances.length;
    const minVariance = Math.min(...variances);
    const maxVariance = Math.max(...variances);

    console.log(`\nVariance distribution of augmented templates:`);
    console.log(`  Min: ${minVariance.toFixed(0)}`);
    console.log(`  Max: ${maxVariance.toFixed(0)}`);
    console.log(`  Avg: ${avgVariance.toFixed(0)}`);
    console.log(`  Target: 600 (in-game average)`);

    // Create comparison montage
    const sampleItems = templates.slice(0, 8);
    const cols = 9; // original + 8 variants
    const montageWidth = cols * 52;
    const montageHeight = sampleItems.length * 52;

    const montage = createCanvas(montageWidth, montageHeight);
    const mCtx = montage.getContext('2d');
    mCtx.fillStyle = '#1a1a2e';
    mCtx.fillRect(0, 0, montageWidth, montageHeight);

    // Add labels
    mCtx.fillStyle = '#fff';
    mCtx.font = '8px monospace';

    for (let row = 0; row < sampleItems.length; row++) {
        const template = sampleItems[row];
        const variants = createIngameStyleVariants(template.imageData, 600);

        // Original
        const origCanvas = createCanvas(48, 48);
        origCanvas.getContext('2d').putImageData(template.imageData, 0, 0);
        mCtx.drawImage(origCanvas, 2, row * 52 + 2, 48, 48);

        const origVar = analyzeImage(template.imageData);
        mCtx.fillStyle = '#f00';
        mCtx.fillText(Math.round(origVar).toString(), 4, row * 52 + 48);

        // Variants
        for (let col = 0; col < Math.min(8, variants.length); col++) {
            const v = variants[col];
            const canvas = createCanvas(48, 48);
            canvas.getContext('2d').putImageData(v.imageData, 0, 0);
            mCtx.drawImage(canvas, (col + 1) * 52 + 2, row * 52 + 2, 48, 48);

            mCtx.fillStyle = '#0f0';
            mCtx.fillText(Math.round(v.variance).toString(), (col + 1) * 52 + 4, row * 52 + 48);
        }
    }

    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'ingame-style-montage.png'),
        montage.toBuffer('image/png')
    );

    console.log(`\nMontage saved: ${OUTPUT_DIR}/ingame-style-montage.png`);
    console.log(`Templates saved to: ${OUTPUT_DIR}/by-item/`);
}

main().catch(console.error);
