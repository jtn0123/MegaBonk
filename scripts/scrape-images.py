#!/usr/bin/env python3
"""
MegaBonk Image Scraper
Downloads images from the Fandom Wiki for all game entities.
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
DELAY_BETWEEN_REQUESTS = 0.5  # seconds


class WikiImageParser(HTMLParser):
    """Parse wiki page to extract image URLs and names."""

    def __init__(self):
        super().__init__()
        self.images = []  # List of (name, url) tuples
        self.in_table = False
        self.current_name = None
        self.current_image = None

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)

        # Look for images in the wiki content
        if tag == "img":
            src = attrs_dict.get("src", "")
            alt = attrs_dict.get("alt", "")
            data_src = attrs_dict.get("data-src", "")

            # Prefer data-src (lazy loaded) over src
            img_url = data_src if data_src else src

            # Filter for game entity images (not UI/icons)
            if "static.wikia.nocookie.net/megabonk/images" in img_url:
                # Clean up the URL - get full resolution
                img_url = re.sub(r'/revision/latest.*', '/revision/latest', img_url)

                # Extract name from alt text or URL
                name = alt if alt else self._extract_name_from_url(img_url)

                if name and img_url:
                    self.images.append((name, img_url))

    def _extract_name_from_url(self, url):
        """Extract entity name from image URL."""
        # URL pattern: .../images/X/XX/Name.png/...
        match = re.search(r'/images/\w/\w+/([^/]+)\.(png|jpg|jpeg|gif)', url, re.IGNORECASE)
        if match:
            name = match.group(1)
            # Clean up name
            name = name.replace("_", " ").replace("-", " ")
            return name
        return None


def normalize_name(name):
    """Normalize a name to a consistent ID format."""
    if not name:
        return None
    # Convert to lowercase, replace spaces with underscores
    normalized = name.lower().strip()
    normalized = re.sub(r'[^a-z0-9\s]', '', normalized)
    normalized = re.sub(r'\s+', '_', normalized)
    return normalized


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

            # Ensure directory exists
            save_path.parent.mkdir(parents=True, exist_ok=True)

            with open(save_path, 'wb') as f:
                f.write(data)
            return True
    except Exception as e:
        print(f"  Error downloading {url}: {e}")
        return False


def load_entity_names(entity_type):
    """Load entity names from JSON data file."""
    json_file = DATA_DIR / f"{entity_type}.json"

    if not json_file.exists():
        print(f"  Warning: {json_file} not found")
        return {}

    with open(json_file, 'r') as f:
        data = json.load(f)

    # Map normalized names to IDs
    name_to_id = {}

    # Handle different JSON structures
    if entity_type == "items":
        entities = data.get("items", [])
    elif entity_type == "weapons":
        entities = data.get("weapons", [])
    elif entity_type == "characters":
        entities = data.get("characters", [])
    elif entity_type == "tomes":
        entities = data.get("tomes", [])
    else:
        entities = []

    for entity in entities:
        entity_id = entity.get("id", "")
        entity_name = entity.get("name", "")

        # Map various name forms to the ID
        name_to_id[normalize_name(entity_name)] = entity_id
        name_to_id[entity_id] = entity_id

        # Also map without common suffixes
        name_no_suffix = re.sub(r'_(icon|img|image)$', '', normalize_name(entity_name))
        name_to_id[name_no_suffix] = entity_id

    return name_to_id


def scrape_entity_type(entity_type, wiki_path):
    """Scrape images for a specific entity type."""
    print(f"\n{'='*60}")
    print(f"Scraping {entity_type.upper()}")
    print(f"{'='*60}")

    # Load entity names for matching
    name_to_id = load_entity_names(entity_type)
    print(f"Loaded {len(name_to_id)} entity name mappings")

    # Fetch wiki page
    url = BASE_URL + wiki_path
    print(f"Fetching: {url}")

    html = fetch_page(url)
    if not html:
        print(f"  Failed to fetch page")
        return 0

    # Parse images
    parser = WikiImageParser()
    parser.feed(html)

    print(f"Found {len(parser.images)} images on page")

    # Download images
    output_dir = IMAGES_DIR / entity_type
    output_dir.mkdir(parents=True, exist_ok=True)

    downloaded = 0
    matched = {}

    for img_name, img_url in parser.images:
        # Try to match to an entity
        normalized = normalize_name(img_name)

        entity_id = name_to_id.get(normalized)

        # Try alternate normalizations
        if not entity_id:
            # Remove trailing underscores or numbers
            alt_normalized = re.sub(r'_+$', '', normalized)
            alt_normalized = re.sub(r'_\d+$', '', alt_normalized)
            entity_id = name_to_id.get(alt_normalized)

        if not entity_id:
            # Try the raw name
            entity_id = name_to_id.get(img_name.lower().replace(" ", "_"))

        if entity_id and entity_id not in matched:
            # Determine file extension from URL
            ext_match = re.search(r'\.(png|jpg|jpeg|gif)', img_url, re.IGNORECASE)
            ext = ext_match.group(1).lower() if ext_match else "png"

            save_path = output_dir / f"{entity_id}.{ext}"

            print(f"  Downloading: {img_name} -> {entity_id}.{ext}")

            if download_image(img_url, save_path):
                downloaded += 1
                matched[entity_id] = save_path

            time.sleep(DELAY_BETWEEN_REQUESTS)

    print(f"Downloaded {downloaded} images for {entity_type}")
    return downloaded


def main():
    """Main entry point."""
    print("="*60)
    print("MegaBonk Image Scraper")
    print("="*60)
    print(f"Project directory: {PROJECT_DIR}")
    print(f"Images directory: {IMAGES_DIR}")

    total_downloaded = 0

    for entity_type, wiki_path in WIKI_PAGES.items():
        count = scrape_entity_type(entity_type, wiki_path)
        total_downloaded += count
        time.sleep(1)  # Pause between entity types

    print(f"\n{'='*60}")
    print(f"COMPLETE: Downloaded {total_downloaded} images total")
    print(f"{'='*60}")

    # Show what's in each directory
    print("\nImages per directory:")
    for entity_type in WIKI_PAGES.keys():
        dir_path = IMAGES_DIR / entity_type
        if dir_path.exists():
            count = len(list(dir_path.glob("*")))
            print(f"  {entity_type}: {count} images")


if __name__ == "__main__":
    main()
