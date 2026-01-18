# Parameter Tuning Results

## Summary

**Best F1: 24.2%** achieved with:
- `min_variance = 500`
- `bottom_margin_base = 48`
- All other parameters at default

This is **+2.6%** improvement over the baseline (21.6%).

## Individual Parameter Sweeps

### NCC Threshold (default: 0.55)
| Value | TP | FP | FN | Precision | Recall | F1 |
|-------|----|----|-----|-----------|--------|-----|
| 0.45  | 45 | 187 | 150 | 19.4% | 23.1% | 21.1% |
| 0.50  | 45 | 187 | 150 | 19.4% | 23.1% | 21.1% |
| **0.55** | 44 | 168 | 151 | 20.8% | 22.6% | **21.6%** |
| 0.60  | 36 | 104 | 159 | 25.7% | 18.5% | 21.5% |
| 0.65  | 13 | 37 | 182 | 26.0% | 6.7% | 10.6% |
| 0.70  | 9 | 12 | 186 | 42.9% | 4.6% | 8.3% |

**Finding:** Default is optimal for F1. Higher thresholds trade recall for precision.

### Min Variance (default: 350)
| Value | TP | FP | FN | Precision | Recall | F1 |
|-------|----|----|-----|-----------|--------|-----|
| 250   | 45 | 194 | 150 | 18.8% | 23.1% | 20.7% |
| 300   | 45 | 182 | 150 | 19.8% | 23.1% | 21.3% |
| 350   | 44 | 168 | 151 | 20.8% | 22.6% | 21.6% |
| 400   | 44 | 156 | 151 | 22.0% | 22.6% | 22.3% |
| 450   | 43 | 148 | 152 | 22.5% | 22.1% | 22.3% |
| **500** | 43 | 140 | 152 | 23.5% | 22.1% | **22.8%** |

**Finding:** Higher variance reduces false positives significantly.

### Crop Margin (default: 0.10)
| Value | TP | FP | FN | Precision | Recall | F1 |
|-------|----|----|-----|-----------|--------|-----|
| 0.00  | 40 | 181 | 155 | 18.1% | 20.5% | 19.2% |
| 0.05  | 42 | 174 | 153 | 19.4% | 21.5% | 20.4% |
| **0.10** | 44 | 168 | 151 | 20.8% | 22.6% | **21.6%** |
| 0.15  | 41 | 171 | 154 | 19.3% | 21.0% | 20.1% |
| 0.20  | 43 | 167 | 152 | 20.5% | 22.1% | 21.2% |

**Finding:** Default is optimal.

### Icon Size Base (default: 34)
| Value | TP | FP | FN | Precision | Recall | F1 |
|-------|----|----|-----|-----------|--------|-----|
| 30    | 43 | 160 | 152 | 21.2% | 22.1% | 21.6% |
| 32    | 42 | 161 | 153 | 20.7% | 21.5% | 21.1% |
| **34** | 44 | 168 | 151 | 20.8% | 22.6% | **21.6%** |
| 36    | 42 | 162 | 153 | 20.6% | 21.5% | 21.1% |
| 38    | 36 | 175 | 159 | 17.1% | 18.5% | 17.7% |

**Finding:** Default is optimal.

### Spacing Base (default: 4)
| Value | TP | FP | FN | Precision | Recall | F1 |
|-------|----|----|-----|-----------|--------|-----|
| 2     | 42 | 160 | 153 | 20.8% | 21.5% | 21.2% |
| 3     | 43 | 170 | 152 | 20.2% | 22.1% | 21.1% |
| **4** | 44 | 168 | 151 | 20.8% | 22.6% | **21.6%** |
| 5     | 43 | 174 | 152 | 19.8% | 22.1% | 20.9% |
| 6     | 37 | 176 | 158 | 17.4% | 19.0% | 18.1% |

**Finding:** Default is optimal.

### Bottom Margin Base (default: 42)
| Value | TP | FP | FN | Precision | Recall | F1 |
|-------|----|----|-----|-----------|--------|-----|
| 36    | 44 | 181 | 151 | 19.6% | 22.6% | 21.0% |
| 39    | 43 | 180 | 152 | 19.3% | 22.1% | 20.6% |
| 42    | 44 | 168 | 151 | 20.8% | 22.6% | 21.6% |
| 45    | 40 | 153 | 155 | 20.7% | 20.5% | 20.6% |
| **48** | 40 | 128 | 155 | 23.8% | 20.5% | **22.0%** |

**Finding:** Higher margin reduces FP significantly.

## Combined Parameter Tests

| Config | TP | FP | FN | Precision | Recall | F1 |
|--------|----|----|-----|-----------|--------|-----|
| Default | 44 | 168 | 151 | 20.8% | 22.6% | 21.6% |
| min_variance=500 | 43 | 140 | 152 | 23.5% | 22.1% | 22.8% |
| bottom_margin=48 | 40 | 128 | 155 | 23.8% | 20.5% | 22.0% |
| **Combined** | 40 | 95 | 155 | **29.6%** | 20.5% | **24.2%** |
| Combined + var=450 | 40 | 111 | 155 | 26.5% | 20.5% | 23.1% |
| Combined + thresh=0.60 | 31 | 46 | 164 | **40.3%** | 15.9% | 22.8% |

## Recommended Configuration

```javascript
const OPTIMAL_PARAMS = {
    ncc_threshold: 0.55,
    min_variance: 500,
    crop_margin: 0.10,
    icon_size_base: 34,
    spacing_base: 4,
    bottom_margin_base: 48
};
```

## Key Insights

1. **False Positive Reduction** is the main lever for improvement
   - min_variance: 350→500 reduced FP from 168 to 140 (-17%)
   - bottom_margin: 42→48 reduced FP from 168 to 128 (-24%)
   - Combined: FP dropped from 168 to 95 (-43%)

2. **Recall is the bottleneck**
   - With 7 templates covering ~10% of items, max recall is limited
   - True positives stayed around 40-44 regardless of settings

3. **Precision vs Recall tradeoff**
   - For high precision (40%+): use thresh=0.60
   - For balanced F1: use combined optimal params
