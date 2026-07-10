# WME RPP Visualizer — Design Spec

## Purpose

A WME userscript that adds persistent street number labels, entry point indicators, and connection lines for Residential Point Places (RPPs) without requiring the user to select each RPP individually.

## Data Source & Filtering

- Read all venues from `W.model.venues.getObjectArray()` (WME SDK pattern used by INSPIRE script)
- Filter for `attrs.residential === true`
- For each residential venue, extract:
  - Geometry (location point) via `attrs.geometry`
  - `attrs.houseNumber` (street number label)
  - `attrs.entryExitPoints` or `attrs.navigationPoints` (entry/exit dots, each with `_point` or `point` or `position` in WGS84)
- Per `zoomend`/`moveend` event: refilter to only RPPs whose geometry intersects the current viewport bounds

## Visual Elements

Three elements rendered as OpenLayers vector features, all with zoom-dependent visibility:

| Element | OL Feature Type | Min Zoom (default) | Style |
|---------|----------------|-------------------|-------|
| Street number label | Point with label style | 8 | Bold black text on white outline, offset -20px above RPP point |
| Entry point dot | Point (circle) | 10 | Green filled circle (5px), white stroke |
| RPP → Entry line | LineString (dashed) | 10 | Dashed blue line, 2px |

- All elements are read-only overlays (no edit interaction)
- Zoom thresholds are adjustable via settings panel (persisted to localStorage)

## Zoom Behavior

Three states based on zoom level and master toggle:

| Master Toggle | Zoom Level | What's Visible |
|:---:|---|---|
| OFF | Any | Nothing |
| ON | < 8 | Nothing |
| ON | 8–9 | Street number labels only |
| ON | ≥ 10 | Labels + entry dots + connection lines |

Zoom thresholds are user-configurable (defaults: 8 for labels, 10 for dots/lines).

## UI

### Sidebar Tab Panel (replaces floating button + panel)

- Registered via `W.userscripts.registerSidebarTab('RPP')` following INSPIRE script pattern
- Tab label shows "RPP" in the WME sidebar

Panel content:
- **Header:** "RPP Visualizer" title + version number
- **Enable toggle:** Checkbox "Näytä RPP-tiedot" — master enable/disable. Unchecking clears all annotations.
- **Settings section (grey background):**
  - "Näytä numerot zoom:" — number input, default 8. Labels visible at this zoom level or higher.
  - "Näytä viivat zoom:" — number input, default 10. Dots and lines visible at this zoom level or higher.
- **Stats:** Live RPP count — "X RPP näkyvillä", updated on every map move/zoom
- **Debug toggle:** Small checkbox at the bottom

## Architecture

### Layer Structure
Single `OpenLayers.Layer.Vector` containing all annotation features. Layer visibility is toggled via the master toggle. Features are added/removed on each pan/zoom event based on viewport intersection + zoom level.

### Event Flow
1. Toggle ON → trigger full refresh (iterate venues → build features → add to layer)
2. `zoomend` → clear layer → rebuild features for current zoom + viewport
3. `moveend` (debounced 50ms) → refresh features if toggle ON
4. Toggle OFF → clear all features, remove layer

### State Persistence (localStorage)
- `wme-rpp-visualizer-enabled` (boolean)
- `wme-rpp-visualizer-label-zoom` (number, default 8)
- `wme-rpp-visualizer-line-zoom` (number, default 10)
- `wme-rpp-visualizer-debug` (boolean)

### Loading Sequence
1. Wait for `W.userscripts.state.isReady` or `wme-ready` event
2. Load persisted settings
3. Create sidebar tab with panel
4. If previously enabled, trigger initial render

## Files
- Single file: `scripts/WME_RPP_Visualizer.js`
- Follows existing project metadata block pattern (`@match`, `@grant`, `@version`, etc.)

## Out of Scope (v1)
- Editing RPP data (read-only visualization)
- External data sources (all data from WME model)
- RPP polygon rendering (only point-type RPPs)
- Color customization (hardcoded defaults)
