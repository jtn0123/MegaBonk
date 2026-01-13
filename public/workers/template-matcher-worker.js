/* global self, ImageData */
// ========================================
// Template Matcher Web Worker
// ========================================
// Handles template matching in parallel to avoid blocking UI
// ========================================

/**
 * Calculate Pearson correlation between two ImageData objects
 */
function calculateSimilarity(imageData1, imageData2) {
    const pixels1 = imageData1.data;
    const pixels2 = imageData2.data;

    let sum1 = 0;
    let sum2 = 0;
    let sumProduct = 0;
    let sumSquare1 = 0;
    let sumSquare2 = 0;
    let count = 0;

    const step = 4; // RGBA

    for (let i = 0; i < Math.min(pixels1.length, pixels2.length); i += step) {
        // Convert to grayscale
        const gray1 = (pixels1[i] + pixels1[i + 1] + pixels1[i + 2]) / 3;
        const gray2 = (pixels2[i] + pixels2[i + 1] + pixels2[i + 2]) / 3;

        sum1 += gray1;
        sum2 += gray2;
        sumProduct += gray1 * gray2;
        sumSquare1 += gray1 * gray1;
        sumSquare2 += gray2 * gray2;
        count++;
    }

    // Pearson correlation coefficient
    const mean1 = sum1 / count;
    const mean2 = sum2 / count;

    const numerator = sumProduct / count - mean1 * mean2;
    const denominator = Math.sqrt((sumSquare1 / count - mean1 * mean1) * (sumSquare2 / count - mean2 * mean2));

    if (denominator === 0) return 0;

    // Normalize to 0-1 range
    return (numerator / denominator + 1) / 2;
}

/**
 * Resize ImageData (simple nearest-neighbor)
 */
function resizeImageData(imageData, targetWidth, targetHeight) {
    const { width, height, data } = imageData;
    const resized = new ImageData(targetWidth, targetHeight);
    const resizedData = resized.data;

    const xRatio = width / targetWidth;
    const yRatio = height / targetHeight;

    for (let y = 0; y < targetHeight; y++) {
        for (let x = 0; x < targetWidth; x++) {
            const srcX = Math.floor(x * xRatio);
            const srcY = Math.floor(y * yRatio);

            const srcIndex = (srcY * width + srcX) * 4;
            const dstIndex = (y * targetWidth + x) * 4;

            resizedData[dstIndex] = data[srcIndex];
            resizedData[dstIndex + 1] = data[srcIndex + 1];
            resizedData[dstIndex + 2] = data[srcIndex + 2];
            resizedData[dstIndex + 3] = data[srcIndex + 3];
        }
    }

    return resized;
}

/**
 * Match a cell against a list of templates
 */
function matchCellAgainstTemplates(cellImageData, templates) {
    let bestMatch = null;

    for (const template of templates) {
        // Resize template to match cell size
        const resizedTemplate = resizeImageData(template.imageData, cellImageData.width, cellImageData.height);

        // Calculate similarity
        const similarity = calculateSimilarity(cellImageData, resizedTemplate);

        if (!bestMatch || similarity > bestMatch.similarity) {
            bestMatch = {
                itemId: template.itemId,
                itemName: template.itemName,
                similarity,
            };
        }
    }

    return bestMatch;
}

/**
 * Process a batch of cells
 */
function processBatch(cells, templates) {
    const results = [];

    for (const cell of cells) {
        const match = matchCellAgainstTemplates(cell.imageData, templates);

        if (match) {
            results.push({
                cellIndex: cell.index,
                itemId: match.itemId,
                itemName: match.itemName,
                similarity: match.similarity,
                position: cell.position,
            });
        }
    }

    return results;
}

// Listen for messages from main thread
self.addEventListener('message', e => {
    const { type, data } = e.data;

    if (type === 'MATCH_BATCH') {
        const { cells, templates, batchId } = data;

        // Process the batch
        const results = processBatch(cells, templates);

        // Send results back to main thread
        self.postMessage({
            type: 'BATCH_COMPLETE',
            data: {
                batchId,
                results,
            },
        });
    } else if (type === 'PING') {
        // Health check
        self.postMessage({ type: 'PONG' });
    }
});
