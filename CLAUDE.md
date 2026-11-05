# Overview

A read-only monitor of every coding-agent session (Orca, Claude Code, Codex, SSH hosts), drawn as an isometric world of islands, plots and creatures, with a ranked attention list and a task tracker. Read `PRODUCT.md` first, then `docs/PLAN.md`.

## Local first: no artifacts

- The files in this folder and in `../signal` are the only source of truth.
- Do **not** publish this work as claude.ai artifacts, Claude Docs or any other account-bound page. The owner switches between several Claude accounts, and one of them ("dev") is shared with other people. Ask first before anything leaves this machine.
- To show work, run `./serve.sh` (the local hub at http://localhost:4173/overview/), or capture screenshots with headless Chrome into `.impeccable/review/`.

## Map of the folder

| Path | What |
|---|---|
| `index.html` | Local hub linking every prototype and doc |
| `prototype/v5/` | Current prototype (map v5). Same modules as v4 plus `pix.js`, which rasterises landmark sprites pixel by pixel (2:1 edges, 3-tone faces, outline) so they share the creatures' pixel grid. Never draw world objects as smooth vector shapes |
| `prototype/v4/` | Map v4 (history): ES modules in `js/`: `core` (state, palette from Signal, sample data), `creatures` (genome, sprites, emotes), `world` (neighborhood generation, A*), `life` (simulation, conversations), `render` (canvas), `ui` (rail, input, boot). Needs `./serve.sh` because modules don't load from file:// |
| `prototype/overview-map.html` | Map v3, single file. `map.html` (v2) and `world.html` (v1) are history |
| `prototype/vendor/signal/` | Copy of the Signal CSS the prototype loads. Never edit it here |
| `docs/PLAN.md` | Product plan and roadmap |
| `docs/view.html` | Markdown reader used by the hub (`?f=<path>`) |
| `PRODUCT.md`, `DESIGN.md` | Product facts; how Overview applies Signal |
| `.impeccable/` | Design brief, review captures, detector config |
| `scripts/sync-signal.sh` | Rebuilds Signal and copies its CSS into `prototype/vendor/signal/` |

## Design system

Overview's look comes from **Signal** (`../signal`, package `@barrymind/signal`), which is shared with Hangar and future apps:
- Change a colour, size or component in Signal (`tokens/*.json`), never in Overview, then run `./scripts/sync-signal.sh`.
- Map-only values go in Signal's Overview extension, `../signal/tokens/extensions/overview.tokens.json`.
- The design rules: colour only for status and for "you", monochrome graphite everywhere else, mono for machine text and sans for prose, hairlines and small radii.

## Sync between machines

Both folders are private GitHub repos on the owner's personal account. Never use the barrymind org.
- `Genoux/overview` is this folder; `Genoux/signal` is `../signal`.
- Keep them side by side under `~/Desktop/@john/` on every machine: the hub and the sync script expect `../signal`.
- New machine: `cd ~/Desktop/@john && gh repo clone Genoux/overview && gh repo clone Genoux/signal`.
- Start of a session: `git pull` in both. At the end, commit and push only when the owner asks.
