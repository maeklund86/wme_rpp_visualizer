# WME RPP Visualizer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A WME userscript that renders street number labels, entry point dots, and connection lines for Residential Point Places (RPPs) without selection.

**Architecture:** Single-file userscript (`WME_RPP_Visualizer.js`) following the OpenLayers/Legacy API pattern established by `WME_Koulualueet.js`. A single `OpenLayers.Layer.Vector` holds all annotation features. A floating button toggles the layer on/off. `zoomend`/`moveend` events trigger feature rebuild filtered by viewport + zoom level.

**Tech Stack:** WME Legacy API (`W.model.venues`, `W.map.getOLMap()`), OpenLayers vector layer, localStorage persistence.

---

### Task 1: Script metadata, IIFE wrapper, and constants

**Files:**
- Create: `scripts/WME_RPP_Visualizer.js`

- [ ] **Step 1: Write the header block and skeleton**

```javascript
// ==UserScript==
// @name         WME RPP Visualizer
// @namespace    https://waze.com
// @version      1.0.0
// @description  Show street numbers, entry points, and connection lines for Residential Point Places (RPPs)
// @author       RucaDestiny
// @match        https://*.waze.com/*editor*
// @grant        GM_info
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    if (typeof window !== 'undefined' && window.wmeRppVisualizerInitialized) return;
    if (typeof window !== 'undefined') window.wmeRppVisualizerInitialized = true;

    const SCRIPT_VERSION = GM_info.script.version;
    const SCRIPT_NAME = GM_info.script.name;

    const STORAGE_KEYS = {
        enabled: 'wme-rpp-visualizer-enabled',
        labelZoom: 'wme-rpp-visualizer-label-zoom',
        lineZoom: 'wme-rpp-visualizer-line-zoom',
        floatingButtonPos: 'wme-rpp-visualizer-button-pos'
    };

    const DEFAULT_LABEL_ZOOM = 8;
    const DEFAULT_LINE_ZOOM = 10;

    // === State ===
    let vectorLayer = null;
    let enabled = false;
    let labelZoomThreshold = DEFAULT_LABEL_ZOOM;
    let lineZoomThreshold = DEFAULT_LINE_ZOOM;
    let floatingButton = null;
    let floatingPanel = null;
    let refreshTimeout = null;
    let isRefreshing = false;
    let pendingRefresh = false;
```

- [ ] **Step 2: Commit**

```bash
git add scripts/WME_RPP_Visualizer.js
git commit -m "feat(rpp): add WME RPP Visualizer skeleton"
```

---

### Task 2: Utility functions and localStorage persistence

**Files:**
- Modify: `scripts/WME_RPP_Visualizer.js` (append after state section)

- [ ] **Step 1: Add utility and persistence functions**

```javascript
    // === UTILITY FUNCTIONS ===

    function createElem(tag, attrs) {
        const elem = document.createElement(tag);
        if (attrs) {
            Object.keys(attrs).forEach(key => {
                if (key === 'style' && typeof attrs[key] === 'object') {
                    Object.assign(elem.style, attrs[key]);
                } else if (key === 'innerHTML') {
                    elem.innerHTML = attrs[key];
                } else if (key === 'textContent') {
                    elem.textContent = attrs[key];
                } else {
                    elem.setAttribute(key, attrs[key]);
                }
            });
        }
        return elem;
    }

    // === PERSISTENCE ===

    let saveTimeout = null;

    function savePreferences() {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            try {
                localStorage.setItem(STORAGE_KEYS.enabled, JSON.stringify(enabled));
                localStorage.setItem(STORAGE_KEYS.labelZoom, JSON.stringify(labelZoomThreshold));
                localStorage.setItem(STORAGE_KEYS.lineZoom, JSON.stringify(lineZoomThreshold));
                if (floatingButton) {
                    const pos = { top: floatingButton.style.top, left: floatingButton.style.left };
                    localStorage.setItem(STORAGE_KEYS.floatingButtonPos, JSON.stringify(pos));
                }
            } catch (e) {
                console.warn('[WME RPP Visualizer] Failed to save preferences:', e);
            }
        }, 500);
    }

    function loadPreferences() {
        try {
            const savedEnabled = localStorage.getItem(STORAGE_KEYS.enabled);
            if (savedEnabled !== null) enabled = JSON.parse(savedEnabled);

            const savedLabelZoom = localStorage.getItem(STORAGE_KEYS.labelZoom);
            if (savedLabelZoom !== null) {
                const parsed = parseInt(JSON.parse(savedLabelZoom), 10);
                if (!isNaN(parsed) && parsed >= 1) labelZoomThreshold = parsed;
            }

            const savedLineZoom = localStorage.getItem(STORAGE_KEYS.lineZoom);
            if (savedLineZoom !== null) {
                const parsed = parseInt(JSON.parse(savedLineZoom), 10);
                if (!isNaN(parsed) && parsed >= 1) lineZoomThreshold = parsed;
            }
        } catch (e) {
            console.warn('[WME RPP Visualizer] Failed to load preferences:', e);
        }
    }

    function loadButtonPosition() {
        try {
            const savedPos = localStorage.getItem(STORAGE_KEYS.floatingButtonPos);
            if (savedPos && floatingButton) {
                const pos = JSON.parse(savedPos);
                if (pos.top && pos.left) {
                    floatingButton.style.top = pos.top;
                    floatingButton.style.left = pos.left;
                }
            }
        } catch (e) {
            console.warn('[WME RPP Visualizer] Failed to load button position:', e);
        }
    }
```

- [ ] **Step 2: Commit**

```bash
git add scripts/WME_RPP_Visualizer.js
git commit -m "feat(rpp): add utilities and persistence"
```

---

### Task 3: Data model — scanning RPPs from W.model.venues

**Files:**
- Modify: `scripts/WME_RPP_Visualizer.js` (append after persistence)

- [ ] **Step 1: Add viewport bounds helper and annotation builder**

```javascript
    // === DATA MODEL ===

    function getViewportBounds() {
        const olMap = W.map.getOLMap();
        const extent = olMap.getExtent();
        if (!extent) return null;
        return {
            minX: extent.left,
            minY: extent.bottom,
            maxX: extent.right,
            maxY: extent.top
        };
    }

    function isInViewport(geometry, bounds) {
        if (!bounds || !geometry) return false;
        const x = geometry.x;
        const y = geometry.y;
        return x >= bounds.minX && x <= bounds.maxX &&
               y >= bounds.minY && y <= bounds.maxY;
    }

    function buildAnnotationFeatures() {
        if (!W?.model?.venues) return [];

        const currentZoom = W.map.getZoom();
        const bounds = getViewportBounds();
        const showLabels = currentZoom >= labelZoomThreshold;
        const showLines = currentZoom >= lineZoomThreshold;

        if (!showLabels && !showLines) return [];

        const features = [];
        const venues = W.model.venues;

        Object.keys(venues).forEach(id => {
            const venue = venues[id];
            if (!venue.isResidential) return;
            if (!venue.geometry) return;
            if (!isInViewport(venue.geometry, bounds)) return;

            const rppPoint = venue.geometry.clone();
            const houseNumber = venue.address?.houseNumber || '';

            // Label feature
            if (showLabels && houseNumber) {
                const labelFeature = new OpenLayers.Feature.Vector(rppPoint.clone(), {
                    type: 'label',
                    text: houseNumber,
                    venueId: id
                });
                features.push(labelFeature);
            }

            // Entry points and lines
            if (showLines && venue.navigationPoints) {
                venue.navigationPoints.forEach((np, idx) => {
                    if (!np.position) return;
                    const entryPoint = new OpenLayers.Geometry.Point(
                        np.position.x, np.position.y
                    );

                    // Entry dot
                    const dotFeature = new OpenLayers.Feature.Vector(entryPoint.clone(), {
                        type: 'entry-dot',
                        venueId: id,
                        navIndex: idx
                    });
                    features.push(dotFeature);

                    // RPP -> Entry line
                    const rppToEntry = new OpenLayers.Geometry.LineString([
                        rppPoint.clone(), entryPoint.clone()
                    ]);
                    features.push(new OpenLayers.Feature.Vector(rppToEntry, {
                        type: 'rpp-to-entry',
                        venueId: id,
                        navIndex: idx
                    }));

                    // Entry -> Road line (if snapped to a segment)
                    if (np.segmentId && W.model.segments[np.segmentId]) {
                        const seg = W.model.segments[np.segmentId];
                        const closestPoint = seg.geometry.getClosestPoint(entryPoint);
                        if (closestPoint) {
                            const entryToRoad = new OpenLayers.Geometry.LineString([
                                entryPoint.clone(), closestPoint
                            ]);
                            features.push(new OpenLayers.Feature.Vector(entryToRoad, {
                                type: 'entry-to-road',
                                venueId: id,
                                navIndex: idx,
                                segmentId: np.segmentId
                            }));
                        }
                    }
                });
            }
        });

        return features;
    }
```

- [ ] **Step 2: Commit**

```bash
git add scripts/WME_RPP_Visualizer.js
git commit -m "feat(rpp): add RPP data scanning and feature building"
```

---

### Task 4: Vector layer rendering with style maps

**Files:**
- Modify: `scripts/WME_RPP_Visualizer.js` (append after data model)

- [ ] **Step 1: Add style map and layer create/update functions**

```javascript
    // === VECTOR LAYER ===

    function createStyleMap() {
        return new OpenLayers.StyleMap({
            'default': new OpenLayers.Style({
                label: '${text}',
                labelAlign: 'cm',
                fontColor: '#333333',
                fontFamily: 'Arial, sans-serif',
                fontSize: '12px',
                fontWeight: 'bold',
                labelOutlineColor: 'white',
                labelOutlineWidth: 3
            }, {
                context: {
                    text: function(feature) {
                        if (feature.attributes.type === 'label') return feature.attributes.text;
                        return '';
                    }
                }
            })
        });
    }

    function createLayerStyles() {
        const styles = {};

        styles['label'] = new OpenLayers.Style({
            label: '${text}',
            pointRadius: 0,
            labelAlign: 'cm',
            labelXOffset: 0,
            labelYOffset: -14,
            fontColor: '#222222',
            fontFamily: 'Arial, sans-serif',
            fontSize: '11px',
            fontWeight: 'bold',
            labelOutlineColor: '#FFFFFF',
            labelOutlineWidth: 3,
            display: '${displayLabel}'
        }, {
            context: {
                text: function(feature) { return feature.attributes.text || ''; },
                displayLabel: function() { return 'block'; }
            }
        });

        styles['entry-dot'] = new OpenLayers.Style({
            pointRadius: 5,
            fillColor: '#4CAF50',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWidth: 2,
            graphicName: 'circle'
        });

        styles['rpp-to-entry'] = new OpenLayers.Style({
            strokeColor: '#2196F3',
            strokeWidth: 2,
            strokeDashstyle: 'dash',
            strokeOpacity: 0.8
        });

        styles['entry-to-road'] = new OpenLayers.Style({
            strokeColor: '#4CAF50',
            strokeWidth: 1.5,
            strokeDashstyle: 'dash',
            strokeOpacity: 0.7
        });

        return styles;
    }

    function createVectorLayer() {
        removeVectorLayer();

        vectorLayer = new OpenLayers.Layer.Vector(
            'RPP Visualizer',
            { displayInLayerSwitcher: false }
        );

        W.map.getOLMap().addLayer(vectorLayer);
        return vectorLayer;
    }

    function removeVectorLayer() {
        if (vectorLayer) {
            try {
                W.map.getOLMap().removeLayer(vectorLayer);
                vectorLayer.destroy();
            } catch (e) { /* ignore */ }
            vectorLayer = null;
        }
    }

    function refreshAnnotations() {
        if (refreshTimeout) clearTimeout(refreshTimeout);
        if (isRefreshing) { pendingRefresh = true; return; }
        refreshTimeout = setTimeout(doRefreshAnnotations, 50);
    }

    function doRefreshAnnotations() {
        isRefreshing = true;

        removeVectorLayer();

        if (!enabled) {
            isRefreshing = false;
            return;
        }

        const currentZoom = W.map.getZoom();
        if (currentZoom < labelZoomThreshold && currentZoom < lineZoomThreshold) {
            isRefreshing = false;
            return;
        }

        const features = buildAnnotationFeatures();
        if (features.length > 0) {
            createVectorLayer();

            const styleByType = {};
            const baseStyles = createLayerStyles();
            Object.keys(baseStyles).forEach(type => {
                styleByType[type] = baseStyles[type];
            });

            features.forEach(feature => {
                const type = feature.attributes.type;
                if (type && styleByType[type]) {
                    feature.style = styleByType[type];
                }
            });

            vectorLayer.addFeatures(features);
        }

        isRefreshing = false;
        if (pendingRefresh) {
            pendingRefresh = false;
            refreshAnnotations();
        }
    }
```

- [ ] **Step 2: Commit**

```bash
git add scripts/WME_RPP_Visualizer.js
git commit -m "feat(rpp): add vector layer and annotation rendering"
```

---

### Task 5: Floating UI — button, panel, drag

**Files:**
- Modify: `scripts/WME_RPP_Visualizer.js` (append after vector layer)

- [ ] **Step 1: Add floating UI creation and event handlers**

```javascript
    // === FLOATING UI ===

    function createFloatingUI() {
        floatingButton = createElem('button', {
            id: 'rpp-toggle-btn',
            style: {
                position: 'fixed',
                top: '64px',
                left: '10px',
                zIndex: 10000,
                width: '40px',
                height: '40px',
                padding: 0,
                background: enabled ? '#2E7D32' : '#0052A5',
                color: 'white',
                border: enabled ? '3px solid #1B5E20' : '2px solid #333',
                borderRadius: '6px',
                cursor: 'grab',
                fontSize: '20px',
                boxShadow: '0 3px 8px rgba(0,0,0,0.4)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1
            },
            textContent: 'RPP',
            title: 'Näytä/piilota RPP-tiedot'
        });

        floatingPanel = createElem('div', {
            id: 'rpp-floating-panel',
            style: {
                position: 'fixed',
                top: '125px',
                left: '10px',
                background: 'white',
                border: '2px solid #0052A5',
                borderRadius: '8px',
                padding: '12px',
                zIndex: 10000,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                maxWidth: '260px',
                display: 'none',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize: '13px'
            }
        });

        setupFloatingButtonEvents();

        document.body.appendChild(floatingButton);
        document.body.appendChild(floatingPanel);

        loadButtonPosition();
    }

    function setupFloatingButtonEvents() {
        let isDragging = false;
        let mouseMoveHandler = null;
        let mouseUpHandler = null;

        floatingButton.addEventListener('mouseenter', function() {
            if (!isDragging) {
                this.style.transform = 'scale(1.1)';
                this.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
            }
        });

        floatingButton.addEventListener('mouseleave', function() {
            if (!isDragging) {
                this.style.transform = 'scale(1)';
                this.style.boxShadow = '0 3px 8px rgba(0,0,0,0.4)';
            }
        });

        floatingButton.addEventListener('click', function() {
            if (isDragging) return;
            toggleEnabled();
        });

        floatingButton.addEventListener('mousedown', function(e) {
            e.preventDefault();
            isDragging = false;
            const shiftX = e.clientX - floatingButton.getBoundingClientRect().left;
            const shiftY = e.clientY - floatingButton.getBoundingClientRect().top;

            function moveAt(pageX, pageY) {
                isDragging = true;
                floatingButton.style.left = (pageX - shiftX) + 'px';
                floatingButton.style.top = (pageY - shiftY) + 'px';
                if (floatingPanel.style.display !== 'none') {
                    floatingPanel.style.left = floatingButton.style.left;
                    const buttonTop = parseInt(floatingButton.style.top) || 64;
                    floatingPanel.style.top = (buttonTop + 45) + 'px';
                }
            }

            mouseMoveHandler = function(e) { moveAt(e.pageX, e.pageY); };
            mouseUpHandler = function() {
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
                mouseMoveHandler = null;
                mouseUpHandler = null;
                if (isDragging) {
                    savePreferences();
                    setTimeout(function() { isDragging = false; }, 100);
                }
            };

            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
        });

        floatingButton.addEventListener('dragstart', function() { return false; });
    }

    function toggleEnabled() {
        enabled = !enabled;
        savePreferences();

        floatingButton.style.background = enabled ? '#2E7D32' : '#0052A5';
        floatingButton.style.border = enabled ? '3px solid #1B5E20' : '2px solid #333';

        if (enabled) {
            const buttonTop = parseInt(floatingButton.style.top) || 64;
            floatingPanel.style.left = floatingButton.style.left;
            floatingPanel.style.top = (buttonTop + 45) + 'px';
            floatingPanel.style.display = 'block';
            floatingButton.style.borderColor = '#0052A5';
            floatingButton.style.borderWidth = '3px';
            updatePanelContent();
            refreshAnnotations();
        } else {
            floatingPanel.style.display = 'none';
            floatingButton.style.borderColor = '#333';
            floatingButton.style.borderWidth = '2px';
            removeVectorLayer();
        }
    }

    function updatePanelContent() {
        if (!floatingPanel) return;
        floatingPanel.innerHTML = '';

        const header = createElem('div', {
            style: {
                fontWeight: 'bold',
                marginBottom: '8px',
                fontSize: '14px',
                color: '#0052A5',
                borderBottom: '1px solid #0052A5',
                paddingBottom: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            },
            innerHTML: '<span>RPP Visualizer</span><span style="font-size:10px;color:#999;">v' + SCRIPT_VERSION + '</span>'
        });
        floatingPanel.appendChild(header);

        // Re-enable checkbox (acts as master toggle in panel too)
        const enableContainer = createElem('div', { style: { marginBottom: '10px' } });
        const enableCheckbox = createElem('input', {
            type: 'checkbox',
            id: 'rpp-enable',
            checked: enabled,
            style: { marginRight: '6px', accentColor: '#2E7D32', width: '18px', height: '18px' }
        });
        enableCheckbox.addEventListener('change', function(e) {
            if (e.target.checked !== enabled) toggleEnabled();
        });
        const enableLabel = createElem('label', {
            htmlFor: 'rpp-enable',
            style: { cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#2E7D32' },
            textContent: 'Näytä RPP-tiedot'
        });
        enableContainer.appendChild(enableCheckbox);
        enableContainer.appendChild(enableLabel);
        floatingPanel.appendChild(enableContainer);

        // Label zoom threshold
        const zoomSection = createElem('div', {
            style: { marginBottom: '10px', padding: '8px', background: '#f9f9f9', borderRadius: '4px', border: '1px solid #e0e0e0' }
        });

        const labelZoomContainer = createElem('div', { style: { marginBottom: '6px' } });
        const labelZoomLabel = createElem('label', {
            style: { fontSize: '11px', color: '#666', marginRight: '8px' },
            textContent: 'Näytä numerot zoom:'
        });
        const labelZoomInput = createElem('input', {
            type: 'number',
            id: 'rpp-label-zoom',
            value: labelZoomThreshold.toString(),
            min: '1',
            max: '22',
            step: '1',
            style: { width: '60px', padding: '4px 6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px' }
        });
        labelZoomInput.addEventListener('change', function(e) {
            const value = parseInt(e.target.value, 10);
            if (!isNaN(value) && value >= 1 && value <= 22) {
                labelZoomThreshold = value;
                savePreferences();
                refreshAnnotations();
            }
        });
        labelZoomContainer.appendChild(labelZoomLabel);
        labelZoomContainer.appendChild(labelZoomInput);
        zoomSection.appendChild(labelZoomContainer);

        // Line zoom threshold
        const lineZoomContainer = createElem('div', {});
        const lineZoomLabel = createElem('label', {
            style: { fontSize: '11px', color: '#666', marginRight: '8px' },
            textContent: 'Näytä viivat zoom:'
        });
        const lineZoomInput = createElem('input', {
            type: 'number',
            id: 'rpp-line-zoom',
            value: lineZoomThreshold.toString(),
            min: '1',
            max: '22',
            step: '1',
            style: { width: '60px', padding: '4px 6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px' }
        });
        lineZoomInput.addEventListener('change', function(e) {
            const value = parseInt(e.target.value, 10);
            if (!isNaN(value) && value >= 1 && value <= 22) {
                lineZoomThreshold = value;
                savePreferences();
                refreshAnnotations();
            }
        });
        lineZoomContainer.appendChild(lineZoomLabel);
        lineZoomContainer.appendChild(lineZoomInput);
        zoomSection.appendChild(lineZoomContainer);

        floatingPanel.appendChild(zoomSection);

        // RPP count
        const count = countVisibleRPPs();
        const countDiv = createElem('div', {
            style: { padding: '8px', background: '#f5f5f5', borderRadius: '4px', textAlign: 'center', fontSize: '12px', color: '#666' },
            textContent: count + ' RPP näkyvillä'
        });
        floatingPanel.appendChild(countDiv);
    }

    function countVisibleRPPs() {
        if (!W?.model?.venues) return 0;
        const bounds = getViewportBounds();
        if (!bounds) return 0;
        let count = 0;
        Object.keys(W.model.venues).forEach(id => {
            const v = W.model.venues[id];
            if (v.isResidential && v.geometry && isInViewport(v.geometry, bounds)) count++;
        });
        return count;
    }
```

- [ ] **Step 2: Commit**

```bash
git add scripts/WME_RPP_Visualizer.js
git commit -m "feat(rpp): add floating UI with toggle and settings panel"
```

---

### Task 6: Event wiring and initialization

**Files:**
- Modify: `scripts/WME_RPP_Visualizer.js` (append after floating UI, before closing IIFE)

- [ ] **Step 1: Add init function and startup**

```javascript
    // === INITIALIZATION ===

    function initializeScript() {
        console.log('[WME RPP Visualizer] Initializing...');

        loadPreferences();

        createFloatingUI();

        if (enabled) {
            floatingButton.style.background = '#2E7D32';
            floatingButton.style.border = '3px solid #1B5E20';
            updatePanelContent();
            refreshAnnotations();
        }

        const olMap = W.map.getOLMap();
        olMap.events.register('zoomend', null, function() {
            if (enabled) refreshAnnotations();
        });
        olMap.events.register('moveend', null, function() {
            if (enabled) refreshAnnotations();
        });

        console.log('[WME RPP Visualizer] Initialized');
    }

    // === STARTUP ===

    if (W?.userscripts?.state?.isReady) {
        initializeScript();
    } else {
        document.addEventListener('wme-ready', function() {
            initializeScript();
        }, { once: true });
    }

})();
```

- [ ] **Step 2: Commit**

```bash
git add scripts/WME_RPP_Visualizer.js
git commit -m "feat(rpp): add initialization and event wiring"
```

---

### Task 7: Self-review and final integration check

- [ ] **Step 1: Verify the complete file is syntactically valid**

The file should follow this structure:
```
1.  UserScript header block (12 lines)
2.  IIFE start + init guard (5 lines)
3.  Constants/config (20 lines)
4.  State variables (8 lines)
5.  createElem utility (15 lines)
6.  savePreferences (18 lines)
7.  loadPreferences (30 lines)
8.  loadButtonPosition (16 lines)
9.  getViewportBounds / isInViewport (18 lines)
10. buildAnnotationFeatures (65 lines)
11. createLayerStyles (45 lines)
12. createVectorLayer / removeVectorLayer (18 lines)
13. refreshAnnotations / doRefreshAnnotations (30 lines)
14. createFloatingUI / setupFloatingButtonEvents (85 lines)
15. toggleEnabled / updatePanelContent / countVisibleRPPs (100 lines)
16. initializeScript (20 lines)
17. startup + IIFE close (10 lines)
```

Check:
- All `@match`, `@grant` patterns match existing scripts
- No `TODOs`, `TBDs`, or placeholder comments
- Variable names are consistent across all functions
- `GM_info` is available (requires `@grant GM_info` or `unsafeWindow`)

- [ ] **Step 2: Final commit**

```bash
git add scripts/WME_RPP_Visualizer.js
git commit -m "feat(rpp): finalize WME RPP Visualizer script"
```
