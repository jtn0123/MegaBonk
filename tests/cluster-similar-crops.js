#!/usr/bin/env node
// Cluster similar crops to find same items without labels

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, ImageData } = require('canvas');
globalThis.ImageData = ImageData;

const GT_PATH = './test-images/gameplay/ground-truth.json';
const OUTPUT_DIR = './training-data/clustered-crops';

function detectGridPositions(width, height) {
    const scale = height / 720;
    const iconSize = Math.round(34 * scale);
    const spacing = Math.round(4 * scale);
    const bottomMargin = Math.round(42 * scale);
    const rowHeight = Math.round(40 * scale);
    const positions = [];

    const rowYPositions = [];
    for (let row = 0; row < 3; row++) {
        const y = height - bottomMargin - (row * rowHeight) - iconSize;
        if (y >= height * 0.70) rowYPositions.push(y);
    }

    const sideMargin = Math.round(width * 0.15);
    const cellWidth = iconSize + spacing;
    const maxItemsPerRow = Math.min(20, Math.floor((width - sideMargin * 2) / cellWidth));
    const totalWidth = maxItemsPerRow * cellWidth;
    const startX = Math.round((width - totalWidth) / 2);

    for (const rowY of rowYPositions) {
        for (let i = 0; i < maxItemsPerRow; i++) {
            positions.push({ x: startX + i * cellWidth, y: rowY, width: iconSize, height: iconSize });
        }
    }
    return positions;
}

function isEmptyCell(imageData) {
    let sum = 0, sumSq = 0, count = 0;
    for (let i = 0; i < imageData.data.length; i += 4) {
        const gray = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
        sum += gray; sumSq += gray * gray; count++;
    }
    const mean = sum / count;
    const variance = sumSq / count - mean * mean;
    return variance < 350 || mean < 30;
}

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

async function cluster() {
    console.log('=== Clustering Similar Crops ===\n');

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

    // Extract all crops from all images
    const allCrops = [];

    console.log('Extracting crops...');
    for (const [filename, data] of testCases) {
        const imagePath = path.join('./test-images/gameplay', filename);
        if (!fs.existsSync(imagePath)) continue;

        const image = await loadImage(imagePath);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        const positions = detectGridPositions(image.width, image.height);

        for (const pos of positions) {
            const cellData = ctx.getImageData(pos.x, pos.y, pos.width, pos.height);
            if (isEmptyCell(cellData)) continue;

            const resizeCanvas = createCanvas(32, 32);
            const resizeCtx = resizeCanvas.getContext('2d');
            const srcCanvas = createCanvas(pos.width, pos.height);
            srcCanvas.getContext('2d').putImageData(cellData, 0, 0);
            const margin = Math.round(pos.width * 0.12);
            resizeCtx.drawImage(srcCanvas, margin, margin,
                pos.width - margin*2, pos.height - margin*2, 0, 0, 32, 32);

            allCrops.push({
                canvas: resizeCanvas,
                imageData: resizeCtx.getImageData(0, 0, 32, 32),
                source: filename,
                cluster: -1
            });
        }
    }

    console.log(`Total crops: ${allCrops.length}\n`);

    // Simple greedy clustering
    console.log('Clustering (similarity threshold: 0.75)...');
    const SIMILARITY_THRESHOLD = 0.75;
    let clusterCount = 0;

    for (let i = 0; i < allCrops.length; i++) {
        if (allCrops[i].cluster !== -1) continue;

        // Start new cluster
        allCrops[i].cluster = clusterCount;
        const clusterMembers = [i];

        // Find similar crops
        for (let j = i + 1; j < allCrops.length; j++) {
            if (allCrops[j].cluster !== -1) continue;

            const similarity = calculateNCC(allCrops[i].imageData, allCrops[j].imageData);
            if (similarity >= SIMILARITY_THRESHOLD) {
                allCrops[j].cluster = clusterCount;
                clusterMembers.push(j);
            }
        }

        clusterCount++;
    }

    console.log(`Found ${clusterCount} clusters\n`);

    // Analyze clusters
    const clusterSizes = new Map();
    for (const crop of allCrops) {
        clusterSizes.set(crop.cluster, (clusterSizes.get(crop.cluster) || 0) + 1);
    }

    // Sort by size
    const sortedClusters = Array.from(clusterSizes.entries())
        .sort((a, b) => b[1] - a[1]);

    console.log('Top clusters by size:');
    const largeClusters = sortedClusters.filter(([_, size]) => size >= 2);
    console.log(`Clusters with 2+ members: ${largeClusters.length}`);

    for (const [clusterId, size] of largeClusters.slice(0, 20)) {
        console.log(`  Cluster ${clusterId}: ${size} crops`);
    }

    // Save clusters with 2+ members
    console.log('\n--- Saving Multi-Member Clusters ---');

    let savedClusters = 0;
    for (const [clusterId, size] of largeClusters) {
        const clusterDir = path.join(OUTPUT_DIR, `cluster_${clusterId}`);
        fs.mkdirSync(clusterDir, { recursive: true });

        const members = allCrops.filter(c => c.cluster === clusterId);
        for (let i = 0; i < members.length; i++) {
            fs.writeFileSync(
                path.join(clusterDir, `crop_${i}_from_${members[i].source.replace(/[\/\.]/g, '_')}.png`),
                members[i].canvas.toBuffer('image/png')
            );
        }
        savedClusters++;
    }

    console.log(`Saved ${savedClusters} clusters`);

    // Create montage of largest clusters
    const topClusters = largeClusters.slice(0, 10);
    const montageRows = topClusters.length;
    const maxCols = 8;
    const cellSize = 36;

    const montage = createCanvas(maxCols * cellSize, montageRows * cellSize);
    const mCtx = montage.getContext('2d');
    mCtx.fillStyle = '#1a1a2e';
    mCtx.fillRect(0, 0, montage.width, montage.height);

    for (let row = 0; row < topClusters.length; row++) {
        const [clusterId, _] = topClusters[row];
        const members = allCrops.filter(c => c.cluster === clusterId).slice(0, maxCols);

        for (let col = 0; col < members.length; col++) {
            mCtx.drawImage(members[col].canvas,
                col * cellSize + 2, row * cellSize + 2,
                cellSize - 4, cellSize - 4);
        }
    }

    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'cluster-montage.png'),
        montage.toBuffer('image/png')
    );

    console.log(`\nMontage saved: ${OUTPUT_DIR}/cluster-montage.png`);
    console.log(`Clusters saved to: ${OUTPUT_DIR}/`);

    // Statistics
    console.log('\n--- Cluster Statistics ---');
    const singletons = sortedClusters.filter(([_, size]) => size === 1).length;
    const pairs = sortedClusters.filter(([_, size]) => size === 2).length;
    const larger = sortedClusters.filter(([_, size]) => size >= 3).length;

    console.log(`Singletons (size=1): ${singletons}`);
    console.log(`Pairs (size=2): ${pairs}`);
    console.log(`Larger (size>=3): ${larger}`);

    const totalInClusters = largeClusters.reduce((sum, [_, size]) => sum + size, 0);
    console.log(`\nCrops in multi-member clusters: ${totalInClusters}/${allCrops.length} (${(totalInClusters/allCrops.length*100).toFixed(1)}%)`);
}

cluster().catch(console.error);
