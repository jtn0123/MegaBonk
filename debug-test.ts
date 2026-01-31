import { isEmptyCell, calculateHistogramWidth, calculateCenterEdgeRatio, calculateAverageSaturation, calculateColorVariance, EMPTY_DETECTION_CONFIG } from './src/modules/cv/color-utils.ts';

function createMockImageData(width: number, height: number, fillFn: (x: number, y: number) => [number, number, number, number]): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const [r, g, b, a] = fillFn(x, y);
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = a;
        }
    }
    
    return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

const itemIcon = createMockImageData(40, 40, (x, y) => {
    const cx = 20, cy = 20;
    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    if (dist < 14) {
        const angle = Math.atan2(y - cy, x - cx);
        const shade = Math.floor(dist * 3);
        const angleMod = Math.floor((angle + Math.PI) * 30);
        return [200 + shade, 100 + angleMod % 60, 60 + shade, 255];
    }
    return [45, 45, 50, 255];
});

console.log('Config methods:', EMPTY_DETECTION_CONFIG.methods);
console.log('MIN_HISTOGRAM_BINS:', EMPTY_DETECTION_CONFIG.MIN_HISTOGRAM_BINS);
console.log('MIN_CENTER_EDGE_RATIO:', EMPTY_DETECTION_CONFIG.MIN_CENTER_EDGE_RATIO);
console.log('MAX_SATURATION:', EMPTY_DETECTION_CONFIG.MAX_SATURATION);
console.log('---');
console.log('Histogram width:', calculateHistogramWidth(itemIcon));
console.log('Center-edge ratio:', calculateCenterEdgeRatio(itemIcon));
console.log('Saturation:', calculateAverageSaturation(itemIcon));
console.log('Variance:', calculateColorVariance(itemIcon));
console.log('---');
console.log('Is empty:', isEmptyCell(itemIcon));
