// Quick standalone tests that don't need browser APIs

// Test 1: Aggregation Logic
function testAggregation() {
    const aggregateDuplicates = detections => {
        const grouped = new Map();

        detections.forEach(detection => {
            const key = detection.entity.id;
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(detection);
        });

        const aggregated = [];
        grouped.forEach(group => {
            const totalCount = group.reduce((sum, d) => sum + (d.count || 1), 0);
            const maxConfidence = Math.max(...group.map(d => d.confidence));
            const firstDetection = group[0];

            aggregated.push({
                entity: firstDetection.entity,
                confidence: maxConfidence,
                count: totalCount,
            });
        });

        return aggregated.sort((a, b) => a.entity.name.localeCompare(b.entity.name));
    };

    const mockDetections = [
        { entity: { id: 'wrench', name: 'Wrench' }, confidence: 0.85, count: 1 },
        { entity: { id: 'wrench', name: 'Wrench' }, confidence: 0.9, count: 1 },
        { entity: { id: 'wrench', name: 'Wrench' }, confidence: 0.82, count: 1 },
        { entity: { id: 'battery', name: 'Battery' }, confidence: 0.88, count: 1 },
    ];

    const result = aggregateDuplicates(mockDetections);

    console.log('='.repeat(60));
    console.log('TEST 1: AGGREGATION LOGIC');
    console.log('='.repeat(60));
    console.log('Input: 4 detections (3x Wrench, 1x Battery)');
    console.log('Expected: 2 unique items, Wrench x3, Battery x1\n');

    const wrench = result.find(r => r.entity.id === 'wrench');
    const battery = result.find(r => r.entity.id === 'battery');

    console.log('Result:');
    console.log(`  - ${wrench.entity.name} x${wrench.count} (${(wrench.confidence * 100).toFixed(0)}% confidence)`);
    console.log(`  - ${battery.entity.name} x${battery.count} (${(battery.confidence * 100).toFixed(0)}% confidence)`);
    console.log('');

    const pass = result.length === 2 && wrench.count === 3 && wrench.confidence === 0.9 && battery.count === 1;

    console.log(pass ? '✅ PASS' : '❌ FAIL');
    console.log('');
    return pass;
}

// Test 2: Adaptive Threshold Logic
function testAdaptiveThreshold() {
    const calculateAdaptiveThreshold = similarities => {
        if (similarities.length === 0) return 0.75;

        const sorted = [...similarities].sort((a, b) => b - a);

        let maxGap = 0;
        let gapIndex = 0;

        for (let i = 0; i < sorted.length - 1; i++) {
            const gap = sorted[i] - sorted[i + 1];
            if (gap > maxGap) {
                maxGap = gap;
                gapIndex = i;
            }
        }

        if (maxGap > 0.05) {
            const threshold = sorted[gapIndex + 1] + 0.02;
            return Math.max(0.6, Math.min(0.9, threshold));
        }

        const percentile75Index = Math.floor(sorted.length * 0.25);
        const threshold = sorted[percentile75Index];
        return Math.max(0.65, Math.min(0.85, threshold));
    };

    console.log('='.repeat(60));
    console.log('TEST 2: ADAPTIVE THRESHOLD');
    console.log('='.repeat(60));

    // Test with clear gap between good and bad matches
    const scores = [0.95, 0.92, 0.88, 0.85, 0.82, 0.58, 0.52, 0.48, 0.42];
    const threshold = calculateAdaptiveThreshold(scores);

    console.log('Input: Similarity scores with clear gap');
    console.log(
        'High scores:',
        scores
            .slice(0, 5)
            .map(s => s.toFixed(2))
            .join(', ')
    );
    console.log(
        'Low scores:',
        scores
            .slice(5)
            .map(s => s.toFixed(2))
            .join(', ')
    );
    console.log('Gap: between 0.82 and 0.58 (0.24)\n');

    console.log(`Calculated threshold: ${threshold.toFixed(3)}`);
    console.log(`Expected: ~0.60-0.65 (just above low scores)\n`);

    const pass = threshold >= 0.58 && threshold <= 0.7;
    console.log(pass ? '✅ PASS' : '❌ FAIL');
    console.log('');
    return pass;
}

// Test 3: Grid Size Selection
function testGridSizeSelection() {
    const detectResolution = (width, height) => {
        const resolutions = [
            { name: '720p', width: 1280, height: 720, category: '720p' },
            { name: '1080p', width: 1920, height: 1080, category: '1080p' },
            { name: '1440p', width: 2560, height: 1440, category: '1440p' },
            { name: '4K', width: 3840, height: 2160, category: '4K' },
            { name: 'Steam Deck', width: 1280, height: 800, category: 'steam_deck' },
        ];

        let closest = resolutions[0];
        let minDiff = Infinity;

        for (const res of resolutions) {
            const diff = Math.abs(width - res.width) + Math.abs(height - res.height);
            if (diff < minDiff) {
                minDiff = diff;
                closest = res;
            }
        }

        return closest;
    };

    const getGridSize = (width, height) => {
        const resolution = detectResolution(width, height);
        const gridSizes = {
            '720p': 48,
            '1080p': 64,
            '1440p': 80,
            '4K': 96,
            steam_deck: 52,
        };
        return gridSizes[resolution.category] || 64;
    };

    console.log('='.repeat(60));
    console.log('TEST 3: GRID SIZE SELECTION');
    console.log('='.repeat(60));

    const tests = [
        { width: 1920, height: 1080, expected: 64, name: '1080p' },
        { width: 1280, height: 720, expected: 48, name: '720p' },
        { width: 3840, height: 2160, expected: 96, name: '4K' },
        { width: 1280, height: 800, expected: 52, name: 'Steam Deck' },
    ];

    let allPass = true;

    tests.forEach(test => {
        const gridSize = getGridSize(test.width, test.height);
        const pass = gridSize === test.expected;
        allPass = allPass && pass;

        console.log(`${test.name} (${test.width}x${test.height}):`);
        console.log(`  Expected: ${test.expected}px, Got: ${gridSize}px`);
        console.log(`  ${pass ? '✅ PASS' : '❌ FAIL'}`);
    });

    console.log('');
    console.log(allPass ? '✅ ALL PASS' : '❌ SOME FAIL');
    console.log('');
    return allPass;
}

// Test 4: Empty Cell Variance Calculation
function testEmptyCellDetection() {
    console.log('='.repeat(60));
    console.log('TEST 4: EMPTY CELL DETECTION (Variance Calculation)');
    console.log('='.repeat(60));

    const calculateVariance = pixels => {
        let sumR = 0,
            sumG = 0,
            sumB = 0;
        let sumSquareR = 0,
            sumSquareG = 0,
            sumSquareB = 0;
        let count = 0;

        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];

            sumR += r;
            sumG += g;
            sumB += b;
            sumSquareR += r * r;
            sumSquareG += g * g;
            sumSquareB += b * b;
            count++;
        }

        const meanR = sumR / count;
        const meanG = sumG / count;
        const meanB = sumB / count;

        const varianceR = sumSquareR / count - meanR * meanR;
        const varianceG = sumSquareG / count - meanG * meanG;
        const varianceB = sumSquareB / count - meanB * meanB;

        return varianceR + varianceG + varianceB;
    };

    // Simulate uniform blue background (empty cell)
    const uniformPixels = new Array(64 * 64 * 4);
    for (let i = 0; i < uniformPixels.length; i += 4) {
        uniformPixels[i] = 50; // R
        uniformPixels[i + 1] = 150; // G
        uniformPixels[i + 2] = 200; // B
        uniformPixels[i + 3] = 255; // A
    }

    // Simulate varied colors (item icon)
    const variedPixels = new Array(64 * 64 * 4);
    for (let i = 0; i < variedPixels.length; i += 4) {
        variedPixels[i] = Math.floor(Math.random() * 255);
        variedPixels[i + 1] = Math.floor(Math.random() * 255);
        variedPixels[i + 2] = Math.floor(Math.random() * 255);
        variedPixels[i + 3] = 255;
    }

    const uniformVariance = calculateVariance(uniformPixels);
    const variedVariance = calculateVariance(variedPixels);

    console.log('Uniform background (empty cell):');
    console.log(`  Variance: ${uniformVariance.toFixed(1)}`);
    console.log(`  Expected: <500 (low variance)`);
    console.log(`  ${uniformVariance < 500 ? '✅ PASS' : '❌ FAIL'}\n`);

    console.log('Varied colors (item icon):');
    console.log(`  Variance: ${variedVariance.toFixed(1)}`);
    console.log(`  Expected: >500 (high variance)`);
    console.log(`  ${variedVariance > 500 ? '✅ PASS' : '❌ FAIL'}\n`);

    const pass = uniformVariance < 500 && variedVariance > 500;
    console.log(pass ? '✅ ALL PASS' : '❌ SOME FAIL');
    console.log('');
    return pass;
}

// Run all tests
console.log('\n🧪 RUNNING STANDALONE TESTS (No Browser Required)\n');

const results = {
    aggregation: testAggregation(),
    threshold: testAdaptiveThreshold(),
    gridSize: testGridSizeSelection(),
    emptyCell: testEmptyCellDetection(),
};

console.log('='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));
Object.entries(results).forEach(([name, pass]) => {
    console.log(`${pass ? '✅' : '❌'} ${name}: ${pass ? 'PASS' : 'FAIL'}`);
});

const totalPass = Object.values(results).filter(r => r).length;
const total = Object.values(results).length;

console.log('');
console.log(`${totalPass}/${total} tests passed`);
console.log('');

if (totalPass === total) {
    console.log('🎉 ALL TESTS PASSED!');
    console.log('');
    console.log('Core logic verified:');
    console.log('  ✅ Duplicate aggregation works');
    console.log('  ✅ Adaptive threshold calculation correct');
    console.log('  ✅ Grid size adapts to resolution');
    console.log('  ✅ Empty cell detection logic sound');
    console.log('');
    console.log('⚠️  Note: Canvas-based template matching requires browser');
    console.log('    Run full tests with: bash scripts/test-template-matching.sh');
} else {
    console.log('❌ SOME TESTS FAILED - Check implementation');
}

process.exit(totalPass === total ? 0 : 1);
