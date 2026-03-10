import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const repoRoot = path.join(__dirname, '../..');

describe('metadata consistency', () => {
    it('should use current counts in the app shell metadata', () => {
        const html = fs.readFileSync(path.join(repoRoot, 'src/index.html'), 'utf-8');

        expect(html).toContain('80 items');
        expect(html).toContain('20 characters');
        expect(html).not.toContain('77 items');
    });

    it('should use current counts in the source manifest', () => {
        const manifest = fs.readFileSync(path.join(repoRoot, 'src/manifest.json'), 'utf-8');

        expect(manifest).toContain('80 items');
        expect(manifest).not.toContain('77 items');
    });

    it('should not reference legacy monolithic app files in the README', () => {
        const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf-8');

        expect(readme).not.toContain('src/script.js');
        expect(readme).not.toContain('src/styles.css');
        expect(readme).not.toContain('src/sw.js');
        expect(readme).toContain('script.ts');
        expect(readme).toContain('styles/');
    });
});
