# Changelog

All notable changes to this project, plus stage test results, are
recorded here. See [PLAN.md](PLAN.md) for the stage gates.

## [Unreleased]

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
_In progress._

### Stage 2 — Publish and distribution
_Not started._
