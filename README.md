# HEARTBORN

A multiplayer pixel-art civilization game. Start with three humans, make decisions, pass laws, build a kingdom and go to war with other players.

## Run it

Double-click **`run.bat`**. The first run installs everything, and then your browser opens at http://localhost:5173.

(Manual: `npm install`, then `npm run dev`.)

## One-time Firebase setup

In the [Firebase console](https://console.firebase.google.com) → project **hearthborn-47548**:

1. **Authentication → Sign-in method**: enable **Google** and **Email/Password**.
2. **Firestore Database → Rules**: paste the contents of `firestore.rules` → **Publish**.
3. **Realtime Database → Rules**: paste the contents of `database.rules.json` → **Publish**.

When you deploy to a real domain, add it under **Authentication → Settings → Authorized domains**.

## Admin

Add your account as admin in the Firebase console (Firestore: `admins/<your UID>` document; Realtime Database: `admins/<your UID>` = `true`), sign in, and press **F2** to open the command line. Type `help` to list the commands.

## Art

Sprite sheets (6×6 grids) go in the project root and are sliced into `public/assets/` with `python tools/slice_sheets.py`. Prompts are in `ASSET_PROMPTS.md`.

## Project layout

```
src/core     engine: assets, input, noise, rng, constants
src/data     buildings, laws, events, fate outcomes, creatures, traits
src/game     simulation: world, villagers, creatures, fate, war, deeds
src/render   canvas renderer (lighting, weather, code-driven animation)
src/net      Firebase: auth, saves, multiplayer, admin API
src/ui       HUD, screens, admin console, styles
```
