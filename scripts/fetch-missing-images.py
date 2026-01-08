#!/usr/bin/env python3
"""
Fetch remaining missing images from multiple sources.
"""

import os
import re
import json
import time
import urllib.request
from pathlib import Path
from html.parser import HTMLParser

BASE_URL = "https://megabonk.fandom.com"
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
DATA_DIR = PROJECT_DIR / "data"
IMAGES_DIR = PROJECT_DIR / "src" / "images"

DELAY = 0.3

# Missing items with possible wiki page names to try
MISSING_ITEMS = {
    "anvil": ["Anvil", "Anvil_(Item)", "Anvil_Item"],
    "big_bonk": ["Big_Bonk", "BigBonk", "Big_bonk"],
    "spicy_meatball": ["Spicy_Meatball", "SpicyMeatball", "Spicy_meatball"],
    "sucky_magnet": ["Sucky_Magnet", "SuckyMagnet", "Magnet"],
    "za_warudo": ["Za_Warudo", "ZaWarudo", "Za_warudo", "The_World"],
    "holy_book": ["Holy_Book", "HolyBook", "Holy_book"],
    "chonkplate": ["Chonkplate", "Chonk_Plate", "ChonkPlate"],
    "overpowered_lamp": ["Overpowered_Lamp", "OP_Lamp", "Lamp"],
    "lightning_orb": ["Lightning_Orb", "LightningOrb", "Lightning_orb"],
    "ice_cube": ["Ice_Cube", "IceCube", "Ice_cube"],
    "dragonfire": ["Dragonfire", "Dragon_Fire", "DragonFire"],
    "joes_dagger": ["Joe%27s_Dagger", "Joes_Dagger", "Joe's_Dagger"],
    "bloody_cleaver": ["Bloody_Cleaver", "BloodyCleaver", "Bloody_cleaver"],
    "soul_harvester": ["Soul_Harvester", "SoulHarvester", "Soul_harvester"],
    "energy_core": ["Energy_Core", "EnergyCore", "Energy_core"],
    "speed_boi": ["Speed_Boi", "SpeedBoi", "Speed_boi"],
    "giant_fork": ["Giant_Fork", "GiantFork", "Giant_fork"],
    "power_gloves": ["Power_Gloves", "PowerGloves", "Power_gloves"],
    "tactical_glasses": ["Tactical_Glasses", "TacticalGlasses", "Tactical_glasses"],
}

MISSING_WEAPONS = {
    "bow": ["Bow", "Bow_(Weapon)", "Bow_Weapon"],
    "black_hole": ["Black_Hole", "BlackHole", "Black_hole"],
    "slutty_rocket": ["Slutty_Rocket", "SluttyRocket", "Slutty_rocket"],
    "firestaff": ["Firestaff", "Fire_Staff", "FireStaff"],
    "chunkers": ["Chunkers", "Chunker", "Chunkers_(Weapon)"],
    "hero_sword": ["Hero_Sword", "HeroSword", "Hero_sword"],
    "flamewalker": ["Flamewalker", "Flame_Walker", "FlameWalker"],
}

MISSING_TOMES = {
    "hp": ["HP_Tome", "HPTome", "HP", "Health_Tome"],
    "projectile_speed": ["Projectile_Speed_Tome", "ProjectileSpeedTome", "Projectile_Speed"],
    "xp": ["XP_Tome", "XPTome", "XP", "Experience_Tome"],
}


class ImageExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.images = []

    def handle_starttag(self, tag, attrs):
        if tag == "img":
            attrs_dict = dict(attrs)
            src = attrs_dict.get("data-src", attrs_dict.get("src", ""))
            if "static.wikia.nocookie.net/megabonk/images" in src:
                # Get full resolution
                src = re.sub(r'/revision/latest.*', '/revision/latest', src)
                self.images.append(src)


def fetch_page(url):
    headers = {"User-Agent": "Mozilla/5.0 MegaBonkGuide/1.0"}
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.read().decode('utf-8')
    except:
        return None


def download_image(url, save_path):
    headers = {"User-Agent": "Mozilla/5.0 MegaBonkGuide/1.0"}
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            data = response.read()
            save_path.parent.mkdir(parents=True, exist_ok=True)
            with open(save_path, 'wb') as f:
                f.write(data)
            return True
    except Exception as e:
        return False


def try_fetch_from_wiki(entity_id, page_names, output_dir):
    """Try multiple wiki page names to find an image."""
    for page_name in page_names:
        url = f"{BASE_URL}/wiki/{page_name}"
        html = fetch_page(url)
        if html:
            parser = ImageExtractor()
            parser.feed(html)

            # Get first suitable image (skip tiny icons)
            for img_url in parser.images:
                if img_url:
                    ext_match = re.search(r'\.(png|jpg|jpeg|gif)', img_url, re.IGNORECASE)
                    ext = ext_match.group(1).lower() if ext_match else "png"
                    save_path = output_dir / f"{entity_id}.{ext}"

                    if download_image(img_url, save_path):
                        return True
        time.sleep(DELAY)
    return False


def search_in_gallery(entity_name, output_dir, entity_id):
    """Search the wiki's file/image gallery."""
    # Try searching for the image directly
    search_terms = [
        entity_name.replace(" ", "_"),
        entity_name.replace(" ", ""),
        entity_name.replace("'", "").replace(" ", "_"),
    ]

    for term in search_terms:
        # Try File: namespace
        url = f"{BASE_URL}/wiki/File:{term}.png"
        html = fetch_page(url)
        if html:
            parser = ImageExtractor()
            parser.feed(html)
            for img_url in parser.images:
                if term.lower() in img_url.lower():
                    ext_match = re.search(r'\.(png|jpg|jpeg|gif)', img_url, re.IGNORECASE)
                    ext = ext_match.group(1).lower() if ext_match else "png"
                    save_path = output_dir / f"{entity_id}.{ext}"
                    if download_image(img_url, save_path):
                        return True
        time.sleep(DELAY)

        # Also try .jpg
        url = f"{BASE_URL}/wiki/File:{term}.jpg"
        html = fetch_page(url)
        if html:
            parser = ImageExtractor()
            parser.feed(html)
            for img_url in parser.images:
                ext_match = re.search(r'\.(png|jpg|jpeg|gif)', img_url, re.IGNORECASE)
                ext = ext_match.group(1).lower() if ext_match else "png"
                save_path = output_dir / f"{entity_id}.{ext}"
                if download_image(img_url, save_path):
                    return True
        time.sleep(DELAY)

    return False


def main():
    print("="*60)
    print("Fetching Missing Images")
    print("="*60)

    total = 0

    # Items
    print(f"\nITEMS ({len(MISSING_ITEMS)} to find):")
    output_dir = IMAGES_DIR / "items"
    for entity_id, page_names in MISSING_ITEMS.items():
        # Check if already exists
        existing = list(output_dir.glob(f"{entity_id}.*"))
        if existing:
            continue

        print(f"  Searching for {entity_id}...", end=" ")

        # Try wiki pages
        if try_fetch_from_wiki(entity_id, page_names, output_dir):
            print("✓ Found!")
            total += 1
            continue

        # Try file gallery
        entity_name = page_names[0].replace("_", " ")
        if search_in_gallery(entity_name, output_dir, entity_id):
            print("✓ Found in gallery!")
            total += 1
            continue

        print("✗ Not found")

    # Weapons
    print(f"\nWEAPONS ({len(MISSING_WEAPONS)} to find):")
    output_dir = IMAGES_DIR / "weapons"
    for entity_id, page_names in MISSING_WEAPONS.items():
        existing = list(output_dir.glob(f"{entity_id}.*"))
        if existing:
            continue

        print(f"  Searching for {entity_id}...", end=" ")

        if try_fetch_from_wiki(entity_id, page_names, output_dir):
            print("✓ Found!")
            total += 1
            continue

        entity_name = page_names[0].replace("_", " ")
        if search_in_gallery(entity_name, output_dir, entity_id):
            print("✓ Found in gallery!")
            total += 1
            continue

        print("✗ Not found")

    # Tomes
    print(f"\nTOMES ({len(MISSING_TOMES)} to find):")
    output_dir = IMAGES_DIR / "tomes"
    for entity_id, page_names in MISSING_TOMES.items():
        existing = list(output_dir.glob(f"{entity_id}.*"))
        if existing:
            continue

        print(f"  Searching for {entity_id}...", end=" ")

        if try_fetch_from_wiki(entity_id, page_names, output_dir):
            print("✓ Found!")
            total += 1
            continue

        entity_name = page_names[0].replace("_", " ")
        if search_in_gallery(entity_name, output_dir, entity_id):
            print("✓ Found in gallery!")
            total += 1
            continue

        print("✗ Not found")

    print(f"\n{'='*60}")
    print(f"Found {total} additional images")
    print("="*60)

    # Update JSON
    if total > 0:
        print("\nUpdating JSON files...")
        for entity_type in ["items", "weapons", "tomes"]:
            json_path = DATA_DIR / f"{entity_type}.json"
            img_dir = IMAGES_DIR / entity_type

            with open(json_path, 'r') as f:
                data = json.load(f)

            images = {}
            for img_file in img_dir.iterdir():
                if img_file.is_file():
                    images[img_file.stem] = f"images/{entity_type}/{img_file.name}"

            for entity in data.get(entity_type, []):
                entity_id = entity.get("id", "")
                if entity_id in images:
                    entity["image"] = images[entity_id]

            with open(json_path, 'w') as f:
                json.dump(data, f, indent=2)

            print(f"  Updated {entity_type}.json")


if __name__ == "__main__":
    main()
