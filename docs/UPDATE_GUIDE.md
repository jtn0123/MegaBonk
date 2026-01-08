# How to Update the MegaBonk Item Scaling Guide

This guide shows you how to update the item database when MegaBonk receives patches, balance changes, or new content.

## 📋 Table of Contents

1. [Quick Update Process](#quick-update-process)
2. [Updating Existing Items](#updating-existing-items)
3. [Adding New Items](#adding-new-items)
4. [Updating Stats & Formulas](#updating-stats--formulas)
5. [Testing Your Changes](#testing-your-changes)
6. [Committing Updates](#committing-updates)

---

## Quick Update Process

**When a game patch drops:**

1. Find out what changed (patch notes, community discussions)
2. Open the relevant JSON file (`data/items.json` or `data/stats.json`)
3. Make your changes (see sections below)
4. Test by opening `src/index.html` in your browser
5. Commit and push your changes

**Estimated time: 5-10 minutes per update**

---

## Updating Existing Items

### Example: Item Gets Buffed

**Scenario:** Big Bonk's proc chance increased from 2% to 3%

1. Open `data/items.json`
2. Find the item by searching for `"id": "big_bonk"`
3. Update the relevant fields:

```json
{
  "id": "big_bonk",
  "name": "Big Bonk",
  "base_effect": "+3% chance to deal 20x damage",  // Changed from 2%
  "formula": "Total Proc Chance = 0.03 × Stack Count",  // Changed from 0.02
  "scaling_per_stack": [3, 6, 9, 12, 15, 18, 21, 24, 27, 30],  // Recalculated
  "detailed_description": "3% chance per copy..."  // Updated description
}
```

4. Update `last_updated` field at the top:
```json
{
  "version": "1.0.18",  // Increment version
  "last_updated": "2026-01-15",  // Today's date
  "items": [...]
}
```

5. Save and test!

### Example: Item Gets Nerfed

**Scenario:** Demonic Soul cap reduced from 100% to 75% per copy

```json
{
  "id": "demonic_soul",
  "base_effect": "+0.1% damage per kill (max 75% per copy)",  // Changed
  "formula": "Damage = 1 + (Kills × 0.001 × Stack Count), max 750 kills per copy",
  "scaling_per_stack": [75, 150, 225, 300, 375, 450, 525, 600, 675, 750],  // Adjusted
  "stack_cap": 750  // Changed from 1000
}
```

### Example: Tier List Changes

**Scenario:** Beefy Ring moves from S tier to SS tier

```json
{
  "id": "beefy_ring",
  "tier": "SS",  // Changed from "S"
  // Everything else stays the same
}
```

---

## Adding New Items

### Step 1: Create Item Entry

When a new item is added to the game, add it to `data/items.json`:

```json
{
  "id": "new_item_name",  // Lowercase, underscores
  "name": "New Item Name",  // Display name
  "rarity": "legendary",  // common, uncommon, rare, epic, legendary
  "tier": "A",  // SS, S, A, B, C
  "unlocked_by_default": false,
  "unlock_requirement": "Defeat boss X",
  "unlock_cost_silver": 15,
  "base_effect": "+X% something",
  "scaling_type": "additive_damage",  // See DATA_FORMAT.md for types
  "stacking_behavior": "additive",
  "stacks_well": true,  // Does it benefit from multiple copies?
  "stack_cap": null,  // Or a number if capped
  "formula": "Benefit = 0.X × Stack Count",
  "scaling_per_stack": [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  "detailed_description": "Detailed explanation of what it does and how it scales",
  "synergies": ["Item A", "Item B", "Stat X"],
  "anti_synergies": ["Item C"],
  "notes": "Important notes about the item",
  "graph_type": "linear_scaling",  // See graph types below
  "one_and_done": false
}
```

### Step 2: Calculate Scaling Values

For `scaling_per_stack`, calculate values for 1-10 copies:

**Example: +15% damage per copy**
```json
"scaling_per_stack": [15, 30, 45, 60, 75, 90, 105, 120, 135, 150]
```

**Example: 25% chance (caps at 100%)**
```json
"scaling_per_stack": [25, 50, 75, 100, 100, 100, 100, 100, 100, 100]
```

### Step 3: Choose Graph Type

Select the appropriate `graph_type`:

- `flat` - One-and-done items (Anvil, Sucky Magnet)
- `linear_scaling` - Additive benefits (Gym Sauce, Oats)
- `chance_scaling` - Chance-based, no cap (Big Bonk)
- `capped_chance` - Chance-based, caps at 100% (Spicy Meatball)
- `hard_capped` - Hard cap at specific value (Time Bracelet)
- `hyperbolic_scaling` - Diminishing returns (Armor, Evasion)
- `exponential_scaling` - Exponential growth (Giant Fork)
- `tradeoff_scaling` - Has downsides (Beer)
- `conditional_scaling` - Only works in specific situations

---

## Updating Stats & Formulas

### When Game Mechanics Change

If a core mechanic changes (e.g., crit formula, armor calculation), update `data/stats.json`:

**Example: Armor formula changed**

```json
{
  "stats": {
    "armor": {
      "stat_name": "Armor",
      "formula": "NEW FORMULA HERE",
      "description": "Updated description",
      "examples": {
        "50%_internal": "NEW VALUE actual armor"
      }
    }
  }
}
```

### Adding New Stats

If a new stat is added to the game:

```json
{
  "new_stat": {
    "stat_name": "New Stat Name",
    "category": "offensive",  // offensive, defensive, utility
    "scaling_type": "percentage_multiplier",
    "formula": "How it calculates",
    "description": "What it does",
    "priority": 12,
    "example": "Example calculation"
  }
}
```

---

## Testing Your Changes

### 1. Visual Test

1. Open `src/index.html` in your web browser
2. Find the item you changed
3. Verify:
   - ✅ Item displays correctly
   - ✅ Mini graph shows expected scaling
   - ✅ Click "View Detailed Graph" opens modal
   - ✅ Large graph shows correct values
   - ✅ All text is accurate

### 2. Filter Test

Test that filters still work:
- Search for the item name
- Filter by rarity
- Filter by tier
- Filter by stacking behavior

### 3. JSON Validation

Ensure your JSON is valid:
- Check for missing commas
- Check for extra commas (last item in array/object)
- Check for proper quote matching
- Use a JSON validator: https://jsonlint.com/

**Common mistakes:**
```json
// ❌ WRONG - extra comma
{
  "name": "Item",
  "tier": "S",  // <- This comma is fine
}  // <- Remove comma before closing brace

// ✅ CORRECT
{
  "name": "Item",
  "tier": "S"
}
```

---

## Committing Updates

### Update Checklist

Before committing:

- [ ] Updated version number in JSON file
- [ ] Updated `last_updated` date
- [ ] Tested changes in browser
- [ ] All graphs display correctly
- [ ] JSON is valid (no syntax errors)
- [ ] Documentation updated if needed

### Git Commit

```bash
# Stage your changes
git add data/items.json data/stats.json

# Commit with descriptive message
git commit -m "Update MegaBonk items for patch 1.0.18

- Big Bonk: Increased proc chance from 2% to 3%
- Demonic Soul: Reduced cap from 100% to 75%
- Beefy Ring: Moved from S to SS tier
"

# Push to remote
git push origin main
```

---

## Quick Reference Card

| Task | File | Field to Change |
|------|------|-----------------|
| Item buffed/nerfed | `items.json` | `base_effect`, `formula`, `scaling_per_stack` |
| Tier list change | `items.json` | `tier` |
| New item added | `items.json` | Add new item object |
| Item unlock changed | `items.json` | `unlock_requirement`, `unlock_cost_silver` |
| Stat formula changed | `stats.json` | `formula`, `examples` |
| New mechanic added | `stats.json` | Add new stat object |

---

## Need Help?

- **JSON Syntax Error?** Use https://jsonlint.com/ to find the problem
- **Graph Not Showing?** Check `scaling_per_stack` has 10 values
- **Can't Find Item?** Search the file for the item name in quotes
- **Not Sure About Formula?** Check community wikis or ask in Discord

---

## Pro Tips

1. **Keep backups**: Git tracks all changes, so you can always revert
2. **Test incrementally**: Make one change, test, then make another
3. **Document major changes**: Add notes in git commit messages
4. **Batch similar updates**: If multiple items change, update them all at once
5. **Cross-reference wikis**: Check multiple sources to verify changes

Happy updating! 🎮✨
