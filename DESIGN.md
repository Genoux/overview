---
name: Overview
description: An inhabited isometric survey of every agent session, built on the Signal design system; the world is muted, and only status and you are loud.
# Token source: @barrymind/signal 0.1.2 (core signal.css + extension overview.css, vendored in prototype/vendor/signal).
# Overview does not own these values. Keys are the Signal custom-property names without the leading "--";
# values mirror Signal 0.1.2 for tooling only. Change them in Signal's tokens JSON and rebuild, never here.
# Recorded from the shipped build at prototype/v4/ (2026-11-05).
colors:
  sg-accent-fg: "#888ff7"
  sg-accent-bg: "rgb(136 143 247 / 0.12)"
  sg-accent-bg-hover: "rgb(136 143 247 / 0.2)"
  sg-accent-border: "rgb(136 143 247 / 0.6)"
  sg-selection-bg: "rgb(136 143 247 / 0.3)"
  sg-status-wait-fg: "#fec04a"
  sg-status-wait-bg: "rgb(254 192 74 / 0.06)"
  sg-status-wait-border: "rgb(254 192 74 / 0.4)"
  sg-status-err-fg: "#f26b59"
  sg-status-err-bg: "rgb(242 107 89 / 0.06)"
  sg-status-err-border: "rgb(242 107 89 / 0.4)"
  sg-status-done-fg: "#86c2a2"
  sg-status-run-fg: "#cad0d7"
  sg-surface-base: "#202123"
  sg-surface-raised: "#262729"
  sg-surface-sunken: "#1a1b1c"
  sg-surface-selected: "#2e2e30"
  sg-state-hover: "rgb(233 233 235 / 0.04)"
  sg-state-hover-control: "rgb(233 233 235 / 0.06)"
  sg-border-subtle: "#303133"
  sg-border-default: "#424345"
  sg-border-strong: "#77787a"
  sg-border-control: "#77787a"
  sg-text-primary: "#e9e9eb"
  sg-text-secondary: "#abacae"
  sg-text-subtle: "#9b9c9e"
  sg-text-disabled: "#727375"
  sg-text-on-accent: "#1a1b1c"
  sg-overview-ground: "#1b1c1e"
  sg-overview-plate: "#232426"
  sg-overview-plate-face-left: "#18191b"
  sg-overview-plate-face-right: "#131415"
  sg-overview-minimap-plate: "#323336"
  sg-overview-wait-wash-hover: "#2f2c25"
  sg-overview-hud-minimap: "rgb(26 27 28 / 0.9)"
  sg-overview-terrain-island-face-left: "#161719"
  sg-overview-terrain-island-face-right: "#121314"
  sg-overview-terrain-island-edge: "#38393c"
  sg-overview-terrain-bridge-top: "#202123"
  sg-overview-hood-slate-ground: "#1d2026"
  sg-overview-hood-slate-wall: "#3b4250"
  sg-overview-hood-slate-wall-shade: "#2c313b"
  sg-overview-hood-slate-roof: "#4a5262"
  sg-overview-hood-sage-ground: "#1e221e"
  sg-overview-hood-sage-wall: "#3e4a40"
  sg-overview-hood-sage-wall-shade: "#2e3730"
  sg-overview-hood-sage-roof: "#4c5a4e"
  sg-overview-hood-clay-ground: "#241f1d"
  sg-overview-hood-clay-wall: "#4d3f38"
  sg-overview-hood-clay-wall-shade: "#3a2f2a"
  sg-overview-hood-clay-roof: "#5c4b43"
  sg-overview-hood-plum-ground: "#221f25"
  sg-overview-hood-plum-wall: "#463d4e"
  sg-overview-hood-plum-wall-shade: "#342d3a"
  sg-overview-hood-plum-roof: "#554a5e"
  sg-overview-hood-sand-ground: "#23221d"
  sg-overview-hood-sand-wall: "#4a4637"
  sg-overview-hood-sand-wall-shade: "#38352a"
  sg-overview-hood-sand-roof: "#59543f"
  sg-overview-hood-shared-window-day: "#20242a"
  sg-overview-hood-shared-window-lit: "#8e8774"
  sg-overview-hood-shared-park: "#1f2520"
  sg-overview-hood-shared-tree-dark: "#2f3d33"
  sg-overview-hood-shared-tree-light: "#455a49"
  sg-overview-hood-shared-trunk: "#3a2f28"
  sg-overview-hood-shared-furniture: "#34363a"
  sg-overview-hood-shared-furniture-top: "#44464b"
  sg-overview-hood-shared-night: "#0d1018"
  sg-overview-lattice-grid-minor: "rgb(233 233 235 / 0.035)"
  sg-overview-lattice-grid-major: "rgb(233 233 235 / 0.085)"
  sg-overview-lattice-survey-cross: "rgb(233 233 235 / 0.28)"
  sg-overview-lattice-graticule-tick: "rgb(233 233 235 / 0.25)"
  sg-overview-lattice-plate-tick: "rgb(233 233 235 / 0.12)"
  sg-overview-creature-ink: "#0e0f10"
  sg-overview-creature-shadow: "rgb(0 0 0 / 0.38)"
  sg-overview-creature-pale-shade: "#66686d"
  sg-overview-creature-pale-base: "#9a9ca1"
  sg-overview-creature-pale-light: "#bfc1c5"
  sg-overview-creature-pale-highlight: "#e1e2e5"
  sg-overview-creature-lit-shade: "#56585d"
  sg-overview-creature-lit-base: "#85878c"
  sg-overview-creature-lit-light: "#a9abaf"
  sg-overview-creature-lit-highlight: "#d3d4d7"
  sg-overview-creature-dusk-shade: "#3f4145"
  sg-overview-creature-dusk-base: "#66686d"
  sg-overview-creature-dusk-light: "#86888c"
  sg-overview-creature-dusk-highlight: "#a9abaf"
  sg-overview-creature-dim-shade: "#38393d"
  sg-overview-creature-dim-base: "#515357"
  sg-overview-creature-dim-light: "#626468"
  sg-overview-creature-dim-highlight: "#75777b"
  sg-overview-slab-asleep-rim: "#3b3c3f"
  sg-overview-slab-run-cursor: "#5a5c60"
  sg-overview-slab-err-crack: "#5c211a"
typography:
  sg-type-headline:
    fontFamily: "Instrument Sans, system-ui, -apple-system, Segoe UI, Cantarell, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.45
  sg-type-title:
    fontFamily: "Instrument Sans, system-ui, -apple-system, Segoe UI, Cantarell, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.45
  sg-type-body:
    fontFamily: "Instrument Sans, system-ui, -apple-system, Segoe UI, Cantarell, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  sg-type-body-strong:
    fontFamily: "Instrument Sans, system-ui, -apple-system, Segoe UI, Cantarell, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.45
  sg-type-body-small:
    fontFamily: "Instrument Sans, system-ui, -apple-system, Segoe UI, Cantarell, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.45
  sg-type-code:
    fontFamily: "JetBrains Mono, ui-monospace, SF Mono, Menlo, DejaVu Sans Mono, monospace"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.45
  sg-type-control:
    fontFamily: "JetBrains Mono, ui-monospace, SF Mono, Menlo, DejaVu Sans Mono, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.45
  sg-type-status:
    fontFamily: "JetBrains Mono, ui-monospace, SF Mono, Menlo, DejaVu Sans Mono, monospace"
    fontSize: "11.5px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum"
  sg-type-meta:
    fontFamily: "JetBrains Mono, ui-monospace, SF Mono, Menlo, DejaVu Sans Mono, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum"
  sg-type-section:
    fontFamily: "JetBrains Mono, ui-monospace, SF Mono, Menlo, DejaVu Sans Mono, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0.06em"
rounded:
  sg-radius-sm: "3px"
  sg-radius-md: "5px"
  sg-radius-lg: "6px"
spacing:
  sg-space-2: "2px"
  sg-space-4: "4px"
  sg-space-6: "6px"
  sg-space-8: "8px"
  sg-space-10: "10px"
  sg-space-12: "12px"
  sg-space-16: "16px"
components:
  title-bar:
    backgroundColor: "{colors.sg-surface-base}"
    textColor: "{colors.sg-text-secondary}"
    typography: "{typography.sg-type-control}"
    height: "40px"
    padding: "0 12px"
  title-button:
    textColor: "{colors.sg-text-secondary}"
    typography: "{typography.sg-type-control}"
    rounded: "{rounded.sg-radius-md}"
    height: "24px"
    padding: "0 8px"
  title-button-hover:
    backgroundColor: "{colors.sg-state-hover-control}"
    textColor: "{colors.sg-text-primary}"
  clock:
    textColor: "{colors.sg-text-subtle}"
    typography: "{typography.sg-type-control}"
  tag:
    textColor: "{colors.sg-text-subtle}"
    typography: "{typography.sg-type-meta}"
    rounded: "{rounded.sg-radius-sm}"
    padding: "1px 6px"
  status-bar:
    backgroundColor: "{colors.sg-surface-base}"
    textColor: "{colors.sg-text-secondary}"
    typography: "{typography.sg-type-status}"
    height: "24px"
    padding: "0 6px"
  status-item:
    textColor: "{colors.sg-text-secondary}"
    typography: "{typography.sg-type-status}"
    rounded: "{rounded.sg-radius-sm}"
    height: "22px"
    padding: "0 7px"
  status-item-hover:
    backgroundColor: "{colors.sg-state-hover-control}"
    textColor: "{colors.sg-text-primary}"
  status-item-wait:
    textColor: "{colors.sg-status-wait-fg}"
  status-item-failed:
    textColor: "{colors.sg-status-err-fg}"
  rail:
    backgroundColor: "{colors.sg-surface-raised}"
    textColor: "{colors.sg-text-primary}"
    width: "340px"
    padding: "2px 12px 16px"
  rail-tab:
    textColor: "{colors.sg-text-subtle}"
    typography: "{typography.sg-type-control}"
    height: "34px"
  rail-tab-selected:
    textColor: "{colors.sg-text-primary}"
  filter-chip:
    textColor: "{colors.sg-text-secondary}"
    typography: "{typography.sg-type-control}"
    rounded: "{rounded.sg-radius-lg}"
    height: "26px"
    padding: "0 9px 0 7px"
  filter-chip-pressed:
    backgroundColor: "{colors.sg-accent-bg}"
    textColor: "{colors.sg-text-primary}"
  section-head:
    textColor: "{colors.sg-text-subtle}"
    typography: "{typography.sg-type-section}"
    padding: "16px 4px 8px"
  attention-card:
    backgroundColor: "{colors.sg-status-wait-bg}"
    textColor: "{colors.sg-text-primary}"
    rounded: "{rounded.sg-radius-lg}"
    padding: "10px 12px"
  attention-card-failed:
    backgroundColor: "{colors.sg-status-err-bg}"
    textColor: "{colors.sg-text-primary}"
    rounded: "{rounded.sg-radius-lg}"
    padding: "10px 12px"
  row:
    textColor: "{colors.sg-text-primary}"
    typography: "{typography.sg-type-body}"
    rounded: "{rounded.sg-radius-md}"
    padding: "6px 4px"
  row-hover:
    backgroundColor: "{colors.sg-state-hover}"
  row-selected:
    backgroundColor: "{colors.sg-surface-selected}"
  button:
    backgroundColor: "{colors.sg-surface-sunken}"
    textColor: "{colors.sg-text-primary}"
    typography: "{typography.sg-type-control}"
    rounded: "{rounded.sg-radius-md}"
    height: "26px"
    padding: "0 8px 0 4px"
  button-primary:
    backgroundColor: "{colors.sg-accent-bg}"
    textColor: "{colors.sg-text-primary}"
    typography: "{typography.sg-type-control}"
    rounded: "{rounded.sg-radius-md}"
    height: "26px"
    padding: "0 8px 0 4px"
  button-primary-hover:
    backgroundColor: "{colors.sg-accent-bg-hover}"
  button-plain:
    backgroundColor: "{colors.sg-surface-sunken}"
    textColor: "{colors.sg-text-primary}"
    typography: "{typography.sg-type-control}"
    rounded: "{rounded.sg-radius-md}"
    height: "26px"
    padding: "0 8px"
  kbd:
    backgroundColor: "{colors.sg-surface-sunken}"
    textColor: "{colors.sg-text-secondary}"
    rounded: "{rounded.sg-radius-sm}"
    padding: "0 4px"
    height: "18px"
  task-input:
    backgroundColor: "{colors.sg-surface-sunken}"
    textColor: "{colors.sg-text-primary}"
    typography: "{typography.sg-type-body}"
    rounded: "{rounded.sg-radius-md}"
    height: "30px"
    padding: "0 10px"
  task-row:
    textColor: "{colors.sg-text-primary}"
    typography: "{typography.sg-type-body}"
    rounded: "{rounded.sg-radius-md}"
    padding: "8px 4px"
  brief-item:
    backgroundColor: "{colors.sg-surface-sunken}"
    textColor: "{colors.sg-text-primary}"
    rounded: "{rounded.sg-radius-lg}"
    padding: "9px 10px"
  zoom-control:
    backgroundColor: "{colors.sg-surface-raised}"
    textColor: "{colors.sg-text-secondary}"
    typography: "{typography.sg-type-control}"
    rounded: "{rounded.sg-radius-md}"
    height: "28px"
  popover:
    backgroundColor: "{colors.sg-surface-raised}"
    textColor: "{colors.sg-text-secondary}"
    rounded: "{rounded.sg-radius-lg}"
    padding: "6px"
    width: "240px to 320px"
  minimap:
    backgroundColor: "{colors.sg-overview-hud-minimap}"
    textColor: "{colors.sg-text-subtle}"
    rounded: "{rounded.sg-radius-md}"
    width: "176px"
  edge-marker:
    backgroundColor: "{colors.sg-surface-raised}"
    textColor: "{colors.sg-text-primary}"
    typography: "{typography.sg-type-meta}"
    rounded: "{rounded.sg-radius-md}"
    height: "24px"
    padding: "0 8px 0 6px"
  edge-marker-hover:
    backgroundColor: "{colors.sg-overview-wait-wash-hover}"
  edge-marker-failed:
    backgroundColor: "{colors.sg-surface-raised}"
    textColor: "{colors.sg-text-primary}"
    typography: "{typography.sg-type-meta}"
    rounded: "{rounded.sg-radius-md}"
    height: "24px"
    padding: "0 8px 0 6px"
  edge-marker-failed-hover:
    backgroundColor: "{colors.sg-status-err-bg}"
  tooltip:
    backgroundColor: "{colors.sg-surface-raised}"
    textColor: "{colors.sg-text-primary}"
    rounded: "{rounded.sg-radius-md}"
    padding: "7px 9px"
    width: "max-content, max 280px"
  toast:
    backgroundColor: "{colors.sg-surface-raised}"
    textColor: "{colors.sg-text-primary}"
    typography: "{typography.sg-type-body}"
    rounded: "{rounded.sg-radius-lg}"
    padding: "9px 12px"
  map-callout:
    backgroundColor: "{colors.sg-surface-raised}"
    textColor: "{colors.sg-text-primary}"
    typography: "{typography.sg-type-meta}"
    rounded: "{rounded.sg-radius-md}"
    height: "20px"
    padding: "0 7px"
  speech-bubble:
    backgroundColor: "{colors.sg-surface-raised}"
    textColor: "{colors.sg-text-secondary}"
    rounded: "{rounded.sg-radius-md}"
    height: "18px"
    padding: "0 7px"
---

# Design System: Overview

## Overview

**Creative North Star: "The Inhabited Survey"**

Overview is a measured plane that a small society lives on. The fleet of agent sessions sits on a 2:1 isometric lattice with a graticule at the stage edges. Each machine is a neighbourhood generated from its id: a tinted ground with its own texture, a skyline of closed buildings along the back, project offices as low open-front rooms, a café, a canteen or a park, streets between the lots, and bridges to its neighbours that carry the SSH latency. Each session is a small grey pixel creature, seeded from its session id, that works at its office desk while it is needed and otherwise lives in the neighbourhood: it gets coffee, eats lunch at the real lunch hour, naps in the park, greets and comforts friends, and talks about the real sessions. Names are painted on the ground like a country on a map. Only what needs the owner floats.

Every colour, face, radius and duration comes from Signal (@barrymind/signal 0.1.2). Core tokens (`--sg-surface-*`, `--sg-text-*`, `--sg-border-*`, `--sg-accent-*`, `--sg-status-*`, `--sg-font-*`) dress the chrome. The Overview extension (`--sg-overview-*`) dresses the plane: neighbourhood tints (`--sg-overview-hood-*`), terrain, lattice, creature coats and slabs. The CSS aliases them to short local names (`--bg`, `--panel`, `--wait` and so on), and the canvas reads them through `getComputedStyle` at boot. Overview owns layout, geometry and behaviour, not values. The chrome has instrument-panel density: 13px body, 11px metadata, 24 to 40px bars and 12px insets.

The world is muted and the signals are loud. Each neighbourhood carries one low-chroma tint on its ground, walls and roofs. Day and night follow the owner's clock and darken only the world. Status hues and the periwinkle accent are never shaded and never decorative, so a raised hand reads the same at noon and at midnight.

**Key Characteristics:**
- Signal 0.1.2 is the token source; Overview references `--sg-*` variables and owns none of the values
- 2:1 isometric projection, 16 x 8 px per grid unit at 1x, integer device-pixel zoom steps
- Machines as generated neighbourhoods (tint, texture, skyline, offices, café, canteen or park, streets, bridges)
- Names painted on the ground in perspective; only callouts and speech float
- Seeded pixel creatures with a monochrome genome, expressions, emotes and a social life that desk states override
- Day and night from the real clock, shading terrain and buildings only
- Mono for data, controls and the map; sans for human sentences
- Hairlines (1px) and small radii (3 to 6px); flat chrome, soft shadows only on floating overlays

## Colors

Signal graphite, with muted neighbourhood tints underneath and five saturated hues that each mean exactly one thing. Values live in Signal; this section names the variables and their roles.

### Primary
- **Signal Periwinkle** (`--sg-accent-fg`, with `--sg-accent-bg` 12%, `--sg-accent-bg-hover` 20% and `--sg-accent-border` 60%): the owner's hand. It covers the focus ring (2px outline, 1px offset), the stage's inset focus ring, the selected-card ring, the selected-row inset ring, the primary button, a pressed filter chip, the live-demo switch track and the corner brackets around the selected creature. Text selection uses `--sg-selection-bg`.

### Secondary (status)
- **Needs-You Yellow** (`--sg-status-wait-fg`, `-bg`, `-border`): the loudest colour. It marks the pixel diamond over a waiting creature, its ground ring, its callout border, its slab, its edge marker, the needs-you count painted beside the machine name, the minimap diamond and header count, needs-you cards, the "needs you" section head and status item, and the brief's numerals.
- **Failed Coral** (`--sg-status-err-fg`, `-bg`, `-border`): the failed slab and its callout, failed edge markers (cross icon, plot name, border, and `--sg-status-err-bg` on hover), the minimap diamond, failed cards, the failed section head and status item.
- **Done Sage** (`--sg-status-done-fg`): the done slab, the done icon, section head and status item, a checked task box, the "agent moved on" hint, and the connected dot before each host.
- **Running Steel** (`--sg-status-run-fg`): the quietest status. It fills the running slab and the six-dot running icon, and nothing else.

### Neutral
- **Ground** (`--sg-overview-ground`): the stage floor, the water between neighbourhoods.
- **Graphite Base / Panel / Well / Selected** (`--sg-surface-base`, `-raised`, `-sunken`, `-selected`): bars; rail, HUD, popovers, tooltips, toasts, callouts and speech; inset controls, inputs, brief items and the minimap field; the selected row.
- **Hairline / Hairline Strong / Hover Edge / Control** (`--sg-border-subtle`, `-default`, `-strong`, `-control`): dividers; control borders, room-floor edges and speech borders; hovered borders, the hovered office edge and the hover bracket; the tracker input border.
- **Ink / Dim / Subtle / Faint** (`--sg-text-primary`, `-secondary`, `-subtle`, `-disabled`): the four text greys. Ink also paints the ground lettering and textures at low alpha. Faint is reserved for the "$" prompt, sleep "z" marks, path previews, antenna tips and the mark's lower stroke, never for text the owner must read.
- **Hover washes** (`--sg-state-hover` 4% on rows and tasks, `--sg-state-hover-control` 6% on title, zoom, status and popover items).

### Neighbourhood tints
- **Five muted tints** (`--sg-overview-hood-{slate,sage,clay,plum,sand}-{ground,wall,wall-shade,roof}`): each neighbourhood takes one, chosen from its id and never repeated while tints remain. Ground fills the neighbourhood slab; wall fills skyline left faces and back room walls; wall-shade fills right faces and left room walls; roof fills building tops and the 2px cap on room walls. The minimap shows each neighbourhood in its wall-shade.
- **Shared world tones** (`--sg-overview-hood-shared-*`): window glass by day (`-window-day`), lit windows (`-window-lit`, a near-neutral warm grey), park ground (`-park`), tree canopy and trunk (`-tree-dark`, `-tree-light`, `-trunk`), furniture body and top (`-furniture`, `-furniture-top`), and the night target colour (`-night`).
- **Terrain** (`--sg-overview-terrain-island-face-left`, `-face-right`, `-edge`; `--sg-overview-terrain-bridge-top`): the extruded faces and 1px edge of every neighbourhood slab and bridge. Bridge plank ticks use `--sg-overview-lattice-plate-tick`.
- **Room floors** (`--sg-overview-plate`, `-plate-face-left`, `-plate-face-right`): office, café and canteen floors are plate slabs with a Hairline Strong edge. The café floor adds a 3.5% Ink checker.
- **Ground textures**: one per neighbourhood, chosen from its id and unique while textures remain. Dots every 0.5 u at `--sg-overview-opacity-texture-dots` (12%), hatch every 0.5 u at `-hatch` (8%), a 1 u grid at `-grid` (7%), plus stipple (a sparse 0.34 u dot field) and lines (along v every 0.5 u), both at 7%. All are Ink, clipped to the slab.
- **Lattice** (`--sg-overview-lattice-grid-minor`, `-grid-major`, `-survey-cross`, `-graticule-tick`): all Ink at low alpha over Ground.

### Creature and slab colours
- **Creature Ink** (`--sg-overview-creature-ink`) outlines every sprite and draws eyes, mouths and accessories; **Creature Shadow** (`--sg-overview-creature-shadow`) grounds it.
- **Coat ramps**, each four tones (shade, base, light, highlight) lit from the upper left: `--sg-overview-creature-pale-*`, `-lit-*` (the common "mid" coat, drawn twice as often) and `-dusk-*` for awake creatures; `-dim-*` for sleepers.
- **Slab marks**: `--sg-overview-slab-asleep-rim` (asleep slabs show only their end pixels), `-slab-run-cursor` (a moving pixel on a running slab), `-slab-err-crack` (a diagonal crack on a failed slab).

### Named Rules
**The Muted World, Loud Status Rule.** Each neighbourhood gets one low-chroma tint, and it lands only on terrain, walls and roofs. Saturated hue is spent on the four statuses and the accent and nowhere else: never on creatures, furniture, emotes, speech or signage. If a new element is not a status and not the owner's own selection or action, it is graphite or its neighbourhood's tint.

**The Loudest Yellow Rule.** Needs-you yellow outranks everything. Only a waiting session gets the diamond, the ground ring, the hop, a yellow edge marker, a yellow callout and a place in the painted needs-you count. Failed sessions get the coral callout, the coral edge marker and the melt; no other state may borrow these devices.

**The Night Spares Status Rule.** Night shades the world (terrain, slabs, floors, walls, buildings, furniture, trees, bridges) toward `--sg-overview-hood-shared-night`. Creatures, slabs, status colours, the accent, ground lettering and every floating label are never shaded.

**The Signal Source Rule.** Every colour comes from a `--sg-*` variable. If a needed value is missing, add it to Signal's tokens and rebuild the package; do not write a literal into Overview.

## Typography

**Display Font:** none (Signal defines `--sg-type-display`; Overview does not use it)
**Body Font:** Instrument Sans (`--sg-font-sans`)
**Label/Mono Font:** JetBrains Mono (`--sg-font-mono`)

**Character:** A plain humanist sans for the few sentences a person reads (task titles, questions, brief items) and a calm mono for everything a machine says: names, paths, coordinates, commands, counts, controls, and everything written on the map. The canvas reads `--sg-font-mono` at boot so the plane matches the chrome.

### Hierarchy
- **Headline** (`--sg-type-headline`, sans 500, 15px): the morning-brief title, the largest chrome type, with balanced wrap.
- **Title** (`--sg-type-title`, sans 500, 14px): the task title on a needs-you or failed card, with balanced wrap.
- **Body** (`--sg-type-body`, sans 400, 13px, 1.45): row and task titles, questions, toasts and the tracker input. **Body Strong** (`--sg-type-body-strong`) for tooltip and brief-item titles.
- **Body Small** (`--sg-type-body-small`, 12.5px): brief explanations in Dim and empty states in Subtle.
- **Code** (`--sg-type-code`, mono 12.5px): the command a session wants to run, wrapping anywhere, after a Faint "$".
- **Control** (`--sg-type-control`, mono 12px): buttons, tabs, filter chips, the breadcrumb, the clock, zoom values and card status lines.
- **Status** (`--sg-type-status`, mono 11.5px, tabular): the status bar.
- **Meta** (`--sg-type-meta`, mono 11px, tabular): agent lines, ages, row summaries, graticule numbers, map callouts, edge markers, popover rows and the minimap header.
- **Section** (`--sg-type-section`, mono 11px, 0.06em, uppercase): the heads of rail lists and popovers, always with the list's count ("needs you · 2").
- **Speech** (mono 400, 10.5px, Dim): what creatures say, at most 22 characters.
- **Ground lettering** (mono, sized in world units and drawn in the plane's perspective, reading up-right along the front edge):
  - **Territory name:** the machine name in capitals, weight 600, Ink at 9%. It is sized so the word spans about 80% of the neighbourhood's front edge (capped at 4.2 u), with letter spacing of 0.3 x its size.
  - **Caption:** 0.55 u, weight 400, Ink at 45%, at the very edge ("ssh 14 ms · 4 agents"). When sessions wait, "· 2 needs you" follows in yellow at 95%, weight 500.
  - **Floor names:** project names on office floors (0.62 u, 500, Ink 50%). "café", "canteen" and "park" go on amenity floors (0.58 u, 500, Ink 30%), and "ssh 14 ms" on bridges (0.5 u, Ink 45%).

### Named Rules
**The Mono-for-Machines Rule.** If the text is a name, path, coordinate, number, command or control, it is JetBrains Mono. Instrument Sans is for sentences a person reads.

**The Painted Names Rule.** Places are named on the ground, in perspective, never on floating labels. Machine names are territory-sized and faint; project and amenity names sit on their floors. Only callouts (why a hand is raised or a session failed) and speech float above the plane.

**The Tabular Rule.** Every number that updates (ages, counts, zoom, coordinates, latency, the clock) uses tabular figures. Graticule coordinates are zero-padded to two digits with a true minus sign (−08).

## Layout

The app is a three-row, two-column grid built on Signal sizes: a 40px title bar (`--sg-size-title-bar`), the stage filling the left with a 340px rail (`--sg-size-rail`) on the right, and a 24px status bar (`--sg-size-status-bar`). Hairlines separate every region. Safe-area insets pad the edges. The title bar holds the mark, the breadcrumb ("map · 13 agents on 3 machines"), then the clock ("12:40 · day"), the sample tag and the live-demo switch.

Stage overlays sit 12px from the stage edges. The zoom group sits top right as minus, level, plus, fit and "?", and "?" opens the legend-and-keys popover. The minimap sits bottom left (176 x 108px under an 11px header). There is no cursor readout, no scale bar and no always-on legend.

The rail holds a 34px tab bar (now, tasks with its open count, morning brief). The now tab adds a wrapping row of state filter chips above a scrolling body (padding 2px 12px 16px). List order puts attention first: needs you (cards), failed (cards), running, done, asleep. Empty groups are hidden unless filtered, except needs you, which always shows.

Spacing is a tight 2 to 16px rhythm on `--sg-space-*`: 4px inner, 6px between related items, 8px between siblings, 10 to 12px card padding and insets, 16px between list sections.

At 860px and below (`--sg-overview-layout-stacked-breakpoint`), the rail drops beneath the stage: rows become 40px, 64vh of stage, an auto-height rail and 24px of status. The status bar drops its hosts, the breadcrumb drops its long tail, the clock hides, and the minimap shrinks to 132 x 81px with no title.

### The opening frame
Fit picks the largest zoom level that shows every neighbourhood. If that level is below the legible floor (0.66x), the camera frames the waiting and failed agents instead (each with a 3 u margin) at the largest level that holds them, never below the floor. The urgent agents are on screen first. Anything still off screen gets an edge marker.

### The Map Grid
- **Projection:** 2:1 isometric. A grid point (u, v) lands at x = (u − v) x 16 x z, y = (u + v) x 8 x z (CSS px). One unit of height is 10 x z px.
- **Draw order:** ground, lattice, bridges, neighbourhood slabs with texture and lettering, room floors. Then buildings, room walls, furniture and creatures, sorted back to front by u + v (walls split into unit segments so creatures sort against them). Then the graticule, floating labels, and the hover and selection brackets.
- **Lattice:** minor lines every 1 u at 1.5x and above (every 2 u below), major lines every 8 u, and a survey cross (3px arms) at every major intersection.
- **Graticule:** at the top and left stage edges, a 6px tick and a Meta label ("u 08", "v −16") in Subtle at every major line. Ticks skip 60px from the left, 230px from the right, 34px from the top and 160px from the bottom, clear of the zoom group and minimap.
- **Zoom:** levels are k / devicePixelRatio for k in {1, 2, 3, 4, 5, 6, 8}, kept between 0.3x and 4x. The wheel steps one level per 60 units. Pinch zooms freely and snaps to the nearest level on release.

### Neighbourhood layout
- **Placement:** neighbourhoods sit in two columns with 6 u of water between them, rows stacked with the same gap. Bridges join each to its right neighbour (2 u in from the shorter one's far edge) and to the one below (through the middle street). Bridge slabs are max(2, round(3z)) px thick; neighbourhood slabs max(4, round(10z)) px.
- **Strips, back to front:** a 3 u skyline strip, then rows of lots 6 u deep with 2 u streets between them, then the amenity row. A 2 u middle street divides the two lot columns, and a 3 u name strip runs along the front-right edge for the painted name.
- **Skyline:** closed buildings 2 to 4 u wide, 2 to 3 u deep and 2 to 6 storeys tall, with gaps of 1 u about half the time. Each has a roof prop: none, an AC unit, an antenna with a Faint tip, or a water tank. Windows sit in a grid on both visible faces.
- **Offices:** one per project, max(6, 2n + 3) u wide for n sessions, centred in its column. Desks sit 2.5 u in at a 2 u pitch, each with a visitor spot in front, and a potted plant stands in the back-right corner. Back and left walls are 1.4 units high; the front is open.
- **Amenities** (8 u wide): every neighbourhood has a café (counter with a coffee machine, two small tables with seats around them). It adds a canteen (one long five-seat-a-side table and a food counter) or a park (an unwalled green with up to four trees, a two-seat bench and standing spots). An odd project count gets both, and the world always has at least one of each.

### Named Rules
**The Generated Neighbourhood Rule.** A neighbourhood's tint, texture, skyline and amenities come from its machine id, so the same machine always looks the same. Rooms stand at integer grid coordinates and are placed automatically; nothing is dragged.

**The Integer Pixel Rule.** Creatures, terrain, rooms and the lattice share one integer device-pixel scale. Never smooth a sprite or offer a zoom between levels.

**The Label Priority Rule.** Only two things float, placed in order: callouts first, speech last. Each tries its candidate spots in order and takes the first one that is on screen (2px inset) and clear by 6px of the HUD, the edge markers, the graticule bands (top 26px, left 52px), other creatures and labels already placed. Callouts try above, then right with a leader line, then left, and are forced on screen if their creature is. Speech that finds no spot falls back to a glyph bubble and never covers a callout.

## Elevation & Depth

The chrome is flat: surfaces sit one tonal step apart and are divided by 1px hairlines. The plane gets depth from projection, not lighting. Neighbourhood slabs, bridges, room floors, buildings and furniture are extruded with two darker faces. Creatures and trees cast translucent ellipses, and draw order follows iso depth. Only overlays floating above the stage carry a soft ambient shadow.

### Shadow Vocabulary
- **Tooltip** (`box-shadow: 0 6px 18px rgb(0 0 0 / 0.5)`, equal to `--sg-shadow-tooltip`): the hover and selection tooltip above a creature.
- **Toast** (`box-shadow: 0 8px 24px rgb(0 0 0 / 0.5)`, equal to `--sg-shadow-toast`): transient confirmations.
- **Popover** (`box-shadow: 0 10px 28px rgb(0 0 0 / 0.55)`): the "?" legend and status-bar lists. The build ships this literal, which does not match `--sg-shadow-popover`.
- **Creature shadow** (`--sg-overview-creature-shadow`, an ellipse half the sprite wide and 3 sprite px tall): grounds every creature.

### Named Rules
**The Flat Chrome Rule.** Bars, rail, cards, chips, rows and buttons are flat. A shadow appears only on something floating above the stage, and state is shown with rings, borders and washes, never lift.

## Shapes

Corners stay small and consistent, all on `--sg-radius-*`. Tags, keycaps, the focus ring, status items and popover rows take 3px. Controls, rows, tasks, HUD panels, tooltips, callouts, speech, edge markers and the tracker input take 5px. Cards, filter chips, brief items, popovers and toasts take 6px. The switch track is a 12px-tall pill. Borders are 1px, except the keycap's 2px bottom and the selected rail tab's 2px Ink underline.

On the plane, form is the rhombus and the iso box. Neighbourhoods, floors, bridges, the waiting ring (±0.85 u), the path-preview destination and minimap marks are grid-aligned diamonds. Buildings, walls, counters, tables and benches are upright iso boxes. The needs-you diamond is a pixel lozenge (rows 1, 3, 5, 7, 5, 3, 1). Selection is four 6px corner brackets 4px outside the creature, in accent when selected and Hover Edge when hovered.

## Components

### Buttons
Keycapped and quiet.
- **Shape:** 26px tall (`--sg-size-button`), 5px radius, 1px Hairline Strong border, Graphite Well fill, with a leading keycap showing its shortcut.
- **Primary:** accent border and accent fill. There is one per card: "Enter open in orca".
- **Plain:** no keycap and symmetric 8px padding, used for "tracked", "track" and brief "locate".
- **Hover / Focus:** the border shifts to Hover Edge (primary: fill to `--sg-accent-bg-hover`) in 80ms (`--sg-duration-fast`). Focus is the global 2px accent outline.
- **Title-bar button:** borderless, 24px tall, Dim, with a 6% wash on hover. The live-demo switch slides in 140ms.

### Chips
- **Filter chip:** 26px, 6px radius, 1px Hairline border, a status icon, a bold count and the state name in Control mono. Hover moves the border to Hairline Strong. Pressed takes the accent border and fill. A zero-count chip goes Subtle. Pressing a chip filters the now list; pressing it again clears the filter.
- **Sample tag:** 1px Hairline border, 3px radius, Subtle 11px mono. Prototypes always carry it.
- **Keycap:** 11px mono, a Hairline Strong border with a 2px bottom, 3px radius, Graphite Well.

### Cards / Containers
- **Attention card** (needs you and failed only): 6px radius, `--sg-status-wait-border` and `-bg` (failed: the `err` pair), 10 x 12px padding and a 6px gap. It shows the title, then a Meta line with the creature's name, agent and host:project. Next comes a status line in the status colour with icon and age, then the command (Code), question (Body) or failure summary, then actions. Selected, a 2px accent ring replaces the border.
- **Brief item:** 6px radius, Hairline border, Graphite Well, a yellow mono numeral beside a Body Strong title and a Body Small explanation, plus locate and track actions.
- **Popover:** Graphite Panel, Hairline Strong border, 6px radius, 6px padding, 240 to 320px wide, with Section heads. The "?" legend explains each state in behaviour terms ("hopping under a diamond: needs you"), then the world ("each machine is a neighborhood, named on the ground", "day and night follow your clock", "zoom in to read what creatures say"), then the keys. Status lists show one 3px-radius row per session.

### Inputs / Fields
- **Tracker input:** 30px tall, 5px radius, a 1px `--sg-border-control` border, Graphite Well fill, Body text and a Subtle placeholder. Focus swaps the outline for an accent border.
- **Task checkbox:** 16px, a 1.5px Hover Edge border, turning to Ink on hover. When checked, it fills with Done Sage and shows a check.

### Navigation
- **Rail tabs:** mono 12px Subtle, 16px apart. Hover and selected go Ink, and the selected tab gains a 2px Ink underline on the divider. The tasks tab carries its open count.
- **List rows:** 14px icon, title, right-aligned age, and a Meta line beneath with "project · name · summary". They take a 5px radius and a 4% wash on hover; selected rows take Selected Row fill with a 1px accent inset ring.
- **Tasks (tracker):** rows divided by hairlines, each a checkbox, title, age and a Meta line. A remove control appears on hover or focus. The tracker only tracks and never writes to an agent. Waiting and failed sessions become tasks automatically. When the agent moves on, a Done Sage hint reads "agent moved on · mark done". Done tasks strike through in Subtle.
- **Status bar:** interactive 22px items with 3px radius and a 6% wash on hover or open. From the left: "overview" (fits everything), needs you (yellow; jumps to the next waiting agent), failed (coral, only when non-zero), running, done (sage) and asleep. All but needs you open a list popover. Hosts sit at the right, each led by a 6px sage dot and followed by its latency, and each frames its neighbourhood.
- **Clock:** Control mono in Subtle, tabular, "HH:MM · day | dawn | dusk | night". `?hour=` overrides the clock for review.

### Stage HUD
- **Zoom group:** one 5px-radius Graphite Panel with 28px cells divided by hairlines: minus, the level ("2×"), plus, fit and "?".
- **Minimap:** the same projection fitted to the neighbourhoods, over a Graphite Well field. Neighbourhoods show in their tint's wall-shade, rooms in `--sg-overview-minimap-plate` and parks in tree-dark. Waiting and failed sessions are 4px diamonds in their status colour; others are 2px Subtle dots. The viewport is a 1.5px Dim rectangle. The header shows "n need you" in yellow or "clear". Click or drag to jump.
- **Edge marker:** a 24px Graphite Panel chip for each off-screen waiting or failed session, placed along the ray from the stage centre and held 26px inside the edge (plus 60px horizontally and 34px vertically). Waiting: a `--sg-status-wait-border` border, a yellow diamond, the plot name in yellow, the age, a Dim arrow rotated toward the session, and `--sg-overview-wait-wash-hover` on hover. Failed: the `err` border, a coral cross, the plot name in coral, and `--sg-status-err-bg` on hover. Markers step clear of the zoom group and minimap using their measured size plus 6px. Clicking glides to the session.

### Callouts and speech
- **Callout:** 20px tall, 5px radius, Graphite Panel, a 1px border in the status colour at 70% and Meta text in Ink, at most 20 characters, for waiting and failed creatures. Above the creature it has a 4px pointer; beside it, a leader line at 60%.
- **Speech:** 18px tall, 5px radius, Graphite Panel, a 1px Hairline Strong border, 10.5px mono in Dim and a 4px pointer, at most 22 characters. Words show from 1.5x zoom; below that, a glyph bubble shows instead. A line stays 2.6s, and the next speaker in the group starts 2.8 to 3.6s later.
- **Glyph bubble:** a 9 x 9 sprite-px pixel bubble (Hairline Strong outline, Graphite Panel fill) holding a 5 x 5 Dim glyph. It fades in and out and rises 3 sprite px over its life.

### Creatures (signature)
Monochrome pixel blobs in three base silhouettes (droplet for claude, cube for codex, twin lobes for gemini). Each face is rendered once into a cached sprite and scaled only by whole pixels.
- **Genome:** seeded from the session id. It sets height (0.76 to 1.24x) and width (0.84 to 1.2x), and a coat (pale, mid or dusk; asleep always uses the dim ramp). It sets a pattern (none, spots, belly, band, freckles), an accessory (none, sprout, antenna, cap, horns, tuft), eyes (dot, wide, sleepy, odd) and a mouth (none, smile, o). It also gives a two-syllable name and the traits social, energy, curious, sleepy and talk.
- **Shading:** a 1px Creature Ink outline and four bands from the coat ramp, lit from the upper left. The bottom two rows always shade.
- **Expressions:** focus at the desk while running, worried while waiting (and while comforting), surprised on "!", happy when free and resting, open while talking, closed when asleep or napping, and x when failed at the desk. Eyes blink for 0.12s every 3.8s. A failed creature melts into a flat silhouette with a Dim sweat drop.
- **Slab:** a five-row lozenge (2, 6, 10, 6, 2 sprite px) at chest height in front-right, shown only at the desk. It is filled in the status colour (run 80%, wait and err 95%, done 55%) or, when asleep, only rimmed.
- **Emotes:** dots and coffee while thinking at the desk, coffee at the counter, food at the canteen, wave when passing or greeting, heart when comforting, star when a session finishes (and from done neighbours), "!" on failure or a new question, plus "?" and note as reactions in a conversation. Waiting creatures show no emotes; the diamond speaks for them.
- **Motion:** waiting creatures hop up to 4 sprite px under a diamond that flickers 1 px at 2Hz, and squash 1 px on landing. Celebrating creatures hop up to 7 px. Running creatures bob 1px three times a second and tap their slab. Walkers bob with their energy; speakers bob while talking. Sleepers emit fading Faint "z" marks.
- **Reduced motion:** the simulation settles instead of running. Desk states sit at their desks. Free creatures take a seat in their home café, canteen or park, and sleepers a bench or seat. Hops, bobs, bubbles, "z" marks and camera easing stop, and the frame redraws every 400ms.

### Life
Running, waiting and failed creatures walk to their desk and stay there; desk states always win. Done creatures choose by personality, drawn toward rooms where others already are:
- the café (counter, then a seat)
- the canteen (heavily weighted from 11:45 to 13:30 local time)
- the park (sleepy ones nap on the bench)
- a visit to a friend working at a desk, or a visit to another neighbourhood over a bridge
- a check on their own desk, or a walk that may join someone standing in the street

When a session finishes, its creature celebrates. When one fails, up to two done friends come to comfort it, if a visitor spot is free. Creatures wave when they pass each other. Groups that share a room or stand close take turns talking. Lines come from the real sessions (status gossip, the speaker's own work), small talk, or a reply to a question, and time spent talking builds friendship, which the tooltip names. Asleep creatures only take benches or seats. A path that cannot be found becomes a short "looking around" pause. Paths are A* over walkable cells; desk-bound creatures move at 2.4 cells/s and free ones at 1.3, both times energy. The selected or hovered walker shows its path as Faint dots with a Faint rhombus at the destination.

### Day and night
The night factor is 0 from 07:30 to 18:00. It ramps to 0.5 by 20:30, holds overnight, and ramps back from 05:30. The world's colours mix toward `--sg-overview-hood-shared-night` by that factor. Above 0.15, about 20% of window cells (seeded per building) light in `--sg-overview-hood-shared-window-lit` at 50% opacity; the rest stay day glass.

### Motion
Camera moves ease exponentially toward their target at a rate of 10 per second. Tab glides to the next waiting agent, and `l` (or Space on a focused row) glides to the selected agent; either raises the zoom to the first level at or above 1.5x. After a glide, the camera follows the creature while it walks and lets go once it has stopped and 4s have passed. Hover changes take 80ms, the switch 140ms and the toast 220ms in and out. Under reduced motion, transitions are removed.

## Do's and Don'ts

### Do:
- **Do** reference every colour, face, radius and size through a `--sg-*` variable, and add missing values to Signal rather than to Overview.
- **Do** give each neighbourhood exactly one tint from `--sg-overview-hood-*` and apply it only to its ground, walls and roofs.
- **Do** paint place names on the ground: the machine name territory-sized at 9% Ink, projects and amenities on their floors.
- **Do** keep zoom on the integer levels (k / devicePixelRatio, k in 1 to 8) and draw sprites with image smoothing off.
- **Do** reserve yellow for sessions that need the owner, and give every waiting session all of its signals: diamond, ring, callout, edge marker when off screen, card in the rail and the painted count.
- **Do** keep callouts to 20 characters or fewer and say why the hand is raised ("run pnpm db:migrate?").
- **Do** place speech at the lowest label priority, as words from 1.5x and a glyph below.
- **Do** shade only the world toward night; leave creatures, slabs, status, accent and labels at full value.
- **Do** let desk states override the simulation: a session that needs the owner, runs or fails goes back to its desk.
- **Do** open on the urgent agents when the whole world will not fit at a legible zoom.
- **Do** give every creature on the map a matching row or card in the rail.

### Don't:
- **Don't** write a literal colour or font into Overview when a Signal token exists.
- **Don't** use a status hue or the accent for decoration (emote glyphs, furniture lights, signage); the world is graphite and muted tints.
- **Don't** bring back floating machine or project labels; only callouts and speech float.
- **Don't** let textures, lettering or tints compete with status; textures stay at or below 12% Ink and territory names at 9%.
- **Don't** smooth, rotate or fractionally scale creature sprites.
- **Don't** add drop shadows or lift to bars, cards, chips, rows or buttons; only floating overlays above the stage get a shadow.
- **Don't** set readable text in Faint; it is for the "$" prompt and ambient marks only.
- **Don't** let the tracker act on an agent; it only tracks.
