import { buildAnnotationDescriptions } from './annotation-construction.js';
import { createOpenLayersAnnotationAdapter, toPlainSegmentSnapshot } from './openlayers-annotation-adapter.js';

export function createWmeAnnotationRefreshHost({ getWme, getOpenLayers, getSettings, debugLog }) {
    let vectorLayer = null;

    function getViewportBounds(W) {
        const olMap = W.map.getOLMap();
        const extent = olMap.getExtent();
        if (!extent) return null;
        return {
            minX: extent[0] || extent.left,
            minY: extent[1] || extent.bottom,
            maxX: extent[2] || extent.right,
            maxY: extent[3] || extent.top,
        };
    }

    function isInViewport(geometry, bounds) {
        if (!bounds || !geometry) return false;
        const x = geometry.x;
        const y = geometry.y;
        return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
    }

    function getVenueAttrs(venue) {
        return venue.attributes || venue;
    }

    function toPlainEntryPoint(entryPoint) {
        try {
            const attributes = entryPoint.attributes || entryPoint;
            const point = attributes._point || attributes.point || attributes.position;
            if (!point) return null;

            const plainPoint = point.coordinates
                ? { coordinates: Array.from(point.coordinates) }
                : point.x != null
                  ? { x: point.x, y: point.y }
                  : {};
            return { _point: plainPoint };
        } catch (err) {
            debugLog('[RPP] entry point snapshot error:', err.message);
            return null;
        }
    }

    function buildFeatures() {
        const W = getWme();
        if (!W?.model?.venues?.getObjectArray) return [];

        const currentZoom = W.map.getZoom();
        const bounds = getViewportBounds(W);
        const settings = getSettings();
        const showLabels = currentZoom >= settings.labelZoomThreshold;
        const showLines = currentZoom >= settings.lineZoomThreshold;
        if (!showLabels && !showLines) return [];

        const segModel = W.model?.segments;
        debugLog(
            '[RPP] segModel:',
            !!segModel,
            'getObjArr:',
            typeof segModel?.getObjectArray,
            'objects:',
            typeof segModel?.objects,
            'getArr:',
            typeof segModel?.getArray,
        );
        const allSegments =
            segModel?.getObjectArray?.() ?? segModel?.getArray?.() ?? Object.values(segModel?.objects ?? {}) ?? [];
        debugLog('[RPP] allSegments count:', allSegments.length);

        const segments = allSegments.map(toPlainSegmentSnapshot).filter(Boolean);
        const venues = W.model.venues.getObjectArray().map((venue) => {
            const attrs = getVenueAttrs(venue);
            const entryPoints = attrs.entryExitPoints || attrs.navigationPoints;
            return {
                residential: attrs.residential,
                geometry: attrs.geometry ? { x: attrs.geometry.x, y: attrs.geometry.y } : null,
                houseNumber: attrs.houseNumber || '',
                id: attrs.id,
                entryPoints: entryPoints ? entryPoints.map(toPlainEntryPoint) : entryPoints,
            };
        });

        const snapshot = {
            zoom: currentZoom,
            bounds,
            labelZoomThreshold: settings.labelZoomThreshold,
            lineZoomThreshold: settings.lineZoomThreshold,
            venues,
            segments,
        };
        const OpenLayers = getOpenLayers();
        const adapter = createOpenLayersAnnotationAdapter(OpenLayers, W.map.getOLMap());
        const descriptions = buildAnnotationDescriptions(snapshot, adapter.projectCoordinates);
        const features = adapter.materialize(descriptions);

        if (venues.length > 0) {
            const residentialVenues = venues.filter((venue) => venue.residential);
            const hasGeometry = residentialVenues.filter((venue) => venue.geometry).length;
            const inView = residentialVenues.filter(
                (venue) => venue.geometry && isInViewport(venue.geometry, bounds),
            ).length;
            debugLog(
                '[RPP] total:',
                venues.length,
                'res:',
                residentialVenues.length,
                'geom:',
                hasGeometry,
                'view:',
                inView,
                'zoom:',
                currentZoom,
                'features:',
                features.length,
            );
        }
        return features;
    }

    function clear() {
        if (!vectorLayer) return;
        try {
            getWme().map.getOLMap().removeLayer(vectorLayer);
            vectorLayer.destroy();
        } catch {
            /* ignore */
        }
        vectorLayer = null;
    }

    function render(features) {
        const W = getWme();
        const OpenLayers = getOpenLayers();
        const map = W.map.getOLMap();
        const previousLayer = vectorLayer;
        const candidateLayer = new OpenLayers.Layer.Vector('RPP Visualizer', { displayInLayerSwitcher: false });

        try {
            candidateLayer.addFeatures(features);
            map.addLayer(candidateLayer);
        } catch (error) {
            try {
                map.removeLayer(candidateLayer);
            } catch {
                /* ignore candidate cleanup errors */
            }
            try {
                candidateLayer.destroy();
            } catch {
                /* ignore candidate cleanup errors */
            }
            throw error;
        }

        vectorLayer = candidateLayer;
        if (previousLayer) {
            try {
                map.removeLayer(previousLayer);
            } catch {
                /* ignore previous-layer cleanup errors */
            }
            try {
                previousLayer.destroy();
            } catch {
                /* ignore previous-layer cleanup errors */
            }
        }
    }

    return {
        readState() {
            const settings = getSettings();
            return {
                enabled: settings.enabled,
                zoom: getWme().map.getZoom(),
                labelZoomThreshold: settings.labelZoomThreshold,
                lineZoomThreshold: settings.lineZoomThreshold,
            };
        },
        buildFeatures,
        clear,
        render,
        logError(error) {
            console.error('[WME RPP Visualizer] Annotation refresh failed:', error);
        },
    };
}
