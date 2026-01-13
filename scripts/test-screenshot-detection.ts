/**
 * Test OCR detection on actual screenshots
 * Usage: bun run scripts/test-screenshot-detection.ts <screenshot-path>
 */

import { readFileSync } from 'fs';
import { initOCR, detectItemsFromText, detectTomesFromText } from '../src/modules/ocr.ts';
import type { AllGameData } from '../src/types/index.ts';

// Load game data
const itemsData = JSON.parse(readFileSync('./data/items.json', 'utf-8'));
const tomesData = JSON.parse(readFileSync('./data/tomes.json', 'utf-8'));
const charactersData = JSON.parse(readFileSync('./data/characters.json', 'utf-8'));
const weaponsData = JSON.parse(readFileSync('./data/weapons.json', 'utf-8'));

const gameData: AllGameData = {
    items: itemsData,
    tomes: tomesData,
    characters: charactersData,
    weapons: weaponsData,
    stats: { version: '1.0', last_updated: '2024-01-01' },
};

// Initialize OCR
console.log('Initializing OCR...');
initOCR(gameData);
console.log('✓ OCR initialized');
console.log(`  - Items indexed: ${itemsData.items.length}`);
console.log(`  - Tomes indexed: ${tomesData.tomes.length}`);
console.log(`  - Characters indexed: ${charactersData.characters.length}`);
console.log(`  - Weapons indexed: ${weaponsData.weapons.length}`);
console.log('');

// Test with sample text (simulating OCR output)
const sampleTexts = [
    'First Aid Kit',
    'Battery',
    'Gym Sauce',
    'Wrench',
    'Banana',
    'First Aid Kit\nBattery\nGym Sauce',
    'First Ald Kit', // Typo
    'Battry', // Typo
];

console.log('Testing OCR detection with sample text:');
console.log('========================================');

for (const text of sampleTexts) {
    console.log(`\nInput: "${text}"`);
    const items = detectItemsFromText(text);

    if (items.length > 0) {
        console.log(`✓ Detected ${items.length} item(s):`);
        items.forEach(item => {
            console.log(`  - ${item.entity.name} (confidence: ${(item.confidence * 100).toFixed(1)}%)`);
        });
    } else {
        console.log('✗ No items detected');
    }
}

console.log('\n========================================');
console.log('Testing complete!');
console.log('');
console.log('To test with real screenshots:');
console.log('1. Save a screenshot to test-images/gameplay/pc-1080p/');
console.log('2. Start the dev server: bun run dev');
console.log('3. Open http://localhost:5173');
console.log('4. Go to Advisor → Build Scanner');
console.log('5. Upload the screenshot and run detection');
