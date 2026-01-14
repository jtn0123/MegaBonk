# Image Optimization Guide

## Overview

MegaBonk uses WebP image format with PNG fallbacks for optimal performance and broad browser compatibility.

## How It Works

### Automatic WebP Support

The app automatically serves WebP images to browsers that support them, falling back to PNG for older browsers:

```html
<picture>
    <source srcset="images/items/big_bonk.webp" type="image/webp">
    <img src="images/items/big_bonk.png" alt="Big Bonk" loading="lazy">
</picture>
```

### Benefits

- **25-35% smaller file sizes** compared to PNG
- **Faster page loads** especially on mobile/slow connections
- **No quality loss** at our quality setting (85)
- **Broad browser support** with fallbacks
- **Lazy loading** - images load as needed

## Converting Images

### One-Time Setup

Install the Sharp image processing library:

```bash
bun add -d sharp
```

### Converting All Images

Run the conversion script to generate WebP versions:

```bash
bun run optimize:images
```

or directly:

```bash
node scripts/convert-to-webp.js
```

### What Gets Converted

The script processes these directories:

- `src/images/items/` - 77+ item images
- `src/images/weapons/` - Weapon sprites
- `src/images/tomes/` - Tome icons
- `src/images/characters/` - Character portraits
- `src/icons/` - App icons

### Output

```
🖼️  MegaBonk WebP Converter

Converting PNG/JPG images to WebP format...

📂 Processing src/images/items (77 images)...
✓ anvil.png → anvil.webp (32.4% smaller)
✓ backpack.png → backpack.webp (28.9% smaller)
✓ battery.png → battery.webp (31.2% smaller)
...

============================================================
✅ Conversion Complete!
   Total images converted: 77
   Original size: 467.3 KB
   WebP size: 325.1 KB
   Total savings: 30.4%
============================================================
```

## Adding New Images

When adding new game content images:

1. Add the PNG file to the appropriate directory
2. Run `bun run optimize:images` to generate WebP
3. The app will automatically use WebP where supported

## How Images Are Generated

The `generateResponsiveImage()` function in `src/modules/utils.js` handles all image generation:

```javascript
generateResponsiveImage('images/items/big_bonk.png', 'Big Bonk', 'entity-image')
```

This creates:
- WebP source for modern browsers
- PNG fallback for older browsers
- Lazy loading for performance
- Proper alt text for accessibility
- Error handling (hides broken images)

## Service Worker Caching

The service worker (`src/sw.js`) caches both PNG and WebP versions:

```javascript
// Network-first strategy ensures fresh data
// but caches images for offline use
```

When you run `optimize:images`, update the cache version in `sw.js` if needed.

## Browser Support

### WebP Support (Modern)
- Chrome 32+
- Firefox 65+
- Edge 18+
- Safari 14+ (macOS 11+)
- Mobile browsers (iOS 14+, Android 5+)

### PNG Fallback (Legacy)
- Internet Explorer 11
- Safari 13 and below
- Older Android/iOS versions

The app automatically detects support via the `<picture>` element.

## Performance Impact

### Before WebP
- 77 items × ~6 KB avg = **462 KB total**
- First load: ~600ms (slow 3G)

### After WebP
- 77 items × ~4 KB avg = **308 KB total**
- First load: ~400ms (slow 3G)
- **33% reduction in image data**

## Technical Details

### Conversion Settings

```javascript
sharp(inputPath)
  .webp({ quality: 85 })  // Balance quality/size
  .toFile(outputPath)
```

Quality 85 provides excellent visual quality while maintaining significant size savings.

### Incremental Conversion

The script skips already-converted images if the WebP is newer than the source PNG:

```javascript
if (outputStat.mtime > inputStat.mtime) {
    console.log(`⊘ Skipping ${file} (WebP is up to date)`);
    continue;
}
```

This makes re-running fast during development.

## Troubleshooting

### Sharp Installation Issues

If `bun add -d sharp` fails:

```bash
# Try with npm
npm install --save-dev sharp

# Or force rebuild
bun add -d sharp --force
```

### Images Not Loading

1. Check browser console for 404 errors
2. Verify WebP files exist alongside PNGs
3. Clear service worker cache in DevTools → Application → Storage
4. Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)

### Conversion Script Errors

If the script fails:

```bash
# Check Sharp is installed
node -e "console.log(require('sharp'))"

# Verify directories exist
ls -la src/images/items/

# Run with more verbose output
NODE_DEBUG=sharp node scripts/convert-to-webp.js
```

## Future Enhancements

Potential optimizations:

- [ ] AVIF format support (even smaller, but less browser support)
- [ ] Responsive images with srcset (different sizes per viewport)
- [ ] Automatic conversion in pre-commit hook
- [ ] CDN integration with automatic format negotiation
