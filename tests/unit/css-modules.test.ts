import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * CSS Module Structure Tests
 * Validates the CSS module organization and import structure
 */

const STYLES_DIR = path.resolve(__dirname, '../../src/styles');

describe('CSS Module Structure', () => {
    const expectedModules = [
        'index.css',
        'base.css',
        'layout.css',
        'navigation.css',
        'cards.css',
        'forms.css',
        'modal.css',
        'features.css',
        'animations.css',
        'themes.css',
    ];

    describe('Module Files', () => {
        it('should have all expected CSS module files', () => {
            expectedModules.forEach(moduleName => {
                const modulePath = path.join(STYLES_DIR, moduleName);
                expect(fs.existsSync(modulePath), `Missing module: ${moduleName}`).toBe(true);
            });
        });

        it('should have index.css as entry point', () => {
            const indexPath = path.join(STYLES_DIR, 'index.css');
            expect(fs.existsSync(indexPath)).toBe(true);
        });

        it('should have non-empty module files', () => {
            expectedModules.forEach(moduleName => {
                const modulePath = path.join(STYLES_DIR, moduleName);
                if (fs.existsSync(modulePath)) {
                    const content = fs.readFileSync(modulePath, 'utf8');
                    expect(content.length, `Module ${moduleName} is empty`).toBeGreaterThan(0);
                }
            });
        });
    });

    describe('Index.css Imports', () => {
        let indexContent;

        beforeAll(() => {
            const indexPath = path.join(STYLES_DIR, 'index.css');
            indexContent = fs.readFileSync(indexPath, 'utf8');
        });

        it('should import all module files in correct order', () => {
            const importOrder = [
                'base.css',
                'layout.css',
                'navigation.css',
                'cards.css',
                'forms.css',
                'modal.css',
                'features.css',
                'animations.css',
                'themes.css',
            ];

            let lastIndex = -1;
            importOrder.forEach(moduleName => {
                const importPattern = `@import './${moduleName}'`;
                const index = indexContent.indexOf(importPattern);
                expect(index, `Missing import for ${moduleName}`).toBeGreaterThan(-1);
                expect(index, `Import order incorrect for ${moduleName}`).toBeGreaterThan(lastIndex);
                lastIndex = index;
            });
        });

        it('should have themes.css imported near the end (for override priority)', () => {
            const themesImport = indexContent.lastIndexOf("@import './themes.css'");
            const responsiveImport = indexContent.lastIndexOf("@import './responsive.css'");
            // themes.css should come before responsive.css (responsive handles media queries last)
            expect(themesImport).toBeGreaterThan(0);
            expect(themesImport).toBeLessThan(responsiveImport);
        });
    });

    describe('Base Module', () => {
        let baseContent;

        beforeAll(() => {
            const basePath = path.join(STYLES_DIR, 'base.css');
            baseContent = fs.readFileSync(basePath, 'utf8');
        });

        it('should define CSS custom properties (variables)', () => {
            expect(baseContent).toContain(':root');
            expect(baseContent).toContain('--');
        });

        it('should include reset styles', () => {
            // Should have some form of reset or normalization
            expect(baseContent.includes('margin') || baseContent.includes('box-sizing')).toBe(true);
        });
    });

    describe('Themes Module', () => {
        let themesContent;

        beforeAll(() => {
            const themesPath = path.join(STYLES_DIR, 'themes.css');
            themesContent = fs.readFileSync(themesPath, 'utf8');
        });

        it('should define light theme styles', () => {
            // Should have light theme class or attribute selector (single or double quotes)
            expect(
                themesContent.includes("[data-theme='light']") ||
                    themesContent.includes('[data-theme="light"]') ||
                    themesContent.includes('.light-theme') ||
                    themesContent.includes('prefers-color-scheme: light')
            ).toBe(true);
        });

        it('should override CSS custom properties for light theme', () => {
            expect(themesContent).toContain('--');
        });
    });

    describe('Navigation Module', () => {
        let navContent;

        beforeAll(() => {
            const navPath = path.join(STYLES_DIR, 'navigation.css');
            navContent = fs.readFileSync(navPath, 'utf8');
        });

        it('should include tab styles', () => {
            expect(navContent.includes('tab') || navContent.includes('.nav')).toBe(true);
        });

        it('should include mobile navigation styles', () => {
            expect(
                navContent.includes('mobile') || navContent.includes('@media') || navContent.includes('bottom-nav')
            ).toBe(true);
        });
    });

    describe('Animations Module', () => {
        let animationsContent;

        beforeAll(() => {
            const animPath = path.join(STYLES_DIR, 'animations.css');
            animationsContent = fs.readFileSync(animPath, 'utf8');
        });

        it('should define keyframe animations', () => {
            expect(animationsContent).toContain('@keyframes');
        });

        it('should include transition utilities', () => {
            expect(animationsContent).toContain('transition');
        });

        it('should respect reduced motion preference', () => {
            expect(animationsContent).toContain('prefers-reduced-motion');
        });
    });

    describe('Module Isolation', () => {
        it('should not have duplicate rule definitions across modules', () => {
            // Check for potential conflicts in critical selectors
            const criticalSelectors = [':root', 'body', 'html'];
            const modulesWithRoot = [];

            expectedModules.forEach(moduleName => {
                if (moduleName === 'index.css') return;

                const modulePath = path.join(STYLES_DIR, moduleName);
                if (fs.existsSync(modulePath)) {
                    const content = fs.readFileSync(modulePath, 'utf8');

                    criticalSelectors.forEach(selector => {
                        // Only count if it's a rule definition, not a reference inside another selector
                        const regex = new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*{`, 'gm');
                        if (regex.test(content)) {
                            modulesWithRoot.push({ module: moduleName, selector });
                        }
                    });
                }
            });

            // :root should only be in base.css and themes.css
            const rootModules = modulesWithRoot.filter(m => m.selector === ':root').map(m => m.module);
            rootModules.forEach(mod => {
                expect(['base.css', 'themes.css']).toContain(mod);
            });
        });
    });
});

describe('CSS Syntax Validation', () => {
    const cssModules = [
        'base.css',
        'layout.css',
        'navigation.css',
        'cards.css',
        'forms.css',
        'modal.css',
        'features.css',
        'animations.css',
        'themes.css',
    ];

    cssModules.forEach(moduleName => {
        describe(`${moduleName}`, () => {
            let content;

            beforeAll(() => {
                const modulePath = path.join(STYLES_DIR, moduleName);
                content = fs.readFileSync(modulePath, 'utf8');
            });

            it('should have balanced braces', () => {
                const openBraces = (content.match(/{/g) || []).length;
                const closeBraces = (content.match(/}/g) || []).length;
                expect(openBraces).toBe(closeBraces);
            });

            it('should have balanced parentheses', () => {
                const openParens = (content.match(/\(/g) || []).length;
                const closeParens = (content.match(/\)/g) || []).length;
                expect(openParens).toBe(closeParens);
            });

            it('should not have obvious syntax errors', () => {
                // Check for common CSS syntax issues
                expect(content).not.toMatch(/:\s*;/); // Empty property value
                expect(content).not.toMatch(/{\s*}/); // Empty rule (except comments)
            });
        });
    });
});
