# RPP Fallback Road Line — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw orange connection line from RPP marker to nearest road when RPP has no entry points.

**Architecture:** Extract entry→road drawing into reusable helper `addRoadConnection`. Call it from existing entry point loop (unchanged behavior) and add new fallback call for RPPs without entry points.

**Tech Stack:** JavaScript, OpenLayers (WME SDK)

---

### Task 1: Add `addRoadConnection` helper + fallback logic

**Files:**
- Modify: `WME_RPP_Visualizer.js:278-318`

- [ ] **Step 1: Add `addRoadConnection` helper function**

Insert new function after `findNearestRoadPoint` (after line 163).

```javascript
function addRoadConnection(sourcePoint, venueId, features, segments) {
    const nearest = findNearestRoadPoint(sourcePoint, segments);
    if (!nearest.point) return;

    const roadLine = new OpenLayers.Geometry.LineString([
        sourcePoint.clone(), nearest.point
    ]);
    const roadLineFeature = new OpenLayers.Feature.Vector(roadLine, {
        venueId: venueId,
        type: 'road-line'
    });
    roadLineFeature.style = ROAD_LINE_STYLE;
    features.push(roadLineFeature);

    const roadDotFeature = new OpenLayers.Feature.Vector(nearest.point.clone(), {
        venueId: venueId,
        type: 'road-dot'
    });
    roadDotFeature.style = ROAD_DOT_STYLE;
    features.push(roadDotFeature);
}
```

Note: drops `navIndex` attribute from features (not used for rendering, only had it for debugging). Fallback lines have no navIndex since there's no entry point.

- [ ] **Step 2: Replace inline Entry→Road block with helper call**

Replace lines 293-313 (inside `entryPoints.forEach`, the entryPoint → road portion):

Old:
```javascript
const nearest = findNearestRoadPoint(entryPoint, segments);
if (nearest.point) {
    const roadLine = new OpenLayers.Geometry.LineString([
        entryPoint.clone(), nearest.point
    ]);
    const roadLineFeature = new OpenLayers.Feature.Vector(roadLine, {
        venueId: venueId,
        navIndex: idx,
        type: 'road-line'
    });
    roadLineFeature.style = ROAD_LINE_STYLE;
    features.push(roadLineFeature);

    const roadDotFeature = new OpenLayers.Feature.Vector(nearest.point.clone(), {
        venueId: venueId,
        navIndex: idx,
        type: 'road-dot'
    });
    roadDotFeature.style = ROAD_DOT_STYLE;
    features.push(roadDotFeature);
}
```

New:
```javascript
addRoadConnection(entryPoint, venueId, features, segments);
```

- [ ] **Step 3: Add fallback block after entry point loop**

Insert after the closing `}` of the entry point loop (after line 318), before the closing `});` of `venues.forEach`:

```javascript
// No entry points — draw line from RPP marker directly to nearest road
if (showLines && (!entryPoints || entryPoints.length === 0) && segments.length > 0) {
    addRoadConnection(rppPoint, venueId, features, segments);
}
```

- [ ] **Step 4: Commit**

```bash
git add WME_RPP_Visualizer.js
git commit -m "feat: draw road line from RPP marker when no entry points exist"
```
