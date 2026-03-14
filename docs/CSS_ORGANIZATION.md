# CSS Organization

## Overview

The app now uses a modular stylesheet index at `src/styles/index.css` that imports focused feature and layout files instead of a single `components.css` bundle.

## Current Structure

```text
src/styles/
├── base.css               # Variables, reset, typography
├── layout.css             # Header, footer, shared containers
├── navigation.css         # Desktop tabs, controls bar
├── mobile-nav.css         # Mobile bottom nav + More drawer
├── forms.css              # Inputs, buttons, selects
├── cards.css              # Item and entity cards
├── modal.css              # Shared modal shell
├── features.css           # Build planner + calculator UI
├── advisor.css            # Advisor flow
├── scan.css               # Scan-build and preflight styling
├── batch.css              # Build Planner screenshot import + batch results
├── scan-build-enhanced.css# Strategy selector UI
├── changelog.css          # Changelog tab
├── about.css              # About tab
├── search.css             # Search results
├── states.css             # Loading, toast, offline, skeletons
├── animations.css         # Shared transitions/keyframes
├── themes.css             # Theme overrides
└── responsive.css         # Large-screen overrides
```

## Loading Order

`src/styles/index.css` is the single entrypoint and controls load order:

1. Base and layout primitives
2. Shared components
3. Feature-specific modules
4. UX/state helpers
5. Theme and responsive overrides

That order matters because later modules intentionally override earlier shared styles.

## Where To Edit

- Build Planner + screenshot import polish: `features.css` and `batch.css`
- Scan-build preflight and scan utilities: `scan.css`
- Navigation changes: `navigation.css` and `mobile-nav.css`
- Shared buttons/forms: `forms.css`
- Global colors/tokens: `base.css`

## Guidelines

- Add new feature styles to the smallest existing feature file that owns the UI.
- Prefer shared variables from `base.css` over hardcoded colors.
- Keep responsive tweaks close to the owning module when they are feature-specific; use `responsive.css` for broad layout overrides.
- If a feature only appears after JS initialization, still keep its styles in the static CSS bundle unless the repo already lazy-loads that surface.
