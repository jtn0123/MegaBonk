/**
 * Tests for MegaBonk Inventory Fill Pattern Detection
 *
 * MegaBonk's inventory fills in a specific pattern:
 * - Row 0 (bottom): Items fill from CENTER, expand LEFT and RIGHT
 * - Row 1+: Items fill from LEFT to RIGHT
 * - If row 0 is not full → rows 1+ are COMPLETELY empty
 * - If row N is not full → rows N+1+ are COMPLETELY empty
 *
 * These tests validate the applyInventoryFillPattern() function
 * that uses this game knowledge to reduce false positives.
 */
import { describe, it, expect, beforeEach } from 'vitest';

// ========================================
// Test Implementation of Fill Pattern Logic
// (Mirrors cv-detection.js applyInventoryFillPattern)
// ========================================

interface CellInfo {
    cell: {
        row: number;
        col: number;
        slotIndex: number;
    };
    cellData?: ImageData;
    isEmpty: boolean;
    fillPatternEmpty?: boolean;
}

const CONSECUTIVE_EMPTY_THRESHOLD = 2;

/**
 * Apply MegaBonk inventory fill pattern knowledge
 * This is a TypeScript implementation matching cv-detection.js
 */
function applyInventoryFillPattern(
    cells: CellInfo[],
    numRows: number,
    iconsPerRow: number
): CellInfo[] {
    if (!cells || cells.length === 0) return cells;

    const threshold = CONSECUTIVE_EMPTY_THRESHOLD;

    // Group cells by row
    const rows: CellInfo[][] = [];
    for (let r = 0; r < numRows; r++) {
        rows[r] = cells.filter(c => c.cell.row === r).sort((a, b) => a.cell.col - b.cell.col);
    }

    // Process row 0 first (center-fill pattern)
    let row0LeftBound = 0;
    let row0RightBound = iconsPerRow - 1;
    let row0Full = false;

    if (rows[0] && rows[0].length > 0) {
        const centerCol = Math.floor(iconsPerRow / 2);

        // Find left edge (scan from center going left)
        let consecutiveEmpty = 0;
        for (let col = centerCol - 1; col >= 0; col--) {
            const cell = rows[0].find(c => c.cell.col === col);
            if (!cell || cell.isEmpty) {
                consecutiveEmpty++;
                if (consecutiveEmpty >= threshold) {
                    row0LeftBound = col + threshold;
                    break;
                }
            } else {
                consecutiveEmpty = 0;
            }
        }

        // Find right edge (scan from center going right)
        consecutiveEmpty = 0;
        for (let col = centerCol; col < iconsPerRow; col++) {
            const cell = rows[0].find(c => c.cell.col === col);
            if (!cell || cell.isEmpty) {
                consecutiveEmpty++;
                if (consecutiveEmpty >= threshold) {
                    row0RightBound = col - threshold;
                    break;
                }
            } else {
                consecutiveEmpty = 0;
            }
        }

        // Check if row 0 is full
        row0Full = row0LeftBound === 0 && row0RightBound === iconsPerRow - 1;

        // Mark row 0 cells outside bounds as empty
        for (const c of rows[0]) {
            if (c.cell.col < row0LeftBound || c.cell.col > row0RightBound) {
                c.isEmpty = true;
                c.fillPatternEmpty = true;
            }
        }
    }

    // Process rows 1+ (only have items if row 0 is full)
    for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
        const rowCells = rows[rowIdx];
        if (!rowCells || rowCells.length === 0) continue;

        if (!row0Full) {
            // Row 0 not full → this entire row is empty
            for (const c of rowCells) {
                c.isEmpty = true;
                c.fillPatternEmpty = true;
            }
        } else {
            // Row 0 is full → this row fills left-to-right
            let cutoff = iconsPerRow;
            let consecutiveEmpty = 0;

            for (const c of rowCells) {
                if (c.isEmpty) {
                    consecutiveEmpty++;
                    if (consecutiveEmpty >= threshold) {
                        cutoff = c.cell.col - threshold + 1;
                        break;
                    }
                } else {
                    consecutiveEmpty = 0;
                }
            }

            // Mark everything after cutoff as empty
            for (const c of rowCells) {
                if (c.cell.col >= cutoff) {
                    c.isEmpty = true;
                    c.fillPatternEmpty = true;
                }
            }

            // If this row is not full, all rows above are empty
            const rowFull = cutoff === iconsPerRow;
            if (!rowFull) {
                for (let futureRow = rowIdx + 1; futureRow < rows.length; futureRow++) {
                    if (rows[futureRow]) {
                        for (const c of rows[futureRow]) {
                            c.isEmpty = true;
                            c.fillPatternEmpty = true;
                        }
                    }
                }
                break;
            }
        }
    }

    return cells;
}

// ========================================
// Helper Functions
// ========================================

/**
 * Create a grid of cells for testing
 */
function createCellGrid(
    numRows: number,
    iconsPerRow: number,
    emptyPattern: (row: number, col: number) => boolean
): CellInfo[] {
    const cells: CellInfo[] = [];
    let slotIndex = 0;

    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < iconsPerRow; col++) {
            cells.push({
                cell: { row, col, slotIndex },
                isEmpty: emptyPattern(row, col),
            });
            slotIndex++;
        }
    }

    return cells;
}

/**
 * Count cells marked as empty by fill pattern
 */
function countFillPatternEmpty(cells: CellInfo[]): number {
    return cells.filter(c => c.fillPatternEmpty).length;
}

/**
 * Get cells in a specific row
 */
function getCellsInRow(cells: CellInfo[], row: number): CellInfo[] {
    return cells.filter(c => c.cell.row === row);
}

/**
 * Check if entire row is marked empty
 */
function isRowEmpty(cells: CellInfo[], row: number): boolean {
    const rowCells = getCellsInRow(cells, row);
    return rowCells.every(c => c.isEmpty);
}

// ========================================
// Tests: Basic Fill Pattern Behavior
// ========================================

describe('Inventory Fill Pattern', () => {
    describe('Row 0: Center-Fill Pattern', () => {
        it('should detect items centered in row 0', () => {
            const iconsPerRow = 20;
            // 14 items centered: columns 3-16 have items
            const cells = createCellGrid(1, iconsPerRow, (row, col) => {
                return col < 3 || col > 16;
            });

            applyInventoryFillPattern(cells, 1, iconsPerRow);

            // Cells at edges should be marked as empty by fill pattern
            const leftEdge = cells.filter(c => c.cell.col < 3);
            const rightEdge = cells.filter(c => c.cell.col > 16);
            const middle = cells.filter(c => c.cell.col >= 3 && c.cell.col <= 16);

            expect(leftEdge.every(c => c.isEmpty)).toBe(true);
            expect(rightEdge.every(c => c.isEmpty)).toBe(true);
            expect(middle.every(c => !c.isEmpty)).toBe(true);
        });

        it('should handle single item in center', () => {
            const iconsPerRow = 20;
            const centerCol = 10;
            // Only center column has item
            const cells = createCellGrid(1, iconsPerRow, (row, col) => {
                return col !== centerCol;
            });

            applyInventoryFillPattern(cells, 1, iconsPerRow);

            // Center should not be empty
            const centerCell = cells.find(c => c.cell.col === centerCol);
            expect(centerCell?.isEmpty).toBe(false);

            // Most cells should be marked empty by fill pattern
            expect(countFillPatternEmpty(cells)).toBeGreaterThan(15);
        });

        it('should detect full row 0 (items at both edges)', () => {
            const iconsPerRow = 20;
            // All columns have items
            const cells = createCellGrid(1, iconsPerRow, () => false);

            applyInventoryFillPattern(cells, 1, iconsPerRow);

            // No cells should be marked empty by fill pattern
            expect(countFillPatternEmpty(cells)).toBe(0);
            expect(cells.every(c => !c.isEmpty)).toBe(true);
        });

        it('should find left edge with 2 consecutive empties', () => {
            const iconsPerRow = 20;
            // Items from col 5 to 19 (cols 0-4 empty, but 0-1 are 2 consecutive)
            const cells = createCellGrid(1, iconsPerRow, (row, col) => {
                return col < 5;
            });

            applyInventoryFillPattern(cells, 1, iconsPerRow);

            // Cols 0-4 should be empty
            const leftEmpty = cells.filter(c => c.cell.col < 5);
            expect(leftEmpty.every(c => c.isEmpty)).toBe(true);

            // Cols 5+ should not be marked empty by fill pattern
            const rightItems = cells.filter(c => c.cell.col >= 5);
            expect(rightItems.every(c => !c.fillPatternEmpty)).toBe(true);
        });

        it('should find right edge with 2 consecutive empties', () => {
            const iconsPerRow = 20;
            // Items from col 0 to 14 (cols 15-19 empty)
            const cells = createCellGrid(1, iconsPerRow, (row, col) => {
                return col > 14;
            });

            applyInventoryFillPattern(cells, 1, iconsPerRow);

            // Cols 15-19 should be empty
            const rightEmpty = cells.filter(c => c.cell.col > 14);
            expect(rightEmpty.every(c => c.isEmpty)).toBe(true);
        });
    });

    describe('Row 1+: Left-to-Right Fill', () => {
        it('should mark upper rows empty when row 0 is not full', () => {
            const iconsPerRow = 20;
            const numRows = 3;
            // Row 0: 14 items centered (not full)
            // Rows 1-2: should be marked empty
            const cells = createCellGrid(numRows, iconsPerRow, (row, col) => {
                if (row === 0) return col < 3 || col > 16;
                return false; // Upper rows initially detected as non-empty
            });

            applyInventoryFillPattern(cells, numRows, iconsPerRow);

            // Row 0 should have items in the middle
            const row0Items = getCellsInRow(cells, 0).filter(c => !c.isEmpty);
            expect(row0Items.length).toBe(14);

            // Rows 1 and 2 should be completely empty
            expect(isRowEmpty(cells, 1)).toBe(true);
            expect(isRowEmpty(cells, 2)).toBe(true);

            // All row 1 and 2 cells should be marked by fill pattern
            const row1 = getCellsInRow(cells, 1);
            const row2 = getCellsInRow(cells, 2);
            expect(row1.every(c => c.fillPatternEmpty)).toBe(true);
            expect(row2.every(c => c.fillPatternEmpty)).toBe(true);
        });

        it('should process row 1 left-to-right when row 0 is full', () => {
            const iconsPerRow = 20;
            const numRows = 2;
            // Row 0: full (20 items)
            // Row 1: 7 items from left (cols 0-6)
            const cells = createCellGrid(numRows, iconsPerRow, (row, col) => {
                if (row === 0) return false; // All items
                return col > 6; // Row 1 empty after col 6
            });

            applyInventoryFillPattern(cells, numRows, iconsPerRow);

            // Row 0 should be full
            expect(getCellsInRow(cells, 0).every(c => !c.isEmpty)).toBe(true);

            // Row 1: cols 0-6 should have items
            const row1Items = getCellsInRow(cells, 1).filter(c => !c.isEmpty);
            expect(row1Items.length).toBe(7);

            // Row 1: cols 7+ should be marked empty by fill pattern
            const row1Empty = getCellsInRow(cells, 1).filter(c => c.cell.col > 6);
            expect(row1Empty.every(c => c.fillPatternEmpty)).toBe(true);
        });

        it('should mark row 2 empty when row 1 is not full', () => {
            const iconsPerRow = 20;
            const numRows = 3;
            // Row 0: full
            // Row 1: 7 items from left (not full)
            // Row 2: should be marked empty
            const cells = createCellGrid(numRows, iconsPerRow, (row, col) => {
                if (row === 0) return false;
                if (row === 1) return col > 6;
                return false; // Row 2 initially non-empty
            });

            applyInventoryFillPattern(cells, numRows, iconsPerRow);

            // Row 2 should be completely empty
            expect(isRowEmpty(cells, 2)).toBe(true);
            expect(getCellsInRow(cells, 2).every(c => c.fillPatternEmpty)).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty cell array', () => {
            const result = applyInventoryFillPattern([], 3, 20);
            expect(result).toEqual([]);
        });

        it('should handle single cell', () => {
            const cells: CellInfo[] = [
                { cell: { row: 0, col: 10, slotIndex: 0 }, isEmpty: false },
            ];

            applyInventoryFillPattern(cells, 1, 20);

            // Single item should not be marked empty
            expect(cells[0].isEmpty).toBe(false);
        });

        it('should handle all empty cells', () => {
            const cells = createCellGrid(3, 20, () => true);

            applyInventoryFillPattern(cells, 3, 20);

            // All should remain empty
            expect(cells.every(c => c.isEmpty)).toBe(true);
        });

        it('should handle sparse detection (some cells missing)', () => {
            // Only create cells for columns 5-14 (simulating partial grid scan)
            const cells: CellInfo[] = [];
            for (let col = 5; col <= 14; col++) {
                cells.push({
                    cell: { row: 0, col, slotIndex: col },
                    isEmpty: col < 7 || col > 12, // 7-12 have items
                });
            }

            applyInventoryFillPattern(cells, 1, 20);

            // Should still detect edges within available cells
            const items = cells.filter(c => !c.isEmpty);
            expect(items.length).toBe(6); // cols 7-12
        });

        it('should not mark cells empty if threshold not reached', () => {
            const iconsPerRow = 20;
            // Only 1 consecutive empty on left (threshold is 2)
            const cells = createCellGrid(1, iconsPerRow, (row, col) => {
                return col < 1 || col > 18;
            });

            applyInventoryFillPattern(cells, 1, iconsPerRow);

            // Items from col 2-17 should not have fill pattern applied
            // because only 2 empties on left doesn't trigger threshold
            const middleItems = cells.filter(c => c.cell.col >= 2 && c.cell.col <= 17);
            expect(middleItems.filter(c => !c.fillPatternEmpty).length).toBeGreaterThan(0);
        });
    });

    describe('Real-World Scenarios', () => {
        it('should handle typical small inventory (8 items)', () => {
            const iconsPerRow = 20;
            const numRows = 3;
            // 8 items centered in row 0: cols 6-13
            const cells = createCellGrid(numRows, iconsPerRow, (row, col) => {
                if (row === 0) return col < 6 || col > 13;
                return false; // Initially detected as non-empty (false positives)
            });

            applyInventoryFillPattern(cells, numRows, iconsPerRow);

            // Should have 8 items in row 0
            const row0Items = getCellsInRow(cells, 0).filter(c => !c.isEmpty);
            expect(row0Items.length).toBe(8);

            // Rows 1 and 2 should be completely empty
            expect(isRowEmpty(cells, 1)).toBe(true);
            expect(isRowEmpty(cells, 2)).toBe(true);

            // Total items should be 8
            const totalItems = cells.filter(c => !c.isEmpty).length;
            expect(totalItems).toBe(8);
        });

        it('should handle medium inventory (27 items)', () => {
            const iconsPerRow = 20;
            const numRows = 3;
            // Row 0: full (20 items)
            // Row 1: 7 items from left (cols 0-6)
            // Row 2: should be empty
            const cells = createCellGrid(numRows, iconsPerRow, (row, col) => {
                if (row === 0) return false;
                if (row === 1) return col > 6;
                return false; // Row 2 false positives
            });

            applyInventoryFillPattern(cells, numRows, iconsPerRow);

            // Row 0: 20 items
            expect(getCellsInRow(cells, 0).filter(c => !c.isEmpty).length).toBe(20);

            // Row 1: 7 items
            expect(getCellsInRow(cells, 1).filter(c => !c.isEmpty).length).toBe(7);

            // Row 2: empty
            expect(isRowEmpty(cells, 2)).toBe(true);

            // Total: 27 items
            const totalItems = cells.filter(c => !c.isEmpty).length;
            expect(totalItems).toBe(27);
        });

        it('should handle full inventory (60 items)', () => {
            const iconsPerRow = 20;
            const numRows = 3;
            // All 60 slots filled
            const cells = createCellGrid(numRows, iconsPerRow, () => false);

            applyInventoryFillPattern(cells, numRows, iconsPerRow);

            // No cells should be marked empty by fill pattern
            expect(countFillPatternEmpty(cells)).toBe(0);

            // All 60 items present
            expect(cells.filter(c => !c.isEmpty).length).toBe(60);
        });

        it('should eliminate false positives in empty regions', () => {
            const iconsPerRow = 20;
            const numRows = 3;
            // Row 0: 10 items centered (cols 5-14)
            // Rows 1-2: have false positives scattered
            const cells = createCellGrid(numRows, iconsPerRow, (row, col) => {
                if (row === 0) return col < 5 || col > 14;
                // False positives: some cells in rows 1-2 detected as non-empty
                if (row === 1) return col !== 3 && col !== 10 && col !== 15;
                if (row === 2) return col !== 7 && col !== 12;
                return true;
            });

            const initialNonEmpty = cells.filter(c => !c.isEmpty).length;

            applyInventoryFillPattern(cells, numRows, iconsPerRow);

            // After fill pattern, rows 1-2 should be completely empty
            expect(isRowEmpty(cells, 1)).toBe(true);
            expect(isRowEmpty(cells, 2)).toBe(true);

            // Total items should only be the 10 in row 0
            const finalItems = cells.filter(c => !c.isEmpty).length;
            expect(finalItems).toBe(10);

            // We eliminated false positives
            expect(finalItems).toBeLessThan(initialNonEmpty);
        });
    });

    describe('Threshold Behavior', () => {
        it('should require exactly 2 consecutive empties to trigger', () => {
            const iconsPerRow = 20;

            // 1 consecutive empty - should NOT trigger
            const cells1 = createCellGrid(1, iconsPerRow, (row, col) => {
                return col === 0; // Only 1 empty on left
            });
            applyInventoryFillPattern(cells1, 1, iconsPerRow);
            // Cell at col 1 should not be marked empty by fill pattern
            const col1Cell = cells1.find(c => c.cell.col === 1);
            expect(col1Cell?.fillPatternEmpty).toBeFalsy();

            // 2 consecutive empties - should trigger
            const cells2 = createCellGrid(1, iconsPerRow, (row, col) => {
                return col === 0 || col === 1;
            });
            applyInventoryFillPattern(cells2, 1, iconsPerRow);
            // Cells before the items should be marked empty
            const leftCells = cells2.filter(c => c.cell.col < 2);
            expect(leftCells.every(c => c.isEmpty)).toBe(true);
        });

        it('should reset counter when item found', () => {
            const iconsPerRow = 20;
            // Pattern: E I E I I I... (E=empty, I=item)
            // The 1 empty after first item shouldn't trigger cutoff
            const cells = createCellGrid(1, iconsPerRow, (row, col) => {
                if (col < 1) return true; // empty
                if (col === 1) return false; // item
                if (col === 2) return true; // 1 empty
                return false; // items
            });

            applyInventoryFillPattern(cells, 1, iconsPerRow);

            // Items at col 1 and 3+ should not be marked empty
            const col1 = cells.find(c => c.cell.col === 1);
            const col3 = cells.find(c => c.cell.col === 3);
            expect(col1?.isEmpty).toBe(false);
            expect(col3?.isEmpty).toBe(false);
        });
    });
});

// ========================================
// Tests: Grid Position Detection
// ========================================

describe('Grid Position Detection Helpers', () => {
    it('should correctly count cells by row', () => {
        const cells = createCellGrid(3, 20, () => false);

        expect(getCellsInRow(cells, 0).length).toBe(20);
        expect(getCellsInRow(cells, 1).length).toBe(20);
        expect(getCellsInRow(cells, 2).length).toBe(20);
    });

    it('should correctly identify empty rows', () => {
        const cells = createCellGrid(3, 20, (row) => row > 0);

        expect(isRowEmpty(cells, 0)).toBe(false);
        expect(isRowEmpty(cells, 1)).toBe(true);
        expect(isRowEmpty(cells, 2)).toBe(true);
    });

    it('should count fill pattern empties correctly', () => {
        const cells = createCellGrid(1, 20, (row, col) => col < 3 || col > 16);

        // Before pattern applied
        expect(countFillPatternEmpty(cells)).toBe(0);

        applyInventoryFillPattern(cells, 1, 20);

        // After pattern: cells outside bounds marked
        expect(countFillPatternEmpty(cells)).toBeGreaterThan(0);
    });
});
