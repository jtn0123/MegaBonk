const gt = require('../test-images/gameplay/ground-truth.json');
const items = require('../data/items.json');

const templateNames = new Set(items.items.map(i => i.name.toLowerCase()));
const templateIds = new Set(items.items.map(i => i.id));

const allExpected = new Set();
Object.entries(gt).forEach(([k, v]) => {
    if (k.startsWith('_')) return;
    (v.items || []).forEach(i => allExpected.add(i));
});

console.log('Missing templates needed for ground truth:');
const missing = [];
[...allExpected].sort().forEach(name => {
    const lower = name.toLowerCase();
    const id = lower.replace(/[^a-z0-9]+/g, '-');
    const hasName = templateNames.has(lower);
    const hasId = templateIds.has(id);
    if (!hasName && !hasId) {
        missing.push(name);
        console.log('  -', name);
    }
});

console.log(`\nTotal missing: ${missing.length}`);
console.log(`Total expected unique items: ${allExpected.size}`);
console.log(`Coverage: ${((allExpected.size - missing.length) / allExpected.size * 100).toFixed(1)}%`);
