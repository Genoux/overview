---
name: Overview
description: An inhabited isometric survey of every agent session, built on the Signal design system; colour is spent only on status and on you.
# Token source: @barrymind/signal 0.1.1 (core signal.css + extension overview.css, vendored in prototype/vendor/signal).
# Overview does not own these values. Keys are the Signal custom-property names without the leading "--";
# values mirror Signal 0.1.1 for tooling only. Change them in Signal's tokens JSON and rebuild, never here.
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
  sg-overlay-label: "rgb(26 27 28 / 0.86)"
  sg-overview-ground: "#1b1c1e"
  sg-overview-plate: "#232426"
  sg-overview-plate-face-left: "#18191b"
  sg-overview-plate-face-right: "#131415"
  sg-overview-minimap-plate: "#323336"
  sg-overview-wait-wash-hover: "#2f2c25"
  sg-overview-hud-minimap: "rgb(26 27 28 / 0.9)"
  sg-overview-terrain-island-top: "#1f2022"
  sg-overview-terrain-island-face-left: "#161719"
  sg-overview-terrain-island-face-right: "#121314"
  sg-overview-terrain-island-edge: "#38393c"
  sg-overview-terrain-commons: "#242527"
  sg-overview-terrain-bridge-top: "#202123"
  sg-overview-prop-bench-top: "#2e2f32"
  sg-overview-prop-bench-face-left: "#2a2b2e"
  sg-overview-prop-bench-face-right: "#232427"
  sg-overview-prop-bench-edge: "#46474a"
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
  sg-type-map-label:
    fontFamily: "JetBrains Mono, ui-monospace, SF Mono, Menlo, DejaVu Sans Mono, monospace"
    fontSize: "11.5px"
    fontWeight: 500
    lineHeight: 1.45
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
  sg-type-badge:
    fontFamily: "JetBrains Mono, ui-monospace, SF Mono, Menlo, DejaVu Sans Mono, monospace"
    fontSize: "10.5px"
    fontWeight: 500
    lineHeight: 1
rounded:
  sg-radius-hair: "2px"
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
  map-label:
    backgroundColor: "{colors.sg-overlay-label}"
    textColor: "{colors.sg-text-primary}"
    typography: "{typography.sg-type-map-label}"
    rounded: "{rounded.sg-radius-sm}"
    height: "18px"
    padding: "0 5px"
  map-callout:
    backgroundColor: "{colors.sg-surface-raised}"
    textColor: "{colors.sg-text-primary}"
    typography: "{typography.sg-type-meta}"
    rounded: "{rounded.sg-radius-md}"
    height: "20px"
    padding: "0 7px"
  count-badge:
    backgroundColor: "{colors.sg-status-wait-fg}"
    textColor: "{colors.sg-text-on-accent}"
    typography: "{typography.sg-type-badge}"
    rounded: "{rounded.sg-radius-hair}"
    height: "12px"
    width: "15px"
---

# Design System: Overview

## Overview

**Creative North Star: "The Inhabited Survey"**

Overview is a measured plane that something lives on. The fleet of agent sessions sits on a 2:1 isometric lattice with a graticule at the stage edges. Each machine is a terrain island with its own monochrome ground texture. Each project is a flat plate at integer grid coordinates, laid out automatically in a two-column lot. Each session is a small grey pixel creature, generated from its session id, that works at its desk while it is needed and lives on the island when it is free. Survey precision still governs: coordinates, integer pixels and the lattice. Within it, terrain, a commons with benches and bridges carrying SSH latency give the owner a small world with lore. It still refuses the dashboard of cards and any colour that is not status.

Every colour, face, radius and duration comes from Signal (@barrymind/signal 0.1.1). Signal's core tokens (`--sg-surface-*`, `--sg-text-*`, `--sg-border-*`, `--sg-accent-*`, `--sg-status-*`, `--sg-font-*`) dress the chrome, and Signal's Overview extension (`--sg-overview-*`) dresses the plane: terrain, props, lattice, creature coats, slabs and textures. The build aliases them to short local names (`--bg`, `--panel`, `--wait` and so on), and the canvas reads them through `getComputedStyle` at boot. Overview owns layout, geometry and behaviour, not values. The density is that of an instrument panel: 13px body, 11px metadata, 24 to 40px bars and 12px insets. Everything stays quiet until something needs the owner. Then yellow appears in several places at once: on the map, at the stage edge, in the rail and in the status bar.

Colour carries meaning only. Four status hues name what a session is doing. A single periwinkle accent marks the owner's own hand: selection, focus, the primary action and a pressed filter. Everything else is graphite, down to the creatures' coats, the speech glyphs and the ball.

**Key Characteristics:**
- Signal 0.1.1 is the token source; Overview references `--sg-*` variables and owns none of the values
- 2:1 isometric projection, 16 x 8 px per grid unit at 1x, integer device-pixel zoom steps
- Machines as textured monochrome islands joined by latency-carrying bridges; projects in auto-laid-out two-column lots
- Seeded pixel creatures with a monochrome genome and an ambient life simulation that desk states override
- Mono for data, controls and the map; sans for human sentences
- Hairlines (1px) and small radii (2 to 6px); flat chrome, soft shadows only on floating overlays

## Colors

Signal graphite: near-black greys one step apart, with five hues that each mean exactly one thing. Values live in Signal; this section names the variables and their roles.

### Primary
- **Signal Periwinkle** (`--sg-accent-fg`, with `--sg-accent-bg` 12%, `--sg-accent-bg-hover` 20% and `--sg-accent-border` 60%): the owner's hand. It covers the focus ring (2px outline, 1px offset), the selected-card ring, the selected-row inset ring, primary-button border and fill, a pressed filter chip, the live-demo switch track and the corner brackets around the selected creature. Text selection uses `--sg-selection-bg`.

### Secondary (status)
- **Needs-You Yellow** (`--sg-status-wait-fg`, `-bg`, `-border`): the loudest colour. It marks the pixel diamond over a waiting creature, its ground ring, its callout border, its slab, edge markers, needs-you cards, the minimap diamond, the "needs you" section head and status item, and the count badge on island labels. It also colours the brief's numerals.
- **Failed Coral** (`--sg-status-err-fg`, `-bg`, `-border`): failed cards, the failed callout and slab crack, the failed section head and status item, and the minimap diamond.
- **Done Sage** (`--sg-status-done-fg`): the done slab, the done icon, section head and status item, a checked task box, the "agent moved on" hint, and the connected dot before each host.
- **Running Steel** (`--sg-status-run-fg`): the quietest status. It fills the running slab and nothing else on the plane. In the rail and status bar, running reads through its six-dot icon on Dim text.

### Neutral
- **Ground** (`--sg-overview-ground`): the stage floor around the islands.
- **Graphite Base / Panel / Well / Selected** (`--sg-surface-base`, `-raised`, `-sunken`, `-selected`): bars; rail, HUD, popovers, tooltips, toasts and callouts; inset controls, inputs, brief items and the minimap field; the selected row.
- **Hairline / Hairline Strong / Hover Edge / Control** (`--sg-border-subtle`, `-default`, `-strong`, `-control`): dividers; control borders and plate edges; hovered borders, plate hover and the hover bracket; the tracker input border.
- **Ink / Dim / Subtle / Faint** (`--sg-text-primary`, `-secondary`, `-subtle`, `-disabled`): the four text greys. Faint is reserved for the "$" prompt, asleep "z" marks, path previews and the mark's lower stroke, never for text the owner must read.
- **Hover washes** (`--sg-state-hover` 4% on rows and tasks, `--sg-state-hover-control` 6% on title, zoom, status and popover items).
- **Label Scrim** (`--sg-overlay-label`): the 86% graphite behind every map label.

### Terrain and props
- **Island** (`--sg-overview-terrain-island-top`, `-face-left`, `-face-right`, `-edge`): the slab each machine stands on, with two darker extruded faces and a 1px edge.
- **Commons** (`--sg-overview-terrain-commons`): the plaza below each island's lots, outlined in a 3px-dashed Ink line at `--sg-overview-opacity-commons-edge` (18%).
- **Bridge** (`--sg-overview-terrain-bridge-top`): reuses the island faces and edge; plank ticks use `--sg-overview-lattice-plate-tick`.
- **Bench** (`--sg-overview-prop-bench-top`, `-face-left`, `-face-right`, `-edge`): two per commons, drawn as iso boxes.
- **Plate** (`--sg-overview-plate`, `-plate-face-left`, `-plate-face-right`): the top and faces of a project plate.
- **Ground textures**: Ink dots, hatch or fine grid at `--sg-overview-opacity-texture-dots` (12%), `-hatch` (8%) and `-grid` (7%), one texture per machine, clipped to its island.
- **Lattice** (`--sg-overview-lattice-grid-minor`, `-grid-major`, `-survey-cross`, `-graticule-tick`): all Ink at low alpha over Ground.

### Creature and slab colours
- **Creature Ink** (`--sg-overview-creature-ink`) outlines every sprite and draws eyes, mouths and accessories; **Creature Shadow** (`--sg-overview-creature-shadow`) grounds it.
- **Coat ramps**, each four tones (shade, base, light, highlight) lit from the upper left: `--sg-overview-creature-pale-*`, `-lit-*` (the common "mid" coat, drawn twice as often), and `-dusk-*` for awake creatures; `-dim-*` for sleepers.
- **Slab marks**: `--sg-overview-slab-asleep-rim` (asleep slabs show only their end pixels), `-slab-run-cursor` (a moving pixel on a running slab), `-slab-err-crack` (a diagonal crack on a failed slab).

### Named Rules
**The Status-Only Colour Rule.** Hue is spent only on the four statuses and on the accent. Terrain, props, creatures, speech glyphs and the ball are graphite. If a new element is not a status and not the owner's own selection or action, it is grey.

**The Loudest Yellow Rule.** Needs-you yellow outranks everything. Only a waiting session gets the diamond, the ground ring, the hop, the edge marker and the island count badge; no other state may borrow those devices.

**The Signal Source Rule.** Every colour comes from a `--sg-*` variable. If a needed value is missing, add it to Signal's tokens and rebuild the package; do not write a literal into Overview.

## Typography

**Display Font:** none (Signal defines `--sg-type-display`; Overview does not use it)
**Body Font:** Instrument Sans (`--sg-font-sans`)
**Label/Mono Font:** JetBrains Mono (`--sg-font-mono`)

**Character:** A plain humanist sans for the few sentences a person reads (task titles, questions, brief items) and a calm mono for everything a machine says: names, paths, coordinates, commands, counts, controls and every label on the map. The canvas reads `--sg-font-mono` at boot so map labels match the chrome.

### Hierarchy
- **Headline** (`--sg-type-headline`, sans 500, 15px): the morning-brief title, the largest type in the product, with balanced wrap.
- **Title** (`--sg-type-title`, sans 500, 14px): the task title on a needs-you or failed card, with balanced wrap.
- **Body** (`--sg-type-body`, sans 400, 13px, 1.45): row and task titles, questions, toasts and the tracker input. **Body Strong** (`--sg-type-body-strong`) for tooltip and brief-item titles.
- **Body Small** (`--sg-type-body-small`, 12.5px): brief explanations in Dim and empty states in Subtle.
- **Code** (`--sg-type-code`, mono 12.5px): the command a session wants to run, wrapping anywhere, after a Faint "$".
- **Control** (`--sg-type-control`, mono 12px): buttons, tabs, filter chips, the breadcrumb, zoom values and card status lines.
- **Status** (`--sg-type-status`, mono 11.5px, tabular): the status bar.
- **Map Label** (`--sg-type-map-label`, mono 500, 11.5px): island names, with 400 Subtle sub-text. Plot labels use 11px; bridge "ssh" labels use 10.5px. Canvas sizes are multiplied by the device pixel ratio and rounded.
- **Meta** (`--sg-type-meta`, mono 11px, tabular): agent lines, ages, row summaries, graticule numbers, map callouts, popover rows and the minimap header.
- **Section** (`--sg-type-section`, mono 11px, 0.06em, uppercase): the heads of rail lists and popovers, always with the list's count ("needs you · 2").
- **Badge** (`--sg-type-badge`, mono 500, 10.5px): the waiting count on an island label.

### Named Rules
**The Mono-for-Machines Rule.** If the text is a name, path, coordinate, number, command or control, it is JetBrains Mono. Instrument Sans is for sentences a person reads.

**The Tabular Rule.** Every number that updates (ages, counts, zoom, coordinates, latency) uses tabular figures. Coordinates are zero-padded to two digits with a true minus sign (−08).

## Layout

The app is a three-row, two-column grid built on Signal sizes: a 40px title bar (`--sg-size-title-bar`), the stage filling the left with a 340px rail (`--sg-size-rail`) on the right, and a 24px status bar (`--sg-size-status-bar`). Hairlines separate every region. Safe-area insets pad the edges.

Stage overlays sit 12px from the stage edges (`--sg-overview-layout-hud-inset`). The zoom group sits top right as minus, level, plus, fit and "?", and "?" opens the legend-and-keys popover. The minimap sits bottom left (176 x 108px under an 11px header). Edge markers for off-screen waiting sessions are pinned 26px inside the stage edge, with a further 50px allowance horizontally, along the ray from the stage centre. There is no cursor readout, no scale bar and no always-on legend.

The rail holds a 34px tab bar (now, tasks with its open count, morning brief). The now tab adds a wrapping row of state filter chips above a scrolling body (padding 2px 12px 16px). List order puts attention first: needs you (cards), failed (cards), running, done, asleep. Empty groups are hidden unless filtered, except needs you, which always shows.

Spacing is a tight 2 to 16px rhythm on `--sg-space-*`: 4px inner, 6px between related items, 8px between siblings, 10 to 12px card padding and insets, 16px between list sections.

At 860px and below (`--sg-overview-layout-stacked-breakpoint`), the rail drops beneath the stage. Rows become 40px, 64vh of stage, an auto-height rail and 24px of status. The status bar drops its hosts, the breadcrumb drops its long tail, and the minimap shrinks to 132 x 81px with no title. When the islands cannot fit at a legible zoom (below 0.66x), the camera opens on the most urgent waiting session instead.

### The Map Grid
- **Projection:** 2:1 isometric. A grid point (u, v) lands at x = (u − v) x 16 x z, y = (u + v) x 8 x z (CSS px). Draw order is ground, lattice, bridges, islands, plates, then benches and creatures sorted back to front by u + v. The graticule draws next, then labels on top of it, then selection brackets.
- **Lattice:** minor lines every 1 u, major lines every 8 u, and a survey cross (3px arms) at every major intersection.
- **Graticule:** at the top and left stage edges, a 6px tick and a Meta label ("u 08", "v −16") in Subtle at every major line. Ticks are skipped within 60px of the left, 230px of the right, 34px of the top and 160px of the bottom, which keeps them clear of the zoom group and minimap.
- **Zoom:** levels are k / devicePixelRatio for k in {1, 2, 3, 4, 5, 6, 8}, kept between 0.3x and 4x. The wheel steps one level per 60 units. Pinch zooms freely and snaps on release. Fit picks the largest level that shows every island.

### Terrain layout
- **Islands:** one per machine, placed in two columns 6 u apart. Each island is 2 x (widest plate) + 4 u wide. Its slab is max(4, round(10z)) px thick.
- **Lots:** each machine's projects fill two columns, row after row, centred in their column, 4 u deep and 2 u apart. A plate is max(4, 2n + 2) u wide for n sessions, and desks sit 2 u apart from 1.5 u in. Placement is automatic; plates do not move.
- **Commons:** the rest of the island below the lots, inset 1 u, with two benches.
- **Bridges:** walkable strips joining horizontal neighbours (3 u above the shorter island's far edge) and vertical neighbours (at the island's centre line), max(2, round(3z)) px thick. Each carries a 10.5px "ssh · latency" label.

### Named Rules
**The Survey Rule.** Every plate stands at integer grid coordinates and is labelled with them. Terrain is ground the coordinates sit on, never decoration that hides them.

**The Integer Pixel Rule.** Creatures, terrain, plates and the lattice share one integer device-pixel scale. Never smooth a sprite or offer a zoom between levels.

**The Label Priority Rule.** Labels are placed in a fixed order: callouts first, island labels second, plot labels third, bridge latency labels last. Each tries its candidate spots in order and takes the first that is on screen (2px inset), clear of the HUD and of other labels by 7px, and, for plot labels, clear of other plates. Only callouts are forced on screen. Island labels drop their sub-text and then step aside. A plot label degrades from "n agents · coord" to the coordinate to the name alone. Any label that finds no spot is hidden.

## Elevation & Depth

The chrome is flat: surfaces sit one tonal step apart and are divided by 1px hairlines. The plane gets depth from projection, not lighting. Islands, bridges, plates and benches are extruded with two darker faces, creatures cast a translucent ellipse, and draw order follows iso depth. Only overlays floating above the stage carry a soft ambient shadow.

### Shadow Vocabulary
- **Tooltip** (`box-shadow: 0 6px 18px rgb(0 0 0 / 0.5)`, equal to `--sg-shadow-tooltip`): the hover and selection tooltip above a creature.
- **Toast** (`box-shadow: 0 8px 24px rgb(0 0 0 / 0.5)`, equal to `--sg-shadow-toast`): transient confirmations.
- **Popover** (`box-shadow: 0 10px 28px rgb(0 0 0 / 0.55)`): the "?" legend and status-bar lists. The build ships this literal, which does not match `--sg-shadow-popover`.
- **Creature shadow** (`--sg-overview-creature-shadow`, an ellipse half the sprite wide and 3 sprite px tall): grounds every creature.

### Named Rules
**The Flat Chrome Rule.** Bars, rail, cards, chips, rows and buttons are flat. A shadow appears only on something floating above the stage, and state is shown with rings, borders and washes, never lift.

## Shapes

Corners stay small and consistent, all on `--sg-radius-*`. The count badge takes 2px. Tags, keycaps, map labels, the focus ring, status items and popover rows take 3px. Controls, rows, tasks, HUD panels, tooltips, callouts, edge markers and the tracker input take 5px. Cards, filter chips, brief items, popovers and toasts take 6px. The switch track is a 12px-tall pill. Borders are 1px, except the keycap's 2px bottom and the selected rail tab's 2px Ink underline.

On the plane, form is the rhombus. Islands, commons, bridges, plates, the waiting ring (±0.85 u), the path-preview destination and minimap marks are all grid-aligned diamonds. The needs-you diamond is a pixel lozenge (rows 1, 3, 5, 7, 5, 3, 1). Selection is four 6px corner brackets 4px outside the creature, in accent when selected and Hover Edge when hovered.

## Components

### Buttons
Keycapped and quiet.
- **Shape:** 26px tall (`--sg-size-button`), 5px radius, 1px Hairline Strong border, Graphite Well fill, with a leading keycap showing its shortcut.
- **Primary:** accent border and accent fill. There is one per card: "Enter open in orca".
- **Plain:** no keycap and symmetric 8px padding, used for "tracked", "track" and brief "locate".
- **Hover / Focus:** the border shifts to Hover Edge (primary: fill to `--sg-accent-bg-hover`) in 80ms (`--sg-duration-fast`). Focus is the global 2px accent outline.
- **Title-bar button:** borderless, 24px tall, Dim, with a 6% wash on hover. The live-demo switch slides in 140ms.

### Chips
- **Filter chip:** 26px, 6px radius, 1px Hairline border, a status icon, a bold count and the state name in Control mono. Hover moves the border to Hairline Strong. Pressed takes the accent border and fill. A zero-count chip goes Subtle. Pressing a chip filters the now list to that state; pressing it again clears the filter.
- **Sample tag:** 1px Hairline border, 3px radius, Subtle 11px mono. Prototypes always carry it.
- **Keycap:** Signal's keycap: 11px mono, a Hairline Strong border with a 2px bottom, 3px radius, Graphite Well.

### Cards / Containers
- **Attention card** (needs you and failed only): 6px radius, `--sg-status-wait-border` and `-bg` (failed: the `err` pair), 10 x 12px padding and a 6px gap. It shows the title, then a Meta line with the creature's name, agent and host:project. Next comes a status line in the status colour with icon and age, then the command (Code), question (Body) or failure summary, then actions. Selected, a 2px accent ring replaces the border.
- **Brief item:** 6px radius, Hairline border, Graphite Well, a yellow mono numeral beside a Body Strong title and a Body Small explanation, plus locate and track actions.
- **Popover:** Graphite Panel, Hairline Strong border, 6px radius, 6px padding, 240 to 320px wide, with Section heads. The "?" legend explains each state in behaviour terms ("hopping under a diamond: needs you") and lists the keys. Status lists show one 3px-radius row per session: icon, title, age, then "project · name · activity".

### Inputs / Fields
- **Tracker input:** 30px tall, 5px radius, a 1px `--sg-border-control` border, Graphite Well fill, Body text and a Subtle placeholder. Focus swaps the outline for an accent border.
- **Task checkbox:** 16px, a 1.5px Hover Edge border and 4px radius, turning to Ink on hover. When checked, it fills with Done Sage and shows a check drawn in `--sg-text-on-accent`.

### Navigation
- **Rail tabs:** mono 12px Subtle, 16px apart. Hover and selected go Ink, and the selected tab gains a 2px Ink underline on the divider. The tasks tab carries its open count.
- **List rows:** 14px icon, title, right-aligned age, and a Meta line beneath with "project · name · summary". They take a 5px radius and a 4% wash on hover, and when selected, Selected Row fill with a 1px accent inset ring.
- **Tasks (tracker):** rows divided by hairlines, each a checkbox, title, age and a Meta line. A remove control appears on hover or focus. The tracker only tracks and never writes to an agent. Waiting and failed sessions become tasks automatically. When the agent moves on, a Done Sage hint reads "agent moved on · mark done". Done tasks strike through in Subtle.
- **Status bar:** interactive 22px items with 3px radius and a 6% wash on hover or open. From the left: "overview" (fits everything), needs you (yellow; jumps to the next waiting agent), failed (coral, only when non-zero), running, done (sage) and asleep. All but needs you open a list popover. Hosts sit at the right, each led by a 6px sage dot and followed by its latency, and each flies the camera to its island.

### Stage HUD
- **Zoom group:** one 5px-radius Graphite Panel with 28px cells divided by hairlines: minus, the level ("2×"), plus, fit and "?".
- **Minimap:** the same projection fitted to the islands. Islands show in Commons, plates in `--sg-overview-minimap-plate`, and wait and failed sessions as 4px diamonds, over a Graphite Well field. The viewport is a 1.5px Dim rectangle. The header shows "n need you" in yellow or "clear". Click or drag to jump.
- **Edge marker:** a 24px Graphite Panel chip with a `--sg-status-wait-border` border, a yellow diamond, the plot name in yellow, the age and a Dim arrow rotated toward the session. On hover it takes `--sg-overview-wait-wash-hover`. Clicking glides to the session.

### Map Labels and Callouts
- **Map label:** 18px tall, 3px radius on Label Scrim, 5px side padding, the name in Ink 500 and sub-text in Subtle after a 6px gap. Island labels ("macbook local · 5 agents") carry a Hairline Strong border and a yellow count badge when sessions wait. Plot labels read "name 4 agents · 01·08" (just the coordinate below 1.5x) and gain a border on hover. Bridge labels read "ssh 14 ms".
- **Callout:** 20px tall, 5px radius, Graphite Panel, a 1px border in the status colour at 70% and Meta text in Ink, at most 20 characters, for waiting and failed creatures. Above the creature it has a 4px pointer; beside it, a leader line at 60%.

### Creatures (signature)
Monochrome pixel blobs in three base silhouettes (droplet for claude, cube for codex, twin lobes for gemini). Each is rendered once per state into a cached sprite and scaled only by whole pixels.
- **Genome:** seeded from the session id. It sets height (0.76 to 1.24x) and width (0.84 to 1.2x), and a coat (pale, mid or dusk; asleep always uses the dim ramp). It sets a pattern (none, spots, belly, band, freckles), an accessory (none, sprout, antenna, cap, horns, tuft), eyes (dot, wide, sleepy, odd) and a mouth (none, smile, o). It also gives a two-syllable name (shown in the rail, tooltips and lists) and personality traits: social, energy, curious and sleepy.
- **Shading:** a 1px Creature Ink outline and four bands from the coat ramp, lit from the upper left. The bottom two rows always shade.
- **Faces:** eyes blink (0.12s every 3.8s), with happy arcs when done and resting, crosses when failed at the desk, and closed lines when asleep or napping. A failed creature melts into a flat silhouette at its desk.
- **Slab:** a five-row lozenge (2, 6, 10, 6, 2 sprite px) at chest height in front-right, shown only at the desk. It is filled in the status colour (run 80%, wait and err 95%, done 55%) or, when asleep, only rimmed.
- **Life:** running, waiting and failed creatures walk to their desk and stay there. Done creatures choose by personality to wander, hang out at the commons, chat, play ball, visit another island over a bridge, nap by a bench or check their desk. Asleep creatures sleep by a bench. Paths are A* over walkable cells; desk-bound creatures move at 2.4 cells/s and free ones at 1.3, both times energy. The selected or hovered creature shows its path as Faint dots with a Faint rhombus at the destination.
- **Ambient devices:** a chat shows a 9 x 9 sprite-px speech bubble (Hairline Strong outline, Graphite Panel fill) with a Dim 5 x 5 pixel glyph (dots, heart, ?, note, star, !) that fades in and out over 1.4s, alternating between partners. Ball is a 2 x 2 Subtle pixel arcing between two creatures. Asleep creatures emit fading Faint "z" marks.
- **Motion:** waiting creatures hop up to 4px (0.8s) under a diamond that flickers 1 sprite px at 2Hz. Running creatures bob 1px three times a second and tap their slab. Walkers bob with their energy.
- **Reduced motion:** the simulation settles instead of running. Desk states sit at their desks, done creatures stand in the commons, and sleepers lie by their bench. Hops, bobs, bubbles, "z" marks and camera easing stop, and the frame redraws every 400ms.

### Motion
Camera moves ease exponentially toward their target at a rate of 10 per second. Tab glides to the next waiting agent, and `l` (or Space on a focused row) glides to the selected agent; either raises the zoom to the first level at or above 1.5x if it is lower. After a glide, the camera follows the creature while it walks and lets go once it has stopped and 4s have passed. Hover changes take 80ms, the switch 140ms and the toast 220ms in and out. Under reduced motion, transitions are removed.

## Do's and Don'ts

### Do:
- **Do** reference every colour, face, radius and size through a `--sg-*` variable, and add missing values to Signal rather than to Overview.
- **Do** keep plates at integer grid coordinates in their auto-laid-out lot and label them with their coordinate (`01·08`).
- **Do** keep zoom on the integer levels (k / devicePixelRatio, k in 1 to 8) and draw sprites with image smoothing off.
- **Do** reserve yellow for sessions that need the owner, and give every waiting session all of its signals: diamond, ring, callout, edge marker when off screen, card in the rail and island count badge.
- **Do** keep callouts to 20 characters or fewer and say why the hand is raised ("run pnpm db:migrate?").
- **Do** keep ambient life (speech glyphs, ball, "z" marks, path previews) in neutral greys and let it fade, so status always reads first.
- **Do** let desk states override the simulation: a session that needs the owner, runs or fails goes back to its desk.
- **Do** give every creature on the map a matching row or card in the rail.

### Don't:
- **Don't** write a literal colour or font into Overview when a Signal token exists.
- **Don't** colour terrain, props, creatures or ambient devices; only statuses and the owner's own selection or action carry hue.
- **Don't** let terrain textures or props compete with the lattice and labels; textures stay at or below 12% Ink.
- **Don't** smooth, rotate or fractionally scale creature sprites.
- **Don't** add drop shadows or lift to bars, cards, chips, rows or buttons; only floating overlays above the stage get a shadow.
- **Don't** set readable text in Faint; it is for the "$" prompt and ambient marks only.
- **Don't** let the tracker act on an agent; it only tracks.
