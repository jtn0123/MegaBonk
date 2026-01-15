// ========================================
// Chart Loader Module Tests
// ========================================

import { describe, it, expect } from 'vitest';
import { Chart, loadChart } from '../../src/modules/chart-loader.ts';

describe('Chart Loader Module', () => {
    describe('Chart export', () => {
        it('should export Chart instance', () => {
            expect(Chart).toBeDefined();
            expect(typeof Chart).toBe('function');
        });

        it('should be able to create a new Chart instance', () => {
            const canvas = document.createElement('canvas');
            expect(() => {
                new Chart(canvas, {
                    type: 'line',
                    data: {
                        labels: ['A', 'B', 'C'],
                        datasets: [{
                            label: 'Test',
                            data: [1, 2, 3]
                        }]
                    }
                });
            }).not.toThrow();
        });
    });

    describe('loadChart', () => {
        it('should be an async function', () => {
            expect(loadChart).toBeDefined();
            expect(typeof loadChart).toBe('function');
            expect(loadChart.constructor.name).toBe('AsyncFunction');
        });

        it('should return Chart when called', async () => {
            const result = await loadChart();
            expect(result).toBe(Chart);
        });

        it('should return the same Chart instance', async () => {
            const result1 = await loadChart();
            const result2 = await loadChart();
            expect(result1).toBe(result2);
        });
    });
});
