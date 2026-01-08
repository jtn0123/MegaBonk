# MegaBonk Item Scaling Guide - Implementation Plan

## Project Overview

This project will create a comprehensive, visual, and easily maintainable item scaling guide for MegaBonk that shows:
- **True item descriptions** with accurate scaling formulas
- **Visual indicators** for item power and stacking potential
- **Easy-to-update data structure** using JSON files
- **Beautiful web interface** for browsing and filtering items

## System Architecture

### 1. Data Layer (JSON Database)
```
/data
  ├── items.json          # All 77 items with complete data
  ├── stats.json          # Stat scaling formulas and mechanics
  ├── synergies.json      # Item combinations and interactions
  └── metadata.json       # Version info, last updated, patch notes
```

### 2. Presentation Layer (Web Interface)
```
/src
  ├── index.html          # Main viewer interface
  ├── styles.css          # Visual styling with rarity colors
  └── script.js           # Filtering, search, and interactive features
```

### 3. Documentation Layer
```
/docs
  ├── UPDATE_GUIDE.md     # How to update when meta changes
  ├── DATA_FORMAT.md      # JSON schema documentation
  └── SOURCES.md          # Links to official wikis and guides
```

## Data Structure Design

### Item Schema (items.json)
Each item will contain:

```json
{
  "name": "Beefy Ring",
  "rarity": "rare",
  "tier": "S",
  "unlocked_by_default": true,
  "unlock_requirement": null,
  "unlock_cost_silver": 0,
  "base_effect": "+20% damage per 100 max HP",
  "scaling_type": "multiplicative",
  "stacking_behavior": "additive",
  "stacks_well": true,
  "stack_cap": null,
  "formula": "Damage Bonus = (Max HP / 100) × 0.20 × Stack Count",
  "detailed_description": "Provides damage scaling based on your maximum health. Each copy increases the damage bonus additively. With 500 HP and 2 copies: (500/100) × 0.20 × 2 = +200% damage.",
  "synergies": ["Oats", "Demonic Blood", "Holy Book", "Leeching Crystal"],
  "anti_synergies": ["Beer"],
  "notes": "Excellent for tanky builds. Pairs perfectly with HP-stacking items.",
  "one_and_done": false
}
```

### Stats Schema (stats.json)
```json
{
  "damage": {
    "stat_name": "Damage",
    "category": "offensive",
    "scaling_type": "multiplicative",
    "formula": "Effective Damage = Weapon Damage × Character Damage",
    "description": "Foundational offensive multiplier",
    "priority": 1
  },
  "crit_chance": {
    "stat_name": "Critical Chance",
    "category": "offensive",
    "scaling_type": "additive_with_overcrit",
    "formula": "Overcrit stacks when >100%: 0 crits = 1.0×, 1 crit = 2.0×, 2 crits = 4.0×, 3 crits = 6.25×",
    "overcrit_formula": "(n × 0.5)² + (n + 1) where n = number of crits",
    "description": "Exceeding 100% enables Overcrits which apply Crit Damage twice",
    "priority": 2
  },
  "armor": {
    "stat_name": "Armor",
    "category": "defensive",
    "scaling_type": "hyperbolic",
    "formula": "Character Armor = Internal Armor / (0.75 + Internal Armor)",
    "description": "Percentage-based damage reduction with diminishing returns",
    "can_reach_100": false
  }
}
```

## Visual Design Features

### 1. Rarity Color Coding
- **Common**: `#5cb85c` (Green)
- **Uncommon**: `#5bc0de` (Blue)
- **Rare**: `#d946ef` (Magenta)
- **Epic**: `#8b5cf6` (Purple)
- **Legendary**: `#fbbf24` (Yellow/Gold)

### 2. Tier Badges
- **SS Tier**: Gold star icon, "Game-Breaking"
- **S Tier**: Silver star icon, "Excellent"
- **A Tier**: Bronze icon, "Strong"
- **B Tier**: Gray icon, "Situational"
- **C Tier**: Red icon, "Weak"

### 3. Stacking Indicators
- **Scales Infinitely**: ∞ icon
- **Stack Cap**: Number badge (e.g., "200 max")
- **One-and-Done**: ✓ icon, "Don't stack"

### 4. Interactive Features
- Search by item name
- Filter by rarity, tier, unlocked status
- Sort by: Name, Tier, Rarity, Stacking value
- Expandable details showing formulas and synergies
- "Compare Items" feature for side-by-side viewing

## Implementation Phases

### Phase 1: Data Collection ✓
- [x] Research all 77 items from MegaBonk wikis
- [x] Compile scaling formulas and mechanics
- [x] Gather tier list rankings

### Phase 2: Data Structure Creation
- [ ] Create items.json with all 77 items
  - Include all Common items (27)
  - Include all Uncommon items (21)
  - Include all Rare items (28)
  - Include all Legendary items (11)
- [ ] Create stats.json with all stat formulas
- [ ] Create synergies.json with item combinations
- [ ] Create metadata.json with version tracking

### Phase 3: Web Interface Development
- [ ] Create responsive HTML layout
- [ ] Style with rarity colors and visual hierarchy
- [ ] Implement JavaScript filtering and search
- [ ] Add formula calculator (input your stats, see actual numbers)
- [ ] Add "Build Planner" to simulate item combinations

### Phase 4: Documentation
- [ ] Write UPDATE_GUIDE.md with step-by-step instructions
- [ ] Document JSON schema in DATA_FORMAT.md
- [ ] Create SOURCES.md with all reference links
- [ ] Add CHANGELOG.md for tracking updates

### Phase 5: Testing & Polish
- [ ] Verify all formulas are accurate
- [ ] Test on mobile and desktop
- [ ] Add offline capability (works without internet)
- [ ] Create "Export Build" feature

## Maintainability Features

### Easy Update Workflow

When meta changes or game updates:

1. **Update items.json**
   - Find the item by name
   - Update the relevant fields (effect, formula, tier, etc.)
   - Add a note about the change

2. **Update metadata.json**
   - Increment version number
   - Add patch notes entry
   - Update "last_modified" timestamp

3. **Refresh browser**
   - Changes appear immediately
   - No code changes needed!

### Version Control
- Git tracking shows exactly what changed
- Commit messages document balance patches
- Easy to revert if needed

### Community Contributions
- JSON format is human-readable
- Anyone can submit corrections via pull requests
- Schema validation prevents bad data

## Technology Stack

### Core Technologies
- **HTML5**: Semantic markup, accessible
- **CSS3**: Modern styling with Grid/Flexbox
- **Vanilla JavaScript**: No dependencies, fast loading
- **JSON**: Universal, easy to edit

### Optional Enhancements (Future)
- **Chart.js**: Visualize stat scaling curves
- **Fuse.js**: Advanced fuzzy search
- **Local Storage**: Save favorite builds
- **Print Stylesheet**: Create PDF guides

## Success Metrics

✅ **Clear**: Every item shows exact scaling formulas
✅ **Visual**: Rarity colors, tier badges, stacking indicators
✅ **Maintainable**: Update JSON files, changes appear instantly
✅ **Detailed**: True descriptions with calculations
✅ **Searchable**: Find items quickly by name or effect
✅ **Offline**: Works without internet connection

## Next Steps

1. Review this plan
2. Confirm the approach meets your needs
3. Begin Phase 2: Create the JSON database
4. Build the web interface
5. Test and iterate

---

**Estimated Timeline**: Full implementation can be completed in this session.

**Maintenance Time**: 5-10 minutes per game update to modify JSON files.
