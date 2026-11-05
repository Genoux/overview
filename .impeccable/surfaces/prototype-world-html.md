---
version: 1
slug: "prototype-world-html"
primary_target: "prototype/world.html"
related_targets: []
---

# Surface brief: the map (prototype/world.html)

Scope: Overview's main screen. Mode: Operate (a working monitor the owner opens during the day, pans, then returns to Orca).

Audience and job: the owner, glancing across every agent session on three machines to find what needs them, what is running and what finished. Task: spot the raised hands, read why, jump to the session.

Content and proof: sample sessions using the owner's real project names, labelled as sample data. No invented product claims.

Constraints (owner, 2026-11-05): isometric; a metric grid, not a fictional world or scenery; projects placed at positions on the grid; free pan and zoom; monochrome, in the spirit of Hangar's Signal theme but not Hangar's container/zone layout.

Memorable moment: a waiting agent off-screen still pulls you to it. Its yellow marker clings to the stage edge, and Tab glides the camera to it.

Unresolved: whether plot positions mean something (for example, recency) or are just where the owner puts them. v1 lets the owner drag plots and snaps them to the grid.

## Direction contract

THESIS: The fleet is surveyed, not illustrated: one isometric measured plane with a graticule, projects as plots at grid coordinates, sessions as small grey creatures standing on them. It refuses both the dashboard-of-cards and the game-world diorama.

OWN-WORLD: Signal graphite. Ground #1c1d1f; isometric hairline lattice (minor 1 u, major 8 u), graticule numbers at the viewport edges in JetBrains Mono; plots are flat plates (#232426, 1px #424345 edge) with a lowercase mono name and coordinate. Creatures are monochrome grey gel pixel blobs (droplet, cube, twin lobes). Colour exists only as status: yellow diamond for needs you (the loudest thing), red failed, muted green done, blue-grey running. Instrument Sans for prose; hairlines and radii of 3 to 6 px.

STORY: Open, see three machine districts on the plane, see two yellow markers, Tab to the first, read its command in the rail, open it in Orca.

FIRST VIEWPORT: 40px title bar (breadcrumb "overview · 11 agents on 3 machines", sample tag, Ctrl K). The stage fills the left; a 340px right rail holds the attention list (needs you cards, then running, done, failed, asleep) with a "now / brief" tab. The stage overlays: zoom group top right, minimap bottom left, cursor coordinates and scale bar bottom right, edge markers for off-screen waiting agents. 24px status bar with counts and hosts.

FORM: Pinned by the owner (isometric metric grid in Signal monochrome); position 1 of 1. seed: none (direction pinned by owner, concept-seed not run).

Signature interaction: drag to pan, wheel or pinch to zoom in integer pixel steps, Tab glides to the next waiting agent, edge markers point to off-screen ones, plots drag and snap to the grid.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
