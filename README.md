# 🎮 MegaBonk Complete Guide

[![CI](https://github.com/jtn0123/MegaBonk/actions/workflows/test.yml/badge.svg)](https://github.com/jtn0123/MegaBonk/actions/workflows/test.yml)
[![codecov](https://codecov.io/gh/jtn0123/MegaBonk/branch/main/graph/badge.svg)](https://codecov.io/gh/jtn0123/MegaBonk)
[![Lighthouse](https://github.com/jtn0123/MegaBonk/actions/workflows/lighthouse.yml/badge.svg)](https://github.com/jtn0123/MegaBonk/actions/workflows/lighthouse.yml)

**The ultimate reference system for MegaBonk** - Items, Weapons, Tomes, Characters, Shrines, Build Planner, and Breakpoint Calculator all in one beautiful, interactive web app.

## ✨ Core Features

### 📦 **7 Complete Categories**
- **Items** (80/80) ✅ COMPLETE - Scaling graphs, stacking behavior, true formulas
- **Weapons** (29/29) ✅ COMPLETE - Tier rankings, upgrade paths, synergies
- **Tomes** (23/23) ✅ COMPLETE - Priority rankings, stat scaling, recommendations
- **Characters** (20/20) ✅ COMPLETE - Passives, strengths/weaknesses, builds
- **Shrines** (8/8) ✅ COMPLETE - Types, strategies, rewards
- **Build Planner** - Create builds with automatic synergy detection + stats calculator
- **Breakpoint Calculator** - "How many stacks?" solver with visual graphs

### 🎨 **Visual Excellence**
- Color-coded rarity system (Common → Legendary)
- Tier badges (SS/S/A/B/C) for power rankings
- Tab navigation with smooth transitions
- Context-sensitive filters per category
- Dark theme optimized for long sessions
- Fully responsive (desktop + mobile)

### 🛠️ **Build Planner with Stats Calculator**
- Select character + weapon + tomes + items
- **Real-time stat calculation** - See total damage, HP, crit chance, attack speed, etc.
- **OVERCRIT detection** - Special highlight when crit >100%
- **Automatic synergy detection** across all categories
- Export/import builds via clipboard
- Visual analysis showing optimal combinations

### 🧮 **Breakpoint Calculator**
- "How many Big Bonks for 100% proc?" - Instant answer
- Visual scaling graphs for 1-10 stacks
- Common breakpoints quick reference
- Stack cap warnings
- One-and-done item detection

### ⚖️ **Compare Mode**
- Side-by-side comparison of 2-3 items
- Compare formulas, scaling, synergies
- Easy selection from item cards
- Detailed breakdowns

### 📊 **Data Quality**
- Exact formulas and scaling values
- Cross-category synergy mapping
- Tier rankings from meta analysis
- Unlock requirements and costs
- Build tips and strategies

### 💾 **Easy to Maintain**
- JSON-based data structure
- Update items/weapons/characters by editing JSON
- No coding required for content updates
- Takes 5-10 minutes per game patch
- Git tracks all changes

## 🚀 Quick Start

### 📱 Launch on Desktop or Mobile

**Easiest way** (works on any device):
```bash
python3 serve.py
```

Then:
- **Desktop**: Open http://localhost:8000
- **Mobile**: Scan the QR code that appears OR open the mobile URL shown

**Alternative** (desktop only):
1. Open `src/index.html` in your web browser
2. Note: Mobile won't work with file:// protocol

### 📲 Install as Mobile App

1. Launch with `python3 serve.py`
2. Open on your phone
3. Tap "Add to Home Screen"
4. Now it works offline like a real app!

### 📱 Package as Standalone Android App

Want a **true standalone APK** that works without your computer?

- **⚡ Ready to Build?**: See `BUILD_APK_INSTRUCTIONS.md` - complete step-by-step guide
- **Quick Start**: See `ANDROID_QUICK_START.md` for 3 easy options (5-15 minutes)
- **Full Guide**: See `docs/ANDROID_STANDALONE.md` for detailed instructions

Build methods:
- **PWABuilder** (easiest, no installation)
- **Bubblewrap** (local development) ← Step-by-step instructions ready!
- **Capacitor** (advanced, native features)

### Update the Guide

When the game meta changes:

1. Open `data/items.json`
2. Find the item you want to update
3. Modify the values (see `docs/UPDATE_GUIDE.md` for details)
4. Refresh your browser - changes appear instantly!

**Takes 5-10 minutes per update.**

## 📁 Project Structure

```
MegaBonk/
├── data/
│   ├── items.json          # 80 items with scaling graphs
│   ├── weapons.json        # 29 weapons with synergies
│   ├── tomes.json          # 23 tomes with priorities
│   ├── characters.json     # 20 characters with passives
│   ├── shrines.json        # 8 shrines with strategies
│   └── stats.json          # Game mechanics formulas + breakpoints
├── src/
│   ├── index.html          # Main interface with tabs
│   ├── styles.css          # Complete styling system
│   ├── script.js           # Full app logic (1000+ lines)
│   ├── manifest.json       # PWA manifest for mobile install
│   ├── sw.js               # Service worker for offline support
│   ├── libs/
│   │   └── chart.min.js    # Chart.js (local, no internet needed)
│   └── icons/              # App icons for mobile
├── docs/
│   ├── UPDATE_GUIDE.md     # Maintenance instructions
│   ├── DATA_FORMAT.md      # JSON schema reference
│   └── SOURCES.md          # Data sources
├── serve.py                # One-click launch server
├── PLAN.md                 # Design documentation
└── README.md               # This file
```

## 📖 Documentation

- **[Update Guide](docs/UPDATE_GUIDE.md)** - Maintain all categories when game updates
- **[Data Format](docs/DATA_FORMAT.md)** - JSON schemas for all 6 categories
- **[Sources](docs/SOURCES.md)** - Data sources and verification methods
- **[Android Standalone](docs/ANDROID_STANDALONE.md)** - Package as true Android APK
- **[Android Quick Start](ANDROID_QUICK_START.md)** - 3 easy ways to build Android app
- **[Plan](PLAN.md)** - Original design and architecture

## 🎯 Use Cases

### For Players
- **"Should I stack Big Bonk?"** - Check scaling graphs
- **"What's the best weapon for CL4NK?"** - View character page
- **"Which tomes should I prioritize?"** - See tier rankings
- **"How do I build for crit?"** - Use Build Planner
- **"What shrines should I take?"** - Read strategies

### For Build Crafters
- **Plan complete loadouts** with Build Planner
- **Discover synergies** automatically
- **Compare weapon upgrade paths**
- **Optimize tome priorities**
- **Export and share builds**

### For Theorycrafters
- **Analyze scaling formulas** (crit overcrit, armor diminishing returns)
- **Calculate breakpoints** (when items hit 100% proc rate)
- **Compare tier rankings** across categories
- **Understand stat interactions**

### For Community
- **Share builds** via export codes
- **Update guide** when game patches
- **Track meta shifts** with git history
- **Contribute corrections** via pull requests

## 🎨 Visual Features

### Rarity Colors
- 🟢 **Common**: Green (#5cb85c)
- 🔵 **Uncommon**: Blue (#5bc0de)
- 🟣 **Rare**: Magenta (#d946ef)
- 🟪 **Epic**: Purple (#8b5cf6)
- 🟡 **Legendary**: Gold (#fbbf24)

### Tier Badges
- ⭐⭐ **SS Tier**: Game-breaking (Gold)
- ⭐ **S Tier**: Excellent (Silver)
- 🥉 **A Tier**: Strong (Bronze)
- ◼️ **B Tier**: Situational (Gray)
- 🔴 **C Tier**: Weak (Red)

### Stacking Indicators
- **∞** - Stacks well (get more!)
- **✓** - One-and-done (don't stack)
- **~** - Limited stacking (situational)

## 💡 Example Content

### 📦 Items
- **Big Bonk** - 2% chance for 20x damage (stacks infinitely)
- **Anvil** - +1 to all weapon upgrades (one-and-done)
- **Beefy Ring** - +20% damage per 100 HP (scales with HP)
- **Cursed Doll** - 30% enemy max HP as DoT (boss melter)
- All with **scaling graphs** showing 1-10+ stack value

### ⚔️ Weapons
- **Sniper Rifle** (SS) - 22 base damage, piercing, crit scaling
- **Revolver** (S) - 6 projectiles, attack speed monster
- **Black Hole** (S) - Crowd control king, size scaling
- **Katana** (S) - Crit slasher, many upgrade paths
- Each with **upgrade paths, synergies, build tips**

### 📚 Tomes
- **Damage Tome** (SS, Priority 1) - Foundation of all builds
- **Precision** (SS, Priority 2) - Crit chance → Overcrit scaling
- **XP Tome** (S, Priority 1) - Fast leveling (capped at 10x)
- **Chaos Tome** (S) - Random stats, pure RNG fun
- All with **priority rankings and recommendations**

### 👤 Characters
- **CL4NK** (SS) - +1% crit/level → Guaranteed Overcrit
- **Sir Oofie** (S) - +1% armor/level → Unkillable tank
- **Vlad** (S) - +1% lifesteal/level → Sustain god
- **Ninja** (A) - Execute on evasion → High skill, high reward
- All with **passives, synergies, build strategies**

## 🔄 Updating for New Patches

### When a Patch Drops

1. **Check patch notes** for item changes
2. **Open** `data/items.json`
3. **Update** changed values
4. **Increment** version number
5. **Test** in browser
6. **Commit** with descriptive message

**Example Update:**
```json
{
  "id": "gym_sauce",
  "base_effect": "+12% damage",  // Changed from +10%
  "scaling_per_stack": [12, 24, 36, 48, 60, 72, 84, 96, 108, 120]
}
```

Detailed instructions in `docs/UPDATE_GUIDE.md`.

## 🧪 Testing & Coverage

### Run Tests
```bash
# Unit tests
npm run test:unit

# Unit tests with coverage
npm run test:unit:coverage

# E2E tests (Playwright)
npm run test:e2e

# E2E tests with coverage
npm run test:e2e:coverage

# Combined coverage (unit + E2E merged)
npm run test:coverage:all
```

### Coverage Reports
- **Unit coverage**: `coverage/unit/index.html`
- **E2E coverage**: `coverage/e2e/report.html`
- **Merged coverage**: `coverage/merged/index.html`

The merge script combines Istanbul coverage from unit tests with browser coverage from E2E tests, giving a holistic view of what code is actually tested.

## 🛠️ Technical Details

### Technologies
- **HTML5** - Semantic, accessible markup
- **CSS3** - Modern styling with Grid/Flexbox
- **Vanilla JavaScript** - No framework dependencies
- **Chart.js** - Beautiful interactive graphs
- **JSON** - Human-readable data storage

### Browser Support
- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers

### No Installation Required
- No Node.js
- No build process
- No package managers
- Just open and use!

## 📝 Contributing

Found incorrect data or want to add missing items?

1. **Verify** the information in-game or from official sources
2. **Update** the relevant JSON file
3. **Test** your changes locally
4. **Commit** with a clear message
5. **Push** to the repository

See `docs/UPDATE_GUIDE.md` for detailed instructions.

## 🎮 About MegaBonk

MegaBonk is a roguelike action game available on Steam. This guide is a community-created resource to help players understand item mechanics and scaling.

- **Steam**: https://store.steampowered.com/app/3405340/Megabonk/
- **Current Version**: 1.0.17
- **Guide Updated**: January 7, 2026

## 📜 Data Sources

All data compiled from:
- Official game (v1.0.17)
- MegaBonk.org community wiki
- Steam Community guides
- Gaming news sites (GameRant, Dexerto, PCGamesN)
- Community testing and discussions

Full source list in `docs/SOURCES.md`.

## ⚠️ Disclaimer

This is a community-created resource based on publicly available information. While we strive for accuracy:

- Always verify critical information in-game
- Some mechanics may change with patches
- Tier rankings reflect community consensus
- Formulas are based on community testing

## 📄 License

This project is open source and available for community use. Data is compiled from publicly available sources.

## 🙏 Acknowledgments

- MegaBonk developers for creating an amazing game
- MegaBonk.org for comprehensive wiki data
- Steam Community for detailed guides and testing
- All players who contribute to understanding the mechanics

## ✅ Recently Added (v1.0.18)

- ✅ **Complete item database** - All 80/80 items
- ✅ **Complete weapons** - All 29/29 weapons
- ✅ **Complete tomes** - All 23/23 tomes
- ✅ **Build planner stats calculator** - Real-time stat calculations
- ✅ **Compare mode** - Side-by-side item comparison
- ✅ **Breakpoint calculator** - Stack calculation solver
- ✅ **PWA support** - Install as mobile app
- ✅ **Offline mode** - Works without internet
- ✅ **Mobile launcher** - One-click serve.py script

## 🔮 Possible Future Additions

- [ ] Export build as image (PNG/JPEG)
- [ ] Dark/light theme toggle
- [ ] Save/load multiple builds to localStorage
- [ ] Community build sharing
- [ ] Advanced filters (combine multiple criteria)

---

Made with ❤️ for the MegaBonk community

**Play MegaBonk**: [Steam Store Page](https://store.steampowered.com/app/3405340/Megabonk/)

---

## Quick Navigation

- 📖 [Update Guide](docs/UPDATE_GUIDE.md) - How to maintain this guide
- 📊 [Data Format](docs/DATA_FORMAT.md) - JSON structure reference
- 🔗 [Sources](docs/SOURCES.md) - Where data comes from
- 🎯 [Open the Guide](src/index.html) - View the guide

**Questions?** Check the docs or open an issue!
