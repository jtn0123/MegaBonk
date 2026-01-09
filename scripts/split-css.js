#!/usr/bin/env node
/**
 * Split styles.css into organized modules:
 * - base.css: Variables, resets, global styles
 * - components.css: UI components (buttons, cards, modals, etc.)
 * - responsive.css: All media queries
 * - utilities.css: Utility classes
 *
 * Usage: node scripts/split-css.js
 */

const fs = require('fs');
const path = require('path');

const CSS_FILE = path.join(__dirname, '../src/styles.css');
const OUTPUT_DIR = path.join(__dirname, '../src/styles');

// Section markers that indicate different CSS categories
const SECTIONS = {
    base: [
        'MegaBonk Item Scaling Guide Styles',
        'Focus States',
        'Better selection color',
        'Better scrollbar',
    ],
    components: [
        'Header',
        'Tab Navigation',
        'Navigation & Controls',
        'Stats Panel',
        'Items Grid',
        'Modal',
        'Footer',
        'Build Planner',
        'Shrines Grid',
        'Character & Weapon',
        'Compare Mode',
        'Breakpoint Calculator',
        'Scaling Charts',
        'Empty State',
        'Loading Overlay',
        'Error Messages',
        'Expandable Text',
        'Modal Images',
        'One-and-Done',
        'Stack Info',
        'Search History',
        'Favorites',
        'Toast',
        'Changelog',
    ],
    utilities: ['Utility Classes'],
};

function splitCSS() {
    console.log('📄 Reading styles.css...');
    const css = fs.readFileSync(CSS_FILE, 'utf-8');
    const lines = css.split('\n');

    const files = {
        base: [],
        components: [],
        responsive: [],
        utilities: [],
    };

    let currentSection = 'base';
    let inMediaQuery = false;
    let mediaQueryBuffer = [];
    let mediaQueryDepth = 0;

    console.log('✂️  Splitting CSS...\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Detect media queries
        if (line.includes('@media')) {
            inMediaQuery = true;
            mediaQueryDepth = 0;
            mediaQueryBuffer = [line];
            continue;
        }

        // Track media query depth
        if (inMediaQuery) {
            mediaQueryBuffer.push(line);

            if (line.includes('{')) mediaQueryDepth++;
            if (line.includes('}')) mediaQueryDepth--;

            // Media query complete
            if (mediaQueryDepth === 0 && line.includes('}')) {
                files.responsive.push(...mediaQueryBuffer, '');
                inMediaQuery = false;
                mediaQueryBuffer = [];
            }
            continue;
        }

        // Detect section changes
        const sectionLine = line.trim();
        if (sectionLine.startsWith('/*') && sectionLine.includes('===')) {
            const nextLine = lines[i + 1] || '';

            // Check which category this section belongs to
            for (const [category, keywords] of Object.entries(SECTIONS)) {
                if (keywords.some(keyword => nextLine.includes(keyword))) {
                    currentSection = category;
                    break;
                }
            }
        }

        // Add line to current section
        if (!inMediaQuery) {
            files[currentSection].push(line);
        }
    }

    // Create output directory
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`✓ Created directory: ${OUTPUT_DIR}`);
    }

    // Write files
    const header = `/* ========================================
   MegaBonk Guide - CSS Module
   Auto-generated from styles.css
   ======================================== */

`;

    for (const [name, content] of Object.entries(files)) {
        const outputPath = path.join(OUTPUT_DIR, `${name}.css`);
        const finalContent = header + content.join('\n');
        fs.writeFileSync(outputPath, finalContent);

        const lineCount = content.length;
        const sizeKB = (Buffer.byteLength(finalContent, 'utf-8') / 1024).toFixed(1);
        console.log(`✓ ${name}.css - ${lineCount} lines, ${sizeKB} KB`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ CSS Split Complete!');
    console.log('='.repeat(60));
    console.log('\n💡 Next steps:');
    console.log('   1. Update src/index.html to load the new CSS files');
    console.log('   2. Remove or rename the old styles.css');
    console.log('   3. Test the app to ensure styling is intact');
}

try {
    splitCSS();
} catch (error) {
    console.error('❌ Error splitting CSS:', error);
    process.exit(1);
}
