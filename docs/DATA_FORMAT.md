# MegaBonk Item Scaling Guide - Data Format Documentation

This document explains the structure and fields used in the JSON data files.

## 📋 Table of Contents

1. [items.json Structure](#itemsjson-structure)
2. [stats.json Structure](#statsjson-structure)
3. [Field Definitions](#field-definitions)
4. [Enum Values](#enum-values)
5. [Examples](#examples)

---

## items.json Structure

```json
{
  "version": "1.0.17",
  "last_updated": "2026-01-07",
  "items": [
    {
      // Item object (see below)
    }
  ]
}
```

### Item Object

```json
{
  "id": "string",
  "name": "string",
  "rarity": "common|uncommon|rare|epic|legendary",
  "tier": "SS|S|A|B|C",
  "unlocked_by_default": boolean,
  "unlock_requirement": "string|null",
  "unlock_cost_silver": number,
  "base_effect": "string",
  "scaling_type": "string",
  "stacking_behavior": "string",
  "stacks_well": boolean,
  "stack_cap": number|null,
  "formula": "string",
  "scaling_per_stack": [number, number, ...],  // Array of 10 numbers
  "detailed_description": "string",
  "synergies": ["string", "string", ...],
  "anti_synergies": ["string", "string", ...],
  "notes": "string",
  "graph_type": "string",
  "one_and_done": boolean
}
```

---

## stats.json Structure

```json
{
  "version": "1.0.17",
  "last_updated": "2026-01-07",
  "stats": {
    "stat_name": {
      "stat_name": "string",
      "category": "offensive|defensive|utility",
      "scaling_type": "string",
      "formula": "string",
      "description": "string",
      "priority": number,
      "example": "string (optional)",
      "can_reach_100": boolean (optional),
      "hard_cap": number (optional)
    }
  },
  "build_priorities": {
    "build_type": {
      "priority_order": ["string", "string", ...],
      "description": "string"
    }
  }
}
```

---

## Field Definitions

### Items Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique identifier (lowercase, underscores) |
| `name` | string | ✅ | Display name of the item |
| `rarity` | enum | ✅ | Item rarity tier |
| `tier` | enum | ✅ | Power tier ranking |
| `unlocked_by_default` | boolean | ✅ | Whether item is available from start |
| `unlock_requirement` | string/null | ✅ | How to unlock (null if default) |
| `unlock_cost_silver` | number | ✅ | Silver cost to unlock (0 if default) |
| `base_effect` | string | ✅ | Short description of effect |
| `scaling_type` | string | ✅ | How the item scales mechanically |
| `stacking_behavior` | string | ✅ | How multiple copies interact |
| `stacks_well` | boolean | ✅ | Whether multiple copies are beneficial |
| `stack_cap` | number/null | ✅ | Maximum stacks (null if unlimited) |
| `formula` | string | ✅ | Mathematical formula for effect |
| `scaling_per_stack` | array | ✅ | Benefit values for stacks 1-10 |
| `detailed_description` | string | ✅ | Long explanation with examples |
| `synergies` | array | ✅ | Items/stats that work well with this |
| `anti_synergies` | array | ✅ | Items/stats that conflict |
| `notes` | string | ✅ | Important warnings or tips |
| `graph_type` | enum | ✅ | Type of scaling curve to display |
| `one_and_done` | boolean | ✅ | True if only one copy is useful |

### Stats Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `stat_name` | string | ✅ | Display name of stat |
| `category` | enum | ✅ | Stat category |
| `scaling_type` | string | ✅ | How stat scales |
| `formula` | string | ✅ | Mathematical formula |
| `description` | string | ✅ | What the stat does |
| `priority` | number | ✅ | Importance ranking (lower = more important) |
| `example` | string | ❌ | Example calculation |
| `can_reach_100` | boolean | ❌ | Whether stat can reach 100% |
| `hard_cap` | number | ❌ | Maximum value if capped |

---

## Enum Values

### Rarity
- `common` - Green
- `uncommon` - Blue
- `rare` - Magenta
- `epic` - Purple
- `legendary` - Gold

### Tier
- `SS` - Game-breaking, best items
- `S` - Excellent, always good
- `A` - Strong, reliable
- `B` - Situational, decent
- `C` - Weak, avoid

### Graph Type
- `flat` - No benefit from stacking
- `linear_scaling` - Straight line growth
- `chance_scaling` - Chance-based, no cap
- `capped_chance` - Chance-based, caps at 100%
- `hard_capped` - Caps at specific value
- `hyperbolic_scaling` - Diminishing returns
- `exponential_scaling` - Exponential growth
- `tradeoff_scaling` - Has negative effects
- `conditional_scaling` - Only works sometimes
- `percentage_scaling` - Scales with another stat
- `conversion_scaling` - Converts one stat to another
- `ramping_capped` - Ramps up over time with cap
- `capped_stacking` - Stacks up to a limit

### Scaling Type (Items)
- `one_and_done` - No benefit from stacking
- `additive_damage` - Adds damage %
- `additive_crit` - Adds crit chance
- `additive_hp` - Adds max HP
- `multiplicative_with_hp` - Scales with HP
- `chance_based` - Proc chance
- `percentage_hp_damage` - Deals % of enemy HP
- `additive_multi_stat` - Adds multiple stats
- `stacking_with_cap` - Stacks with limit
- `proc_multiplier` - Multiplies proc effects
- `conversion_capped` - Converts stat with cap
- `tradeoff` - Has downsides
- `conditional_damage` - Only works in conditions
- `ramping_capped` - Ramps with cap

### Stacking Behavior
- `no_benefit` - Additional copies do nothing
- `additive` - Each copy adds linearly
- `additive_chance` - Each copy adds to proc chance
- `additive_with_kill_counter` - Adds per kill
- `additive_procs` - Adds proc instances
- `extra_lives` - Each copy = extra life
- `additive_both` - Adds positive and negative
- `additive_capped` - Adds until cap
- `hyperbolic` - Diminishing returns
- `additive_summon` - Adds summons
- `additive_megacrit_chance` - Adds megacrit chance

### Category (Stats)
- `offensive` - Damage-related
- `defensive` - Survivability-related
- `utility` - Quality of life / progression

---

## Examples

### Example 1: Simple Damage Item

```json
{
  "id": "gym_sauce",
  "name": "Gym Sauce",
  "rarity": "common",
  "tier": "S",
  "unlocked_by_default": true,
  "unlock_requirement": null,
  "unlock_cost_silver": 0,
  "base_effect": "+10% damage",
  "scaling_type": "additive_damage",
  "stacking_behavior": "additive",
  "stacks_well": true,
  "stack_cap": null,
  "formula": "Damage Multiplier = 1 + (0.10 × Stack Count)",
  "scaling_per_stack": [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  "detailed_description": "Straightforward damage increase. Each copy adds +10%.",
  "synergies": ["All damage builds", "Universal"],
  "anti_synergies": [],
  "notes": "STACKS WELL: Simple and effective.",
  "graph_type": "linear_scaling",
  "one_and_done": false
}
```

### Example 2: One-and-Done Item

```json
{
  "id": "anvil",
  "name": "Anvil",
  "rarity": "legendary",
  "tier": "SS",
  "unlocked_by_default": false,
  "unlock_requirement": "Complete 3 challenges",
  "unlock_cost_silver": 18,
  "base_effect": "Weapon upgrades gain +1 to all stats",
  "scaling_type": "one_and_done",
  "stacking_behavior": "no_benefit",
  "stacks_well": false,
  "stack_cap": 1,
  "formula": "Each weapon upgrade adds +1 extra to all stats",
  "scaling_per_stack": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  "detailed_description": "Does NOT benefit from additional copies - one is enough!",
  "synergies": ["All weapons"],
  "anti_synergies": [],
  "notes": "ONE-AND-DONE: Do not pick up multiple copies.",
  "graph_type": "flat",
  "one_and_done": true
}
```

### Example 3: Capped Chance Item

```json
{
  "id": "spicy_meatball",
  "name": "Spicy Meatball",
  "rarity": "legendary",
  "tier": "SS",
  "unlocked_by_default": true,
  "unlock_requirement": null,
  "unlock_cost_silver": 0,
  "base_effect": "+25% chance to explode on attack",
  "scaling_type": "chance_based",
  "stacking_behavior": "additive_chance",
  "stacks_well": true,
  "stack_cap": null,
  "formula": "Explosion Chance = 0.25 × Stack Count (capped at 100%)",
  "scaling_per_stack": [25, 50, 75, 100, 100, 100, 100, 100, 100, 100],
  "detailed_description": "With 4 copies, every attack explodes.",
  "synergies": ["AoE builds", "Attack Speed"],
  "anti_synergies": [],
  "notes": "SCALES ABSURDLY: Reaches 100% proc rate at 4 copies.",
  "graph_type": "capped_chance",
  "one_and_done": false
}
```

### Example 4: Stat Definition

```json
{
  "crit_chance": {
    "stat_name": "Critical Chance",
    "category": "offensive",
    "scaling_type": "additive_with_overcrit",
    "formula": "Over 100% enables Overcrits!",
    "overcrit_formula": "(n × 0.5)² + (n + 1) where n = crits",
    "description": "Exceeding 100% enables Overcrits with exponential scaling",
    "priority": 2,
    "example": "2 crits = 4.0× damage, 3 crits = 6.25× damage"
  }
}
```

---

## Validation Rules

### Items
- `id` must be unique
- `scaling_per_stack` must have exactly 10 numbers
- If `one_and_done` is true, `stacks_well` should be false
- If `stack_cap` is a number, `scaling_per_stack` should reflect the cap
- `synergies` and `anti_synergies` should not be empty arrays (use [] or add items)

### Stats
- `stat_name` keys must be lowercase with underscores
- `priority` should be unique within category
- `formula` should clearly explain calculation

---

## Tips for Maintaining Data Quality

1. **Be Consistent**: Use the same terminology throughout
2. **Be Specific**: Include exact numbers in descriptions
3. **Show Examples**: Add calculation examples in descriptions
4. **Update Together**: If changing an item, update related items too
5. **Test Graphs**: Ensure `scaling_per_stack` creates meaningful graphs
6. **Cross-Reference**: Check that synergies reference real items

---

## JSON Syntax Reminders

```json
// ✅ CORRECT
{
  "key": "value",
  "number": 123,
  "boolean": true,
  "null_value": null,
  "array": [1, 2, 3],
  "last_item": "no comma after this"
}

// ❌ WRONG
{
  "key": "value",
  "unquoted": value,  // Must quote strings
  "single": 'quotes',  // Must use double quotes
  "array": [1, 2, 3,],  // No trailing comma
  "last": "value",  // No comma before }
}
```

---

## Need Help?

- JSON validator: https://jsonlint.com/
- JSON formatter: https://jsonformatter.org/
- Ask in community Discord or GitHub issues

Happy data maintaining! 📊✨
