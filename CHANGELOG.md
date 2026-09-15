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
- **Telemetry, from real numbers only.** The selected earthquake gets a
  modelled felt extent drawn on the map, a depth scale in the panel, and
  direction vectors to its neighbours that now carry how related the
  engine judged each one to be.
- The felt extent is the MMI 4 contour from Allen, Wald and Worden (2012)
  intensity attenuation for active crustal regions, in its hypocentral
  distance form, which is the one meant for real-time use where no
  rupture geometry is known. Coefficients are transcribed from the GEM
  OpenQuake implementation, not written from memory. It is drawn as an
  ellipse because a constant ground radius is not round on this
  projection, dashed so it never reads as a surveyed boundary, and it is
  not drawn at all when the model has nothing to say: below MMI 4, deeper
  than 70 km, or missing a magnitude. The panel names the model and what
  it leaves out.
- No seismogram. A simulated waveform would be an invention, and an
  instrument that invents its own signal is worthless. Real waveforms
  come from a separate USGS endpoint and belong to Stage 3.
- **Palette cut to four category colours**, per PLAN section 4.1: amber
  `#ffb000` for earthquakes, coral `#ff4d2e` for fires, a desaturated
  magenta `#d94fa8` for volcanoes, and one cold blue `#6ec6d9` for
  storms, floods and ice. The residual kinds take a neutral grey step
  rather than a fifth colour. A seismograph does not glow; emphasis lives
  in the map and the telemetry lines, not in the palette.
- **Shape is now a second channel.** Every marker was a circle, so colour
  carried the category alone. Markers are silhouettes: circle for quakes,
  diamond for fires, triangle for volcanoes, square for storms and
  floods, hexagon for ice, ring for the residual. The filter bar, the
  panel chip, the near list and the trail use the same silhouettes.
  Measured: all five colours clear WCAG AA against the background, and
  under deuteranopia the magenta and the grey fall to a CIEDE2000
  distance of 9.5, which is why the shape is not decoration.
- **Keyboard navigation.** The map is one tab stop rather than one per
  event, because hundreds of markers in the tab order would be unusable.
  Focusing it lights a marker; arrow keys move to the nearest event in
  that direction on screen; Enter or Space opens it. The camera follows
  focus, moving only when the target would otherwise be off screen and
  keeping the reader's zoom. Focus is drawn as corner brackets, distinct
  from the selection's ring and crosshair. The "what else is near this"
  list and the trail are tab stops in their own right and open on Enter
  or Space. `R` and `Escape` are unchanged.
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

### Stage 1.5 — UX, navigation, resilience — GATE IN PROGRESS

Every item on the Stage 1.5 task list in PLAN.md §8 has landed:

- [x] Pan and zoom on the SVG viewBox, and smooth framing on selection
- [x] `state.activeFilters` and a filtered render
- [x] Category buttons and counts in the top bar
- [x] Impact ring, direction vectors and the depth scale
- [x] `localStorage` stale-while-revalidate with a HUD warning
- [x] Mobile bottom sheet
- [x] Keyboard navigation for the markers and the neighbour list
- [x] Palette cut to the four colours of PLAN §4.1
- [x] This changelog

Two things the list did not ask for came with the work and are recorded
so they are not mistaken for scope that arrived from nowhere: the camera
takes the shape of its element rather than a fixed 2:1, without which
closing the mobile sheet revealed black rather than map; and the
graticule subdivides with the camera, without which a zoomed view was an
empty field.

**First gate finding (touch targets).** On a phone the markers were very
hard to hit. The Stage 1 clog had not gone, it had moved: from "which one
do I pick" to "I cannot pick any". The cause was scale. Marker size
carries magnitude, so a small event is a few pixels across, while a
fingertip is about 44pt. Those were targets designed for a mouse.

Fixed without changing anything the reader sees. Every marker now carries
an invisible target of at least 44pt, and which marker a tap selects is
decided by distance to the centre rather than by which invisible circle
happened to be drawn on top. A tap that lands just off a marker still
finds the nearest one within reach.

Reach is set by the pointer that made the gesture, not by the device, so
a touch laptop is forgiving under a finger and precise under a mouse: 22
pixels for a finger or a pen, which is exactly the 44pt target, and 12
for a mouse, which is roughly what the desktop already had. One number
rather than two: snapping to the nearest marker within reach *is* the
44pt target, with overlaps resolved by centre distance.

**The rest of the gate test has not been run, and cannot be run from
here.** It asks
whether, on a phone and on a desktop, clicking an earthquake focuses the
map smoothly, whether the felt ring and the neighbouring events read at a
glance, whether the filters respond without lag, and whether the whole
thing can be driven from the keyboard. That is a question about a real
browser on real data, and the sandbox this was built in cannot reach
usgs.gov or nasa.gov.

Everything here was verified against mocked feeds in headless Chromium:
230 checks across eight suites, covering gestures and their boundaries,
filter and cache behaviour, the sheet detents, keyboard roving, the
palette and its measured contrast, touch targets under a simulated
finger, and the intensity model with all four of its refusal branches.
What none of that can tell you is whether the thing is good to use; the
touch-target finding above is exactly what a real phone told us and no
amount of headless testing had.

### Stage 2 — Publish and distribution
_Not started._
