import { describe, it, expect, beforeEach } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Tests for aria attributes on dynamically rendered content.
 * Verifies that source code properly sets ARIA attributes on
 * containers for build stats, synergies, calculator results,
 * advisor recommendations, and chart canvases.
 */

function readSource(filename: string): string {
    return fs.readFileSync(path.resolve(__dirname, '../../src/modules', filename), 'utf-8');
}

describe('Dynamic Content Aria Attributes', () => {
    beforeEach(() => {
        createMinimalDOM();
    });

    describe('Build UI (build-ui.ts)', () => {
        const source = readSource('build-ui.ts');

        it('should set aria-live="polite" on build stats container', () => {
            expect(source).toContain("statsDisplay.setAttribute('aria-live', 'polite')");
        });

        it('should set aria-label on build stats container', () => {
            expect(source).toContain("statsDisplay.setAttribute('aria-label', 'Build statistics')");
        });

        it('should set aria-live="polite" on synergies container', () => {
            expect(source).toContain("synergiesDisplay.setAttribute('aria-live', 'polite')");
        });

        it('should set aria-label on synergies container', () => {
            expect(source).toContain("synergiesDisplay.setAttribute('aria-label', 'Build synergies')");
        });
    });

    describe('Calculator (calculator.ts)', () => {
        const source = readSource('calculator.ts');

        it('should set aria-live="polite" on result container', () => {
            expect(source).toContain("resultDiv.setAttribute('aria-live', 'polite')");
        });

        it('should set aria-label on result container', () => {
            expect(source).toContain("resultDiv.setAttribute('aria-label', 'Breakpoint calculation result')");
        });
    });

    describe('Advisor (advisor.ts)', () => {
        const source = readSource('advisor.ts');

        it('should set aria-live="polite" on results container', () => {
            expect(source).toContain("resultsDiv.setAttribute('aria-live', 'polite')");
        });

        it('should set aria-label on results container', () => {
            expect(source).toContain("resultsDiv.setAttribute('aria-label', 'Advisor recommendations')");
        });

        it('should set aria-label on recommendation cards', () => {
            expect(source).toContain("card.setAttribute('aria-label',");
        });
    });

    describe('Charts (charts.ts)', () => {
        const source = readSource('charts.ts');

        it('should set aria-label on scaling chart canvas', () => {
            expect(source).toContain("canvas.setAttribute('aria-label',");
            expect(source).toContain('Scaling chart');
        });

        it('should set aria-label on comparison chart canvas', () => {
            expect(source).toContain('Comparison chart');
        });
    });
});
