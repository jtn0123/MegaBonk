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
 * Convert Steam HTML/BBCode content to structured text with preserved formatting
 */
function convertSteamContent(content) {
    if (!content) return '';

    let text = content;

    // Convert BBCode headers to markers we can detect later
    text = text.replace(/\[h1\](.*?)\[\/h1\]/gi, '\n##HEADER## $1\n');
    text = text.replace(/\[h2\](.*?)\[\/h2\]/gi, '\n##HEADER## $1\n');
    text = text.replace(/\[h3\](.*?)\[\/h3\]/gi, '\n##HEADER## $1\n');
    text = text.replace(/\[b\](.*?)\[\/b\]/gi, '**$1**');

    // Convert BBCode lists to bullet points
    text = text.replace(/\[\*\]/gi, '\n- ');
    text = text.replace(/\[list\]/gi, '\n');
    text = text.replace(/\[\/list\]/gi, '\n');

    // Convert HTML elements to line breaks
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/p>/gi, '\n');
    text = text.replace(/<p[^>]*>/gi, '\n');
    text = text.replace(/<\/div>/gi, '\n');
    text = text.replace(/<div[^>]*>/gi, '\n');
    text = text.replace(/<\/li>/gi, '\n');
    text = text.replace(/<li[^>]*>/gi, '\n- ');
    text = text.replace(/<\/h[1-6]>/gi, '\n');
    text = text.replace(/<h[1-6][^>]*>/gi, '\n##HEADER## ');
    text = text.replace(/<hr\s*\/?>/gi, '\n---\n');

    // Strip remaining HTML tags
    text = text.replace(/<[^>]+>/g, '');

    // Strip remaining BBCode tags (but not our markers)
    text = text.replace(/\[(?!#)[^\]]+\]/g, '');

    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/&apos;/g, "'");

    // Try to split run-on text by detecting section headers
    // Pattern: lowercase letter immediately followed by capital letter starting a new word
    // e.g., "somethingNew Stuff" -> "something\n##HEADER## New Stuff"
    const sectionKeywords = [
        'New Stuff',
        'New Content',
        'New Items',
        'New Features',
        'Additions',
        'Balancing',
        'Balance',
        'Balance Changes',
        'Buffs',
        'Nerfs',
        'Bug Fixes',
        'Bugs',
        'Bug',
        'Fixes',
        'Fixed',
        'Changes',
        'Changelog',
        'Patch Notes',
        'Removed',
        'Deletions',
        'Other',
        'Misc',
        'Miscellaneous',
        'Game',
        'Gameplay',
        'Settings',
        'Options',
        'Console',
        'Commands',
        'Leaderboards',
        'Leaderboard',
        'System',
        'Performance',
        'FPS',
        'Optimization',
        'TLDR',
        'TL;DR',
        'Summary',
        'Final Swarm',
        'Final Boss',
        'Credit Cards', // specific to MegaBonk
    ];

    for (const keyword of sectionKeywords) {
        // Match keyword preceded by lowercase letter (run-on text)
        const runOnPattern = new RegExp(`([a-z])\\s*(${escapeRegex(keyword)})\\s*(?=[A-Z-]|$)`, 'g');
        text = text.replace(runOnPattern, '$1\n##HEADER## $2\n');

        // Also match keyword at start of line or after newline
        const headerPattern = new RegExp(`^\\s*(${escapeRegex(keyword)})\\s*$`, 'gim');
        text = text.replace(headerPattern, '##HEADER## $1');
    }

    // Split run-on bullet points: "textFixed something" -> "text\n- Fixed something"
    const bulletKeywords = [
        'Fixed',
        'Added',
        'Removed',
        'Changed',
        'Updated',
        'Increased',
        'Decreased',
        'Buffed',
        'Nerfed',
        'Improved',
        'Hopefully',
    ];
    for (const keyword of bulletKeywords) {
        const pattern = new RegExp(`([a-z.!?)])\\s*(${keyword})\\s+`, 'g');
        text = text.replace(pattern, '$1\n- $2 ');
    }

    // Normalize whitespace
    text = text.replace(/\r\n/g, '\n');
    text = text.replace(/\r/g, '\n');
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.replace(/[ \t]+/g, ' ');

    return text.trim();
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
    if (
        lower.includes('increased') ||
        lower.includes('buffed') ||
        lower.includes('improved') ||
        lower.includes('boost')
    )
        return 'buff';
    if (lower.includes('decreased') || lower.includes('nerfed') || lower.includes('reduced') || lower.includes('lower'))
        return 'nerf';
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
 * Detect category from line context - more comprehensive matching
 */
function detectCategory(line) {
    const lower = line.toLowerCase().trim();

    // New content patterns - check first since "new" is common
    if (
        lower.includes('new stuff') ||
        lower.includes('new content') ||
        lower.includes('new item') ||
        lower.includes('new feature') ||
        lower.includes('new character') ||
        lower.includes('new weapon') ||
        lower.includes('new map') ||
        lower.includes('new enem') ||
        lower.includes('new boss') ||
        lower.includes('new achievement') ||
        lower.includes('additions') ||
        lower === 'new' ||
        lower === 'content'
    ) {
        return 'new_content';
    }

    // Balance patterns
    if (
        lower.includes('balance') ||
        lower.includes('balancing') ||
        lower.includes('buff') ||
        lower.includes('nerf') ||
        lower === 'changes' ||
        lower.includes('credit card') // specific MegaBonk balance section
    ) {
        return 'balance';
    }

    // Bug fix patterns
    if (
        lower.includes('bug') ||
        lower.includes('fix') ||
        lower.includes('issue') ||
        lower.includes('resolved') ||
        lower.includes('patch') ||
        lower.includes('hotfix')
    ) {
        return 'bug_fixes';
    }

    // Removed patterns
    if (lower.includes('removed') || lower.includes('deleted') || lower.includes('removal')) {
        return 'removed';
    }

    // Settings/Options - map to other
    if (
        lower.includes('setting') ||
        lower.includes('option') ||
        lower.includes('console') ||
        lower.includes('command')
    ) {
        return 'other';
    }

    // Game/Gameplay - usually misc changes
    if (
        lower === 'game' ||
        lower === 'gameplay' ||
        lower === 'other' ||
        lower === 'misc' ||
        lower.includes('leaderboard') ||
        lower.includes('performance') ||
        lower.includes('fps') ||
        lower.includes('optimization')
    ) {
        return 'other';
    }

    return null;
}

/**
 * Parse raw patch notes into structured format
 */
function parsePatchNotes(newsItem, entityMap) {
    const content = newsItem.contents || '';

    // Use improved content conversion for parsing
    const convertedText = convertSteamContent(content);
    const lines = convertedText.split('\n').filter(l => l.trim());

    // Keep a plain version for raw_notes display
    const plainText = content
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\[.*?\]/g, '');

    // Extract version from title or content
    let version = extractVersion(newsItem.title);
    if (!version) {
        const contentVersionMatch = convertedText.match(/v?(\d+\.\d+(?:\.\d+)?)/i);
        if (contentVersionMatch) {
            version = contentVersionMatch[1];
        }
    }

    const patch = {
        id: `patch_${newsItem.gid || Date.now()}`,
        version: version || 'Unknown',
        title: newsItem.title,
        date: new Date(newsItem.date * 1000).toISOString().split('T')[0],
        steam_url: newsItem.url || `https://store.steampowered.com/news/app/${STEAM_APP_ID}`,
        summary: lines[0]?.replace(/##HEADER##\s*/g, '').substring(0, 200) || '',
        categories: {
            balance: [],
            new_content: [],
            bug_fixes: [],
            removed: [],
            other: [],
        },
        raw_notes: plainText.trim(),
    };

    // Parse lines into categories
    let currentCategory = 'other';

    for (let i = 0; i < lines.length; i++) {
        let trimmed = lines[i].trim();
        if (!trimmed) continue;

        // Check for header markers (from our conversion)
        if (trimmed.startsWith('##HEADER##')) {
            const headerText = trimmed.replace('##HEADER##', '').trim();
            const detectedCategory = detectCategory(headerText);
            if (detectedCategory) {
                currentCategory = detectedCategory;
            }
            continue;
        }

        // Check if this line looks like a section header (short, not a bullet)
        const detectedCategory = detectCategory(trimmed);
        if (detectedCategory && trimmed.length < 50 && !trimmed.startsWith('-') && !trimmed.startsWith('*')) {
            // Verify it's a header not a change description
            const looksLikeHeader =
                (!trimmed.includes(' -> ') && !trimmed.includes(': ')) ||
                trimmed.toLowerCase() === 'balancing' ||
                trimmed.toLowerCase() === 'bugs' ||
                trimmed.toLowerCase() === 'game' ||
                trimmed.toLowerCase() === 'other' ||
                trimmed.toLowerCase().startsWith('new ');
            if (looksLikeHeader) {
                currentCategory = detectedCategory;
                continue;
            }
        }

        // Parse change lines (-, *, •, ·, or \ for Steam formatting)
        const isBullet =
            trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.match(/^[•·]/) || trimmed.startsWith('\\');

        if (isBullet) {
            const changeText = trimmed.replace(/^[-*•·\\]\s*/, '').trim();
            if (!changeText) continue;

            const linkedText = autoLinkEntities(changeText, entityMap);
            const changeType = detectChangeType(changeText);
            const affectedEntities = extractAffectedEntities(changeText, entityMap);

            patch.categories[currentCategory].push({
                text: linkedText,
                change_type: changeType,
                affected_entities: affectedEntities,
            });
        } else if (trimmed.length > 10 && currentCategory !== 'other') {
            // Non-bulleted line in a known category - still add if it looks like a change
            const looksLikeChange =
                trimmed.length > 20 ||
                trimmed.toLowerCase().includes('fix') ||
                trimmed.toLowerCase().includes('add') ||
                trimmed.toLowerCase().includes('remov') ||
                trimmed.toLowerCase().includes('chang') ||
                trimmed.toLowerCase().includes('buff') ||
                trimmed.toLowerCase().includes('nerf') ||
                trimmed.toLowerCase().includes('increas') ||
                trimmed.toLowerCase().includes('decreas');

            if (looksLikeChange) {
                const linkedText = autoLinkEntities(trimmed, entityMap);
                const changeType = detectChangeType(trimmed);
                const affectedEntities = extractAffectedEntities(trimmed, entityMap);

                patch.categories[currentCategory].push({
                    text: linkedText,
                    change_type: changeType,
                    affected_entities: affectedEntities,
                });
            }
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
        https
            .get(STEAM_NEWS_URL, res => {
                let data = '';
                res.on('data', chunk => (data += chunk));
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve(json.appnews?.newsitems || []);
                    } catch (e) {
                        reject(e);
                    }
                });
            })
            .on('error', reject);
    });
}

// ========================================
// Main
// ========================================

async function main() {
    const args = process.argv.slice(2);
    const fetchAll = args.includes('--all');
    const countArg = args.find(a => a.startsWith('--count='));
    const count = countArg ? parseInt(countArg.split('=')[1], 10) : fetchAll ? 20 : 1;

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

        // Filter to patch notes (skip regular news/announcements and external articles)
        const patchItems = newsItems.filter(item => {
            const title = item.title.toLowerCase();
            const content = (item.contents || '').toLowerCase();

            // Skip external news articles (they just link to other sites)
            if (item.feedname && !item.feedname.includes('steam')) {
                // Check if it's a short article with just a link
                if (
                    content.length < 500 ||
                    content.includes('read the full article') ||
                    content.includes('read more')
                ) {
                    return false;
                }
            }

            // Include if title matches patch patterns
            return (
                title.includes('update') ||
                title.includes('patch') ||
                title.includes('fix') ||
                title.includes('version') ||
                title.match(/v?\d+\.\d+/)
            );
        });

        console.error(`Identified ${patchItems.length} as patch notes.`);

        const itemsToProcess = patchItems.slice(0, count);
        const patches = itemsToProcess.map(item => parsePatchNotes(item, entityMap));

        const output = {
            version: '1.0.0',
            last_updated: new Date().toISOString().split('T')[0],
            steam_app_id: STEAM_APP_ID,
            total_patches: patches.length,
            patches,
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
