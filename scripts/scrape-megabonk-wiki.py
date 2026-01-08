#!/usr/bin/env python3
"""
Scrape images from megabonk.wiki (the official community wiki).
This wiki has better image coverage than the Fandom wiki.
"""

import os
import re
import json
import time
import urllib.request
from pathlib import Path
from html.parser import HTMLParser

BASE_URL = "https://megabonk.wiki"
WIKI_PAGES = {
    "items": "/wiki/Items",
    "weapons": "/wiki/Weapons",
    "tomes": "/wiki/Tomes",
    "characters": "/wiki/Characters"
}

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
DATA_DIR = PROJECT_DIR / "data"
IMAGES_DIR = PROJECT_DIR / "src" / "images"

DELAY = 0.3


class WikiImageParser(HTMLParser):
    """Parse wiki page to extract image URLs."""

    def __init__(self):
        super().__init__()
        self.images = []  # List of (name, url) tuples

    def handle_starttag(self, tag, attrs):
        if tag == "img":
            attrs_dict = dict(attrs)
            src = attrs_dict.get("src", "")
            alt = attrs_dict.get("alt", "")

            # Skip tiny icons, logos, and UI elements
            if any(skip in src.lower() for skip in ["logo", "icon-", "ui_", "stat_", "rarity"]):
                return

            # Look for item/weapon/tome images
            if "/images/" in src and not src.endswith(".svg"):
                # Build full URL
                if src.startswith("/"):
                    full_url = BASE_URL + src
                elif src.startswith("http"):
                    full_url = src
                else:
                    return

                # Get name from alt text or filename
                name = alt if alt else self._extract_name_from_url(src)
                if name:
                    self.images.append((name, full_url))

    def _extract_name_from_url(self, url):
        """Extract item name from image URL."""
        # Pattern: /images/x/xx/Item_Name.png or /images/thumb/x/xx/Item_Name.png/...
        match = re.search(r'/([^/]+)\.(png|jpg|jpeg|gif|webp)', url, re.IGNORECASE)
        if match:
            name = match.group(1)
            # Remove common prefixes
            for prefix in ["Item_", "Weapon_", "Tome_", "Character_"]:
                if name.startswith(prefix):
                    name = name[len(prefix):]
            name = name.replace("_", " ").replace("-", " ")
            return name
        return None


def normalize_name(name):
    """Normalize a name for matching."""
    if not name:
        return ""
    normalized = name.lower().strip()
    normalized = re.sub(r'[^a-z0-9\s]', '', normalized)
    normalized = re.sub(r'\s+', ' ', normalized)
    return normalized


def create_id_from_name(name):
    """Convert display name to ID format."""
    if not name:
        return ""
    # Convert to lowercase, replace spaces with underscores
    id_form = name.lower().strip()
    id_form = re.sub(r'[^a-z0-9\s]', '', id_form)
    id_form = re.sub(r'\s+', '_', id_form)
    return id_form


def fetch_page(url):
    """Fetch a web page."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) MegaBonkGuide/1.0"
    }
    request = urllib.request.Request(url, headers=headers)

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.read().decode('utf-8')
    except Exception as e:
        print(f"  Error fetching {url}: {e}")
        return None


def download_image(url, save_path):
    """Download an image."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) MegaBonkGuide/1.0"
    }
    request = urllib.request.Request(url, headers=headers)

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            data = response.read()

            # Skip if too small (likely placeholder)
            if len(data) < 500:
                return False

            # Skip if it's the wiki logo (check for consistent size)
            if len(data) == 5320:
                print(f"    Skipping wiki logo")
                return False

            save_path.parent.mkdir(parents=True, exist_ok=True)
            with open(save_path, 'wb') as f:
                f.write(data)
            return True
    except Exception as e:
        print(f"  Error downloading {url}: {e}")
        return False


def load_entity_ids(entity_type):
    """Load entity IDs from JSON."""
    json_file = DATA_DIR / f"{entity_type}.json"
    if not json_file.exists():
        return {}

    with open(json_file, 'r') as f:
        data = json.load(f)

    # Create mapping: various name forms -> entity_id
    name_to_id = {}
    for entity in data.get(entity_type, []):
        entity_id = entity.get("id", "")
        entity_name = entity.get("name", "")

        if not entity_id:
            continue

        # Add various forms
        name_to_id[normalize_name(entity_name)] = entity_id
        name_to_id[normalize_name(entity_id.replace("_", " "))] = entity_id
        name_to_id[entity_id] = entity_id

        # Handle special cases
        if "'" in entity_name:
            name_to_id[normalize_name(entity_name.replace("'", ""))] = entity_id
        if "(" in entity_name:
            name_to_id[normalize_name(re.sub(r'\s*\([^)]*\)', '', entity_name))] = entity_id

    return name_to_id


def match_image_to_entity(img_name, name_to_id):
    """Try to match an image name to an entity ID."""
    # Direct match
    normalized = normalize_name(img_name)
    if normalized in name_to_id:
        return name_to_id[normalized]

    # Try without common prefixes/suffixes
    for prefix in ["item ", "weapon ", "tome ", "character "]:
        if normalized.startswith(prefix):
            clean = normalized[len(prefix):]
            if clean in name_to_id:
                return name_to_id[clean]

    # Try ID form
    id_form = create_id_from_name(img_name)
    if id_form in name_to_id:
        return name_to_id[id_form]

    # Partial match
    for name, entity_id in name_to_id.items():
        if len(name) > 3 and len(normalized) > 3:
            if name in normalized or normalized in name:
                return entity_id

    return None


def scrape_entity_type(entity_type, wiki_path):
    """Scrape images for a specific entity type."""
    print(f"\n{'='*60}")
    print(f"Scraping {entity_type.upper()} from megabonk.wiki")
    print(f"{'='*60}")

    name_to_id = load_entity_ids(entity_type)
    if not name_to_id:
        print(f"  No entities found in {entity_type}.json")
        return 0

    # Check existing images
    img_dir = IMAGES_DIR / entity_type
    existing = set()
    if img_dir.exists():
        existing = {f.stem for f in img_dir.iterdir() if f.is_file()}

    print(f"  {len(existing)} images already exist")

    # Fetch wiki page
    url = BASE_URL + wiki_path
    print(f"  Fetching: {url}")

    html = fetch_page(url)
    if not html:
        return 0

    parser = WikiImageParser()
    parser.feed(html)
    print(f"  Found {len(parser.images)} images on page")

    output_dir = IMAGES_DIR / entity_type
    output_dir.mkdir(parents=True, exist_ok=True)

    downloaded = 0
    matched = set()

    for img_name, img_url in parser.images:
        entity_id = match_image_to_entity(img_name, name_to_id)

        if entity_id and entity_id not in matched:
            # Skip if already have this image
            if entity_id in existing:
                matched.add(entity_id)
                continue

            # Determine extension
            ext_match = re.search(r'\.(png|jpg|jpeg|gif|webp)', img_url, re.IGNORECASE)
            ext = ext_match.group(1).lower() if ext_match else "png"

            save_path = output_dir / f"{entity_id}.{ext}"

            print(f"  Downloading: {img_name} -> {entity_id}.{ext}")

            if download_image(img_url, save_path):
                downloaded += 1
                matched.add(entity_id)

            time.sleep(DELAY)

    # Report missing
    all_ids = set(name_to_id.values())
    still_missing = all_ids - existing - matched
    if still_missing:
        print(f"\n  Still missing {len(still_missing)} images:")
        for mid in sorted(still_missing)[:10]:
            print(f"    - {mid}")
        if len(still_missing) > 10:
            print(f"    ... and {len(still_missing) - 10} more")

    print(f"\n  Downloaded {downloaded} new images")
    return downloaded


def update_json_with_images():
    """Update JSON files with image paths."""
    print(f"\n{'='*60}")
    print("Updating JSON files with image paths")
    print(f"{'='*60}")

    for entity_type in WIKI_PAGES.keys():
        json_path = DATA_DIR / f"{entity_type}.json"
        if not json_path.exists():
            continue

        with open(json_path, 'r') as f:
            data = json.load(f)

        img_dir = IMAGES_DIR / entity_type
        if not img_dir.exists():
            continue

        # Get available images
        images = {}
        for img_file in img_dir.iterdir():
            if img_file.is_file():
                images[img_file.stem] = f"images/{entity_type}/{img_file.name}"

        # Update entities
        updated = 0
        total = 0
        for entity in data.get(entity_type, []):
            total += 1
            entity_id = entity.get("id", "")
            if entity_id in images:
                entity["image"] = images[entity_id]
                updated += 1
            else:
                entity.pop("image", None)

        with open(json_path, 'w') as f:
            json.dump(data, f, indent=2)

        print(f"  {entity_type}: {updated}/{total} entities with images")


def main():
    print("="*60)
    print("MegaBonk Image Scraper - megabonk.wiki")
    print("="*60)
    print("Source: https://megabonk.wiki")

    total_downloaded = 0

    for entity_type, wiki_path in WIKI_PAGES.items():
        count = scrape_entity_type(entity_type, wiki_path)
        total_downloaded += count
        time.sleep(1)

    print(f"\n{'='*60}")
    print(f"Downloaded {total_downloaded} new images")
    print(f"{'='*60}")

    # Update JSON files
    update_json_with_images()

    # Show final counts
    print(f"\n{'='*60}")
    print("Final image counts:")
    print(f"{'='*60}")
    for entity_type in WIKI_PAGES.keys():
        dir_path = IMAGES_DIR / entity_type
        if dir_path.exists():
            count = len([f for f in dir_path.iterdir() if f.is_file()])
            json_path = DATA_DIR / f"{entity_type}.json"
            total = 0
            if json_path.exists():
                with open(json_path) as f:
                    total = len(json.load(f).get(entity_type, []))
            print(f"  {entity_type}: {count}/{total} images")


if __name__ == "__main__":
    main()
