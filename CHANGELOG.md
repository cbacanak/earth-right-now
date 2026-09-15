# Changelog

All notable changes to this project, plus stage test results, are
recorded here. See [PLAN.md](PLAN.md) for the stage gates.

## [Unreleased]

### Added — Stage 1.5

- **Pan and zoom.** The SVG viewBox is the camera: wheel zoom anchored
  under the cursor, drag to pan, two-finger pinch, double-click in and
  shift double-click out. The camera is clamped inside the world rect on
  every edge and runs from the whole world down to 2 degrees across.
  Selecting an event eases the camera onto it and its neighbours; a feed
  refresh re-selecting the same event deliberately does not. Strokes,
  labels and marker radii are counter-scaled so they keep a constant size
  on screen, and the graticule subdivides with the camera.
- **Category filters.** `ALL · QUAKES · FIRES · VOLCANOES · STORMS · CRYO`
  in the top bar, each with a count of currently loaded events. From the
  everything view the first click on a category solos it; after that
  clicks add and remove. Switching the last one off returns to ALL.
- Filtering narrows discovery, not just the picture: the "what else is
  near this" list and "show me something" both draw from the active
  categories only. Switched-off events stay on the map, dimmed rather
  than deleted, so the surrounding context is not lost.
- **Mobile bottom sheet.** Below the breakpoint the detail panel stops
  being a column under the map and becomes a sheet over it, at three
  detents: closed (a 46px handle), half (title and facts), full (the
  neighbour list as well). The map takes the whole area underneath, so
  closing the sheet really does hand the map the screen. Picking an event
  brings a closed sheet up to half; clearing the selection closes it.
  The handle is a real button, reachable by tab, and a closed sheet is
  taken out of the tab order. Desktop is untouched.
- The camera now takes the shape of its element instead of a fixed 2:1.
  A camera locked to the world's proportions sat in black bands on a
  portrait phone, so closing the sheet would have revealed nothing but
  more black. The whole-world view on a portrait screen still letterboxes,
  which is the right trade.
- **Offline cushion.** Each source keeps its own timestamped snapshot in
  `localStorage`. A snapshot paints the map immediately on load and is
  replaced the moment the network answers; if the network never answers,
  the snapshot is what stays on screen and the HUD says
  `showing cached data (Xm ago)` in amber text. Feed dots read `cached`
  in words as well as colour, so the state does not depend on telling
  amber from green. The two sources are independent: one dead feed never
  takes the other down.
- Snapshots expire after 24 hours and are then discarded rather than
  shown. A USGS snapshot older than a day means the newest quake on
  screen is already a day old, and a map that looks live but is not is
  worse than an empty one.

### Removed

- The category legend in the bottom-left corner of the map. The filter
  bar carries the same counts and can act on them.

### Added (continued)

- A selection survives its own category being switched off. It stays
  selected and fully lit, the panel marks it "filtered out", and its
  neighbourhood is recomputed against the narrowed pool.

### Fixed

- Taking pointer capture on `pointerdown` retargeted the following
  `pointerup` to the SVG root, so the browser reported the click on the
  root rather than the marker and event selection stopped working.
  Capture is now taken only once a gesture is definitely not a click.

### Added
- Stage 1 prototype: grid map (equirectangular SVG, no coastlines),
  USGS M2.5+ 7-day feed, NASA EONET open events (fires, volcanoes,
  storms with tracks, ice, floods, other)
- Click an event for detail plus "what else is near this": related
  events ranked by distance and time proximity, drawn as links on the map
- "Show me something": random pick from the same engine, preferring
  events that lead somewhere
- Trail of visited events, shareable URL hash, per-feed status with
  retry and stale marking, auto-refresh every 5 minutes
- README.md as the entry point to the project
- PLAN.md with product plan, data sources, architecture, and stage gates
- CHANGELOG.md for stage test results and notable changes

## Stage test results

### Stage 1 — Mechanic — PASSED (15 Sep 2026)

Gate question: *do you want to move from one event to the next?*

**Answer: yes.** The mechanic holds. But dense clusters in the Pacific
and Mediterranean basins make individual events hard to pick, and the
absence of category filters clogs the exploration flow. Both findings
are what Stage 1.5 exists to fix; see PLAN.md §1.

### Stage 1.5 — UX, navigation, resilience
_In progress._ Pan and zoom, category filters, the offline cushion and the
mobile sheet are in; keyboard navigation and telemetry are not. The gate
test has not been run.

### Stage 2 — Publish and distribution
_Not started._
