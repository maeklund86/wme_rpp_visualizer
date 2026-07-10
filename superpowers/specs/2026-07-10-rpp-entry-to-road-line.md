# RPP Entry Point → Nearest Road Line — Design Spec

## Purpose

Add a visual line from each entry point dot to the nearest point on the closest road segment. Helps editors verify whether an RPP entry point actually lands on a road, or needs adjustment.

## Data Source

- Road segments from `W.model.segments.getObjectArray()` (WME SDK, same pattern as venues)
- Filter to segments intersecting current viewport bounds for performance
- All segment types included (any road, no type filter)

## Algorithm

For each entry point (already computed in `buildAnnotationFeatures`):

1. Get entry point's projected coordinates (already in map projection after EPSG:4326 transform)
2. Iterate viewport-visible segments, for each:
   - Get segment geometry (LineString from `segment.geometry`)
   - Compute minimum distance from entry point to the LineString
   - Track closest segment and nearest point on its geometry
3. Draw dashed line from entry point to that nearest point

### Point-to-LineString Distance

Walk each pair of consecutive vertices in segment geometry. For each sub-segment:
- Compute perpendicular projection of entry point onto the segment line
- If projection falls within segment bounds, use perpendicular distance
- If outside bounds, use distance to nearest endpoint
- Keep minimum across all sub-segments

This handles curved roads (multiple vertices) and returns the exact closest point, not just a node.

## Visual Elements

| Element | OL Feature Type | Style |
|---------|----------------|-------|
| Entry → Road line | LineString (dashed) | Orange (`#FF9800`), 1.5px, dashed, opacity 0.7 |

New style constant `ROAD_LINE_STYLE` distinct from existing `LINE_STYLE` (blue, 2px).

## Visibility & Zoom

- Tied to same `lineZoomThreshold` as existing entry point dots and RPP→entry lines
- No new settings panel controls
- Drawn only when `showLines` is true (current zoom >= lineZoomThreshold)

## Performance

- Road segments culled by viewport bounds before distance computation
- Distance calculation is O(segments × vertices per segment) per entry point
- For typical WME viewports: <200 segments, <1000 total vertices — negligible cost
- No changes to refresh/debounce cycle

## UI Changes

None. No new toggles, settings, or panel elements. Feature is additive — visible automatically when lines are shown.

## Files

- Single file: `WME_RPP_Visualizer.js`
- Modifications within `buildAnnotationFeatures`: add road segment fetching + nearest-segment logic after entry point line drawing
- New constants: `ROAD_LINE_STYLE`
- New helper: `findNearestRoadPoint(entryPoint, segments)` returning `{ point, distance, segmentId }`

## Out of Scope

- Snapping entry points to roads (read-only visualization only)
- Filtering by road type (all roads)
- Visual indicator for "no road found within X meters"
- Click/hover interaction on road lines
