# Item Name Mapping Guide

## Ground Truth → Actual Item Name Mapping

This guide maps visual descriptions (what we see in screenshots) to actual game item names (what's in items.json).

### ✅ CONFIRMED MATCHES

| Visual Description | Actual Game Name | Confidence |
|-------------------|------------------|------------|
| Battery | Battery | 100% ✅ |
| Wrench | Wrench | 100% ✅ |
| Yellow Wrench | Wrench | 95% (color variant) |
| Green Wrench | Wrench | 95% (color variant) |
| Beer | Beer | 100% ✅ |
| Burger | Borgar | 95% (meme spelling) |

### 🤔 LIKELY MATCHES

| Visual Description | Likely Game Name | Reasoning |
|-------------------|------------------|-----------|
| First Aid Kit | Medkit | Only healing item with medical cross |
| Banana | Oats | Food item, yellowish |
| Cheese | Moldy Cheese | Only cheese item in database |
| Green Plant | Clover | Only plant-like item (4-leaf clover) |
| Blue Orb | Lightning Orb | Only orb item |
| Blue Orb | Forbidden Juice | Also looks like blue orb/potion |
| Green Potion | Gym Sauce | Green liquid item |
| Green Potion | Forbidden Juice | Also greenish |
| Red Spiky Item | Spiky Shield | Only spiky item |
| Ice/Blue Item | Ice Cube | Legendary ice item |
| Ice/Blue Item | Ice Crystal | Common ice item |

### ❓ UNKNOWN MAPPINGS

These items from ground truth have NO clear match:

| Visual Description | Possible Matches | Notes |
|-------------------|------------------|-------|
| Blue Portal | ??? | No portal items in database |
| Blue Penguin | ??? | No penguin/bird items in database |
| White Hand | ??? | No hand items except gloves |
| Yellow Gear | ??? | Multiple gear-like items possible |
| Yellow Puzzle | ??? | No puzzle items in database |
| Pink Item | ??? | Too vague - need specific visual |
| Yellow Item | ??? | Too vague - need specific visual |
| Orange Item | ??? | Too vague - need specific visual |
| Tomato | ??? | No tomato in database |
| Pink Demon | ??? | No demon items in database |
| Yellow Bomb | ??? | No bomb items in database |
| Meat | ??? | No meat items (except "Spicy Meatball") |
| Red Flame | Dragonfire | Only fire item (legendary) |
| Yellow Tool | Wrench | Possibly another wrench variant |
| Green Magnet | Sucky Magnet | Only magnet item |
| Hourglass | ??? | No hourglass items |
| Red Soda | ??? | No soda items |
| Yellow Cookie | ??? | No cookie items |
| Brown Cookie | ??? | No cookie items |
| Green Slime | ??? | No slime items |

### 🎨 Items by Visual Category

#### Food & Consumables
- **Oats** - grain/food
- **Borgar** - burger
- **Beer** - drink
- **Spicy Meatball** - food
- **Moldy Cheese** - cheese
- **Gym Sauce** - green liquid
- **Forbidden Juice** - purple/blue liquid
- **Grandma's Secret Tonic** - potion

#### Medical/Healing
- **Medkit** - first aid
- **Demonic Blood** - red potion

#### Tools & Equipment
- **Wrench** - tool (common)
- **Battery** - electronic
- **Anvil** - crafting tool
- **Electric Plug** - electronic

#### Combat Items
- **Spiky Shield** - spiky defense
- **Boss Buster** - weapon
- **Joe's Dagger** - weapon
- **Bloody Cleaver** - weapon
- **Soul Harvester** - weapon
- **Demonic Blade** - weapon

#### Wearables
- **Tactical Glasses** - eyewear
- **Gamer Goggles** - eyewear
- **Gas Mask** - eyewear
- **Power Gloves** - gloves
- **Golden Glove** - gloves
- **Moldy Gloves** - gloves
- **Slurp Gloves** - gloves
- **Cursed Grabbies** - gloves
- **Thunder Mitts** - gloves
- **Brass Knuckles** - gloves
- **Turbo Socks** - footwear
- **Golden Sneakers** - footwear
- **Turbo Skates** - footwear
- **Backpack** - backpack
- **Scarf** - clothing
- **Coward's Cloak** - clothing

#### Jewelry & Accessories
- **Beefy Ring** - ring
- **Slippery Ring** - ring
- **Time Bracelet** - bracelet
- **Clover** - lucky charm
- **Key** - key
- **Mirror** - mirror
- **Feathers** - feathers
- **Campfire** - campfire

#### Magical/Mystical
- **Lightning Orb** - orb (legendary)
- **Energy Core** - core
- **Za Warudo** - time stop
- **Holy Book** - book
- **Shattered Knowledge** - book
- **Demonic Soul** - soul
- **Cursed Doll** - doll
- **Ghost** - ghost
- **Echo Shard** - shard
- **Leeching Crystal** - crystal
- **Ice Crystal** - crystal
- **Overpowered Lamp** - lamp
- **Beacon** - light
- **Phantom Shroud** - shroud

#### Special/Unique
- **Big Bonk** - bonk
- **Sucky Magnet** - magnet
- **Chonkplate** - plate
- **Ice Cube** - ice
- **Dragonfire** - fire
- **Speed Boi** - speed
- **Giant Fork** - fork
- **Eagle Claw** - claw
- **Slutty Cannon** - cannon
- **Toxic Barrel** - barrel
- **Golden Shield** - shield
- **Kevin** - ??? (just Kevin)
- **Bob (Dead)** - ??? (just Bob)
- **Cactus** - plant
- **Credit Card (Green)** - card
- **Credit Card (Red)** - card
- **Skuleg** - skull leg
- **Quin's Mask** - mask
- **Unstable Transfusion** - medical

## How to Use This Guide

### For Testing:

1. **Look at the screenshot**
2. **Identify the visual appearance** (green potion, yellow wrench, etc.)
3. **Check this mapping guide** for likely game name
4. **Update ground-truth.json** with actual game name

### For OCR Tuning:

If you want OCR to match visual descriptions:

```javascript
// In ocr.ts or items.json, add aliases:
{
  "name": "Medkit",
  "aliases": ["First Aid Kit", "Health Kit", "Medkit"],
  "visual_description": "red cross on white background"
}

{
  "name": "Borgar",
  "aliases": ["Burger", "Hamburger", "Borgar"],
  "visual_description": "brown burger with yellow cheese"
}
```

Then update fuzzy matching to also search aliases.

## Priority Mappings to Fix

For Screenshot 5 (Level 38 - 18 items), focus on these first:

1. **First Aid Kit** → Medkit (HIGH PRIORITY)
2. **Banana** → Oats? (MEDIUM)
3. **Green Potion** → Gym Sauce? (MEDIUM)
4. **Yellow Wrench** → Wrench (HIGH)
5. **Burger** → Borgar (HIGH)

These 5 items make up ~30% of the screenshot and are easier to identify.

## Recommendations

### Short Term:
- Manually map the most common items (Medkit, Borgar, Wrench variants)
- Update ground truth for Screenshot 5
- Re-run OCR test

### Long Term:
- Add visual aliases to all items in items.json
- Create item sprite reference sheet
- Use CV template matching as primary detection
- Use OCR as secondary validation

---

**Note:** Many items in ground truth might not actually exist in the game (Blue Portal, Blue Penguin, Yellow Puzzle). These might be:
- Placeholder descriptions for unidentified items
- Misidentified items
- Items that look different than their name suggests
- Items from a different game version
