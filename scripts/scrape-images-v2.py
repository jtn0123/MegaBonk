#!/usr/bin/env python3
"""
MegaBonk Image Scraper v2 - Improved matching
Downloads images from the Fandom Wiki with better name matching.
"""

import os
import re
import json
import time
import urllib.request
from pathlib import Path
from html.parser import HTMLParser

# Configuration
BASE_URL = "https://megabonk.fandom.com"
WIKI_PAGES = {
    "items": "/wiki/Items",
    "weapons": "/wiki/Weapons",
    "characters": "/wiki/Characters",
    "tomes": "/wiki/Tomes"
}

# Directories
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
DATA_DIR = PROJECT_DIR / "data"
IMAGES_DIR = PROJECT_DIR / "src" / "images"

# Rate limiting
DELAY_BETWEEN_REQUESTS = 0.3


class WikiImageParser(HTMLParser):
    """Parse wiki page to extract image URLs and names."""

    def __init__(self):
        super().__init__()
        self.images = []
        self.in_table = False
        self.in_link = False
        self.current_link_text = ""
        self.current_image = None

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)

        if tag == "a":
            self.in_link = True
            self.current_link_text = ""

        if tag == "img":
            src = attrs_dict.get("src", "")
            alt = attrs_dict.get("alt", "")
            data_src = attrs_dict.get("data-src", "")

            img_url = data_src if data_src else src

            if "static.wikia.nocookie.net/megabonk/images" in img_url:
                # Get full resolution
                img_url = re.sub(r'/revision/latest.*', '/revision/latest', img_url)
                name = alt if alt else self._extract_name_from_url(img_url)
                if name and img_url:
                    self.images.append((name, img_url))

    def handle_data(self, data):
        if self.in_link:
            self.current_link_text += data

    def handle_endtag(self, tag):
        if tag == "a":
            self.in_link = False

    def _extract_name_from_url(self, url):
        match = re.search(r'/images/\w/\w+/([^/]+)\.(png|jpg|jpeg|gif)', url, re.IGNORECASE)
        if match:
            name = match.group(1)
            name = name.replace("_", " ").replace("-", " ")
            return name
        return None


def normalize_name(name):
    """Normalize a name for matching."""
    if not name:
        return ""
    normalized = name.lower().strip()
    # Remove special characters but keep spaces
    normalized = re.sub(r'[^a-z0-9\s]', '', normalized)
    # Collapse multiple spaces
    normalized = re.sub(r'\s+', ' ', normalized)
    return normalized


def create_name_variants(name):
    """Create multiple variants of a name for matching."""
    variants = set()

    # Original
    variants.add(normalize_name(name))

    # Without common suffixes
    for suffix in [' icon', ' img', ' image', ' item', ' weapon', ' tome', ' char']:
        variants.add(normalize_name(name.replace(suffix, '')))

    # ID form (underscores)
    id_form = normalize_name(name).replace(' ', '_')
    variants.add(id_form)

    # Without parentheses content
    no_parens = re.sub(r'\s*\([^)]*\)', '', name)
    variants.add(normalize_name(no_parens))

    # Handle "X's Y" -> "xs y"
    no_apostrophe = name.replace("'s", "s").replace("'", "")
    variants.add(normalize_name(no_apostrophe))

    # Remove trailing numbers/underscores
    clean = re.sub(r'[\s_]+\d*$', '', normalize_name(name))
    variants.add(clean)

    # Remove leading/trailing underscores or spaces from variants
    variants = {v.strip('_ ') for v in variants if v.strip('_ ')}

    return variants


def fetch_page(url):
    """Fetch a web page and return its content."""
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
    """Download an image and save it to disk."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) MegaBonkGuide/1.0"
    }
    request = urllib.request.Request(url, headers=headers)

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            data = response.read()
            save_path.parent.mkdir(parents=True, exist_ok=True)
            with open(save_path, 'wb') as f:
                f.write(data)
            return True
    except Exception as e:
        print(f"  Error downloading {url}: {e}")
        return False


def load_entities(entity_type):
    """Load entities from JSON and create name mappings."""
    json_file = DATA_DIR / f"{entity_type}.json"

    if not json_file.exists():
        return {}, []

    with open(json_file, 'r') as f:
        data = json.load(f)

    entities = data.get(entity_type, [])

    # Create mapping: normalized_name -> entity_id
    name_to_id = {}
    missing_ids = []

    # Check what images we already have
    img_dir = IMAGES_DIR / entity_type
    existing = set()
    if img_dir.exists():
        existing = {f.stem for f in img_dir.iterdir() if f.is_file()}

    for entity in entities:
        entity_id = entity.get("id", "")
        entity_name = entity.get("name", "")

        # Skip if we already have this image
        if entity_id in existing:
            continue

        missing_ids.append(entity_id)

        # Create all name variants and map them to this ID
        variants = create_name_variants(entity_name)
        variants.update(create_name_variants(entity_id.replace('_', ' ')))

        for variant in variants:
            if variant and variant not in name_to_id:
                name_to_id[variant] = entity_id

    return name_to_id, missing_ids


def match_image_to_entity(img_name, name_to_id):
    """Try to match an image name to an entity ID."""
    variants = create_name_variants(img_name)

    for variant in variants:
        if variant in name_to_id:
            return name_to_id[variant]

    # Try partial matching for longer names
    normalized = normalize_name(img_name)
    for name, entity_id in name_to_id.items():
        if len(name) > 3 and len(normalized) > 3:
            if name in normalized or normalized in name:
                return entity_id

    return None


def scrape_entity_type(entity_type, wiki_path):
    """Scrape images for a specific entity type."""
    print(f"\n{'='*60}")
    print(f"Scraping {entity_type.upper()}")
    print(f"{'='*60}")

    name_to_id, missing_ids = load_entities(entity_type)

    if not missing_ids:
        print(f"  All images already downloaded!")
        return 0

    print(f"  Missing {len(missing_ids)} images")

    # Fetch main wiki page
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
            ext_match = re.search(r'\.(png|jpg|jpeg|gif)', img_url, re.IGNORECASE)
            ext = ext_match.group(1).lower() if ext_match else "png"

            save_path = output_dir / f"{entity_id}.{ext}"

            print(f"  ✓ {img_name} -> {entity_id}.{ext}")

            if download_image(img_url, save_path):
                downloaded += 1
                matched.add(entity_id)

            time.sleep(DELAY_BETWEEN_REQUESTS)

    # Try individual pages for remaining missing items
    still_missing = [eid for eid in missing_ids if eid not in matched]

    if still_missing and len(still_missing) <= 30:  # Only try individual pages if not too many
        print(f"\n  Trying individual wiki pages for {len(still_missing)} missing items...")

        for entity_id in still_missing:
            # Convert ID to wiki page name
            page_name = entity_id.replace('_', ' ').title().replace(' ', '_')
            page_url = f"{BASE_URL}/wiki/{page_name}"

            html = fetch_page(page_url)
            if html:
                parser = WikiImageParser()
                parser.feed(html)

                # Look for the first suitable image
                for img_name, img_url in parser.images:
                    # Skip tiny icons
                    if 'icon' in img_url.lower() and '32' in img_url:
                        continue

                    ext_match = re.search(r'\.(png|jpg|jpeg|gif)', img_url, re.IGNORECASE)
                    ext = ext_match.group(1).lower() if ext_match else "png"

                    save_path = output_dir / f"{entity_id}.{ext}"

                    if download_image(img_url, save_path):
                        print(f"  ✓ [page] {page_name} -> {entity_id}.{ext}")
                        downloaded += 1
                        matched.add(entity_id)
                        break

                time.sleep(DELAY_BETWEEN_REQUESTS)

    print(f"\n  Downloaded {downloaded} new images for {entity_type}")
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
        for entity in data.get(entity_type, []):
            entity_id = entity.get("id", "")
            if entity_id in images:
                entity["image"] = images[entity_id]
                updated += 1
            else:
                entity.pop("image", None)

        with open(json_path, 'w') as f:
            json.dump(data, f, indent=2)

        print(f"  {entity_type}: {updated} entities with images")


def main():
    print("="*60)
    print("MegaBonk Image Scraper v2 - Improved Matching")
    print("="*60)

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
            count = len(list(dir_path.glob("*")))
            print(f"  {entity_type}: {count} images")


if __name__ == "__main__":
    main()
