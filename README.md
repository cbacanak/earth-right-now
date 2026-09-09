# Earth right now

An interactive map of what is happening on Earth — and on the internet
— right this second.

Live feeds, plotted and streamed. Click an event and ask the only
question that matters: **what else is near this?**

## Status

Pre-prototype. Nothing is built yet.

## Plan

Everything — data sources, architecture, phases, design language,
rejected options and the reasoning behind each — is in
[PLAN.md](PLAN.md).

**Read PLAN.md before writing code.** It is the single source of truth;
this README is only an entry point.

Two rules matter most:

1. **Nothing outside PLAN.md gets built.** New layers and ideas go to
   the "Sonraki tur" section, not into the code.
2. **Stage gates are real.** Each stage has a stop test. Scope creep is
   the single biggest risk here — ten feeds and a time machine turn a
   weekend into six months.

## Current stage

**Stage 1 — the mechanic.** Two sources only: NASA EONET and USGS. No
API keys, no server, no database. Map, event detail, "what's near this",
and a random "show me something".

The whole question: while playing with it yourself, do you want to move
from one event to the next?

If not, stop. Ten feeds will not save a mechanic that does not work.

## Log

Stage test results go in [CHANGELOG.md](CHANGELOG.md).
