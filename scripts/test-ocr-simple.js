/**
 * Simple OCR detection test with game data
 * Tests fuzzy matching without browser dependencies
 */

const fs = require('fs');
const Fuse = require('fuse.js');

// Load game data
console.log('Loading game data...');
const itemsData = JSON.parse(fs.readFileSync('./data/items.json', 'utf-8'));

console.log(`✓ Loaded ${itemsData.items.length} items\n`);

// Initialize Fuse.js for fuzzy matching
const fuseOptions = {
    includeScore: true,
    threshold: 0.4, // 0 = perfect match, 1 = match anything
    keys: ['name'],
    ignoreLocation: true,
};

const itemFuse = new Fuse(itemsData.items, fuseOptions);

// Test detection function
function detectItemsFromText(text) {
    const lines = text.split('\n').filter(line => line.trim().length > 2);
    const detections = [];

    for (const line of lines) {
        const results = itemFuse.search(line);

        if (results.length > 0 && results[0].score !== undefined) {
            const match = results[0];
            // Only include matches with confidence > 60%
            if (match.score < 0.4) {
                detections.push({
                    name: match.item.name,
                    confidence: (1 - match.score) * 100,
                    rawText: line.trim(),
                });
            }
        }
    }

    return detections;
}

// Test cases
console.log('Testing OCR detection with sample text:');
console.log('========================================\n');

const testCases = [
    { input: 'First Aid Kit', expected: 'First Aid Kit' },
    { input: 'Battery', expected: 'Battery' },
    { input: 'Gym Sauce', expected: 'Gym Sauce' },
    { input: 'Wrench', expected: 'Wrench' },
    { input: 'Banana', expected: 'Banana' },
    { input: 'First Aid Kit\nBattery\nGym Sauce', expected: '3 items' },
    { input: 'First Ald Kit', expected: 'First Aid Kit (typo)' },
    { input: 'Battry', expected: 'Battery (typo)' },
    { input: 'Battary', expected: 'Battery (typo)' },
    { input: 'FIRST AID KIT', expected: 'First Aid Kit (uppercase)' },
    { input: '123 Wrench x5 $$$', expected: 'Wrench (with noise)' },
];

let passCount = 0;
let failCount = 0;

for (const test of testCases) {
    console.log(`Test: "${test.input}"`);
    console.log(`Expected: ${test.expected}`);

    const detected = detectItemsFromText(test.input);

    if (detected.length > 0) {
        console.log(`✓ Detected ${detected.length} item(s):`);
        detected.forEach(item => {
            console.log(`  - ${item.name} (${item.confidence.toFixed(1)}% confidence)`);
        });
        passCount++;
    } else {
        console.log('✗ No items detected');
        failCount++;
    }

    console.log('');
}

console.log('========================================');
console.log(`Results: ${passCount} passed, ${failCount} failed`);
console.log('');

// Test with items from the actual game
console.log('Sample items from the database:');
console.log('--------------------------------');
itemsData.items.slice(0, 10).forEach(item => {
    console.log(`  - ${item.name} (${item.rarity})`);
});

console.log('');
console.log('To test with real screenshots:');
console.log('1. Save a screenshot to test-images/gameplay/pc-1080p/');
console.log('2. Start the dev server: bun run dev');
console.log('3. Open http://localhost:5173');
console.log('4. Go to Advisor → Build Scanner');
console.log('5. Upload the screenshot and click "🎯 Hybrid: OCR + CV"');
