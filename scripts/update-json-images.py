#!/usr/bin/env python3
"""
Update JSON data files with image paths for downloaded images.
"""

import os
import json
from pathlib import Path

# Directories
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
DATA_DIR = PROJECT_DIR / "data"
IMAGES_DIR = PROJECT_DIR / "src" / "images"


def get_available_images(entity_type):
    """Get a dict of entity_id -> image_path for available images."""
    images_path = IMAGES_DIR / entity_type
    if not images_path.exists():
        return {}

    images = {}
    for img_file in images_path.iterdir():
        if img_file.is_file():
            # ID is filename without extension
            entity_id = img_file.stem
            # Path relative to src/ directory
            rel_path = f"images/{entity_type}/{img_file.name}"
            images[entity_id] = rel_path

    return images


def update_json_file(entity_type, list_key):
    """Update a JSON file with image paths."""
    json_path = DATA_DIR / f"{entity_type}.json"

    if not json_path.exists():
        print(f"  Skipping {entity_type}: JSON file not found")
        return 0

    # Load JSON
    with open(json_path, 'r') as f:
        data = json.load(f)

    # Get available images
    images = get_available_images(entity_type)
    print(f"  Found {len(images)} images for {entity_type}")

    # Update entities
    entities = data.get(list_key, [])
    updated = 0

    for entity in entities:
        entity_id = entity.get("id", "")
        if entity_id in images:
            entity["image"] = images[entity_id]
            updated += 1
        else:
            # Remove image field if no image exists
            entity.pop("image", None)

    # Save updated JSON
    with open(json_path, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"  Updated {updated}/{len(entities)} entities with images")
    return updated


def main():
    print("="*60)
    print("Updating JSON files with image paths")
    print("="*60)

    total = 0

    # Update each entity type
    configs = [
        ("items", "items"),
        ("weapons", "weapons"),
        ("characters", "characters"),
        ("tomes", "tomes"),
    ]

    for entity_type, list_key in configs:
        print(f"\n{entity_type.upper()}:")
        count = update_json_file(entity_type, list_key)
        total += count

    print(f"\n{'='*60}")
    print(f"COMPLETE: Added image paths to {total} entities")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
