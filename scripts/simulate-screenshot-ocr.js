/**
 * Simulate OCR detection on Level 38 screenshot
 *
 * This script simulates what would happen if we ran OCR on the Level 38
 * screenshot and tested the fuzzy matching against ground truth.
 *
 * Real OCR would introduce typos, case variations, and spacing issues.
 * This simulation adds realistic OCR errors to test matching robustness.
 */

const fs = require('fs');
const Fuse = require('fuse.js');

// Load game data
console.log('Loading game data...');
const itemsData = JSON.parse(fs.readFileSync('./data/items.json', 'utf-8'));
const groundTruthData = JSON.parse(fs.readFileSync('./test-images/gameplay/ground-truth.json', 'utf-8'));

console.log(`✓ Loaded ${itemsData.items.length} items from database\n`);

// Initialize Fuse.js
const fuseOptions = {
    includeScore: true,
    threshold: 0.4,
    keys: ['name'],
    ignoreLocation: true,
    ignoreFieldNorm: true,
};

const itemFuse = new Fuse(itemsData.items, fuseOptions);

// Detection function
function detectItemsFromText(text) {
    const lines = text.split('\n').filter(line => line.trim().length > 2);
    const detections = [];

    for (const line of lines) {
        const results = itemFuse.search(line);

        if (results.length > 0 && results[0].score !== undefined) {
            const match = results[0];
            if (match.score < 0.4) {
                detections.push({
                    name: match.item.name,
                    confidence: (1 - match.score) * 100,
                    rawText: line.trim(),
                    score: match.score,
                });
            }
        }
    }

    return detections;
}

// Simulate realistic OCR errors
function simulateOCROutput(itemName) {
    const variations = [];

    // Perfect extraction
    variations.push(itemName);

    // Common OCR errors:
    // - Case variations
    if (Math.random() > 0.7) {
        variations.push(itemName.toUpperCase());
    }
    if (Math.random() > 0.7) {
        variations.push(itemName.toLowerCase());
    }

    // - Extra spaces
    if (Math.random() > 0.8) {
        variations.push(itemName.replace(/ /g, '  '));
    }

    // - Missing spaces
    if (Math.random() > 0.9) {
        variations.push(itemName.replace(/ /g, ''));
    }

    // - Character substitutions (OCR errors)
    if (Math.random() > 0.85) {
        let corrupted = itemName;
        corrupted = corrupted.replace(/i/g, 'l'); // i -> l
        corrupted = corrupted.replace(/o/g, '0'); // o -> 0
        corrupted = corrupted.replace(/s/g, '5'); // s -> 5
        variations.push(corrupted);
    }

    return variations[Math.floor(Math.random() * variations.length)];
}

// Get ground truth for Level 38
const level38 = groundTruthData['level_38_boss_portal_clean.png'];
const groundTruth = level38.items;

console.log('='.repeat(60));
console.log('🎮 SCREENSHOT: Level 38 - Boss Portal (Baseline Test)');
console.log('='.repeat(60));
console.log('');
console.log(`📊 Ground Truth: ${groundTruth.length} items`);
console.log(`🎯 Target Accuracy: 80-90%`);
console.log('');

// Simulate OCR extraction with realistic errors
console.log('Simulating OCR text extraction...');
console.log('-'.repeat(60));

const simulatedOCRText = groundTruth
    .map(item => {
        // Remove count notation for pure item names
        const itemName = item.replace(/\s*\(x\d+\)/, '');
        const ocrText = simulateOCROutput(itemName);

        // Show what "OCR" extracted
        if (ocrText !== itemName) {
            console.log(`  OCR: "${ocrText}" (from "${itemName}")`);
        }

        return ocrText;
    })
    .join('\n');

console.log(`\n✓ Extracted ${simulatedOCRText.split('\n').length} lines of text\n`);

// Run detection
console.log('Running fuzzy matching detection...');
console.log('-'.repeat(60));

const detected = detectItemsFromText(simulatedOCRText);

console.log(`\n✓ Detected ${detected.length} items\n`);

// Calculate accuracy metrics
const detectedNames = detected.map(d => d.name);
const groundTruthNames = groundTruth.map(item => item.replace(/\s*\(x\d+\)/, ''));

// True positives: items correctly detected
const truePositives = [];
const matched = new Set();

for (const detected of detectedNames) {
    for (let i = 0; i < groundTruthNames.length; i++) {
        if (!matched.has(i) && groundTruthNames[i] === detected) {
            truePositives.push(detected);
            matched.add(i);
            break;
        }
    }
}

// False negatives: items in ground truth but not detected
const falseNegatives = groundTruthNames.filter((item, idx) => !matched.has(idx));

// False positives: detected items not in ground truth
const falsePositives = detectedNames.filter(d => !groundTruthNames.includes(d));

// Metrics
const precision = truePositives.length / detectedNames.length;
const recall = truePositives.length / groundTruthNames.length;
const accuracy = (truePositives.length / groundTruthNames.length) * 100;
const f1Score = (2 * (precision * recall)) / (precision + recall);

// Results
console.log('='.repeat(60));
console.log('📊 DETECTION RESULTS');
console.log('='.repeat(60));
console.log('');

console.log(`Ground Truth Items:  ${groundTruthNames.length}`);
console.log(`Detected Items:      ${detectedNames.length}`);
console.log(`True Positives:      ${truePositives.length} ✅`);
console.log(`False Negatives:     ${falseNegatives.length} ❌ (missed)`);
console.log(`False Positives:     ${falsePositives.length} ⚠️  (wrong)`);
console.log('');

console.log(`Accuracy:            ${accuracy.toFixed(1)}%`);
console.log(`Precision:           ${(precision * 100).toFixed(1)}%`);
console.log(`Recall:              ${(recall * 100).toFixed(1)}%`);
console.log(`F1 Score:            ${(f1Score * 100).toFixed(1)}%`);
console.log('');

if (accuracy >= 80) {
    console.log('🎉 EXCELLENT! Meets 80-90% target for baseline test');
} else if (accuracy >= 70) {
    console.log('⚠️  GOOD but below 80% target - needs tuning');
} else {
    console.log('❌ POOR - significant improvements needed');
}

console.log('');

// Detailed breakdown
if (falseNegatives.length > 0) {
    console.log('❌ Missed Items (False Negatives):');
    console.log('-'.repeat(60));
    falseNegatives.forEach(item => {
        console.log(`  - ${item}`);

        // Try to find why it was missed
        const testResult = itemFuse.search(item);
        if (testResult.length > 0) {
            const topMatch = testResult[0];
            if (topMatch.score >= 0.4) {
                console.log(
                    `    → Best match: "${topMatch.item.name}" (score: ${topMatch.score.toFixed(3)}, threshold: 0.4)`
                );
                console.log(`    → ISSUE: Score too high (not confident enough)`);
            }
        } else {
            console.log(`    → ISSUE: No match found in database`);
        }
    });
    console.log('');
}

if (falsePositives.length > 0) {
    console.log('⚠️  False Positives (Incorrectly Detected):');
    console.log('-'.repeat(60));
    falsePositives.forEach(item => {
        console.log(`  - ${item}`);
    });
    console.log('');
}

// Show sample detections with confidence
console.log('✅ Sample Correct Detections:');
console.log('-'.repeat(60));
detected
    .filter(d => groundTruthNames.includes(d.name))
    .slice(0, 10)
    .forEach(d => {
        console.log(`  - ${d.name} (${d.confidence.toFixed(1)}% confidence)`);
        if (d.rawText !== d.name) {
            console.log(`    OCR text: "${d.rawText}"`);
        }
    });

console.log('');
console.log('='.repeat(60));
console.log('📋 RECOMMENDATIONS');
console.log('='.repeat(60));
console.log('');

if (falseNegatives.length > 0) {
    console.log('To improve detection of missed items:');
    console.log('  1. Lower fuzzy match threshold (currently 0.4 → try 0.5)');
    console.log('  2. Add item name aliases to database');
    console.log('  3. Improve OCR preprocessing (contrast, noise reduction)');
    console.log('  4. Check if item names in items.json match exactly');
    console.log('');
}

if (falsePositives.length > 0) {
    console.log('To reduce false positives:');
    console.log('  1. Raise confidence threshold');
    console.log('  2. Add validation rules (check item context)');
    console.log('  3. Use CV to verify item presence');
    console.log('');
}

console.log('Next Steps:');
console.log('  1. Save Screenshot 5 from chat → test-images/gameplay/pc-1080p/');
console.log('  2. Run: bun run dev');
console.log('  3. Test in browser: Advisor → Build Scanner → Upload → Detect');
console.log('  4. Validate with console script from QUICK_TEST_GUIDE.md');
console.log('');

// Check specific problematic items from previous test
console.log('='.repeat(60));
console.log('🔍 CHECKING SPECIFIC ITEMS FROM PREVIOUS TEST');
console.log('='.repeat(60));
console.log('');

const problematicItems = ['First Aid Kit', 'Banana', 'Battery', 'Wrench'];

problematicItems.forEach(itemName => {
    console.log(`Testing: "${itemName}"`);

    const results = itemFuse.search(itemName);

    if (results.length > 0) {
        const topMatch = results[0];
        if (topMatch.score < 0.4) {
            console.log(
                `  ✓ DETECTED: "${topMatch.item.name}" (confidence: ${((1 - topMatch.score) * 100).toFixed(1)}%)`
            );
        } else {
            console.log(
                `  ✗ NOT DETECTED: Best match "${topMatch.item.name}" (score: ${topMatch.score.toFixed(3)} > threshold 0.4)`
            );
        }
    } else {
        console.log(`  ✗ NOT DETECTED: No matches found`);
    }

    // Check if item exists in database
    const exactMatch = itemsData.items.find(item => item.name === itemName);
    if (!exactMatch) {
        console.log(`  ⚠️  WARNING: "${itemName}" not found in items.json!`);

        // Try to find similar items
        const similar = itemsData.items.filter(
            item =>
                item.name.toLowerCase().includes(itemName.toLowerCase()) ||
                itemName.toLowerCase().includes(item.name.toLowerCase())
        );

        if (similar.length > 0) {
            console.log(`  → Similar items in database:`);
            similar.forEach(s => console.log(`     - "${s.name}"`));
        }
    } else {
        console.log(`  ✓ Item exists in database: "${exactMatch.name}" (${exactMatch.rarity})`);
    }

    console.log('');
});

console.log('='.repeat(60));
console.log('Test complete!');
console.log('');
