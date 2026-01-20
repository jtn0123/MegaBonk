#!/usr/bin/env node
// Compare specific templates to see why they're confused
import * as fs from 'fs';
import * as path from 'path';

let createCanvas: any, loadImage: any;
try {
    const canvas = require('canvas');
    createCanvas = canvas.createCanvas;
    loadImage = canvas.loadImage;
} catch { process.exit(1); }

const itemsPath = path.join(__dirname, '../data/items.json');
const itemsData = JSON.parse(fs.readFileSync(itemsPath, 'utf-8'));

interface Template {
    id: string;
    name: string;
    canvas: any;
}

const templates = new Map<string, Template>();

async function loadTemplates(): Promise<void> {
    for (const item of itemsData.items) {
        if (!item.image) continue;
        const tPath = path.join(__dirname, '../src/', item.image);
        if (!fs.existsSync(tPath)) continue;
        try {
            const img = await loadImage(tPath);
            const canvas = createCanvas(img.width, img.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            templates.set(item.name, { id: item.id, name: item.name, canvas });
        } catch {}
    }
}

function calculateNCC(img1: any, img2: any): number {
    const w = Math.min(img1.width, img2.width);
    const h = Math.min(img1.height, img2.height);

    const c1 = createCanvas(w, h);
    const c2 = createCanvas(w, h);
    c1.getContext('2d').drawImage(img1, 0, 0, w, h);
    c2.getContext('2d').drawImage(img2, 0, 0, w, h);

    const d1 = c1.getContext('2d').getImageData(0, 0, w, h).data;
    const d2 = c2.getContext('2d').getImageData(0, 0, w, h).data;

    let sum1 = 0, sum2 = 0, sumProd = 0, sumSq1 = 0, sumSq2 = 0, n = 0;
    for (let i = 0; i < d1.length; i += 4) {
        const g1 = (d1[i] + d1[i+1] + d1[i+2]) / 3;
        const g2 = (d2[i] + d2[i+1] + d2[i+2]) / 3;
        sum1 += g1; sum2 += g2; sumProd += g1 * g2;
        sumSq1 += g1 * g1; sumSq2 += g2 * g2; n++;
    }
    const mean1 = sum1 / n, mean2 = sum2 / n;
    const num = sumProd / n - mean1 * mean2;
    const denom = Math.sqrt((sumSq1 / n - mean1 * mean1) * (sumSq2 / n - mean2 * mean2));
    return denom > 0 ? (num / denom + 1) / 2 : 0;
}

async function main() {
    await loadTemplates();
    console.log(`Loaded ${templates.size} templates\n`);

    // Compare pairs that were confused
    const confusedPairs = [
        ['Medkit', 'Oats'],           // Expected Medkit, got Oats
        ['Wrench', 'Toxic Barrel'],   // Expected Wrench, got Toxic Barrel
        ['Sucky Magnet', 'Energy Core'], // Expected Sucky Magnet, got Energy Core
        ['Feathers', 'Borgar'],       // Expected Feathers, got Borgar
        ['Spiky Shield', 'Ice Cube'], // Expected Spiky Shield, got Ice Cube
        ['Credit Card (Green)', 'Cursed Doll'], // Expected Credit Card, got Cursed Doll
    ];

    console.log('TEMPLATE SIMILARITY ANALYSIS');
    console.log('═'.repeat(60));
    console.log('\nComparing confused pairs (expected vs detected):');

    for (const [expected, detected] of confusedPairs) {
        const t1 = templates.get(expected);
        const t2 = templates.get(detected);

        if (!t1 || !t2) {
            console.log(`  ${expected} vs ${detected}: MISSING TEMPLATE`);
            continue;
        }

        const ncc = calculateNCC(t1.canvas, t2.canvas);
        const nccPct = (ncc * 100).toFixed(1);
        console.log(`  ${expected.padEnd(25)} vs ${detected.padEnd(25)}: NCC=${nccPct}%`);
    }

    // Find most similar templates overall
    console.log('\n\nMOST SIMILAR TEMPLATE PAIRS (potential confusion):');
    console.log('═'.repeat(60));

    const allNames = [...templates.keys()];
    const similarities: Array<{name1: string; name2: string; ncc: number}> = [];

    for (let i = 0; i < allNames.length; i++) {
        for (let j = i + 1; j < allNames.length; j++) {
            const t1 = templates.get(allNames[i])!;
            const t2 = templates.get(allNames[j])!;
            const ncc = calculateNCC(t1.canvas, t2.canvas);
            if (ncc > 0.70) { // High similarity threshold
                similarities.push({ name1: allNames[i], name2: allNames[j], ncc });
            }
        }
    }

    similarities.sort((a, b) => b.ncc - a.ncc);
    for (const s of similarities.slice(0, 15)) {
        console.log(`  ${(s.ncc * 100).toFixed(1)}%: ${s.name1} <-> ${s.name2}`);
    }

    // Check template distinctiveness
    console.log('\n\nTEMPLATE DISTINCTIVENESS:');
    console.log('═'.repeat(60));
    console.log('(Average NCC with all other templates - lower = more unique)');

    const distinctiveness: Array<{name: string; avgNcc: number}> = [];
    for (const name of allNames) {
        const t1 = templates.get(name)!;
        let sumNcc = 0, count = 0;
        for (const other of allNames) {
            if (other === name) continue;
            const t2 = templates.get(other)!;
            sumNcc += calculateNCC(t1.canvas, t2.canvas);
            count++;
        }
        distinctiveness.push({ name, avgNcc: sumNcc / count });
    }

    distinctiveness.sort((a, b) => b.avgNcc - a.avgNcc);

    console.log('\nLeast distinctive (most likely to be confused):');
    for (const d of distinctiveness.slice(0, 10)) {
        console.log(`  ${(d.avgNcc * 100).toFixed(1)}%: ${d.name}`);
    }

    console.log('\nMost distinctive (least likely to be confused):');
    for (const d of distinctiveness.slice(-10).reverse()) {
        console.log(`  ${(d.avgNcc * 100).toFixed(1)}%: ${d.name}`);
    }
}

main().catch(console.error);
