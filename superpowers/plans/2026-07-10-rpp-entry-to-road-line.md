# RPP Entry Point → Nearest Road Line — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw dashed orange line from each RPP entry point dot to nearest point on closest road segment.

**Architecture:** Single-file modification to `WME_RPP_Visualizer.js`. Add `ROAD_LINE_STYLE` constant, `findNearestRoadPoint()` helper, and integration in `buildAnnotationFeatures()` after existing entry point line drawing.

**Tech Stack:** OpenLayers (existing), WME SDK `W.model.segments`

---

### Task 1: Add ROAD_LINE_STYLE constant

**Files:**
- Modify: `WME_RPP_Visualizer.js` after LINE_STYLE (around line 250)

- [ ] **Step 1: Add road line style constant after LINE_STYLE**

Insert after `LINE_STYLE` definition (after line 250):

```js
const ROAD_LINE_STYLE = {
    strokeColor: '#FF9800',
    strokeWidth: 1.5,
    strokeDashstyle: 'dash',
    strokeOpacity: 0.7
};
```

- [ ] **Step 2: Commit**

```bash
git add WME_RPP_Visualizer.js
git commit -m "feat: add ROAD_LINE_STYLE constant for entry-to-road line"
```

---

### Task 2: Add findNearestRoadPoint helper

**Files:**
- Modify: `WME_RPP_Visualizer.js` — add function after `buildAnnotationFeatures` or in utility section (~line 110)

- [ ] **Step 1: Add findNearestRoadPoint function**

Insert after `getViewportBounds` (~line 122):

```js
function findNearestRoadPoint(point, segments) {
    let best = { point: null, distance: Infinity, segmentId: null };

    segments.forEach(segment => {
        const geom = segment.geometry;
        if (!geom) return;

        const components = geom.components || [geom];
        components.forEach(comp => {
            const vertices = comp.components || comp.vertices || [];
            for (let i = 0; i < vertices.length - 1; i++) {
                const a = vertices[i];
                const b = vertices[i + 1];

                const ax = point.x - a.x;
                const ay = point.y - a.y;
                const bx = b.x - a.x;
                const by = b.y - a.y;

                const lenSq = bx * bx + by * by;
                if (lenSq === 0) continue;

                let t = (ax * bx + ay * by) / lenSq;
                t = Math.max(0, Math.min(1, t));

                const projX = a.x + t * bx;
                const projY = a.y + t * by;

                const dx = point.x - projX;
                const dy = point.y - projY;
                const dist = dx * dx + dy * dy;

                if (dist < best.distance) {
                    best.distance = dist;
                    best.point = new OpenLayers.Geometry.Point(projX, projY);
                    best.segmentId = segment.segmentId || segment.id;
                }
            }
        });
    });

    best.distance = Math.sqrt(best.distance);
    return best;
}
```

- [ ] **Step 2: Commit**

```bash
git add WME_RPP_Visualizer.js
git commit -m "feat: add findNearestRoadPoint helper"
```

---

### Task 3: Fetch road segments and draw entry-to-road lines in buildAnnotationFeatures

**Files:**
- Modify: `WME_RPP_Visualizer.js` — inside `buildAnnotationFeatures`, after entry point line drawing (~line 210)

- [ ] **Step 1: Fetch viewport-visible segments at top of buildAnnotationFeatures**

Add after `const features = [];` (~line 146):

```js
const allSegments = W.model.segments.getObjectArray();
const segments = allSegments.filter(s => {
    const sg = s.geometry;
    if (!sg) return false;
    const centroid = sg.getBounds?.()?.getCenterLonLat?.() || sg.components?.[0]?.components?.[0];
    if (centroid) return isInViewport(centroid, bounds);
    return true;
});
```

- [ ] **Step 2: Add road line drawing after entry point dot/line block**

After the `entryPoints.forEach` block closes (after `});` at ~line 214), add:

```js
// Entry -> Nearest road line
if (showLines && segments.length > 0) {
    entryPoints.forEach((np, idx) => {
        try {
            const epAttr = np.attributes || np;
            const pt = epAttr._point || epAttr.point || epAttr.position;
            if (!pt) return;
            const coords = pt.coordinates || (pt.x != null ? [pt.x, pt.y] : null);
            if (!coords || coords.length < 2) return;
            const entryPoint = new OpenLayers.Geometry.Point(coords[0], coords[1]);
            entryPoint.transform(
                new OpenLayers.Projection('EPSG:4326'),
                W.map.getOLMap().getProjectionObject()
            );

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
            }
        } catch (err) {
            debugLog('[RPP] road line error:', err.message);
        }
    });
}
```

- [ ] **Step 3: Commit**

```bash
git add WME_RPP_Visualizer.js
git commit -m "feat: draw entry-to-nearest-road dashed orange line"
```

---

### Task 4: Self-review and verify

- [ ] **Step 1: Check for edge cases**

Verify plan covers:
- No segments in viewport → `segments.length === 0`, skip gracefully
- Segment geometry missing → filtered out in filter step
- Entry point has no valid coords → skipped in road line block (same guard as existing entry point code)
- `W.model.segments` undefined → guard with optional chaining in fetch code

If any uncovered, add fix. Otherwise proceed.

- [ ] **Step 2: Read through Tasks 1-3 for type consistency**

Verify:
- `findNearestRoadPoint` called with projected entryPoint matches its parameter `point` (expects `OpenLayers.Geometry.Point` with `.x`, `.y`)
- `best.point` created as `new OpenLayers.Geometry.Point(projX, projY)` — matches LineString constructor usage
- `ROAD_LINE_STYLE` property names match OpenLayers Vector style convention (same pattern as existing `LINE_STYLE`)
- `segments` filter uses `isInViewport` with centroid point — checks `sg.getBounds` fallback pattern

Fix any issues inline.

- [ ] **Step 3: Commit final**

```bash
git add WME_RPP_Visualizer.js
git commit -m "feat: add entry-to-nearest-road connection line"
```
