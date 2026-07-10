# RPP Fallback Road Line — Design Spec

## Purpose

When an RPP has no entry/exit points, draw orange connection line from RPP marker directly to nearest road segment. Helps editors visually assess road proximity even for RPPs missing navigation data.

## Current Behavior

Orange dashed line only drawn from entry points → nearest road. RPPs without entry points show nothing.

## Desired Behavior

| Entry points exist? | Line drawn |
|---|---|
| Yes | Entry point → nearest road (unchanged) |
| No / empty array | RPP marker → nearest road (new) |

Orange dot at road endpoint always included, matching current `ROAD_DOT_STYLE`.

## Implementation

Single file: `WME_RPP_Visualizer.js`, within `buildAnnotationFeatures`.

### New helper: `addRoadConnection`

Extract entry point → road drawing into reusable function:

```
addRoadConnection(sourcePoint, venueId, features, segments)
```

- Calls `findNearestRoadPoint(sourcePoint, segments)`
- If nearest found, pushes to `features`:
  - Orange dashed LineString: `ROAD_LINE_STYLE`
  - Orange dot at endpoint: `ROAD_DOT_STYLE`

### Existing loop modified (lines 279-318)

Replace inline road-line creation with `addRoadConnection(entryPoint, venueId, features, segments)`.

### New fallback block

Insert after entry point block:

```
if (showLines && (!entryPoints || entryPoints.length === 0) && segments.length > 0)
    addRoadConnection(rppPoint, venueId, features, segments)
```

This handles both `undefined` and empty-array cases.

## Visual Elements

Unchanged from existing `ROAD_LINE_STYLE` / `ROAD_DOT_STYLE`:
- Line: `#FF9800`, 2px, dashed, opacity 0.7
- Dot: `#FF9800`, radius 4, white stroke

## No Changes To

- Sidebar UI, zoom thresholds, labels, entry point dots, RPP→entry blue lines
- `findNearestRoadPoint` algorithm
- Refresh/debounce cycle
- Preferences/settings
