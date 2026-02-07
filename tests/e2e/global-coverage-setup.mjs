/**
 * Global Setup for E2E Coverage Collection
 * Creates raw coverage output directory
 */
import { mkdirSync, existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '../..');
const e2eCoverageDir = join(projectRoot, 'coverage', 'e2e');
const rawCoverageDir = join(e2eCoverageDir, 'raw');

export default async function globalSetup() {
    console.log('[Coverage Global Setup] Initializing E2E coverage...');
    
    // Clean and create coverage directories
    if (existsSync(rawCoverageDir)) {
        rmSync(rawCoverageDir, { recursive: true, force: true });
    }
    mkdirSync(rawCoverageDir, { recursive: true });
    
    console.log('[Coverage Global Setup] Ready');
}
