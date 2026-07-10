// ==UserScript==
// @name         WME RPP Visualizer
// @namespace    https://waze.com
// @version      1.0.0
// @description  Show street numbers, entry points, and connection lines for Residential Point Places (RPPs)
// @author       RucaDestiny
// @downloadURL  https://greasyfork.org/scripts/586509-wme-rpp-visualizer/code/WME%20RPP%20Visualizer.user.js
// @updateURL    https://greasyfork.org/scripts/586509-wme-rpp-visualizer/code/WME%20RPP%20Visualizer.meta.js
// @supportURL   https://greasyfork.org/en/scripts/586509-wme-rpp-visualizer
// @match        https://*.waze.com/*editor*
// @grant        GM_info
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    if (typeof window !== 'undefined' && window.wmeRppVisualizerInitialized) return;
    if (typeof window !== 'undefined') window.wmeRppVisualizerInitialized = true;

    const SCRIPT_VERSION = GM_info.script.version;

    const STORAGE_KEYS = {
        enabled: 'wme-rpp-visualizer-enabled',
        labelZoom: 'wme-rpp-visualizer-label-zoom',
        lineZoom: 'wme-rpp-visualizer-line-zoom',
        debug: 'wme-rpp-visualizer-debug'
    };

    const DEFAULT_LABEL_ZOOM = 17;
    const DEFAULT_LINE_ZOOM = 18;

    // === State ===
    let vectorLayer = null;
    let enabled = false;
    let debug = false;
    let labelZoomThreshold = DEFAULT_LABEL_ZOOM;
    let lineZoomThreshold = DEFAULT_LINE_ZOOM;

    let refreshTimeout = null;
    let isRefreshing = false;
    let pendingRefresh = false;

    // === UTILITY FUNCTIONS ===

    function debugLog(...args) {
        if (debug) console.log('[RPP]', ...args);
    }

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
                localStorage.setItem(STORAGE_KEYS.debug, JSON.stringify(debug));
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

            const savedDebug = localStorage.getItem(STORAGE_KEYS.debug);
            if (savedDebug !== null) debug = JSON.parse(savedDebug);
        } catch (e) {
            console.warn('[WME RPP Visualizer] Failed to load preferences:', e);
        }
    }

    // === DATA MODEL ===

    function getViewportBounds() {
        const olMap = W.map.getOLMap();
        const extent = olMap.getExtent();
        if (!extent) return null;
        return {
            minX: extent[0] || extent.left,
            minY: extent[1] || extent.bottom,
            maxX: extent[2] || extent.right,
            maxY: extent[3] || extent.top
        };
    }

    function findNearestRoadPoint(point, segments) {
        let best = { point: null, distance: Infinity, segmentId: null };
        segments.forEach(segment => {
            const geom = segment.geometry || segment.attributes?.geometry;
            if (!geom) return;

            const vertices = geom.components || [];
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

        best.distance = Math.sqrt(best.distance);
        return best;
    }

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

    function isInViewport(geometry, bounds) {
        if (!bounds || !geometry) return false;
        const x = geometry.x;
        const y = geometry.y;
        return x >= bounds.minX && x <= bounds.maxX &&
               y >= bounds.minY && y <= bounds.maxY;
    }

    function getVenueAttrs(venue) {
        return venue.attributes || venue;
    }

    function buildAnnotationFeatures() {
        if (!W?.model?.venues?.getObjectArray) return [];

        const currentZoom = W.map.getZoom();
        const bounds = getViewportBounds();
        const showLabels = currentZoom >= labelZoomThreshold;
        const showLines = currentZoom >= lineZoomThreshold;

        if (!showLabels && !showLines) return [];

        const features = [];

        const segModel = W.model?.segments;
        debugLog('[RPP] segModel:', !!segModel, 'getObjArr:', typeof segModel?.getObjectArray, 'objects:', typeof segModel?.objects, 'getArr:', typeof segModel?.getArray);
        const allSegments = segModel?.getObjectArray?.() ?? segModel?.getArray?.() ?? Object.values(segModel?.objects ?? {}) ?? [];
        debugLog('[RPP] allSegments count:', allSegments.length);

        const segments = allSegments.filter(s => {
            const sg = s.geometry || s.attributes?.geometry;
            if (!sg) return false;
            const centroid = sg.getBounds?.()?.getCenterLonLat?.();
            if (centroid) {
                centroid.x = centroid.lon;
                centroid.y = centroid.lat;
                return isInViewport(centroid, bounds);
            }
            const pt = sg.components?.[0]?.components?.[0];
            if (pt) return isInViewport(pt, bounds);
            return true;
        });
        debugLog('[RPP] segments in viewport:', segments.length);

        const venues = W.model.venues.getObjectArray();

        let total = 0, residential = 0, hasGeom = 0, inView = 0;
        venues.forEach(venue => {
            total++;
            const attrs = getVenueAttrs(venue);
            if (!attrs.residential) { if (total === 1) debugLog('[RPP] first venue attrs.residential:', attrs.residential); return; }
            residential++;
            if (!attrs.geometry) return;
            hasGeom++;
            if (!isInViewport(attrs.geometry, bounds)) return;
            inView++;

            const rppPoint = attrs.geometry.clone();
            const houseNumber = attrs.houseNumber || '';
            const venueId = attrs.id;

            // Label feature
            if (showLabels && houseNumber) {
                const labelFeature = new OpenLayers.Feature.Vector(rppPoint.clone(), {
                    text: houseNumber,
                    venueId: venueId
                });
                labelFeature.style = Object.assign({}, LABEL_STYLE, { label: houseNumber });
                features.push(labelFeature);
            }

            // Entry points and lines
            const entryPoints = attrs.entryExitPoints || attrs.navigationPoints;
            if (entryPoints) debugLog('[RPP] eplen:', entryPoints.length, 'showLines:', showLines, 'zoom:', currentZoom, 'threshold:', lineZoomThreshold);
            if (showLines && entryPoints) {
                entryPoints.forEach((np, idx) => {
                    try {
                        const epAttr = np.attributes || np;
                        debugLog('[RPP] _point:', JSON.stringify(epAttr._point), 'type:', typeof epAttr._point);
                        const pt = epAttr._point || epAttr.point || epAttr.position;
                        if (!pt) { debugLog('[RPP] no pt'); return; }
                        const coords = pt.coordinates || (pt.x != null ? [pt.x, pt.y] : null);
                        if (!coords || coords.length < 2) { debugLog('[RPP] bad coords:', JSON.stringify(coords)); return; }
                        const entryPoint = new OpenLayers.Geometry.Point(coords[0], coords[1]);
                        entryPoint.transform(
                            new OpenLayers.Projection('EPSG:4326'),
                            W.map.getOLMap().getProjectionObject()
                        );

                        // Entry dot
                        const dotFeature = new OpenLayers.Feature.Vector(entryPoint.clone(), {
                            venueId: venueId,
                            navIndex: idx
                        });
                        dotFeature.style = ENTRY_DOT_STYLE;
                        features.push(dotFeature);

                        // RPP -> Entry line
                        const rppToEntry = new OpenLayers.Geometry.LineString([
                            rppPoint.clone(), entryPoint.clone()
                        ]);
                        const lineFeature = new OpenLayers.Feature.Vector(rppToEntry, {
                            venueId: venueId,
                            navIndex: idx
                        });
                        lineFeature.style = LINE_STYLE;
                        features.push(lineFeature);
                    } catch (err) {
                        debugLog('[RPP] ep error:', err.message);
                    }
                });
            }

            // Entry -> Nearest road line
            if (showLines && entryPoints && segments.length > 0) {
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

                        addRoadConnection(entryPoint, venueId, features, segments);
                    } catch (err) {
                        debugLog('[RPP] road line error:', err.message);
                    }
                });
            }

            // No entry points — draw line from RPP marker directly to nearest road
            if (showLines && (!entryPoints || entryPoints.length === 0) && segments.length > 0) {
                try {
                    addRoadConnection(rppPoint, venueId, features, segments);
                } catch (err) {
                    debugLog('[RPP] fallback road line error:', err.message);
                }
            }
        });

        if (total > 0) debugLog('[RPP] total:', total, 'res:', residential, 'geom:', hasGeom, 'view:', inView, 'zoom:', currentZoom, 'features:', features.length);
        return features;
    }

    // === VECTOR LAYER ===

    const LABEL_STYLE = {
        pointRadius: 0,
        labelAlign: 'cm',
        labelXOffset: 0,
        labelYOffset: -20,
        fontColor: '#222222',
        fontFamily: 'Arial, sans-serif',
        fontSize: '11px',
        fontWeight: 'bold',
        labelOutlineColor: '#FFFFFF',
        labelOutlineWidth: 3
    };

    const ENTRY_DOT_STYLE = {
        pointRadius: 5,
        fillColor: '#4CAF50',
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWidth: 2,
        graphicName: 'circle'
    };

    const LINE_STYLE = {
        strokeColor: '#2196F3',
        strokeWidth: 2,
        strokeDashstyle: 'dash',
        strokeOpacity: 0.8
    };

    const ROAD_LINE_STYLE = {
        strokeColor: '#FF9800',
        strokeWidth: 2,
        strokeDashstyle: 'dash',
        strokeOpacity: 0.7
    };

    const ROAD_DOT_STYLE = {
        pointRadius: 4,
        fillColor: '#FF9800',
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWidth: 1.5,
        graphicName: 'circle'
    };

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
            vectorLayer.addFeatures(features);
        }

        isRefreshing = false;
        if (pendingRefresh) {
            pendingRefresh = false;
            refreshAnnotations();
        }
    }

    function countVisibleRPPs() {
        if (!W?.model?.venues?.getObjectArray) return 0;
        const bounds = getViewportBounds();
        if (!bounds) return 0;
        let count = 0;
        const venues = W.model.venues.getObjectArray();
        venues.forEach(venue => {
            const attrs = getVenueAttrs(venue);
            if (attrs.residential && attrs.geometry && isInViewport(attrs.geometry, bounds)) count++;
        });
        return count;
    }

    // === SIDEBAR UI ===

    let sidebarPanel = null;

    async function createSidebarPanel() {
        console.log('[WME RPP Visualizer] Creating sidebar panel...');

        const { tabLabel, tabPane } = W.userscripts.registerSidebarTab('RPP');
        tabLabel.textContent = 'RPP';
        tabLabel.title = 'RPP Visualizer';

        const divRoot = createElem('div', {
            style: {
                padding: '8px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize: '12px'
            }
        });

        // Header
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
        divRoot.appendChild(header);

        // Enable toggle
        const enableContainer = createElem('div', { style: { marginBottom: '10px' } });
        const enableCheckbox = createElem('input', {
            type: 'checkbox',
            id: 'rpp-enable',
            checked: enabled,
            style: { marginRight: '6px', accentColor: '#2E7D32', width: '18px', height: '18px' }
        });
        enableCheckbox.addEventListener('change', function(e) {
            enabled = e.target.checked;
            savePreferences();
            if (enabled) {
                refreshAnnotations();
            } else {
                removeVectorLayer();
            }
            updateSidebarCount();
        });
        const enableLabel = createElem('label', {
            htmlFor: 'rpp-enable',
            style: { cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#2E7D32' },
            textContent: 'Show RPP Info'
        });
        enableContainer.appendChild(enableCheckbox);
        enableContainer.appendChild(enableLabel);
        divRoot.appendChild(enableContainer);

        // Zoom settings section
        const zoomSection = createElem('div', {
            style: { marginBottom: '10px', padding: '8px', background: '#f9f9f9', borderRadius: '4px', border: '1px solid #e0e0e0' }
        });

        const labelZoomContainer = createElem('div', { style: { marginBottom: '6px' } });
        const labelZoomLabel = createElem('label', {
            style: { fontSize: '11px', color: '#666', marginRight: '8px' },
            textContent: 'Show labels zoom:'
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

        const lineZoomContainer = createElem('div', {});
        const lineZoomLabel = createElem('label', {
            style: { fontSize: '11px', color: '#666', marginRight: '8px' },
            textContent: 'Show lines zoom:'
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

        divRoot.appendChild(zoomSection);

        // RPP count
        const countDiv = createElem('div', {
            id: 'rpp-count',
            style: { padding: '8px', background: '#f5f5f5', borderRadius: '4px', textAlign: 'center', fontSize: '12px', color: '#666', marginBottom: '10px' },
            textContent: countVisibleRPPs() + ' RPP visible'
        });
        divRoot.appendChild(countDiv);

        // Debug toggle
        const debugContainer = createElem('div', { style: {} });
        const debugCheckbox = createElem('input', {
            type: 'checkbox',
            id: 'rpp-debug',
            checked: debug,
            style: { marginRight: '6px', accentColor: '#666', width: '14px', height: '14px' }
        });
        debugCheckbox.addEventListener('change', function(e) {
            debug = e.target.checked;
            savePreferences();
        });
        const debugLabel = createElem('label', {
            htmlFor: 'rpp-debug',
            style: { cursor: 'pointer', fontSize: '11px', color: '#999' },
            textContent: 'Debug'
        });
        debugContainer.appendChild(debugCheckbox);
        debugContainer.appendChild(debugLabel);
        divRoot.appendChild(debugContainer);

        tabPane.appendChild(divRoot);
        tabPane.id = 'rpp-sidebar-panel';
        await W.userscripts.waitForElementConnected(tabPane);

        sidebarPanel = {
            countDiv: document.getElementById('rpp-count'),
            enableCheckbox: document.getElementById('rpp-enable')
        };
    }

    function updateSidebarCount() {
        if (!sidebarPanel?.countDiv) return;
        const count = enabled ? countVisibleRPPs() : 0;
        sidebarPanel.countDiv.textContent = count + ' RPP visible';
    }

    // === INITIALIZATION ===

    function initializeScript() {
        console.log('[WME RPP Visualizer] Initializing...');

        loadPreferences();
        createSidebarPanel();

        if (enabled) {
            refreshAnnotations();
        }

        const olMap = W.map.getOLMap();
        olMap.events.register('zoomend', null, function() {
            if (enabled) { updateSidebarCount(); refreshAnnotations(); }
        });
        olMap.events.register('moveend', null, function() {
            if (enabled) { updateSidebarCount(); refreshAnnotations(); }
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
