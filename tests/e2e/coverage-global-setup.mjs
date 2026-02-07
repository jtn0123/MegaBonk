/**
 * Playwright Global Setup for Coverage
 * Initializes coverage collection directory
 */
import { initCoverage } from './coverage-helper.mjs';

export default async function globalSetup() {
    console.log('[Coverage Global Setup] Initializing coverage collection...');
    initCoverage();
    console.log('[Coverage Global Setup] Ready');
}
