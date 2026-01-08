#!/usr/bin/env node
/**
 * MegaBonk Changelog Fetcher
 *
 * Fetches patch notes from Steam News API and outputs structured JSON
 * for manual review before committing to changelog.json.
 *
 * Usage:
 *   node scripts/fetch-changelog.js              # Fetch latest patch only
 *   node scripts/fetch-changelog.js --all        # Fetch all available patches
 *   node scripts/fetch-changelog.js --count=5    # Fetch last 5 patches
 *
 * Output goes to stdout. Redirect to file:
 *   node scripts/fetch-changelog.js > temp-changelog.json
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Steam App ID for MegaBonk
const STEAM_APP_ID = '3405340';

// Steam News API endpoint
const STEAM_NEWS_URL = `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${STEAM_APP_ID}&count=20&format=json`;

// ========================================
// Load Game Data for Entity Auto-Detection
// ========================================

const DATA_PATH = path.join(__dirname, '..', 'data');

function loadGameData() {
    const data = {};
    try {
        data.items = JSON.parse(fs.readFileSync(path.join(DATA_PATH, 'items.json'), 'utf8'));
        data.weapons = JSON.parse(fs.readFileSync(path.join(DATA_PATH, 'weapons.json'), 'utf8'));
        data.tomes = JSON.parse(fs.readFileSync(path.join(DATA_PATH, 'tomes.json'), 'utf8'));
        data.characters = JSON.parse(fs.readFileSync(path.join(DATA_PATH, 'characters.json'), 'utf8'));
        data.shrines = JSON.parse(fs.readFileSync(path.join(DATA_PATH, 'shrines.json'), 'utf8'));
    } catch (e) {
        console.error('Warning: Could not load game data for auto-linking:', e.message);
    }
    return data;
}

/**
 * Build entity lookup map for auto-detection
 */
function buildEntityMap(gameData) {
    const map = {};

    // Helper to add entities from a collection
    const addEntities = (collection, key, type) => {
        if (!collection?.[key]) return;
        collection[key].forEach(entity => {
            if (entity.name && entity.id) {
                map[entity.name.toLowerCase()] = { type, id: entity.id, name: entity.name };
            }
        });
    };

    addEntities(gameData.items, 'items', 'item');
    addEntities(gameData.weapons, 'weapons', 'weapon');
    addEntities(gameData.tomes, 'tomes', 'tome');
    addEntities(gameData.characters, 'characters', 'character');
    addEntities(gameData.shrines, 'shrines', 'shrine');

    return map;
}

// ========================================
// Text Processing
// ========================================

/**
 * Escape regex special characters
 */
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Auto-detect entity references in text and convert to link format
 */
function autoLinkEntities(text, entityMap) {
    if (!text || !entityMap || Object.keys(entityMap).length === 0) return text;

    let result = text;

    // Sort entity names by length (longest first) to avoid partial matches
    const sortedNames = Object.keys(entityMap).sort((a, b) => b.length - a.length);

    for (const nameLower of sortedNames) {
        const entity = entityMap[nameLower];
        // Case-insensitive match with word boundaries
        const regex = new RegExp(`\\b${escapeRegex(entity.name)}\\b`, 'gi');
        result = result.replace(regex, `[[${entity.type}:${entity.id}|${entity.name}]]`);
    }

    return result;
}

/**
 * Extract version number from title
 */
function extractVersion(title) {
    const match = title.match(/v?(\d+\.\d+(?:\.\d+)?)/i);
    return match ? match[1] : null;
}

/**
 * Detect change type from text
 */
function detectChangeType(text) {
    const lower = text.toLowerCase();
    if (lower.includes('increased') || lower.includes('buffed') || lower.includes('improved') || lower.includes('boost')) return 'buff';
    if (lower.includes('decreased') || lower.includes('nerfed') || lower.includes('reduced') || lower.includes('lower')) return 'nerf';
    if (lower.includes('added') || lower.includes('new') || lower.includes('introduced')) return 'addition';
    if (lower.includes('removed') || lower.includes('deleted')) return 'removal';
    if (lower.includes('fixed') || lower.includes('fix') || lower.includes('resolved')) return 'fix';
    return 'change';
}

/**
 * Extract affected entities from text
 */
function extractAffectedEntities(text, entityMap) {
    const entities = [];
    const lower = text.toLowerCase();

    for (const [name, entity] of Object.entries(entityMap)) {
        if (lower.includes(name)) {
            entities.push({ type: entity.type, id: entity.id });
        }
    }

    return entities;
}

/**
 * Detect category from line context
 */
function detectCategory(line) {
    const lower = line.toLowerCase();
    if (lower.includes('balance') || lower.includes('changes') || lower.includes('buff') || lower.includes('nerf')) {
        return 'balance';
    }
    if (lower.includes('new') || lower.includes('added') || lower.includes('content')) {
        return 'new_content';
    }
    if (lower.includes('fix') || lower.includes('bug') || lower.includes('issue')) {
        return 'bug_fixes';
    }
    if (lower.includes('removed') || lower.includes('deleted')) {
        return 'removed';
    }
    return null;
}

/**
 * Parse raw patch notes into structured format
 */
function parsePatchNotes(newsItem, entityMap) {
    const content = newsItem.contents || '';

    // Strip HTML tags
    const plainText = content
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\[.*?\]/g, ''); // Remove BBCode-style tags

    const lines = plainText.split('\n').filter(l => l.trim());

    const patch = {
        id: `patch_${newsItem.gid || Date.now()}`,
        version: extractVersion(newsItem.title) || 'Unknown',
        title: newsItem.title,
        date: new Date(newsItem.date * 1000).toISOString().split('T')[0],
        steam_url: newsItem.url || `https://store.steampowered.com/news/app/${STEAM_APP_ID}`,
        summary: lines[0]?.substring(0, 200) || '',
        categories: {
            balance: [],
            new_content: [],
            bug_fixes: [],
            removed: [],
            other: []
        },
        raw_notes: plainText
    };

    // Parse lines into categories
    let currentCategory = 'other';

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Check if this is a section header
        const detectedCategory = detectCategory(trimmed);
        if (detectedCategory && !trimmed.startsWith('-') && !trimmed.startsWith('*')) {
            currentCategory = detectedCategory;
            continue;
        }

        // Parse change lines (lines starting with -, *, or bullet points)
        if (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.match(/^[•·]/)) {
            const changeText = trimmed.substring(1).trim();
            if (!changeText) continue;

            const linkedText = autoLinkEntities(changeText, entityMap);
            const changeType = detectChangeType(changeText);
            const affectedEntities = extractAffectedEntities(changeText, entityMap);

            patch.categories[currentCategory].push({
                text: linkedText,
                change_type: changeType,
                affected_entities: affectedEntities
            });
        }
    }

    return patch;
}

// ========================================
// Steam API
// ========================================

/**
 * Fetch Steam news via API
 */
async function fetchSteamNews() {
    return new Promise((resolve, reject) => {
        https.get(STEAM_NEWS_URL, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.appnews?.newsitems || []);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// ========================================
// Main
// ========================================

async function main() {
    const args = process.argv.slice(2);
    const fetchAll = args.includes('--all');
    const countArg = args.find(a => a.startsWith('--count='));
    const count = countArg ? parseInt(countArg.split('=')[1], 10) : (fetchAll ? 20 : 1);

    console.error(`MegaBonk Changelog Fetcher`);
    console.error(`========================`);
    console.error(`Steam App ID: ${STEAM_APP_ID}`);
    console.error(`Fetching ${count === 1 ? 'latest patch' : `up to ${count} patches`}...`);
    console.error('');

    try {
        // Load game data for entity auto-linking
        const gameData = loadGameData();
        const entityMap = buildEntityMap(gameData);
        console.error(`Loaded ${Object.keys(entityMap).length} entities for auto-linking`);

        // Fetch news from Steam
        const newsItems = await fetchSteamNews();

        if (newsItems.length === 0) {
            console.error('No news items found.');
            process.exit(1);
        }

        console.error(`Found ${newsItems.length} news items on Steam.`);

        // Filter to patch notes (skip regular news/announcements)
        const patchItems = newsItems.filter(item => {
            const title = item.title.toLowerCase();
            return title.includes('update') || title.includes('patch') || title.includes('fix') ||
                   title.includes('version') || title.match(/v?\d+\.\d+/);
        });

        console.error(`Identified ${patchItems.length} as patch notes.`);

        const itemsToProcess = patchItems.slice(0, count);
        const patches = itemsToProcess.map(item => parsePatchNotes(item, entityMap));

        const output = {
            version: '1.0.0',
            last_updated: new Date().toISOString().split('T')[0],
            steam_app_id: STEAM_APP_ID,
            total_patches: patches.length,
            patches
        };

        // Output JSON to stdout
        console.log(JSON.stringify(output, null, 2));

        console.error('');
        console.error('--- REVIEW REQUIRED ---');
        console.error('Please review the output and edit before committing.');
        console.error('Check that:');
        console.error('  1. Entity links [[type:id|Name]] are correct');
        console.error('  2. Categories are accurate');
        console.error('  3. Change types (buff/nerf/fix) are appropriate');
        console.error('');
        console.error('To save: node scripts/fetch-changelog.js > temp-changelog.json');

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();
