# VenU

Find your next event. Volunteer. Connect. An Expo / React Native app for iOS, Android and web.

## Setup

Needs Node 22 (see `.nvmrc`). No global installs: every tool runs from `node_modules`.

```bash
npm ci          # install exactly what package-lock.json says
npm start       # dev server; press i / a / w for iOS, Android, web
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Start the Expo dev server |
| `npm run lint` | ESLint, fails on any warning |
| `npm run typecheck` | Generate typed routes, then `tsc --noEmit` |
| `npm run check` | Lint, typecheck and `expo-doctor`; run before opening a PR (CI runs the same) |

## Adding packages

```bash
npx expo install <package>   # picks the version that matches our Expo SDK
```

Use `npm install` only for packages unrelated to Expo / React Native (e.g. a dev tool).

## Layout

```
src/app/          routes (Expo Router): every file is a screen
  (tabs)/         venue, volunteer, profile + floating nav bar
  sign-in.tsx
src/components/   shared UI (nav bar, icons)
src/constants/    design tokens from Figma
assets/           app icon, splash, favicon
.kiro/figma/      Figma export the screens were built from
```
