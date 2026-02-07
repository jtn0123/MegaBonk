/**
 * Module Exports Tests
 * Tests that module exports are accessible and work correctly
 */

import { describe, it, expect } from 'vitest';

// Import various module exports to ensure they're covered
import { THRESHOLDS } from '../../src/modules/web-vitals.ts';
import { getAllShortcuts } from '../../src/modules/keyboard-shortcuts.ts';
import { generateMatchBadge } from '../../src/modules/match-badge.ts';
import {
    safeGetElementById,
    safeQuerySelector,
    safeQuerySelectorAll,
    safeSetValue,
    safeSetHTML,
    generateResponsiveImage,
    setupImageFallbackHandler,
    generateEntityImage,
    generateModalImage,
    generateEmptyState,
} from '../../src/modules/utils.ts';

describe('Module Exports', () => {
    describe('web-vitals exports', () => {
        it('should export THRESHOLDS constant', () => {
            expect(THRESHOLDS).toBeDefined();
            expect(THRESHOLDS.LCP).toBeDefined();
            expect(THRESHOLDS.CLS).toBeDefined();
            expect(THRESHOLDS.FCP).toBeDefined();
            expect(THRESHOLDS.TTFB).toBeDefined();
            expect(THRESHOLDS.INP).toBeDefined();
        });
    });

    describe('keyboard-shortcuts exports', () => {
        it('should export getAllShortcuts function', () => {
            expect(typeof getAllShortcuts).toBe('function');
        });

        it('should return shortcuts array', () => {
            const shortcuts = getAllShortcuts();
            expect(Array.isArray(shortcuts)).toBe(true);
            expect(shortcuts.length).toBeGreaterThan(0);
        });

        it('should return shortcuts with correct structure', () => {
            const shortcuts = getAllShortcuts();
            const firstCategory = shortcuts[0];
            expect(firstCategory).toHaveProperty('category');
            expect(firstCategory).toHaveProperty('shortcuts');
            expect(Array.isArray(firstCategory.shortcuts)).toBe(true);
        });
    });

    describe('match-badge exports', () => {
        it('should export generateMatchBadge function', () => {
            expect(typeof generateMatchBadge).toBe('function');
        });

        it('should generate badge for exact match', () => {
            const badge = generateMatchBadge({ matchType: 'exact', field: 'name' });
            expect(badge).toContain('✓ Exact');
            expect(badge).toContain('in Name');
        });

        it('should return empty string for null context', () => {
            const badge = generateMatchBadge(null);
            expect(badge).toBe('');
        });
    });

    describe('utils DOM helpers', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <div id="test-element">Test Content</div>
                <input id="test-input" type="text" value="initial">
                <span class="test-class">Span Content</span>
            `;
        });

        it('should safely get element by ID', () => {
            const element = safeGetElementById('test-element');
            expect(element).not.toBeNull();
            expect(element?.textContent).toBe('Test Content');
        });

        it('should return fallback when element not found', () => {
            const element = safeGetElementById('nonexistent', null);
            expect(element).toBeNull();
        });

        it('should safely query selector', () => {
            const element = safeQuerySelector('.test-class');
            expect(element).not.toBeNull();
            expect(element?.textContent).toBe('Span Content');
        });

        it('should safely query selector all', () => {
            const elements = safeQuerySelectorAll('.test-class');
            expect(elements.length).toBeGreaterThan(0);
        });

        it('should safely set value', () => {
            safeSetValue('test-input', 'new value');
            const input = document.getElementById('test-input') as HTMLInputElement;
            expect(input.value).toBe('new value');
        });

        it('should safely set HTML', () => {
            safeSetHTML('test-element', '<strong>New HTML</strong>');
            const element = document.getElementById('test-element');
            expect(element?.innerHTML).toBe('<strong>New HTML</strong>');
        });
    });

    describe('utils image generation', () => {
        it('should generate responsive image', () => {
            const html = generateResponsiveImage('path/to/image.png', 'Alt Text', 'custom-class');
            expect(html).toContain('<picture class="blur-up-container">');
            expect(html).toContain('image.webp');
            expect(html).toContain('Alt Text');
            expect(html).toContain('custom-class');
        });

        it('should return empty string for empty path', () => {
            const html = generateResponsiveImage('', 'Alt', 'class');
            expect(html).toBe('');
        });

        it('should generate entity image', () => {
            const entity = { id: '1', name: 'Test', image: 'path/to/image.png' };
            const html = generateEntityImage(entity as any, 'Alt Text');
            expect(html).toContain('<picture class="blur-up-container">');
            expect(html).toContain('image.webp');
        });

        it('should return empty string for null entity', () => {
            const html = generateEntityImage(null, 'Alt');
            expect(html).toBe('');
        });

        it('should return empty string for entity without image', () => {
            const entity = { id: '1', name: 'Test' };
            const html = generateEntityImage(entity as any, 'Alt');
            expect(html).toBe('');
        });

        it('should generate modal image', () => {
            const entity = { image: 'path/to/image.png' };
            const html = generateModalImage(entity, 'Alt', 'item');
            expect(html).toContain('<picture class="blur-up-container">');
            expect(html).toContain('modal-item-image');
        });

        it('should setup image fallback handler', () => {
            expect(() => setupImageFallbackHandler()).not.toThrow();
        });
    });

    describe('utils empty state', () => {
        it('should generate empty state HTML', () => {
            const html = generateEmptyState('🔍', 'items');
            expect(html).toContain('🔍');
            expect(html).toContain('No items Found');
            expect(html).toContain('Clear Filters');
        });
    });
});
