#!/usr/bin/env python3
"""
Upscale item template images from 32x32 to 64x64 for better CV detection.
Uses Lanczos resampling for high-quality pixel art upscaling.
"""

import os
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Error: PIL/Pillow is required. Install with: pip install Pillow")
    exit(1)

# Configuration
INPUT_DIR = Path(__file__).parent.parent / 'src' / 'images' / 'items'
TARGET_SIZE = (64, 64)

def upscale_templates():
    """Upscale all PNG templates to target size."""
    if not INPUT_DIR.exists():
        print(f"Error: Directory not found: {INPUT_DIR}")
        return False

    png_files = list(INPUT_DIR.glob('*.png'))

    if not png_files:
        print(f"No PNG files found in {INPUT_DIR}")
        return False

    print(f"Found {len(png_files)} PNG files to upscale")
    print(f"Target size: {TARGET_SIZE[0]}x{TARGET_SIZE[1]}")
    print("-" * 40)

    success_count = 0
    skip_count = 0
    error_count = 0

    for png_path in sorted(png_files):
        try:
            img = Image.open(png_path)
            original_size = img.size

            # Skip if already at target size
            if original_size == TARGET_SIZE:
                print(f"SKIP: {png_path.name} (already {TARGET_SIZE[0]}x{TARGET_SIZE[1]})")
                skip_count += 1
                continue

            # Use LANCZOS for high-quality upscaling (best for pixel art)
            upscaled = img.resize(TARGET_SIZE, Image.LANCZOS)

            # Preserve alpha channel if present
            if img.mode == 'RGBA':
                upscaled = upscaled.convert('RGBA')

            # Save back to same location
            upscaled.save(png_path, 'PNG', optimize=True)

            print(f"OK: {png_path.name} ({original_size[0]}x{original_size[1]} -> {TARGET_SIZE[0]}x{TARGET_SIZE[1]})")
            success_count += 1

        except Exception as e:
            print(f"ERROR: {png_path.name} - {e}")
            error_count += 1

    print("-" * 40)
    print(f"Done: {success_count} upscaled, {skip_count} skipped, {error_count} errors")

    return error_count == 0

def regenerate_webp():
    """Regenerate WebP versions of all PNG templates."""
    png_files = list(INPUT_DIR.glob('*.png'))

    print("\nRegenerating WebP versions...")
    print("-" * 40)

    success_count = 0
    error_count = 0

    for png_path in sorted(png_files):
        webp_path = png_path.with_suffix('.webp')

        try:
            img = Image.open(png_path)

            # Convert to RGBA for WebP with transparency
            if img.mode != 'RGBA':
                img = img.convert('RGBA')

            # Save as WebP with good quality
            img.save(webp_path, 'WEBP', quality=90, lossless=True)

            print(f"OK: {webp_path.name}")
            success_count += 1

        except Exception as e:
            print(f"ERROR: {webp_path.name} - {e}")
            error_count += 1

    print("-" * 40)
    print(f"Done: {success_count} WebP files regenerated, {error_count} errors")

    return error_count == 0

if __name__ == '__main__':
    print("=" * 40)
    print("Template Upscaling Script")
    print("=" * 40)

    # Step 1: Upscale PNGs
    png_ok = upscale_templates()

    # Step 2: Regenerate WebP versions
    webp_ok = regenerate_webp()

    print("\n" + "=" * 40)
    if png_ok and webp_ok:
        print("All done! Templates are now 64x64.")
        print("Restart dev server to see changes.")
    else:
        print("Completed with some errors. Check output above.")
    print("=" * 40)
