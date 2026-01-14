# CSS Organization

## Overview

The MegaBonk stylesheet has been split into modular CSS files for better maintainability, performance, and organization.

## File Structure

```
src/styles/
├── base.css         # Variables, resets, global styles (4.3 KB)
├── components.css   # UI components (67.7 KB)
├── responsive.css   # Media queries (2.9 KB)
└── utilities.css    # Utility classes (0.9 KB)
```

### base.css (180 lines)

Foundation styles that establish the visual design system:

- **CSS Variables**: Color palette, tier colors, rarity colors, spacing
- **Global Resets**: Box-sizing, margins, padding normalization
- **Body Styles**: Font family, background, base colors
- **Scrollbar Styling**: Custom webkit scrollbar appearance
- **Focus States**: Accessibility-focused keyboard navigation styles
- **Selection Colors**: Text selection styling

**Key Variables:**
```css
--rarity-common: #6b9b6b;
--rarity-legendary: #f0a800;
--tier-ss: #ffd700;
--bg-primary: #0f0f14;
--accent: #e94560;
```

### components.css (3,740 lines)

All UI component styles organized by feature:

**Major Components:**
- **Header**: Logo, title, navigation
- **Tab Navigation**: Tab buttons, active states
- **Search & Filters**: Search box, filter dropdowns, favorites checkbox
- **Stats Panel**: Statistics summary display
- **Items Grid**: Card-based item layout
- **Modal**: Item details, character info modals
- **Build Planner**: Character/weapon selection, tome/item slots
- **Shrines Grid**: Shrine cards
- **Compare Mode**: Side-by-side item comparison
- **Breakpoint Calculator**: Stats calculator interface
- **Charts**: Chart.js styling
- **Toast Notifications**: Success/error messages
- **Changelog**: Patch notes display

**Component Naming Convention:**
- `.tab-btn` - Tab navigation buttons
- `.item-card` - Individual item cards
- `.modal-overlay` - Modal backdrop
- `.build-slot` - Build planner slots
- `.breakpoint-card` - Calculator breakpoint cards

### responsive.css (127 lines)

Mobile-first responsive design with breakpoints:

**Breakpoints:**
- `max-width: 768px` - Tablet and mobile
- `max-width: 480px` - Small mobile devices
- `max-width: 360px` - Extra small devices

**Responsive Adjustments:**
- Grid columns: 3 → 2 → 1
- Font sizes reduced
- Padding/spacing condensed
- Mobile navigation stacking
- Touch-friendly tap targets (44px minimum)

### utilities.css (38 lines)

Helper classes for common patterns:

```css
.hidden              # Display: none
.visually-hidden     # Screen reader only
.text-center         # Centered text
.mt-1, .mb-2, etc.  # Spacing utilities
.flex, .flex-center  # Flexbox helpers
```

## Loading Order

The CSS files must be loaded in this specific order:

```html
<link rel="stylesheet" href="styles/base.css" />         <!-- Variables first -->
<link rel="stylesheet" href="styles/components.css" />    <!-- Then components -->
<link rel="stylesheet" href="styles/responsive.css" />    <!-- Then responsive -->
<link rel="stylesheet" href="styles/utilities.css" />     <!-- Utilities last (highest priority) -->
```

**Why this order?**
1. **Base first**: Establishes variables that other files depend on
2. **Components second**: Uses base variables
3. **Responsive third**: Overrides component styles at breakpoints
4. **Utilities last**: Should have highest specificity for overrides

## Maintaining the CSS

### Adding New Styles

**For new components:**
Add to `components.css` in the appropriate section:

```css
/* ========================================
   Your New Component
   ======================================== */

.your-component {
    /* styles here */
}
```

**For new responsive styles:**
Add to `responsive.css` in the existing media query blocks:

```css
@media (max-width: 768px) {
    .your-component {
        /* mobile adjustments */
    }
}
```

**For new utilities:**
Add to `utilities.css` following the existing pattern:

```css
.utility-name {
    property: value;
}
```

### Modifying Variables

All design tokens are in `base.css`. Changing a variable affects all usages:

```css
:root {
    --accent: #e94560;  /* Change this to update accent color everywhere */
}
```

### Finding Styles

**By component:** Check `components.css` section headers
**By breakpoint:** Check `responsive.css` media queries
**By property:** Use your editor's search across all files

## Performance Benefits

### Before Split (monolithic styles.css)
- Single 75.8 KB file
- Harder to cache efficiently
- Difficult to lazy-load
- Challenging to maintain

### After Split
- **base.css**: 4.3 KB (cached long-term, rarely changes)
- **components.css**: 67.7 KB (most changes here)
- **responsive.css**: 2.9 KB (rarely changes)
- **utilities.css**: 0.9 KB (cached long-term)

**Benefits:**
- Browser can cache stable files (base, utilities) aggressively
- Only invalidate components.css cache when components change
- Easier to lazy-load non-critical CSS
- Better compression per file

## Regenerating from Original

If you need to regenerate the split from the original `styles.css`:

```bash
node scripts/split-css.js
```

The original `styles.css` is backed up as `styles.css.bak`.

## Migration Guide

If you have local changes to `styles.css`:

1. **Back up your changes**
2. **Run the split script**: `node scripts/split-css.js`
3. **Update HTML**: Replace `<link href="styles.css">` with the four new links
4. **Test thoroughly**: Verify all pages render correctly
5. **Merge custom changes**: Add your custom CSS to the appropriate split file

## Troubleshooting

**Styles not applying:**
- Check CSS file load order in HTML
- Verify file paths are correct (`styles/base.css` not `base.css`)
- Clear browser cache (Ctrl+Shift+R)

**Missing variables:**
- Ensure `base.css` loads before other files
- Check that variables are defined with `--` prefix

**Responsive styles wrong:**
- Ensure `responsive.css` loads after `components.css`
- Check media query specificity

**High specificity conflicts:**
- Utilities should load last
- Avoid `!important` where possible
- Use more specific selectors if needed

## Future Enhancements

Potential improvements:

- [ ] Extract critical CSS for above-the-fold content
- [ ] Add CSS Custom Properties for dark/light theme toggle
- [ ] Implement CSS-in-JS for dynamic theming
- [ ] Add CSS nesting with PostCSS
- [ ] Minify CSS in production build
- [ ] Add source maps for debugging
