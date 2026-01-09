#!/usr/bin/env node
/**
 * Inject version into service worker for cache busting
 * Reads version from package.json and updates sw.js CACHE_NAME
 *
 * Usage: node scripts/inject-version.js
 */

const fs = require('fs');
const path = require('path');

const PACKAGE_JSON = path.join(__dirname, '../package.json');
const SW_FILE = path.join(__dirname, '../src/sw.js');

function injectVersion() {
    console.log('📦 Injecting version into service worker...\n');

    // Read package.json
    const packageData = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8'));
    const version = packageData.version || '1.0.0';
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    console.log(`   Version: ${version}`);
    console.log(`   Date: ${timestamp}\n`);

    // Read service worker
    let swContent = fs.readFileSync(SW_FILE, 'utf-8');

    // Replace cache name with versioned name
    const cacheNameRegex = /const CACHE_NAME = ['"]megabonk-guide-v[\d.]+['"]/;
    const newCacheName = `const CACHE_NAME = 'megabonk-guide-v${version}-${timestamp}'`;

    if (cacheNameRegex.test(swContent)) {
        swContent = swContent.replace(cacheNameRegex, newCacheName);
        fs.writeFileSync(SW_FILE, swContent);
        console.log(`✓ Updated ${SW_FILE}`);
        console.log(`   New cache name: megabonk-guide-v${version}-${timestamp}\n`);
    } else {
        console.error('✗ Could not find CACHE_NAME in service worker');
        console.error('   Expected pattern: const CACHE_NAME = \'megabonk-guide-v...\'\n');
        process.exit(1);
    }

    console.log('✅ Version injection complete!');
    console.log('💡 Remember to commit the updated sw.js file\n');
}

try {
    injectVersion();
} catch (error) {
    console.error('❌ Error injecting version:', error.message);
    process.exit(1);
}
