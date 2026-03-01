# Contributing to MegaBonk

Thank you for your interest in contributing to MegaBonk!

## Prerequisites

- **Node.js 22** or later
- **npm** (comes with Node.js)

## Setup

```bash
git clone https://github.com/jtn0123/MegaBonk.git
cd MegaBonk
npm install
npm run dev    # Start development server
npm test       # Run tests
```

## Pull Request Conventions

- Use **conventional commits** (e.g., `feat:`, `fix:`, `docs:`, `refactor:`)
- PRs are **squash merged** into `main`
- Keep PRs focused on a single concern

## Test Requirements

All PRs must pass the following checks before merge:

```bash
npx tsc --noEmit      # TypeScript type checking
npx eslint .          # Linting
npm test              # Unit tests
```

## Code Style

- **TypeScript strict mode** is enabled — follow it
- **No `as any`** — use proper types
- **ESLint** is enforced — fix all warnings and errors
- Keep functions small and well-documented
