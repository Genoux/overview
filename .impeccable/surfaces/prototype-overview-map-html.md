---
version: 1
slug: "prototype-overview-map-html"
primary_target: "prototype/overview-map.html"
related_targets: []
---

# Surface brief: the map (prototype/overview-map.html)

Scope: Overview's main screen. Mode: Operate (a working monitor the owner opens during the day, pans, then returns to Orca).

Audience and job: the owner, glancing across every agent session on three machines to find what needs them, what is running and what finished. Task: spot the raised hands, read why, jump to the session.

Content and proof: sample sessions using the owner's real project names, labelled as sample data. No invented product claims.

Constraints (owner, 2026-11-05): isometric; a metric grid, not a fictional world or scenery; projects placed at positions on the grid; free pan and zoom; monochrome, in the spirit of Hangar's Signal theme but not Hangar's container/zone layout.

Memorable moment: a waiting agent off-screen still pulls you to it. Its yellow marker clings to the stage edge, and Tab glides the camera to it.

Unresolved: whether plot positions mean something (for example, recency) or are just where the owner puts them. v1 lets the owner drag plots and snaps them to the grid.

## Recorded adaptations

- Rail order puts failed second, after needs you (PRODUCT.md principle 1, attention first).
- The title bar has a live-demo toggle and no Ctrl K hint: the prototype has no command palette, so a dead shortcut would mislead.
- Plates keep the contract tokens (#232426, edge #424345) and add two extruded side faces (#18191b, #131415) so plates read as objects on the plane.
- Zoom steps are integer device-pixel scales (1 to 8 device px per sprite pixel), so creatures and plates always share one scale.
- Waiting and failed creatures carry a callout of 20 characters or fewer (Hangar floor rule), so the map says why a hand is raised.
- Labels are placed by collision avoidance. Callouts come first, then machine labels, then plot labels. A plot label that finds no clear spot is hidden until the reader zooms in, and a plate whose centre is off screen gets no label. The owner chose "Hide until zoomed in" for phones (2026-11-05); the rail lists every project regardless.

## v3 changes (owner requests, 2026-11-05)

- Terrain: each machine is an island with its own monochrome ground texture (dots, hatch, fine grid). Projects are laid out automatically in two-column lots, which replaces dragging plots (the owner found free placement "random", "not organized"). Each island has a commons with benches. Bridges join islands and carry the SSH latency.
- Creature life: an isolated simulation. Working, waiting and failed agents stay at their desks. Done agents wander, hang out, chat (pixel glyph bubbles), play ball, visit other islands, nap, and check their desk. Asleep agents sleep by a bench. Pathfinding is A* on the walkable cells.
- Creature genome: seeded from the session id. It sets size and shape, a grey coat, pattern, accessory, eyes, mouth, a generated name, and personality traits that drive the choices above. Everything stays monochrome.
- Removed: the scale-bar readout ("what's that?") and the always-on legend, which moved behind a "?" popover.
- The status bar is interactive. waiting jumps to the next one; running, done, failed and asleep open a list; a host name flies to its island; overview fits everything.
- The rail adds state filter chips and a tasks tab. It is a tracker the owner checks off; it only tracks and never writes to an agent (owner's choice). Waiting and failed sessions become tasks automatically, and brief items have a track button. When the agent moves on, the task shows "agent moved on · mark done".
- Colours and faces now come from Signal (@barrymind/signal 0.1.1, vendored in prototype/vendor/signal). The map aliases them and the canvas reads them at boot.
- Machine labels are optional: when no spot fits, they step aside rather than cover a callout.

## Direction contract

THESIS: The fleet is surveyed and inhabited: an isometric measured plane with a graticule, where each machine is a terrain island, each project is a plot at grid coordinates, and each session is a small grey creature that works at its desk and lives on the island when it is free. The owner's v3 words ("a little universe with lore", "more terrain") replace the v2 refusal of scenery. It still refuses the dashboard of cards and any colour that is not status.

OWN-WORLD: Signal graphite from @barrymind/signal: core tokens plus the Overview extension (terrain, props, coats, lattice, textures). Ground is overview-ground. Islands are flat slabs, each with its own monochrome ground texture (dots, hatch or fine grid), a commons with benches, and bridges that carry the SSH latency. Plots are flat plates with a lowercase mono name and coordinate. Creatures are monochrome grey gel pixel blobs (droplet, cube, twin lobes), generated from a seeded genome. Colour is only status (yellow diamond loudest, red failed, muted green done, blue-grey running) and "you" (accent). Ambient life (speech glyphs, ball) stays in neutral greys and fades. Instrument Sans for prose and JetBrains Mono for machines; hairlines; radii of 2 to 6 px.

STORY: Open, see three machine districts on the plane, see two yellow markers, Tab to the first, read its command in the rail, open it in Orca.

FIRST VIEWPORT: A 40px title bar (breadcrumb "map · 11 agents on 3 machines", sample tag, live-demo switch). The stage fills the left, with the edge graticule, the zoom group plus "?" legend top right, the minimap bottom left, and edge markers for off-screen waiting agents. A 340px rail holds tabs (now / tasks / morning brief) and state filter chips. A 24px interactive status bar reads needs you, failed, running, done and asleep, then the hosts. Phones open on the most urgent agent at a readable zoom.

FORM: Pinned by the owner (isometric metric grid in Signal monochrome); position 1 of 1. seed:da769cda4e990a03 (roll run after the owner pinned the direction; the pin governs).

Signature interaction: drag to pan; wheel or pinch to zoom in integer device-pixel steps; Tab glides to the next waiting agent and `l` to the selected one, and the camera follows it while it walks; edge markers point to off-screen ones; status-bar items focus or list; creatures live on their own (wander, chat, ball, visit, nap) while desk states pull them back.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
